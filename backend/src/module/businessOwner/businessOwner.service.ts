// Business Owner Service: Team management, invitations, user activation status, roles and RBAC permissions.
import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "../../db";
import {
  permissions,
  rolePermissions,
  roles,
  tenantEntitlements,
  tenantMemberships,
  usageMetrics,
  userInvitations,
  users,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { ensureStandardPermissions } from "../../db/tenantDefaults";
import { Errors } from "../../lib/errors";
import { hashToken } from "../../lib/jwt";
import type {
  AssignRolePermissionsInput,
  AssignUserRolesInput,
  CreateRoleInput,
  InviteMemberInput,
  TeamMembersQuery,
  UpdateRoleInput,
  UpdateUserStatusInput,
} from "./businessOwner.model";

export async function getTeamMembers(tenantId: string, query: TeamMembersQuery) {
  const conditions = [eq(tenantMemberships.tenantId, tenantId)];

  if (query.status) {
    conditions.push(eq(tenantMemberships.status, query.status));
  }
  const effectiveRoleId = query.roleId ?? query.role_id;
  if (effectiveRoleId) {
    conditions.push(eq(tenantMemberships.roleId, effectiveRoleId));
  }
  const effectiveBranch = query.branch ?? query.branch_id;
  if (effectiveBranch) {
    conditions.push(eq(tenantMemberships.branchId, effectiveBranch));
  }
  const effectiveDept = query.department ?? query.department_id;
  if (effectiveDept) {
    conditions.push(eq(tenantMemberships.departmentId, effectiveDept));
  }

  const offset = (query.page - 1) * query.limit;

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(
      query.search
        ? and(
            ...conditions,
            or(
              ilike(users.fullName, `%${query.search}%`),
              ilike(users.email, `%${query.search}%`),
              ilike(users.phone, `%${query.search}%`),
            ),
          )
        : and(...conditions),
    );

  const total = totalResult?.count ?? 0;

  const rows = await db
    .select({
      membershipId: tenantMemberships.id,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      roles: users.roles,
      roleName: tenantMemberships.roleName,
      roleId: tenantMemberships.roleId,
      status: tenantMemberships.status,
      isActive: users.isActive,
      branchId: tenantMemberships.branchId,
      departmentId: tenantMemberships.departmentId,
      joinedAt: tenantMemberships.joinedAt,
      createdAt: tenantMemberships.createdAt,
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(
      query.search
        ? and(
            ...conditions,
            or(
              ilike(users.fullName, `%${query.search}%`),
              ilike(users.email, `%${query.search}%`),
              ilike(users.phone, `%${query.search}%`),
            ),
          )
        : and(...conditions),
    )
    .orderBy(desc(tenantMemberships.createdAt))
    .limit(query.limit)
    .offset(offset);

  return {
    members: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function inviteTeamMember(
  tenantId: string,
  actorUserId: string,
  input: InviteMemberInput,
  requestId?: string,
) {
  // Check if user is already a member of this tenant
  const [existingUser] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existingUser) {
    const [existingMembership] = await db
      .select()
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.userId, existingUser.id),
        ),
      )
      .limit(1);

    if (existingMembership && existingMembership.status === "ACTIVE") {
      throw Errors.conflict("This user is already an active member of your company.");
    }
  }

  // Seat Quota check: active seats + pending invitations vs plan max_seats
  const [[metrics], [entitlement], [activeMembersRow], [pendingInvitesRow]] = await Promise.all([
    db.select().from(usageMetrics).where(eq(usageMetrics.tenantId, tenantId)).limit(1),
    db
      .select()
      .from(tenantEntitlements)
      .where(
        and(
          eq(tenantEntitlements.tenantId, tenantId),
          eq(tenantEntitlements.moduleCode, "CRM"),
        ),
      )
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.status, "ACTIVE"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userInvitations)
      .where(and(eq(userInvitations.tenantId, tenantId), eq(userInvitations.status, "PENDING"))),
  ]);

  const maxSeats = entitlement?.quotas?.max_seats ?? 10;
  const currentSeatsUsed = Math.max(metrics?.seatsUsed ?? 1, activeMembersRow?.count ?? 1);
  const totalOccupied = currentSeatsUsed + (pendingInvitesRow?.count ?? 0);

  if (totalOccupied >= maxSeats) {
    throw Errors.forbidden(
      `Team seat quota exceeded (${currentSeatsUsed} active + ${pendingInvitesRow?.count ?? 0} pending / ${maxSeats} max seats). Please revoke unused invites or upgrade your plan.`,
    );
  }

  // Resolve single or multiple role IDs & enforce tenant isolation + role escalation guard
  const requestedRoleIds = Array.from(
    new Set([...(input.roleIds ?? []), ...(input.roleId ? [input.roleId] : [])]),
  );

  let primaryRoleId: string | null = null;
  let assignedRoleName = "MEMBER";

  if (requestedRoleIds.length > 0) {
    const resolvedRoles = await db
      .select()
      .from(roles)
      .where(
        and(
          inArray(roles.id, requestedRoleIds),
          or(eq(roles.tenantId, tenantId), isNull(roles.tenantId)),
        ),
      );

    if (resolvedRoles.length !== requestedRoleIds.length) {
      throw Errors.notFound("One or more specified roles do not belong to your company.");
    }

    if (resolvedRoles.some((r) => r.name === "OWNER" || r.name === "SUPER_ADMIN")) {
      throw Errors.forbidden("Role escalation blocked: cannot invite users with OWNER or SUPER_ADMIN privileges.");
    }

    primaryRoleId = resolvedRoles[0].id;
    assignedRoleName = resolvedRoles.map((r) => r.name).join(", ");
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invitation] = await db
    .insert(userInvitations)
    .values({
      tenantId,
      email: input.email,
      fullName: input.fullName,
      roleId: primaryRoleId,
      roleIds: requestedRoleIds,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      tokenHash,
      status: "PENDING",
      invitedBy: actorUserId,
      expiresAt,
    })
    .returning();

  // Audit log write
  await writeAudit(db, {
    tenantId,
    actorUserId,
    action: "AUTH.USERS.INVITE",
    entityType: "user_invitation",
    entityId: invitation.id,
    afterData: {
      email: input.email,
      fullName: input.fullName,
      roleName: assignedRoleName,
      roleIds: requestedRoleIds,
      branchId: input.branchId,
      departmentId: input.departmentId,
    },
    requestId,
  });

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      fullName: invitation.fullName,
      roleName: assignedRoleName,
      roleIds: requestedRoleIds,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      inviteLink: `https://bizflow360.com/accept-invite?token=${rawToken}`,
      acceptToken: rawToken,
    },
    message: "Team member invitation created successfully.",
  };
}

export async function listPendingInvitations(tenantId: string) {
  const rows = await db
    .select()
    .from(userInvitations)
    .where(eq(userInvitations.tenantId, tenantId))
    .orderBy(desc(userInvitations.createdAt))
    .limit(50);

  return { invitations: rows };
}

export async function revokeInvitation(
  tenantId: string,
  actorUserId: string,
  invitationId: string,
  requestId?: string,
) {
  const [inv] = await db
    .select()
    .from(userInvitations)
    .where(and(eq(userInvitations.id, invitationId), eq(userInvitations.tenantId, tenantId)))
    .limit(1);

  if (!inv) {
    throw Errors.notFound("Invitation not found in your company.");
  }

  if (inv.status !== "PENDING") {
    throw Errors.conflict(`Invitation cannot be revoked because it is already ${inv.status}.`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(userInvitations)
      .set({ status: "REVOKED", updatedAt: new Date() })
      .where(eq(userInvitations.id, invitationId));

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "AUTH.INVITATION.REVOKE",
      entityType: "user_invitation",
      entityId: invitationId,
      beforeData: { status: inv.status, email: inv.email },
      afterData: { status: "REVOKED" },
      requestId,
    });
  });

  return { success: true, message: `Invitation for ${inv.email} has been revoked.` };
}

export async function updateUserStatus(
  tenantId: string,
  actorUserId: string,
  targetUserId: string,
  input: UpdateUserStatusInput,
  requestId?: string,
) {
  if (actorUserId === targetUserId) {
    throw Errors.badRequest("You cannot activate or deactivate your own account.");
  }

  const [membership] = await db
    .select()
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.userId, targetUserId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw Errors.notFound("User membership not found in this company.");
  }

  if (membership.roleName === "OWNER") {
    throw Errors.forbidden("Company Owner account cannot be deactivated.");
  }

  const newStatus = input.status;
  const isUserActive = newStatus === "ACTIVE";

  await db.transaction(async (tx) => {
    await tx
      .update(tenantMemberships)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(tenantMemberships.id, membership.id));

    await tx
      .update(users)
      .set({
        isActive: isUserActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId));

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "AUTH.USERS.STATUS_CHANGE",
      entityType: "user",
      entityId: targetUserId,
      beforeData: {
        previousStatus: membership.status,
      },
      afterData: {
        newStatus,
      },
      reason: input.reason,
      requestId,
    });
  });

  return {
    success: true,
    message: `User status successfully updated to ${newStatus}.`,
  };
}

export async function getRoles(tenantId: string) {
  // Fetch system roles (tenantId is null) + custom roles created for this tenant
  const roleRows = await db
    .select()
    .from(roles)
    .where(or(eq(roles.tenantId, tenantId), isNull(roles.tenantId)))
    .orderBy(desc(roles.isSystem), roles.name);

  // Fetch permissions for each role
  const roleIds = roleRows.map((r) => r.id);
  const permissionsByRoleId: Record<string, string[]> = {};

  if (roleIds.length > 0) {
    const rolePermRows = await db
      .select({
        roleId: rolePermissions.roleId,
        permissionCode: permissions.code,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(inArray(rolePermissions.roleId, roleIds));

    for (const rp of rolePermRows) {
      if (!permissionsByRoleId[rp.roleId]) {
        permissionsByRoleId[rp.roleId] = [];
      }
      permissionsByRoleId[rp.roleId].push(rp.permissionCode);
    }
  }

  let allAvailablePermissions = await db
    .select({
      id: permissions.id,
      code: permissions.code,
      moduleCode: permissions.moduleCode,
      description: permissions.description,
    })
    .from(permissions)
    .orderBy(permissions.moduleCode, permissions.code);

  if (allAvailablePermissions.length === 0) {
    await ensureStandardPermissions(db);
    allAvailablePermissions = await db
      .select({
        id: permissions.id,
        code: permissions.code,
        moduleCode: permissions.moduleCode,
        description: permissions.description,
      })
      .from(permissions)
      .orderBy(permissions.moduleCode, permissions.code);
  }

  // Fetch user count per roleId
  const roleCountRows = await db
    .select({
      roleId: tenantMemberships.roleId,
      count: sql<number>`count(*)::int`,
    })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.tenantId, tenantId))
    .groupBy(tenantMemberships.roleId);

  const countByRoleId = new Map(
    roleCountRows.filter((rc) => rc.roleId).map((rc) => [rc.roleId!, rc.count]),
  );

  return {
    roles: roleRows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      usersCount: countByRoleId.get(r.id) ?? 0,
      permissions: permissionsByRoleId[r.id] ?? [],
    })),
    availablePermissions: allAvailablePermissions,
  };
}

export async function createCustomRole(
  tenantId: string,
  actorUserId: string,
  input: CreateRoleInput,
  requestId?: string,
) {
  const upperName = input.name.toUpperCase();
  if (upperName === "SUPER_ADMIN" || upperName === "OWNER" || upperName === "PLATFORM_ADMIN") {
    throw Errors.forbidden(`Role escalation blocked: '${input.name}' is a reserved system role name.`);
  }

  const [existing] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        or(eq(roles.tenantId, tenantId), isNull(roles.tenantId)),
        eq(roles.name, input.name),
      ),
    )
    .limit(1);

  if (existing) {
    throw Errors.conflict(`A role named '${input.name}' already exists.`);
  }

  await ensureStandardPermissions(db);

  // Optional initial permissions resolution + escalation check
  let resolvedPerms: Array<{ id: string; code: string }> = [];
  if (input.permissionIds && input.permissionIds.length > 0) {
    const isUuid = (val: string) => /^[0-9a-fA-F-]{36}$/.test(val);
    const uuidList = input.permissionIds.filter(isUuid);
    const codeList = input.permissionIds.filter((p) => !isUuid(p));

    const permFilters = [];
    if (uuidList.length > 0) permFilters.push(inArray(permissions.id, uuidList));
    if (codeList.length > 0) permFilters.push(inArray(permissions.code, codeList));

    if (permFilters.length > 0) {
      resolvedPerms = await db
        .select({ id: permissions.id, code: permissions.code })
        .from(permissions)
        .where(permFilters.length === 1 ? permFilters[0] : or(...permFilters));
    }

    if (resolvedPerms.some((p) => p.code.startsWith("PLATFORM.") || p.code.startsWith("SUPER_ADMIN"))) {
      throw Errors.forbidden("Role escalation blocked: Super Admin permissions cannot be assigned.");
    }
  }

  const newRole = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(roles)
      .values({
        tenantId,
        name: input.name,
        description: input.description ?? null,
        isSystem: false,
      })
      .returning();

    if (resolvedPerms.length > 0) {
      await tx.insert(rolePermissions).values(
        resolvedPerms.map((p) => ({
          roleId: created.id,
          permissionId: p.id,
        })),
      );
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "AUTH.ROLES.CREATE",
      entityType: "role",
      entityId: created.id,
      afterData: {
        name: created.name,
        description: created.description,
        permissions: resolvedPerms.map((p) => p.code),
      },
      requestId,
    });

    return created;
  });

  return {
    role: {
      ...newRole,
      permissions: resolvedPerms.map((p) => p.code),
    },
    message: "Custom role created successfully.",
  };
}

export async function assignRolePermissions(
  tenantId: string,
  actorUserId: string,
  roleId: string,
  input: AssignRolePermissionsInput,
  requestId?: string,
) {
  const [targetRole] = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.id, roleId),
        or(eq(roles.tenantId, tenantId), isNull(roles.tenantId)),
      ),
    )
    .limit(1);

  if (!targetRole) {
    throw Errors.notFound("Role not found in your company.");
  }

  if (targetRole.isSystem) {
    throw Errors.forbidden("System predefined roles (OWNER, ADMIN, MEMBER) cannot be modified. Create a custom role instead.");
  }

  await ensureStandardPermissions(db);

  // Resolve permission IDs (supports both UUID IDs and codes like 'CRM.LEADS.CREATE')
  const isUuid = (val: string) => /^[0-9a-fA-F-]{36}$/.test(val);
  const uuidList = input.permissionIds.filter(isUuid);
  const codeList = input.permissionIds.filter((p) => !isUuid(p));

  const permFilters = [];
  if (uuidList.length > 0) permFilters.push(inArray(permissions.id, uuidList));
  if (codeList.length > 0) permFilters.push(inArray(permissions.code, codeList));

  const resolvedPerms =
    permFilters.length > 0
      ? await db
          .select({ id: permissions.id, code: permissions.code })
          .from(permissions)
          .where(permFilters.length === 1 ? permFilters[0] : or(...permFilters))
      : [];

  if (resolvedPerms.length === 0) {
    throw Errors.badRequest("None of the specified permissions were found in the system catalog.");
  }

  if (resolvedPerms.some((p) => p.code.startsWith("PLATFORM.") || p.code.startsWith("SUPER_ADMIN"))) {
    throw Errors.forbidden("Role escalation blocked: Super Admin permissions cannot be assigned.");
  }

  await db.transaction(async (tx) => {
    // Delete existing permissions for this role
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    // Insert updated permissions
    await tx.insert(rolePermissions).values(
      resolvedPerms.map((p) => ({
        roleId,
        permissionId: p.id,
      })),
    );

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "AUTH.ROLES.PERMISSIONS_UPDATE",
      entityType: "role",
      entityId: roleId,
      afterData: {
        roleName: targetRole.name,
        assignedPermissions: resolvedPerms.map((p) => p.code),
      },
      requestId,
    });
  });

  return {
    success: true,
    message: `Permissions updated for role '${targetRole.name}'.`,
    roleId,
    assignedPermissions: resolvedPerms.map((p) => p.code),
  };
}

// 1. GET /api/v1/permissions — Matrix screen ke liye saare permissions + grouped by module
export async function listPermissionsCatalog() {
  await ensureStandardPermissions(db);

  const allPerms = await db
    .select({
      id: permissions.id,
      code: permissions.code,
      moduleCode: permissions.moduleCode,
      description: permissions.description,
    })
    .from(permissions)
    .orderBy(permissions.moduleCode, permissions.code);

  const enriched = allPerms.map((p) => {
    const parts = p.code.split(".");
    return {
      id: p.id,
      code: p.code,
      module: parts[0] ?? p.moduleCode,
      resource: parts[1] ?? "GENERAL",
      action: parts[2] ?? "ACCESS",
      moduleCode: p.moduleCode,
      description: p.description,
    };
  });

  const groupedByModule: Record<string, typeof enriched> = {};
  for (const perm of enriched) {
    if (!groupedByModule[perm.moduleCode]) {
      groupedByModule[perm.moduleCode] = [];
    }
    groupedByModule[perm.moduleCode].push(perm);
  }

  return {
    permissions: enriched,
    groupedByModule,
  };
}

// 2. PUT /api/v1/users/:id/roles — Joined user ka role badalna ya multiple roles assign karna
export async function assignUserRoles(
  tenantId: string,
  actorUserId: string,
  targetUserId: string,
  input: AssignUserRolesInput,
  requestId?: string,
) {
  const [membership] = await db
    .select()
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.userId, targetUserId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw Errors.notFound("User membership not found in your company.");
  }

  if (membership.roleName === "OWNER") {
    throw Errors.forbidden("Company Owner role cannot be reassigned here.");
  }

  const uniqueRoleIds = Array.from(new Set(input.roleIds));
  const resolvedRoles = await db
    .select()
    .from(roles)
    .where(
      and(
        inArray(roles.id, uniqueRoleIds),
        or(eq(roles.tenantId, tenantId), isNull(roles.tenantId)),
      ),
    );

  if (resolvedRoles.length !== uniqueRoleIds.length) {
    throw Errors.badRequest("One or more specified roles do not belong to your company.");
  }

  if (resolvedRoles.some((r) => r.name === "OWNER" || r.name === "SUPER_ADMIN")) {
    throw Errors.forbidden("Role escalation blocked: OWNER or SUPER_ADMIN roles cannot be assigned here.");
  }

  const primaryRole = resolvedRoles[0];
  const assignedRoleNames = Array.from(new Set(resolvedRoles.map((r) => r.name)));

  await db.transaction(async (tx) => {
    await tx
      .update(tenantMemberships)
      .set({
        roleId: primaryRole.id,
        roleName: primaryRole.name,
        updatedAt: new Date(),
      })
      .where(eq(tenantMemberships.id, membership.id));

    await tx
      .update(users)
      .set({
        roles: assignedRoleNames,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId));

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "AUTH.USERS.ROLES_UPDATE",
      entityType: "user",
      entityId: targetUserId,
      beforeData: { roleId: membership.roleId, roleName: membership.roleName },
      afterData: { primaryRoleId: primaryRole.id, assignedRoles: assignedRoleNames },
      requestId,
    });
  });

  return {
    success: true,
    userId: targetUserId,
    primaryRoleId: primaryRole.id,
    assignedRoles: assignedRoleNames,
    message: "User roles updated successfully.",
  };
}

// 3. PATCH /api/v1/roles/:id — Custom role ka naam ya description edit karna
export async function updateCustomRole(
  tenantId: string,
  actorUserId: string,
  roleId: string,
  input: UpdateRoleInput,
  requestId?: string,
) {
  const [targetRole] = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.id, roleId),
        or(eq(roles.tenantId, tenantId), isNull(roles.tenantId)),
      ),
    )
    .limit(1);

  if (!targetRole) {
    throw Errors.notFound("Role not found in your company.");
  }

  if (targetRole.isSystem) {
    throw Errors.forbidden("System predefined roles cannot be edited.");
  }

  if (input.name && input.name !== targetRole.name) {
    const [dup] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          or(eq(roles.tenantId, tenantId), isNull(roles.tenantId)),
          eq(roles.name, input.name),
          ne(roles.id, roleId),
        ),
      )
      .limit(1);

    if (dup) {
      throw Errors.conflict(`Another role named '${input.name}' already exists.`);
    }
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(roles)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        updatedAt: new Date(),
      })
      .where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)))
      .returning();

    if (input.name && input.name !== targetRole.name) {
      await tx
        .update(tenantMemberships)
        .set({ roleName: input.name, updatedAt: new Date() })
        .where(
          and(
            eq(tenantMemberships.tenantId, tenantId),
            eq(tenantMemberships.roleId, roleId),
          ),
        );
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "AUTH.ROLES.UPDATE",
      entityType: "role",
      entityId: roleId,
      beforeData: { name: targetRole.name, description: targetRole.description },
      afterData: { name: row.name, description: row.description },
      requestId,
    });

    return row;
  });

  return {
    role: updated,
    message: "Custom role updated successfully.",
  };
}

// 4. DELETE /api/v1/roles/:id — Unused custom role delete karna
export async function deleteCustomRole(
  tenantId: string,
  actorUserId: string,
  roleId: string,
  requestId?: string,
) {
  const [targetRole] = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.id, roleId),
        or(eq(roles.tenantId, tenantId), isNull(roles.tenantId)),
      ),
    )
    .limit(1);

  if (!targetRole) {
    throw Errors.notFound("Role not found in your company.");
  }

  if (targetRole.isSystem) {
    throw Errors.forbidden("System predefined roles cannot be deleted.");
  }

  const [[activeMembers], [pendingInvites]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.roleId, roleId),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.tenantId, tenantId),
          eq(userInvitations.roleId, roleId),
          eq(userInvitations.status, "PENDING"),
        ),
      ),
  ]);

  if ((activeMembers?.count ?? 0) > 0 || (pendingInvites?.count ?? 0) > 0) {
    throw Errors.conflict(
      "Role is currently assigned to team members or pending invitations. Reassign users before deleting.",
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(roles).where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)));

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "AUTH.ROLES.DELETE",
      entityType: "role",
      entityId: roleId,
      beforeData: { name: targetRole.name, description: targetRole.description },
      requestId,
    });
  });

  return {
    success: true,
    message: `Custom role '${targetRole.name}' deleted successfully.`,
  };
}
