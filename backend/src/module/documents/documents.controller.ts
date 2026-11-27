// Documents Controller.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  documentsQuerySchema,
  registerDocumentSchema,
  uploadUrlSchema,
} from "./documents.model";
import {
  createUploadUrl,
  deleteDocument,
  getDocumentDetail,
  getDocumentDownloadUrl,
  listDocuments,
  registerDocument,
} from "./documents.service";

function requireAuthTenant(req: Parameters<RequestHandler>[0]) {
  if (!req.auth || !req.auth.tenantId) {
    throw Errors.forbidden("Operation requires an active authenticated tenant workspace.");
  }
  return req.auth;
}

export const listDocumentsHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = documentsQuerySchema.parse(req.query);
  const result = await listDocuments(auth.tenantId!, query);
  return sendSuccess(res, result);
};

export const createUploadUrlHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = uploadUrlSchema.parse(req.body);
  const result = await createUploadUrl(auth.tenantId!, input);
  return sendSuccess(res, result);
};

export const registerDocumentHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = registerDocumentSchema.parse(req.body);
  const result = await registerDocument(auth, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const getDocumentDetailHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await getDocumentDetail(auth.tenantId!, req.params.id as string);
  return sendSuccess(res, result);
};

export const getDocumentDownloadUrlHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await getDocumentDownloadUrl(auth.tenantId!, req.params.id as string);
  return sendSuccess(res, result);
};

export const deleteDocumentHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await deleteDocument(auth, req.params.id as string, req.requestId);
  return sendSuccess(res, result);
};
