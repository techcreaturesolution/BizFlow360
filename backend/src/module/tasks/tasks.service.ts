// Tasks Service: Company Tasks, My Tasks, Assignment, Status Updates & Comments.
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  notifications,
  taskComments,
  tasks,
  tenantMemberships,
  users,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { hasTenantWideScope, type AuthContext } from "../../middlewares/guards";
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

  const isCompanyWide = hasTenantWideScope(auth, "TASKS.TASKS.VIEW_ALL");
  if (!isCompanyWide && task.assigneeUserId !== auth.userId && task.createdBy !== auth.userId) {
    throw Errors.forbidden("You do not have access to this task.");
  }
  return task;
}

export async function listTasks(auth: AuthContext, query: TasksQuery, onlyMyTasks = false) {
  const tenantId = auth.tenantId!;
  const isCompanyWide = !onlyMyTasks && hasTenantWideScope(auth, "TASKS.TASKS.VIEW_ALL");

  const conditions = [eq(tasks.tenantId, tenantId)];

  if (onlyMyTasks) {
    conditions.push(eq(tasks.assigneeUserId, auth.userId));
  } else if (!isCompanyWide) {
    conditions.push(or(eq(tasks.assigneeUserId, auth.userId), eq(tasks.createdBy, auth.userId))!);
  } else if (query.assigneeUserId) {
    conditions.push(eq(tasks.assigneeUserId, query.assigneeUserId));
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
    scope: onlyMyTasks ? "MY_TASKS" : isCompanyWide ? "COMPANY_WIDE" : "ASSIGNED_ONLY",
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
  if (input.assigneeUserId) {
    await assertTenantMember(tenantId, input.assigneeUserId);
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
        assigneeUserId: input.assigneeUserId ?? auth.userId,
        createdBy: auth.userId,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        branchId: input.branchId ?? null,
        departmentId: input.departmentId ?? null,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
      })
      .returning();

    if (input.assigneeUserId && input.assigneeUserId !== auth.userId) {
      await tx.insert(notifications).values({
        tenantId,
        userId: input.assigneeUserId,
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
      afterData: { title: rows[0].title, priority: rows[0].priority, assigneeUserId: rows[0].assigneeUserId },
      requestId,
    });

    return rows;
  });

  return { task: created };
}

export async function getTaskDetail(auth: AuthContext, taskId: string) {
  const task = await assertTaskAccess(auth, taskId);

  const comments = await db
    .select({
      comment: taskComments,
      authorName: users.fullName,
    })
    .from(taskComments)
    .leftJoin(users, eq(users.id, taskComments.authorUserId))
    .where(and(eq(taskComments.taskId, taskId), eq(taskComments.tenantId, auth.tenantId!)))
    .orderBy(desc(taskComments.createdAt));

  return {
    task,
    comments: comments.map((c) => ({
      ...c.comment,
      authorName: c.authorName ?? null,
    })),
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

  if (input.assigneeUserId) {
    await assertTenantMember(tenantId, input.assigneeUserId);
  }

  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(tasks)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status !== undefined && {
          status: input.status,
          completedAt: input.status === "DONE" ? now : existing.completedAt,
        }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.assigneeUserId !== undefined && { assigneeUserId: input.assigneeUserId }),
        ...(input.dueAt !== undefined && { dueAt: input.dueAt ? new Date(input.dueAt) : null }),
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
  await assertTenantMember(tenantId, input.assigneeUserId);

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(tasks)
      .set({ assigneeUserId: input.assigneeUserId, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
      .returning();

    await tx.insert(notifications).values({
      tenantId,
      userId: input.assigneeUserId,
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
      afterData: { assigneeUserId: input.assigneeUserId },
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
  await assertTaskAccess(auth, taskId);
  const tenantId = auth.tenantId!;

  const [comment] = await db
    .insert(taskComments)
    .values({
      tenantId,
      taskId,
      authorUserId: auth.userId,
      comment: input.comment,
    })
    .returning();

  return { comment };
}
