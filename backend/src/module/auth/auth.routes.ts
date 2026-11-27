// Auth routes: /api/v1/auth/*
import { Router } from "express";
import { jwtAuthGuard } from "../../middlewares/guards";
import { authLimiter } from "../../middlewares/rateLimiter";
import {
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  resetPasswordHandler,
} from "./auth.controller";

const router = Router();

router.post("/register", authLimiter, registerHandler);
router.post("/login", authLimiter, loginHandler);
router.post("/logout", logoutHandler);
router.post("/refresh", refreshHandler);
router.post("/forgot-password", authLimiter, forgotPasswordHandler);
router.post("/reset-password", authLimiter, resetPasswordHandler);
router.get("/me", jwtAuthGuard, meHandler);

export default router;
