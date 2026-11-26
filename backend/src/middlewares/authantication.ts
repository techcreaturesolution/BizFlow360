// Token check karta hai aur req.auth mein userId + tenantId + roles rakhta hai.
// tenantId HAMESHA yahin se (token se) lo, body/query se kabhi nahi.
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { Errors } from "../lib/errors";

export interface AuthContext {
  userId: string;
  tenantId: string | null;
  roles: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(Errors.unauthorized("Login required"));
  }

  try {
    const payload = verifyAccessToken(header.slice(7).trim());
    req.auth = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      roles: payload.roles ?? [],
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Role check (baad mein permission-based check se badal sakte ho)
// Use: router.get("/x", authenticate, authorize("OWNER", "COMPANY_ADMIN"), handler)
export function authorize(...allowed: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthorized("Login required"));
    const ok = req.auth.roles.some((r) => allowed.includes(r));
    return ok ? next() : next(Errors.forbidden());
  };
}