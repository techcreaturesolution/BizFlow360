// Public payment gateway webhook route: /api/v1/billing/webhooks/:provider
import { Router } from "express";
import { billingWebhookHandler } from "./billing.controller";

const router = Router();

router.post("/webhooks/:provider", billingWebhookHandler);

export default router;
