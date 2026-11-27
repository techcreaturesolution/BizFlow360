// Organization setup schema: Branches, Departments, Teams, and Team Members mapping.
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const ORG_ENTITY_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type OrgEntityStatus = (typeof ORG_ENTITY_STATUSES)[number];

export interface BranchAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    address: jsonb("address").$type<BranchAddress>(),
    status: varchar("status", { length: 20 }).$type<OrgEntityStatus>().notNull().default("ACTIVE"),
    isHeadOffice: boolean("is_head_office").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("branches_tenant_id_idx").on(table.tenantId),
    uniqueIndex("branches_tenant_code_uidx").on(table.tenantId, table.code),
  ],
);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    managerUserId: uuid("manager_user_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).$type<OrgEntityStatus>().notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("departments_tenant_id_idx").on(table.tenantId),
    index("departments_branch_id_idx").on(table.branchId),
    uniqueIndex("departments_tenant_branch_name_uidx").on(table.tenantId, table.branchId, table.name),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    description: text("description"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    parentTeamId: uuid("parent_team_id"),
    managerUserId: uuid("manager_user_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).$type<OrgEntityStatus>().notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("teams_tenant_id_idx").on(table.tenantId),
    index("teams_department_id_idx").on(table.departmentId),
    index("teams_parent_team_id_idx").on(table.parentTeamId),
  ],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleInTeam: varchar("role_in_team", { length: 50 }).notNull().default("MEMBER"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("team_members_team_user_uidx").on(table.teamId, table.userId),
    index("team_members_tenant_id_idx").on(table.tenantId),
  ],
);
