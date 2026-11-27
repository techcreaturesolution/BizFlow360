// Tenant Subscription & Billing Service: Plans, Current Subscription, Invoices, Usage, Checkout, Upgrade/Downgrade, Cancel.
import { randomUUID } from "crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  MODULE_CODES,
  paymentTransactions,
  planFeatures,
  subscriptionInvoices,
  subscriptionPlans,
  subscriptions,
  tenantEntitlements,
  tenantMemberships,
  tenants,
  usageMetrics,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import type {
  CancelSubscriptionInput,
  ChangePlanInput,
  CheckoutInput,
  InvoicesQuery,
} from "./tenantBilling.model";

// Server-side tax & period calculations (Rule #3: never trust client calculations)
function calculateInvoiceAmounts(basePrice: number, currency: string) {
  const cleanAmount = Math.max(0, Number(basePrice.toFixed(2)));
  const taxRate = currency.trim().toUpperCase() === "INR" ? 0.18 : 0; // 18% GST for INR
  const taxAmount = Number((cleanAmount * taxRate).toFixed(2));
  const totalAmount = Number((cleanAmount + taxAmount).toFixed(2));
  return {
    amount: cleanAmount.toFixed(2),
    tax: taxAmount.toFixed(2),
    total: totalAmount.toFixed(2),
    numericAmount: cleanAmount,
    numericTax: taxAmount,
    numericTotal: totalAmount,
  };
}

function calculatePeriodEnd(start: Date, interval: "MONTHLY" | "ANNUAL"): Date {
  const end = new Date(start);
  if (interval === "ANNUAL") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

// ==========================================
// 1. AVAILABLE PLANS (GET /billing/plans)
// ==========================================
export async function listAvailablePlans() {
  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.active, true))
    .orderBy(asc(subscriptionPlans.price));

  const planIds = plans.map((p) => p.id);
  const featuresByPlan: Record<
    string,
    Array<{ moduleCode: string; enabled: boolean; limit: number | null }>
  > = {};

  if (planIds.length > 0) {
    const featureRows = await db
      .select()
      .from(planFeatures)
      .where(inArray(planFeatures.planId, planIds));

    for (const f of featureRows) {
      if (!featuresByPlan[f.planId]) {
        featuresByPlan[f.planId] = [];
      }
      featuresByPlan[f.planId].push({
        moduleCode: f.moduleCode,
        enabled: f.enabled,
        limit: f.limit ?? null,
      });
    }
  }

  return {
    plans: plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      billingInterval: p.billingInterval,
      price: Number(p.price),
      currency: p.currency.trim(),
      trialDays: p.trialDays,
      quotas: p.quotas,
      features: featuresByPlan[p.id] ?? [],
    })),
  };
}

// ==========================================
// 2. CURRENT SUBSCRIPTION (GET /billing/subscription)
// ==========================================
export async function getCurrentSubscription(tenantId: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw Errors.notFound("Tenant workspace not found.");
  }

  const [subRow] = await db
    .select({
      sub: subscriptions,
      plan: subscriptionPlans,
    })
    .from(subscriptions)
    .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  const entitlements = await db
    .select({
      moduleCode: tenantEntitlements.moduleCode,
      isEnabled: tenantEntitlements.isEnabled,
      quotas: tenantEntitlements.quotas,
      entitlementVersion: tenantEntitlements.entitlementVersion,
    })
    .from(tenantEntitlements)
    .where(eq(tenantEntitlements.tenantId, tenantId))
    .orderBy(asc(tenantEntitlements.moduleCode));

  return {
    workspace: {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      planId: tenant.planId ?? null,
    },
    subscription: subRow
      ? {
          id: subRow.sub.id,
          status: subRow.sub.status,
          startsAt: subRow.sub.startsAt,
          endsAt: subRow.sub.endsAt,
          renewalDate: subRow.sub.endsAt,
          trialEndsAt: subRow.sub.trialEndsAt ?? null,
          cancelAtPeriodEnd: subRow.sub.cancelAtPeriodEnd,
          plan: subRow.plan
            ? {
                id: subRow.plan.id,
                code: subRow.plan.code,
                name: subRow.plan.name,
                billingInterval: subRow.plan.billingInterval,
                price: Number(subRow.plan.price),
                currency: subRow.plan.currency.trim(),
                quotas: subRow.plan.quotas,
              }
            : null,
        }
      : null,
    entitlements,
  };
}

// ==========================================
// 3. BILLING INVOICES (GET /billing/invoices)
// ==========================================
export async function listTenantInvoices(tenantId: string, query: InvoicesQuery) {
  const conditions = [eq(subscriptionInvoices.tenantId, tenantId)];
  if (query.status) {
    conditions.push(eq(subscriptionInvoices.status, query.status));
  }

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptionInvoices)
      .where(and(...conditions)),
    db
      .select()
      .from(subscriptionInvoices)
      .where(and(...conditions))
      .orderBy(desc(subscriptionInvoices.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    invoices: rows.map((inv) => ({
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      amount: Number(inv.amount),
      tax: Number(inv.tax),
      total: Number(inv.total),
      currency: inv.currency.trim(),
      status: inv.status,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      createdAt: inv.createdAt,
      downloadUrl: `/api/v1/billing/invoices/${inv.id}/download`,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getTenantInvoiceDownload(tenantId: string, invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(subscriptionInvoices)
    .where(
      and(
        eq(subscriptionInvoices.id, invoiceId),
        eq(subscriptionInvoices.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!invoice) {
    throw Errors.notFound("Invoice not found in your company billing history.");
  }

  const [tenant] = await db
    .select({ name: tenants.name, legalName: tenants.legalName, taxId: tenants.taxId, address: tenants.address })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return {
    invoice: {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      status: invoice.status,
      currency: invoice.currency.trim(),
      amount: Number(invoice.amount),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      issuedAt: invoice.createdAt,
    },
    billedTo: tenant ?? null,
  };
}

// ==========================================
// 4. USAGE METRICS (GET /billing/usage)
// ==========================================
export async function getBillingUsage(tenantId: string) {
  const [[metrics], [memberCount], entitlements] = await Promise.all([
    db.select().from(usageMetrics).where(eq(usageMetrics.tenantId, tenantId)).limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.status, "ACTIVE"),
        ),
      ),
    db
      .select()
      .from(tenantEntitlements)
      .where(eq(tenantEntitlements.tenantId, tenantId)),
  ]);

  const baseQuotas = entitlements[0]?.quotas ?? {
    max_seats: 10,
    max_storage_mb: 1024,
    max_api_calls: 10000,
  };

  const activeSeats = Math.max(metrics?.seatsUsed ?? 1, memberCount?.count ?? 1);
  const storageUsedMb = metrics?.storageUsedMb ?? 0;
  const apiCallsUsed = metrics?.apiCallsUsed ?? 0;

  return {
    usage: {
      seats: {
        used: activeSeats,
        limit: baseQuotas.max_seats,
        percent: baseQuotas.max_seats > 0 ? Math.min(100, Math.round((activeSeats / baseQuotas.max_seats) * 100)) : 0,
      },
      storageMb: {
        used: storageUsedMb,
        limit: baseQuotas.max_storage_mb,
        percent: baseQuotas.max_storage_mb > 0 ? Math.min(100, Math.round((storageUsedMb / baseQuotas.max_storage_mb) * 100)) : 0,
      },
      apiCalls: {
        used: apiCallsUsed,
        limit: baseQuotas.max_api_calls,
        percent: baseQuotas.max_api_calls > 0 ? Math.min(100, Math.round((apiCallsUsed / baseQuotas.max_api_calls) * 100)) : 0,
      },
      updatedAt: metrics?.updatedAt ?? new Date(),
    },
    modules: entitlements.map((e) => ({
      moduleCode: e.moduleCode,
      isEnabled: e.isEnabled,
      quotas: e.quotas,
    })),
  };
}

// ==========================================
// 5. START CHECKOUT (POST /billing/checkout)
// ==========================================
export async function startBillingCheckout(
  tenantId: string,
  actorUserId: string,
  input: CheckoutInput,
  requestId?: string,
) {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, input.planId), eq(subscriptionPlans.active, true)))
    .limit(1);

  if (!plan) {
    throw Errors.notFound("Selected subscription plan not found or inactive.");
  }

  const currency = plan.currency.trim();
  const calc = calculateInvoiceAmounts(Number(plan.price), currency);
  const now = new Date();
  const periodEnd = calculatePeriodEnd(now, plan.billingInterval);
  const checkoutSessionId = `chk_${randomUUID().replace(/-/g, "")}`;
  const invoiceNo = `SUB-${now.getFullYear()}-${String(Date.now()).slice(-6)}`;

  const result = await db.transaction(async (tx) => {
    // Ensure tenant has a subscription record
    const [existingSub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    let subscriptionId = existingSub?.id;
    if (!subscriptionId) {
      const [createdSub] = await tx
        .insert(subscriptions)
        .values({
          tenantId,
          planId: plan.id,
          status: "TRIAL",
          startsAt: now,
          endsAt: periodEnd,
        })
        .returning();
      subscriptionId = createdSub.id;
    }

    const dueDateStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [invoice] = await tx
      .insert(subscriptionInvoices)
      .values({
        tenantId,
        subscriptionId,
        invoiceNo,
        amount: calc.amount,
        tax: calc.tax,
        total: calc.total,
        currency,
        status: "ISSUED",
        dueDate: dueDateStr,
      })
      .returning();

    const [paymentTx] = await tx
      .insert(paymentTransactions)
      .values({
        tenantId,
        invoiceId: invoice.id,
        provider: input.provider,
        providerPaymentId: checkoutSessionId,
        amount: calc.total,
        currency,
        status: "PENDING",
        rawPayload: {
          planId: plan.id,
          planCode: plan.code,
          successUrl: input.successUrl ?? null,
          cancelUrl: input.cancelUrl ?? null,
        },
      })
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "BILLING.CHECKOUT.START",
      entityType: "payment_transaction",
      entityId: paymentTx.id,
      afterData: {
        planId: plan.id,
        planCode: plan.code,
        provider: input.provider,
        total: calc.numericTotal,
        currency,
        invoiceNo,
      },
      requestId,
    });

    return { invoice, paymentTx };
  });

  const checkoutUrl =
    input.provider === "STRIPE"
      ? `https://checkout.stripe.com/pay/${checkoutSessionId}`
      : `https://checkout.razorpay.com/v1/checkout/${checkoutSessionId}`;

  return {
    checkout: {
      sessionId: checkoutSessionId,
      provider: input.provider,
      checkoutUrl,
      plan: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        billingInterval: plan.billingInterval,
      },
      invoice: {
        id: result.invoice.id,
        invoiceNo: result.invoice.invoiceNo,
        amount: calc.numericAmount,
        tax: calc.numericTax,
        total: calc.numericTotal,
        currency,
      },
    },
    message: "Checkout session initiated successfully.",
  };
}

// ==========================================
// 6. CHANGE PLAN / UPGRADE / DOWNGRADE (POST /billing/change-plan)
// ==========================================
export async function changeSubscriptionPlan(
  tenantId: string,
  actorUserId: string,
  input: ChangePlanInput,
  requestId?: string,
) {
  const [targetPlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, input.planId), eq(subscriptionPlans.active, true)))
    .limit(1);

  if (!targetPlan) {
    throw Errors.notFound("Target subscription plan not found or inactive.");
  }

  const featureRows = await db
    .select()
    .from(planFeatures)
    .where(eq(planFeatures.planId, targetPlan.id));

  const featureMap = new Map(featureRows.map((f) => [f.moduleCode, f.enabled]));

  const now = new Date();
  const periodEnd = calculatePeriodEnd(now, targetPlan.billingInterval);
  const currency = targetPlan.currency.trim();
  const calc = calculateInvoiceAmounts(Number(targetPlan.price), currency);

  const updated = await db.transaction(async (tx) => {
    const [existingSub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    const previousPlanId = existingSub?.planId ?? null;

    let subRow;
    if (existingSub) {
      const [row] = await tx
        .update(subscriptions)
        .set({
          planId: targetPlan.id,
          status: "ACTIVE",
          startsAt: now,
          endsAt: periodEnd,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existingSub.id))
        .returning();
      subRow = row;
    } else {
      const [row] = await tx
        .insert(subscriptions)
        .values({
          tenantId,
          planId: targetPlan.id,
          status: "ACTIVE",
          startsAt: now,
          endsAt: periodEnd,
          cancelAtPeriodEnd: false,
        })
        .returning();
      subRow = row;
    }

    // Update tenant record
    await tx
      .update(tenants)
      .set({
        planId: targetPlan.id,
        status: "ACTIVE",
        updatedAt: now,
      })
      .where(eq(tenants.id, tenantId));

    // Sync tenant module entitlements and quotas with new plan
    const newQuotas = {
      max_seats: targetPlan.quotas.max_seats ?? 10,
      max_storage_mb: targetPlan.quotas.max_storage_mb ?? 1024,
      max_api_calls: targetPlan.quotas.api_rate_limit ?? 10000,
    };

    for (const moduleCode of MODULE_CODES) {
      const isEnabled = featureMap.has(moduleCode) ? Boolean(featureMap.get(moduleCode)) : true;
      const [existingEnt] = await tx
        .select()
        .from(tenantEntitlements)
        .where(
          and(
            eq(tenantEntitlements.tenantId, tenantId),
            eq(tenantEntitlements.moduleCode, moduleCode),
          ),
        )
        .limit(1);

      if (existingEnt) {
        await tx
          .update(tenantEntitlements)
          .set({
            isEnabled,
            quotas: newQuotas,
            entitlementVersion: existingEnt.entitlementVersion + 1,
            updatedAt: now,
          })
          .where(eq(tenantEntitlements.id, existingEnt.id));
      } else {
        await tx.insert(tenantEntitlements).values({
          tenantId,
          moduleCode,
          isEnabled,
          quotas: newQuotas,
          entitlementVersion: 1,
        });
      }
    }

    // Create plan change invoice
    const invoiceNo = `CHG-${now.getFullYear()}-${String(Date.now()).slice(-6)}`;
    const [invoice] = await tx
      .insert(subscriptionInvoices)
      .values({
        tenantId,
        subscriptionId: subRow.id,
        invoiceNo,
        amount: calc.amount,
        tax: calc.tax,
        total: calc.total,
        currency,
        status: calc.numericTotal === 0 ? "PAID" : "ISSUED",
        dueDate: now.toISOString().slice(0, 10),
        paidAt: calc.numericTotal === 0 ? now : null,
      })
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "BILLING.PLAN.CHANGE",
      entityType: "subscription",
      entityId: subRow.id,
      beforeData: { planId: previousPlanId },
      afterData: {
        planId: targetPlan.id,
        planCode: targetPlan.code,
        prorationMode: input.prorationMode,
        total: calc.numericTotal,
      },
      requestId,
    });

    return { subRow, invoice };
  });

  return {
    subscription: {
      id: updated.subRow.id,
      planId: updated.subRow.planId,
      planName: targetPlan.name,
      status: updated.subRow.status,
      startsAt: updated.subRow.startsAt,
      endsAt: updated.subRow.endsAt,
    },
    invoice: {
      id: updated.invoice.id,
      invoiceNo: updated.invoice.invoiceNo,
      total: calc.numericTotal,
      currency,
      status: updated.invoice.status,
    },
    message: `Subscription successfully switched to '${targetPlan.name}'.`,
  };
}

// ==========================================
// 7. CANCEL SUBSCRIPTION (POST /billing/cancel)
// ==========================================
export async function cancelSubscription(
  tenantId: string,
  actorUserId: string,
  input: CancelSubscriptionInput,
  requestId?: string,
) {
  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!existingSub) {
    throw Errors.notFound("No active subscription found for your company.");
  }

  if (existingSub.status === "CANCELLED") {
    throw Errors.conflict("Subscription is already cancelled.");
  }

  const now = new Date();
  const updated = await db.transaction(async (tx) => {
    const newStatus = input.cancelAtPeriodEnd ? existingSub.status : "CANCELLED";

    const [row] = await tx
      .update(subscriptions)
      .set({
        status: newStatus,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existingSub.id))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "BILLING.SUBSCRIPTION.CANCEL",
      entityType: "subscription",
      entityId: row.id,
      beforeData: {
        status: existingSub.status,
        cancelAtPeriodEnd: existingSub.cancelAtPeriodEnd,
      },
      afterData: {
        status: row.status,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        reason: input.reason ?? null,
      },
      reason: input.reason,
      requestId,
    });

    return row;
  });

  return {
    subscription: {
      id: updated.id,
      status: updated.status,
      cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
      endsAt: updated.endsAt,
    },
    message: input.cancelAtPeriodEnd
      ? "Subscription scheduled to cancel at the end of the current billing period."
      : "Subscription has been cancelled immediately.",
  };
}
