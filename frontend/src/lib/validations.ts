import { z } from "zod";
import type { ModuleCode, TenantStatus, AdjustmentType, BillingInterval } from "../types/platform";

export const isValidTimezone = (tz: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must not exceed 100 characters"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Email is required")
      .email("Please enter a valid email address"),
    phone: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => !val || /^\+[1-9]\d{6,14}$/.test(val.replace(/[\s-]+/g, "")),
        {
          message: "Please include country code (e.g. +919876543210)",
        }
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must not exceed 128 characters")
      .regex(/[A-Z]/, "Must contain at least 1 uppercase letter")
      .regex(/[0-9]/, "Must contain at least 1 number")
      .regex(/[^A-Za-z0-9]/, "Must contain at least 1 symbol"),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),
    companyName: z
      .string()
      .trim()
      .min(2, "Company name must be at least 2 characters")
      .max(120, "Company name must not exceed 120 characters"),
    workspaceSlug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, "Workspace slug must be at least 2 characters")
      .max(63, "Workspace slug must not exceed 63 characters")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug can only contain lowercase letters, numbers, and hyphens (e.g. apex-solutions)"
      ),
    timezone: z
      .string()
      .trim()
      .min(1, "Timezone is required")
      .refine(isValidTimezone, { message: "Invalid timezone selected" })
      .default("Asia/Kolkata"),
    defaultCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Currency must be a valid 3-letter ISO code")
      .default("INR"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password must not exceed 128 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Platform / Super Admin Schemas

export const TENANT_STATUSES: [TenantStatus, ...TenantStatus[]] = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "GRACE",
  "SUSPENDED",
  "CANCELLED",
  "ARCHIVED",
];

export const MODULE_CODES: [ModuleCode, ...ModuleCode[]] = [
  "CRM",
  "SALES",
  "FINANCE",
  "TASKS",
  "DOCUMENTS",
  "HR",
  "INVENTORY",
];

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tenant name must be at least 2 characters")
    .max(120, "Tenant name must not exceed 120 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug must be at least 2 characters")
    .max(63, "Slug must not exceed 63 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug can only contain lowercase alphanumeric characters and hyphens"
    ),
  status: z.enum(TENANT_STATUSES).default("TRIAL"),
  timezone: z.string().trim().default("Asia/Kolkata"),
  default_currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code")
    .default("INR"),
  plan_id: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
      { message: "Must be a valid UUID format" }
    ),
  owner: z.object({
    full_name: z
      .string()
      .trim()
      .min(2, "Owner name must be at least 2 characters")
      .max(100, "Owner name must not exceed 100 characters"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Owner email is required")
      .email("Must be a valid email address"),
    phone: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => !val || /^\+[1-9]\d{6,14}$/.test(val.replace(/[\s-]+/g, "")),
        { message: "Phone number must include country code (e.g. +919876543210)" }
      ),
    password: z
      .string()
      .optional()
      .refine((val) => !val || val.length >= 6, {
        message: "Password should be at least 6 characters if provided",
      }),
  }),
});

export type CreateTenantFormData = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tenant name must be at least 2 characters")
    .max(120, "Tenant name must not exceed 120 characters")
    .optional(),
  timezone: z.string().trim().optional(),
  default_currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be 3-letter uppercase code")
    .optional(),
});

export type UpdateTenantFormData = z.infer<typeof updateTenantSchema>;

export const updateTenantStatusSchema = z.object({
  status: z.enum(TENANT_STATUSES, {
    required_error: "Status selection is required",
  }),
  reason: z
    .string()
    .trim()
    .min(1, "Audit reason is required when changing status")
    .max(500, "Reason must not exceed 500 characters"),
});

export type UpdateTenantStatusFormData = z.infer<typeof updateTenantStatusSchema>;

export const dateRangeSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from) <= new Date(data.to);
      }
      return true;
    },
    {
      message: "Start date ('from') must be on or before end date ('to')",
      path: ["from"],
    }
  );

// 1) Plan Schemas
export const upsertPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(64, "Code must not exceed 64 characters")
    .regex(/^[A-Z0-9_-]+$/, "Code must contain uppercase letters, numbers, hyphens or underscores"),
  name: z
    .string()
    .trim()
    .min(2, "Plan name must be at least 2 characters")
    .max(120, "Plan name must not exceed 120 characters"),
  billing_interval: z.enum(["MONTHLY", "ANNUAL"]),
  price: z.coerce.number().min(0, "Price must be >= 0"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code")
    .default("INR"),
  trial_days: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
  quotas: z.object({
    max_seats: z.coerce.number().int().min(1, "Max seats must be at least 1"),
    max_storage_mb: z.coerce.number().int().min(0, "Storage must be >= 0"),
    api_rate_limit: z.coerce.number().int().min(0, "Rate limit must be >= 0"),
  }),
  modules: z.array(
    z.object({
      module_code: z.enum(MODULE_CODES),
      enabled: z.boolean(),
      limit: z
        .preprocess(
          (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
          z.number().int().min(0).nullable().optional()
        ),
    })
  ),
});

export type UpsertPlanFormData = z.infer<typeof upsertPlanSchema>;

// 2) Adjust Subscription Schema
export const adjustSubscriptionSchema = z
  .object({
    adjustment_type: z.enum([
      "EXTEND_TRIAL",
      "CHANGE_PLAN",
      "MANUAL_ACTIVATE",
      "MARK_INVOICE_PAID",
      "SUSPEND",
    ] as [AdjustmentType, ...AdjustmentType[]]),
    reason: z
      .string()
      .trim()
      .min(1, "Audit reason is required for adjustments")
      .max(500, "Reason must not exceed 500 characters"),
    plan_id: z.string().optional(),
    trial_ends_at: z.string().optional(),
    invoice_id: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.adjustment_type === "EXTEND_TRIAL") {
      if (!data.trial_ends_at || !data.trial_ends_at.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "New trial end date is required when extending trial",
          path: ["trial_ends_at"],
        });
      } else {
        const d = new Date(data.trial_ends_at);
        if (isNaN(d.getTime()) || d <= new Date()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Trial end date must be in the future",
            path: ["trial_ends_at"],
          });
        }
      }
    }

    if (data.adjustment_type === "CHANGE_PLAN") {
      if (!data.plan_id || !data.plan_id.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A target plan must be selected",
          path: ["plan_id"],
        });
      }
    }

    if (data.adjustment_type === "MARK_INVOICE_PAID") {
      if (!data.invoice_id || !data.invoice_id.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "An invoice must be selected",
          path: ["invoice_id"],
        });
      }
    }
  });

export type AdjustSubscriptionFormData = z.infer<typeof adjustSubscriptionSchema>;
