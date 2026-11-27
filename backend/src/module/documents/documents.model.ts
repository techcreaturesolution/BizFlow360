// Documents Module validation schemas.
import { z } from "zod";

export const documentsQuerySchema = z.object({
  entityType: z.string().trim().optional(),
  entityId: z.string().uuid().optional(),
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  fileSize: z.coerce.number().int().positive("File size 0 se bada hona chahiye"),
  category: z.string().trim().max(60).default("GENERAL"),
});

export const registerDocumentSchema = z.object({
  entityType: z.string().trim().max(60).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  category: z.string().trim().max(60).default("GENERAL"),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  fileSize: z.coerce.number().int().positive(),
  objectKey: z.string().trim().min(3),
});

export type DocumentsQuery = z.infer<typeof documentsQuerySchema>;
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;
export type RegisterDocumentInput = z.infer<typeof registerDocumentSchema>;
