// CRM Routes: /api/v1/crm/*
// 3-Layer Security: JwtAuthGuard -> EntitlementGuard("CRM") -> PermissionsGuard + Record Scope
import { Router } from "express";
import {
  entitlementGuard,
  idempotencyGuard,
  jwtAuthGuard,
  permissionsGuard,
} from "../../middlewares/guards";
import {
  addLeadActivityHandler,
  addLeadFollowupHandler,
  assignLeadHandler,
  convertLeadHandler,
  createCustomerHandler,
  createLeadHandler,
  getCrmPipelineHandler,
  getCustomerDetailHandler,
  getLeadDetailHandler,
  importLeadsHandler,
  listCustomersHandler,
  listLeadsHandler,
  updateFollowupHandler,
  updateLeadHandler,
} from "./crm.controller";

const router = Router();

// Pipeline overview
router.get(
  "/pipeline",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.VIEW", "CRM.LEADS.VIEW_TEAM", "CRM.LEADS.VIEW_ALL"),
  getCrmPipelineHandler,
);

// Leads CRUD, import & workflow
router.get(
  "/leads",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.VIEW", "CRM.LEADS.VIEW_TEAM", "CRM.LEADS.VIEW_ALL"),
  listLeadsHandler,
);

router.post(
  "/import",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.MANAGE"),
  idempotencyGuard,
  importLeadsHandler,
);

router.post(
  "/leads",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.MANAGE"),
  createLeadHandler,
);

router.get(
  "/leads/:id",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.VIEW", "CRM.LEADS.VIEW_TEAM", "CRM.LEADS.VIEW_ALL"),
  getLeadDetailHandler,
);

router.patch(
  "/leads/:id",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.MANAGE"),
  updateLeadHandler,
);

router.post(
  "/leads/:id/assign",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.MANAGE"),
  assignLeadHandler,
);

router.post(
  "/leads/:id/activities",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.MANAGE"),
  addLeadActivityHandler,
);

router.post(
  "/leads/:id/followups",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.MANAGE"),
  addLeadFollowupHandler,
);

router.post(
  "/leads/:id/convert",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.MANAGE"),
  idempotencyGuard,
  convertLeadHandler,
);

router.patch(
  "/followups/:id",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.LEADS.MANAGE"),
  updateFollowupHandler,
);

// Customers CRUD
router.get(
  "/customers",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard(
    "CRM.CUSTOMERS.VIEW",
    "CRM.CUSTOMERS.VIEW_TEAM",
    "CRM.LEADS.VIEW_TEAM",
    "CRM.LEADS.VIEW_ALL",
  ),
  listCustomersHandler,
);

router.post(
  "/customers",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard("CRM.CUSTOMERS.MANAGE"),
  createCustomerHandler,
);

router.get(
  "/customers/:id",
  jwtAuthGuard,
  entitlementGuard("CRM"),
  permissionsGuard(
    "CRM.CUSTOMERS.VIEW",
    "CRM.CUSTOMERS.VIEW_TEAM",
    "CRM.LEADS.VIEW_TEAM",
    "CRM.LEADS.VIEW_ALL",
  ),
  getCustomerDetailHandler,
);

export default router;
