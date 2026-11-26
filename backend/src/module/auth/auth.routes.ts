// Auth routes: /api/v1/auth/*
import { Router } from "express";
import { authenticate } from "../../middlewares/authantication";
import { authLimiter } from "../../middlewares/rateLimiter";
import { loginHandler, meHandler, registerHandler } from "./auth.controller";

const router = Router();

router.post("/register", authLimiter, registerHandler);
router.post("/login", authLimiter, loginHandler);
router.get("/me", authenticate, meHandler);

export default router;
