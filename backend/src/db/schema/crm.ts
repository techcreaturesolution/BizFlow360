// CRM schema: Leads, Lead Activities, Lead Followups, Customers.
import {
  char,
  index,
  integer,
  jsonb,
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

export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ACTIVITY_TYPES = [
  "NOTE",
  "CALL",
  "EMAIL",
  "MEETING",
  "STAGE_CHANGE",
  "ASSIGNMENT",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const FOLLOWUP_STATUSES = ["PENDING", "COMPLETED", "CANCELLED", "MISSED"] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export const CUSTOMER_TYPES = ["B2B", "B2C", "ENTERPRISE", "PARTNER"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const crmCustomers = pgTable(
  "crm_customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerCode: varchar("customer_code", { length: 60 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    customerType: varchar("customer_type", { length: 30 }).$type<CustomerType>().notNull().default("B2B"),
    email: text("email"),
    phone: text("phone"),
    taxId: varchar("tax_id", { length: 100 }),
    paymentTermsDays: integer("payment_terms_days").notNull().default(30),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }).notNull().default("0.00"),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    billingAddress: jsonb("billing_address").$type<Record<string, unknown>>(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("crm_customers_tenant_id_idx").on(table.tenantId),
    index("crm_customers_owner_idx").on(table.ownerUserId),
    uniqueIndex("crm_customers_tenant_code_uidx").on(table.tenantId, table.customerCode),
  ],
);

export const crmLeads = pgTable(
  "crm_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    companyName: varchar("company_name", { length: 200 }),
    email: text("email"),
    phone: text("phone"),
    source: varchar("source", { length: 80 }),
    stage: varchar("stage", { length: 30 }).$type<LeadStage>().notNull().default("NEW"),
    priority: varchar("priority", { length: 20 }).$type<Priority>().notNull().default("MEDIUM"),
    estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }).notNull().default("0.00"),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    nextFollowupAt: timestamp("next_followup_at", { withTimezone: true }),
    notes: text("notes"),
    convertedCustomerId: uuid("converted_customer_id").references(() => crmCustomers.id, {
      onDelete: "set null",
    }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("crm_leads_tenant_id_idx").on(table.tenantId),
    index("crm_leads_owner_user_id_idx").on(table.ownerUserId),
    index("crm_leads_stage_idx").on(table.stage),
  ],
);

export const crmLeadActivities = pgTable(
  "crm_lead_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => crmLeads.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    activityType: varchar("activity_type", { length: 30 }).$type<ActivityType>().notNull().default("NOTE"),
    summary: text("summary").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("crm_lead_activities_lead_id_idx").on(table.leadId),
    index("crm_lead_activities_tenant_id_idx").on(table.tenantId),
  ],
);

export const crmLeadFollowups = pgTable(
  "crm_lead_followups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => crmLeads.id, { onDelete: "cascade" }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 20 }).$type<FollowupStatus>().notNull().default("PENDING"),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("crm_lead_followups_lead_id_idx").on(table.leadId),
    index("crm_lead_followups_tenant_id_idx").on(table.tenantId),
  ],
);
