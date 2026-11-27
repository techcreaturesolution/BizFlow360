// Finance schema: Expenses tracking & approval lifecycle.
import {
  char,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const EXPENSE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_FINANCE",
  "APPROVED",
  "REJECTED",
  "PAID",
] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const financeExpenses = pgTable(
  "finance_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    expenseNo: varchar("expense_no", { length: 80 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    expenseDate: date("expense_date").notNull(),
    receiptDocumentId: uuid("receipt_document_id"),
    status: varchar("status", { length: 20 }).$type<ExpenseStatus>().notNull().default("DRAFT"),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    branchId: uuid("branch_id"),
    departmentId: uuid("department_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("finance_expenses_tenant_id_idx").on(table.tenantId),
    index("finance_expenses_owner_idx").on(table.ownerUserId),
    index("finance_expenses_status_idx").on(table.status),
    uniqueIndex("finance_expenses_tenant_no_uidx").on(table.tenantId, table.expenseNo),
  ],
);
