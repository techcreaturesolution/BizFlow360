// Business Owner Controller: Handles HTTP endpoints for Team, Invitations, User Status, Roles & RBAC.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  assignRolePermissionsSchema,
  assignUserRolesSchema,
  createRoleSchema,
  inviteMemberSchema,
  teamMembersQuerySchema,
  updateRoleSchema,
  updateUserStatusSchema,
} from "./businessOwner.model";
import {
  assignRolePermissions,
  assignUserRoles,
  createCustomRole,
  deleteCustomRole,
  getRoles,
  getTeamMembers,
  inviteTeamMember,
  listPendingInvitations,
  listPermissionsCatalog,
  revokeInvitation,
  updateCustomRole,
  updateUserStatus,
} from "./businessOwner.service";

// Helper: strictly enforce tenantId comes from verified JWT & membership context
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

export const getTeamMembersHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const query = teamMembersQuerySchema.parse(req.query);
  const result = await getTeamMembers(tenantId, query);
  return sendSuccess(res, result);
};

export const inviteMemberHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = inviteMemberSchema.parse(req.body);
  const result = await inviteTeamMember(tenantId, actorUserId, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const updateUserStatusHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const targetUserId = req.params.id as string;
  const input = updateUserStatusSchema.parse(req.body);
  const result = await updateUserStatus(tenantId, actorUserId, targetUserId, input, req.requestId);
  return sendSuccess(res, result);
};

export const getRolesHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const result = await getRoles(tenantId);
  return sendSuccess(res, result);
};

export const createRoleHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = createRoleSchema.parse(req.body);
  const result = await createCustomRole(tenantId, actorUserId, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const assignRolePermissionsHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const roleId = req.params.id as string;
  const input = assignRolePermissionsSchema.parse(req.body);
  const result = await assignRolePermissions(tenantId, actorUserId, roleId, input, req.requestId);
  return sendSuccess(res, result);
};

export const listPermissionsCatalogHandler: RequestHandler = async (_req, res) => {
  const result = await listPermissionsCatalog();
  return sendSuccess(res, result);
};

export const assignUserRolesHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const targetUserId = req.params.id as string;
  const input = assignUserRolesSchema.parse(req.body);
  const result = await assignUserRoles(tenantId, actorUserId, targetUserId, input, req.requestId);
  return sendSuccess(res, result);
};

export const updateRoleHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const roleId = req.params.id as string;
  const input = updateRoleSchema.parse(req.body);
  const result = await updateCustomRole(tenantId, actorUserId, roleId, input, req.requestId);
  return sendSuccess(res, result);
};

export const deleteRoleHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const roleId = req.params.id as string;
  const result = await deleteCustomRole(tenantId, actorUserId, roleId, req.requestId);
  return sendSuccess(res, result);
};

export const listPendingInvitationsHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const result = await listPendingInvitations(tenantId);
  return sendSuccess(res, result);
};

export const revokeInvitationHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const invitationId = req.params.id as string;
  const result = await revokeInvitation(tenantId, actorUserId, invitationId, req.requestId);
  return sendSuccess(res, result);
};
