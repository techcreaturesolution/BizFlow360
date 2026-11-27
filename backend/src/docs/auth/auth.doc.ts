// Auth module ke Swagger routes aur request/response schemas.
export const authDoc = {
  tags: [
    {
      name: "[Shared] Auth",
      description: "User registration, login, token rotation, password reset, and profile endpoints",
    },
  ],
  paths: {
    "/api/v1/auth/register": {
      post: {
        tags: ["[Shared] Auth"],
        summary: "Register owner account and company workspace",
        description:
          "Creates a tenant workspace and owner user, seeds default entitlements & roles, writes an AUTH.REGISTER audit log, and returns JWT tokens.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Workspace and user registered successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "Email or workspace slug already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["[Shared] Auth"],
        summary: "Login with email and password",
        description:
          "Validates credentials, creates a refresh token session, writes an AUTH.LOGIN audit log, and returns access & refresh tokens.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSuccessResponse" },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["[Shared] Auth"],
        summary: "Logout current session",
        description: "Revokes the active refresh token session in database.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: {
                  refreshToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Logged out successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        message: { type: "string", example: "Logged out successfully" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["[Shared] Auth"],
        summary: "Rotate refresh token & issue new access token",
        description: "Rotates refresh token for security and provides a fresh 15-minute access token.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: {
                  refreshToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Tokens rotated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSuccessResponse" },
              },
            },
          },
          "401": {
            description: "Invalid, expired, or revoked refresh token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/forgot-password": {
      post: {
        tags: ["[Shared] Auth"],
        summary: "Request password reset token",
        description: "Generates a secure password reset token and writes an AUTH.FORGOT_PASSWORD audit log.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email", example: "owner@company.com" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Reset instructions generated",
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
                        resetToken: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/reset-password": {
      post: {
        tags: ["[Shared] Auth"],
        summary: "Reset password using token",
        description: "Validates reset token, updates password hash, revokes old sessions, and writes audit log.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword"],
                properties: {
                  token: { type: "string" },
                  newPassword: { type: "string", format: "password", example: "NewStrongPass#2026" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Password reset successfully",
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
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid or expired reset token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/invitations/accept": {
      post: {
        tags: ["[Shared] Auth"],
        summary: "Accept a team invitation & join workspace",
        description:
          "Validates invitation token, sets user password, creates active tenant membership with assigned roles/branch/department, updates seat usage, and returns JWT tokens.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "password"],
                properties: {
                  token: { type: "string" },
                  password: { type: "string", format: "password", example: "WelcomePass#2026" },
                  fullName: { type: "string", example: "Amit Verma" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Invitation accepted and user logged in",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSuccessResponse" },
              },
            },
          },
          "400": { description: "Invalid, revoked, or expired token" },
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["[Shared] Auth"],
        summary: "Current authenticated profile with membership & permissions",
        description: "Returns the authenticated user, active tenant membership, and effective RBAC permissions.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Authenticated user profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CurrentUserProfileResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  schemas: {
    RegisterInput: {
      type: "object",
      required: ["fullName", "email", "password", "companyName", "workspaceSlug"],
      properties: {
        fullName: { type: "string", example: "Rajesh Sharma" },
        email: { type: "string", format: "email", example: "rajesh@apexsolutions.com" },
        phone: { type: "string", example: "+919876543210" },
        password: { type: "string", format: "password", example: "SecurePass#2026" },
        confirmPassword: { type: "string", format: "password", example: "SecurePass#2026" },
        companyName: { type: "string", example: "Apex Solutions Pvt Ltd" },
        workspaceSlug: { type: "string", example: "apex-solutions" },
        timezone: { type: "string", example: "Asia/Kolkata" },
        defaultCurrency: { type: "string", example: "INR" },
      },
    },
    LoginInput: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email", example: "superadmin@bizflow360.com" },
        password: { type: "string", format: "password", example: "SuperAdmin@2026" },
      },
    },
    AuthSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
            refreshToken: { type: "string", example: "f7a8b9c0..." },
            user: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                tenantId: { type: "string", format: "uuid", nullable: true },
                fullName: { type: "string" },
                email: { type: "string" },
                phone: { type: "string", nullable: true },
                roles: { type: "array", items: { type: "string" } },
              },
            },
            tenant: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                slug: { type: "string" },
                status: { type: "string" },
                timezone: { type: "string" },
                defaultCurrency: { type: "string" },
                planId: { type: "string", format: "uuid", nullable: true },
              },
            },
          },
        },
      },
    },
    CurrentUserProfileResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                tenantId: { type: "string", format: "uuid", nullable: true },
                fullName: { type: "string" },
                email: { type: "string" },
                phone: { type: "string", nullable: true },
                roles: { type: "array", items: { type: "string" } },
              },
            },
            tenant: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                slug: { type: "string" },
                status: { type: "string" },
                timezone: { type: "string" },
                defaultCurrency: { type: "string" },
                planId: { type: "string", format: "uuid", nullable: true },
              },
            },
            membership: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string", format: "uuid" },
                tenantId: { type: "string", format: "uuid" },
                roleName: { type: "string", example: "OWNER" },
                status: { type: "string", example: "ACTIVE" },
                branchId: { type: "string", nullable: true },
                departmentId: { type: "string", nullable: true },
                joinedAt: { type: "string", format: "date-time", nullable: true },
              },
            },
            effectivePermissions: {
              type: "array",
              items: { type: "string" },
              example: ["*", "AUTH.USERS.VIEW", "CRM.LEADS.MANAGE"],
            },
            enabledModules: {
              type: "array",
              items: { type: "string" },
              example: ["CRM", "SALES", "TASKS", "DOCUMENTS", "REPORTS"],
            },
            managedDepartmentIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
            managedTeamIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
  },
} as const;
