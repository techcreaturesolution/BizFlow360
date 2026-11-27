// Approvals & Notifications Controller.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  approvalInboxQuerySchema,
  approveDecisionSchema,
  notificationsQuerySchema,
  rejectDecisionSchema,
  updateNotificationPreferencesSchema,
} from "./approvalsNotifications.model";
import {
  decideApprovalRequest,
  getApprovalInbox,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "./approvalsNotifications.service";

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

export const getApprovalInboxHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const query = approvalInboxQuerySchema.parse(req.query);
  const result = await getApprovalInbox(tenantId, query);
  return sendSuccess(res, result);
};

export const approveRequestHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const approvalId = req.params.id as string;
  const input = approveDecisionSchema.parse(req.body ?? {});
  const result = await decideApprovalRequest(
    tenantId,
    actorUserId,
    approvalId,
    "APPROVED",
    input,
    req.requestId,
  );
  return sendSuccess(res, result);
};

export const rejectRequestHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const approvalId = req.params.id as string;
  const input = rejectDecisionSchema.parse(req.body ?? {});
  const result = await decideApprovalRequest(
    tenantId,
    actorUserId,
    approvalId,
    "REJECTED",
    input,
    req.requestId,
  );
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
