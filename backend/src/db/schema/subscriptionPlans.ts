// Subscription plans table: SaaS plans, pricing, quotas aur versioning ke liye.
import {
  boolean,
  char,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const BILLING_INTERVALS = ["MONTHLY", "ANNUAL"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
export const billingIntervalEnum = pgEnum("billing_interval", BILLING_INTERVALS);

export interface PlanQuotas {
  max_seats: number;
  max_storage_mb: number;
  api_rate_limit: number;
}

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 60 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  billingInterval: billingIntervalEnum("billing_interval").notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("INR"),
  trialDays: integer("trial_days").notNull().default(0),
  version: integer("version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  quotas: jsonb("quotas").$type<PlanQuotas>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
