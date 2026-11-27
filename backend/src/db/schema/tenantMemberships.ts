// Tenant memberships schema: connects users with tenants, roles, branch and department.
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { roles } from "./roles";

export const MEMBERSHIP_STATUSES = ["ACTIVE", "INACTIVE", "INVITED", "SUSPENDED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
    roleName: varchar("role_name", { length: 50 }).notNull().default("MEMBER"),
    status: varchar("status", { length: 20 }).$type<MembershipStatus>().notNull().default("ACTIVE"),
    branchId: varchar("branch_id", { length: 100 }),
    departmentId: varchar("department_id", { length: 100 }),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tenant_memberships_tenant_id_idx").on(table.tenantId),
    index("tenant_memberships_user_id_idx").on(table.userId),
    uniqueIndex("tenant_memberships_tenant_user_uidx").on(table.tenantId, table.userId),
  ],
);
