// Read-only Audit Logs controller (Super Admin dashboard ke liye).
import type { RequestHandler } from "express";
import { sendSuccess } from "../../lib/response";
import { auditLogIdParamSchema, auditLogListQuerySchema } from "./auditLogs.model";
import { getAuditLogById, listAuditLogs } from "./auditLogs.service";

export const listAuditLogsHandler: RequestHandler = async (req, res) => {
  const query = auditLogListQuerySchema.parse(req.query);
  const { items, meta } = await listAuditLogs(query);
  return sendSuccess(res, items, { meta });
};

export const getAuditLogDetailHandler: RequestHandler = async (req, res) => {
  const id = auditLogIdParamSchema.parse(req.params.id);
  const detail = await getAuditLogById(id);
  return sendSuccess(res, detail);
};
