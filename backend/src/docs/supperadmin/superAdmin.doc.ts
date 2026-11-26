// Super Admin module ke Swagger routes (Tenants Lifecycle + Module Entitlements).
export const superAdminDoc = {
  tags: [
    {
      name: "[Super Admin] Platform Dashboard",
      description: "Platform overview metrics (live aggregate from tenants, subscriptions, invoices, payments)",
    },
    {
      name: "[Super Admin] Platform Tenants",
      description: "Super Admin (SUPER_ADMIN) ke liye Tenant Lifecycle aur Module Entitlements APIs",
    },
  ],
  paths: {
    "/api/v1/platform/dashboard": {
      get: {
        tags: ["[Super Admin] Platform Dashboard"],
        summary: "Get Platform Dashboard Overview",
        description:
          "Returns live aggregate KPIs: total_tenants, tenants_by_status, active_subscriptions, mrr/arr, plan_mix, failed_payments_count, churn_rate, and recent_tenants.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "from",
            in: "query",
            required: false,
            schema: { type: "string", format: "date", example: "2026-11-01" },
            description: "Start date (YYYY-MM-DD), defaults to 30 days ago",
          },
          {
            name: "to",
            in: "query",
            required: false,
            schema: { type: "string", format: "date", example: "2026-11-26" },
            description: "End date (YYYY-MM-DD), defaults to today",
          },
        ],
        responses: {
          "200": {
            description: "Platform dashboard overview metrics",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DashboardOverviewSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Invalid date range",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
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
    },
    "/api/v1/platform/tenants": {
      get: {
        tags: ["[Super Admin] Platform Tenants"],
        summary: "List registered tenants",
        description: "Filters: search, status, plan_id, page, limit. Sirf SUPER_ADMIN access kar sakta hai.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string", maxLength: 120 } },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED", "ARCHIVED"],
            },
          },
          { name: "plan_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          "200": {
            description: "Paginated tenant list",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/TenantListSuccessResponse" } },
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
        tags: ["[Super Admin] Platform Tenants"],
        summary: "Create a new tenant and owner (Super Admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateTenantInput" } },
          },
        },
        responses: {
          "201": {
            description: "Tenant created",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/TenantDetailSuccessResponse" } },
            },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "409": {
            description: "Slug or email already exists",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/api/v1/platform/tenants/{id}": {
      get: {
        tags: ["[Super Admin] Platform Tenants"],
        summary: "Get tenant detail + current plan + usage + entitlements",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Tenant detail",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/TenantDetailSuccessResponse" } },
            },
          },
          "404": {
            description: "Tenant not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
      patch: {
        tags: ["[Super Admin] Platform Tenants"],
        summary: "Update tenant name, timezone, or default_currency",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdateTenantInput" } },
          },
        },
        responses: {
          "200": {
            description: "Tenant updated",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/TenantDetailSuccessResponse" } },
            },
          },
          "404": {
            description: "Tenant not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/api/v1/platform/tenants/{id}/status": {
      post: {
        tags: ["[Super Admin] Platform Tenants"],
        summary: "Change tenant lifecycle status (activate, suspend, restore, archive)",
        description: "Mandatory reason audit log mein save hota hai. Suspended/Cancelled/Archived par active sessions revoke ho jaati hain.",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdateTenantStatusInput" } },
          },
        },
        responses: {
          "200": {
            description: "Status updated",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/TenantDetailSuccessResponse" } },
            },
          },
          "400": {
            description: "Validation error (reason required)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "404": {
            description: "Tenant not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/api/v1/platform/tenants/{id}/entitlements": {
      get: {
        tags: ["[Super Admin] Platform Tenants"],
        summary: "Get tenant module entitlements and current usage",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Entitlements and current usage",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/EntitlementsSuccessResponse" } },
            },
          },
        },
      },
      put: {
        tags: ["[Super Admin] Platform Tenants"],
        summary: "Toggle modules and update quotas (increments entitlement_version)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdateEntitlementsInput" } },
          },
        },
        responses: {
          "200": {
            description: "Updated entitlements and current usage",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/EntitlementsSuccessResponse" } },
            },
          },
        },
      },
    },
  },
  schemas: {
    TenantOwnerInfo: {
      type: "object",
      nullable: true,
      properties: {
        id: { type: "string", format: "uuid" },
        full_name: { type: "string", example: "Rahul Sharma" },
        email: { type: "string", format: "email", example: "rahul@apexsolutions.in" },
        phone: { type: "string", nullable: true, example: "+919876543210" },
      },
    },
    TenantUsageInfo: {
      type: "object",
      properties: {
        seats_used: { type: "integer", example: 1 },
        storage_used_mb: { type: "integer", example: 0 },
        api_calls_used: { type: "integer", example: 0 },
      },
    },
    ModuleQuotas: {
      type: "object",
      required: ["max_seats", "max_storage_mb", "max_api_calls"],
      properties: {
        max_seats: { type: "integer", example: 25 },
        max_storage_mb: { type: "integer", example: 5120 },
        max_api_calls: { type: "integer", example: 50000 },
      },
    },
    TenantEntitlementItem: {
      type: "object",
      required: ["module_code", "is_enabled", "quotas"],
      properties: {
        module_code: {
          type: "string",
          enum: ["CRM", "SALES", "FINANCE", "TASKS", "DOCUMENTS", "HR", "INVENTORY"],
          example: "CRM",
        },
        is_enabled: { type: "boolean", example: true },
        quotas: { $ref: "#/components/schemas/ModuleQuotas" },
        entitlement_version: { type: "integer", example: 1 },
      },
    },
    TenantListItem: {
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
        default_currency: { type: "string", example: "INR" },
        plan_id: { type: "string", format: "uuid", nullable: true },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
        owner: { $ref: "#/components/schemas/TenantOwnerInfo" },
      },
    },
    TenantDetail: {
      allOf: [
        { $ref: "#/components/schemas/TenantListItem" },
        {
          type: "object",
          properties: {
            current_plan: {
              type: "object",
              properties: { plan_id: { type: "string", format: "uuid", nullable: true } },
            },
            current_usage: { $ref: "#/components/schemas/TenantUsageInfo" },
            entitlements: {
              type: "array",
              items: { $ref: "#/components/schemas/TenantEntitlementItem" },
            },
          },
        },
      ],
    },
    CreateTenantInput: {
      type: "object",
      required: ["name", "slug", "owner"],
      properties: {
        name: { type: "string", example: "Nova Tech Pvt Ltd" },
        slug: { type: "string", example: "nova-tech" },
        status: {
          type: "string",
          enum: ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED", "ARCHIVED"],
          default: "TRIAL",
        },
        timezone: { type: "string", default: "Asia/Kolkata", example: "Asia/Kolkata" },
        default_currency: { type: "string", default: "INR", example: "INR" },
        plan_id: { type: "string", format: "uuid", nullable: true },
        owner: {
          type: "object",
          required: ["full_name", "email"],
          properties: {
            full_name: { type: "string", example: "Amit Patel" },
            email: { type: "string", format: "email", example: "amit@novatech.in" },
            phone: { type: "string", example: "+919876501234" },
            password: { type: "string", example: "Nova@2026" },
          },
        },
      },
    },
    UpdateTenantInput: {
      type: "object",
      properties: {
        name: { type: "string", example: "Nova Tech Global" },
        timezone: { type: "string", example: "UTC" },
        default_currency: { type: "string", example: "USD" },
      },
    },
    UpdateTenantStatusInput: {
      type: "object",
      required: ["status", "reason"],
      properties: {
        status: {
          type: "string",
          enum: ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED", "ARCHIVED"],
          example: "SUSPENDED",
        },
        reason: { type: "string", example: "Payment overdue by 15 days" },
      },
    },
    UpdateEntitlementsInput: {
      type: "object",
      required: ["modules"],
      properties: {
        modules: {
          type: "array",
          items: {
            type: "object",
            required: ["module_code", "is_enabled", "quotas"],
            properties: {
              module_code: {
                type: "string",
                enum: ["CRM", "SALES", "FINANCE", "TASKS", "DOCUMENTS", "HR", "INVENTORY"],
                example: "HR",
              },
              is_enabled: { type: "boolean", example: false },
              quotas: { $ref: "#/components/schemas/ModuleQuotas" },
            },
          },
        },
      },
    },
    PageMeta: {
      type: "object",
      properties: {
        page: { type: "integer", example: 1 },
        limit: { type: "integer", example: 20 },
        total: { type: "integer", example: 1 },
        totalPages: { type: "integer", example: 1 },
      },
    },
    TenantListSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/TenantListItem" },
        },
        meta: { $ref: "#/components/schemas/PageMeta" },
      },
    },
    TenantDetailSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: "#/components/schemas/TenantDetail" },
      },
    },
    EntitlementsSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            entitlements: {
              type: "array",
              items: { $ref: "#/components/schemas/TenantEntitlementItem" },
            },
            current_usage: { $ref: "#/components/schemas/TenantUsageInfo" },
          },
        },
      },
    },
    DashboardOverview: {
      type: "object",
      properties: {
        period: {
          type: "object",
          properties: {
            from: { type: "string", format: "date", example: "2026-10-27" },
            to: { type: "string", format: "date", example: "2026-11-26" },
          },
        },
        total_tenants: { type: "integer", example: 1 },
        tenants_by_status: {
          type: "object",
          properties: {
            TRIAL: { type: "integer", example: 1 },
            ACTIVE: { type: "integer", example: 0 },
            PAST_DUE: { type: "integer", example: 0 },
            GRACE: { type: "integer", example: 0 },
            SUSPENDED: { type: "integer", example: 0 },
            CANCELLED: { type: "integer", example: 0 },
            ARCHIVED: { type: "integer", example: 0 },
          },
        },
        active_subscriptions: { type: "integer", example: 0 },
        mrr: { type: "number", example: 0 },
        arr: { type: "number", example: 0 },
        revenue_by_currency: {
          type: "array",
          items: {
            type: "object",
            properties: {
              currency: { type: "string", example: "INR" },
              mrr: { type: "number", example: 0 },
              arr: { type: "number", example: 0 },
            },
          },
        },
        plan_mix: {
          type: "array",
          items: {
            type: "object",
            properties: {
              plan_id: { type: "string", format: "uuid", nullable: true },
              plan_name: { type: "string", example: "Starter" },
              tenant_count: { type: "integer", example: 0 },
            },
          },
        },
        failed_payments_count: { type: "integer", example: 0 },
        churn_rate: { type: "number", example: 0 },
        recent_tenants: {
          type: "array",
          items: { $ref: "#/components/schemas/TenantListItem" },
        },
      },
    },
    DashboardOverviewSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: "#/components/schemas/DashboardOverview" },
      },
    },
  },
} as const;
