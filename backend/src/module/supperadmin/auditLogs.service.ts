// Read-only Audit Logs service: filterable list aur before/after JSON diff detail.
import { and, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { db } from "../../db";
import { auditLogs, tenants, users } from "../../db/schema";
import { redactSensitive } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { pageMeta, type PageMeta } from "../../lib/response";
import type {
  AuditDiffField,
  AuditLogDetail,
  AuditLogItem,
  AuditLogListQuery,
} from "./auditLogs.model";

function mapAuditRow(row: {
  log: typeof auditLogs.$inferSelect;
  tenantName: string | null;
  actorFullName: string | null;
  actorEmail: string | null;
  actorRoles: string[] | null;
}): AuditLogItem {
  return {
    id: row.log.id,
    tenant_id: row.log.tenantId ?? null,
    tenant_name: row.tenantName ?? null,
    actor_user_id: row.log.actorUserId ?? null,
    actor:
      row.log.actorUserId && row.actorFullName && row.actorEmail
        ? {
            id: row.log.actorUserId,
            full_name: row.actorFullName,
            email: row.actorEmail,
            roles: row.actorRoles ?? [],
          }
        : null,
    action: row.log.action,
    entity_type: row.log.entityType,
    entity_id: row.log.entityId ?? null,
    before_data: redactSensitive(row.log.beforeData ?? null),
    after_data: redactSensitive(row.log.afterData ?? null),
    reason: row.log.reason ?? null,
    request_id: row.log.requestId ?? null,
    created_at: row.log.createdAt,
  };
}

function computeJsonDiff(beforeData: unknown, afterData: unknown): AuditDiffField[] {
  const beforeObj =
    beforeData && typeof beforeData === "object" && !Array.isArray(beforeData)
      ? (beforeData as Record<string, unknown>)
      : {};
  const afterObj =
    afterData && typeof afterData === "object" && !Array.isArray(afterData)
      ? (afterData as Record<string, unknown>)
      : {};

  const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  const diffs: AuditDiffField[] = [];

  for (const key of keys) {
    const bVal = beforeObj[key] ?? null;
    const aVal = afterObj[key] ?? null;
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      diffs.push({ field: key, before: bVal, after: aVal });
    }
  }

  return diffs;
}

export async function listAuditLogs(
  query: AuditLogListQuery,
): Promise<{ items: AuditLogItem[]; meta: PageMeta }> {
  const conditions = [];

  if (query.tenant_id) conditions.push(eq(auditLogs.tenantId, query.tenant_id));
  if (query.actor_user_id) conditions.push(eq(auditLogs.actorUserId, query.actor_user_id));
  if (query.action) conditions.push(ilike(auditLogs.action, `%${query.action}%`));
  if (query.entity_type) conditions.push(ilike(auditLogs.entityType, `%${query.entity_type}%`));
  if (query.from) {
    conditions.push(gte(auditLogs.createdAt, new Date(`${query.from}T00:00:00.000Z`)));
  }
  if (query.to) {
    conditions.push(lte(auditLogs.createdAt, new Date(`${query.to}T23:59:59.999Z`)));
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        log: auditLogs,
        tenantName: tenants.name,
        actorFullName: users.fullName,
        actorEmail: users.email,
        actorRoles: users.roles,
      })
      .from(auditLogs)
      .leftJoin(tenants, eq(tenants.id, auditLogs.tenantId))
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ total: count() }).from(auditLogs).where(whereClause),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    items: rows.map(mapAuditRow),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function getAuditLogById(id: string): Promise<AuditLogDetail> {
  const [row] = await db
    .select({
      log: auditLogs,
      tenantName: tenants.name,
      actorFullName: users.fullName,
      actorEmail: users.email,
      actorRoles: users.roles,
    })
    .from(auditLogs)
    .leftJoin(tenants, eq(tenants.id, auditLogs.tenantId))
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(eq(auditLogs.id, id))
    .limit(1);

  if (!row) {
    throw Errors.notFound("Audit log not found");
  }

  const item = mapAuditRow(row);
  return {
    ...item,
    diff: computeJsonDiff(item.before_data, item.after_data),
  };
}
