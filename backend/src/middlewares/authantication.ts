// Token check karta hai aur req.auth mein userId + tenantId + roles + permissions rakhta hai.
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { Errors } from "../lib/errors";
import type { AuthContext } from "./guards";

export type { AuthContext };

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
      permissions:
        payload.roles?.includes("OWNER") || payload.roles?.includes("SUPER_ADMIN")
          ? ["*"]
          : [],
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Role check
// Use: router.get("/x", authenticate, authorize("OWNER", "COMPANY_ADMIN"), handler)
export function authorize(...allowed: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthorized("Login required"));
    const ok = req.auth.roles.some((r) => allowed.includes(r));
    return ok ? next() : next(Errors.forbidden());
  };
}
