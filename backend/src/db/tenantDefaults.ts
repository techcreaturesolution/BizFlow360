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
  { code: "AUTH.USERS.VIEW", moduleCode: "AUTH", description: "View all company team members" },
  { code: "AUTH.USERS.VIEW_TEAM", moduleCode: "AUTH", description: "View team and department members (read-only)" },
  { code: "AUTH.USERS.VIEW", moduleCode: "AUTH", description: "View all company team members" },
  { code: "AUTH.USERS.VIEW_TEAM", moduleCode: "AUTH", description: "View team and department members (read-only)" },
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

  // Dashboard & Reports
  { code: "REPORTS.DASHBOARD.VIEW", moduleCode: "REPORTS", description: "View company overview KPIs and dashboard widgets" },
  { code: "REPORTS.DASHBOARD.VIEW_TEAM", moduleCode: "REPORTS", description: "View team/department overview KPIs and pipeline metrics" },
  { code: "REPORTS.DASHBOARD.MANAGE", moduleCode: "REPORTS", description: "Customize and save personal dashboard widget layouts" },
  { code: "REPORTS.ANALYTICS.VIEW", moduleCode: "REPORTS", description: "View analytics across enabled modules" },
  { code: "REPORTS.ANALYTICS.VIEW_TEAM", moduleCode: "REPORTS", description: "View team/department analytics across enabled modules" },
  { code: "REPORTS.EXPORT.CREATE", moduleCode: "REPORTS", description: "Trigger async CSV, XLSX, and PDF report exports" },

  // Tenant Subscription & Billing
  { code: "BILLING.SUBSCRIPTION.VIEW", moduleCode: "BILLING", description: "View available plans, current subscription, invoices, and usage" },
  { code: "BILLING.SUBSCRIPTION.MANAGE", moduleCode: "BILLING", description: "Start checkout, change plans, and cancel subscription" },

  // Notifications & Audit
  { code: "APPROVALS.INBOX.VIEW", moduleCode: "APPROVALS", description: "View own pending approval queue" },
  { code: "APPROVALS.INBOX.VIEW_TEAM", moduleCode: "APPROVALS", description: "View pending quotation, expense, and purchase approvals for team/department" },
  { code: "APPROVALS.INBOX.DECIDE", moduleCode: "APPROVALS", description: "Approve or reject pending approval requests" },
  { code: "NOTIFICATIONS.ALERTS.VIEW", moduleCode: "NOTIFICATIONS", description: "View in-app notifications and manage alert preferences" },
  { code: "AUDIT.LOGS.VIEW", moduleCode: "AUDIT", description: "View company-level audit trail logs" },
  { code: "AUDIT.LOGS.VIEW", moduleCode: "AUDIT", description: "View company-level audit trail logs" },

  // CRM
  { code: "CRM.LEADS.VIEW", moduleCode: "CRM", description: "View assigned CRM leads" },
  { code: "CRM.LEADS.VIEW_TEAM", moduleCode: "CRM", description: "View CRM leads assigned to own sales team or department" },
  { code: "CRM.LEADS.VIEW_ALL", moduleCode: "CRM", description: "View all company-wide CRM leads" },
  { code: "CRM.LEADS.MANAGE", moduleCode: "CRM", description: "Create, edit, assign and convert CRM leads" },
  { code: "CRM.CUSTOMERS.VIEW", moduleCode: "CRM", description: "View customer records" },
  { code: "CRM.CUSTOMERS.VIEW_TEAM", moduleCode: "CRM", description: "View customers managed by own sales team or department" },
  { code: "CRM.CUSTOMERS.MANAGE", moduleCode: "CRM", description: "Create and update customer records" },

  // Sales
  { code: "SALES.PRODUCTS.VIEW", moduleCode: "SALES", description: "View products and services catalogue" },
  { code: "SALES.PRODUCTS.MANAGE", moduleCode: "SALES", description: "Create and update products/services" },
  { code: "SALES.QUOTATIONS.VIEW", moduleCode: "SALES", description: "View assigned sales quotations" },
  { code: "SALES.QUOTATIONS.VIEW_TEAM", moduleCode: "SALES", description: "View quotations created by own sales team or department" },
  { code: "SALES.QUOTATIONS.VIEW_ALL", moduleCode: "SALES", description: "View all company-wide quotations" },
  { code: "SALES.QUOTATIONS.MANAGE", moduleCode: "SALES", description: "Create, send and convert quotations to orders" },
  { code: "SALES.QUOTATIONS.APPROVE", moduleCode: "SALES", description: "Approve sales quotations" },
  { code: "SALES.ORDERS.VIEW", moduleCode: "SALES", description: "View sales orders" },
  { code: "SALES.ORDERS.VIEW_TEAM", moduleCode: "SALES", description: "View sales orders managed by own sales team or department" },
  { code: "SALES.ORDERS.MANAGE", moduleCode: "SALES", description: "Create and manage sales orders" },

  // Finance & Billing
  { code: "FINANCE.INVOICES.VIEW", moduleCode: "FINANCE", description: "View client invoices and payment receipts" },
  { code: "FINANCE.INVOICES.MANAGE", moduleCode: "FINANCE", description: "Issue client invoices and record payments" },
  { code: "FINANCE.EXPENSES.VIEW", moduleCode: "FINANCE", description: "View own submitted expenses" },
  { code: "FINANCE.EXPENSES.VIEW_TEAM", moduleCode: "FINANCE", description: "View team and department submitted expenses" },
  { code: "FINANCE.EXPENSES.VIEW_TEAM", moduleCode: "FINANCE", description: "View team and department submitted expenses" },
  { code: "FINANCE.EXPENSES.VIEW_ALL", moduleCode: "FINANCE", description: "View all company expenses" },
  { code: "FINANCE.EXPENSES.MANAGE", moduleCode: "FINANCE", description: "Create and submit expenses" },
  { code: "FINANCE.EXPENSES.APPROVE", moduleCode: "FINANCE", description: "Approve or reject submitted team expenses (subject to threshold)" },
  { code: "FINANCE.EXPENSES.APPROVE_FINAL", moduleCode: "FINANCE", description: "Final finance approval for above-threshold expenses" },
  { code: "FINANCE.EXPENSES.APPROVE", moduleCode: "FINANCE", description: "Approve or reject submitted team expenses (subject to threshold)" },
  { code: "FINANCE.EXPENSES.APPROVE_FINAL", moduleCode: "FINANCE", description: "Final finance approval for above-threshold expenses" },
  { code: "FINANCE.RECEIVABLES.VIEW", moduleCode: "FINANCE", description: "View accounts receivable summary & aging" },

  // Tasks
  { code: "TASKS.TASKS.VIEW", moduleCode: "TASKS", description: "View assigned tasks" },
  { code: "TASKS.TASKS.VIEW_TEAM", moduleCode: "TASKS", description: "View all tasks within own department or team" },
  { code: "TASKS.TASKS.VIEW_TEAM", moduleCode: "TASKS", description: "View all tasks within own department or team" },
  { code: "TASKS.TASKS.VIEW_ALL", moduleCode: "TASKS", description: "View all company tasks" },
  { code: "TASKS.TASKS.MANAGE", moduleCode: "TASKS", description: "Create, assign, update and comment on tasks" },

  // Documents
  { code: "DOCUMENTS.FILES.VIEW", moduleCode: "DOCUMENTS", description: "View and download company documents" },
  { code: "DOCUMENTS.FILES.MANAGE", moduleCode: "DOCUMENTS", description: "Upload, register and delete company documents" },

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

  const [managerRole] = await executor
    .insert(roles)
    .values({
      tenantId,
      name: "MANAGER",
      description: "Team/Department Manager with scoped approvals, tasks, expenses, team list, documents and reports",
      isSystem: true,
    })
    .returning();

  const [salesManagerRole] = await executor
    .insert(roles)
    .values({
      tenantId,
      name: "SALES_MANAGER",
      description: "Sales Team Manager with scoped pipeline, leads, customers, quotations, orders, approvals, tasks, documents and sales reports",
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

  // 5. Assign default permissions to ADMIN (excluding BILLING & FINANCE unless Owner grants them), MANAGER, and MEMBER
  // 5. Assign default permissions to ADMIN (excluding BILLING & FINANCE unless Owner grants them), MANAGER, and MEMBER
  const allPerms = await executor.select().from(permissions);
  const adminDefaultPerms = allPerms.filter(
    (p) => p.moduleCode !== "BILLING" && p.moduleCode !== "FINANCE",
  );
  if (adminRole && adminDefaultPerms.length > 0) {
  const adminDefaultPerms = allPerms.filter(
    (p) => p.moduleCode !== "BILLING" && p.moduleCode !== "FINANCE",
  );
  if (adminRole && adminDefaultPerms.length > 0) {
    await executor.insert(rolePermissions).values(
      adminDefaultPerms.map((p) => ({
      adminDefaultPerms.map((p) => ({
        roleId: adminRole.id,
        permissionId: p.id,
      })),
    );
  }

  const MANAGER_DEFAULT_CODES = new Set([
    "APPROVALS.INBOX.VIEW",
    "APPROVALS.INBOX.VIEW_TEAM",
    "APPROVALS.INBOX.DECIDE",
    "TASKS.TASKS.VIEW",
    "TASKS.TASKS.VIEW_TEAM",
    "TASKS.TASKS.MANAGE",
    "FINANCE.EXPENSES.VIEW",
    "FINANCE.EXPENSES.VIEW_TEAM",
    "FINANCE.EXPENSES.MANAGE",
    "FINANCE.EXPENSES.APPROVE",
    "AUTH.USERS.VIEW_TEAM",
    "ORG.TEAMS.VIEW",
    "DOCUMENTS.FILES.VIEW",
    "DOCUMENTS.FILES.MANAGE",
    "REPORTS.DASHBOARD.VIEW",
    "REPORTS.DASHBOARD.VIEW_TEAM",
    "REPORTS.ANALYTICS.VIEW",
    "REPORTS.ANALYTICS.VIEW_TEAM",
    "REPORTS.EXPORT.CREATE",
    "NOTIFICATIONS.ALERTS.VIEW",
  ]);
  const managerPerms = allPerms.filter((p) => MANAGER_DEFAULT_CODES.has(p.code));
  if (managerRole && managerPerms.length > 0) {
    await executor.insert(rolePermissions).values(
      managerPerms.map((p) => ({
        roleId: managerRole.id,
        permissionId: p.id,
      })),
    );
  }

  const SALES_MANAGER_DEFAULT_CODES = new Set([
    "REPORTS.DASHBOARD.VIEW",
    "REPORTS.DASHBOARD.VIEW_TEAM",
    "REPORTS.ANALYTICS.VIEW",
    "REPORTS.ANALYTICS.VIEW_TEAM",
    "REPORTS.EXPORT.CREATE",
    "CRM.LEADS.VIEW",
    "CRM.LEADS.VIEW_TEAM",
    "CRM.LEADS.MANAGE",
    "CRM.CUSTOMERS.VIEW",
    "CRM.CUSTOMERS.VIEW_TEAM",
    "CRM.CUSTOMERS.MANAGE",
    "SALES.PRODUCTS.VIEW",
    "SALES.QUOTATIONS.VIEW",
    "SALES.QUOTATIONS.VIEW_TEAM",
    "SALES.QUOTATIONS.MANAGE",
    "SALES.QUOTATIONS.APPROVE",
    "SALES.ORDERS.VIEW",
    "SALES.ORDERS.VIEW_TEAM",
    "SALES.ORDERS.MANAGE",
    "APPROVALS.INBOX.VIEW",
    "APPROVALS.INBOX.VIEW_TEAM",
    "APPROVALS.INBOX.DECIDE",
    "TASKS.TASKS.VIEW",
    "TASKS.TASKS.VIEW_TEAM",
    "TASKS.TASKS.MANAGE",
    "AUTH.USERS.VIEW_TEAM",
    "ORG.TEAMS.VIEW",
    "DOCUMENTS.FILES.VIEW",
    "DOCUMENTS.FILES.MANAGE",
    "NOTIFICATIONS.ALERTS.VIEW",
  ]);
  const salesManagerPerms = allPerms.filter((p) => SALES_MANAGER_DEFAULT_CODES.has(p.code));
  if (salesManagerRole && salesManagerPerms.length > 0) {
    await executor.insert(rolePermissions).values(
      salesManagerPerms.map((p) => ({
        roleId: salesManagerRole.id,
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
