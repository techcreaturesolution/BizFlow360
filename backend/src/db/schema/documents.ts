// Documents schema: Tenant-scoped file metadata & upload/download tracking.
import { bigint, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 60 }), // e.g., EXPENSE, QUOTATION, CUSTOMER, LEAD, GENERAL
    entityId: uuid("entity_id"),
    category: varchar("category", { length: 60 }).notNull().default("GENERAL"),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    objectKey: text("object_key").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("documents_tenant_id_idx").on(table.tenantId),
    index("documents_entity_idx").on(table.entityType, table.entityId),
  ],
);
