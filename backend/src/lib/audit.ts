// Critical kaam (login, payment, role change...) ka record audit_logs mein (sensitive fields redacted).
import type { Db } from "../db";
import { auditLogs } from "../db/schema/audit";

type Executor = Pick<Db, "insert">;

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "confirmpassword",
  "confirm_password",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "tokenhash",
  "token_hash",
  "secret",
  "apikey",
  "api_key",
]);

export function redactSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : redactSensitive(v);
    }
    return out;
  }
  return value;
}

export interface AuditEntry {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string; // jaise "AUTH.LOGIN", "TENANT.CREATE"
  entityType: string; // jaise "user", "tenant"
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string;
  requestId?: string;
}

export async function writeAudit(executor: Executor, entry: AuditEntry): Promise<void> {
  await executor.insert(auditLogs).values({
    tenantId: entry.tenantId ?? null,
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    beforeData: entry.beforeData !== undefined ? redactSensitive(entry.beforeData) : null,
    afterData: entry.afterData !== undefined ? redactSensitive(entry.afterData) : null,
    reason: entry.reason,
    requestId: entry.requestId,
  });
}
