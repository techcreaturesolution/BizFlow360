// Payment transactions table: gateway webhooks, manual settlements aur failed payments.
import {
  char,
  index,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subscriptionInvoices } from "./subscriptionInvoices";
import { tenants } from "./tenants";

export const PAYMENT_STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => subscriptionInvoices.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 60 }).notNull(),
    providerEventId: varchar("provider_event_id", { length: 200 }).unique(),
    providerPaymentId: varchar("provider_payment_id", { length: 200 }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    status: varchar("status", { length: 30 }).notNull(),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payment_transactions_tenant_id_idx").on(table.tenantId),
    index("payment_transactions_status_idx").on(table.status),
    index("payment_transactions_provider_idx").on(table.provider),
  ],
);
