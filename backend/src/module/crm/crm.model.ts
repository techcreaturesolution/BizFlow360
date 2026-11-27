// CRM Module validation schemas (Leads, Activities, Followups, Pipeline, Customers, Import).
import { z } from "zod";
import { CUSTOMER_TYPES, FOLLOWUP_STATUSES, LEAD_STAGES, PRIORITIES, ACTIVITY_TYPES } from "../../db/schema";

export const leadsQuerySchema = z.object({
  stage: z.enum(LEAD_STAGES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  source: z.string().trim().optional(),
  ownerUserId: z.string().uuid().optional(),
  owner_user_id: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const pipelineQuerySchema = z.object({
  ownerUserId: z.string().uuid().optional(),
  owner_user_id: z.string().uuid().optional(),
  period: z.enum(["TODAY", "7D", "30D", "90D", "YTD", "ALL"]).default("ALL"),
});

export const createLeadSchema = z.object({
  name: z.string().trim().min(2).max(200),
  companyName: z.string().trim().max(200).optional(),
  company_name: z.string().trim().max(200).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(40).optional(),
  source: z.string().trim().max(80).optional(),
  stage: z.enum(LEAD_STAGES).default("NEW"),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  estimatedValue: z.coerce.number().min(0).optional(),
  estimated_value: z.coerce.number().min(0).optional(),
  ownerUserId: z.string().uuid().optional(),
  owner_user_id: z.string().uuid().optional(),
  nextFollowupAt: z.string().datetime().optional(),
  next_followup_at: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

export const assignLeadSchema = z
  .object({
    ownerUserId: z.string().uuid("Valid User ID dalein").optional(),
    owner_user_id: z.string().uuid("Valid User ID dalein").optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => Boolean(data.ownerUserId || data.owner_user_id), {
    message: "ownerUserId ya owner_user_id required hai",
  });

export const createLeadActivitySchema = z
  .object({
    activityType: z.enum(ACTIVITY_TYPES).optional(),
    activity_type: z.enum(ACTIVITY_TYPES).optional(),
    summary: z.string().trim().min(1).max(500).optional(),
    subject: z.string().trim().min(1).max(500).optional(),
    body: z.string().trim().max(2000).optional(),
    occurredAt: z.string().datetime().optional(),
    occurred_at: z.string().datetime().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Boolean(data.summary || data.subject), {
    message: "summary ya subject required hai",
  });

export const createLeadFollowupSchema = z
  .object({
    scheduledAt: z.string().datetime("Valid ISO datetime dalein").optional(),
    next_followup_at: z.string().datetime("Valid ISO datetime dalein").optional(),
    assignedToUserId: z.string().uuid().optional(),
    assignee_user_id: z.string().uuid().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => Boolean(data.scheduledAt || data.next_followup_at), {
    message: "scheduledAt ya next_followup_at required hai",
  });

export const updateFollowupSchema = z.object({
  status: z.enum(FOLLOWUP_STATUSES).optional(),
  scheduledAt: z.string().datetime().optional(),
  rescheduled_at: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const convertLeadSchema = z.object({
  customerCode: z.string().trim().min(2).max(60).optional(),
  customer_code: z.string().trim().min(2).max(60).optional(),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  customer_type: z.enum(CUSTOMER_TYPES).optional(),
  taxId: z.string().trim().max(100).optional(),
  tax_id: z.string().trim().max(100).optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  payment_terms_days: z.coerce.number().int().min(0).max(365).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  credit_limit: z.coerce.number().min(0).optional(),
});

export const importLeadsSchema = z
  .object({
    csvText: z.string().trim().min(1).optional(),
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    mapping: z.record(z.string(), z.string()).optional(),
    defaultOwnerUserId: z.string().uuid().optional(),
  })
  .refine((data) => Boolean(data.csvText || (data.rows && data.rows.length > 0)), {
    message: "csvText ya kam se kam 1 row import ke liye bhejein",
  });

export const customersQuerySchema = z.object({
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  customer_type: z.enum(CUSTOMER_TYPES).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCustomerSchema = z.object({
  customerCode: z.string().trim().min(2).max(60).optional(),
  customer_code: z.string().trim().min(2).max(60).optional(),
  name: z.string().trim().min(2).max(200),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  customer_type: z.enum(CUSTOMER_TYPES).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(40).optional(),
  taxId: z.string().trim().max(100).optional(),
  tax_id: z.string().trim().max(100).optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  payment_terms_days: z.coerce.number().int().min(0).max(365).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  credit_limit: z.coerce.number().min(0).optional(),
  billingAddress: z.record(z.string(), z.unknown()).optional(),
  billing_address: z.record(z.string(), z.unknown()).optional(),
});

export type LeadsQuery = z.infer<typeof leadsQuerySchema>;
export type PipelineQuery = z.infer<typeof pipelineQuerySchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;
export type CreateLeadActivityInput = z.infer<typeof createLeadActivitySchema>;
export type CreateLeadFollowupInput = z.infer<typeof createLeadFollowupSchema>;
export type UpdateFollowupInput = z.infer<typeof updateFollowupSchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type ImportLeadsInput = z.infer<typeof importLeadsSchema>;
export type CustomersQuery = z.infer<typeof customersQuerySchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
