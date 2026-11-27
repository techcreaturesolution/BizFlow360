// Documents Routes: /api/v1/documents/*
// 3-Layer Security: JwtAuthGuard -> EntitlementGuard("DOCUMENTS") -> PermissionsGuard
import { Router } from "express";
import {
  entitlementGuard,
  jwtAuthGuard,
  permissionsGuard,
} from "../../middlewares/guards";
import {
  createUploadUrlHandler,
  deleteDocumentHandler,
  getDocumentDetailHandler,
  getDocumentDownloadUrlHandler,
  listDocumentsHandler,
  registerDocumentHandler,
} from "./documents.controller";

const router = Router();

router.get(
  "/",
  jwtAuthGuard,
  entitlementGuard("DOCUMENTS"),
  permissionsGuard("DOCUMENTS.FILES.VIEW"),
  listDocumentsHandler,
);

router.post(
  "/upload-url",
  jwtAuthGuard,
  entitlementGuard("DOCUMENTS"),
  permissionsGuard("DOCUMENTS.FILES.MANAGE"),
  createUploadUrlHandler,
);

router.post(
  "/",
  jwtAuthGuard,
  entitlementGuard("DOCUMENTS"),
  permissionsGuard("DOCUMENTS.FILES.MANAGE"),
  registerDocumentHandler,
);

router.get(
  "/:id",
  jwtAuthGuard,
  entitlementGuard("DOCUMENTS"),
  permissionsGuard("DOCUMENTS.FILES.VIEW"),
  getDocumentDetailHandler,
);

router.get(
  "/:id/download-url",
  jwtAuthGuard,
  entitlementGuard("DOCUMENTS"),
  permissionsGuard("DOCUMENTS.FILES.VIEW"),
  getDocumentDownloadUrlHandler,
);

router.delete(
  "/:id",
  jwtAuthGuard,
  entitlementGuard("DOCUMENTS"),
  permissionsGuard("DOCUMENTS.FILES.MANAGE"),
  deleteDocumentHandler,
);

export default router;
