// 3-Layer Security Architecture: JwtAuthGuard -> EntitlementGuard -> PermissionsGuard + IdempotencyGuard
import type { NextFunction, Request, Response } from "express";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "../db";
import {
  permissions,
  rolePermissions,
  roles,
  tenantEntitlements,
  tenantMemberships,
  tenants,
  users,
  type ModuleCode,
} from "../db/schema";
import { Errors } from "../lib/errors";
import { verifyAccessToken } from "../lib/jwt";

export interface AuthContext {
  userId: string;
  tenantId: string | null;
  membershipId?: string | null;
  roles: string[];
  permissions: string[];
  email?: string;
  fullName?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

// Layer 1: JwtAuthGuard
// NEVER trusts tenant_id from client body or params - ONLY from verified token + DB membership
export async function jwtAuthGuard(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(Errors.unauthorized("Authentication required. Missing Bearer token."));
  }

  try {
    const rawToken = header.slice(7).trim();
    const payload = verifyAccessToken(rawToken);

    // Verify user exists and is active
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || !user.isActive) {
      return next(Errors.unauthorized("Account is deactivated or does not exist."));
    }

    let membershipId: string | null = null;
    let effectiveRoles = user.roles;
    const effectivePermissions = new Set<string>();

    // If user belongs to a tenant workspace, verify active membership
    if (payload.tenantId) {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, payload.tenantId))
        .limit(1);

      if (!tenant) {
        return next(Errors.notFound("Tenant workspace not found."));
      }

      if (tenant.status === "SUSPENDED" || tenant.status === "CANCELLED" || tenant.status === "ARCHIVED") {
        return next(Errors.forbidden(`Tenant workspace is ${tenant.status.toLowerCase()}. Access denied.`));
      }

      const [membership] = await db
        .select()
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, payload.tenantId),
            eq(tenantMemberships.userId, user.id),
          ),
        )
        .limit(1);

      if (membership) {
        if (membership.status !== "ACTIVE") {
          return next(Errors.forbidden("Your membership in this company is not active."));
        }
        membershipId = membership.id;
        if (membership.roleName && !effectiveRoles.includes(membership.roleName)) {
          effectiveRoles = [...effectiveRoles, membership.roleName];
        }

        // Fetch permissions assigned across primary roleId AND any multi-assigned roles by name
        const roleConditions = [];
        if (membership.roleId) {
          roleConditions.push(eq(roles.id, membership.roleId));
        }
        if (effectiveRoles.length > 0) {
          roleConditions.push(
            and(
              inArray(roles.name, effectiveRoles),
              or(eq(roles.tenantId, payload.tenantId), isNull(roles.tenantId)),
            ),
          );
        }

        if (roleConditions.length > 0) {
          const perms = await db
            .select({ code: permissions.code })
            .from(roles)
            .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
            .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
            .where(roleConditions.length === 1 ? roleConditions[0] : or(...roleConditions));

          for (const p of perms) {
            effectivePermissions.add(p.code);
          }
        }
      }
    }

    // OWNER and SUPER_ADMIN have full wildcard access
    if (effectiveRoles.includes("OWNER") || effectiveRoles.includes("SUPER_ADMIN")) {
      effectivePermissions.add("*");
    }

    req.auth = {
      userId: user.id,
      tenantId: payload.tenantId,
      membershipId,
      roles: effectiveRoles,
      permissions: Array.from(effectivePermissions),
      email: user.email,
      fullName: user.fullName,
    };

    return next();
  } catch (err) {
    return next(err);
  }
}

// Layer 2: EntitlementGuard
// Checks if the company's plan has the requested module enabled
export function entitlementGuard(moduleCode: ModuleCode | string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(Errors.unauthorized("Authentication required"));
    }

    // Super Admin platform operations bypass tenant module checks
    if (!req.auth.tenantId && req.auth.roles.includes("SUPER_ADMIN")) {
      return next();
    }

    if (!req.auth.tenantId) {
      return next(Errors.forbidden("No active tenant workspace identified."));
    }

    const [entitlement] = await db
      .select()
      .from(tenantEntitlements)
      .where(
        and(
          eq(tenantEntitlements.tenantId, req.auth.tenantId),
          eq(tenantEntitlements.moduleCode, moduleCode),
        ),
      )
      .limit(1);

    // AUTH, ORG, REPORTS, BILLING, APPROVALS, NOTIFICATIONS and AUDIT are core workspace modules unless explicitly disabled
    if (
      moduleCode === "AUTH" ||
      moduleCode === "ORG" ||
      moduleCode === "REPORTS" ||
      moduleCode === "BILLING" ||
      moduleCode === "APPROVALS" ||
      moduleCode === "NOTIFICATIONS" ||
      moduleCode === "AUDIT"
    ) {
      if (entitlement && !entitlement.isEnabled) {
        return next(
          Errors.forbidden(
            `Module '${moduleCode}' access has been disabled for your workspace.`,
          ),
        );
      }
      return next();
    }

    if (!entitlement || !entitlement.isEnabled) {
      return next(
        Errors.forbidden(
          `Module '${moduleCode}' is not enabled in your subscription plan. Please upgrade to access this feature.`,
        ),
      );
    }

    return next();
  };
}

// Layer 3: PermissionsGuard
// Checks if user's role has specific permission (e.g., 'AUTH.USERS.VIEW', 'AUTH.USERS.INVITE')
export function permissionsGuard(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(Errors.unauthorized("Authentication required"));
    }

    // OWNER or SUPER_ADMIN wildcard bypass
    if (
      req.auth.permissions.includes("*") ||
      req.auth.roles.includes("OWNER") ||
      req.auth.roles.includes("SUPER_ADMIN")
    ) {
      return next();
    }

    const hasPermission = requiredPermissions.some((perm) =>
      req.auth?.permissions.includes(perm),
    );

    if (!hasPermission) {
      return next(
        Errors.forbidden(
          `Permission denied. Missing required permission: ${requiredPermissions.join(" or ")}`,
        ),
      );
    }

    return next();
  };
}

// Record Scope Helper:
// OWNER, ADMIN, SUPER_ADMIN, or roles with module-level VIEW_ALL get tenant-wide access.
// Regular executives (e.g. Sales Executive) only see records where ownerUserId/assigneeUserId == userId.
export function hasTenantWideScope(auth: AuthContext, allPermission?: string): boolean {
  if (
    auth.permissions.includes("*") ||
    auth.roles.includes("OWNER") ||
    auth.roles.includes("ADMIN") ||
    auth.roles.includes("SUPER_ADMIN")
  ) {
    return true;
  }
  return allPermission ? auth.permissions.includes(allPermission) : false;
}

// IdempotencyGuard for retry-sensitive APIs (payments, order conversions, invitations)
const idempotencyStore = new Map<string, { body: unknown; status: number; timestamp: number }>();
const IDEMPOTENCY_TTL_MS = 60 * 1000; // 1 minute TTL

export function idempotencyGuard(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["idempotency-key"] as string | undefined;
  if (!key) {
    return next();
  }

  const cached = idempotencyStore.get(key);
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
    return res.status(cached.status).json(cached.body);
  }

  // Intercept json send to cache response
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    idempotencyStore.set(key, {
      body,
      status: res.statusCode,
      timestamp: Date.now(),
    });
    return originalJson(body);
  };

  return next();
}
