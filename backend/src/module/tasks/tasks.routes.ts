// Tasks Routes: /api/v1/tasks/*
// 3-Layer Security: JwtAuthGuard -> EntitlementGuard("TASKS") -> PermissionsGuard
import { Router } from "express";
import {
  entitlementGuard,
  jwtAuthGuard,
  permissionsGuard,
} from "../../middlewares/guards";
import {
  addTaskCommentHandler,
  assignTaskHandler,
  createTaskHandler,
  getTaskDetailHandler,
  listMyTasksHandler,
  listTasksHandler,
  updateTaskHandler,
} from "./tasks.controller";

const router = Router();

// IMPORTANT: /my MUST be registered before /:id
router.get(
  "/my",
  jwtAuthGuard,
  entitlementGuard("TASKS"),
  permissionsGuard("TASKS.TASKS.VIEW", "TASKS.TASKS.VIEW_ALL"),
  listMyTasksHandler,
);

router.get(
  "/",
  jwtAuthGuard,
  entitlementGuard("TASKS"),
  permissionsGuard("TASKS.TASKS.VIEW", "TASKS.TASKS.VIEW_ALL"),
  listTasksHandler,
);

router.post(
  "/",
  jwtAuthGuard,
  entitlementGuard("TASKS"),
  permissionsGuard("TASKS.TASKS.MANAGE"),
  createTaskHandler,
);

router.get(
  "/:id",
  jwtAuthGuard,
  entitlementGuard("TASKS"),
  permissionsGuard("TASKS.TASKS.VIEW", "TASKS.TASKS.VIEW_ALL"),
  getTaskDetailHandler,
);

router.patch(
  "/:id",
  jwtAuthGuard,
  entitlementGuard("TASKS"),
  permissionsGuard("TASKS.TASKS.MANAGE"),
  updateTaskHandler,
);

router.post(
  "/:id/assign",
  jwtAuthGuard,
  entitlementGuard("TASKS"),
  permissionsGuard("TASKS.TASKS.MANAGE"),
  assignTaskHandler,
);

router.post(
  "/:id/comments",
  jwtAuthGuard,
  entitlementGuard("TASKS"),
  permissionsGuard("TASKS.TASKS.VIEW", "TASKS.TASKS.MANAGE"),
  addTaskCommentHandler,
);

export default router;
