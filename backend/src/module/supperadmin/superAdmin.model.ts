// Super Admin module ke input/output models (Tenants Lifecycle + Module Entitlements).
import { z } from "zod";
import { MODULE_CODES, TENANT_STATUSES, type ModuleQuotas, type TenantStatus } from "../../db/schema";

const isValidTimezone = (tz: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const phoneField = z
  .string()
  .trim()
  .transform((val) => (val === "" ? undefined : val.replace(/[\s-]+/g, "")))
  .refine((val) => val === undefined || /^\+[1-9]\d{6,14}$/.test(val), {
    message: "Phone number country code ke sath dalein (jaise +919876543210)",
  })
  .optional();

const timezoneField = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(isValidTimezone, { message: "Valid IANA timezone dalein (jaise Asia/Kolkata)" });

const currencyField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Default currency 3-letter code mein honi chahiye (jaise INR, USD)");

export const tenantIdParamSchema = z.uuid("Invalid tenant UUID");

export const tenantListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z
    .string()
    .trim()
    .max(120)
    .transform((val) => (val === "" ? undefined : val))
    .optional(),
  status: z.enum(TENANT_STATUSES).optional(),
  plan_id: z.uuid("Invalid plan_id UUID").optional(),
});

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Company name kam se kam 2 characters ka hona chahiye")
    .max(200, "Company name bahut lamba hai"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug kam se kam 2 characters ka hona chahiye")
    .max(120, "Slug bahut lamba hai")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug sirf lowercase letters, numbers aur hyphens (-) mein hona chahiye",
    ),
  status: z.enum(TENANT_STATUSES).default("TRIAL"),
  timezone: timezoneField.default("Asia/Kolkata"),
  default_currency: currencyField.default("INR"),
  plan_id: z.uuid("Invalid plan_id UUID").nullable().optional(),
  owner: z.object({
    full_name: z
      .string()
      .trim()
      .min(2, "Owner full name kam se kam 2 characters ka hona chahiye")
      .max(100),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Owner email is required")
      .pipe(z.email("Valid owner email dalein")),
    phone: phoneField,
    password: z
      .string()
      .min(8, "Password kam se kam 8 characters ka hona chahiye")
      .max(128)
      .optional(),
  }),
});

export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    timezone: timezoneField.optional(),
    default_currency: currencyField.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.timezone !== undefined ||
      data.default_currency !== undefined,
    { message: "Kam se kam ek field (name, timezone, default_currency) update karne ke liye bhejein" },
  );

export const updateTenantStatusSchema = z.object({
  status: z.enum(TENANT_STATUSES),
  reason: z
    .string()
    .trim()
    .min(3, "Lifecycle action ke liye reason kam se kam 3 characters ka hona chahiye")
    .max(500),
});

export const moduleEntitlementItemSchema = z.object({
  module_code: z.enum(MODULE_CODES),
  is_enabled: z.boolean(),
  quotas: z.object({
    max_seats: z.number().int().min(1),
    max_storage_mb: z.number().int().min(0),
    max_api_calls: z.number().int().min(0),
  }),
});

export const updateEntitlementsSchema = z.object({
  modules: z
    .array(moduleEntitlementItemSchema)
    .min(1, "Kam se kam ek module entitlement dena zaroori hai")
    .refine(
      (items) => new Set(items.map((i) => i.module_code)).size === items.length,
      { message: "Duplicate module_code allowed nahi hai" },
    ),
});

export type TenantListQuery = z.infer<typeof tenantListQuerySchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type UpdateTenantStatusInput = z.infer<typeof updateTenantStatusSchema>;
export type UpdateEntitlementsInput = z.infer<typeof updateEntitlementsSchema>;

export interface TenantOwnerInfo {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

export interface TenantUsageInfo {
  seats_used: number;
  storage_used_mb: number;
  api_calls_used: number;
}

export interface TenantEntitlementItem {
  module_code: string;
  is_enabled: boolean;
  quotas: ModuleQuotas;
  entitlement_version: number;
}

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  timezone: string;
  default_currency: string;
  plan_id: string | null;
  created_at: Date;
  updated_at: Date;
  owner: TenantOwnerInfo | null;
}

export interface TenantDetail extends TenantListItem {
  current_plan: { plan_id: string | null };
  current_usage: TenantUsageInfo;
  entitlements: TenantEntitlementItem[];
}

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD format mein honi chahiye")
  .refine((val) => {
    const parsed = new Date(`${val}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(val);
  }, "Valid calendar date dalein");

export const dashboardQuerySchema = z
  .object({
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
  })
  .refine(
    (data) => {
      if (!data.from || !data.to) return true;
      return data.from <= data.to;
    },
    { message: "'from' date 'to' date se badi nahi ho sakti", path: ["from"] },
  );

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export interface CurrencyRevenue {
  currency: string;
  mrr: number;
  arr: number;
}

export interface PlanMixItem {
  plan_id: string | null;
  plan_name: string;
  tenant_count: number;
}

export interface DashboardOverview {
  period: {
    from: string;
    to: string;
  };
  total_tenants: number;
  tenants_by_status: Record<TenantStatus, number>;
  active_subscriptions: number;
  mrr: number;
  arr: number;
  revenue_by_currency: CurrencyRevenue[];
  plan_mix: PlanMixItem[];
  failed_payments_count: number;
  churn_rate: number;
  recent_tenants: TenantListItem[];
}
