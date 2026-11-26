// Bahut zyada requests rokta hai (brute-force se bachav).
import rateLimit from "express-rate-limit";
import { Errors } from "../lib/errors";

// Poore API ke liye: 1 minute mein 120 requests per IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) => next(Errors.tooManyRequests()),
});

// Login / register / forgot-password ke liye sakht: 15 minute mein 10 koshish per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(Errors.tooManyRequests("Too many attempts, please try again in 15 minutes")),
});