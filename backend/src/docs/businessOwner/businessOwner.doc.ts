// Business Owner Swagger documentation: Team, Invitations, User Status, Roles & RBAC Permissions.
export const businessOwnerDoc = {
  tags: [
    {
      name: "[Business Owner] Team & RBAC",
      description: "Company staff management, team invitations, user status, and custom role-based access control (RBAC)",
    },
  ],
  paths: {
    "/api/v1/users": {
      get: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "List company team members",
        description:
          "Returns all staff and team members belonging to the verified tenant with filtering by status, branch, department, search, and pagination. (Requires 3-layer security: JwtAuthGuard -> EntitlementGuard -> PermissionsGuard)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "INACTIVE", "INVITED", "SUSPENDED"] } },
          { name: "branch", in: "query", schema: { type: "string" } },
          { name: "department", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" }, description: "Search by name, email, or phone" },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": {
            description: "List of team members",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TeamMembersResponse" },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - Missing permission or module not entitled" },
        },
      },
    },
    "/api/v1/users/invitations": {
      get: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "List company team invitations",
        description: "Lists pending, accepted, expired, and revoked invitations for the company.",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Invitations list" } },
      },
      post: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Invite a new team member",
        description:
          "Sends an invitation with a unique token. Enforces seat quota (active + pending vs max_seats), blocks role escalation, and records an audit log.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" },
            description: "Optional key to prevent duplicate invitation submissions",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InviteMemberInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Invitation generated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InviteMemberResponse" },
              },
            },
          },
          "400": { description: "Validation error" },
          "403": { description: "Seat quota limit reached or role escalation blocked" },
          "409": { description: "User is already an active member" },
        },
      },
    },
    "/api/v1/users/invitations/{id}": {
      delete: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Revoke a pending team invitation",
        description: "Marks a pending invitation as REVOKED so the invite link can no longer be used, and records an audit log.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Invitation revoked" },
          "404": { description: "Invitation not found" },
          "409": { description: "Invitation is not pending" },
        },
      },
    },
    "/api/v1/users/{id}/status": {
      patch: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Activate or deactivate a team member",
        description:
          "Updates user status to ACTIVE or INACTIVE. Owner accounts cannot be deactivated. Writes an audit log.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Target user ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "User status updated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        message: { type: "string", example: "User status successfully updated to INACTIVE." },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Cannot deactivate own account" },
          "403": { description: "Forbidden - Cannot deactivate Owner account" },
          "404": { description: "User not found in this company" },
        },
      },
    },
    "/api/v1/roles": {
      get: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "List company roles and available system permissions",
        description: "Returns predefined system roles (OWNER, ADMIN, MEMBER) plus any custom roles created for this tenant.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of roles and permission catalog",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RolesListResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Create a custom role",
        description: "Creates a new custom role for this tenant. Permissions can be assigned in a follow-up call.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "SALES_MANAGER" },
                  description: { type: "string", example: "Manages quotation approvals and leads" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Role created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        role: {
                          type: "object",
                          properties: {
                            id: { type: "string", format: "uuid" },
                            name: { type: "string" },
                            description: { type: "string", nullable: true },
                            isSystem: { type: "boolean", example: false },
                          },
                        },
                        message: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "409": { description: "Role with this name already exists" },
        },
      },
    },
    "/api/v1/roles/{id}/permissions": {
      put: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Assign permissions to a custom role",
        description:
          "Replaces assigned permissions for the custom role with the provided permission codes or IDs (e.g. 'MODULE.RESOURCE.ACTION'). System roles cannot be modified.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Custom role ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["permissionIds"],
                properties: {
                  permissionIds: {
                    type: "array",
                    items: { type: "string" },
                    example: ["CRM.LEADS.VIEW", "CRM.LEADS.MANAGE", "SALES.QUOTATIONS.VIEW"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Role permissions updated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        message: { type: "string" },
                        roleId: { type: "string", format: "uuid" },
                        assignedPermissions: { type: "array", items: { type: "string" } },
                      },
                    },
                  },
                },
              },
            },
          },
          "403": { description: "Forbidden - Cannot modify system predefined roles" },
          "404": { description: "Role not found" },
        },
      },
    },
    "/api/v1/permissions": {
      get: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Get all available RBAC permissions catalog",
        description:
          "Returns all MODULE.RESOURCE.ACTION permissions along with a groupedByModule structure for rendering the RBAC matrix checkboxes UI.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Flat list and module-grouped permissions matrix" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/v1/users/{id}/roles": {
      put: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Assign or update roles for a joined team member",
        description:
          "Reassigns one or more roles (via roleIds array) to an existing team member and writes an audit log. Owner role cannot be stripped.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Target team member user ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["roleIds"],
                properties: {
                  roleIds: {
                    type: "array",
                    items: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "User roles updated successfully" },
          "403": { description: "Forbidden - Cannot modify Owner role" },
          "404": { description: "User membership not found" },
        },
      },
    },
    "/api/v1/roles/{id}": {
      patch: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Rename or edit a custom role",
        description: "Updates a custom role's name and/or description. System predefined roles cannot be edited.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Custom role ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "SENIOR_SALES_LEAD" },
                  description: { type: "string", example: "Updated description" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Custom role updated" },
          "403": { description: "Cannot edit system roles" },
          "404": { description: "Role not found" },
          "409": { description: "Role name already exists" },
        },
      },
      delete: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Delete an unused custom role",
        description:
          "Deletes a custom role if no active team members or pending invitations are assigned to it. System roles cannot be deleted.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Custom role ID",
          },
        ],
        responses: {
          "200": { description: "Custom role deleted" },
          "403": { description: "Cannot delete system roles" },
          "404": { description: "Role not found" },
          "409": { description: "Role is currently in use by team members or pending invitations" },
        },
      },
    },
  },
  schemas: {
    InviteMemberInput: {
      type: "object",
      required: ["email", "fullName"],
      properties: {
        email: { type: "string", format: "email", example: "amit@company.com" },
        fullName: { type: "string", example: "Amit Verma" },
        roleId: { type: "string", format: "uuid", nullable: true },
        branchId: { type: "string", example: "MUMBAI_HQ", nullable: true },
        departmentId: { type: "string", example: "SALES", nullable: true },
      },
    },
    InviteMemberResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            invitation: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                email: { type: "string" },
                fullName: { type: "string" },
                roleName: { type: "string" },
                status: { type: "string", example: "PENDING" },
                expiresAt: { type: "string", format: "date-time" },
                inviteLink: { type: "string" },
              },
            },
            message: { type: "string" },
          },
        },
      },
    },
    TeamMembersResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  membershipId: { type: "string", format: "uuid" },
                  userId: { type: "string", format: "uuid" },
                  fullName: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string", nullable: true },
                  roles: { type: "array", items: { type: "string" } },
                  roleName: { type: "string" },
                  status: { type: "string" },
                  isActive: { type: "boolean" },
                  branchId: { type: "string", nullable: true },
                  departmentId: { type: "string", nullable: true },
                  joinedAt: { type: "string", format: "date-time", nullable: true },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer" },
                limit: { type: "integer" },
                total: { type: "integer" },
                totalPages: { type: "integer" },
              },
            },
          },
        },
      },
    },
    RolesListResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            roles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  description: { type: "string", nullable: true },
                  isSystem: { type: "boolean" },
                  permissions: { type: "array", items: { type: "string" } },
                },
              },
            },
            availablePermissions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  code: { type: "string" },
                  moduleCode: { type: "string" },
                  description: { type: "string", nullable: true },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
