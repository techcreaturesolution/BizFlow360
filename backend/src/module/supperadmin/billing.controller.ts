// Subscriptions & Billing controller + payment gateway webhook handler.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  adjustSubscriptionSchema,
  invoiceListQuerySchema,
  paymentListQuerySchema,
  subscriptionListQuerySchema,
  uuidParamSchema,
  webhookPayloadSchema,
  webhookProviderParamSchema,
} from "./billing.model";
import {
  adjustSubscription,
  getInvoiceById,
  listInvoices,
  listPayments,
  listSubscriptions,
  processBillingWebhook,
} from "./billing.service";

function requireActorId(userId?: string): string {
  if (!userId) throw Errors.unauthorized("Login required");
  return userId;
}

export const listSubscriptionsHandler: RequestHandler = async (req, res) => {
  const query = subscriptionListQuerySchema.parse(req.query);
  const { items, meta } = await listSubscriptions(query);
  return sendSuccess(res, items, { meta });
};

export const adjustSubscriptionHandler: RequestHandler = async (req, res) => {
  const actorId = requireActorId(req.auth?.userId);
  const subId = uuidParamSchema.parse(req.params.id);
  const input = adjustSubscriptionSchema.parse(req.body);
  const updated = await adjustSubscription(subId, input, actorId, req.requestId);
  return sendSuccess(res, updated);
};

export const listInvoicesHandler: RequestHandler = async (req, res) => {
  const query = invoiceListQuerySchema.parse(req.query);
  const { items, meta } = await listInvoices(query);
  return sendSuccess(res, items, { meta });
};

export const getInvoiceDetailHandler: RequestHandler = async (req, res) => {
  const invoiceId = uuidParamSchema.parse(req.params.id);
  const invoice = await getInvoiceById(invoiceId);
  return sendSuccess(res, invoice);
};

export const listPaymentsHandler: RequestHandler = async (req, res) => {
  const query = paymentListQuerySchema.parse(req.query);
  const { items, meta } = await listPayments(query);
  return sendSuccess(res, items, { meta });
};

export const billingWebhookHandler: RequestHandler = async (req, res) => {
  const provider = webhookProviderParamSchema.parse(req.params.provider);
  const payload = webhookPayloadSchema.parse(req.body);
  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
  const result = await processBillingWebhook(
    provider,
    rawBody,
    req.headers,
    payload,
    req.requestId,
  );
  return sendSuccess(res, result);
};
