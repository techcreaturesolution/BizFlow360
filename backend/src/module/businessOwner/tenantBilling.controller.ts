// Tenant Subscription & Billing Controller.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  cancelSubscriptionSchema,
  changePlanSchema,
  checkoutSchema,
  invoicesQuerySchema,
} from "./tenantBilling.model";
import {
  cancelSubscription,
  changeSubscriptionPlan,
  getBillingUsage,
  getCurrentSubscription,
  getTenantInvoiceDownload,
  listAvailablePlans,
  listTenantInvoices,
  startBillingCheckout,
} from "./tenantBilling.service";

function requireTenantId(req: Parameters<RequestHandler>[0]): string {
  const tenantId = req.auth?.tenantId;
  if (!tenantId) {
    throw Errors.forbidden("Operation requires an active tenant workspace context.");
  }
  return tenantId;
}

function requireUserId(req: Parameters<RequestHandler>[0]): string {
  const userId = req.auth?.userId;
  if (!userId) {
    throw Errors.unauthorized("Authentication required.");
  }
  return userId;
}

export const listAvailablePlansHandler: RequestHandler = async (_req, res) => {
  const result = await listAvailablePlans();
  return sendSuccess(res, result);
};

export const getCurrentSubscriptionHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const result = await getCurrentSubscription(tenantId);
  return sendSuccess(res, result);
};

export const listTenantInvoicesHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const query = invoicesQuerySchema.parse(req.query);
  const result = await listTenantInvoices(tenantId, query);
  return sendSuccess(res, result);
};

export const downloadTenantInvoiceHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const invoiceId = req.params.id as string;
  const result = await getTenantInvoiceDownload(tenantId, invoiceId);
  return sendSuccess(res, result);
};

export const getBillingUsageHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const result = await getBillingUsage(tenantId);
  return sendSuccess(res, result);
};

export const startBillingCheckoutHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = checkoutSchema.parse(req.body);
  const result = await startBillingCheckout(tenantId, actorUserId, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const changeSubscriptionPlanHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = changePlanSchema.parse(req.body);
  const result = await changeSubscriptionPlan(tenantId, actorUserId, input, req.requestId);
  return sendSuccess(res, result);
};

export const cancelSubscriptionHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = cancelSubscriptionSchema.parse(req.body);
  const result = await cancelSubscription(tenantId, actorUserId, input, req.requestId);
  return sendSuccess(res, result);
};
