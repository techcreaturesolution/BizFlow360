// Plans (Plan Editor) ke input/output models.
import { z } from "zod";
import {
  BILLING_INTERVALS,
  MODULE_CODES,
  type BillingInterval,
  type PlanQuotas,
} from "../../db/schema";

export const planIdParamSchema = z.uuid("Invalid plan UUID");

export const planListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z
    .string()
    .trim()
    .max(120)
    .transform((val) => (val === "" ? undefined : val))
    .optional(),
  billing_interval: z.enum(BILLING_INTERVALS).optional(),
  active: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

export const planModuleSchema = z.object({
  module_code: z.enum(MODULE_CODES),
  enabled: z.boolean(),
  limit: z.number().int().min(0).nullable().default(null),
});

export const planQuotasSchema = z.object({
  max_seats: z.number().int().min(1, "max_seats kam se kam 1 hona chahiye"),
  max_storage_mb: z.number().int().min(0, "max_storage_mb negative nahi ho sakta"),
  api_rate_limit: z.number().int().min(1, "api_rate_limit kam se kam 1 hona chahiye"),
});

export const upsertPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Plan code kam se kam 2 characters ka hona chahiye")
    .max(60, "Plan code bahut lamba hai")
    .regex(
      /^[A-Z0-9_]+$/,
      "Plan code sirf uppercase letters, numbers aur underscore (_) mein hona chahiye (e.g. STARTER_MONTHLY)",
    ),
  name: z
    .string()
    .trim()
    .min(2, "Plan name kam se kam 2 characters ka hona chahiye")
    .max(120, "Plan name bahut lamba hai"),
  billing_interval: z.enum(BILLING_INTERVALS),
  price: z.coerce
    .number()
    .min(0, "Price negative nahi ho sakta")
    .max(999999999999.99, "Price limit se zyada hai"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency 3-letter code mein honi chahiye (e.g. INR, USD)")
    .default("INR"),
  trial_days: z.coerce.number().int().min(0).max(365).default(0),
  active: z.boolean().default(true),
  quotas: planQuotasSchema,
  modules: z
    .array(planModuleSchema)
    .min(1, "Kam se kam ek module feature dena zaroori hai")
    .refine(
      (items) => new Set(items.map((i) => i.module_code)).size === items.length,
      { message: "Duplicate module_code allowed nahi hai" },
    ),
});

export const updatePlanStatusSchema = z.object({
  active: z.boolean(),
});

export type PlanListQuery = z.infer<typeof planListQuerySchema>;
export type UpsertPlanInput = z.infer<typeof upsertPlanSchema>;
export type UpdatePlanStatusInput = z.infer<typeof updatePlanStatusSchema>;

export interface PlanFeatureItem {
  module_code: string;
  enabled: boolean;
  limit: number | null;
}

export interface PlanItem {
  id: string;
  code: string;
  name: string;
  billing_interval: BillingInterval;
  price: number;
  currency: string;
  trial_days: number;
  version: number;
  active: boolean;
  quotas: PlanQuotas;
  modules: PlanFeatureItem[];
  created_at: Date;
  updated_at: Date;
}
