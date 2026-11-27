// Business Owner routes: Team, Invitations, User Status, Roles & RBAC Permissions.
// Enforces 3-layer security check: JwtAuthGuard -> EntitlementGuard -> PermissionsGuard + IdempotencyGuard
import { Router } from "express";
import {
  entitlementGuard,
  idempotencyGuard,
  jwtAuthGuard,
  permissionsGuard,
} from "../../middlewares/guards";
import {
  assignRolePermissionsHandler,
  createRoleHandler,
  getRolesHandler,
  getTeamMembersHandler,
  inviteMemberHandler,
  updateUserStatusHandler,
} from "./businessOwner.controller";

const router = Router();

// 1. Team Members List: GET /users
router.get(
  "/users",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.USERS.VIEW"),
  getTeamMembersHandler,
);

// 2. Invite Member: POST /users/invitations
router.post(
  "/users/invitations",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.USERS.INVITE"),
  idempotencyGuard,
  inviteMemberHandler,
);

// 3. Activate / Deactivate User: PATCH /users/:id/status
router.patch(
  "/users/:id/status",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.USERS.MANAGE"),
  updateUserStatusHandler,
);

// 4. Roles List: GET /roles
router.get(
  "/roles",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.ROLES.MANAGE"),
  getRolesHandler,
);

// 5. Create Custom Role: POST /roles
router.post(
  "/roles",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.ROLES.MANAGE"),
  createRoleHandler,
);

// 6. Assign Role Permissions: PUT /roles/:id/permissions
router.put(
  "/roles/:id/permissions",
  jwtAuthGuard,
  entitlementGuard("AUTH"),
  permissionsGuard("AUTH.ROLES.MANAGE"),
  assignRolePermissionsHandler,
);

export default router;
