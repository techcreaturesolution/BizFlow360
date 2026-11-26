// Subscriptions & Billing service: subscriptions list, manual adjustments, invoices, payments, aur webhooks.
import { createHmac, timingSafeEqual } from "crypto";
import { and, count, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import type { IncomingHttpHeaders } from "http";
import { env } from "../../config/env";
import { db } from "../../db";
import {
  paymentTransactions,
  sessions,
  subscriptionInvoices,
  subscriptionPlans,
  subscriptions,
  tenants,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { pageMeta, type PageMeta } from "../../lib/response";
import type {
  AdjustSubscriptionInput,
  InvoiceItem,
  InvoiceListQuery,
  PaymentListQuery,
  PaymentTransactionItem,
  SubscriptionListItem,
  SubscriptionListQuery,
  WebhookPayload,
  WebhookProvider,
} from "./billing.model";

function mapPaymentRow(
  row: typeof paymentTransactions.$inferSelect,
  tenantName: string | null,
): PaymentTransactionItem {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    tenant_name: tenantName,
    invoice_id: row.invoiceId ?? null,
    provider: row.provider,
    provider_event_id: row.providerEventId ?? null,
    provider_payment_id: row.providerPaymentId ?? null,
    amount: Number(row.amount),
    currency: row.currency.trim(),
    status: row.status,
    raw_payload: row.rawPayload ?? null,
    created_at: row.createdAt,
  };
}

export async function listSubscriptions(
  query: SubscriptionListQuery,
): Promise<{ items: SubscriptionListItem[]; meta: PageMeta }> {
  const conditions = [];
  if (query.status) conditions.push(eq(subscriptions.status, query.status));
  if (query.plan_id) conditions.push(eq(subscriptions.planId, query.plan_id));
  if (query.tenant_id) conditions.push(eq(subscriptions.tenantId, query.tenant_id));

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        sub: subscriptions,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        planCode: subscriptionPlans.code,
        planName: subscriptionPlans.name,
        billingInterval: subscriptionPlans.billingInterval,
        planPrice: subscriptionPlans.price,
        planCurrency: subscriptionPlans.currency,
      })
      .from(subscriptions)
      .leftJoin(tenants, eq(tenants.id, subscriptions.tenantId))
      .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
      .where(whereClause)
      .orderBy(desc(subscriptions.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ total: count() }).from(subscriptions).where(whereClause),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    items: rows.map((r) => ({
      id: r.sub.id,
      tenant_id: r.sub.tenantId,
      tenant_name: r.tenantName ?? null,
      tenant_slug: r.tenantSlug ?? null,
      plan_id: r.sub.planId,
      plan_code: r.planCode ?? null,
      plan_name: r.planName ?? null,
      billing_interval: r.billingInterval ?? null,
      plan_price: r.planPrice !== null ? Number(r.planPrice) : null,
      plan_currency: r.planCurrency ? r.planCurrency.trim() : null,
      status: r.sub.status,
      starts_at: r.sub.startsAt,
      ends_at: r.sub.endsAt,
      trial_ends_at: r.sub.trialEndsAt ?? null,
      cancel_at_period_end: r.sub.cancelAtPeriodEnd,
      provider_customer_ref: r.sub.providerCustomerRef ?? null,
      provider_subscription_ref: r.sub.providerSubscriptionRef ?? null,
      created_at: r.sub.createdAt,
      updated_at: r.sub.updatedAt,
    })),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function adjustSubscription(
  subscriptionId: string,
  input: AdjustSubscriptionInput,
  actorUserId: string,
  requestId?: string,
): Promise<SubscriptionListItem> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  if (!sub) {
    throw Errors.notFound("Subscription not found");
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    const subUpdates: Partial<typeof subscriptions.$inferInsert> = { updatedAt: now };
    const tenantUpdates: Partial<typeof tenants.$inferInsert> = { updatedAt: now };

    if (input.adjustment_type === "EXTEND_TRIAL") {
      const trialEnd = new Date(input.trial_ends_at!);
      subUpdates.trialEndsAt = trialEnd;
      if (trialEnd > sub.endsAt) {
        subUpdates.endsAt = trialEnd;
      }
      subUpdates.status = "TRIAL";
      tenantUpdates.status = "TRIAL";
    } else if (input.adjustment_type === "CHANGE_PLAN") {
      const [plan] = await tx
        .select({ id: subscriptionPlans.id })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, input.plan_id!))
        .limit(1);

      if (!plan) {
        throw Errors.notFound("Target subscription plan not found");
      }

      subUpdates.planId = plan.id;
      tenantUpdates.planId = plan.id;
    } else if (input.adjustment_type === "MANUAL_ACTIVATE") {
      subUpdates.status = "ACTIVE";
      subUpdates.cancelAtPeriodEnd = false;
      tenantUpdates.status = "ACTIVE";
    } else if (input.adjustment_type === "SUSPEND") {
      subUpdates.status = "SUSPENDED";
      tenantUpdates.status = "SUSPENDED";

      await tx
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.tenantId, sub.tenantId), isNull(sessions.revokedAt)));
    } else if (input.adjustment_type === "MARK_INVOICE_PAID") {
      const invoiceFilter = input.invoice_id
        ? and(
            eq(subscriptionInvoices.id, input.invoice_id),
            eq(subscriptionInvoices.subscriptionId, sub.id),
          )
        : and(
            eq(subscriptionInvoices.subscriptionId, sub.id),
            inArray(subscriptionInvoices.status, ["DRAFT", "ISSUED", "OVERDUE"]),
          );

      const [targetInvoice] = await tx
        .select()
        .from(subscriptionInvoices)
        .where(invoiceFilter)
        .orderBy(desc(subscriptionInvoices.createdAt))
        .limit(1);

      if (!targetInvoice) {
        throw Errors.notFound("Unpaid invoice not found for this subscription");
      }
      if (targetInvoice.status === "PAID") {
        throw Errors.conflict("Invoice is already marked PAID");
      }

      await tx
        .update(subscriptionInvoices)
        .set({ status: "PAID", paidAt: now, updatedAt: now })
        .where(eq(subscriptionInvoices.id, targetInvoice.id));

      await tx.insert(paymentTransactions).values({
        tenantId: sub.tenantId,
        invoiceId: targetInvoice.id,
        provider: "MANUAL",
        providerEventId: null,
        providerPaymentId: `MANUAL-${targetInvoice.invoiceNo}`,
        amount: targetInvoice.total,
        currency: targetInvoice.currency,
        status: "SUCCEEDED",
        rawPayload: { reason: input.reason, actorUserId },
      });

      subUpdates.status = "ACTIVE";
      tenantUpdates.status = "ACTIVE";
    }

    await tx.update(subscriptions).set(subUpdates).where(eq(subscriptions.id, sub.id));
    await tx.update(tenants).set(tenantUpdates).where(eq(tenants.id, sub.tenantId));

    await writeAudit(tx, {
      tenantId: sub.tenantId,
      actorUserId,
      action: `SUBSCRIPTION.${input.adjustment_type}`,
      entityType: "subscription",
      entityId: sub.id,
      beforeData: { status: sub.status, plan_id: sub.planId, trial_ends_at: sub.trialEndsAt },
      afterData: {
        status: subUpdates.status ?? sub.status,
        plan_id: subUpdates.planId ?? sub.planId,
        trial_ends_at: subUpdates.trialEndsAt ?? sub.trialEndsAt,
        invoice_id: input.invoice_id ?? null,
      },
      reason: input.reason,
      requestId,
    });
  });

  const { items } = await listSubscriptions({ page: 1, limit: 1, tenant_id: sub.tenantId });
  const updated = items.find((i) => i.id === sub.id);
  if (!updated) throw Errors.notFound("Subscription not found");
  return updated;
}

export async function listInvoices(
  query: InvoiceListQuery,
): Promise<{ items: InvoiceItem[]; meta: PageMeta }> {
  const conditions = [];
  if (query.tenant_id) conditions.push(eq(subscriptionInvoices.tenantId, query.tenant_id));
  if (query.status) conditions.push(eq(subscriptionInvoices.status, query.status));
  if (query.from) {
    conditions.push(gte(subscriptionInvoices.createdAt, new Date(`${query.from}T00:00:00.000Z`)));
  }
  if (query.to) {
    conditions.push(lte(subscriptionInvoices.createdAt, new Date(`${query.to}T23:59:59.999Z`)));
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        inv: subscriptionInvoices,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
      })
      .from(subscriptionInvoices)
      .leftJoin(tenants, eq(tenants.id, subscriptionInvoices.tenantId))
      .where(whereClause)
      .orderBy(desc(subscriptionInvoices.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ total: count() }).from(subscriptionInvoices).where(whereClause),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    items: rows.map((r) => ({
      id: r.inv.id,
      tenant_id: r.inv.tenantId,
      tenant_name: r.tenantName ?? null,
      tenant_slug: r.tenantSlug ?? null,
      subscription_id: r.inv.subscriptionId,
      invoice_no: r.inv.invoiceNo,
      amount: Number(r.inv.amount),
      tax: Number(r.inv.tax),
      total: Number(r.inv.total),
      currency: r.inv.currency.trim(),
      status: r.inv.status,
      due_date: r.inv.dueDate,
      paid_at: r.inv.paidAt ?? null,
      created_at: r.inv.createdAt,
      updated_at: r.inv.updatedAt,
    })),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function getInvoiceById(
  invoiceId: string,
): Promise<InvoiceItem & { payments: PaymentTransactionItem[] }> {
  const [row] = await db
    .select({
      inv: subscriptionInvoices,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(subscriptionInvoices)
    .leftJoin(tenants, eq(tenants.id, subscriptionInvoices.tenantId))
    .where(eq(subscriptionInvoices.id, invoiceId))
    .limit(1);

  if (!row) {
    throw Errors.notFound("Invoice not found");
  }

  const paymentRows = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.invoiceId, invoiceId))
    .orderBy(desc(paymentTransactions.createdAt));

  return {
    id: row.inv.id,
    tenant_id: row.inv.tenantId,
    tenant_name: row.tenantName ?? null,
    tenant_slug: row.tenantSlug ?? null,
    subscription_id: row.inv.subscriptionId,
    invoice_no: row.inv.invoiceNo,
    amount: Number(row.inv.amount),
    tax: Number(row.inv.tax),
    total: Number(row.inv.total),
    currency: row.inv.currency.trim(),
    status: row.inv.status,
    due_date: row.inv.dueDate,
    paid_at: row.inv.paidAt ?? null,
    created_at: row.inv.createdAt,
    updated_at: row.inv.updatedAt,
    payments: paymentRows.map((p) => mapPaymentRow(p, row.tenantName ?? null)),
  };
}

export async function listPayments(
  query: PaymentListQuery,
): Promise<{ items: PaymentTransactionItem[]; meta: PageMeta }> {
  const conditions = [];
  if (query.tenant_id) conditions.push(eq(paymentTransactions.tenantId, query.tenant_id));
  if (query.provider) conditions.push(eq(paymentTransactions.provider, query.provider));
  if (query.status) conditions.push(eq(paymentTransactions.status, query.status));
  if (query.from) {
    conditions.push(gte(paymentTransactions.createdAt, new Date(`${query.from}T00:00:00.000Z`)));
  }
  if (query.to) {
    conditions.push(lte(paymentTransactions.createdAt, new Date(`${query.to}T23:59:59.999Z`)));
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        payment: paymentTransactions,
        tenantName: tenants.name,
      })
      .from(paymentTransactions)
      .leftJoin(tenants, eq(tenants.id, paymentTransactions.tenantId))
      .where(whereClause)
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ total: count() }).from(paymentTransactions).where(whereClause),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    items: rows.map((r) => mapPaymentRow(r.payment, r.tenantName ?? null)),
    meta: pageMeta(query.page, query.limit, total),
  };
}

function verifyHexHmac(expectedHex: string, actualHex: string): boolean {
  const cleanActual = actualHex.trim().toLowerCase();
  if (!/^[a-f0-9]+$/i.test(cleanActual) || cleanActual.length !== expectedHex.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expectedHex, "utf8"), Buffer.from(cleanActual, "utf8"));
}

function verifyWebhookSignature(
  provider: WebhookProvider,
  rawBody: Buffer,
  headers: IncomingHttpHeaders,
): void {
  if (provider === "RAZORPAY") {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return;
    const sig = headers["x-razorpay-signature"];
    if (typeof sig !== "string" || !sig) {
      throw Errors.unauthorized("Missing Razorpay webhook signature");
    }
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!verifyHexHmac(expected, sig)) {
      throw Errors.unauthorized("Invalid Razorpay webhook signature");
    }
    return;
  }

  if (provider === "STRIPE") {
    const secret = env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return;
    const sigHeader = headers["stripe-signature"];
    if (typeof sigHeader !== "string" || !sigHeader) {
      throw Errors.unauthorized("Missing Stripe webhook signature");
    }
    const parts = Object.fromEntries(
      sigHeader.split(",").map((part) => {
        const [k, v] = part.trim().split("=");
        return [k, v];
      }),
    );
    if (!parts.t || !parts.v1) {
      throw Errors.unauthorized("Invalid Stripe signature format");
    }
    const signedPayload = `${parts.t}.${rawBody.toString("utf8")}`;
    const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
    if (!verifyHexHmac(expected, parts.v1)) {
      throw Errors.unauthorized("Invalid Stripe webhook signature");
    }
  }
}

function inferPaymentStatus(payload: WebhookPayload): "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" {
  if (payload.status) return payload.status;
  const eventName = (payload.event ?? payload.type ?? "").toLowerCase();
  if (eventName.includes("fail")) return "FAILED";
  if (eventName.includes("refund")) return "REFUNDED";
  if (
    eventName.includes("captured") ||
    eventName.includes("paid") ||
    eventName.includes("succeeded")
  ) {
    return "SUCCEEDED";
  }
  return "PENDING";
}

export async function processBillingWebhook(
  provider: WebhookProvider,
  rawBody: Buffer,
  headers: IncomingHttpHeaders,
  payload: WebhookPayload,
  requestId?: string,
): Promise<{ received: true; duplicate: boolean; event_id: string; status?: string }> {
  verifyWebhookSignature(provider, rawBody, headers);

  const headerEventId =
    typeof headers["x-razorpay-event-id"] === "string"
      ? headers["x-razorpay-event-id"]
      : undefined;

  const eventId = payload.event_id ?? payload.id ?? headerEventId;
  if (!eventId) {
    throw Errors.badRequest("Webhook event_id is required for idempotency");
  }

  // Idempotency check: duplicate webhook event par dobara process nahi hoga
  const [existingEvent] = await db
    .select({ id: paymentTransactions.id, status: paymentTransactions.status })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.providerEventId, eventId))
    .limit(1);

  if (existingEvent) {
    return {
      received: true,
      duplicate: true,
      event_id: eventId,
      status: existingEvent.status,
    };
  }

  let matchedSubscription: typeof subscriptions.$inferSelect | undefined;
  if (payload.subscription_id) {
    [matchedSubscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, payload.subscription_id))
      .limit(1);
  } else if (payload.provider_subscription_ref || payload.provider_customer_ref) {
    const refConds = [];
    if (payload.provider_subscription_ref) {
      refConds.push(eq(subscriptions.providerSubscriptionRef, payload.provider_subscription_ref));
    }
    if (payload.provider_customer_ref) {
      refConds.push(eq(subscriptions.providerCustomerRef, payload.provider_customer_ref));
    }
    [matchedSubscription] = await db
      .select()
      .from(subscriptions)
      .where(or(...refConds))
      .limit(1);
  }

  const tenantId = payload.tenant_id ?? matchedSubscription?.tenantId;
  if (!tenantId) {
    throw Errors.badRequest("Unable to resolve tenant for webhook event");
  }

  const paymentStatus = inferPaymentStatus(payload);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(paymentTransactions).values({
      tenantId,
      invoiceId: payload.invoice_id ?? null,
      provider,
      providerEventId: eventId,
      providerPaymentId: payload.provider_payment_id ?? null,
      amount: (payload.amount ?? 0).toFixed(2),
      currency: payload.currency ?? "INR",
      status: paymentStatus,
      rawPayload: payload,
    });

    if (paymentStatus === "SUCCEEDED") {
      if (payload.invoice_id) {
        await tx
          .update(subscriptionInvoices)
          .set({ status: "PAID", paidAt: now, updatedAt: now })
          .where(eq(subscriptionInvoices.id, payload.invoice_id));
      }
      if (matchedSubscription) {
        await tx
          .update(subscriptions)
          .set({ status: "ACTIVE", updatedAt: now })
          .where(eq(subscriptions.id, matchedSubscription.id));
      }
      await tx
        .update(tenants)
        .set({ status: "ACTIVE", updatedAt: now })
        .where(eq(tenants.id, tenantId));
    } else if (paymentStatus === "FAILED") {
      if (matchedSubscription) {
        await tx
          .update(subscriptions)
          .set({ status: "PAST_DUE", updatedAt: now })
          .where(eq(subscriptions.id, matchedSubscription.id));
      }
      await tx
        .update(tenants)
        .set({ status: "PAST_DUE", updatedAt: now })
        .where(eq(tenants.id, tenantId));
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId: null,
      action: `BILLING.WEBHOOK_${paymentStatus}`,
      entityType: "payment_transaction",
      entityId: matchedSubscription?.id ?? payload.invoice_id ?? null,
      afterData: { provider, event_id: eventId, status: paymentStatus, amount: payload.amount ?? 0 },
      requestId,
    });
  });

  return {
    received: true,
    duplicate: false,
    event_id: eventId,
    status: paymentStatus,
  };
}
