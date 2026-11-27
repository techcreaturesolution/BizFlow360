// Naye tenant ke liye default module entitlements, usage metrics, aur standard RBAC roles initialize karta hai.
import { and, eq } from "drizzle-orm";
import type { Db } from "./index";
import {
  DEFAULT_MODULE_QUOTAS,
  MODULE_CODES,
  permissions,
  rolePermissions,
  roles,
  tenantEntitlements,
  usageMetrics,
} from "./schema";

export const STANDARD_PERMISSIONS = [
  // Auth & Team
  { code: "AUTH.USERS.VIEW", moduleCode: "AUTH", description: "View company team members" },
  { code: "AUTH.USERS.INVITE", moduleCode: "AUTH", description: "Invite new team members" },
  { code: "AUTH.USERS.MANAGE", moduleCode: "AUTH", description: "Activate, deactivate or edit team members" },
  { code: "AUTH.ROLES.MANAGE", moduleCode: "AUTH", description: "Create and edit custom roles and permissions" },

  // Organization & Company Setup
  { code: "ORG.COMPANY.VIEW", moduleCode: "ORG", description: "View company profile and preferences" },
  { code: "ORG.COMPANY.MANAGE", moduleCode: "ORG", description: "Update company profile, tax ID, currency and preferences" },
  { code: "ORG.BRANCHES.VIEW", moduleCode: "ORG", description: "View company branches" },
  { code: "ORG.BRANCHES.MANAGE", moduleCode: "ORG", description: "Create and update company branches" },
  { code: "ORG.DEPARTMENTS.VIEW", moduleCode: "ORG", description: "View company departments" },
  { code: "ORG.DEPARTMENTS.MANAGE", moduleCode: "ORG", description: "Create and update company departments" },
  { code: "ORG.TEAMS.VIEW", moduleCode: "ORG", description: "View teams and team member hierarchy" },
  { code: "ORG.TEAMS.MANAGE", moduleCode: "ORG", description: "Create teams and assign team managers/members" },

  // CRM
  { code: "CRM.LEADS.VIEW", moduleCode: "CRM", description: "View CRM leads and customer records" },
  { code: "CRM.LEADS.MANAGE", moduleCode: "CRM", description: "Create, edit and manage CRM leads" },

  // Sales
  { code: "SALES.QUOTATIONS.VIEW", moduleCode: "SALES", description: "View sales quotations and orders" },
  { code: "SALES.QUOTATIONS.MANAGE", moduleCode: "SALES", description: "Create and approve sales quotations" },

  // Finance
  { code: "FINANCE.INVOICES.VIEW", moduleCode: "FINANCE", description: "View invoices and payment receipts" },
  { code: "FINANCE.INVOICES.MANAGE", moduleCode: "FINANCE", description: "Issue invoices and record payments" },

  // HR
  { code: "HR.EMPLOYEES.VIEW", moduleCode: "HR", description: "View employee profiles and attendance" },
  { code: "HR.EMPLOYEES.MANAGE", moduleCode: "HR", description: "Manage employee records and payroll" },

  // Inventory
  { code: "INVENTORY.ITEMS.VIEW", moduleCode: "INVENTORY", description: "View stock levels and inventory items" },
  { code: "INVENTORY.ITEMS.MANAGE", moduleCode: "INVENTORY", description: "Adjust stock, warehouses and transfers" },
] as const;

export async function ensureStandardPermissions(
  executor: Pick<Db, "insert" | "select">,
): Promise<void> {
  for (const perm of STANDARD_PERMISSIONS) {
    const existing = await executor
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.code, perm.code))
      .limit(1);

    if (existing.length === 0) {
      await executor.insert(permissions).values(perm);
    }
  }
}

export async function initializeTenantDefaults(
  executor: Pick<Db, "insert" | "select">,
  tenantId: string,
): Promise<void> {
  // 1. Initialize usage metrics
  await executor.insert(usageMetrics).values({
    tenantId,
    seatsUsed: 1,
    storageUsedMb: 0,
    apiCallsUsed: 0,
  });

  // 2. Initialize default module entitlements
  await executor.insert(tenantEntitlements).values(
    MODULE_CODES.map((moduleCode) => ({
      tenantId,
      moduleCode,
      isEnabled: true,
      quotas: DEFAULT_MODULE_QUOTAS,
      entitlementVersion: 1,
    })),
  );

  // 3. Ensure standard permissions exist in global catalog
  await ensureStandardPermissions(executor);

  // 4. Create standard default roles for this tenant
  const [adminRole] = await executor
    .insert(roles)
    .values({
      tenantId,
      name: "ADMIN",
      description: "Full administrative access to manage workspace, team and settings",
      isSystem: true,
    })
    .returning();

  const [memberRole] = await executor
    .insert(roles)
    .values({
      tenantId,
      name: "MEMBER",
      description: "Standard team member with view permissions across enabled modules",
      isSystem: true,
    })
    .returning();

  // 5. Assign default permissions to ADMIN and MEMBER
  const allPerms = await executor.select().from(permissions);
  if (adminRole && allPerms.length > 0) {
    await executor.insert(rolePermissions).values(
      allPerms.map((p) => ({
        roleId: adminRole.id,
        permissionId: p.id,
      })),
    );
  }

  if (memberRole && allPerms.length > 0) {
    const viewPerms = allPerms.filter((p) => p.code.endsWith(".VIEW"));
    if (viewPerms.length > 0) {
      await executor.insert(rolePermissions).values(
        viewPerms.map((p) => ({
          roleId: memberRole.id,
          permissionId: p.id,
        })),
      );
    }
  }
}
