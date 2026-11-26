// Subscription invoices table: har tenant ki billing invoices aur tax details.
import {
  char,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";
import { tenants } from "./tenants";

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "OVERDUE", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const invoiceStatusEnum = pgEnum("invoice_status", INVOICE_STATUSES);

export const subscriptionInvoices = pgTable(
  "subscription_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    invoiceNo: varchar("invoice_no", { length: 100 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    tax: numeric("tax", { precision: 14, scale: 2 }).notNull().default("0.00"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    status: invoiceStatusEnum("status").notNull().default("ISSUED"),
    dueDate: date("due_date").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("subscription_invoices_tenant_id_idx").on(table.tenantId),
    index("subscription_invoices_subscription_id_idx").on(table.subscriptionId),
    index("subscription_invoices_status_idx").on(table.status),
    uniqueIndex("subscription_invoices_tenant_invoice_uidx").on(
      table.tenantId,
      table.invoiceNo,
    ),
  ],
);
