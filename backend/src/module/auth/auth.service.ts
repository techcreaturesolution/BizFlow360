// Auth service: tenant + user register, login, session rotation, logout, password reset aur audit log.
import { and, eq, gt, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, type Db } from "../../db";
import {
  passwordResets,
  permissions,
  rolePermissions,
  roles,
  sessions,
  tenantMemberships,
  tenants,
  users,
} from "../../db/schema";
import { initializeTenantDefaults } from "../../db/tenantDefaults";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt";
import { hashPassword, verifyPassword } from "../../lib/Password";
import type {
  AuthResponse,
  CurrentUserProfile,
  ForgotPasswordInput,
  LoginInput,
  LoginUser,
  LogoutInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
  TenantInfo,
  TenantMembershipInfo,
} from "./user.model";

const BLOCKED_TENANT_STATUSES = new Set(["SUSPENDED", "CANCELLED", "ARCHIVED"]);

function toLoginUser(row: typeof users.$inferSelect): LoginUser {
  return {
    id: row.id,
    tenantId: row.tenantId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone ?? null,
    roles: row.roles,
  };
}

function toTenantInfo(row: typeof tenants.$inferSelect): TenantInfo {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    timezone: row.timezone,
    defaultCurrency: row.defaultCurrency.trim(),
    planId: row.planId ?? null,
  };
}

async function issueSessionAndTokens(
  executor: Pick<Db, "insert">,
  user: LoginUser,
  tenant: TenantInfo | null,
  action: "AUTH.LOGIN" | "AUTH.REGISTER" | "AUTH.REFRESH",
  requestId?: string,
): Promise<AuthResponse> {
  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    roles: user.roles,
  });
  const refresh = signRefreshToken(user.id, user.tenantId);

  await executor.insert(sessions).values({
    userId: user.id,
    tenantId: user.tenantId,
    jti: refresh.jti,
    tokenHash: hashToken(refresh.token),
    expiresAt: refresh.expiresAt,
  });

  await writeAudit(executor, {
    tenantId: user.tenantId,
    actorUserId: user.id,
    action,
    entityType: "user",
    entityId: user.id,
    requestId,
  });

  return {
    accessToken,
    refreshToken: refresh.token,
    user,
    tenant,
  };
}

export async function registerUser(input: RegisterInput, requestId?: string): Promise<AuthResponse> {
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existingUser) {
    throw Errors.conflict("Email already registered");
  }

  const [existingSlug] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, input.workspaceSlug))
    .limit(1);

  if (existingSlug) {
    throw Errors.conflict("Workspace URL / Slug already taken");
  }

  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [createdTenant] = await tx
      .insert(tenants)
      .values({
        name: input.companyName,
        slug: input.workspaceSlug,
        status: "TRIAL",
        timezone: input.timezone,
        defaultCurrency: input.defaultCurrency,
      })
      .returning();

    await initializeTenantDefaults(tx, createdTenant.id);

    const [createdUser] = await tx
      .insert(users)
      .values({
        tenantId: createdTenant.id,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        roles: ["OWNER"],
      })
      .returning();

    // Create OWNER tenant membership record
    await tx.insert(tenantMemberships).values({
      tenantId: createdTenant.id,
      userId: createdUser.id,
      roleName: "OWNER",
      status: "ACTIVE",
      joinedAt: new Date(),
    });

    return issueSessionAndTokens(
      tx,
      toLoginUser(createdUser),
      toTenantInfo(createdTenant),
      "AUTH.REGISTER",
      requestId,
    );
  });
}

export async function loginUser(input: LoginInput, requestId?: string): Promise<AuthResponse> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!user) {
    throw Errors.unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    throw Errors.forbidden("Account is disabled");
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) {
    throw Errors.unauthorized("Invalid email or password");
  }

  let tenant: TenantInfo | null = null;
  if (user.tenantId) {
    const [tenantRow] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    if (!tenantRow) {
      throw Errors.notFound("Tenant workspace not found");
    }

    if (BLOCKED_TENANT_STATUSES.has(tenantRow.status)) {
      throw Errors.forbidden(`Workspace is ${tenantRow.status.toLowerCase()}`);
    }

    tenant = toTenantInfo(tenantRow);
  }

  return db.transaction((tx) =>
    issueSessionAndTokens(tx, toLoginUser(user), tenant, "AUTH.LOGIN", requestId),
  );
}

// Session Logout
export async function logoutUser(input: LogoutInput, userId?: string, requestId?: string): Promise<{ success: boolean; message: string }> {
  try {
    const payload = verifyRefreshToken(input.refreshToken);
    const tokenHash = hashToken(input.refreshToken);

    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.jti, payload.jti),
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
        ),
      );

    if (userId) {
      await writeAudit(db, {
        tenantId: payload.tenantId,
        actorUserId: userId,
        action: "AUTH.LOGOUT",
        entityType: "session",
        entityId: payload.jti,
        requestId,
      });
    }

    return { success: true, message: "Logged out successfully" };
  } catch {
    // Graceful logout even if token expired
    return { success: true, message: "Logged out successfully" };
  }
}

// Refresh Token Rotation
export async function rotateRefreshToken(input: RefreshInput, requestId?: string): Promise<AuthResponse> {
  const payload = verifyRefreshToken(input.refreshToken);
  const tokenHash = hashToken(input.refreshToken);

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.jti, payload.jti),
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    throw Errors.unauthorized("Refresh session expired or already revoked");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (!user || !user.isActive) {
    throw Errors.unauthorized("User account is inactive or deleted");
  }

  let tenant: TenantInfo | null = null;
  if (user.tenantId) {
    const [tenantRow] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    if (tenantRow) {
      if (BLOCKED_TENANT_STATUSES.has(tenantRow.status)) {
        throw Errors.forbidden(`Workspace is ${tenantRow.status.toLowerCase()}`);
      }
      tenant = toTenantInfo(tenantRow);
    }
  }

  return db.transaction(async (tx) => {
    // Revoke old session
    await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, session.id));

    return issueSessionAndTokens(tx, toLoginUser(user), tenant, "AUTH.REFRESH", requestId);
  });
}

// Forgot Password
export async function forgotPassword(input: ForgotPasswordInput, requestId?: string): Promise<{ success: boolean; message: string; resetToken?: string }> {
  const [user] = await db
    .select({ id: users.id, email: users.email, tenantId: users.tenantId })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!user) {
    // Security best practice: don't reveal if user exists
    return {
      success: true,
      message: "If an account exists with this email, password reset instructions have been generated.",
    };
  }

  const rawResetToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawResetToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  await writeAudit(db, {
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: "AUTH.FORGOT_PASSWORD",
    entityType: "user",
    entityId: user.id,
    requestId,
  });

  return {
    success: true,
    message: "Password reset token generated successfully. In production, this token is emailed to the user.",
    resetToken: rawResetToken,
  };
}

// Reset Password
export async function resetPassword(input: ResetPasswordInput, requestId?: string): Promise<{ success: boolean; message: string }> {
  const tokenHash = hashToken(input.token);

  const [resetRecord] = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, tokenHash),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!resetRecord) {
    throw Errors.badRequest("Invalid or expired password reset token");
  }

  const newHash = await hashPassword(input.newPassword);

  await db.transaction(async (tx) => {
    // Mark token as used
    await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(passwordResets.id, resetRecord.id));

    // Update user password
    await tx
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, resetRecord.userId));

    // Revoke all active sessions for security
    await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, resetRecord.userId), isNull(sessions.revokedAt)));

    await writeAudit(tx, {
      actorUserId: resetRecord.userId,
      action: "AUTH.RESET_PASSWORD",
      entityType: "user",
      entityId: resetRecord.userId,
      requestId,
    });
  });

  return { success: true, message: "Password has been successfully updated. Please login with your new password." };
}

// Current User Profile with Membership & Permissions
export async function getMe(userId: string): Promise<CurrentUserProfile> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw Errors.notFound("User not found");
  }

  let tenantInfo: TenantInfo | null = null;
  let membershipInfo: TenantMembershipInfo | null = null;
  const effectivePermissions = new Set<string>();

  if (user.tenantId) {
    const [tenantRow] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    if (tenantRow) {
      tenantInfo = toTenantInfo(tenantRow);
    }

    const [membership] = await db
      .select()
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, user.tenantId),
          eq(tenantMemberships.userId, user.id),
        ),
      )
      .limit(1);

    if (membership) {
      membershipInfo = {
        id: membership.id,
        tenantId: membership.tenantId,
        roleName: membership.roleName,
        status: membership.status,
        branchId: membership.branchId,
        departmentId: membership.departmentId,
        joinedAt: membership.joinedAt,
      };

      if (membership.roleId) {
        const perms = await db
          .select({ code: permissions.code })
          .from(rolePermissions)
          .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
          .where(eq(rolePermissions.roleId, membership.roleId));

        for (const p of perms) {
          effectivePermissions.add(p.code);
        }
      }
    }
  }

  if (user.roles.includes("OWNER") || user.roles.includes("SUPER_ADMIN")) {
    effectivePermissions.add("*");
  }

  return {
    user: toLoginUser(user),
    tenant: tenantInfo,
    membership: membershipInfo,
    effectivePermissions: Array.from(effectivePermissions),
  };
}
