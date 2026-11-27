// Dashboard & Reports Service: Overview KPIs, Module Analytics, Async Exports & Saved Widgets.
import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  approvalRequests,
  auditLogs,
  branches,
  crmCustomers,
  crmLeadFollowups,
  crmLeads,
  dashboardWidgets,
  departments,
  financeExpenses,
  LEAD_STAGES,
  reportExportJobs,
  salesInvoices,
  salesOrderItems,
  salesOrders,
  salesProducts,
  salesQuotations,
  subscriptionInvoices,
  tasks,
  teams,
  tenantEntitlements,
  tenantMemberships,
  tenants,
  usageMetrics,
  userInvitations,
  users,
  type DashboardWidgetConfig,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { resolveRecordScope, type AuthContext } from "../../middlewares/guards";
import type {
  AnalyticsQuery,
  DashboardSummaryQuery,
  ExportReportInput,
  SaveWidgetsInput,
} from "./dashboardReports.model";

function resolveDateRange(period: string, fromStr?: string, toStr?: string) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (period) {
    case "TODAY":
      start.setHours(0, 0, 0, 0);
      break;
    case "7D":
      start.setDate(now.getDate() - 7);
      break;
    case "90D":
      start.setDate(now.getDate() - 90);
      break;
    case "YTD":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "CUSTOM":
      if (fromStr) start = new Date(fromStr);
      if (toStr) end = new Date(toStr);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw Errors.badRequest("Invalid custom date range (from/to).");
      }
      break;
    case "30D":
    default:
      start.setDate(now.getDate() - 30);
      break;
  }

  return { start, end };
}

const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  { widgetId: "w-revenue", type: "REVENUE_KPI", title: "Revenue Overview", position: { x: 0, y: 0, w: 3, h: 2 }, isVisible: true },
  { widgetId: "w-pipeline", type: "SALES_PIPELINE", title: "Sales Pipeline", position: { x: 3, y: 0, w: 3, h: 2 }, isVisible: true },
  { widgetId: "w-invoices", type: "DUE_INVOICES", title: "Due Invoices", position: { x: 6, y: 0, w: 3, h: 2 }, isVisible: true },
  { widgetId: "w-tasks", type: "TASKS_SUMMARY", title: "Tasks Summary", position: { x: 9, y: 0, w: 3, h: 2 }, isVisible: true },
  { widgetId: "w-expenses", type: "EXPENSES_CHART", title: "Expenses Trend", position: { x: 0, y: 2, w: 6, h: 4 }, isVisible: true },
  { widgetId: "w-team", type: "TEAM_ACTIVITY", title: "Recent Activity", position: { x: 6, y: 2, w: 6, h: 4 }, isVisible: true },
];

// ==========================================
// 1. OVERVIEW KPIs (GET /dashboard/summary)
// ==========================================
export async function getDashboardSummary(auth: AuthContext, query: DashboardSummaryQuery) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveRecordScope(auth, "REPORTS.DASHBOARD.VIEW_ALL", "REPORTS.DASHBOARD.VIEW_TEAM");
  const range = resolveDateRange(query.period, query.from, query.to);
  const branchId = query.branch_id ?? query.branchId;
  const departmentId = query.department_id ?? query.departmentId;
  const ownerUserId = query.owner_user_id ?? query.ownerUserId;

  if (
    scopeCtx.scope === "TEAM_DEPARTMENT" &&
    departmentId &&
    !scopeCtx.departmentIds.includes(departmentId)
  ) {
    throw Errors.forbidden("You do not have permission to view another department's dashboard metrics.");
  }

  if (
    scopeCtx.scope === "TEAM_DEPARTMENT" &&
    ownerUserId &&
    !scopeCtx.teamUserIds.includes(ownerUserId)
  ) {
    throw Errors.forbidden("You do not have permission to view metrics for a user outside your team.");
  }
  if (scopeCtx.scope === "OWN_ONLY" && ownerUserId && ownerUserId !== auth.userId) {
    throw Errors.forbidden("You can only view your own dashboard metrics.");
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw Errors.notFound("Tenant workspace not found.");
  }

  const currency = tenant.defaultCurrency.trim();

  // Real organization & user breakdown (scoped cleanly!)
  const membershipConditions = [eq(tenantMemberships.tenantId, tenantId)];
  if (branchId) membershipConditions.push(eq(tenantMemberships.branchId, branchId));
  if (departmentId) membershipConditions.push(eq(tenantMemberships.departmentId, departmentId));
  if (query.status) {
    membershipConditions.push(eq(tenantMemberships.status, query.status as "ACTIVE" | "INACTIVE"));
  }
  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    const scopeParts = [inArray(tenantMemberships.userId, scopeCtx.teamUserIds)];
    if (scopeCtx.departmentIds.length > 0) {
      scopeParts.push(inArray(tenantMemberships.departmentId, scopeCtx.departmentIds));
    }
    membershipConditions.push(or(...scopeParts)!);
  } else if (scopeCtx.scope === "OWN_ONLY") {
    membershipConditions.push(eq(tenantMemberships.userId, auth.userId));
  }

  const taskConditions = [eq(tasks.tenantId, tenantId)];
  if (branchId) taskConditions.push(eq(tasks.branchId, branchId));
  if (departmentId) taskConditions.push(eq(tasks.departmentId, departmentId));
  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    const tParts = [
      inArray(tasks.assigneeUserId, scopeCtx.teamUserIds),
      inArray(tasks.createdBy, scopeCtx.teamUserIds),
    ];
    if (scopeCtx.departmentIds.length > 0) {
      tParts.push(inArray(tasks.departmentId, scopeCtx.departmentIds));
    }
    taskConditions.push(or(...tParts)!);
  } else if (scopeCtx.scope === "OWN_ONLY") {
    taskConditions.push(or(eq(tasks.assigneeUserId, auth.userId), eq(tasks.createdBy, auth.userId))!);
  }

  const expenseConditions = [
    eq(financeExpenses.tenantId, tenantId),
    gte(financeExpenses.createdAt, range.start),
    lte(financeExpenses.createdAt, range.end),
  ];
  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    const eParts = [inArray(financeExpenses.ownerUserId, scopeCtx.teamUserIds)];
    if (scopeCtx.departmentIds.length > 0) {
      eParts.push(inArray(financeExpenses.departmentId, scopeCtx.departmentIds));
    }
    expenseConditions.push(or(...eParts)!);
  } else if (scopeCtx.scope === "OWN_ONLY") {
    expenseConditions.push(eq(financeExpenses.ownerUserId, auth.userId));
  }

  const approvalConditions = [
    eq(approvalRequests.tenantId, tenantId),
    eq(approvalRequests.status, "PENDING"),
  ];
  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    const aParts = [
      eq(approvalRequests.approverUserId, auth.userId),
      inArray(approvalRequests.requestedBy, scopeCtx.teamUserIds),
    ];
    if (scopeCtx.departmentIds.length > 0) {
      aParts.push(inArray(approvalRequests.departmentId, scopeCtx.departmentIds));
    }
    approvalConditions.push(or(...aParts)!);
  } else if (scopeCtx.scope === "OWN_ONLY") {
    approvalConditions.push(eq(approvalRequests.requestedBy, auth.userId));
  }

  const leadConditions = [
    eq(crmLeads.tenantId, tenantId),
    gte(crmLeads.createdAt, range.start),
    lte(crmLeads.createdAt, range.end),
  ];
  if (ownerUserId) {
    leadConditions.push(eq(crmLeads.ownerUserId, ownerUserId));
  } else if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    leadConditions.push(
      or(
        inArray(crmLeads.ownerUserId, scopeCtx.teamUserIds),
        inArray(crmLeads.createdBy, scopeCtx.teamUserIds),
      )!,
    );
  } else if (scopeCtx.scope === "OWN_ONLY") {
    leadConditions.push(or(eq(crmLeads.ownerUserId, auth.userId), eq(crmLeads.createdBy, auth.userId))!);
  }

  const invoiceConditions = [
    eq(salesInvoices.tenantId, tenantId),
    gte(salesInvoices.createdAt, range.start),
    lte(salesInvoices.createdAt, range.end),
  ];
  if (ownerUserId) {
    invoiceConditions.push(eq(salesInvoices.ownerUserId, ownerUserId));
  } else if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    invoiceConditions.push(
      or(
        inArray(salesInvoices.ownerUserId, scopeCtx.teamUserIds),
        inArray(salesInvoices.createdBy, scopeCtx.teamUserIds),
      )!,
    );
  } else if (scopeCtx.scope === "OWN_ONLY") {
    invoiceConditions.push(
      or(eq(salesInvoices.ownerUserId, auth.userId), eq(salesInvoices.createdBy, auth.userId))!,
    );
  }

  const followupConditions = [
    eq(crmLeadFollowups.tenantId, tenantId),
    eq(crmLeadFollowups.status, "PENDING"),
    lt(crmLeadFollowups.scheduledAt, new Date()),
  ];
  if (ownerUserId) {
    followupConditions.push(eq(crmLeadFollowups.assignedToUserId, ownerUserId));
  } else if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    followupConditions.push(inArray(crmLeadFollowups.assignedToUserId, scopeCtx.teamUserIds));
  } else if (scopeCtx.scope === "OWN_ONLY") {
    followupConditions.push(eq(crmLeadFollowups.assignedToUserId, auth.userId));
  }

  const [
    allMemberships,
    [pendingInvitesRow],
    [activeBranchCount],
    [activeDeptCount],
    [activeTeamCount],
    [usage],
    entitlements,
    recentAuditRows,
    overdueSubscriptionInvoices,
    leadRows,
    invoiceStats,
    expenseStats,
    taskRows,
    [pendingApprovalsRow],
    [overdueFollowupsRow],
  ] = await Promise.all([
    db
      .select({
        status: tenantMemberships.status,
        branchId: tenantMemberships.branchId,
        departmentId: tenantMemberships.departmentId,
      })
      .from(tenantMemberships)
      .where(and(...membershipConditions)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userInvitations)
      .where(and(eq(userInvitations.tenantId, tenantId), eq(userInvitations.status, "PENDING"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(branches)
      .where(and(eq(branches.tenantId, tenantId), eq(branches.status, "ACTIVE"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.status, "ACTIVE"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(and(eq(teams.tenantId, tenantId), eq(teams.status, "ACTIVE"))),
    db.select().from(usageMetrics).where(eq(usageMetrics.tenantId, tenantId)).limit(1),
    db
      .select({
        moduleCode: tenantEntitlements.moduleCode,
        isEnabled: tenantEntitlements.isEnabled,
        quotas: tenantEntitlements.quotas,
      })
      .from(tenantEntitlements)
      .where(eq(tenantEntitlements.tenantId, tenantId)),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        actorUserId: auditLogs.actorUserId,
        actorName: users.fullName,
        beforeData: auditLogs.beforeData,
        afterData: auditLogs.afterData,
        reason: auditLogs.reason,
        requestId: auditLogs.requestId,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
    db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${subscriptionInvoices.total}), '0.00')`,
      })
      .from(subscriptionInvoices)
      .where(
        and(
          eq(subscriptionInvoices.tenantId, tenantId),
          eq(subscriptionInvoices.status, "OVERDUE"),
        ),
      ),
    db
      .select({
        stage: crmLeads.stage,
        estimatedValue: crmLeads.estimatedValue,
      })
      .from(crmLeads)
      .where(and(...leadConditions)),
    db
      .select({
        invoiced: sql<string>`coalesce(sum(${salesInvoices.grandTotal}), '0.00')`,
        collected: sql<string>`coalesce(sum(${salesInvoices.paidAmount}), '0.00')`,
        balanceDue: sql<string>`coalesce(sum(${salesInvoices.balanceDue}), '0.00')`,
      })
      .from(salesInvoices)
      .where(and(...invoiceConditions)),
    db
      .select({
        status: financeExpenses.status,
        amount: financeExpenses.amount,
      })
      .from(financeExpenses)
      .where(and(...expenseConditions)),
    db
      .select({
        status: tasks.status,
        dueAt: tasks.dueAt,
      })
      .from(tasks)
      .where(and(...taskConditions)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(approvalRequests)
      .where(and(...approvalConditions)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmLeadFollowups)
      .where(and(...followupConditions)),
  ]);

  const activeUsersCount = allMemberships.filter((m) => m.status === "ACTIVE").length;
  const inactiveUsersCount = allMemberships.filter((m) => m.status !== "ACTIVE").length;
  const unassignedUsersCount = allMemberships.filter(
    (m) => m.status === "ACTIVE" && (!m.branchId || !m.departmentId),
  ).length;
  const pendingInvitationsCount = pendingInvitesRow?.count ?? 0;
  const seatLimit = entitlements[0]?.quotas?.max_seats ?? 10;
  const seatsUsed = Math.max(usage?.seatsUsed ?? 1, activeUsersCount);
  const enabledModules = entitlements.filter((e) => e.isEnabled).map((e) => e.moduleCode);

  const branchesCount = activeBranchCount?.count ?? 0;
  const departmentsCount = activeDeptCount?.count ?? 0;
  const teamsCount = activeTeamCount?.count ?? 0;
  const pendingApprovalsCount = pendingApprovalsRow?.count ?? 0;

  // Company Setup Progress Checklist
  const setupChecklist = [
    { key: "company_profile", label: "Company legal name & tax ID", completed: Boolean(tenant.legalName && tenant.taxId) },
    { key: "company_logo", label: "Upload company logo", completed: Boolean(tenant.logoUrl || tenant.logoDocumentId) },
    { key: "numbering_rules", label: "Configure invoice & quotation prefixes", completed: Boolean(tenant.numberingPreferences) },
    { key: "branches_setup", label: "Add at least 1 branch", completed: branchesCount > 0 },
    { key: "departments_setup", label: "Add at least 1 department", completed: departmentsCount > 0 },
    { key: "team_invited", label: "Invite or add team members", completed: activeUsersCount > 1 || pendingInvitationsCount > 0 },
  ];
  const completedSteps = setupChecklist.filter((c) => c.completed).length;
  const setupPercentage = Math.round((completedSteps / setupChecklist.length) * 100);

  // Operational aggregates
  const wonLeads = leadRows.filter((l) => l.stage === "WON");
  const openLeads = leadRows.filter((l) => l.stage !== "WON" && l.stage !== "LOST");
  const totalPipelineVal = openLeads.reduce((sum, l) => sum + Number(l.estimatedValue), 0);
  const conversionRate =
    leadRows.length > 0 ? Number(((wonLeads.length / leadRows.length) * 100).toFixed(1)) : 0;
  const leadsByStageSummary = LEAD_STAGES.map((stage) => {
    const stageRows = leadRows.filter((l) => l.stage === stage);
    return {
      stage,
      count: stageRows.length,
      totalValue: Number(stageRows.reduce((s, l) => s + Number(l.estimatedValue), 0).toFixed(2)),
    };
  });
  const overdueFollowupsCount = overdueFollowupsRow?.count ?? 0;

  const totalInvoiced = Number(invoiceStats[0]?.invoiced ?? 0);
  const totalCollected = Number(invoiceStats[0]?.collected ?? 0);
  const totalClientDue = Number(invoiceStats[0]?.balanceDue ?? 0);

  const approvedExpenses = expenseStats.filter((e) => e.status === "APPROVED" || e.status === "PAID");
  const pendingExpenses = expenseStats.filter(
    (e) => e.status === "SUBMITTED" || e.status === "PENDING_FINANCE",
  );
  const totalExpensesAmt = approvedExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const now = new Date();
  const pendingTasksCount = taskRows.filter((t) => t.status === "TODO").length;
  const inProgressTasksCount = taskRows.filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW" || t.status === "REVIEW",
  ).length;
  const completedTasksCount = taskRows.filter(
    (t) => t.status === "DONE" || t.status === "COMPLETED",
  ).length;
  const overdueTasksCount = taskRows.filter(
    (t) =>
      t.dueAt &&
      t.dueAt < now &&
      t.status !== "DONE" &&
      t.status !== "COMPLETED" &&
      t.status !== "CANCELLED",
  ).length;

  return {
    scope: scopeCtx.scope,
    workspace: {
      name: tenant.name,
      status: tenant.status,
      currency,
      enabledModules,
    },
    appliedFilters: {
      period: query.period,
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      branchId: branchId ?? null,
      departmentId: departmentId ?? null,
      lockedDepartmentIds: scopeCtx.scope === "TEAM_DEPARTMENT" ? scopeCtx.departmentIds : null,
      ownerUserId: ownerUserId ?? null,
      status: query.status ?? null,
    },
    team_summary: {
      team_members_count: allMemberships.length,
      pending_approvals_count: pendingApprovalsCount,
      overdue_tasks_count: overdueTasksCount,
      overdue_followups_count: overdueFollowupsCount,
      pending_expenses_count: pendingExpenses.length,
      team_expenses_total: Number(totalExpensesAmt.toFixed(2)),
    },
    // Admin-focused summary payload fields
    users_summary: {
      active: activeUsersCount,
      inactive: inactiveUsersCount,
      invited: pendingInvitationsCount,
      seats_used: seatsUsed,
      seat_limit: seatLimit,
    },
    org_summary: {
      branches_count: branchesCount,
      departments_count: departmentsCount,
      teams_count: teamsCount,
      unassigned_users_count: unassignedUsersCount,
    },
    enabled_modules: enabledModules,
    setup_progress: {
      completed_steps: completedSteps,
      total_steps: setupChecklist.length,
      percentage: setupPercentage,
      checklist: setupChecklist,
    },
    recent_audit_events: recentAuditRows.map((ev) => ({
      id: ev.id,
      actor_user_id: ev.actorUserId,
      actor_name: ev.actorName ?? null,
      action: ev.action,
      entity_type: ev.entityType,
      entity_id: ev.entityId,
      before_data: ev.beforeData,
      after_data: ev.afterData,
      reason: ev.reason,
      request_id: ev.requestId,
      created_at: ev.createdAt,
    })),
    kpis: {
      revenue: {
        totalRevenue: totalCollected,
        invoicedAmount: totalInvoiced,
        collectedAmount: totalCollected,
        growthPercent: 0,
        currency,
      },
      salesPipeline: {
        totalPipelineValue: Number(totalPipelineVal.toFixed(2)),
        openDealsCount: openLeads.length,
        wonDealsCount: wonLeads.length,
        overdueFollowupsCount,
        conversionRatePercent: conversionRate,
        currency,
        byStage: leadsByStageSummary,
      },
      dueInvoices: {
        clientOverdueCount: totalClientDue > 0 ? 1 : 0,
        clientOverdueAmount: totalClientDue,
        platformOverdueInvoicesCount: overdueSubscriptionInvoices[0]?.count ?? 0,
        platformOverdueAmount: Number(overdueSubscriptionInvoices[0]?.total ?? 0),
        currency,
      },
      expenses: {
        totalExpenses: Number(totalExpensesAmt.toFixed(2)),
        approvedExpensesCount: approvedExpenses.length,
        pendingApprovalCount: pendingExpenses.length,
        currency,
      },
      tasks: {
        totalTasks: taskRows.length,
        pendingCount: pendingTasksCount,
        inProgressCount: inProgressTasksCount,
        overdueCount: overdueTasksCount,
        completedCount: completedTasksCount,
      },
      organization: {
        teamMembersCount: allMemberships.length,
        branchesCount,
        departmentsCount,
        teamsCount,
        seatsUsed,
        seatLimit,
        storageUsedMb: usage?.storageUsedMb ?? 0,
        apiCallsUsed: usage?.apiCallsUsed ?? 0,
      },
    },
    recentActivities: recentAuditRows,
  };
}

// ==========================================
// 2. MODULE ANALYTICS (GET /analytics/*)
// ==========================================
export async function getModuleAnalytics(
  auth: AuthContext,
  moduleType: "sales" | "finance" | "hr" | "projects",
  query: AnalyticsQuery,
) {
  const tenantId = auth.tenantId!;
  const teamPerm =
    moduleType === "sales" && !auth.permissions.includes("REPORTS.ANALYTICS.VIEW_TEAM")
      ? "SALES.QUOTATIONS.VIEW_TEAM"
      : "REPORTS.ANALYTICS.VIEW_TEAM";
  const scopeCtx = await resolveRecordScope(auth, "REPORTS.ANALYTICS.VIEW_ALL", teamPerm);
  const range = resolveDateRange(query.period, query.from, query.to);
  const branchId = query.branch_id ?? query.branchId;
  const departmentId = query.department_id ?? query.departmentId;
  const ownerUserId = query.owner_user_id ?? query.ownerUserId;

  if (
    scopeCtx.scope === "TEAM_DEPARTMENT" &&
    departmentId &&
    !scopeCtx.departmentIds.includes(departmentId)
  ) {
    throw Errors.forbidden("Cannot view analytics for another department.");
  }
  if (
    scopeCtx.scope === "TEAM_DEPARTMENT" &&
    ownerUserId &&
    !scopeCtx.teamUserIds.includes(ownerUserId)
  ) {
    throw Errors.forbidden("Cannot view analytics for a user outside your team.");
  }
  if (scopeCtx.scope === "OWN_ONLY" && ownerUserId && ownerUserId !== auth.userId) {
    throw Errors.forbidden("You can only view your own analytics.");
  }

  const [deptRows, branchRows] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name, status: departments.status })
      .from(departments)
      .where(eq(departments.tenantId, tenantId)),
    db
      .select({ id: branches.id, name: branches.name, code: branches.code })
      .from(branches)
      .where(eq(branches.tenantId, tenantId)),
  ]);

  const appliedFilters = {
    period: query.period,
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    branchId: branchId ?? null,
    departmentId: departmentId ?? null,
    ownerUserId: ownerUserId ?? null,
  };

  if (moduleType === "sales") {
    const leadConds = [
      eq(crmLeads.tenantId, tenantId),
      gte(crmLeads.createdAt, range.start),
      lte(crmLeads.createdAt, range.end),
    ];
    const quoteConds = [
      eq(salesQuotations.tenantId, tenantId),
      gte(salesQuotations.createdAt, range.start),
      lte(salesQuotations.createdAt, range.end),
    ];
    const orderConds = [
      eq(salesOrders.tenantId, tenantId),
      gte(salesOrders.createdAt, range.start),
      lte(salesOrders.createdAt, range.end),
    ];

    if (ownerUserId) {
      leadConds.push(eq(crmLeads.ownerUserId, ownerUserId));
      quoteConds.push(eq(salesQuotations.ownerUserId, ownerUserId));
      orderConds.push(eq(salesOrders.ownerUserId, ownerUserId));
    } else if (scopeCtx.scope === "TEAM_DEPARTMENT") {
      leadConds.push(
        or(
          inArray(crmLeads.ownerUserId, scopeCtx.teamUserIds),
          inArray(crmLeads.createdBy, scopeCtx.teamUserIds),
        )!,
      );
      quoteConds.push(
        or(
          inArray(salesQuotations.ownerUserId, scopeCtx.teamUserIds),
          inArray(salesQuotations.createdBy, scopeCtx.teamUserIds),
        )!,
      );
      orderConds.push(
        or(
          inArray(salesOrders.ownerUserId, scopeCtx.teamUserIds),
          inArray(salesOrders.createdBy, scopeCtx.teamUserIds),
        )!,
      );
    } else if (scopeCtx.scope === "OWN_ONLY") {
      leadConds.push(or(eq(crmLeads.ownerUserId, auth.userId), eq(crmLeads.createdBy, auth.userId))!);
      quoteConds.push(
        or(eq(salesQuotations.ownerUserId, auth.userId), eq(salesQuotations.createdBy, auth.userId))!,
      );
      orderConds.push(
        or(eq(salesOrders.ownerUserId, auth.userId), eq(salesOrders.createdBy, auth.userId))!,
      );
    }

    const [leads, quotes, orders, membersList] = await Promise.all([
      db
        .select({
          stage: crmLeads.stage,
          source: crmLeads.source,
          estimatedValue: crmLeads.estimatedValue,
          ownerUserId: crmLeads.ownerUserId,
        })
        .from(crmLeads)
        .where(and(...leadConds)),
      db
        .select({
          id: salesQuotations.id,
          status: salesQuotations.status,
          grandTotal: salesQuotations.grandTotal,
          ownerUserId: salesQuotations.ownerUserId,
        })
        .from(salesQuotations)
        .where(and(...quoteConds)),
      db
        .select({
          id: salesOrders.id,
          customerId: salesOrders.customerId,
          customerName: crmCustomers.name,
          status: salesOrders.status,
          grandTotal: salesOrders.grandTotal,
          ownerUserId: salesOrders.ownerUserId,
        })
        .from(salesOrders)
        .leftJoin(crmCustomers, eq(crmCustomers.id, salesOrders.customerId))
        .where(and(...orderConds)),
      db
        .select({
          userId: tenantMemberships.userId,
          departmentId: tenantMemberships.departmentId,
          fullName: users.fullName,
        })
        .from(tenantMemberships)
        .innerJoin(users, eq(users.id, tenantMemberships.userId))
        .where(eq(tenantMemberships.tenantId, tenantId)),
    ]);

    const userNameMap = new Map(membersList.map((m) => [m.userId, m.fullName]));
    const userDeptMap = new Map(membersList.map((m) => [m.userId, m.departmentId]));

    const scopedOrderIds = orders.map((o) => o.id);
    const orderItemsRows =
      scopedOrderIds.length > 0
        ? await db
            .select({
              productId: salesOrderItems.productId,
              description: salesOrderItems.description,
              productName: salesProducts.name,
              quantity: salesOrderItems.quantity,
              lineTotal: salesOrderItems.lineTotal,
            })
            .from(salesOrderItems)
            .leftJoin(salesProducts, eq(salesProducts.id, salesOrderItems.productId))
            .where(inArray(salesOrderItems.orderId, scopedOrderIds))
        : [];

    const wonLeads = leads.filter((l) => l.stage === "WON");
    const openLeads = leads.filter((l) => l.stage !== "WON" && l.stage !== "LOST");
    const conversionRatePercent =
      leads.length > 0 ? Number(((wonLeads.length / leads.length) * 100).toFixed(1)) : 0;
    const totalPipelineValue = Number(
      openLeads.reduce((s, l) => s + Number(l.estimatedValue), 0).toFixed(2),
    );
    const wonRevenueFromLeads = wonLeads.reduce((s, l) => s + Number(l.estimatedValue), 0);
    const totalOrdersRevenue = Number(
      orders
        .filter((o) => o.status !== "CANCELLED")
        .reduce((s, o) => s + Number(o.grandTotal), 0)
        .toFixed(2),
    );
    const averageDealSize =
      wonLeads.length > 0
        ? Number((wonRevenueFromLeads / wonLeads.length).toFixed(2))
        : orders.length > 0
          ? Number((totalOrdersRevenue / orders.length).toFixed(2))
          : 0;

    const acceptedQuotes = quotes.filter((q) =>
      ["APPROVED", "SENT", "ACCEPTED", "CONVERTED"].includes(q.status),
    );
    const quotationAcceptanceRatePercent =
      quotes.length > 0 ? Number(((acceptedQuotes.length / quotes.length) * 100).toFixed(1)) : 0;
    const totalQuotationValue = Number(
      quotes.reduce((s, q) => s + Number(q.grandTotal), 0).toFixed(2),
    );

    const leadsByStage = LEAD_STAGES.map((stage) => {
      const stageLeads = leads.filter((l) => l.stage === stage);
      return {
        stage,
        count: stageLeads.length,
        value: Number(stageLeads.reduce((s, l) => s + Number(l.estimatedValue), 0).toFixed(2)),
      };
    });

    const sourceMap = new Map<string, { source: string; count: number; value: number }>();
    for (const l of leads) {
      const src = l.source?.trim() || "UNSPECIFIED";
      const cur = sourceMap.get(src) ?? { source: src, count: 0, value: 0 };
      cur.count += 1;
      cur.value = Number((cur.value + Number(l.estimatedValue)).toFixed(2));
      sourceMap.set(src, cur);
    }

    const ownerLeadMap = new Map<
      string,
      { ownerUserId: string; ownerName: string; leadsCount: number; wonCount: number; pipelineValue: number }
    >();
    for (const l of leads) {
      const oid = l.ownerUserId ?? "UNASSIGNED";
      const cur = ownerLeadMap.get(oid) ?? {
        ownerUserId: oid,
        ownerName: oid === "UNASSIGNED" ? "Unassigned" : (userNameMap.get(oid) ?? "Unknown"),
        leadsCount: 0,
        wonCount: 0,
        pipelineValue: 0,
      };
      cur.leadsCount += 1;
      if (l.stage === "WON") cur.wonCount += 1;
      if (l.stage !== "WON" && l.stage !== "LOST") {
        cur.pipelineValue = Number((cur.pipelineValue + Number(l.estimatedValue)).toFixed(2));
      }
      ownerLeadMap.set(oid, cur);
    }

    const ownerSalesMap = new Map<
      string,
      {
        ownerUserId: string;
        ownerName: string;
        quotationsCount: number;
        acceptedQuotationsCount: number;
        ordersCount: number;
        revenue: number;
      }
    >();
    const ensureOwnerSales = (oid: string) => {
      let cur = ownerSalesMap.get(oid);
      if (!cur) {
        cur = {
          ownerUserId: oid,
          ownerName: oid === "UNASSIGNED" ? "Unassigned" : (userNameMap.get(oid) ?? "Unknown"),
          quotationsCount: 0,
          acceptedQuotationsCount: 0,
          ordersCount: 0,
          revenue: 0,
        };
        ownerSalesMap.set(oid, cur);
      }
      return cur;
    };
    for (const q of quotes) {
      const cur = ensureOwnerSales(q.ownerUserId ?? "UNASSIGNED");
      cur.quotationsCount += 1;
      if (["APPROVED", "SENT", "ACCEPTED", "CONVERTED"].includes(q.status)) {
        cur.acceptedQuotationsCount += 1;
      }
    }
    for (const o of orders) {
      const cur = ensureOwnerSales(o.ownerUserId ?? "UNASSIGNED");
      cur.ordersCount += 1;
      if (o.status !== "CANCELLED") {
        cur.revenue = Number((cur.revenue + Number(o.grandTotal)).toFixed(2));
      }
    }

    const productSalesMap = new Map<
      string,
      { productId: string | null; productName: string; quantitySold: number; revenue: number }
    >();
    for (const item of orderItemsRows) {
      const key = item.productId ?? item.description;
      const cur = productSalesMap.get(key) ?? {
        productId: item.productId,
        productName: item.productName ?? item.description,
        quantitySold: 0,
        revenue: 0,
      };
      cur.quantitySold = Number((cur.quantitySold + Number(item.quantity)).toFixed(2));
      cur.revenue = Number((cur.revenue + Number(item.lineTotal)).toFixed(2));
      productSalesMap.set(key, cur);
    }

    const customerSalesMap = new Map<
      string,
      { customerId: string; customerName: string; ordersCount: number; revenue: number }
    >();
    for (const o of orders) {
      if (o.status === "CANCELLED") continue;
      const cur = customerSalesMap.get(o.customerId) ?? {
        customerId: o.customerId,
        customerName: o.customerName ?? "Customer",
        ordersCount: 0,
        revenue: 0,
      };
      cur.ordersCount += 1;
      cur.revenue = Number((cur.revenue + Number(o.grandTotal)).toFixed(2));
      customerSalesMap.set(o.customerId, cur);
    }

    const scopedDepts =
      scopeCtx.scope === "TEAM_DEPARTMENT" && scopeCtx.departmentIds.length > 0
        ? deptRows.filter((d) => scopeCtx.departmentIds.includes(d.id))
        : deptRows;

    return {
      scope: scopeCtx.scope,
      module: "SALES",
      appliedFilters,
      metrics: {
        totalLeadsCount: leads.length,
        wonDealsCount: wonLeads.length,
        conversionRatePercent,
        averageDealSize,
        totalPipelineValue,
        totalQuotationsCount: quotes.length,
        acceptedQuotationsCount: acceptedQuotes.length,
        quotationAcceptanceRatePercent,
        totalQuotationValue,
        totalOrdersCount: orders.length,
        totalRevenue: totalOrdersRevenue,
      },
      charts: {
        leadsByStage,
        leadsBySource: Array.from(sourceMap.values()),
        leadsByOwner: Array.from(ownerLeadMap.values()),
        ownerWiseSales: Array.from(ownerSalesMap.values()),
        productWiseSales: Array.from(productSalesMap.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 15),
        customerWiseSales: Array.from(customerSalesMap.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 15),
        departmentWiseSales: scopedDepts.map((d) => {
          const deptOrders = orders.filter(
            (o) => o.ownerUserId && userDeptMap.get(o.ownerUserId) === d.id && o.status !== "CANCELLED",
          );
          const deptWon = wonLeads.filter((l) => l.ownerUserId && userDeptMap.get(l.ownerUserId) === d.id);
          return {
            departmentId: d.id,
            departmentName: d.name,
            revenue: Number(deptOrders.reduce((s, o) => s + Number(o.grandTotal), 0).toFixed(2)),
            dealsWon: deptWon.length,
          };
        }),
        pipelineFunnel: leadsByStage,
      },
    };
  }

  if (moduleType === "finance") {
    return {
      module: "FINANCE",
      appliedFilters,
      metrics: {
        accountsReceivableTotal: 0,
        accountsPayableTotal: 0,
        netCashflow: 0,
        collectionEfficiencyPercent: 0,
      },
      charts: {
        arAgingBuckets: [
          { bucket: "0-30 days", amount: 0 },
          { bucket: "31-60 days", amount: 0 },
          { bucket: "61-90 days", amount: 0 },
          { bucket: "90+ days", amount: 0 },
        ],
        apAgingBuckets: [
          { bucket: "0-30 days", amount: 0 },
          { bucket: "31-60 days", amount: 0 },
          { bucket: "61+ days", amount: 0 },
        ],
        departmentWiseExpenses: deptRows.map((d) => ({
          departmentId: d.id,
          departmentName: d.name,
          expenseAmount: 0,
        })),
      },
    };
  }

  if (moduleType === "hr") {
    const members = await db
      .select({
        status: tenantMemberships.status,
        branchId: tenantMemberships.branchId,
        departmentId: tenantMemberships.departmentId,
      })
      .from(tenantMemberships)
      .where(eq(tenantMemberships.tenantId, tenantId));

    const activeCount = members.filter((m) => m.status === "ACTIVE").length;
    const inactiveCount = members.filter((m) => m.status !== "ACTIVE").length;

    return {
      module: "HR",
      appliedFilters,
      metrics: {
        totalHeadcount: members.length,
        activeEmployees: activeCount,
        inactiveEmployees: inactiveCount,
        attendanceRatePercent: 0,
        pendingLeaveRequests: 0,
      },
      charts: {
        departmentWiseHeadcount: deptRows.map((d) => ({
          departmentId: d.id,
          departmentName: d.name,
          headcount: members.filter((m) => m.departmentId === d.id).length,
        })),
        branchWiseHeadcount: branchRows.map((b) => ({
          branchId: b.id,
          branchName: b.name,
          headcount: members.filter((m) => m.branchId === b.id).length,
        })),
      },
    };
  }

  // Projects / Tasks Analytics (scoped for Manager vs Owner)
  const deptFiltered =
    scopeCtx.scope === "TEAM_DEPARTMENT" && scopeCtx.departmentIds.length > 0
      ? deptRows.filter((d) => scopeCtx.departmentIds.includes(d.id))
      : deptRows;

  const teamRows = await db
    .select({ id: teams.id, name: teams.name, departmentId: teams.departmentId })
    .from(teams)
    .where(
      and(
        eq(teams.tenantId, tenantId),
        ...(scopeCtx.scope === "TEAM_DEPARTMENT" && scopeCtx.teamIds.length > 0
          ? [inArray(teams.id, scopeCtx.teamIds)]
          : []),
      ),
    );

  const taskRows = await db
    .select({
      status: tasks.status,
      departmentId: tasks.departmentId,
      assigneeUserId: tasks.assigneeUserId,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.tenantId, tenantId),
        ...(scopeCtx.scope === "TEAM_DEPARTMENT"
          ? [
              or(
                inArray(tasks.assigneeUserId, scopeCtx.teamUserIds),
                ...(scopeCtx.departmentIds.length > 0
                  ? [inArray(tasks.departmentId, scopeCtx.departmentIds)]
                  : []),
              )!,
            ]
          : []),
      ),
    );

  const completedTasks = taskRows.filter(
    (t) => t.status === "DONE" || t.status === "COMPLETED",
  );
  const completionRate =
    taskRows.length > 0 ? Math.round((completedTasks.length / taskRows.length) * 100) : 0;

  return {
    scope: scopeCtx.scope,
    module: "PROJECTS",
    appliedFilters,
    metrics: {
      totalTasksCount: taskRows.length,
      completedTasksCount: completedTasks.length,
      pendingTasksCount: taskRows.length - completedTasks.length,
      taskCompletionRatePercent: completionRate,
    },
    charts: {
      departmentWisePerformance: deptFiltered.map((d) => {
        const dTasks = taskRows.filter((t) => t.departmentId === d.id);
        const dCompleted = dTasks.filter(
          (t) => t.status === "DONE" || t.status === "COMPLETED",
        ).length;
        return {
          departmentId: d.id,
          departmentName: d.name,
          completedTasks: dCompleted,
          pendingTasks: dTasks.length - dCompleted,
        };
      }),
      teamWorkload: teamRows.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        assignedTasks: taskRows.filter((tk) => tk.departmentId === t.departmentId).length,
        completedTasks: completedTasks.filter((tk) => tk.departmentId === t.departmentId).length,
      })),
    },
  };
}

// ==========================================
// 3. ASYNC REPORT EXPORTS (POST /reports/export)
// ==========================================
export async function triggerReportExport(
  tenantId: string,
  actorUserId: string,
  input: ExportReportInput,
  requestId?: string,
) {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const ext = input.format.toLowerCase();
  const fileName = `${input.reportType.toLowerCase()}-report-${dateStamp}.${ext}`;

  const [job] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(reportExportJobs)
      .values({
        tenantId,
        requestedBy: actorUserId,
        reportType: input.reportType,
        format: input.format,
        filters: input.filters ?? {},
        status: "QUEUED",
        fileName,
      })
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "REPORTS.EXPORT.TRIGGER",
      entityType: "report_export_job",
      entityId: rows[0].id,
      afterData: {
        reportType: input.reportType,
        format: input.format,
        fileName,
      },
      requestId,
    });

    return rows;
  });

  return {
    job: {
      id: job.id,
      reportType: job.reportType,
      format: job.format,
      status: job.status,
      fileName: job.fileName,
      createdAt: job.createdAt,
    },
    message: `Export job queued successfully (${fileName}).`,
  };
}

export async function listReportExportJobs(tenantId: string) {
  const jobs = await db
    .select()
    .from(reportExportJobs)
    .where(eq(reportExportJobs.tenantId, tenantId))
    .orderBy(desc(reportExportJobs.createdAt))
    .limit(50);

  return { jobs };
}

// ==========================================
// 4. SAVED WIDGETS (GET/PUT /dashboard/widgets)
// ==========================================
export async function getDashboardWidgets(
  tenantId: string,
  userId: string,
  layoutName = "default",
) {
  const [saved] = await db
    .select()
    .from(dashboardWidgets)
    .where(
      and(
        eq(dashboardWidgets.tenantId, tenantId),
        eq(dashboardWidgets.userId, userId),
        eq(dashboardWidgets.layoutName, layoutName),
      ),
    )
    .limit(1);

  if (!saved) {
    return {
      layoutName,
      isDefault: true,
      widgets: DEFAULT_DASHBOARD_WIDGETS,
    };
  }

  return {
    id: saved.id,
    layoutName: saved.layoutName,
    isDefault: false,
    widgets: saved.widgets,
    updatedAt: saved.updatedAt,
  };
}

export async function saveDashboardWidgets(
  tenantId: string,
  userId: string,
  input: SaveWidgetsInput,
  requestId?: string,
) {
  const [existing] = await db
    .select()
    .from(dashboardWidgets)
    .where(
      and(
        eq(dashboardWidgets.tenantId, tenantId),
        eq(dashboardWidgets.userId, userId),
        eq(dashboardWidgets.layoutName, input.layoutName),
      ),
    )
    .limit(1);

  const saved = await db.transaction(async (tx) => {
    let row;
    if (existing) {
      const [updated] = await tx
        .update(dashboardWidgets)
        .set({
          widgets: input.widgets,
          updatedAt: new Date(),
        })
        .where(eq(dashboardWidgets.id, existing.id))
        .returning();
      row = updated;
    } else {
      const [inserted] = await tx
        .insert(dashboardWidgets)
        .values({
          tenantId,
          userId,
          layoutName: input.layoutName,
          widgets: input.widgets,
        })
        .returning();
      row = inserted;
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId: userId,
      action: "REPORTS.WIDGETS.UPDATE",
      entityType: "dashboard_widgets",
      entityId: row.id,
      afterData: {
        layoutName: row.layoutName,
        widgetCount: row.widgets.length,
      },
      requestId,
    });

    return row;
  });

  return {
    layoutName: saved.layoutName,
    widgets: saved.widgets,
    updatedAt: saved.updatedAt,
    message: "Dashboard widget layout saved successfully.",
  };
}
