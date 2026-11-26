// Super Admin controller: Platform Tenants lifecycle aur module entitlements handlers.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  createTenantSchema,
  dashboardQuerySchema,
  tenantIdParamSchema,
  tenantListQuerySchema,
  updateEntitlementsSchema,
  updateTenantSchema,
  updateTenantStatusSchema,
} from "./superAdmin.model";
import {
  createPlatformTenant,
  getPlatformDashboard,
  getPlatformTenantDetail,
  getPlatformTenantEntitlements,
  listPlatformTenants,
  updatePlatformTenant,
  updatePlatformTenantEntitlements,
  updatePlatformTenantStatus,
} from "./superAdmin.service";

function requireActorId(userId?: string): string {
  if (!userId) throw Errors.unauthorized("Login required");
  return userId;
}

export const getDashboardHandler: RequestHandler = async (req, res) => {
  const query = dashboardQuerySchema.parse(req.query);
  const overview = await getPlatformDashboard(query);
  return sendSuccess(res, overview);
};

export const listTenantsHandler: RequestHandler = async (req, res) => {
  const query = tenantListQuerySchema.parse(req.query);
  const { items, meta } = await listPlatformTenants(query);
  return sendSuccess(res, items, { meta });
};

export const createTenantHandler: RequestHandler = async (req, res) => {
  const actorId = requireActorId(req.auth?.userId);
  const input = createTenantSchema.parse(req.body);
  const created = await createPlatformTenant(input, actorId, req.requestId);
  return sendSuccess(res, created, { status: 201 });
};

export const getTenantDetailHandler: RequestHandler = async (req, res) => {
  const tenantId = tenantIdParamSchema.parse(req.params.id);
  const detail = await getPlatformTenantDetail(tenantId);
  return sendSuccess(res, detail);
};

export const updateTenantHandler: RequestHandler = async (req, res) => {
  const actorId = requireActorId(req.auth?.userId);
  const tenantId = tenantIdParamSchema.parse(req.params.id);
  const input = updateTenantSchema.parse(req.body);
  const updated = await updatePlatformTenant(tenantId, input, actorId, req.requestId);
  return sendSuccess(res, updated);
};

export const updateTenantStatusHandler: RequestHandler = async (req, res) => {
  const actorId = requireActorId(req.auth?.userId);
  const tenantId = tenantIdParamSchema.parse(req.params.id);
  const input = updateTenantStatusSchema.parse(req.body);
  const updated = await updatePlatformTenantStatus(tenantId, input, actorId, req.requestId);
  return sendSuccess(res, updated);
};

export const getTenantEntitlementsHandler: RequestHandler = async (req, res) => {
  const tenantId = tenantIdParamSchema.parse(req.params.id);
  const data = await getPlatformTenantEntitlements(tenantId);
  return sendSuccess(res, data);
};

export const updateTenantEntitlementsHandler: RequestHandler = async (req, res) => {
  const actorId = requireActorId(req.auth?.userId);
  const tenantId = tenantIdParamSchema.parse(req.params.id);
  const input = updateEntitlementsSchema.parse(req.body);
  const data = await updatePlatformTenantEntitlements(tenantId, input, actorId, req.requestId);
  return sendSuccess(res, data);
};
