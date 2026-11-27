// CRM Service: Leads, Activities, Followups, Pipeline Kanban, Bulk Import & Customers with 3-tier Record Scope.
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  crmCustomers,
  crmLeadActivities,
  crmLeadFollowups,
  crmLeads,
  documents,
  LEAD_STAGES,
  notifications,
  PRIORITIES,
  salesInvoices,
  salesOrders,
  salesQuotations,
  tenantMemberships,
  tenants,
  users,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import {
  hasTenantWideScope,
  resolveRecordScope,
  type AuthContext,
  type RecordScopeContext,
} from "../../middlewares/guards";
import type {
  AssignLeadInput,
  ConvertLeadInput,
  CreateCustomerInput,
  CreateLeadActivityInput,
  CreateLeadFollowupInput,
  CreateLeadInput,
  CustomersQuery,
  ImportLeadsInput,
  LeadsQuery,
  PipelineQuery,
  UpdateFollowupInput,
  UpdateLeadInput,
} from "./crm.model";

async function resolveCrmScope(auth: AuthContext, isCustomer = false): Promise<RecordScopeContext> {
  if (hasTenantWideScope(auth, "CRM.LEADS.VIEW_ALL") || (isCustomer && hasTenantWideScope(auth, "CRM.CUSTOMERS.VIEW_ALL"))) {
    return { scope: "COMPANY_WIDE", departmentIds: [], teamIds: [], teamUserIds: [] };
  }
  const teamPerm =
    isCustomer && !auth.permissions.includes("CRM.CUSTOMERS.VIEW_TEAM")
      ? "CRM.LEADS.VIEW_TEAM"
      : isCustomer
        ? "CRM.CUSTOMERS.VIEW_TEAM"
        : "CRM.LEADS.VIEW_TEAM";
  return resolveRecordScope(
    auth,
    isCustomer ? "CRM.CUSTOMERS.VIEW_ALL" : "CRM.LEADS.VIEW_ALL",
    teamPerm,
  );
}

function assertRecordInScope(
  scopeCtx: RecordScopeContext,
  ownerUserId: string | null,
  createdBy: string | null,
  actorUserId: string,
  entityLabel: string,
) {
  if (scopeCtx.scope === "COMPANY_WIDE") return;

  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    const inTeam =
      (ownerUserId && scopeCtx.teamUserIds.includes(ownerUserId)) ||
      (createdBy && scopeCtx.teamUserIds.includes(createdBy));
    if (!inTeam) {
      throw Errors.forbidden(`You do not have access to this ${entityLabel} outside your sales team.`);
    }
    return;
  }

  if (ownerUserId !== actorUserId && createdBy !== actorUserId) {
    throw Errors.forbidden(`You do not have access to this ${entityLabel} record.`);
  }
}

async function assertLeadAccess(auth: AuthContext, leadId: string) {
  const tenantId = auth.tenantId!;
  const [lead] = await db
    .select()
    .from(crmLeads)
    .where(and(eq(crmLeads.id, leadId), eq(crmLeads.tenantId, tenantId)))
    .limit(1);

  if (!lead) {
    throw Errors.notFound("Lead not found.");
  }

  const scopeCtx = await resolveCrmScope(auth, false);
  assertRecordInScope(scopeCtx, lead.ownerUserId, lead.createdBy, auth.userId, "lead");
  return { lead, scopeCtx };
}

async function assertValidAssignee(
  auth: AuthContext,
  scopeCtx: RecordScopeContext,
  targetUserId: string,
) {
  const tenantId = auth.tenantId!;
  const [m] = await db
    .select({
      id: tenantMemberships.id,
      status: tenantMemberships.status,
      departmentId: tenantMemberships.departmentId,
      fullName: users.fullName,
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, targetUserId)))
    .limit(1);

  if (!m) {
    throw Errors.badRequest("Assigned user does not belong to this company.");
  }
  if (m.status !== "ACTIVE") {
    throw Errors.badRequest("Assigned user membership is not active.");
  }
  if (scopeCtx.scope === "TEAM_DEPARTMENT" && !scopeCtx.teamUserIds.includes(targetUserId)) {
    throw Errors.forbidden("Assigned user is not an active member of your sales team or department.");
  }
  if (scopeCtx.scope === "OWN_ONLY" && targetUserId !== auth.userId) {
    throw Errors.forbidden("You can only assign records to yourself.");
  }
  return m;
}

function applyOwnerFilterCondition(
  scopeCtx: RecordScopeContext,
  auth: AuthContext,
  requestedOwnerId: string | undefined,
  ownerCol: typeof crmLeads.ownerUserId | typeof crmCustomers.ownerUserId,
  createdCol: typeof crmLeads.createdBy | typeof crmCustomers.createdBy,
) {
  if (scopeCtx.scope === "COMPANY_WIDE") {
    return requestedOwnerId ? [eq(ownerCol, requestedOwnerId)] : [];
  }

  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    if (requestedOwnerId) {
      if (!scopeCtx.teamUserIds.includes(requestedOwnerId)) {
        throw Errors.forbidden("Cannot filter records for a user outside your sales team.");
      }
      return [eq(ownerCol, requestedOwnerId)];
    }
    return [or(inArray(ownerCol, scopeCtx.teamUserIds), inArray(createdCol, scopeCtx.teamUserIds))!];
  }

  if (requestedOwnerId && requestedOwnerId !== auth.userId) {
    throw Errors.forbidden("You can only view your own assigned records.");
  }
  return [or(eq(ownerCol, auth.userId), eq(createdCol, auth.userId))!];
}

function resolvePipelineStartDate(period: PipelineQuery["period"]): Date | null {
  if (period === "ALL") return null;
  const start = new Date();
  if (period === "TODAY") start.setHours(0, 0, 0, 0);
  else if (period === "7D") start.setDate(start.getDate() - 7);
  else if (period === "30D") start.setDate(start.getDate() - 30);
  else if (period === "90D") start.setDate(start.getDate() - 90);
  else if (period === "YTD") start.setMonth(0, 1);
  return start;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && inQuotes && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvRows(csvText: string): Record<string, string>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) row[h] = values[idx] ?? "";
    });
    return row;
  });
}

// ==========================================
// 1. LEADS
// ==========================================
export async function listLeads(auth: AuthContext, query: LeadsQuery) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveCrmScope(auth, false);
  const requestedOwner = query.ownerUserId ?? query.owner_user_id;

  const conditions = [
    eq(crmLeads.tenantId, tenantId),
    ...applyOwnerFilterCondition(scopeCtx, auth, requestedOwner, crmLeads.ownerUserId, crmLeads.createdBy),
  ];

  if (query.stage) conditions.push(eq(crmLeads.stage, query.stage));
  if (query.priority) conditions.push(eq(crmLeads.priority, query.priority));
  if (query.source) conditions.push(ilike(crmLeads.source, `%${query.source}%`));
  if (query.search) {
    const p = `%${query.search}%`;
    conditions.push(or(ilike(crmLeads.name, p), ilike(crmLeads.companyName, p), ilike(crmLeads.email, p))!);
  }

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(crmLeads).where(and(...conditions)),
    db
      .select({
        lead: crmLeads,
        ownerName: users.fullName,
      })
      .from(crmLeads)
      .leftJoin(users, eq(users.id, crmLeads.ownerUserId))
      .where(and(...conditions))
      .orderBy(desc(crmLeads.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    scope: scopeCtx.scope,
    leads: rows.map((r) => ({
      ...r.lead,
      estimatedValue: Number(r.lead.estimatedValue),
      currency: r.lead.currency.trim(),
      ownerName: r.ownerName ?? null,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createLead(
  auth: AuthContext,
  input: CreateLeadInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveCrmScope(auth, false);
  const companyName = input.companyName ?? input.company_name ?? null;
  const estimatedValue = input.estimatedValue ?? input.estimated_value ?? 0;
  const ownerId = input.ownerUserId ?? input.owner_user_id ?? auth.userId;
  const nextFollowupRaw = input.nextFollowupAt ?? input.next_followup_at;

  if (input.ownerUserId || input.owner_user_id) {
    await assertValidAssignee(auth, scopeCtx, ownerId);
  }

  const [tenant] = await db
    .select({ defaultCurrency: tenants.defaultCurrency })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(crmLeads)
      .values({
        tenantId,
        name: input.name,
        companyName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        source: input.source ?? null,
        stage: input.stage,
        priority: input.priority,
        estimatedValue: estimatedValue.toFixed(2),
        currency: tenant?.defaultCurrency.trim() ?? "INR",
        ownerUserId: ownerId,
        nextFollowupAt: nextFollowupRaw ? new Date(nextFollowupRaw) : null,
        notes: input.notes ?? null,
        createdBy: auth.userId,
      })
      .returning();

    if (ownerId !== auth.userId) {
      await tx.insert(notifications).values({
        tenantId,
        userId: ownerId,
        category: "SALES",
        title: "New Lead Assigned",
        message: `${auth.fullName || "Sales Manager"} assigned lead "${rows[0].name}"${companyName ? ` (${companyName})` : ""} to you.`,
        entityType: "CRM_LEAD",
        entityId: rows[0].id,
        actionUrl: `/crm/leads/${rows[0].id}`,
      });
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "CRM.LEAD.CREATE",
      entityType: "crm_lead",
      entityId: rows[0].id,
      afterData: { name: rows[0].name, stage: rows[0].stage, ownerUserId: ownerId },
      requestId,
    });

    return rows;
  });

  return {
    lead: {
      ...created,
      estimatedValue: Number(created.estimatedValue),
      currency: created.currency.trim(),
    },
  };
}

export async function getLeadDetail(auth: AuthContext, leadId: string) {
  const { lead } = await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;

  const [activities, followups, attachments] = await Promise.all([
    db
      .select({
        activity: crmLeadActivities,
        actorName: users.fullName,
      })
      .from(crmLeadActivities)
      .leftJoin(users, eq(users.id, crmLeadActivities.actorUserId))
      .where(and(eq(crmLeadActivities.leadId, leadId), eq(crmLeadActivities.tenantId, tenantId)))
      .orderBy(desc(crmLeadActivities.createdAt)),
    db
      .select({
        followup: crmLeadFollowups,
        assigneeName: users.fullName,
      })
      .from(crmLeadFollowups)
      .leftJoin(users, eq(users.id, crmLeadFollowups.assignedToUserId))
      .where(and(eq(crmLeadFollowups.leadId, leadId), eq(crmLeadFollowups.tenantId, tenantId)))
      .orderBy(desc(crmLeadFollowups.scheduledAt)),
    db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        mimeType: documents.mimeType,
        fileSize: documents.fileSize,
        category: documents.category,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, tenantId),
          eq(documents.entityId, leadId),
          inArray(documents.entityType, ["LEAD", "CRM_LEAD"]),
          isNull(documents.deletedAt),
        ),
      )
      .orderBy(desc(documents.createdAt)),
  ]);

  return {
    lead: {
      ...lead,
      estimatedValue: Number(lead.estimatedValue),
      currency: lead.currency.trim(),
    },
    activities: activities.map((a) => ({
      ...a.activity,
      actorName: a.actorName ?? null,
    })),
    followups: followups.map((f) => ({
      ...f.followup,
      assigneeName: f.assigneeName ?? null,
    })),
    attachments,
  };
}

export async function updateLead(
  auth: AuthContext,
  leadId: string,
  input: UpdateLeadInput,
  requestId?: string,
) {
  const { lead: existing, scopeCtx } = await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;

  const nextOwnerId = input.ownerUserId ?? input.owner_user_id;
  if (nextOwnerId) {
    await assertValidAssignee(auth, scopeCtx, nextOwnerId);
  }

  const companyName = input.companyName ?? input.company_name;
  const estimatedValue = input.estimatedValue ?? input.estimated_value;
  const nextFollowupRaw = input.nextFollowupAt ?? input.next_followup_at;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(crmLeads)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(companyName !== undefined && { companyName }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.source !== undefined && { source: input.source }),
        ...(input.stage !== undefined && { stage: input.stage }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(estimatedValue !== undefined && { estimatedValue: estimatedValue.toFixed(2) }),
        ...(nextOwnerId !== undefined && { ownerUserId: nextOwnerId }),
        ...(nextFollowupRaw !== undefined && {
          nextFollowupAt: nextFollowupRaw ? new Date(nextFollowupRaw) : null,
        }),
        ...(input.notes !== undefined && { notes: input.notes }),
        updatedAt: new Date(),
      })
      .where(and(eq(crmLeads.id, leadId), eq(crmLeads.tenantId, tenantId)))
      .returning();

    if (input.stage && input.stage !== existing.stage) {
      await tx.insert(crmLeadActivities).values({
        tenantId,
        leadId,
        actorUserId: auth.userId,
        activityType: "STAGE_CHANGE",
        summary: `Stage changed from ${existing.stage} to ${input.stage}`,
      });
    }

    if (nextOwnerId && nextOwnerId !== existing.ownerUserId && nextOwnerId !== auth.userId) {
      await tx.insert(notifications).values({
        tenantId,
        userId: nextOwnerId,
        category: "SALES",
        title: "Lead Reassigned to You",
        message: `${auth.fullName || "Sales Manager"} assigned lead "${row.name}" to you.`,
        entityType: "CRM_LEAD",
        entityId: leadId,
        actionUrl: `/crm/leads/${leadId}`,
      });
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "CRM.LEAD.UPDATE",
      entityType: "crm_lead",
      entityId: leadId,
      beforeData: { stage: existing.stage, priority: existing.priority, ownerUserId: existing.ownerUserId },
      afterData: { stage: row.stage, priority: row.priority, ownerUserId: row.ownerUserId },
      requestId,
    });

    return row;
  });

  return {
    lead: {
      ...updated,
      estimatedValue: Number(updated.estimatedValue),
      currency: updated.currency.trim(),
    },
  };
}

export async function assignLead(
  auth: AuthContext,
  leadId: string,
  input: AssignLeadInput,
  requestId?: string,
) {
  const { lead: existing, scopeCtx } = await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;
  const targetOwnerId = (input.ownerUserId ?? input.owner_user_id)!;
  const assignee = await assertValidAssignee(auth, scopeCtx, targetOwnerId);

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(crmLeads)
      .set({ ownerUserId: targetOwnerId, updatedAt: new Date() })
      .where(and(eq(crmLeads.id, leadId), eq(crmLeads.tenantId, tenantId)))
      .returning();

    await tx.insert(crmLeadActivities).values({
      tenantId,
      leadId,
      actorUserId: auth.userId,
      activityType: "ASSIGNMENT",
      summary: `Lead assigned to ${assignee.fullName} (${targetOwnerId})${input.note ? `: ${input.note}` : ""}`,
    });

    if (targetOwnerId !== auth.userId) {
      await tx.insert(notifications).values({
        tenantId,
        userId: targetOwnerId,
        category: "SALES",
        title: "Lead Assigned to You",
        message: `${auth.fullName || "Sales Manager"} assigned lead "${existing.name}" to you.${input.note ? ` Note: ${input.note}` : ""}`,
        entityType: "CRM_LEAD",
        entityId: leadId,
        actionUrl: `/crm/leads/${leadId}`,
      });
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "CRM.LEAD.ASSIGN",
      entityType: "crm_lead",
      entityId: leadId,
      beforeData: { ownerUserId: existing.ownerUserId },
      afterData: { ownerUserId: targetOwnerId, assigneeName: assignee.fullName },
      requestId,
    });

    return rows;
  });

  return {
    lead: {
      ...updated,
      estimatedValue: Number(updated.estimatedValue),
      currency: updated.currency.trim(),
    },
    assignedTo: { id: targetOwnerId, fullName: assignee.fullName },
  };
}

export async function addLeadActivity(
  auth: AuthContext,
  leadId: string,
  input: CreateLeadActivityInput,
) {
  await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;
  const activityType = input.activityType ?? input.activity_type ?? "NOTE";
  const summary = (input.summary ?? input.subject)!;
  const occurredAt = input.occurredAt ?? input.occurred_at;
  const mergedDetails =
    input.details || input.body || occurredAt
      ? {
          ...(input.details ?? {}),
          ...(input.body ? { body: input.body } : {}),
          ...(occurredAt ? { occurredAt } : {}),
        }
      : null;

  const [activity] = await db
    .insert(crmLeadActivities)
    .values({
      tenantId,
      leadId,
      actorUserId: auth.userId,
      activityType,
      summary,
      details: mergedDetails,
    })
    .returning();

  return { activity };
}

export async function addLeadFollowup(
  auth: AuthContext,
  leadId: string,
  input: CreateLeadFollowupInput,
) {
  const { lead, scopeCtx } = await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;
  const scheduledRaw = (input.scheduledAt ?? input.next_followup_at)!;
  const assignedTo =
    input.assignedToUserId ?? input.assignee_user_id ?? lead.ownerUserId ?? auth.userId;

  if (input.assignedToUserId || input.assignee_user_id) {
    await assertValidAssignee(auth, scopeCtx, assignedTo);
  }

  const scheduledDate = new Date(scheduledRaw);

  const [followup] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(crmLeadFollowups)
      .values({
        tenantId,
        leadId,
        assignedToUserId: assignedTo,
        scheduledAt: scheduledDate,
        status: "PENDING",
        notes: input.notes ?? null,
        createdBy: auth.userId,
      })
      .returning();

    await tx
      .update(crmLeads)
      .set({ nextFollowupAt: scheduledDate, updatedAt: new Date() })
      .where(and(eq(crmLeads.id, leadId), eq(crmLeads.tenantId, tenantId)));

    if (assignedTo !== auth.userId) {
      await tx.insert(notifications).values({
        tenantId,
        userId: assignedTo,
        category: "SALES",
        title: "Follow-up Scheduled",
        message: `Follow-up scheduled for lead "${lead.name}" on ${scheduledDate.toISOString().slice(0, 10)}.`,
        entityType: "CRM_LEAD",
        entityId: leadId,
        actionUrl: `/crm/leads/${leadId}`,
      });
    }

    return rows;
  });

  return { followup };
}

export async function updateFollowup(
  auth: AuthContext,
  followupId: string,
  input: UpdateFollowupInput,
) {
  const tenantId = auth.tenantId!;
  const [existing] = await db
    .select()
    .from(crmLeadFollowups)
    .where(and(eq(crmLeadFollowups.id, followupId), eq(crmLeadFollowups.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw Errors.notFound("Followup not found.");
  }

  await assertLeadAccess(auth, existing.leadId);
  const nextScheduledRaw = input.scheduledAt ?? input.rescheduled_at;

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(crmLeadFollowups)
      .set({
        ...(input.status !== undefined && {
          status: input.status,
          completedAt: input.status === "COMPLETED" ? new Date() : existing.completedAt,
        }),
        ...(nextScheduledRaw !== undefined && { scheduledAt: new Date(nextScheduledRaw) }),
        ...(input.notes !== undefined && { notes: input.notes }),
        updatedAt: new Date(),
      })
      .where(and(eq(crmLeadFollowups.id, followupId), eq(crmLeadFollowups.tenantId, tenantId)))
      .returning();

    if (nextScheduledRaw) {
      await tx
        .update(crmLeads)
        .set({ nextFollowupAt: new Date(nextScheduledRaw), updatedAt: new Date() })
        .where(and(eq(crmLeads.id, existing.leadId), eq(crmLeads.tenantId, tenantId)));
    }

    return rows;
  });

  return { followup: updated };
}

export async function convertLeadToCustomer(
  auth: AuthContext,
  leadId: string,
  input: ConvertLeadInput,
  requestId?: string,
) {
  const { lead } = await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;

  if (lead.convertedCustomerId) {
    throw Errors.conflict("Lead has already been converted to a customer.");
  }

  const generatedCode =
    input.customerCode || input.customer_code || `CUST-${String(Date.now()).slice(-6)}`;
  const customerType = input.customerType ?? input.customer_type ?? "B2B";
  const taxId = input.taxId ?? input.tax_id ?? null;
  const paymentTermsDays = input.paymentTermsDays ?? input.payment_terms_days ?? 30;
  const creditLimit = input.creditLimit ?? input.credit_limit ?? 0;

  const result = await db.transaction(async (tx) => {
    // Re-check inside transaction to guarantee atomic conversion safety
    const [freshLead] = await tx
      .select()
      .from(crmLeads)
      .where(and(eq(crmLeads.id, leadId), eq(crmLeads.tenantId, tenantId)))
      .limit(1);

    if (!freshLead) throw Errors.notFound("Lead not found.");
    if (freshLead.convertedCustomerId) {
      throw Errors.conflict("Lead has already been converted to a customer.");
    }

    const [customer] = await tx
      .insert(crmCustomers)
      .values({
        tenantId,
        customerCode: generatedCode,
        name: freshLead.companyName || freshLead.name,
        customerType,
        email: freshLead.email ?? null,
        phone: freshLead.phone ?? null,
        taxId,
        paymentTermsDays,
        creditLimit: creditLimit.toFixed(2),
        currency: freshLead.currency.trim(),
        ownerUserId: freshLead.ownerUserId ?? auth.userId,
        createdBy: auth.userId,
      })
      .returning();

    const now = new Date();
    const [updatedLead] = await tx
      .update(crmLeads)
      .set({
        stage: "WON",
        convertedCustomerId: customer.id,
        convertedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(crmLeads.id, leadId),
          eq(crmLeads.tenantId, tenantId),
          isNull(crmLeads.convertedCustomerId),
        ),
      )
      .returning();

    if (!updatedLead) {
      throw Errors.conflict("Lead was concurrently converted to a customer.");
    }

    // Preserve complete history: append conversion milestone activity alongside prior notes/activities
    await tx.insert(crmLeadActivities).values({
      tenantId,
      leadId,
      actorUserId: auth.userId,
      activityType: "STAGE_CHANGE",
      summary: `Lead converted to Customer ${customer.name} (${customer.customerCode})`,
      details: { customerId: customer.id, customerCode: customer.customerCode },
    });

    const [{ count: activitiesCount }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(crmLeadActivities)
      .where(and(eq(crmLeadActivities.leadId, leadId), eq(crmLeadActivities.tenantId, tenantId)));

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "CRM.LEAD.CONVERT",
      entityType: "crm_lead",
      entityId: leadId,
      afterData: {
        customerId: customer.id,
        customerCode: customer.customerCode,
        preservedActivitiesCount: activitiesCount ?? 0,
      },
      requestId,
    });

    return { customer, lead: updatedLead, preservedActivitiesCount: activitiesCount ?? 0 };
  });

  return {
    customer: {
      ...result.customer,
      creditLimit: Number(result.customer.creditLimit),
      currency: result.customer.currency.trim(),
    },
    lead: {
      ...result.lead,
      estimatedValue: Number(result.lead.estimatedValue),
      currency: result.lead.currency.trim(),
    },
    preservedHistory: {
      activitiesCount: result.preservedActivitiesCount,
      notesPreserved: Boolean(result.lead.notes),
    },
    message: "Lead converted to customer successfully with full activity history preserved.",
  };
}

export async function getCrmPipeline(auth: AuthContext, query: PipelineQuery) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveCrmScope(auth, false);
  const requestedOwner = query.ownerUserId ?? query.owner_user_id;
  const startDate = resolvePipelineStartDate(query.period);

  const conditions = [
    eq(crmLeads.tenantId, tenantId),
    ...applyOwnerFilterCondition(scopeCtx, auth, requestedOwner, crmLeads.ownerUserId, crmLeads.createdBy),
  ];

  if (startDate) {
    conditions.push(gte(crmLeads.createdAt, startDate));
    conditions.push(lte(crmLeads.createdAt, new Date()));
  }

  const rows = await db
    .select({
      lead: crmLeads,
      ownerName: users.fullName,
    })
    .from(crmLeads)
    .leftJoin(users, eq(users.id, crmLeads.ownerUserId))
    .where(and(...conditions))
    .orderBy(desc(crmLeads.updatedAt));

  const nowMs = Date.now();
  const stageMap = new Map<
    string,
    {
      count: number;
      totalValue: number;
      deals: Array<{
        id: string;
        name: string;
        companyName: string | null;
        estimatedValue: number;
        currency: string;
        priority: string;
        source: string | null;
        ownerUserId: string | null;
        ownerName: string | null;
        nextFollowupAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        agingDays: number;
      }>;
    }
  >();

  for (const stage of LEAD_STAGES) {
    stageMap.set(stage, { count: 0, totalValue: 0, deals: [] });
  }

  for (const r of rows) {
    const bucket = stageMap.get(r.lead.stage) ?? { count: 0, totalValue: 0, deals: [] };
    const val = Number(r.lead.estimatedValue);
    const agingDays = Math.max(0, Math.floor((nowMs - r.lead.updatedAt.getTime()) / 86_400_000));
    bucket.count += 1;
    bucket.totalValue = Number((bucket.totalValue + val).toFixed(2));
    bucket.deals.push({
      id: r.lead.id,
      name: r.lead.name,
      companyName: r.lead.companyName,
      estimatedValue: val,
      currency: r.lead.currency.trim(),
      priority: r.lead.priority,
      source: r.lead.source,
      ownerUserId: r.lead.ownerUserId,
      ownerName: r.ownerName ?? null,
      nextFollowupAt: r.lead.nextFollowupAt,
      createdAt: r.lead.createdAt,
      updatedAt: r.lead.updatedAt,
      agingDays,
    });
    stageMap.set(r.lead.stage, bucket);
  }

  return {
    scope: scopeCtx.scope,
    appliedFilters: {
      period: query.period,
      ownerUserId: requestedOwner ?? null,
    },
    pipeline: LEAD_STAGES.map((stage) => {
      const bucket = stageMap.get(stage)!;
      return {
        stage,
        count: bucket.count,
        totalValue: bucket.totalValue,
        deals: bucket.deals,
      };
    }),
  };
}

export async function importLeads(
  auth: AuthContext,
  input: ImportLeadsInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveCrmScope(auth, false);

  const rawRows: Record<string, unknown>[] = input.csvText
    ? parseCsvRows(input.csvText)
    : (input.rows ?? []);

  if (rawRows.length === 0) {
    throw Errors.badRequest("Import data me kam se kam 1 valid row honi chahiye.");
  }

  const defaultOwnerId = input.defaultOwnerUserId ?? auth.userId;
  if (input.defaultOwnerUserId) {
    await assertValidAssignee(auth, scopeCtx, defaultOwnerId);
  }

  const [tenant, existingLeads] = await Promise.all([
    db.select({ defaultCurrency: tenants.defaultCurrency }).from(tenants).where(eq(tenants.id, tenantId)).limit(1),
    db.select({ email: crmLeads.email, phone: crmLeads.phone }).from(crmLeads).where(eq(crmLeads.tenantId, tenantId)),
  ]);
  const currency = tenant[0]?.defaultCurrency.trim() ?? "INR";

  const seenEmails = new Set(
    existingLeads.map((l) => l.email?.trim().toLowerCase()).filter(Boolean) as string[],
  );
  const seenPhones = new Set(
    existingLeads.map((l) => l.phone?.trim()).filter(Boolean) as string[],
  );

  const mapping = input.mapping ?? {};
  const validToInsert: Array<typeof crmLeads.$inferInsert> = [];
  const duplicates: Array<{ rowNumber: number; name?: string; reason: string }> = [];
  const errors: Array<{ rowNumber: number; reason: string }> = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 1;
    const pick = (field: string, ...aliases: string[]) => {
      const mappedCol = mapping[field];
      if (mappedCol && raw[mappedCol] !== undefined) return raw[mappedCol];
      if (raw[field] !== undefined) return raw[field];
      for (const a of aliases) {
        if (raw[a] !== undefined) return raw[a];
      }
      return undefined;
    };

    const name = String(pick("name", "lead_name", "full_name") ?? "").trim();
    if (name.length < 2) {
      errors.push({ rowNumber: rowNum, reason: "Lead name missing or shorter than 2 characters." });
      continue;
    }

    const emailRaw = pick("email", "Email");
    const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;
    const phoneRaw = pick("phone", "mobile", "Phone");
    const phone = phoneRaw ? String(phoneRaw).trim() : null;

    if (email && seenEmails.has(email)) {
      duplicates.push({ rowNumber: rowNum, name, reason: `Duplicate email: ${email}` });
      continue;
    }
    if (phone && seenPhones.has(phone)) {
      duplicates.push({ rowNumber: rowNum, name, reason: `Duplicate phone: ${phone}` });
      continue;
    }

    const stageCandidate = String(pick("stage") ?? "NEW").toUpperCase();
    const stage = (LEAD_STAGES as readonly string[]).includes(stageCandidate)
      ? (stageCandidate as (typeof LEAD_STAGES)[number])
      : "NEW";

    const priorityCandidate = String(pick("priority") ?? "MEDIUM").toUpperCase();
    const priority = (PRIORITIES as readonly string[]).includes(priorityCandidate)
      ? (priorityCandidate as (typeof PRIORITIES)[number])
      : "MEDIUM";

    const estimatedNum = Number(pick("estimatedValue", "estimated_value") ?? 0);
    const estimatedValue = Number.isFinite(estimatedNum) && estimatedNum >= 0 ? estimatedNum.toFixed(2) : "0.00";

    const rowOwnerRaw = pick("ownerUserId", "owner_user_id");
    let rowOwnerId = defaultOwnerId;
    if (rowOwnerRaw && typeof rowOwnerRaw === "string" && rowOwnerRaw.trim().length > 0) {
      rowOwnerId = rowOwnerRaw.trim();
      try {
        await assertValidAssignee(auth, scopeCtx, rowOwnerId);
      } catch (err) {
        errors.push({ rowNumber: rowNum, reason: (err as Error).message });
        continue;
      }
    }

    if (email) seenEmails.add(email);
    if (phone) seenPhones.add(phone);

    validToInsert.push({
      tenantId,
      name,
      companyName: pick("companyName", "company_name") ? String(pick("companyName", "company_name")).trim() : null,
      email,
      phone,
      source: pick("source") ? String(pick("source")).trim() : "CSV_IMPORT",
      stage,
      priority,
      estimatedValue,
      currency,
      ownerUserId: rowOwnerId,
      notes: pick("notes") ? String(pick("notes")).trim() : null,
      createdBy: auth.userId,
    });
  }

  const inserted =
    validToInsert.length > 0
      ? await db.transaction(async (tx) => {
          const rows = await tx.insert(crmLeads).values(validToInsert).returning();
          await writeAudit(tx, {
            tenantId,
            actorUserId: auth.userId,
            action: "CRM.LEAD.IMPORT",
            entityType: "crm_lead",
            afterData: {
              importedCount: rows.length,
              duplicateCount: duplicates.length,
              errorCount: errors.length,
            },
            requestId,
          });
          return rows;
        })
      : [];

  return {
    importedCount: inserted.length,
    duplicateCount: duplicates.length,
    errorCount: errors.length,
    duplicates,
    errors,
    createdLeadIds: inserted.map((l) => l.id),
  };
}

// ==========================================
// 2. CUSTOMERS
// ==========================================
export async function listCustomers(auth: AuthContext, query: CustomersQuery) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveCrmScope(auth, true);
  const customerType = query.customerType ?? query.customer_type;

  const conditions = [
    eq(crmCustomers.tenantId, tenantId),
    ...applyOwnerFilterCondition(
      scopeCtx,
      auth,
      undefined,
      crmCustomers.ownerUserId,
      crmCustomers.createdBy,
    ),
  ];

  if (customerType) conditions.push(eq(crmCustomers.customerType, customerType));
  if (query.status) conditions.push(eq(crmCustomers.status, query.status));
  if (query.search) {
    const p = `%${query.search}%`;
    conditions.push(
      or(ilike(crmCustomers.name, p), ilike(crmCustomers.customerCode, p), ilike(crmCustomers.email, p))!,
    );
  }

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(crmCustomers).where(and(...conditions)),
    db
      .select({
        customer: crmCustomers,
        ownerName: users.fullName,
      })
      .from(crmCustomers)
      .leftJoin(users, eq(users.id, crmCustomers.ownerUserId))
      .where(and(...conditions))
      .orderBy(desc(crmCustomers.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    scope: scopeCtx.scope,
    customers: rows.map((r) => ({
      ...r.customer,
      creditLimit: Number(r.customer.creditLimit),
      currency: r.customer.currency.trim(),
      ownerName: r.ownerName ?? null,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createCustomer(
  auth: AuthContext,
  input: CreateCustomerInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const customerCode =
    input.customerCode || input.customer_code || `CUST-${String(Date.now()).slice(-6)}`;
  const customerType = input.customerType ?? input.customer_type ?? "B2B";
  const taxId = input.taxId ?? input.tax_id ?? null;
  const paymentTermsDays = input.paymentTermsDays ?? input.payment_terms_days ?? 30;
  const creditLimit = input.creditLimit ?? input.credit_limit ?? 0;
  const billingAddress = input.billingAddress ?? input.billing_address ?? null;

  const [dup] = await db
    .select({ id: crmCustomers.id })
    .from(crmCustomers)
    .where(and(eq(crmCustomers.tenantId, tenantId), eq(crmCustomers.customerCode, customerCode)))
    .limit(1);

  if (dup) {
    throw Errors.conflict(`Customer code '${customerCode}' already exists.`);
  }

  const [tenant] = await db
    .select({ defaultCurrency: tenants.defaultCurrency })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(crmCustomers)
      .values({
        tenantId,
        customerCode,
        name: input.name,
        customerType,
        email: input.email ?? null,
        phone: input.phone ?? null,
        taxId,
        paymentTermsDays,
        creditLimit: creditLimit.toFixed(2),
        currency: tenant?.defaultCurrency.trim() ?? "INR",
        billingAddress,
        ownerUserId: auth.userId,
        createdBy: auth.userId,
      })
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "CRM.CUSTOMER.CREATE",
      entityType: "crm_customer",
      entityId: rows[0].id,
      afterData: { customerCode, name: input.name },
      requestId,
    });

    return rows;
  });

  return {
    customer: {
      ...created,
      creditLimit: Number(created.creditLimit),
      currency: created.currency.trim(),
    },
  };
}

export async function getCustomerDetail(auth: AuthContext, customerId: string) {
  const tenantId = auth.tenantId!;
  const [customer] = await db
    .select()
    .from(crmCustomers)
    .where(and(eq(crmCustomers.id, customerId), eq(crmCustomers.tenantId, tenantId)))
    .limit(1);

  if (!customer) {
    throw Errors.notFound("Customer not found.");
  }

  const scopeCtx = await resolveCrmScope(auth, true);
  assertRecordInScope(scopeCtx, customer.ownerUserId, customer.createdBy, auth.userId, "customer");

  const [linkedLeads, quotations, orders, invoices] = await Promise.all([
    db
      .select()
      .from(crmLeads)
      .where(and(eq(crmLeads.tenantId, tenantId), eq(crmLeads.convertedCustomerId, customerId)))
      .orderBy(desc(crmLeads.createdAt)),
    db
      .select()
      .from(salesQuotations)
      .where(and(eq(salesQuotations.tenantId, tenantId), eq(salesQuotations.customerId, customerId)))
      .orderBy(desc(salesQuotations.createdAt))
      .limit(25),
    db
      .select()
      .from(salesOrders)
      .where(and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.customerId, customerId)))
      .orderBy(desc(salesOrders.createdAt))
      .limit(25),
    db
      .select()
      .from(salesInvoices)
      .where(and(eq(salesInvoices.tenantId, tenantId), eq(salesInvoices.customerId, customerId)))
      .orderBy(desc(salesInvoices.createdAt))
      .limit(25),
  ]);

  const leadIds = linkedLeads.map((l) => l.id);
  const leadActivities =
    leadIds.length > 0
      ? await db
          .select({
            activity: crmLeadActivities,
            actorName: users.fullName,
          })
          .from(crmLeadActivities)
          .leftJoin(users, eq(users.id, crmLeadActivities.actorUserId))
          .where(
            and(
              eq(crmLeadActivities.tenantId, tenantId),
              inArray(crmLeadActivities.leadId, leadIds),
            ),
          )
          .orderBy(desc(crmLeadActivities.createdAt))
          .limit(50)
      : [];

  const contacts = [
    ...(customer.email || customer.phone
      ? [{ name: customer.name, email: customer.email, phone: customer.phone, isPrimary: true }]
      : []),
    ...linkedLeads
      .filter((l) => l.email !== customer.email || l.phone !== customer.phone || l.name !== customer.name)
      .map((l) => ({ name: l.name, email: l.email, phone: l.phone, isPrimary: false })),
  ];

  const addresses = customer.billingAddress ? [{ type: "BILLING", ...customer.billingAddress }] : [];

  return {
    scope: scopeCtx.scope,
    customer: {
      ...customer,
      creditLimit: Number(customer.creditLimit),
      currency: customer.currency.trim(),
    },
    contacts,
    addresses,
    timeline: {
      leads: linkedLeads.map((l) => ({
        ...l,
        estimatedValue: Number(l.estimatedValue),
        currency: l.currency.trim(),
      })),
      activities: leadActivities.map((a) => ({
        ...a.activity,
        actorName: a.actorName ?? null,
      })),
      quotations: quotations.map((q) => ({
        ...q,
        grandTotal: Number(q.grandTotal),
        currency: q.currency.trim(),
      })),
      orders: orders.map((o) => ({
        ...o,
        grandTotal: Number(o.grandTotal),
        currency: o.currency.trim(),
      })),
      invoices: invoices.map((inv) => ({
        ...inv,
        grandTotal: Number(inv.grandTotal),
        balanceDue: Number(inv.balanceDue),
        currency: inv.currency.trim(),
      })),
    },
  };
}
