// Saare module ke routes yahan jodte hain. Base path: /api/v1 (app.ts mein lagta hai)
import { Router } from "express";
import authRoutes from "./module/auth/auth.routes";
import billingWebhookRoutes from "./module/supperadmin/billingWebhook.routes";
import superAdminRoutes from "./module/supperadmin/superAdmin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/billing", billingWebhookRoutes);
router.use("/platform", superAdminRoutes);
// router.use("/crm", crmRoutes);        // <- aage ke modules isi tarah jodte jao

export default router;
