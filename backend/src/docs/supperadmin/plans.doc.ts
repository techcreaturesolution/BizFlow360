// Super Admin Plans (Plan Editor) ke Swagger routes aur schemas.
export const plansDoc = {
  tags: [
    {
      name: "[Super Admin] Platform Plans",
      description: "Subscription plans, pricing, quotas, modules aur versioning manage karne ke liye APIs",
    },
  ],
  paths: {
    "/api/v1/platform/plans": {
      get: {
        tags: ["[Super Admin] Platform Plans"],
        summary: "List subscription plans",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string", maxLength: 120 } },
          {
            name: "billing_interval",
            in: "query",
            schema: { type: "string", enum: ["MONTHLY", "ANNUAL"] },
          },
          {
            name: "active",
            in: "query",
            schema: { type: "string", enum: ["true", "false"] },
          },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          "200": {
            description: "Paginated subscription plans list",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PlanListSuccessResponse" } },
            },
          },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "403": {
            description: "Forbidden (SUPER_ADMIN required)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
      post: {
        tags: ["[Super Admin] Platform Plans"],
        summary: "Create a new subscription plan",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpsertPlanInput" } },
          },
        },
        responses: {
          "201": {
            description: "Plan created",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PlanDetailSuccessResponse" } },
            },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "409": {
            description: "Plan code already exists",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/api/v1/platform/plans/{id}": {
      get: {
        tags: ["[Super Admin] Platform Plans"],
        summary: "Get subscription plan detail",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Plan detail",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PlanDetailSuccessResponse" } },
            },
          },
          "404": {
            description: "Plan not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
      put: {
        tags: ["[Super Admin] Platform Plans"],
        summary: "Update plan (increments plan version)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpsertPlanInput" } },
          },
        },
        responses: {
          "200": {
            description: "Plan updated with incremented version",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PlanDetailSuccessResponse" } },
            },
          },
          "404": {
            description: "Plan not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "409": {
            description: "Plan code already exists",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/api/v1/platform/plans/{id}/status": {
      patch: {
        tags: ["[Super Admin] Platform Plans"],
        summary: "Toggle plan active/inactive status",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdatePlanStatusInput" } },
          },
        },
        responses: {
          "200": {
            description: "Plan status updated",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PlanDetailSuccessResponse" } },
            },
          },
          "404": {
            description: "Plan not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
  },
  schemas: {
    PlanQuotas: {
      type: "object",
      required: ["max_seats", "max_storage_mb", "api_rate_limit"],
      properties: {
        max_seats: { type: "integer", example: 10 },
        max_storage_mb: { type: "integer", example: 2048 },
        api_rate_limit: { type: "integer", example: 120 },
      },
    },
    PlanFeatureItem: {
      type: "object",
      required: ["module_code", "enabled"],
      properties: {
        module_code: {
          type: "string",
          enum: ["CRM", "SALES", "FINANCE", "TASKS", "DOCUMENTS", "HR", "INVENTORY"],
          example: "CRM",
        },
        enabled: { type: "boolean", example: true },
        limit: { type: "integer", nullable: true, example: null },
      },
    },
    UpsertPlanInput: {
      type: "object",
      required: ["code", "name", "billing_interval", "price", "quotas", "modules"],
      properties: {
        code: { type: "string", example: "STARTER_MONTHLY" },
        name: { type: "string", example: "Starter" },
        billing_interval: { type: "string", enum: ["MONTHLY", "ANNUAL"], example: "MONTHLY" },
        price: { type: "number", example: 999 },
        currency: { type: "string", default: "INR", example: "INR" },
        trial_days: { type: "integer", default: 0, example: 14 },
        active: { type: "boolean", default: true, example: true },
        quotas: { $ref: "#/components/schemas/PlanQuotas" },
        modules: {
          type: "array",
          items: { $ref: "#/components/schemas/PlanFeatureItem" },
        },
      },
    },
    UpdatePlanStatusInput: {
      type: "object",
      required: ["active"],
      properties: {
        active: { type: "boolean", example: false },
      },
    },
    PlanItem: {
      allOf: [
        { $ref: "#/components/schemas/UpsertPlanInput" },
        {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            version: { type: "integer", example: 1 },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
      ],
    },
    PlanListSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/PlanItem" },
        },
        meta: { $ref: "#/components/schemas/PageMeta" },
      },
    },
    PlanDetailSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: "#/components/schemas/PlanItem" },
      },
    },
  },
} as const;
