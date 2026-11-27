// Organization & Company Setup Service: Company Profile, Branches, Departments, Teams.
import { and, asc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  branches,
  departments,
  MODULE_CODES,
  teamMembers,
  teams,
  tenantEntitlements,
  tenantMemberships,
  tenants,
  users,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import type {
  CreateBranchInput,
  CreateDepartmentInput,
  CreateTeamInput,
  OrgQuery,
  UpdateBranchInput,
  UpdateCompanyInput,
  UpdateDepartmentInput,
  UpdateTeamInput,
} from "./companySetup.model";

// Helper: verify user belongs to tenant via tenant_memberships (Rule #1)
async function assertTenantUsers(tenantId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const uniqueIds = Array.from(new Set(userIds));
  const members = await db
    .select({ userId: tenantMemberships.userId })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        inArray(tenantMemberships.userId, uniqueIds),
      ),
    );

  if (members.length !== uniqueIds.length) {
    throw Errors.badRequest("One or more specified users do not belong to your company.");
  }
}

// ==========================================
// 1. COMPANY PROFILE (GET / PUT /company)
// ==========================================
export async function getCompanyProfile(tenantId: string) {
  const [company] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!company) {
    throw Errors.notFound("Company profile not found.");
  }

  return {
    id: company.id,
    name: company.name,
    legalName: company.legalName,
    slug: company.slug,
    logoUrl: company.logoUrl,
    logoDocumentId: company.logoDocumentId,
    address: company.address,
    taxId: company.taxId,
    locale: company.locale,
    defaultCurrency: company.defaultCurrency.trim(),
    timezone: company.timezone,
    financialYear: company.financialYear,
    dateFormat: company.dateFormat,
    numberingPreferences: company.numberingPreferences,
    modulePreferences: company.modulePreferences,
    status: company.status,
    planId: company.planId,
    updatedAt: company.updatedAt,
  };
}

export async function updateCompanyProfile(
  tenantId: string,
  actorUserId: string,
  input: UpdateCompanyInput,
  requestId?: string,
) {
  const [existing] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!existing) {
    throw Errors.notFound("Company profile not found.");
  }

  const incomingNumbering = input.numberingPreferences ?? input.numberingRules;
  const incomingModules = input.modulePreferences ?? input.moduleSettings;

  // Enforce: Company Admin/Owner can only enable modules that are enabled in their active subscription plan
  if (incomingModules) {
    const planEntitlements = await db
      .select({ moduleCode: tenantEntitlements.moduleCode, isEnabled: tenantEntitlements.isEnabled })
      .from(tenantEntitlements)
      .where(eq(tenantEntitlements.tenantId, tenantId));

    const entitlementMap = new Map(planEntitlements.map((e) => [e.moduleCode, e.isEnabled]));
    const moduleCodeSet = new Set<string>(MODULE_CODES);

    for (const [key, val] of Object.entries(incomingModules)) {
      const upperKey = key.toUpperCase();
      if (moduleCodeSet.has(upperKey) && val === true) {
        if (!entitlementMap.get(upperKey)) {
          throw Errors.forbidden(
            `Module '${upperKey}' cannot be enabled because it is not included in your active subscription plan.`,
          );
        }
      }
    }
  }

  const updateData: Partial<typeof tenants.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.legalName !== undefined) updateData.legalName = input.legalName;
  if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl || null;
  if (input.logoDocumentId !== undefined) updateData.logoDocumentId = input.logoDocumentId;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.taxId !== undefined) updateData.taxId = input.taxId;
  if (input.locale !== undefined) updateData.locale = input.locale;
  if (input.defaultCurrency !== undefined) updateData.defaultCurrency = input.defaultCurrency;
  if (input.timezone !== undefined) updateData.timezone = input.timezone;
  if (input.financialYear !== undefined) updateData.financialYear = input.financialYear;
  if (input.dateFormat !== undefined) updateData.dateFormat = input.dateFormat;
  if (incomingNumbering !== undefined) {
    updateData.numberingPreferences = {
      ...(existing.numberingPreferences ?? {}),
      ...incomingNumbering,
    };
  }
  if (incomingModules !== undefined) {
    updateData.modulePreferences = {
      ...(existing.modulePreferences ?? {}),
      ...incomingModules,
    };
  }

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(tenants)
      .set(updateData)
      .where(eq(tenants.id, tenantId))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "ORG.COMPANY.UPDATE",
      entityType: "tenant",
      entityId: tenantId,
      beforeData: {
        name: existing.name,
        legalName: existing.legalName,
        taxId: existing.taxId,
        defaultCurrency: existing.defaultCurrency.trim(),
        timezone: existing.timezone,
        financialYear: existing.financialYear,
        dateFormat: existing.dateFormat,
        modulePreferences: existing.modulePreferences,
      },
      afterData: updateData,
      requestId,
    });

    return rows;
  });

  return {
    id: updated.id,
    name: updated.name,
    legalName: updated.legalName,
    slug: updated.slug,
    logoUrl: updated.logoUrl,
    logoDocumentId: updated.logoDocumentId,
    address: updated.address,
    taxId: updated.taxId,
    locale: updated.locale,
    defaultCurrency: updated.defaultCurrency.trim(),
    timezone: updated.timezone,
    financialYear: updated.financialYear,
    dateFormat: updated.dateFormat,
    numberingPreferences: updated.numberingPreferences,
    modulePreferences: updated.modulePreferences,
    status: updated.status,
    updatedAt: updated.updatedAt,
  };
}

// ==========================================
// 2. BRANCHES (GET / POST / PUT /branches)
// ==========================================
export async function listBranches(tenantId: string, query: OrgQuery) {
  const conditions = [eq(branches.tenantId, tenantId)];

  if (query.status) {
    conditions.push(eq(branches.status, query.status));
  }
  if (query.search) {
    conditions.push(
      or(
        ilike(branches.name, `%${query.search}%`),
        ilike(branches.code, `%${query.search}%`),
      )!,
    );
  }

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(branches).where(and(...conditions)),
    db
      .select()
      .from(branches)
      .where(and(...conditions))
      .orderBy(asc(branches.name))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    branches: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createBranch(
  tenantId: string,
  actorUserId: string,
  input: CreateBranchInput,
  requestId?: string,
) {
  const [existingCode] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.tenantId, tenantId), eq(branches.code, input.code)))
    .limit(1);

  if (existingCode) {
    throw Errors.conflict(`Branch with code '${input.code}' already exists.`);
  }

  const created = await db.transaction(async (tx) => {
    if (input.isHeadOffice) {
      await tx
        .update(branches)
        .set({ isHeadOffice: false, updatedAt: new Date() })
        .where(eq(branches.tenantId, tenantId));
    }

    const [row] = await tx
      .insert(branches)
      .values({
        tenantId,
        name: input.name,
        code: input.code,
        address: input.address ?? null,
        status: input.status,
        isHeadOffice: input.isHeadOffice,
      })
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "ORG.BRANCH.CREATE",
      entityType: "branch",
      entityId: row.id,
      afterData: { name: row.name, code: row.code, status: row.status },
      requestId,
    });

    return row;
  });

  return { branch: created };
}

export async function updateBranch(
  tenantId: string,
  actorUserId: string,
  branchId: string,
  input: UpdateBranchInput,
  requestId?: string,
) {
  const [existing] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw Errors.notFound("Branch not found in your company.");
  }

  if (input.code && input.code !== existing.code) {
    const [dup] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.tenantId, tenantId),
          eq(branches.code, input.code),
          ne(branches.id, branchId),
        ),
      )
      .limit(1);

    if (dup) {
      throw Errors.conflict(`Another branch with code '${input.code}' already exists.`);
    }
  }

  const updated = await db.transaction(async (tx) => {
    if (input.isHeadOffice) {
      await tx
        .update(branches)
        .set({ isHeadOffice: false, updatedAt: new Date() })
        .where(and(eq(branches.tenantId, tenantId), ne(branches.id, branchId)));
    }

    const [row] = await tx
      .update(branches)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.code !== undefined && { code: input.code }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.isHeadOffice !== undefined && { isHeadOffice: input.isHeadOffice }),
        updatedAt: new Date(),
      })
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "ORG.BRANCH.UPDATE",
      entityType: "branch",
      entityId: branchId,
      beforeData: { name: existing.name, code: existing.code, status: existing.status },
      afterData: { name: row.name, code: row.code, status: row.status },
      requestId,
    });

    return row;
  });

  return { branch: updated };
}

// ==========================================
// 3. DEPARTMENTS (GET / POST / PUT /departments)
// ==========================================
export async function listDepartments(tenantId: string, query: OrgQuery) {
  const conditions = [eq(departments.tenantId, tenantId)];

  if (query.status) {
    conditions.push(eq(departments.status, query.status));
  }
  const effectiveBranchId = query.branchId ?? query.branch_id;
  if (effectiveBranchId) {
    conditions.push(eq(departments.branchId, effectiveBranchId));
  }
  if (query.search) {
    conditions.push(ilike(departments.name, `%${query.search}%`));
  }

  const rows = await db
    .select({
      id: departments.id,
      tenantId: departments.tenantId,
      name: departments.name,
      branchId: departments.branchId,
      branchName: branches.name,
      managerUserId: departments.managerUserId,
      managerName: users.fullName,
      managerEmail: users.email,
      status: departments.status,
      createdAt: departments.createdAt,
      updatedAt: departments.updatedAt,
    })
    .from(departments)
    .leftJoin(branches, eq(branches.id, departments.branchId))
    .leftJoin(users, eq(users.id, departments.managerUserId))
    .where(and(...conditions))
    .orderBy(asc(departments.name));

  return { departments: rows };
}

export async function createDepartment(
  tenantId: string,
  actorUserId: string,
  input: CreateDepartmentInput,
  requestId?: string,
) {
  if (input.branchId) {
    const [branchRow] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)))
      .limit(1);

    if (!branchRow) {
      throw Errors.notFound("Specified branch not found in your company.");
    }
  }

  if (input.managerUserId) {
    await assertTenantUsers(tenantId, [input.managerUserId]);
  }

  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(departments)
      .values({
        tenantId,
        name: input.name,
        branchId: input.branchId ?? null,
        managerUserId: input.managerUserId ?? null,
        status: input.status,
      })
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "ORG.DEPARTMENT.CREATE",
      entityType: "department",
      entityId: rows[0].id,
      afterData: {
        name: rows[0].name,
        branchId: rows[0].branchId,
        managerUserId: rows[0].managerUserId,
      },
      requestId,
    });

    return rows;
  });

  return { department: created };
}

export async function updateDepartment(
  tenantId: string,
  actorUserId: string,
  departmentId: string,
  input: UpdateDepartmentInput,
  requestId?: string,
) {
  const [existing] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw Errors.notFound("Department not found in your company.");
  }

  if (input.branchId) {
    const [branchRow] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)))
      .limit(1);

    if (!branchRow) {
      throw Errors.notFound("Specified branch not found in your company.");
    }
  }

  if (input.managerUserId) {
    await assertTenantUsers(tenantId, [input.managerUserId]);
  }

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(departments)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.branchId !== undefined && { branchId: input.branchId }),
        ...(input.managerUserId !== undefined && { managerUserId: input.managerUserId }),
        ...(input.status !== undefined && { status: input.status }),
        updatedAt: new Date(),
      })
      .where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId)))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "ORG.DEPARTMENT.UPDATE",
      entityType: "department",
      entityId: departmentId,
      beforeData: {
        name: existing.name,
        branchId: existing.branchId,
        managerUserId: existing.managerUserId,
        status: existing.status,
      },
      afterData: {
        name: rows[0].name,
        branchId: rows[0].branchId,
        managerUserId: rows[0].managerUserId,
        status: rows[0].status,
      },
      requestId,
    });

    return rows;
  });

  return { department: updated };
}

// ==========================================
// 4. TEAMS (GET / POST / PUT /teams)
// ==========================================
export async function listTeams(tenantId: string, query: OrgQuery) {
  const conditions = [eq(teams.tenantId, tenantId)];

  if (query.status) {
    conditions.push(eq(teams.status, query.status));
  }
  const effectiveDeptId = query.departmentId ?? query.department_id;
  if (effectiveDeptId) {
    conditions.push(eq(teams.departmentId, effectiveDeptId));
  }
  const effectiveBranchId = query.branchId ?? query.branch_id;
  if (effectiveBranchId) {
    conditions.push(eq(departments.branchId, effectiveBranchId));
  }
  if (query.search) {
    conditions.push(ilike(teams.name, `%${query.search}%`));
  }

  const teamRows = await db
    .select({
      id: teams.id,
      tenantId: teams.tenantId,
      name: teams.name,
      description: teams.description,
      departmentId: teams.departmentId,
      departmentName: departments.name,
      parentTeamId: teams.parentTeamId,
      managerUserId: teams.managerUserId,
      managerName: users.fullName,
      managerEmail: users.email,
      status: teams.status,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
    })
    .from(teams)
    .leftJoin(departments, eq(departments.id, teams.departmentId))
    .leftJoin(users, eq(users.id, teams.managerUserId))
    .where(and(...conditions))
    .orderBy(asc(teams.name));

  const teamIds = teamRows.map((t) => t.id);
  const membersByTeam: Record<
    string,
    Array<{ userId: string; fullName: string; email: string; roleInTeam: string }>
  > = {};

  if (teamIds.length > 0) {
    const memberRows = await db
      .select({
        teamId: teamMembers.teamId,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        roleInTeam: teamMembers.roleInTeam,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(inArray(teamMembers.teamId, teamIds));

    for (const m of memberRows) {
      if (!membersByTeam[m.teamId]) {
        membersByTeam[m.teamId] = [];
      }
      membersByTeam[m.teamId].push({
        userId: m.userId,
        fullName: m.fullName,
        email: m.email,
        roleInTeam: m.roleInTeam,
      });
    }
  }

  return {
    teams: teamRows.map((t) => ({
      ...t,
      members: membersByTeam[t.id] ?? [],
    })),
  };
}

export async function createTeam(
  tenantId: string,
  actorUserId: string,
  input: CreateTeamInput,
  requestId?: string,
) {
  if (input.departmentId) {
    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, input.departmentId), eq(departments.tenantId, tenantId)))
      .limit(1);

    if (!dept) {
      throw Errors.notFound("Specified department not found in your company.");
    }
  }

  if (input.parentTeamId) {
    const [parent] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, input.parentTeamId), eq(teams.tenantId, tenantId)))
      .limit(1);

    if (!parent) {
      throw Errors.notFound("Specified parent team not found in your company.");
    }
  }

  const incomingMembers = input.memberIds ?? input.memberUserIds ?? [];
  const usersToValidate: string[] = [];
  if (input.managerUserId) usersToValidate.push(input.managerUserId);
  if (incomingMembers.length > 0) usersToValidate.push(...incomingMembers);
  if (usersToValidate.length > 0) {
    await assertTenantUsers(tenantId, usersToValidate);
  }

  const created = await db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teams)
      .values({
        tenantId,
        name: input.name,
        description: input.description ?? null,
        departmentId: input.departmentId ?? null,
        parentTeamId: input.parentTeamId ?? null,
        managerUserId: input.managerUserId ?? null,
        status: input.status,
      })
      .returning();

    const uniqueMemberIds = Array.from(new Set(incomingMembers));
    if (uniqueMemberIds.length > 0) {
      await tx.insert(teamMembers).values(
        uniqueMemberIds.map((userId) => ({
          tenantId,
          teamId: team.id,
          userId,
          roleInTeam: userId === input.managerUserId ? "LEAD" : "MEMBER",
        })),
      );
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "ORG.TEAM.CREATE",
      entityType: "team",
      entityId: team.id,
      afterData: {
        name: team.name,
        departmentId: team.departmentId,
        parentTeamId: team.parentTeamId,
        managerUserId: team.managerUserId,
        memberCount: uniqueMemberIds.length,
      },
      requestId,
    });

    return team;
  });

  return { team: created };
}

export async function updateTeam(
  tenantId: string,
  actorUserId: string,
  teamId: string,
  input: UpdateTeamInput,
  requestId?: string,
) {
  const [existing] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw Errors.notFound("Team not found in your company.");
  }

  if (input.parentTeamId === teamId) {
    throw Errors.badRequest("A team cannot be its own parent.");
  }

  if (input.departmentId) {
    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, input.departmentId), eq(departments.tenantId, tenantId)))
      .limit(1);
    if (!dept) throw Errors.notFound("Specified department not found in your company.");
  }

  if (input.parentTeamId) {
    const [parent] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, input.parentTeamId), eq(teams.tenantId, tenantId)))
      .limit(1);
    if (!parent) throw Errors.notFound("Specified parent team not found in your company.");
  }

  const usersToValidate: string[] = [];
  if (input.managerUserId) usersToValidate.push(input.managerUserId);
  if (input.memberIds && input.memberIds.length > 0) usersToValidate.push(...input.memberIds);
  if (usersToValidate.length > 0) {
    await assertTenantUsers(tenantId, usersToValidate);
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(teams)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.departmentId !== undefined && { departmentId: input.departmentId }),
        ...(input.parentTeamId !== undefined && { parentTeamId: input.parentTeamId }),
        ...(input.managerUserId !== undefined && { managerUserId: input.managerUserId }),
        ...(input.status !== undefined && { status: input.status }),
        updatedAt: new Date(),
      })
      .where(and(eq(teams.id, teamId), eq(teams.tenantId, tenantId)))
      .returning();

    if (input.memberIds !== undefined) {
      await tx.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
      const uniqueMemberIds = Array.from(new Set(input.memberIds));
      if (uniqueMemberIds.length > 0) {
        const effectiveManagerId = input.managerUserId ?? row.managerUserId;
        await tx.insert(teamMembers).values(
          uniqueMemberIds.map((userId) => ({
            tenantId,
            teamId,
            userId,
            roleInTeam: userId === effectiveManagerId ? "LEAD" : "MEMBER",
          })),
        );
      }
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: "ORG.TEAM.UPDATE",
      entityType: "team",
      entityId: teamId,
      beforeData: { name: existing.name, status: existing.status },
      afterData: { name: row.name, status: row.status, membersUpdated: input.memberIds !== undefined },
      requestId,
    });

    return row;
  });

  return { team: updated };
}
