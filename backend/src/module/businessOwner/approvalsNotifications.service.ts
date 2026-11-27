// Approvals & Notifications Service: Approval Inbox, Approve/Reject with Audit, In-App Alerts & Preferences.
import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  approvalRequests,
  auditLogs,
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferences,
  notifications,
  users,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import type {
  ApprovalDecisionInput,
  ApprovalInboxQuery,
  NotificationsQuery,
  TenantAuditLogsQuery,
  UpdateNotificationPreferencesInput,
} from "./approvalsNotifications.model";

// ==========================================
// 1. APPROVAL INBOX (GET /approvals/inbox)
// ==========================================
export async function getApprovalInbox(tenantId: string, query: ApprovalInboxQuery) {
  const conditions = [eq(approvalRequests.tenantId, tenantId)];

  if (query.status) {
    conditions.push(eq(approvalRequests.status, query.status));
  }
  if (query.entityType) {
    conditions.push(eq(approvalRequests.entityType, query.entityType));
  }
  if (query.branchId) {
    conditions.push(eq(approvalRequests.branchId, query.branchId));
  }
  if (query.departmentId) {
    conditions.push(eq(approvalRequests.departmentId, query.departmentId));
  }

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows, pendingByTypeRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(approvalRequests)
      .where(and(...conditions)),
    db
      .select({
        approval: approvalRequests,
        requesterName: users.fullName,
        requesterEmail: users.email,
      })
      .from(approvalRequests)
      .leftJoin(users, eq(users.id, approvalRequests.requestedBy))
      .where(and(...conditions))
      .orderBy(desc(approvalRequests.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({
        entityType: approvalRequests.entityType,
        count: sql<number>`count(*)::int`,
      })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.tenantId, tenantId),
          eq(approvalRequests.status, "PENDING"),
        ),
      )
      .groupBy(approvalRequests.entityType),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    approvals: rows.map((r) => ({
      id: r.approval.id,
      entityType: r.approval.entityType,
      entityId: r.approval.entityId,
      entityNumber: r.approval.entityNumber,
      title: r.approval.title,
      amount: r.approval.amount !== null ? Number(r.approval.amount) : null,
      currency: r.approval.currency.trim(),
      status: r.approval.status,
      requestedBy: {
        id: r.approval.requestedBy,
        fullName: r.requesterName ?? null,
        email: r.requesterEmail ?? null,
      },
      approverUserId: r.approval.approverUserId,
      branchId: r.approval.branchId,
      departmentId: r.approval.departmentId,
      decisionComment: r.approval.decisionComment,
      decidedBy: r.approval.decidedBy,
      decidedAt: r.approval.decidedAt,
      createdAt: r.approval.createdAt,
    })),
    pendingCountsByType: pendingByTypeRows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

// ==========================================
// 2. APPROVE / REJECT (POST /approvals/:id/approve | /reject)
// ==========================================
export async function decideApprovalRequest(
  tenantId: string,
  actorUserId: string,
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  input: ApprovalDecisionInput,
  requestId?: string,
) {
  const [existing] = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.id, approvalId),
        eq(approvalRequests.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw Errors.notFound("Approval request not found in your company.");
  }

  if (existing.status !== "PENDING") {
    throw Errors.conflict(`Approval request is already ${existing.status}.`);
  }

  const commentText = input.reason || input.comment || null;
  const now = new Date();

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(approvalRequests)
      .set({
        status: decision,
        decisionComment: commentText,
        decidedBy: actorUserId,
        decidedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(approvalRequests.id, approvalId),
          eq(approvalRequests.tenantId, tenantId),
        ),
      )
      .returning();

    // Notify requester via in-app notification
    await tx.insert(notifications).values({
      tenantId,
      userId: existing.requestedBy,
      category: "APPROVAL",
      title: `${existing.entityType} ${decision}`,
      message: `Your ${existing.entityType.toLowerCase()} "${existing.title}" has been ${decision.toLowerCase()}.${commentText ? ` Note: ${commentText}` : ""}`,
      entityType: existing.entityType,
      entityId: existing.entityId,
    });

    await writeAudit(tx, {
      tenantId,
      actorUserId,
      action: decision === "APPROVED" ? "APPROVAL.APPROVE" : "APPROVAL.REJECT",
      entityType: "approval_request",
      entityId: approvalId,
      beforeData: { status: existing.status },
      afterData: {
        status: decision,
        decidedBy: actorUserId,
        decidedAt: now.toISOString(),
        comment: commentText,
      },
      reason: commentText ?? undefined,
      requestId,
    });

    return row;
  });

  return {
    approval: {
      id: updated.id,
      entityType: updated.entityType,
      entityId: updated.entityId,
      status: updated.status,
      decisionComment: updated.decisionComment,
      decidedBy: updated.decidedBy,
      decidedAt: updated.decidedAt,
    },
    message: `Request has been ${decision.toLowerCase()} successfully.`,
  };
}

// ==========================================
// 3. NOTIFICATIONS (GET, PATCH /:id/read, POST /read-all)
// ==========================================
export async function listNotifications(
  tenantId: string,
  userId: string,
  query: NotificationsQuery,
) {
  const conditions = [
    eq(notifications.tenantId, tenantId),
    eq(notifications.userId, userId),
  ];

  if (query.unread_only === true) {
    conditions.push(eq(notifications.isRead, false));
  } else if (query.isRead !== undefined) {
    conditions.push(eq(notifications.isRead, query.isRead));
  }
  if (query.category) {
    conditions.push(eq(notifications.category, query.category));
  }

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], [unreadRow], rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, tenantId),
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
        ),
      ),
    db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    notifications: rows,
    unreadCount: unreadRow?.count ?? 0,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function markNotificationRead(
  tenantId: string,
  userId: string,
  notificationId: string,
) {
  const [existing] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw Errors.notFound("Notification not found.");
  }

  if (existing.isRead) {
    return {
      notification: existing,
      message: "Notification was already marked as read.",
    };
  }

  const [updated] = await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
      ),
    )
    .returning();

  return {
    notification: updated,
    message: "Notification marked as read.",
  };
}

export async function markAllNotificationsRead(tenantId: string, userId: string) {
  const now = new Date();
  const updatedRows = await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: now,
    })
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
      ),
    )
    .returning({ id: notifications.id });

  return {
    markedReadCount: updatedRows.length,
    message: `${updatedRows.length} notifications marked as read.`,
  };
}

// ==========================================
// 4. NOTIFICATION PREFERENCES (GET/PUT /notification-preferences)
// ==========================================
export async function getNotificationPreferences(tenantId: string, userId: string) {
  const [saved] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.tenantId, tenantId),
        eq(notificationPreferences.userId, userId),
      ),
    )
    .limit(1);

  if (!saved) {
    return {
      isDefault: true,
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }

  return {
    isDefault: false,
    preferences: saved.preferences,
    updatedAt: saved.updatedAt,
  };
}

export async function updateNotificationPreferences(
  tenantId: string,
  userId: string,
  input: UpdateNotificationPreferencesInput,
  requestId?: string,
) {
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.tenantId, tenantId),
        eq(notificationPreferences.userId, userId),
      ),
    )
    .limit(1);

  const mergedPreferences = {
    ...(existing?.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES),
    ...input,
  };

  const now = new Date();

  const saved = await db.transaction(async (tx) => {
    let row;
    if (existing) {
      const [updated] = await tx
        .update(notificationPreferences)
        .set({
          preferences: mergedPreferences,
          updatedAt: now,
        })
        .where(eq(notificationPreferences.id, existing.id))
        .returning();
      row = updated;
    } else {
      const [inserted] = await tx
        .insert(notificationPreferences)
        .values({
          tenantId,
          userId,
          preferences: mergedPreferences,
        })
        .returning();
      row = inserted;
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId: userId,
      action: "NOTIFICATIONS.PREFERENCES.UPDATE",
      entityType: "notification_preferences",
      entityId: row.id,
      beforeData: existing?.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
      afterData: mergedPreferences,
      requestId,
    });

    return row;
  });

  return {
    preferences: saved.preferences,
    updatedAt: saved.updatedAt,
    message: "Notification preferences updated successfully.",
  };
}

// ==========================================
// 5. TENANT AUDIT LOGS (GET /audit-logs - Read-only)
// ==========================================
export async function listTenantAuditLogs(tenantId: string, query: TenantAuditLogsQuery) {
  const conditions = [eq(auditLogs.tenantId, tenantId)];

  const actorId = query.actor_user_id ?? query.actorUserId;
  if (actorId) {
    conditions.push(eq(auditLogs.actorUserId, actorId));
  }
  if (query.action) {
    conditions.push(ilike(auditLogs.action, `%${query.action}%`));
  }
  const entityType = query.entity_type ?? query.entityType;
  if (entityType) {
    conditions.push(eq(auditLogs.entityType, entityType));
  }
  if (query.from) {
    const d = new Date(query.from);
    if (!Number.isNaN(d.getTime())) conditions.push(gte(auditLogs.createdAt, d));
  }
  if (query.to) {
    const d = new Date(query.to);
    if (!Number.isNaN(d.getTime())) conditions.push(lte(auditLogs.createdAt, d));
  }

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(and(...conditions)),
    db
      .select({
        log: auditLogs,
        actorName: users.fullName,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    auditLogs: rows.map((r) => ({
      id: r.log.id,
      tenant_id: r.log.tenantId,
      actor_user_id: r.log.actorUserId,
      actor_name: r.actorName ?? null,
      actor_email: r.actorEmail ?? null,
      action: r.log.action,
      entity_type: r.log.entityType,
      entity_id: r.log.entityId,
      before_data: r.log.beforeData,
      after_data: r.log.afterData,
      reason: r.log.reason,
      request_id: r.log.requestId,
      created_at: r.log.createdAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
