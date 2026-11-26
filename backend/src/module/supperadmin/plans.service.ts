// Plans service: subscription_plans aur plan_features CRUD, versioning aur audit logs.
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { planFeatures, subscriptionPlans } from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { pageMeta, type PageMeta } from "../../lib/response";
import type {
  PlanFeatureItem,
  PlanItem,
  PlanListQuery,
  UpdatePlanStatusInput,
  UpsertPlanInput,
} from "./plans.model";

function mapPlanRow(
  row: typeof subscriptionPlans.$inferSelect,
  features: (typeof planFeatures.$inferSelect)[],
): PlanItem {
  const modules: PlanFeatureItem[] = features.map((f) => ({
    module_code: f.moduleCode,
    enabled: f.enabled,
    limit: f.limit ?? null,
  }));

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    billing_interval: row.billingInterval,
    price: Number(row.price),
    currency: row.currency.trim(),
    trial_days: row.trialDays,
    version: row.version,
    active: row.active,
    quotas: row.quotas,
    modules,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listPlans(
  query: PlanListQuery,
): Promise<{ items: PlanItem[]; meta: PageMeta }> {
  const conditions = [];

  if (query.active !== undefined) {
    conditions.push(eq(subscriptionPlans.active, query.active));
  }
  if (query.billing_interval) {
    conditions.push(eq(subscriptionPlans.billingInterval, query.billing_interval));
  }
  if (query.search) {
    const pattern = `%${query.search}%`;
    conditions.push(
      or(ilike(subscriptionPlans.code, pattern), ilike(subscriptionPlans.name, pattern)),
    );
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [planRows, totalRows] = await Promise.all([
    db
      .select()
      .from(subscriptionPlans)
      .where(whereClause)
      .orderBy(desc(subscriptionPlans.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ total: count() }).from(subscriptionPlans).where(whereClause),
  ]);

  const planIds = planRows.map((p) => p.id);
  const featureRows = planIds.length
    ? await db
        .select()
        .from(planFeatures)
        .where(inArray(planFeatures.planId, planIds))
        .orderBy(asc(planFeatures.moduleCode))
    : [];

  const featuresByPlan = new Map<string, (typeof planFeatures.$inferSelect)[]>();
  for (const f of featureRows) {
    const existing = featuresByPlan.get(f.planId) ?? [];
    existing.push(f);
    featuresByPlan.set(f.planId, existing);
  }

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    items: planRows.map((p) => mapPlanRow(p, featuresByPlan.get(p.id) ?? [])),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function getPlanById(planId: string): Promise<PlanItem> {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);

  if (!plan) {
    throw Errors.notFound("Subscription plan not found");
  }

  const features = await db
    .select()
    .from(planFeatures)
    .where(eq(planFeatures.planId, planId))
    .orderBy(asc(planFeatures.moduleCode));

  return mapPlanRow(plan, features);
}

export async function createPlan(
  input: UpsertPlanInput,
  actorUserId: string,
  requestId?: string,
): Promise<PlanItem> {
  const [existingCode] = await db
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.code, input.code))
    .limit(1);

  if (existingCode) {
    throw Errors.conflict("Plan code already exists");
  }

  const createdId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(subscriptionPlans)
      .values({
        code: input.code,
        name: input.name,
        billingInterval: input.billing_interval,
        price: input.price.toFixed(2),
        currency: input.currency,
        trialDays: input.trial_days,
        version: 1,
        active: input.active,
        quotas: input.quotas,
      })
      .returning();

    await tx.insert(planFeatures).values(
      input.modules.map((m) => ({
        planId: created.id,
        moduleCode: m.module_code,
        enabled: m.enabled,
        limit: m.limit,
      })),
    );

    await writeAudit(tx, {
      actorUserId,
      action: "PLAN.CREATE",
      entityType: "subscription_plan",
      entityId: created.id,
      afterData: {
        code: created.code,
        name: created.name,
        billing_interval: created.billingInterval,
        price: Number(created.price),
        currency: created.currency.trim(),
        version: created.version,
      },
      requestId,
    });

    return created.id;
  });

  return getPlanById(createdId);
}

export async function updatePlan(
  planId: string,
  input: UpsertPlanInput,
  actorUserId: string,
  requestId?: string,
): Promise<PlanItem> {
  const existing = await getPlanById(planId);

  if (input.code !== existing.code) {
    const [duplicateCode] = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.code, input.code))
      .limit(1);

    if (duplicateCode) {
      throw Errors.conflict("Plan code already exists");
    }
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(subscriptionPlans)
      .set({
        code: input.code,
        name: input.name,
        billingInterval: input.billing_interval,
        price: input.price.toFixed(2),
        currency: input.currency,
        trialDays: input.trial_days,
        active: input.active,
        quotas: input.quotas,
        version: sql`${subscriptionPlans.version} + 1`,
        updatedAt: now,
      })
      .where(eq(subscriptionPlans.id, planId));

    // Replace plan features to reflect exact edited module list
    await tx.delete(planFeatures).where(eq(planFeatures.planId, planId));
    await tx.insert(planFeatures).values(
      input.modules.map((m) => ({
        planId,
        moduleCode: m.module_code,
        enabled: m.enabled,
        limit: m.limit,
      })),
    );

    await writeAudit(tx, {
      actorUserId,
      action: "PLAN.UPDATE",
      entityType: "subscription_plan",
      entityId: planId,
      beforeData: {
        code: existing.code,
        price: existing.price,
        version: existing.version,
      },
      afterData: {
        code: input.code,
        price: input.price,
        version: existing.version + 1,
      },
      requestId,
    });
  });

  return getPlanById(planId);
}

export async function updatePlanStatus(
  planId: string,
  input: UpdatePlanStatusInput,
  actorUserId: string,
  requestId?: string,
): Promise<PlanItem> {
  const existing = await getPlanById(planId);

  await db.transaction(async (tx) => {
    await tx
      .update(subscriptionPlans)
      .set({ active: input.active, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, planId));

    await writeAudit(tx, {
      actorUserId,
      action: "PLAN.STATUS_CHANGE",
      entityType: "subscription_plan",
      entityId: planId,
      beforeData: { active: existing.active },
      afterData: { active: input.active },
      requestId,
    });
  });

  return getPlanById(planId);
}
