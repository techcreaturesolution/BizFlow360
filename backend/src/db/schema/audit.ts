// Audit logs table: critical actions (login, role change, payments) ka immutable record.
import { desc } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id"),
    actorUserId: uuid("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    beforeData: jsonb("before_data"),
    afterData: jsonb("after_data"),
    reason: text("reason"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_tenant_created_idx").on(table.tenantId, desc(table.createdAt)),
    index("audit_logs_actor_user_idx").on(table.actorUserId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_entity_type_idx").on(table.entityType),
  ],
);
