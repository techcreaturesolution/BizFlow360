// Approvals & Notifications Controller.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  approvalInboxQuerySchema,
  approveDecisionSchema,
  notificationsQuerySchema,
  rejectDecisionSchema,
  tenantAuditLogsQuerySchema,
  updateNotificationPreferencesSchema,
} from "./approvalsNotifications.model";
import {
  decideApprovalRequest,
  getApprovalInbox,
  getNotificationPreferences,
  getWorkflowInstanceHistory,
  listNotifications,
  listTenantAuditLogs,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "./approvalsNotifications.service";

function requireAuthTenant(req: Parameters<RequestHandler>[0]) {
  if (!req.auth || !req.auth.tenantId) {
    throw Errors.forbidden("Operation requires an active tenant workspace context.");
  }
  return req.auth;
}

function requireTenantId(req: Parameters<RequestHandler>[0]): string {
  return requireAuthTenant(req).tenantId!;
}

function requireUserId(req: Parameters<RequestHandler>[0]): string {
  return requireAuthTenant(req).userId;
}

export const getApprovalInboxHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = approvalInboxQuerySchema.parse(req.query);
  const result = await getApprovalInbox(auth, query);
  return sendSuccess(res, result);
};

export const approveRequestHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const approvalId = req.params.id as string;
  const input = approveDecisionSchema.parse(req.body ?? {});
  const result = await decideApprovalRequest(auth, approvalId, "APPROVED", input, req.requestId);
  return sendSuccess(res, result);
};

export const rejectRequestHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const approvalId = req.params.id as string;
  const input = rejectDecisionSchema.parse(req.body ?? {});
  const result = await decideApprovalRequest(auth, approvalId, "REJECTED", input, req.requestId);
  return sendSuccess(res, result);
};

export const getWorkflowInstanceHistoryHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await getWorkflowInstanceHistory(auth, req.params.id as string);
  return sendSuccess(res, result);
};

export const listNotificationsHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);
  const query = notificationsQuerySchema.parse(req.query);
  const result = await listNotifications(tenantId, userId, query);
  return sendSuccess(res, result);
};

export const markNotificationReadHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);
  const notificationId = req.params.id as string;
  const result = await markNotificationRead(tenantId, userId, notificationId);
  return sendSuccess(res, result);
};

export const markAllNotificationsReadHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);
  const result = await markAllNotificationsRead(tenantId, userId);
  return sendSuccess(res, result);
};

export const getNotificationPreferencesHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);
  const result = await getNotificationPreferences(tenantId, userId);
  return sendSuccess(res, result);
};

export const updateNotificationPreferencesHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);
  const input = updateNotificationPreferencesSchema.parse(req.body);
  const result = await updateNotificationPreferences(tenantId, userId, input, req.requestId);
  return sendSuccess(res, result);
};

export const listTenantAuditLogsHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const query = tenantAuditLogsQuerySchema.parse(req.query);
  const result = await listTenantAuditLogs(tenantId, query);
  return sendSuccess(res, result);
};
