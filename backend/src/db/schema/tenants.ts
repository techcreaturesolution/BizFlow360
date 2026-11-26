// Tenants table: company core record, status lifecycle aur plan assignment.
import { char, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const TENANT_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "GRACE",
  "SUSPENDED",
  "CANCELLED",
  "ARCHIVED",
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const tenantStatusEnum = pgEnum("tenant_status", TENANT_STATUSES);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  status: tenantStatusEnum("status").notNull().default("TRIAL"),
  timezone: varchar("timezone", { length: 80 }).notNull().default("Asia/Kolkata"),
  defaultCurrency: char("default_currency", { length: 3 }).notNull().default("INR"),
  planId: uuid("plan_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
