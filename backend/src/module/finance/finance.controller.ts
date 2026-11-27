// Finance Controller: Expenses & Receivables.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  createExpenseSchema,
  expenseApproveSchema,
  expenseRejectSchema,
  expensesQuerySchema,
  updateExpenseSchema,
} from "./finance.model";
import {
  approveExpense,
  createExpense,
  getFinanceReceivables,
  listExpenses,
  rejectExpense,
  submitExpense,
  updateExpense,
} from "./finance.service";

function requireAuthTenant(req: Parameters<RequestHandler>[0]) {
  if (!req.auth || !req.auth.tenantId) {
    throw Errors.forbidden("Operation requires an active authenticated tenant workspace.");
  }
  return req.auth;
}

export const listExpensesHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = expensesQuerySchema.parse(req.query);
  const result = await listExpenses(auth, query);
  return sendSuccess(res, result);
};

export const createExpenseHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = createExpenseSchema.parse(req.body);
  const result = await createExpense(auth, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const updateExpenseHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = updateExpenseSchema.parse(req.body);
  const result = await updateExpense(auth, req.params.id as string, input, req.requestId);
  return sendSuccess(res, result);
};

export const submitExpenseHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await submitExpense(auth, req.params.id as string, req.requestId);
  return sendSuccess(res, result);
};

export const approveExpenseHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = expenseApproveSchema.parse(req.body ?? {});
  const result = await approveExpense(auth, req.params.id as string, input, req.requestId);
  return sendSuccess(res, result);
};

export const rejectExpenseHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = expenseRejectSchema.parse(req.body ?? {});
  const result = await rejectExpense(auth, req.params.id as string, input, req.requestId);
  return sendSuccess(res, result);
};

export const getFinanceReceivablesHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await getFinanceReceivables(auth.tenantId!);
  return sendSuccess(res, result);
};
