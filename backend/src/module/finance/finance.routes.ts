// Finance Routes: /api/v1/finance/*
// 3-Layer Security: JwtAuthGuard -> EntitlementGuard("FINANCE") -> PermissionsGuard + IdempotencyGuard
import { Router } from "express";
import {
  entitlementGuard,
  idempotencyGuard,
  jwtAuthGuard,
  permissionsGuard,
} from "../../middlewares/guards";
import {
  approveExpenseHandler,
  createExpenseHandler,
  getFinanceReceivablesHandler,
  listExpensesHandler,
  rejectExpenseHandler,
  submitExpenseHandler,
} from "./finance.controller";

const router = Router();

router.get(
  "/expenses",
  jwtAuthGuard,
  entitlementGuard("FINANCE"),
  permissionsGuard("FINANCE.EXPENSES.VIEW", "FINANCE.EXPENSES.VIEW_ALL"),
  listExpensesHandler,
);

router.post(
  "/expenses",
  jwtAuthGuard,
  entitlementGuard("FINANCE"),
  permissionsGuard("FINANCE.EXPENSES.MANAGE"),
  createExpenseHandler,
);

router.post(
  "/expenses/:id/submit",
  jwtAuthGuard,
  entitlementGuard("FINANCE"),
  permissionsGuard("FINANCE.EXPENSES.MANAGE"),
  submitExpenseHandler,
);

router.post(
  "/expenses/:id/approve",
  jwtAuthGuard,
  entitlementGuard("FINANCE"),
  permissionsGuard("FINANCE.EXPENSES.APPROVE"),
  idempotencyGuard,
  approveExpenseHandler,
);

router.post(
  "/expenses/:id/reject",
  jwtAuthGuard,
  entitlementGuard("FINANCE"),
  permissionsGuard("FINANCE.EXPENSES.APPROVE"),
  idempotencyGuard,
  rejectExpenseHandler,
);

router.get(
  "/receivables",
  jwtAuthGuard,
  entitlementGuard("FINANCE"),
  permissionsGuard("FINANCE.RECEIVABLES.VIEW", "FINANCE.INVOICES.VIEW"),
  getFinanceReceivablesHandler,
);

export default router;
