// SRS ka response format:
//   Success: { success: true, data, meta? }
//   Error:   { success: false, code, message, errors? }
import type { Response } from "express";
import type { FieldError } from "./errors";

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; meta?: PageMeta } = {},
) {
  const { status = 200, meta } = options;
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  errors?: FieldError[],
) {
  return res.status(status).json({
    success: false,
    code,
    message,
    ...(errors?.length ? { errors } : {}),
  });
}