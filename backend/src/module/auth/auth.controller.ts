// Auth controller: HTTP request validate karke auth service ko call karta hai.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  forgotPassword,
  getMe,
  loginUser,
  logoutUser,
  registerUser,
  resetPassword,
  rotateRefreshToken,
} from "./auth.service";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "./user.model";

export const registerHandler: RequestHandler = async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const loginHandler: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input, req.requestId);
  return sendSuccess(res, result);
};

export const logoutHandler: RequestHandler = async (req, res) => {
  const input = logoutSchema.parse(req.body);
  const result = await logoutUser(input, req.auth?.userId, req.requestId);
  return sendSuccess(res, result);
};

export const refreshHandler: RequestHandler = async (req, res) => {
  const input = refreshSchema.parse(req.body);
  const result = await rotateRefreshToken(input, req.requestId);
  return sendSuccess(res, result);
};

export const forgotPasswordHandler: RequestHandler = async (req, res) => {
  const input = forgotPasswordSchema.parse(req.body);
  const result = await forgotPassword(input, req.requestId);
  return sendSuccess(res, result);
};

export const resetPasswordHandler: RequestHandler = async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  const result = await resetPassword(input, req.requestId);
  return sendSuccess(res, result);
};

export const meHandler: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw Errors.unauthorized("Login required");
  }
  const user = await getMe(req.auth.userId);
  return sendSuccess(res, user);
};
