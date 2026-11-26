// Auth controller: HTTP request validate karke auth service ko call karta hai.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import { getMe, loginUser, registerUser } from "./auth.service";
import { loginSchema, registerSchema } from "./user.model";

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

export const meHandler: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw Errors.unauthorized("Login required");
  }
  const user = await getMe(req.auth.userId);
  return sendSuccess(res, user);
};
