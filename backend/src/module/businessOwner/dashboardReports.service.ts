// Dashboard & Reports Service: Overview KPIs, Module Analytics, Async Exports & Saved Widgets.
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  approvalRequests,
  auditLogs,
  branches,
  crmLeads,
  dashboardWidgets,
  departments,
  financeExpenses,
  reportExportJobs,
  salesInvoices,
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
  const scopeCtx = await resolveRecordScope(auth, "REPORTS.DASHBOARD.VIEW_ALL", "REPORTS.DASHBOARD.VIEW");
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
      .where(
        and(
          eq(crmLeads.tenantId, tenantId),
          gte(crmLeads.createdAt, range.start),
          lte(crmLeads.createdAt, range.end),
          ...(ownerUserId ? [eq(crmLeads.ownerUserId, ownerUserId)] : []),
        ),
      ),
    db
      .select({
        invoiced: sql<string>`coalesce(sum(${salesInvoices.grandTotal}), '0.00')`,
        collected: sql<string>`coalesce(sum(${salesInvoices.paidAmount}), '0.00')`,
        balanceDue: sql<string>`coalesce(sum(${salesInvoices.balanceDue}), '0.00')`,
      })
      .from(salesInvoices)
      .where(
        and(
          eq(salesInvoices.tenantId, tenantId),
          gte(salesInvoices.createdAt, range.start),
          lte(salesInvoices.createdAt, range.end),
        ),
      ),
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
        conversionRatePercent: conversionRate,
        currency,
        byStage: [],
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
  const scopeCtx = await resolveRecordScope(auth, "REPORTS.ANALYTICS.VIEW_ALL", "REPORTS.ANALYTICS.VIEW");
  const range = resolveDateRange(query.period, query.from, query.to);
  const branchId = query.branch_id ?? query.branchId;
  const departmentId = query.department_id ?? query.departmentId;

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
  };

  if (moduleType === "sales") {
    return {
      module: "SALES",
      appliedFilters,
      metrics: {
        conversionRatePercent: 0,
        averageDealSize: 0,
        totalQuotationsCount: 0,
        totalOrdersCount: 0,
      },
      charts: {
        departmentWiseSales: deptRows.map((d) => ({
          departmentId: d.id,
          departmentName: d.name,
          revenue: 0,
          dealsWon: 0,
        })),
        pipelineFunnel: [
          { stage: "NEW", count: 0, value: 0 },
          { stage: "QUALIFIED", count: 0, value: 0 },
          { stage: "QUOTATION_SENT", count: 0, value: 0 },
          { stage: "WON", count: 0, value: 0 },
        ],
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
