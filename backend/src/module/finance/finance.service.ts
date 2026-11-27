// Finance Service: Expenses (Team Scope, Threshold Workflow, Edit/Resubmit) & Accounts Receivable aging.
import { and, desc, eq, gt, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  approvalRequests,
  crmCustomers,
  financeExpenses,
  notifications,
  salesInvoices,
  tenants,
  users,
  workflowInstanceSteps,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { hasTenantWideScope, resolveRecordScope, type AuthContext } from "../../middlewares/guards";
import type {
  CreateExpenseInput,
  ExpenseApproveInput,
  ExpenseRejectInput,
  ExpensesQuery,
  UpdateExpenseInput,
} from "./finance.model";

async function assertExpenseAccess(auth: AuthContext, expenseId: string) {
  const tenantId = auth.tenantId!;
  const [expense] = await db
    .select()
    .from(financeExpenses)
    .where(and(eq(financeExpenses.id, expenseId), eq(financeExpenses.tenantId, tenantId)))
    .limit(1);

  if (!expense) throw Errors.notFound("Expense not found.");

  const scopeCtx = await resolveRecordScope(
    auth,
    "FINANCE.EXPENSES.VIEW_ALL",
    "FINANCE.EXPENSES.VIEW_TEAM",
  );

  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    const inScope =
      scopeCtx.teamUserIds.includes(expense.ownerUserId) ||
      (expense.departmentId ? scopeCtx.departmentIds.includes(expense.departmentId) : false);
    if (!inScope) {
      throw Errors.forbidden("You do not have access to an expense outside your department/team.");
    }
  } else if (scopeCtx.scope === "OWN_ONLY" && expense.ownerUserId !== auth.userId) {
    throw Errors.forbidden("You do not have access to this expense.");
  }

  return expense;
}

export async function listExpenses(auth: AuthContext, query: ExpensesQuery) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveRecordScope(
    auth,
    "FINANCE.EXPENSES.VIEW_ALL",
    "FINANCE.EXPENSES.VIEW_TEAM",
  );

  const conditions = [eq(financeExpenses.tenantId, tenantId)];

  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    const scopeParts = [inArray(financeExpenses.ownerUserId, scopeCtx.teamUserIds)];
    if (scopeCtx.departmentIds.length > 0) {
      scopeParts.push(inArray(financeExpenses.departmentId, scopeCtx.departmentIds));
    }
    conditions.push(or(...scopeParts)!);
  } else if (scopeCtx.scope === "OWN_ONLY") {
    conditions.push(eq(financeExpenses.ownerUserId, auth.userId));
  }

  const submittedBy = query.submittedBy ?? query.submitted_by;
  if (submittedBy) {
    if (scopeCtx.scope === "TEAM_DEPARTMENT" && !scopeCtx.teamUserIds.includes(submittedBy)) {
      throw Errors.forbidden("Cannot view expenses of users outside your department/team.");
    }
    conditions.push(eq(financeExpenses.ownerUserId, submittedBy));
  }

  if (query.status) conditions.push(eq(financeExpenses.status, query.status));
  if (query.category) conditions.push(eq(financeExpenses.category, query.category));
  if (query.from) conditions.push(gte(financeExpenses.expenseDate, query.from.slice(0, 10)));
  if (query.to) conditions.push(lte(financeExpenses.expenseDate, query.to.slice(0, 10)));

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
    scope: scopeCtx.scope,
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
        branchId: input.branchId ?? auth.branchId ?? null,
        departmentId: input.departmentId ?? auth.departmentId ?? null,
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

export async function updateExpense(
  auth: AuthContext,
  expenseId: string,
  input: UpdateExpenseInput,
  requestId?: string,
) {
  const existing = await assertExpenseAccess(auth, expenseId);
  if (existing.ownerUserId !== auth.userId && !hasTenantWideScope(auth, "FINANCE.EXPENSES.VIEW_ALL")) {
    throw Errors.forbidden("Only the owner of this expense can edit it.");
  }
  if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
    throw Errors.conflict("Only DRAFT or REJECTED expenses can be edited.");
  }

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(financeExpenses)
      .set({
        ...(input.category !== undefined && { category: input.category }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.amount !== undefined && { amount: input.amount.toFixed(2) }),
        ...(input.expenseDate !== undefined && { expenseDate: input.expenseDate }),
        ...(input.receiptDocumentId !== undefined && { receiptDocumentId: input.receiptDocumentId }),
        status: "DRAFT",
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(and(eq(financeExpenses.id, expenseId), eq(financeExpenses.tenantId, auth.tenantId!)))
      .returning();

    await writeAudit(tx, {
      tenantId: auth.tenantId!,
      actorUserId: auth.userId,
      action: "FINANCE.EXPENSE.UPDATE",
      entityType: "finance_expense",
      entityId: expenseId,
      beforeData: { amount: existing.amount, category: existing.category, status: existing.status },
      afterData: { amount: rows[0].amount, category: rows[0].category, status: rows[0].status },
      requestId,
    });

    return rows;
  });

  return {
    expense: {
      ...updated,
      amount: Number(updated.amount),
      currency: updated.currency.trim(),
    },
  };
}

export async function submitExpense(
  auth: AuthContext,
  expenseId: string,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const expense = await assertExpenseAccess(auth, expenseId);

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

    // Put in Manager / Business Owner Approval Inbox queue + initial workflow step
    const [approval] = await tx
      .insert(approvalRequests)
      .values({
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
        currentStage: "MANAGER_REVIEW",
      })
      .returning();

    await tx.insert(workflowInstanceSteps).values({
      tenantId,
      approvalRequestId: approval.id,
      stepNumber: 1,
      stepName: "SUBMISSION",
      action: "SUBMITTED",
      actorUserId: auth.userId,
      comment: "Expense submitted for manager review",
      decidedAt: now,
    });

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "FINANCE.EXPENSE.SUBMIT",
      entityType: "finance_expense",
      entityId: expenseId,
      beforeData: { status: expense.status },
      afterData: { status: "SUBMITTED", approvalRequestId: approval.id },
      requestId,
    });

    return rows;
  });

  return { expense: updated, message: "Expense submitted for approval." };
}

// Expense Threshold Workflow (Rule #2 for Manager):
// - If amount <= tenant.expenseApprovalThreshold (or actor has OWNER / ADMIN / FINANCE.EXPENSES.APPROVE_FINAL): APPROVED directly!
// - If amount > threshold and actor is Manager: transitions to PENDING_FINANCE for Finance/Owner final review!
export async function approveExpense(
  auth: AuthContext,
  expenseId: string,
  input: ExpenseApproveInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const expense = await assertExpenseAccess(auth, expenseId);

  if (expense.status === "APPROVED" || expense.status === "PAID") {
    throw Errors.conflict(`Expense is already ${expense.status}.`);
  }

  const [tenant] = await db
    .select({ expenseApprovalThreshold: tenants.expenseApprovalThreshold })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const threshold = Number(tenant?.expenseApprovalThreshold ?? 5000);
  const expenseAmount = Number(expense.amount);

  const hasFinalAuthority =
    auth.permissions.includes("*") ||
    auth.roles.includes("OWNER") ||
    auth.roles.includes("ADMIN") ||
    auth.permissions.includes("FINANCE.EXPENSES.APPROVE_FINAL");

  const requiresFinanceEscalation = !hasFinalAuthority && expenseAmount > threshold;

  const nextExpenseStatus = requiresFinanceEscalation ? "PENDING_FINANCE" : "APPROVED";
  const now = new Date();

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(financeExpenses)
      .set({
        status: nextExpenseStatus,
        approvedBy: requiresFinanceEscalation ? expense.approvedBy : auth.userId,
        approvedAt: requiresFinanceEscalation ? expense.approvedAt : now,
        updatedAt: now,
      })
      .where(eq(financeExpenses.id, expenseId))
      .returning();

    const [pendingApproval] = await tx
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.tenantId, tenantId),
          eq(approvalRequests.entityType, "EXPENSE"),
          eq(approvalRequests.entityId, expenseId),
          eq(approvalRequests.status, "PENDING"),
        ),
      )
      .limit(1);

    if (pendingApproval) {
      await tx
        .update(approvalRequests)
        .set({
          status: requiresFinanceEscalation ? "PENDING" : "APPROVED",
          currentStage: requiresFinanceEscalation ? "FINANCE_REVIEW" : "COMPLETED",
          decisionComment: input.comment ?? null,
          decidedBy: requiresFinanceEscalation ? null : auth.userId,
          decidedAt: requiresFinanceEscalation ? null : now,
          updatedAt: now,
        })
        .where(eq(approvalRequests.id, pendingApproval.id));

      const [{ count: stepsCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowInstanceSteps)
        .where(eq(workflowInstanceSteps.approvalRequestId, pendingApproval.id));

      await tx.insert(workflowInstanceSteps).values({
        tenantId,
        approvalRequestId: pendingApproval.id,
        stepNumber: (stepsCount ?? 0) + 1,
        stepName: pendingApproval.currentStage || "MANAGER_REVIEW",
        action: requiresFinanceEscalation ? "FORWARDED_TO_FINANCE" : "APPROVED",
        actorUserId: auth.userId,
        comment:
          input.comment ??
          (requiresFinanceEscalation
            ? `Manager approved. Amount (${expenseAmount}) exceeds threshold (${threshold}); escalated to Finance.`
            : "Approved"),
        decidedAt: now,
      });
    }

    await tx.insert(notifications).values({
      tenantId,
      userId: expense.ownerUserId,
      category: "FINANCE",
      title: requiresFinanceEscalation
        ? `Expense ${expense.expenseNo} Forwarded to Finance`
        : `Expense ${expense.expenseNo} Approved`,
      message: requiresFinanceEscalation
        ? `Your expense (${expense.expenseNo}) of ${expenseAmount} ${expense.currency.trim()} passed Manager review and was forwarded to Finance/Accountant (exceeds threshold ${threshold}).`
        : `Your expense claim (${expense.expenseNo}) of ${expenseAmount} ${expense.currency.trim()} has been approved.`,
      entityType: "EXPENSE",
      entityId: expenseId,
    });

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: requiresFinanceEscalation
        ? "FINANCE.EXPENSE.FORWARD_FINANCE"
        : "FINANCE.EXPENSE.APPROVE",
      entityType: "finance_expense",
      entityId: expenseId,
      beforeData: { status: expense.status },
      afterData: {
        status: nextExpenseStatus,
        threshold,
        expenseAmount,
        actorUserId: auth.userId,
      },
      reason: input.comment,
      requestId,
    });

    return rows;
  });

  return {
    expense: {
      ...updated,
      amount: Number(updated.amount),
      currency: updated.currency.trim(),
    },
    escalatedToFinance: requiresFinanceEscalation,
    message: requiresFinanceEscalation
      ? `Manager approved. Amount exceeds company threshold (${threshold}), so forwarded to Finance approval queue.`
      : "Expense approved successfully.",
  };
}

export async function rejectExpense(
  auth: AuthContext,
  expenseId: string,
  input: ExpenseRejectInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const expense = await assertExpenseAccess(auth, expenseId);

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

    const [pendingApproval] = await tx
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.tenantId, tenantId),
          eq(approvalRequests.entityType, "EXPENSE"),
          eq(approvalRequests.entityId, expenseId),
          eq(approvalRequests.status, "PENDING"),
        ),
      )
      .limit(1);

    if (pendingApproval) {
      await tx
        .update(approvalRequests)
        .set({
          status: "REJECTED",
          currentStage: "COMPLETED",
          decisionComment: input.reason,
          decidedBy: auth.userId,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(approvalRequests.id, pendingApproval.id));

      const [{ count: stepsCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowInstanceSteps)
        .where(eq(workflowInstanceSteps.approvalRequestId, pendingApproval.id));

      await tx.insert(workflowInstanceSteps).values({
        tenantId,
        approvalRequestId: pendingApproval.id,
        stepNumber: (stepsCount ?? 0) + 1,
        stepName: pendingApproval.currentStage || "MANAGER_REVIEW",
        action: "REJECTED",
        actorUserId: auth.userId,
        comment: input.reason,
        decidedAt: now,
      });
    }

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
