// Tenant entitlements table: har company ke enabled modules, quotas aur version tracking.
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const MODULE_CODES = [
  "CRM",
  "SALES",
  "FINANCE",
  "TASKS",
  "DOCUMENTS",
  "HR",
  "INVENTORY",
] as const;

export type ModuleCode = (typeof MODULE_CODES)[number];

export interface ModuleQuotas {
  max_seats: number;
  max_storage_mb: number;
  max_api_calls: number;
}

export const DEFAULT_MODULE_QUOTAS: ModuleQuotas = {
  max_seats: 10,
  max_storage_mb: 1024,
  max_api_calls: 10000,
};

export const tenantEntitlements = pgTable(
  "tenant_entitlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    moduleCode: varchar("module_code", { length: 50 }).notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    quotas: jsonb("quotas").$type<ModuleQuotas>().notNull().default(DEFAULT_MODULE_QUOTAS),
    entitlementVersion: integer("entitlement_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tenant_entitlements_tenant_id_idx").on(table.tenantId),
    uniqueIndex("tenant_entitlements_tenant_module_uidx").on(table.tenantId, table.moduleCode),
  ],
);
