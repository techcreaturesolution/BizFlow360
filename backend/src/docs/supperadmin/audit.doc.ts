// Super Admin Read-Only Audit Logs Swagger docs.
export const auditDoc = {
  tags: [
    {
      name: "[Super Admin] Audit Logs",
      description: "Immutable read-only audit trail (Super Admin edit ya delete nahi kar sakta)",
    },
  ],
  paths: {
    "/api/v1/platform/audit-logs": {
      get: {
        tags: ["[Super Admin] Audit Logs"],
        summary: "List audit logs (read-only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "tenant_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "actor_user_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "action", in: "query", schema: { type: "string", maxLength: 80, example: "TENANT.STATUS_CHANGE" } },
          { name: "entity_type", in: "query", schema: { type: "string", maxLength: 100, example: "tenant" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          "200": {
            description: "Paginated read-only audit logs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuditLogListSuccessResponse" },
              },
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
    },
    "/api/v1/platform/audit-logs/{id}": {
      get: {
        tags: ["[Super Admin] Audit Logs"],
        summary: "Get audit log detail with Before/After JSON diff",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Audit log detail with diff",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuditLogDetailSuccessResponse" },
              },
            },
          },
          "404": {
            description: "Audit log not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
  },
  schemas: {
    AuditActorInfo: {
      type: "object",
      nullable: true,
      properties: {
        id: { type: "string", format: "uuid" },
        full_name: { type: "string", example: "Super Admin" },
        email: { type: "string", format: "email", example: "superadmin@bizflow360.com" },
        roles: { type: "array", items: { type: "string" }, example: ["SUPER_ADMIN"] },
      },
    },
    AuditDiffField: {
      type: "object",
      properties: {
        field: { type: "string", example: "status" },
        before: {},
        after: {},
      },
    },
    AuditLogItem: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        tenant_id: { type: "string", format: "uuid", nullable: true },
        tenant_name: { type: "string", nullable: true },
        actor_user_id: { type: "string", format: "uuid", nullable: true },
        actor: { $ref: "#/components/schemas/AuditActorInfo" },
        action: { type: "string", example: "TENANT.STATUS_CHANGE" },
        entity_type: { type: "string", example: "tenant" },
        entity_id: { type: "string", format: "uuid", nullable: true },
        before_data: { type: "object", nullable: true },
        after_data: { type: "object", nullable: true },
        reason: { type: "string", nullable: true },
        request_id: { type: "string", nullable: true },
        created_at: { type: "string", format: "date-time" },
      },
    },
    AuditLogDetail: {
      allOf: [
        { $ref: "#/components/schemas/AuditLogItem" },
        {
          type: "object",
          properties: {
            diff: {
              type: "array",
              items: { $ref: "#/components/schemas/AuditDiffField" },
            },
          },
        },
      ],
    },
    AuditLogListSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { type: "array", items: { $ref: "#/components/schemas/AuditLogItem" } },
        meta: { $ref: "#/components/schemas/PageMeta" },
      },
    },
    AuditLogDetailSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: "#/components/schemas/AuditLogDetail" },
      },
    },
  },
} as const;
