// Usage metrics table: har tenant ke current seats, storage aur API calls usage tracking.
import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const usageMetrics = pgTable("usage_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .unique()
    .references(() => tenants.id, { onDelete: "cascade" }),
  seatsUsed: integer("seats_used").notNull().default(1),
  storageUsedMb: integer("storage_used_mb").notNull().default(0),
  apiCallsUsed: integer("api_calls_used").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
