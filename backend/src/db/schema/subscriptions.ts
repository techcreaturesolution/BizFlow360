// Subscriptions table: tenant ka active plan, billing cycle, trial aur gateway refs.
import { boolean, index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { subscriptionPlans } from "./subscriptionPlans";
import { tenants } from "./tenants";

export const SUBSCRIPTION_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "GRACE",
  "SUSPENDED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const subscriptionStatusEnum = pgEnum("subscription_status", SUBSCRIPTION_STATUSES);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("TRIAL"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    providerCustomerRef: varchar("provider_customer_ref", { length: 160 }),
    providerSubscriptionRef: varchar("provider_subscription_ref", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("subscriptions_tenant_id_idx").on(table.tenantId),
    index("subscriptions_plan_id_idx").on(table.planId),
    index("subscriptions_status_idx").on(table.status),
  ],
);
