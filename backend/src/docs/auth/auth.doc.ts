// Auth module ke Swagger routes aur request/response schemas.
export const authDoc = {
  tags: [
    {
      name: "[Shared] Auth",
      description: "User registration, login, and profile endpoints",
    },
  ],
  paths: {
    "/api/v1/auth/register": {
      post: {
        tags: ["[Shared] Auth"],
        summary: "Register owner account and company workspace",
        description:
          "Creates a tenant workspace and owner user, hashes password, creates a session, writes an AUTH.REGISTER audit log, and returns JWT tokens.",
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
          "429": {
            description: "Too many auth attempts",
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
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Invalid email or password",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Account is disabled",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description: "Too many login attempts",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["[Shared] Auth"],
        summary: "Get current authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Authenticated user details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MeSuccessResponse" },
              },
            },
          },
          "401": {
            description: "Missing, invalid, or expired Bearer token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "User not found",
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
        fullName: { type: "string", minLength: 2, maxLength: 100, example: "Rahul Sharma" },
        email: { type: "string", format: "email", example: "rahul@apexsolutions.in" },
        phone: {
          type: "string",
          nullable: true,
          example: "+919876543210",
          description: "Optional phone number with country code",
        },
        password: {
          type: "string",
          minLength: 8,
          maxLength: 128,
          example: "Apex@2026",
          description: "Min 8 chars, 1 uppercase, 1 number, 1 symbol",
        },
        confirmPassword: {
          type: "string",
          example: "Apex@2026",
          description: "Optional backend check (must match password if provided)",
        },
        companyName: { type: "string", minLength: 2, maxLength: 120, example: "Apex Solutions" },
        workspaceSlug: {
          type: "string",
          minLength: 2,
          maxLength: 63,
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          example: "apex-solutions",
        },
        timezone: { type: "string", default: "Asia/Kolkata", example: "Asia/Kolkata" },
        defaultCurrency: { type: "string", default: "INR", example: "INR" },
      },
    },
    LoginInput: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email", example: "rahul@apexsolutions.in" },
        password: { type: "string", minLength: 1, maxLength: 128, example: "Apex@2026" },
      },
    },
    TenantInfo: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string", example: "Apex Solutions" },
        slug: { type: "string", example: "apex-solutions" },
        status: {
          type: "string",
          enum: ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED", "ARCHIVED"],
          example: "TRIAL",
        },
        timezone: { type: "string", example: "Asia/Kolkata" },
        defaultCurrency: { type: "string", example: "INR" },
        planId: { type: "string", format: "uuid", nullable: true },
      },
    },
    LoginUser: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        tenantId: { type: "string", format: "uuid", nullable: true },
        fullName: { type: "string", example: "Rahul Sharma" },
        email: { type: "string", format: "email", example: "rahul@apexsolutions.in" },
        phone: { type: "string", nullable: true, example: "+919876543210" },
        roles: {
          type: "array",
          items: { type: "string" },
          example: ["OWNER"],
        },
      },
    },
    AuthData: {
      type: "object",
      properties: {
        accessToken: { type: "string" },
        refreshToken: { type: "string" },
        user: { $ref: "#/components/schemas/LoginUser" },
        tenant: {
          allOf: [{ $ref: "#/components/schemas/TenantInfo" }],
          nullable: true,
          description: "Company workspace info (null for SUPER_ADMIN)",
        },
      },
    },
    AuthSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: "#/components/schemas/AuthData" },
      },
    },
    MeSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: "#/components/schemas/LoginUser" },
      },
    },
  },
} as const;
