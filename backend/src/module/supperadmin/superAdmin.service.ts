// Super Admin service: Tenants lifecycle management aur module entitlements + usage metrics.
import { randomBytes } from "crypto";
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  sessions,
  TENANT_STATUSES,
  tenantEntitlements,
  tenants,
  usageMetrics,
  users,
  type TenantStatus,
} from "../../db/schema";
import { initializeTenantDefaults } from "../../db/tenantDefaults";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { hashPassword } from "../../lib/Password";
import { pageMeta, type PageMeta } from "../../lib/response";
import type {
  CreateTenantInput,
  CurrencyRevenue,
  DashboardOverview,
  DashboardQuery,
  PlanMixItem,
  TenantDetail,
  TenantEntitlementItem,
  TenantListItem,
  TenantListQuery,
  TenantUsageInfo,
  UpdateEntitlementsInput,
  UpdateTenantInput,
  UpdateTenantStatusInput,
} from "./superAdmin.model";

const REVOCATION_STATUSES = new Set(["SUSPENDED", "CANCELLED", "ARCHIVED"]);

const ownerJoin = and(
  eq(users.tenantId, tenants.id),
  sql`${users.roles} @> '["OWNER"]'::jsonb`,
);

function mapTenantRow(row: {
  id: string;
  name: string;
  slug: string;
  status: TenantListItem["status"];
  timezone: string;
  defaultCurrency: string;
  planId: string | null;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string | null;
  ownerFullName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
}): TenantListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    timezone: row.timezone,
    default_currency: row.defaultCurrency.trim(),
    plan_id: row.planId ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    owner:
      row.ownerId && row.ownerFullName && row.ownerEmail
        ? {
            id: row.ownerId,
            full_name: row.ownerFullName,
            email: row.ownerEmail,
            phone: row.ownerPhone ?? null,
          }
        : null,
  };
}

function mapEntitlementRow(row: typeof tenantEntitlements.$inferSelect): TenantEntitlementItem {
  return {
    module_code: row.moduleCode,
    is_enabled: row.isEnabled,
    quotas: row.quotas,
    entitlement_version: row.entitlementVersion,
  };
}

function mapUsageRow(row?: typeof usageMetrics.$inferSelect): TenantUsageInfo {
  return {
    seats_used: row?.seatsUsed ?? 0,
    storage_used_mb: row?.storageUsedMb ?? 0,
    api_calls_used: row?.apiCallsUsed ?? 0,
  };
}

async function ensureTenantExists(tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) {
    throw Errors.notFound("Tenant not found");
  }
  return tenant;
}

export async function listPlatformTenants(
  query: TenantListQuery,
): Promise<{ items: TenantListItem[]; meta: PageMeta }> {
  const conditions = [];

  if (query.status) {
    conditions.push(eq(tenants.status, query.status));
  }
  if (query.plan_id) {
    conditions.push(eq(tenants.planId, query.plan_id));
  }
  if (query.search) {
    const pattern = `%${query.search}%`;
    conditions.push(
      or(
        ilike(tenants.name, pattern),
        ilike(tenants.slug, pattern),
        ilike(users.fullName, pattern),
        ilike(users.email, pattern),
      ),
    );
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        timezone: tenants.timezone,
        defaultCurrency: tenants.defaultCurrency,
        planId: tenants.planId,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
        ownerId: users.id,
        ownerFullName: users.fullName,
        ownerEmail: users.email,
        ownerPhone: users.phone,
      })
      .from(tenants)
      .leftJoin(users, ownerJoin)
      .where(whereClause)
      .orderBy(desc(tenants.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(tenants)
      .leftJoin(users, ownerJoin)
      .where(whereClause),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    items: rows.map(mapTenantRow),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function createPlatformTenant(
  input: CreateTenantInput,
  actorUserId: string,
  requestId?: string,
): Promise<TenantDetail> {
  const [existingSlug] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, input.slug))
    .limit(1);

  if (existingSlug) {
    throw Errors.conflict("Workspace slug already taken");
  }

  const [existingEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.owner.email))
    .limit(1);

  if (existingEmail) {
    throw Errors.conflict("Owner email already registered");
  }

  const rawPassword = input.owner.password ?? randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(rawPassword);

  const createdId = await db.transaction(async (tx) => {
    const [createdTenant] = await tx
      .insert(tenants)
      .values({
        name: input.name,
        slug: input.slug,
        status: input.status,
        timezone: input.timezone,
        defaultCurrency: input.default_currency,
        planId: input.plan_id ?? null,
      })
      .returning();

    await initializeTenantDefaults(tx, createdTenant.id);

    const [createdOwner] = await tx
      .insert(users)
      .values({
        tenantId: createdTenant.id,
        fullName: input.owner.full_name,
        email: input.owner.email,
        phone: input.owner.phone ?? null,
        passwordHash,
        roles: ["OWNER"],
      })
      .returning();

    await writeAudit(tx, {
      tenantId: createdTenant.id,
      actorUserId,
      action: "TENANT.CREATE",
      entityType: "tenant",
      entityId: createdTenant.id,
      afterData: {
        name: createdTenant.name,
        slug: createdTenant.slug,
        status: createdTenant.status,
        plan_id: createdTenant.planId,
        owner_id: createdOwner.id,
      },
      requestId,
    });

    return createdTenant.id;
  });

  return getPlatformTenantDetail(createdId);
}

export async function getPlatformTenantDetail(tenantId: string): Promise<TenantDetail> {
  const [rows, entitlementRows, usageRows] = await Promise.all([
    db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        timezone: tenants.timezone,
        defaultCurrency: tenants.defaultCurrency,
        planId: tenants.planId,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
        ownerId: users.id,
        ownerFullName: users.fullName,
        ownerEmail: users.email,
        ownerPhone: users.phone,
      })
      .from(tenants)
      .leftJoin(users, ownerJoin)
      .where(eq(tenants.id, tenantId))
      .limit(1),
    db
      .select()
      .from(tenantEntitlements)
      .where(eq(tenantEntitlements.tenantId, tenantId))
      .orderBy(asc(tenantEntitlements.moduleCode)),
    db
      .select()
      .from(usageMetrics)
      .where(eq(usageMetrics.tenantId, tenantId))
      .limit(1),
  ]);

  const row = rows[0];
  if (!row) {
    throw Errors.notFound("Tenant not found");
  }

  const base = mapTenantRow(row);
  return {
    ...base,
    current_plan: { plan_id: base.plan_id },
    current_usage: mapUsageRow(usageRows[0]),
    entitlements: entitlementRows.map(mapEntitlementRow),
  };
}

export async function updatePlatformTenant(
  tenantId: string,
  input: UpdateTenantInput,
  actorUserId: string,
  requestId?: string,
): Promise<TenantDetail> {
  const existing = await ensureTenantExists(tenantId);

  const updates: Partial<typeof tenants.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) updates.name = input.name;
  if (input.timezone !== undefined) updates.timezone = input.timezone;
  if (input.default_currency !== undefined) updates.defaultCurrency = input.default_currency;

  await db.transaction(async (tx) => {
    await tx.update(tenants).set(updates).where(eq(tenants.id, tenantId));

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "TENANT.UPDATE",
      entityType: "tenant",
      entityId: tenantId,
      beforeData: {
        name: existing.name,
        timezone: existing.timezone,
        default_currency: existing.defaultCurrency.trim(),
      },
      afterData: {
        name: input.name ?? existing.name,
        timezone: input.timezone ?? existing.timezone,
        default_currency: input.default_currency ?? existing.defaultCurrency.trim(),
      },
      requestId,
    });
  });

  return getPlatformTenantDetail(tenantId);
}

export async function updatePlatformTenantStatus(
  tenantId: string,
  input: UpdateTenantStatusInput,
  actorUserId: string,
  requestId?: string,
): Promise<TenantDetail> {
  const existing = await ensureTenantExists(tenantId);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(tenants)
      .set({ status: input.status, updatedAt: now })
      .where(eq(tenants.id, tenantId));

    if (REVOCATION_STATUSES.has(input.status)) {
      await tx
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.tenantId, tenantId), isNull(sessions.revokedAt)));
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "TENANT.STATUS_CHANGE",
      entityType: "tenant",
      entityId: tenantId,
      beforeData: { status: existing.status },
      afterData: { status: input.status },
      reason: input.reason,
      requestId,
    });
  });

  return getPlatformTenantDetail(tenantId);
}

export async function getPlatformTenantEntitlements(tenantId: string): Promise<{
  tenant_id: string;
  entitlements: TenantEntitlementItem[];
  current_usage: TenantUsageInfo;
}> {
  await ensureTenantExists(tenantId);

  const [entitlementRows, usageRows] = await Promise.all([
    db
      .select()
      .from(tenantEntitlements)
      .where(eq(tenantEntitlements.tenantId, tenantId))
      .orderBy(asc(tenantEntitlements.moduleCode)),
    db
      .select()
      .from(usageMetrics)
      .where(eq(usageMetrics.tenantId, tenantId))
      .limit(1),
  ]);

  return {
    tenant_id: tenantId,
    entitlements: entitlementRows.map(mapEntitlementRow),
    current_usage: mapUsageRow(usageRows[0]),
  };
}

export async function updatePlatformTenantEntitlements(
  tenantId: string,
  input: UpdateEntitlementsInput,
  actorUserId: string,
  requestId?: string,
): Promise<{
  tenant_id: string;
  entitlements: TenantEntitlementItem[];
  current_usage: TenantUsageInfo;
}> {
  await ensureTenantExists(tenantId);

  const existingRows = await db
    .select()
    .from(tenantEntitlements)
    .where(eq(tenantEntitlements.tenantId, tenantId));

  const now = new Date();

  await db.transaction(async (tx) => {
    for (const item of input.modules) {
      await tx
        .insert(tenantEntitlements)
        .values({
          tenantId,
          moduleCode: item.module_code,
          isEnabled: item.is_enabled,
          quotas: item.quotas,
          entitlementVersion: 1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [tenantEntitlements.tenantId, tenantEntitlements.moduleCode],
          set: {
            isEnabled: item.is_enabled,
            quotas: item.quotas,
            entitlementVersion: sql`${tenantEntitlements.entitlementVersion} + 1`,
            updatedAt: now,
          },
        });
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "TENANT.ENTITLEMENTS_UPDATE",
      entityType: "tenant",
      entityId: tenantId,
      beforeData: existingRows.map(mapEntitlementRow),
      afterData: input.modules,
      requestId,
    });
  });

  return getPlatformTenantEntitlements(tenantId);
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(
    sql`SELECT to_regclass(${`public.${tableName}`}) IS NOT NULL AS "exists"`,
  );
  return Boolean(result[0]?.exists);
}

function resolveDateRange(query: DashboardQuery): {
  fromStr: string;
  toStr: string;
  fromDate: Date;
  toDate: Date;
} {
  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const defaultFrom = thirtyDaysAgo.toISOString().slice(0, 10);

  const fromStr = query.from ?? defaultFrom;
  const toStr = query.to ?? defaultTo;

  return {
    fromStr,
    toStr,
    fromDate: new Date(`${fromStr}T00:00:00.000Z`),
    toDate: new Date(`${toStr}T23:59:59.999Z`),
  };
}

export async function getPlatformDashboard(
  query: DashboardQuery,
): Promise<DashboardOverview> {
  const { fromStr, toStr, fromDate, toDate } = resolveDateRange(query);

  const [statusRows, recentRows, churnedRows, hasPlans, hasSubs, hasPayments] =
    await Promise.all([
      db
        .select({
          status: tenants.status,
          total: count(),
        })
        .from(tenants)
        .groupBy(tenants.status),
      db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          status: tenants.status,
          timezone: tenants.timezone,
          defaultCurrency: tenants.defaultCurrency,
          planId: tenants.planId,
          createdAt: tenants.createdAt,
          updatedAt: tenants.updatedAt,
          ownerId: users.id,
          ownerFullName: users.fullName,
          ownerEmail: users.email,
          ownerPhone: users.phone,
        })
        .from(tenants)
        .leftJoin(users, ownerJoin)
        .orderBy(desc(tenants.createdAt))
        .limit(10),
      db
        .select({ total: count() })
        .from(tenants)
        .where(
          and(
            eq(tenants.status, "CANCELLED"),
            gte(tenants.updatedAt, fromDate),
            lte(tenants.updatedAt, toDate),
          ),
        ),
      tableExists("subscription_plans"),
      tableExists("subscriptions"),
      tableExists("payment_transactions"),
    ]);

  const tenantsByStatus = Object.fromEntries(
    TENANT_STATUSES.map((s) => [s, 0]),
  ) as Record<TenantStatus, number>;

  let totalTenants = 0;
  for (const row of statusRows) {
    const num = Number(row.total ?? 0);
    tenantsByStatus[row.status] = num;
    totalTenants += num;
  }

  const churnedCount = Number(churnedRows[0]?.total ?? 0);
  const churnRate =
    totalTenants > 0 ? Number(((churnedCount / totalTenants) * 100).toFixed(2)) : 0;

  let activeSubscriptions = 0;
  let mrr = 0;
  let arr = 0;
  let revenueByCurrency: CurrencyRevenue[] = [];
  let planMix: PlanMixItem[] = [];
  let failedPaymentsCount = 0;

  if (hasSubs) {
    const activeSubRes = await db.execute<{ total: string }>(
      sql`SELECT count(*)::text AS total FROM subscriptions WHERE status = 'ACTIVE'`,
    );
    activeSubscriptions = Number(activeSubRes[0]?.total ?? 0);

    if (hasPlans) {
      const revRows = await db.execute<{ currency: string; mrr: string }>(
        sql`
          SELECT
            UPPER(TRIM(COALESCE(p.currency, 'INR'))) AS currency,
            COALESCE(SUM(
              CASE
                WHEN p.billing_interval = 'ANNUAL' THEN COALESCE(p.price, 0) / 12.0
                ELSE COALESCE(p.price, 0)
              END
            ), 0)::text AS mrr
          FROM subscriptions s
          LEFT JOIN subscription_plans p ON p.id = s.plan_id
          WHERE s.status = 'ACTIVE'
          GROUP BY 1
        `,
      );

      revenueByCurrency = revRows.map((r) => {
        const currencyMrr = Number(Number(r.mrr ?? 0).toFixed(2));
        return {
          currency: r.currency,
          mrr: currencyMrr,
          arr: Number((currencyMrr * 12).toFixed(2)),
        };
      });

      mrr = Number(
        revenueByCurrency.reduce((sum, item) => sum + item.mrr, 0).toFixed(2),
      );
      arr = Number((mrr * 12).toFixed(2));

      const mixRows = await db.execute<{
        plan_id: string | null;
        plan_name: string;
        tenant_count: string;
      }>(
        sql`
          SELECT
            p.id AS plan_id,
            p.name AS plan_name,
            count(DISTINCT s.tenant_id)::text AS tenant_count
          FROM subscription_plans p
          LEFT JOIN subscriptions s
            ON s.plan_id = p.id AND s.status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE')
          GROUP BY p.id, p.name
          ORDER BY count(DISTINCT s.tenant_id) DESC, p.name ASC
        `,
      );
      planMix = mixRows.map((r) => ({
        plan_id: r.plan_id,
        plan_name: r.plan_name,
        tenant_count: Number(r.tenant_count ?? 0),
      }));
    }
  } else if (hasPlans) {
    const mixRows = await db.execute<{
      plan_id: string | null;
      plan_name: string;
      tenant_count: string;
    }>(
      sql`
        SELECT
          p.id AS plan_id,
          p.name AS plan_name,
          count(t.id)::text AS tenant_count
        FROM subscription_plans p
        LEFT JOIN tenants t ON t.plan_id = p.id
        GROUP BY p.id, p.name
        ORDER BY count(t.id) DESC, p.name ASC
      `,
    );
    planMix = mixRows.map((r) => ({
      plan_id: r.plan_id,
      plan_name: r.plan_name,
      tenant_count: Number(r.tenant_count ?? 0),
    }));
  }

  if (hasPayments) {
    const fromIso = fromDate.toISOString();
    const toIso = toDate.toISOString();
    const failedRes = await db.execute<{ total: string }>(
      sql`
        SELECT count(*)::text AS total
        FROM payment_transactions
        WHERE status = 'FAILED'
          AND created_at >= ${fromIso}::timestamptz
          AND created_at <= ${toIso}::timestamptz
      `,
    );
    failedPaymentsCount = Number(failedRes[0]?.total ?? 0);
  }

  return {
    period: { from: fromStr, to: toStr },
    total_tenants: totalTenants,
    tenants_by_status: tenantsByStatus,
    active_subscriptions: activeSubscriptions,
    mrr,
    arr,
    revenue_by_currency: revenueByCurrency,
    plan_mix: planMix,
    failed_payments_count: failedPaymentsCount,
    churn_rate: churnRate,
    recent_tenants: recentRows.map(mapTenantRow),
  };
}
