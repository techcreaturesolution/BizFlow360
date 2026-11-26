// Auth service: tenant + user register, login verification, session save aur audit log.
import { eq } from "drizzle-orm";
import { db, type Db } from "../../db";
import { sessions, tenants, users } from "../../db/schema";
import { initializeTenantDefaults } from "../../db/tenantDefaults";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { hashToken, signAccessToken, signRefreshToken } from "../../lib/jwt";
import { hashPassword, verifyPassword } from "../../lib/Password";
import type {
  AuthResponse,
  LoginInput,
  LoginUser,
  RegisterInput,
  TenantInfo,
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
  action: "AUTH.LOGIN" | "AUTH.REGISTER",
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

export async function getMe(userId: string): Promise<LoginUser> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw Errors.notFound("User not found");
  }

  return toLoginUser(user);
}
