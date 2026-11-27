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
  updateExpenseHandler,
} from "./finance.controller";

const router = Router();

router.get(
  "/expenses",
  jwtAuthGuard,
  entitlementGuard("FINANCE"),
  permissionsGuard("FINANCE.EXPENSES.VIEW", "FINANCE.EXPENSES.VIEW_TEAM", "FINANCE.EXPENSES.VIEW_ALL"),
  listExpensesHandler,
);

router.post(
  "/expenses",
  jwtAuthGuard,
  entitlementGuard("FINANCE"),
  permissionsGuard("FINANCE.EXPENSES.MANAGE"),
  createExpenseHandler,
);

router.patch(
  "/expenses/:id",
  jwtAuthGuard,
  entitlementGuard("FINANCE"),
  permissionsGuard("FINANCE.EXPENSES.MANAGE"),
  updateExpenseHandler,
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
