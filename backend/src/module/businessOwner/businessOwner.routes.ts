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
  createRoleHandler,
  getRolesHandler,
  getTeamMembersHandler,
  inviteMemberHandler,
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

export default router;
