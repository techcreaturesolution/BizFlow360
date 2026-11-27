// Business Owner routes: Team, Invitations, User Status, Roles & RBAC + Organization & Company Setup.
// Enforces 3-layer security check: JwtAuthGuard -> EntitlementGuard -> PermissionsGuard + IdempotencyGuard
import { Router } from "express";
import {
  entitlementGuard,
  idempotencyGuard,
  jwtAuthGuard,
  permissionsGuard,
} from "../../middlewares/guards";
import {
  assignRolePermissionsHandler,
  assignUserRolesHandler,
  createRoleHandler,
  deleteRoleHandler,
  getRolesHandler,
  getTeamMembersHandler,
  inviteMemberHandler,
  listPermissionsCatalogHandler,
  updateRoleHandler,
  updateUserStatusHandler,
} from "./businessOwner.controller";
import {
  createBranchHandler,
  createDepartmentHandler,
  createTeamHandler,
  getCompanyProfileHandler,
  listBranchesHandler,
  listDepartmentsHandler,
  listTeamsHandler,
  updateBranchHandler,
  updateCompanyProfileHandler,
  updateDepartmentHandler,
  updateTeamHandler,
} from "./companySetup.controller";
import {
  createModuleAnalyticsHandler,
  getDashboardSummaryHandler,
  getDashboardWidgetsHandler,
  listReportExportsHandler,
  saveDashboardWidgetsHandler,
  triggerReportExportHandler,
} from "./dashboardReports.controller";
import {
  cancelSubscriptionHandler,
  changeSubscriptionPlanHandler,
  downloadTenantInvoiceHandler,
  getBillingUsageHandler,
  getCurrentSubscriptionHandler,
  listAvailablePlansHandler,
  listTenantInvoicesHandler,
  startBillingCheckoutHandler,
} from "./tenantBilling.controller";
import {
  approveRequestHandler,
  getApprovalInboxHandler,
  getNotificationPreferencesHandler,
  listNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
  rejectRequestHandler,
  updateNotificationPreferencesHandler,
} from "./approvalsNotifications.controller";

const router = Router();

// ==========================================
// A. Auth, Team Invites & RBAC
// ==========================================
router.get(
  "/users",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.USERS.VIEW"),
  getTeamMembersHandler,
);

router.post(
  "/users/invitations",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.USERS.INVITE"),
  idempotencyGuard,
  inviteMemberHandler,
);

router.patch(
  "/users/:id/status",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.USERS.MANAGE"),
  updateUserStatusHandler,
);

router.put(
  "/users/:id/roles",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.USERS.MANAGE", "AUTH.ROLES.MANAGE"),
  assignUserRolesHandler,
);

router.get(
  "/permissions",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.ROLES.MANAGE", "AUTH.USERS.VIEW"),
  listPermissionsCatalogHandler,
);

router.get(
  "/roles",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.ROLES.MANAGE"),
  getRolesHandler,
);

router.post(
  "/roles",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.ROLES.MANAGE"),
  createRoleHandler,
);

router.patch(
  "/roles/:id",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.ROLES.MANAGE"),
  updateRoleHandler,
);

router.delete(
  "/roles/:id",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.ROLES.MANAGE"),
  deleteRoleHandler,
);

router.put(
  "/roles/:id/permissions",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.ROLES.MANAGE"),
  assignRolePermissionsHandler,
);

// ==========================================
// B. Organization & Company Setup Wizard
// ==========================================
router.get(
  "/company",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.COMPANY.VIEW"),
  getCompanyProfileHandler,
);

router.put(
  "/company",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.COMPANY.MANAGE"),
  updateCompanyProfileHandler,
);

router.get(
  "/branches",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.BRANCHES.VIEW"),
  listBranchesHandler,
);

router.post(
  "/branches",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.BRANCHES.MANAGE"),
  createBranchHandler,
);

router.put(
  "/branches",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.BRANCHES.MANAGE"),
  updateBranchHandler,
);

router.put(
  "/branches/:id",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.BRANCHES.MANAGE"),
  updateBranchHandler,
);

router.get(
  "/departments",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.DEPARTMENTS.VIEW"),
  listDepartmentsHandler,
);

router.post(
  "/departments",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.DEPARTMENTS.MANAGE"),
  createDepartmentHandler,
);

router.put(
  "/departments",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.DEPARTMENTS.MANAGE"),
  updateDepartmentHandler,
);

router.put(
  "/departments/:id",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.DEPARTMENTS.MANAGE"),
  updateDepartmentHandler,
);

router.get(
  "/teams",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.TEAMS.VIEW"),
  listTeamsHandler,
);

router.post(
  "/teams",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.TEAMS.MANAGE"),
  createTeamHandler,
);

router.put(
  "/teams/:id",
  jwtAuthGuard,
  entitlementGuard("ORG"),
  permissionsGuard("ORG.TEAMS.MANAGE"),
  updateTeamHandler,
);

// ==========================================
// C. Dashboard & Reports
// ==========================================
router.get(
  "/dashboard/summary",
  jwtAuthGuard,
  entitlementGuard("REPORTS"),
  permissionsGuard("REPORTS.DASHBOARD.VIEW"),
  getDashboardSummaryHandler,
);

router.get(
  "/analytics/sales",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("REPORTS.ANALYTICS.VIEW", "SALES.QUOTATIONS.VIEW"),
  createModuleAnalyticsHandler("sales"),
);

router.get(
  "/analytics/finance",
  jwtAuthGuard,
  entitlementGuard("FINANCE"),
  permissionsGuard("REPORTS.ANALYTICS.VIEW", "FINANCE.INVOICES.VIEW"),
  createModuleAnalyticsHandler("finance"),
);

router.get(
  "/analytics/hr",
  jwtAuthGuard,
  entitlementGuard("HR"),
  permissionsGuard("REPORTS.ANALYTICS.VIEW", "HR.EMPLOYEES.VIEW"),
  createModuleAnalyticsHandler("hr"),
);

router.get(
  "/analytics/projects",
  jwtAuthGuard,
  entitlementGuard("TASKS"),
  permissionsGuard("REPORTS.ANALYTICS.VIEW"),
  createModuleAnalyticsHandler("projects"),
);

router.post(
  "/reports/export",
  jwtAuthGuard,
  entitlementGuard("REPORTS"),
  permissionsGuard("REPORTS.EXPORT.CREATE"),
  idempotencyGuard,
  triggerReportExportHandler,
);

router.get(
  "/reports/export",
  jwtAuthGuard,
  entitlementGuard("REPORTS"),
  permissionsGuard("REPORTS.EXPORT.CREATE"),
  listReportExportsHandler,
);

router.get(
  "/dashboard/widgets",
  jwtAuthGuard,
  entitlementGuard("REPORTS"),
  permissionsGuard("REPORTS.DASHBOARD.VIEW"),
  getDashboardWidgetsHandler,
);

router.put(
  "/dashboard/widgets",
  jwtAuthGuard,
  entitlementGuard("REPORTS"),
  permissionsGuard("REPORTS.DASHBOARD.MANAGE"),
  saveDashboardWidgetsHandler,
);

// ==========================================
// D. Tenant Subscription & Billing
// ==========================================
router.get(
  "/billing/plans",
  jwtAuthGuard,
  entitlementGuard("BILLING"),
  permissionsGuard("BILLING.SUBSCRIPTION.VIEW"),
  listAvailablePlansHandler,
);

router.get(
  "/billing/subscription",
  jwtAuthGuard,
  entitlementGuard("BILLING"),
  permissionsGuard("BILLING.SUBSCRIPTION.VIEW"),
  getCurrentSubscriptionHandler,
);

router.get(
  "/billing/invoices",
  jwtAuthGuard,
  entitlementGuard("BILLING"),
  permissionsGuard("BILLING.SUBSCRIPTION.VIEW"),
  listTenantInvoicesHandler,
);

router.get(
  "/billing/invoices/:id/download",
  jwtAuthGuard,
  entitlementGuard("BILLING"),
  permissionsGuard("BILLING.SUBSCRIPTION.VIEW"),
  downloadTenantInvoiceHandler,
);

router.get(
  "/billing/usage",
  jwtAuthGuard,
  entitlementGuard("BILLING"),
  permissionsGuard("BILLING.SUBSCRIPTION.VIEW"),
  getBillingUsageHandler,
);

router.post(
  "/billing/checkout",
  jwtAuthGuard,
  entitlementGuard("BILLING"),
  permissionsGuard("BILLING.SUBSCRIPTION.MANAGE"),
  idempotencyGuard,
  startBillingCheckoutHandler,
);

router.post(
  "/billing/change-plan",
  jwtAuthGuard,
  entitlementGuard("BILLING"),
  permissionsGuard("BILLING.SUBSCRIPTION.MANAGE"),
  idempotencyGuard,
  changeSubscriptionPlanHandler,
);

router.post(
  "/billing/cancel",
  jwtAuthGuard,
  entitlementGuard("BILLING"),
  permissionsGuard("BILLING.SUBSCRIPTION.MANAGE"),
  idempotencyGuard,
  cancelSubscriptionHandler,
);

// ==========================================
// E. Approvals & Notifications
// ==========================================
router.get(
  "/approvals/inbox",
  jwtAuthGuard,
  entitlementGuard("APPROVALS"),
  permissionsGuard("APPROVALS.INBOX.VIEW"),
  getApprovalInboxHandler,
);

router.post(
  "/approvals/:id/approve",
  jwtAuthGuard,
  entitlementGuard("APPROVALS"),
  permissionsGuard("APPROVALS.INBOX.DECIDE"),
  idempotencyGuard,
  approveRequestHandler,
);

router.post(
  "/approvals/:id/reject",
  jwtAuthGuard,
  entitlementGuard("APPROVALS"),
  permissionsGuard("APPROVALS.INBOX.DECIDE"),
  idempotencyGuard,
  rejectRequestHandler,
);

router.get(
  "/notifications",
  jwtAuthGuard,
  entitlementGuard("NOTIFICATIONS"),
  permissionsGuard("NOTIFICATIONS.ALERTS.VIEW"),
  listNotificationsHandler,
);

router.patch(
  "/notifications/:id/read",
  jwtAuthGuard,
  entitlementGuard("NOTIFICATIONS"),
  permissionsGuard("NOTIFICATIONS.ALERTS.VIEW"),
  markNotificationReadHandler,
);

router.post(
  "/notifications/read-all",
  jwtAuthGuard,
  entitlementGuard("NOTIFICATIONS"),
  permissionsGuard("NOTIFICATIONS.ALERTS.VIEW"),
  markAllNotificationsReadHandler,
);

router.get(
  "/notification-preferences",
  jwtAuthGuard,
  entitlementGuard("NOTIFICATIONS"),
  permissionsGuard("NOTIFICATIONS.ALERTS.VIEW"),
  getNotificationPreferencesHandler,
);

router.put(
  "/notification-preferences",
  jwtAuthGuard,
  entitlementGuard("NOTIFICATIONS"),
  permissionsGuard("NOTIFICATIONS.ALERTS.VIEW"),
  updateNotificationPreferencesHandler,
);

export default router;
