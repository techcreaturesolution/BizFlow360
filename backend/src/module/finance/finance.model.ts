// Finance Module validation schemas: Expenses & Receivables.
import { z } from "zod";
import { EXPENSE_STATUSES } from "../../db/schema";

export const expensesQuerySchema = z.object({
  status: z.enum(EXPENSE_STATUSES).optional(),
  category: z.string().trim().optional(),
  submittedBy: z.string().uuid().optional(),
  submitted_by: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createExpenseSchema = z.object({
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(1000),
  amount: z.coerce.number().positive("Expense amount 0 se bada hona chahiye"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein"),
  receiptDocumentId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseRejectSchema = z.object({
  reason: z.string().trim().min(2, "Reject karne ke liye reason dalein").max(500),
});

export const expenseApproveSchema = z.object({
  comment: z.string().trim().max(500).optional(),
});

export type ExpensesQuery = z.infer<typeof expensesQuerySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseRejectInput = z.infer<typeof expenseRejectSchema>;
export type ExpenseApproveInput = z.infer<typeof expenseApproveSchema>;
