// Subscriptions & Billing ke input/output models (States, Invoices, Adjustments, Webhooks).
import { z } from "zod";
import {
  INVOICE_STATUSES,
  PAYMENT_STATUSES,
  SUBSCRIPTION_STATUSES,
  type InvoiceStatus,
  type PaymentStatus,
  type SubscriptionStatus,
} from "../../db/schema";

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD format mein honi chahiye")
  .refine((val) => {
    const parsed = new Date(`${val}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(val);
  }, "Valid calendar date dalein");

export const ADJUSTMENT_TYPES = [
  "EXTEND_TRIAL",
  "CHANGE_PLAN",
  "MANUAL_ACTIVATE",
  "MARK_INVOICE_PAID",
  "SUSPEND",
] as const;

export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const uuidParamSchema = z.uuid("Invalid UUID");

export const subscriptionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  plan_id: z.uuid("Invalid plan_id UUID").optional(),
  tenant_id: z.uuid("Invalid tenant_id UUID").optional(),
});

export const adjustSubscriptionSchema = z
  .object({
    adjustment_type: z.enum(ADJUSTMENT_TYPES),
    plan_id: z.uuid("Invalid plan_id UUID").optional(),
    trial_ends_at: z.iso.datetime("trial_ends_at valid ISO datetime hona chahiye").optional(),
    invoice_id: z.uuid("Invalid invoice_id UUID").optional(),
    reason: z
      .string()
      .trim()
      .min(3, "Har manual billing adjustment ke liye reason kam se kam 3 characters ka ho")
      .max(500),
  })
  .superRefine((data, ctx) => {
    if (data.adjustment_type === "EXTEND_TRIAL" && !data.trial_ends_at) {
      ctx.addIssue({
        code: "custom",
        path: ["trial_ends_at"],
        message: "EXTEND_TRIAL ke liye trial_ends_at zaroori hai",
      });
    }
    if (data.adjustment_type === "CHANGE_PLAN" && !data.plan_id) {
      ctx.addIssue({
        code: "custom",
        path: ["plan_id"],
        message: "CHANGE_PLAN ke liye plan_id zaroori hai",
      });
    }
  });

export const invoiceListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    tenant_id: z.uuid("Invalid tenant_id UUID").optional(),
    status: z.enum(INVOICE_STATUSES).optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
  })
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: "'from' date 'to' date se badi nahi ho sakti",
    path: ["from"],
  });

export const paymentListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    tenant_id: z.uuid("Invalid tenant_id UUID").optional(),
    provider: z
      .string()
      .trim()
      .toUpperCase()
      .max(60)
      .transform((val) => (val === "" ? undefined : val))
      .optional(),
    status: z.enum(PAYMENT_STATUSES).optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
  })
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: "'from' date 'to' date se badi nahi ho sakti",
    path: ["from"],
  });

export const webhookProviderParamSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(["RAZORPAY", "STRIPE"]));

export const webhookPayloadSchema = z.object({
  event_id: z.string().trim().min(1).max(200).optional(),
  id: z.string().trim().min(1).max(200).optional(),
  event: z.string().trim().min(1).max(120).optional(),
  type: z.string().trim().min(1).max(120).optional(),
  tenant_id: z.uuid().optional(),
  invoice_id: z.uuid().optional(),
  subscription_id: z.uuid().optional(),
  provider_customer_ref: z.string().trim().max(160).optional(),
  provider_subscription_ref: z.string().trim().max(160).optional(),
  provider_payment_id: z.string().trim().max(200).optional(),
  amount: z.coerce.number().min(0).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
});

export type SubscriptionListQuery = z.infer<typeof subscriptionListQuerySchema>;
export type AdjustSubscriptionInput = z.infer<typeof adjustSubscriptionSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
export type WebhookProvider = z.infer<typeof webhookProviderParamSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export interface SubscriptionListItem {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  plan_id: string;
  plan_code: string | null;
  plan_name: string | null;
  billing_interval: string | null;
  plan_price: number | null;
  plan_currency: string | null;
  status: SubscriptionStatus;
  starts_at: Date;
  ends_at: Date;
  trial_ends_at: Date | null;
  cancel_at_period_end: boolean;
  provider_customer_ref: string | null;
  provider_subscription_ref: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceItem {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  subscription_id: string;
  invoice_no: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  due_date: string;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentTransactionItem {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  invoice_id: string | null;
  provider: string;
  provider_event_id: string | null;
  provider_payment_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus | string;
  raw_payload: unknown;
  created_at: Date;
}
