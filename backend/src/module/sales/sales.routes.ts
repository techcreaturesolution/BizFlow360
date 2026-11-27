// Sales Routes: /api/v1/sales/*
// 3-Layer Security: JwtAuthGuard -> EntitlementGuard("SALES") -> PermissionsGuard + IdempotencyGuard
import { Router } from "express";
import {
  entitlementGuard,
  idempotencyGuard,
  jwtAuthGuard,
  permissionsGuard,
} from "../../middlewares/guards";
import {
  approveQuotationHandler,
  convertQuotationToOrderHandler,
  createOrderHandler,
  createProductHandler,
  createQuotationHandler,
  createSalesInvoiceHandler,
  getQuotationDetailHandler,
  getSalesInvoiceDetailHandler,
  listOrdersHandler,
  listProductsHandler,
  listQuotationsHandler,
  listSalesInvoicesHandler,
  recordInvoicePaymentHandler,
  sendQuotationHandler,
  updateProductHandler,
} from "./sales.controller";

const router = Router();

// 1. Catalogue (Products)
router.get(
  "/products",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("SALES.PRODUCTS.VIEW"),
  listProductsHandler,
);

router.post(
  "/products",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("SALES.PRODUCTS.MANAGE"),
  createProductHandler,
);

router.patch(
  "/products/:id",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("SALES.PRODUCTS.MANAGE"),
  updateProductHandler,
);

// 2. Quotations
router.get(
  "/quotations",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("SALES.QUOTATIONS.VIEW", "SALES.QUOTATIONS.VIEW_TEAM", "SALES.QUOTATIONS.VIEW_ALL"),
  listQuotationsHandler,
);

router.post(
  "/quotations",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("SALES.QUOTATIONS.MANAGE"),
  createQuotationHandler,
);

router.get(
  "/quotations/:id",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("SALES.QUOTATIONS.VIEW", "SALES.QUOTATIONS.VIEW_TEAM", "SALES.QUOTATIONS.VIEW_ALL"),
  getQuotationDetailHandler,
);

router.post(
  "/quotations/:id/approve",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("SALES.QUOTATIONS.APPROVE"),
  idempotencyGuard,
  approveQuotationHandler,
);

router.post(
  "/quotations/:id/send",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("SALES.QUOTATIONS.MANAGE"),
  sendQuotationHandler,
);

router.post(
  "/quotations/:id/convert-order",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("SALES.QUOTATIONS.MANAGE", "SALES.ORDERS.MANAGE"),
  idempotencyGuard,
  convertQuotationToOrderHandler,
);

// 3. Orders
router.get(
  "/orders",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard(
    "SALES.ORDERS.VIEW",
    "SALES.ORDERS.VIEW_TEAM",
    "SALES.QUOTATIONS.VIEW_TEAM",
    "SALES.QUOTATIONS.VIEW_ALL",
  ),
  listOrdersHandler,
);

router.post(
  "/orders",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("SALES.ORDERS.MANAGE"),
  createOrderHandler,
);

// 4. Invoices & Payments
router.get(
  "/invoices",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard(
    "FINANCE.INVOICES.VIEW",
    "SALES.QUOTATIONS.VIEW_TEAM",
    "SALES.QUOTATIONS.VIEW_ALL",
  ),
  listSalesInvoicesHandler,
);

router.post(
  "/invoices",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("FINANCE.INVOICES.MANAGE"),
  createSalesInvoiceHandler,
);

router.get(
  "/invoices/:id",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard(
    "FINANCE.INVOICES.VIEW",
    "SALES.QUOTATIONS.VIEW_TEAM",
    "SALES.QUOTATIONS.VIEW_ALL",
  ),
  getSalesInvoiceDetailHandler,
);

router.post(
  "/invoices/:id/payments",
  jwtAuthGuard,
  entitlementGuard("SALES"),
  permissionsGuard("FINANCE.INVOICES.MANAGE"),
  idempotencyGuard,
  recordInvoicePaymentHandler,
);

export default router;
