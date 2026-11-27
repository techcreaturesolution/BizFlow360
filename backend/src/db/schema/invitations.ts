// Team invitations schema.
import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { roles } from "./roles";

export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
    branchId: varchar("branch_id", { length: 100 }),
    departmentId: varchar("department_id", { length: 100 }),
    tokenHash: text("token_hash").notNull(),
    status: varchar("status", { length: 20 }).$type<InvitationStatus>().notNull().default("PENDING"),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("user_invitations_tenant_id_idx").on(table.tenantId),
    index("user_invitations_email_idx").on(table.email),
  ],
);
