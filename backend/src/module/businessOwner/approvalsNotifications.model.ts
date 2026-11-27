// Approvals & Notifications validation schemas.
import { z } from "zod";
import {
  APPROVAL_ENTITY_TYPES,
  APPROVAL_STATUSES,
  NOTIFICATION_CATEGORIES,
} from "../../db/schema";

export const approvalInboxQuerySchema = z.object({
  status: z.enum(APPROVAL_STATUSES).optional(),
  entityType: z.enum(APPROVAL_ENTITY_TYPES).optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const approveDecisionSchema = z.object({
  comment: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const rejectDecisionSchema = z
  .object({
    comment: z.string().trim().max(500).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((d) => Boolean(d.reason || d.comment), {
    message: "Reject karne ke liye reason ya comment dena zaroori hai",
  });

export const notificationsQuerySchema = z.object({
  isRead: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  unread_only: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  channel: z.enum(["IN_APP", "EMAIL"]).optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateNotificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  emailApprovals: z.boolean().optional(),
  emailBilling: z.boolean().optional(),
  emailTeamUpdates: z.boolean().optional(),
  emailDigestDaily: z.boolean().optional(),
  inAppApprovals: z.boolean().optional(),
  inAppBilling: z.boolean().optional(),
  inAppMentions: z.boolean().optional(),
  inAppTasks: z.boolean().optional(),
});

export const tenantAuditLogsQuerySchema = z.object({
  actor_user_id: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional(),
  action: z.string().trim().optional(),
  entity_type: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ApprovalInboxQuery = z.infer<typeof approvalInboxQuerySchema>;
export type ApprovalDecisionInput = z.infer<typeof approveDecisionSchema>;
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
export type TenantAuditLogsQuery = z.infer<typeof tenantAuditLogsQuerySchema>;
