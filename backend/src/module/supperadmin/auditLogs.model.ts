// Audit Logs (read-only) ke input query filters aur response types.
import { z } from "zod";

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD format mein honi chahiye")
  .refine((val) => {
    const parsed = new Date(`${val}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(val);
  }, "Valid calendar date dalein");

export const auditLogIdParamSchema = z.uuid("Invalid audit log UUID");

export const auditLogListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    tenant_id: z.uuid("Invalid tenant_id UUID").optional(),
    actor_user_id: z.uuid("Invalid actor_user_id UUID").optional(),
    action: z
      .string()
      .trim()
      .max(80)
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
    entity_type: z
      .string()
      .trim()
      .max(100)
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
  })
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: "'from' date 'to' date se badi nahi ho sakti",
    path: ["from"],
  });

export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;

export interface AuditActorInfo {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
}

export interface AuditLogItem {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  actor_user_id: string | null;
  actor: AuditActorInfo | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  reason: string | null;
  request_id: string | null;
  created_at: Date;
}

export interface AuditDiffField {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditLogDetail extends AuditLogItem {
  diff: AuditDiffField[];
}
