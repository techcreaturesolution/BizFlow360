// Tasks Service: Company/Team/My Tasks with Record Scope, Timeline & Mentions.
import { and, desc, eq, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  auditLogs,
  notifications,
  taskComments,
  tasks,
  tenantMemberships,
  users,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { resolveRecordScope, type AuthContext } from "../../middlewares/guards";
import type {
  AddTaskCommentInput,
  AssignTaskInput,
  CreateTaskInput,
  TasksQuery,
  UpdateTaskInput,
} from "./tasks.model";

async function assertTenantMember(tenantId: string, userId: string) {
  const [m] = await db
    .select({ id: tenantMemberships.id })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
    .limit(1);
  if (!m) throw Errors.badRequest("Assignee user does not belong to this company.");
}

async function assertTaskAccess(auth: AuthContext, taskId: string) {
  const tenantId = auth.tenantId!;
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
    .limit(1);

  if (!task) throw Errors.notFound("Task not found.");

  const scopeCtx = await resolveRecordScope(auth, "TASKS.TASKS.VIEW_ALL", "TASKS.TASKS.VIEW_TEAM");

  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    const inTeam =
      (task.departmentId && scopeCtx.departmentIds.includes(task.departmentId)) ||
      (task.assigneeUserId && scopeCtx.teamUserIds.includes(task.assigneeUserId)) ||
      (task.createdBy && scopeCtx.teamUserIds.includes(task.createdBy));

    if (!inTeam) {
      throw Errors.forbidden("You do not have access to a task outside your team/department.");
    }
  } else if (scopeCtx.scope === "OWN_ONLY") {
    if (task.assigneeUserId !== auth.userId && task.createdBy !== auth.userId) {
      throw Errors.forbidden("You do not have access to this task.");
    }
  }

  return task;
}

export async function listTasks(auth: AuthContext, query: TasksQuery, onlyMyTasks = false) {
  const tenantId = auth.tenantId!;
  const scopeCtx = onlyMyTasks
    ? { scope: "OWN_ONLY" as const, departmentIds: [], teamIds: [], teamUserIds: [auth.userId] }
    : await resolveRecordScope(auth, "TASKS.TASKS.VIEW_ALL", "TASKS.TASKS.VIEW_TEAM");

  const conditions = [eq(tasks.tenantId, tenantId)];

  if (onlyMyTasks) {
    conditions.push(eq(tasks.assigneeUserId, auth.userId));
  } else if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    const parts = [
      inArray(tasks.assigneeUserId, scopeCtx.teamUserIds),
      inArray(tasks.createdBy, scopeCtx.teamUserIds),
    ];
    if (scopeCtx.departmentIds.length > 0) {
      parts.push(inArray(tasks.departmentId, scopeCtx.departmentIds));
    }
    conditions.push(or(...parts)!);
  } else if (scopeCtx.scope === "OWN_ONLY") {
    conditions.push(or(eq(tasks.assigneeUserId, auth.userId), eq(tasks.createdBy, auth.userId))!);
  }

  const filterAssignee = query.assigneeUserId ?? query.assignee_user_id;
  if (filterAssignee) {
    if (scopeCtx.scope === "TEAM_DEPARTMENT" && !scopeCtx.teamUserIds.includes(filterAssignee)) {
      throw Errors.forbidden("Cannot filter tasks for users outside your team/department.");
    }
    conditions.push(eq(tasks.assigneeUserId, filterAssignee));
  }

  const filterProject = query.projectId ?? query.project_id;
  if (filterProject) conditions.push(eq(tasks.projectId, filterProject));

  const filterDue = query.dueAt ?? query.due_at;
  if (filterDue) {
    const d = new Date(filterDue);
    if (!Number.isNaN(d.getTime())) conditions.push(lte(tasks.dueAt, d));
  }

  if (query.status) conditions.push(eq(tasks.status, query.status));
  if (query.priority) conditions.push(eq(tasks.priority, query.priority));
  if (query.search) {
    conditions.push(or(ilike(tasks.title, `%${query.search}%`), ilike(tasks.description, `%${query.search}%`))!);
  }

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(tasks).where(and(...conditions)),
    db
      .select({
        task: tasks,
        assigneeName: users.fullName,
      })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeUserId))
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    scope: onlyMyTasks ? "MY_TASKS" : scopeCtx.scope,
    tasks: rows.map((r) => ({
      ...r.task,
      assigneeName: r.assigneeName ?? null,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createTask(
  auth: AuthContext,
  input: CreateTaskInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const targetAssignee = input.assigneeUserId ?? input.assignee_user_id ?? auth.userId;
  const dueAtStr = input.dueAt ?? input.due_at;
  const projectId = input.projectId ?? input.project_id ?? null;

  await assertTenantMember(tenantId, targetAssignee);

  const scopeCtx = await resolveRecordScope(auth, "TASKS.TASKS.VIEW_ALL", "TASKS.TASKS.VIEW_TEAM");
  if (scopeCtx.scope === "TEAM_DEPARTMENT" && !scopeCtx.teamUserIds.includes(targetAssignee)) {
    throw Errors.forbidden("Cannot assign tasks to users outside your team/department.");
  }

  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(tasks)
      .values({
        tenantId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        assigneeUserId: targetAssignee,
        createdBy: auth.userId,
        dueAt: dueAtStr ? new Date(dueAtStr) : null,
        branchId: input.branchId ?? auth.branchId ?? null,
        departmentId: input.departmentId ?? auth.departmentId ?? null,
        projectId,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
      })
      .returning();

    if (targetAssignee !== auth.userId) {
      await tx.insert(notifications).values({
        tenantId,
        userId: targetAssignee,
        category: "GENERAL",
        title: `New Task Assigned: ${input.title}`,
        message: `A new ${input.priority.toLowerCase()} priority task has been assigned to you.`,
        entityType: "TASK",
        entityId: rows[0].id,
      });
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "TASKS.TASK.CREATE",
      entityType: "task",
      entityId: rows[0].id,
      afterData: { title: rows[0].title, priority: rows[0].priority, assigneeUserId: targetAssignee },
      requestId,
    });

    return rows;
  });

  return { task: created };
}

export async function getTaskDetail(auth: AuthContext, taskId: string) {
  const task = await assertTaskAccess(auth, taskId);

  const [comments, timeline] = await Promise.all([
    db
      .select({
        comment: taskComments,
        authorName: users.fullName,
      })
      .from(taskComments)
      .leftJoin(users, eq(users.id, taskComments.authorUserId))
      .where(and(eq(taskComments.taskId, taskId), eq(taskComments.tenantId, auth.tenantId!)))
      .orderBy(desc(taskComments.createdAt)),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorUserId: auditLogs.actorUserId,
        actorName: users.fullName,
        beforeData: auditLogs.beforeData,
        afterData: auditLogs.afterData,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(
        and(
          eq(auditLogs.tenantId, auth.tenantId!),
          eq(auditLogs.entityType, "task"),
          eq(auditLogs.entityId, taskId),
        ),
      )
      .orderBy(desc(auditLogs.createdAt)),
  ]);

  return {
    task,
    comments: comments.map((c) => ({
      ...c.comment,
      authorName: c.authorName ?? null,
    })),
    timeline,
  };
}

export async function updateTask(
  auth: AuthContext,
  taskId: string,
  input: UpdateTaskInput,
  requestId?: string,
) {
  const existing = await assertTaskAccess(auth, taskId);
  const tenantId = auth.tenantId!;

  const targetAssignee = input.assigneeUserId ?? input.assignee_user_id;
  if (targetAssignee) {
    await assertTenantMember(tenantId, targetAssignee);
  }
  const dueAtStr = input.dueAt ?? input.due_at;
  const projectId = input.projectId ?? input.project_id;

  const isCompletedStatus = input.status === "DONE" || input.status === "COMPLETED";
  const now = new Date();

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(tasks)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status !== undefined && {
          status: input.status,
          completedAt: isCompletedStatus ? now : existing.completedAt,
        }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(targetAssignee !== undefined && { assigneeUserId: targetAssignee }),
        ...(dueAtStr !== undefined && { dueAt: dueAtStr ? new Date(dueAtStr) : null }),
        ...(projectId !== undefined && { projectId }),
        updatedAt: now,
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "TASKS.TASK.UPDATE",
      entityType: "task",
      entityId: taskId,
      beforeData: { status: existing.status, priority: existing.priority },
      afterData: { status: rows[0].status, priority: rows[0].priority },
      requestId,
    });

    return rows;
  });

  return { task: updated };
}

export async function assignTask(
  auth: AuthContext,
  taskId: string,
  input: AssignTaskInput,
  requestId?: string,
) {
  const existing = await assertTaskAccess(auth, taskId);
  const tenantId = auth.tenantId!;
  const targetAssignee = (input.assigneeUserId ?? input.assignee_user_id)!;

  await assertTenantMember(tenantId, targetAssignee);

  const scopeCtx = await resolveRecordScope(auth, "TASKS.TASKS.VIEW_ALL", "TASKS.TASKS.VIEW_TEAM");
  if (scopeCtx.scope === "TEAM_DEPARTMENT" && !scopeCtx.teamUserIds.includes(targetAssignee)) {
    throw Errors.forbidden("Cannot assign tasks to users outside your team/department.");
  }

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(tasks)
      .set({ assigneeUserId: targetAssignee, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
      .returning();

    await tx.insert(notifications).values({
      tenantId,
      userId: targetAssignee,
      category: "GENERAL",
      title: `Task Assigned: ${existing.title}`,
      message: `You have been assigned to task "${existing.title}".`,
      entityType: "TASK",
      entityId: taskId,
    });

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "TASKS.TASK.ASSIGN",
      entityType: "task",
      entityId: taskId,
      beforeData: { assigneeUserId: existing.assigneeUserId },
      afterData: { assigneeUserId: targetAssignee },
      requestId,
    });

    return rows;
  });

  return { task: updated };
}

export async function addTaskComment(
  auth: AuthContext,
  taskId: string,
  input: AddTaskCommentInput,
) {
  const task = await assertTaskAccess(auth, taskId);
  const tenantId = auth.tenantId!;
  const commentText = (input.comment ?? input.body)!;
  const mentions = Array.from(new Set(input.mentions ?? []));

  const [comment] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(taskComments)
      .values({
        tenantId,
        taskId,
        authorUserId: auth.userId,
        comment: commentText,
        mentions,
      })
      .returning();

    // Notify assignee & mentioned users
    const usersToNotify = new Set<string>(mentions);
    if (task.assigneeUserId && task.assigneeUserId !== auth.userId) {
      usersToNotify.add(task.assigneeUserId);
    }

    for (const targetUid of usersToNotify) {
      if (targetUid !== auth.userId) {
        await tx.insert(notifications).values({
          tenantId,
          userId: targetUid,
          category: "GENERAL",
          title: `New comment on task "${task.title}"`,
          message: commentText.slice(0, 140),
          entityType: "TASK",
          entityId: taskId,
        });
      }
    }

    return rows;
  });

  return { comment };
}
