// Approvals & Notifications schema: Approval Inbox queue, Workflow Steps History, In-app Notifications, and Preferences.
import {
  boolean,
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

export const APPROVAL_ENTITY_TYPES = [
  "QUOTATION",
  "EXPENSE",
  "PURCHASE_ORDER",
  "LEAVE_REQUEST",
] as const;
export type ApprovalEntityType = (typeof APPROVAL_ENTITY_TYPES)[number];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const NOTIFICATION_CATEGORIES = [
  "APPROVAL",
  "BILLING",
  "TEAM",
  "SALES",
  "FINANCE",
  "GENERAL",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationPreferencesConfig {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  emailApprovals: boolean;
  emailBilling: boolean;
  emailTeamUpdates: boolean;
  emailDigestDaily: boolean;
  inAppApprovals: boolean;
  inAppBilling: boolean;
  inAppMentions: boolean;
  inAppTasks: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesConfig = {
  emailEnabled: true,
  inAppEnabled: true,
  emailApprovals: true,
  emailBilling: true,
  emailTeamUpdates: true,
  emailDigestDaily: false,
  inAppApprovals: true,
  inAppBilling: true,
  inAppMentions: true,
  inAppTasks: true,
};

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 50 }).$type<ApprovalEntityType>().notNull(),
    entityId: uuid("entity_id").notNull(),
    entityNumber: varchar("entity_number", { length: 80 }),
    title: text("title").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    approverUserId: uuid("approver_user_id").references(() => users.id, { onDelete: "set null" }),
    branchId: uuid("branch_id"),
    departmentId: uuid("department_id"),
    status: varchar("status", { length: 20 }).$type<ApprovalStatus>().notNull().default("PENDING"),
    currentStage: varchar("current_stage", { length: 40 }).notNull().default("MANAGER_REVIEW"),
    decisionComment: text("decision_comment"),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("approval_requests_tenant_id_idx").on(table.tenantId),
    index("approval_requests_status_idx").on(table.status),
    index("approval_requests_approver_idx").on(table.approverUserId),
  ],
);

export const workflowInstanceSteps = pgTable(
  "workflow_instance_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    approvalRequestId: uuid("approval_request_id")
      .notNull()
      .references(() => approvalRequests.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull().default(1),
    stepName: varchar("step_name", { length: 100 }).notNull(),
    action: varchar("action", { length: 40 }).notNull(), // SUBMITTED, APPROVED, FORWARDED_TO_FINANCE, REJECTED
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("workflow_instance_steps_approval_id_idx").on(table.approvalRequestId),
    index("workflow_instance_steps_tenant_id_idx").on(table.tenantId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 50 })
      .$type<NotificationCategory>()
      .notNull()
      .default("GENERAL"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    actionUrl: text("action_url"),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_tenant_user_idx").on(table.tenantId, table.userId),
    index("notifications_is_read_idx").on(table.isRead),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    preferences: jsonb("preferences")
      .$type<NotificationPreferencesConfig>()
      .notNull()
      .default(DEFAULT_NOTIFICATION_PREFERENCES),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notification_preferences_tenant_user_uidx").on(table.tenantId, table.userId),
  ],
);
