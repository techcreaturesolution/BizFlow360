// Saare module ke routes yahan jodte hain. Base path: /api/v1 (app.ts mein lagta hai)
import { Router } from "express";
import authRoutes from "./module/auth/auth.routes";
import businessOwnerRoutes from "./module/businessOwner/businessOwner.routes";
import billingWebhookRoutes from "./module/supperadmin/billingWebhook.routes";
import superAdminRoutes from "./module/supperadmin/superAdmin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/billing", billingWebhookRoutes);
router.use("/platform", superAdminRoutes);

// Business Owner routes: /api/v1/users, /api/v1/roles, etc.
router.use("/business-owner", businessOwnerRoutes);
router.use("/", businessOwnerRoutes);

export default router;
