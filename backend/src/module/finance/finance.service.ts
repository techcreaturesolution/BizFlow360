// Finance Service: Expenses workflow (create, submit, approve, reject) & Accounts Receivable aging.
import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  approvalRequests,
  crmCustomers,
  financeExpenses,
  notifications,
  salesInvoices,
  tenants,
  users,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { hasTenantWideScope, type AuthContext } from "../../middlewares/guards";
import type {
  CreateExpenseInput,
  ExpenseApproveInput,
  ExpenseRejectInput,
  ExpensesQuery,
} from "./finance.model";

export async function listExpenses(auth: AuthContext, query: ExpensesQuery) {
  const tenantId = auth.tenantId!;
  const isCompanyWide = hasTenantWideScope(auth, "FINANCE.EXPENSES.VIEW_ALL");
  const conditions = [eq(financeExpenses.tenantId, tenantId)];

  if (!isCompanyWide) {
    conditions.push(eq(financeExpenses.ownerUserId, auth.userId));
  }
  if (query.status) conditions.push(eq(financeExpenses.status, query.status));
  if (query.category) conditions.push(eq(financeExpenses.category, query.category));

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(financeExpenses).where(and(...conditions)),
    db
      .select({
        expense: financeExpenses,
        ownerName: users.fullName,
      })
      .from(financeExpenses)
      .leftJoin(users, eq(users.id, financeExpenses.ownerUserId))
      .where(and(...conditions))
      .orderBy(desc(financeExpenses.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    scope: isCompanyWide ? "COMPANY_WIDE" : "OWN_ONLY",
    expenses: rows.map((r) => ({
      ...r.expense,
      ownerName: r.ownerName ?? null,
      amount: Number(r.expense.amount),
      currency: r.expense.currency.trim(),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createExpense(
  auth: AuthContext,
  input: CreateExpenseInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const [tenant] = await db
    .select({ defaultCurrency: tenants.defaultCurrency })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const expenseNo = `EXP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(financeExpenses)
      .values({
        tenantId,
        expenseNo,
        category: input.category,
        description: input.description,
        amount: input.amount.toFixed(2),
        currency: tenant?.defaultCurrency.trim() ?? "INR",
        expenseDate: input.expenseDate,
        receiptDocumentId: input.receiptDocumentId ?? null,
        status: "DRAFT",
        ownerUserId: auth.userId,
        branchId: input.branchId ?? null,
        departmentId: input.departmentId ?? null,
      })
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "FINANCE.EXPENSE.CREATE",
      entityType: "finance_expense",
      entityId: rows[0].id,
      afterData: { expenseNo, category: input.category, amount: input.amount },
      requestId,
    });

    return rows;
  });

  return {
    expense: {
      ...created,
      amount: Number(created.amount),
      currency: created.currency.trim(),
    },
  };
}

export async function submitExpense(
  auth: AuthContext,
  expenseId: string,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const [expense] = await db
    .select()
    .from(financeExpenses)
    .where(and(eq(financeExpenses.id, expenseId), eq(financeExpenses.tenantId, tenantId)))
    .limit(1);

  if (!expense) throw Errors.notFound("Expense not found.");
  if (expense.status !== "DRAFT" && expense.status !== "REJECTED") {
    throw Errors.conflict(`Expense is already ${expense.status}.`);
  }

  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(financeExpenses)
      .set({ status: "SUBMITTED", submittedAt: now, updatedAt: now })
      .where(eq(financeExpenses.id, expenseId))
      .returning();

    // Put in Business Owner / Approver Inbox queue
    await tx.insert(approvalRequests).values({
      tenantId,
      entityType: "EXPENSE",
      entityId: expenseId,
      entityNumber: expense.expenseNo,
      title: `${expense.category}: ${expense.description.slice(0, 80)}`,
      amount: expense.amount,
      currency: expense.currency.trim(),
      requestedBy: expense.ownerUserId,
      branchId: expense.branchId,
      departmentId: expense.departmentId,
      status: "PENDING",
    });

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "FINANCE.EXPENSE.SUBMIT",
      entityType: "finance_expense",
      entityId: expenseId,
      beforeData: { status: expense.status },
      afterData: { status: "SUBMITTED" },
      requestId,
    });

    return rows;
  });

  return { expense: updated, message: "Expense submitted for approval." };
}

export async function approveExpense(
  auth: AuthContext,
  expenseId: string,
  input: ExpenseApproveInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const [expense] = await db
    .select()
    .from(financeExpenses)
    .where(and(eq(financeExpenses.id, expenseId), eq(financeExpenses.tenantId, tenantId)))
    .limit(1);

  if (!expense) throw Errors.notFound("Expense not found.");
  if (expense.status === "APPROVED" || expense.status === "PAID") {
    throw Errors.conflict(`Expense is already ${expense.status}.`);
  }

  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(financeExpenses)
      .set({
        status: "APPROVED",
        approvedBy: auth.userId,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(financeExpenses.id, expenseId))
      .returning();

    await tx
      .update(approvalRequests)
      .set({
        status: "APPROVED",
        decisionComment: input.comment ?? null,
        decidedBy: auth.userId,
        decidedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(approvalRequests.tenantId, tenantId),
          eq(approvalRequests.entityType, "EXPENSE"),
          eq(approvalRequests.entityId, expenseId),
          eq(approvalRequests.status, "PENDING"),
        ),
      );

    await tx.insert(notifications).values({
      tenantId,
      userId: expense.ownerUserId,
      category: "FINANCE",
      title: `Expense ${expense.expenseNo} Approved`,
      message: `Your expense claim (${expense.expenseNo}) of ${expense.amount} ${expense.currency.trim()} has been approved.`,
      entityType: "EXPENSE",
      entityId: expenseId,
    });

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "FINANCE.EXPENSE.APPROVE",
      entityType: "finance_expense",
      entityId: expenseId,
      beforeData: { status: expense.status },
      afterData: { status: "APPROVED", approvedBy: auth.userId },
      reason: input.comment,
      requestId,
    });

    return rows;
  });

  return { expense: updated, message: "Expense approved successfully." };
}

export async function rejectExpense(
  auth: AuthContext,
  expenseId: string,
  input: ExpenseRejectInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const [expense] = await db
    .select()
    .from(financeExpenses)
    .where(and(eq(financeExpenses.id, expenseId), eq(financeExpenses.tenantId, tenantId)))
    .limit(1);

  if (!expense) throw Errors.notFound("Expense not found.");
  if (expense.status === "APPROVED" || expense.status === "PAID") {
    throw Errors.conflict("Approved/paid expense cannot be rejected.");
  }

  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(financeExpenses)
      .set({
        status: "REJECTED",
        rejectionReason: input.reason,
        approvedBy: auth.userId,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(financeExpenses.id, expenseId))
      .returning();

    await tx
      .update(approvalRequests)
      .set({
        status: "REJECTED",
        decisionComment: input.reason,
        decidedBy: auth.userId,
        decidedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(approvalRequests.tenantId, tenantId),
          eq(approvalRequests.entityType, "EXPENSE"),
          eq(approvalRequests.entityId, expenseId),
          eq(approvalRequests.status, "PENDING"),
        ),
      );

    await tx.insert(notifications).values({
      tenantId,
      userId: expense.ownerUserId,
      category: "FINANCE",
      title: `Expense ${expense.expenseNo} Rejected`,
      message: `Your expense claim (${expense.expenseNo}) was rejected. Reason: ${input.reason}`,
      entityType: "EXPENSE",
      entityId: expenseId,
    });

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "FINANCE.EXPENSE.REJECT",
      entityType: "finance_expense",
      entityId: expenseId,
      beforeData: { status: expense.status },
      afterData: { status: "REJECTED", reason: input.reason },
      reason: input.reason,
      requestId,
    });

    return rows;
  });

  return { expense: updated, message: "Expense rejected." };
}

export async function getFinanceReceivables(tenantId: string) {
  const openInvoices = await db
    .select({
      invoice: salesInvoices,
      customerName: crmCustomers.name,
    })
    .from(salesInvoices)
    .leftJoin(crmCustomers, eq(crmCustomers.id, salesInvoices.customerId))
    .where(
      and(
        eq(salesInvoices.tenantId, tenantId),
        gt(salesInvoices.balanceDue, "0.00"),
        or(
          eq(salesInvoices.status, "ISSUED"),
          eq(salesInvoices.status, "PARTIALLY_PAID"),
          eq(salesInvoices.status, "OVERDUE"),
        ),
      ),
    )
    .orderBy(salesInvoices.dueDate);

  const today = new Date();
  let totalReceivable = 0;
  let overdueAmount = 0;
  let currentAmount = 0;

  const agingBuckets = {
    current: 0,
    days1To30: 0,
    days31To60: 0,
    days61To90: 0,
    days90Plus: 0,
  };

  const items = openInvoices.map((r) => {
    const balance = Number(r.invoice.balanceDue);
    const due = new Date(r.invoice.dueDate);
    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

    totalReceivable += balance;
    if (daysOverdue > 0) {
      overdueAmount += balance;
      if (daysOverdue <= 30) agingBuckets.days1To30 += balance;
      else if (daysOverdue <= 60) agingBuckets.days31To60 += balance;
      else if (daysOverdue <= 90) agingBuckets.days61To90 += balance;
      else agingBuckets.days90Plus += balance;
    } else {
      currentAmount += balance;
      agingBuckets.current += balance;
    }

    return {
      invoiceId: r.invoice.id,
      invoiceNo: r.invoice.invoiceNo,
      customerId: r.invoice.customerId,
      customerName: r.customerName ?? null,
      dueDate: r.invoice.dueDate,
      daysOverdue: Math.max(0, daysOverdue),
      grandTotal: Number(r.invoice.grandTotal),
      paidAmount: Number(r.invoice.paidAmount),
      balanceDue: balance,
      currency: r.invoice.currency.trim(),
      status: r.invoice.status,
    };
  });

  return {
    summary: {
      totalReceivable: Number(totalReceivable.toFixed(2)),
      currentAmount: Number(currentAmount.toFixed(2)),
      overdueAmount: Number(overdueAmount.toFixed(2)),
      openInvoicesCount: items.length,
    },
    agingBuckets: {
      current: Number(agingBuckets.current.toFixed(2)),
      days1To30: Number(agingBuckets.days1To30.toFixed(2)),
      days31To60: Number(agingBuckets.days31To60.toFixed(2)),
      days61To90: Number(agingBuckets.days61To90.toFixed(2)),
      days90Plus: Number(agingBuckets.days90Plus.toFixed(2)),
    },
    receivables: items,
  };
}
