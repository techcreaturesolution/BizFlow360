// Dashboard & Reports Controller: Overview KPIs, Module Analytics, Async Exports, Saved Widgets.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  analyticsQuerySchema,
  dashboardSummaryQuerySchema,
  exportReportSchema,
  saveWidgetsSchema,
} from "./dashboardReports.model";
import {
  getDashboardSummary,
  getDashboardWidgets,
  getModuleAnalytics,
  listReportExportJobs,
  saveDashboardWidgets,
  triggerReportExport,
} from "./dashboardReports.service";

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

export const getDashboardSummaryHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const query = dashboardSummaryQuerySchema.parse(req.query);
  const result = await getDashboardSummary(tenantId, query);
  return sendSuccess(res, result);
};

export function createModuleAnalyticsHandler(
  moduleType: "sales" | "finance" | "hr" | "projects",
): RequestHandler {
  return async (req, res) => {
    const tenantId = requireTenantId(req);
    const query = analyticsQuerySchema.parse(req.query);
    const result = await getModuleAnalytics(tenantId, moduleType, query);
    return sendSuccess(res, result);
  };
}

export const triggerReportExportHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = exportReportSchema.parse(req.body);
  const result = await triggerReportExport(tenantId, actorUserId, input, req.requestId);
  return sendSuccess(res, result, { status: 202 });
};

export const listReportExportsHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const result = await listReportExportJobs(tenantId);
  return sendSuccess(res, result);
};

export const getDashboardWidgetsHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);
  const layoutName = (req.query.layoutName as string | undefined) ?? "default";
  const result = await getDashboardWidgets(tenantId, userId, layoutName);
  return sendSuccess(res, result);
};

export const saveDashboardWidgetsHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);
  const input = saveWidgetsSchema.parse(req.body);
  const result = await saveDashboardWidgets(tenantId, userId, input, req.requestId);
  return sendSuccess(res, result);
};
