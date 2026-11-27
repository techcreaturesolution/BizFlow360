// Saare module ke routes yahan jodte hain. Base path: /api/v1 (app.ts mein lagta hai)
import { Router } from "express";
import authRoutes from "./module/auth/auth.routes";
import businessOwnerRoutes from "./module/businessOwner/businessOwner.routes";
import crmRoutes from "./module/crm/crm.routes";
import documentsRoutes from "./module/documents/documents.routes";
import financeRoutes from "./module/finance/finance.routes";
import salesRoutes from "./module/sales/sales.routes";
import billingWebhookRoutes from "./module/supperadmin/billingWebhook.routes";
import superAdminRoutes from "./module/supperadmin/superAdmin.routes";
import tasksRoutes from "./module/tasks/tasks.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/billing", billingWebhookRoutes);
router.use("/platform", superAdminRoutes);

// Shared Core Business Modules (Company-wide scope for Owner, assigned scope for Executives)
router.use("/crm", crmRoutes);
router.use("/sales", salesRoutes);
router.use("/finance", financeRoutes);
router.use("/tasks", tasksRoutes);
router.use("/documents", documentsRoutes);

// Business Owner Workspace routes (/users, /roles, /company, /branches, /dashboard, /billing, /approvals, etc.)
router.use("/business-owner", businessOwnerRoutes);
router.use("/", businessOwnerRoutes);

export default router;
