// Tenant Subscription & Billing validation models.
import { z } from "zod";
import { INVOICE_STATUSES } from "../../db/schema";

export const invoicesQuerySchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const checkoutSchema = z.object({
  planId: z.string().uuid("Valid Plan ID (UUID) dalein"),
  provider: z.enum(["RAZORPAY", "STRIPE"]).default("RAZORPAY"),
  successUrl: z.string().url("Valid success URL dalein").optional(),
  cancelUrl: z.string().url("Valid cancel URL dalein").optional(),
});

export const changePlanSchema = z.object({
  planId: z.string().uuid("Valid Plan ID (UUID) dalein"),
  prorationMode: z.enum(["IMMEDIATE", "NEXT_CYCLE"]).default("IMMEDIATE"),
});

export const cancelSubscriptionSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
  reason: z.string().trim().max(500).optional(),
});

export type InvoicesQuery = z.infer<typeof invoicesQuerySchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
