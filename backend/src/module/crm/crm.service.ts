// CRM Service: Leads, Activities, Followups, Lead Conversion, Pipeline, Customers with Record Scope.
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  crmCustomers,
  crmLeadActivities,
  crmLeadFollowups,
  crmLeads,
  LEAD_STAGES,
  tenantMemberships,
  tenants,
  users,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { hasTenantWideScope, type AuthContext } from "../../middlewares/guards";
import type {
  AssignLeadInput,
  ConvertLeadInput,
  CreateCustomerInput,
  CreateLeadActivityInput,
  CreateLeadFollowupInput,
  CreateLeadInput,
  CustomersQuery,
  LeadsQuery,
  UpdateFollowupInput,
  UpdateLeadInput,
} from "./crm.model";

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

  const isCompanyWide = hasTenantWideScope(auth, "CRM.LEADS.VIEW_ALL");
  if (!isCompanyWide && lead.ownerUserId !== auth.userId && lead.createdBy !== auth.userId) {
    throw Errors.forbidden("You do not have access to this lead record.");
  }

  return lead;
}

async function assertTenantMember(tenantId: string, userId: string) {
  const [m] = await db
    .select({ id: tenantMemberships.id })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
    .limit(1);
  if (!m) {
    throw Errors.badRequest("Assigned user does not belong to this company.");
  }
}

// ==========================================
// 1. LEADS
// ==========================================
export async function listLeads(auth: AuthContext, query: LeadsQuery) {
  const tenantId = auth.tenantId!;
  const isCompanyWide = hasTenantWideScope(auth, "CRM.LEADS.VIEW_ALL");

  const conditions = [eq(crmLeads.tenantId, tenantId)];

  // Record Scope enforcement: non-owner executives see only their own assigned leads
  if (!isCompanyWide) {
    conditions.push(or(eq(crmLeads.ownerUserId, auth.userId), eq(crmLeads.createdBy, auth.userId))!);
  } else if (query.ownerUserId) {
    conditions.push(eq(crmLeads.ownerUserId, query.ownerUserId));
  }

  if (query.stage) conditions.push(eq(crmLeads.stage, query.stage));
  if (query.priority) conditions.push(eq(crmLeads.priority, query.priority));
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
    scope: isCompanyWide ? "COMPANY_WIDE" : "ASSIGNED_ONLY",
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
  const ownerId = input.ownerUserId ?? auth.userId;
  if (input.ownerUserId) {
    await assertTenantMember(tenantId, input.ownerUserId);
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
        companyName: input.companyName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        source: input.source ?? null,
        stage: input.stage,
        priority: input.priority,
        estimatedValue: input.estimatedValue.toFixed(2),
        currency: tenant?.defaultCurrency.trim() ?? "INR",
        ownerUserId: ownerId,
        nextFollowupAt: input.nextFollowupAt ? new Date(input.nextFollowupAt) : null,
        notes: input.notes ?? null,
        createdBy: auth.userId,
      })
      .returning();

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
  const lead = await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;

  const [activities, followups] = await Promise.all([
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
      .select()
      .from(crmLeadFollowups)
      .where(and(eq(crmLeadFollowups.leadId, leadId), eq(crmLeadFollowups.tenantId, tenantId)))
      .orderBy(desc(crmLeadFollowups.scheduledAt)),
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
    followups,
  };
}

export async function updateLead(
  auth: AuthContext,
  leadId: string,
  input: UpdateLeadInput,
  requestId?: string,
) {
  const existing = await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;

  if (input.ownerUserId) {
    await assertTenantMember(tenantId, input.ownerUserId);
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(crmLeads)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.companyName !== undefined && { companyName: input.companyName }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.source !== undefined && { source: input.source }),
        ...(input.stage !== undefined && { stage: input.stage }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.estimatedValue !== undefined && { estimatedValue: input.estimatedValue.toFixed(2) }),
        ...(input.ownerUserId !== undefined && { ownerUserId: input.ownerUserId }),
        ...(input.nextFollowupAt !== undefined && {
          nextFollowupAt: input.nextFollowupAt ? new Date(input.nextFollowupAt) : null,
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

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "CRM.LEAD.UPDATE",
      entityType: "crm_lead",
      entityId: leadId,
      beforeData: { stage: existing.stage, priority: existing.priority },
      afterData: { stage: row.stage, priority: row.priority },
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
  const existing = await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;
  await assertTenantMember(tenantId, input.ownerUserId);

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(crmLeads)
      .set({ ownerUserId: input.ownerUserId, updatedAt: new Date() })
      .where(and(eq(crmLeads.id, leadId), eq(crmLeads.tenantId, tenantId)))
      .returning();

    await tx.insert(crmLeadActivities).values({
      tenantId,
      leadId,
      actorUserId: auth.userId,
      activityType: "ASSIGNMENT",
      summary: `Lead assigned to user ${input.ownerUserId}${input.note ? `: ${input.note}` : ""}`,
    });

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "CRM.LEAD.ASSIGN",
      entityType: "crm_lead",
      entityId: leadId,
      beforeData: { ownerUserId: existing.ownerUserId },
      afterData: { ownerUserId: input.ownerUserId },
      requestId,
    });

    return rows;
  });

  return { lead: updated };
}

export async function addLeadActivity(
  auth: AuthContext,
  leadId: string,
  input: CreateLeadActivityInput,
) {
  await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;

  const [activity] = await db
    .insert(crmLeadActivities)
    .values({
      tenantId,
      leadId,
      actorUserId: auth.userId,
      activityType: input.activityType,
      summary: input.summary,
      details: input.details ?? null,
    })
    .returning();

  return { activity };
}

export async function addLeadFollowup(
  auth: AuthContext,
  leadId: string,
  input: CreateLeadFollowupInput,
) {
  const lead = await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;
  const assignedTo = input.assignedToUserId ?? lead.ownerUserId ?? auth.userId;

  const scheduledDate = new Date(input.scheduledAt);

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

  const [updated] = await db
    .update(crmLeadFollowups)
    .set({
      ...(input.status !== undefined && {
        status: input.status,
        completedAt: input.status === "COMPLETED" ? new Date() : existing.completedAt,
      }),
      ...(input.scheduledAt !== undefined && { scheduledAt: new Date(input.scheduledAt) }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedAt: new Date(),
    })
    .where(and(eq(crmLeadFollowups.id, followupId), eq(crmLeadFollowups.tenantId, tenantId)))
    .returning();

  return { followup: updated };
}

export async function convertLeadToCustomer(
  auth: AuthContext,
  leadId: string,
  input: ConvertLeadInput,
  requestId?: string,
) {
  const lead = await assertLeadAccess(auth, leadId);
  const tenantId = auth.tenantId!;

  if (lead.convertedCustomerId) {
    throw Errors.conflict("Lead has already been converted to a customer.");
  }

  const generatedCode = input.customerCode || `CUST-${String(Date.now()).slice(-6)}`;

  const result = await db.transaction(async (tx) => {
    const [customer] = await tx
      .insert(crmCustomers)
      .values({
        tenantId,
        customerCode: generatedCode,
        name: lead.companyName || lead.name,
        customerType: input.customerType,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        taxId: input.taxId ?? null,
        paymentTermsDays: input.paymentTermsDays,
        creditLimit: input.creditLimit.toFixed(2),
        currency: lead.currency.trim(),
        ownerUserId: lead.ownerUserId ?? auth.userId,
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
      .where(and(eq(crmLeads.id, leadId), eq(crmLeads.tenantId, tenantId)))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "CRM.LEAD.CONVERT",
      entityType: "crm_lead",
      entityId: leadId,
      afterData: { customerId: customer.id, customerCode: customer.customerCode },
      requestId,
    });

    return { customer, lead: updatedLead };
  });

  return {
    customer: {
      ...result.customer,
      creditLimit: Number(result.customer.creditLimit),
      currency: result.customer.currency.trim(),
    },
    lead: result.lead,
    message: "Lead converted to customer successfully.",
  };
}

export async function getCrmPipeline(auth: AuthContext) {
  const tenantId = auth.tenantId!;
  const isCompanyWide = hasTenantWideScope(auth, "CRM.LEADS.VIEW_ALL");

  const conditions = [eq(crmLeads.tenantId, tenantId)];
  if (!isCompanyWide) {
    conditions.push(or(eq(crmLeads.ownerUserId, auth.userId), eq(crmLeads.createdBy, auth.userId))!);
  }

  const stageRows = await db
    .select({
      stage: crmLeads.stage,
      count: sql<number>`count(*)::int`,
      totalValue: sql<string>`coalesce(sum(${crmLeads.estimatedValue}), '0.00')`,
    })
    .from(crmLeads)
    .where(and(...conditions))
    .groupBy(crmLeads.stage);

  const byStageMap = new Map(stageRows.map((s) => [s.stage, s]));

  return {
    scope: isCompanyWide ? "COMPANY_WIDE" : "ASSIGNED_ONLY",
    pipeline: LEAD_STAGES.map((stage) => {
      const row = byStageMap.get(stage);
      return {
        stage,
        count: row?.count ?? 0,
        totalValue: Number(row?.totalValue ?? 0),
      };
    }),
  };
}

// ==========================================
// 2. CUSTOMERS
// ==========================================
export async function listCustomers(auth: AuthContext, query: CustomersQuery) {
  const tenantId = auth.tenantId!;
  const isCompanyWide = hasTenantWideScope(auth, "CRM.LEADS.VIEW_ALL");
  const conditions = [eq(crmCustomers.tenantId, tenantId)];

  if (!isCompanyWide) {
    conditions.push(or(eq(crmCustomers.ownerUserId, auth.userId), eq(crmCustomers.createdBy, auth.userId))!);
  }

  if (query.customerType) conditions.push(eq(crmCustomers.customerType, query.customerType));
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
      .select()
      .from(crmCustomers)
      .where(and(...conditions))
      .orderBy(desc(crmCustomers.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    customers: rows.map((c) => ({
      ...c,
      creditLimit: Number(c.creditLimit),
      currency: c.currency.trim(),
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
  const customerCode = input.customerCode || `CUST-${String(Date.now()).slice(-6)}`;

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
        customerType: input.customerType,
        email: input.email ?? null,
        phone: input.phone ?? null,
        taxId: input.taxId ?? null,
        paymentTermsDays: input.paymentTermsDays,
        creditLimit: input.creditLimit.toFixed(2),
        currency: tenant?.defaultCurrency.trim() ?? "INR",
        billingAddress: input.billingAddress ?? null,
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

  const isCompanyWide = hasTenantWideScope(auth, "CRM.LEADS.VIEW_ALL");
  if (!isCompanyWide && customer.ownerUserId !== auth.userId && customer.createdBy !== auth.userId) {
    throw Errors.forbidden("You do not have access to this customer record.");
  }

  return {
    customer: {
      ...customer,
      creditLimit: Number(customer.creditLimit),
      currency: customer.currency.trim(),
    },
  };
}
