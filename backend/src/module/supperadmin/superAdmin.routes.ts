// Platform Super Admin routes: /api/v1/platform/* (sirf SUPER_ADMIN access kar sakta hai).
import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/authantication";
import { getAuditLogDetailHandler, listAuditLogsHandler } from "./auditLogs.controller";
import {
  adjustSubscriptionHandler,
  getInvoiceDetailHandler,
  listInvoicesHandler,
  listPaymentsHandler,
  listSubscriptionsHandler,
} from "./billing.controller";
import {
  createPlanHandler,
  getPlanDetailHandler,
  listPlansHandler,
  updatePlanHandler,
  updatePlanStatusHandler,
} from "./plans.controller";
import {
  createTenantHandler,
  getDashboardHandler,
  getTenantDetailHandler,
  getTenantEntitlementsHandler,
  listTenantsHandler,
  updateTenantEntitlementsHandler,
  updateTenantHandler,
  updateTenantStatusHandler,
} from "./superAdmin.controller";

const router = Router();

router.use(authenticate, authorize("SUPER_ADMIN"));

router.get("/dashboard", getDashboardHandler);
router.get("/plans", listPlansHandler);
router.post("/plans", createPlanHandler);
router.get("/plans/:id", getPlanDetailHandler);
router.put("/plans/:id", updatePlanHandler);
router.patch("/plans/:id/status", updatePlanStatusHandler);
router.get("/tenants", listTenantsHandler);
router.post("/tenants", createTenantHandler);
router.get("/tenants/:id", getTenantDetailHandler);
router.patch("/tenants/:id", updateTenantHandler);
router.post("/tenants/:id/status", updateTenantStatusHandler);
router.get("/tenants/:id/entitlements", getTenantEntitlementsHandler);
router.put("/tenants/:id/entitlements", updateTenantEntitlementsHandler);
router.get("/subscriptions", listSubscriptionsHandler);
router.post("/subscriptions/:id/adjust", adjustSubscriptionHandler);
router.get("/invoices", listInvoicesHandler);
router.get("/invoices/:id", getInvoiceDetailHandler);
router.get("/payments", listPaymentsHandler);
router.get("/audit-logs", listAuditLogsHandler);
router.get("/audit-logs/:id", getAuditLogDetailHandler);

export default router;
