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
        security: [{ BearerAuth: [] }],
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
      post: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Invite a new team member",
        description:
          "Sends an invitation with a unique invitation token. Checks company seat quota and records an audit log. Protected by Idempotency-Key header.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" },
            description: "Optional UUID/string to prevent duplicate invitation submissions",
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
          "403": { description: "Seat limit reached or missing permissions" },
          "409": { description: "User is already an active member" },
        },
      },
    },
    "/api/v1/users/{id}/status": {
      patch: {
        tags: ["[Business Owner] Team & RBAC"],
        summary: "Activate or deactivate a team member",
        description:
          "Updates user status to ACTIVE or INACTIVE. Owner accounts cannot be deactivated. Writes an audit log.",
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
