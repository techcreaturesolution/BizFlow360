// Documents Service: Tenant-scoped Upload URLs, Document registration, Download URLs, Deletion & Quota checks.
import { randomUUID } from "crypto";
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { documents, tenantEntitlements, usageMetrics, users } from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import type { AuthContext } from "../../middlewares/guards";
import type {
  DocumentsQuery,
  RegisterDocumentInput,
  UploadUrlInput,
} from "./documents.model";

export async function listDocuments(tenantId: string, query: DocumentsQuery) {
  const conditions = [eq(documents.tenantId, tenantId), isNull(documents.deletedAt)];

  if (query.entityType) conditions.push(eq(documents.entityType, query.entityType));
  if (query.entityId) conditions.push(eq(documents.entityId, query.entityId));
  if (query.category) conditions.push(eq(documents.category, query.category));
  if (query.search) conditions.push(ilike(documents.fileName, `%${query.search}%`));

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(documents).where(and(...conditions)),
    db
      .select({
        doc: documents,
        uploaderName: users.fullName,
      })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.uploadedBy))
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    documents: rows.map((r) => ({
      ...r.doc,
      uploaderName: r.uploaderName ?? null,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createUploadUrl(tenantId: string, input: UploadUrlInput) {
  // Check storage quota
  const [[metrics], [entitlement]] = await Promise.all([
    db.select().from(usageMetrics).where(eq(usageMetrics.tenantId, tenantId)).limit(1),
    db
      .select()
      .from(tenantEntitlements)
      .where(and(eq(tenantEntitlements.tenantId, tenantId), eq(tenantEntitlements.moduleCode, "DOCUMENTS")))
      .limit(1),
  ]);

  const incomingMb = Math.ceil(input.fileSize / (1024 * 1024));
  const usedMb = metrics?.storageUsedMb ?? 0;
  const maxMb = entitlement?.quotas?.max_storage_mb ?? 1024;

  if (usedMb + incomingMb > maxMb) {
    throw Errors.forbidden(
      `Storage quota exceeded (${usedMb}/${maxMb} MB used). Upgrade plan to upload more files.`,
    );
  }

  const safeName = input.fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  const objectKey = `tenants/${tenantId}/${input.category.toLowerCase()}/${randomUUID()}-${safeName}`;
  const expiresInSeconds = 900; // 15 min

  return {
    uploadUrl: `https://storage.bizflow360.com/upload/${objectKey}?token=${randomUUID()}`,
    objectKey,
    expiresInSeconds,
    method: "PUT",
  };
}

export async function registerDocument(
  auth: AuthContext,
  input: RegisterDocumentInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;

  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(documents)
      .values({
        tenantId,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        category: input.category,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        objectKey: input.objectKey,
        uploadedBy: auth.userId,
      })
      .returning();

    const sizeMb = Math.max(1, Math.round(input.fileSize / (1024 * 1024)));
    await tx
      .update(usageMetrics)
      .set({
        storageUsedMb: sql`${usageMetrics.storageUsedMb} + ${sizeMb}`,
        updatedAt: new Date(),
      })
      .where(eq(usageMetrics.tenantId, tenantId));

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "DOCUMENTS.FILE.CREATE",
      entityType: "document",
      entityId: rows[0].id,
      afterData: { fileName: input.fileName, category: input.category, fileSize: input.fileSize },
      requestId,
    });

    return rows;
  });

  return { document: created };
}

export async function getDocumentDetail(tenantId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId), isNull(documents.deletedAt)))
    .limit(1);

  if (!doc) throw Errors.notFound("Document not found.");
  return { document: doc };
}

export async function getDocumentDownloadUrl(tenantId: string, documentId: string) {
  const { document } = await getDocumentDetail(tenantId, documentId);
  return {
    documentId: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    downloadUrl: `https://storage.bizflow360.com/download/${document.objectKey}?token=${randomUUID()}`,
    expiresInSeconds: 900,
  };
}

export async function deleteDocument(
  auth: AuthContext,
  documentId: string,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const { document } = await getDocumentDetail(tenantId, documentId);

  await db.transaction(async (tx) => {
    await tx
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "DOCUMENTS.FILE.DELETE",
      entityType: "document",
      entityId: documentId,
      beforeData: { fileName: document.fileName, objectKey: document.objectKey },
      requestId,
    });
  });

  return { success: true, message: "Document deleted successfully." };
}
