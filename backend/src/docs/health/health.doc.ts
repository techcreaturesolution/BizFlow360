// Health module ke Swagger routes aur response schemas.
export const healthDoc = {
  tags: [
    {
      name: "[Shared] Health",
      description: "Server and database health check endpoints",
    },
  ],
  paths: {
    "/": {
      get: {
        tags: ["[Shared] Health"],
        summary: "Root status check",
        responses: {
          "200": {
            description: "API is running",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StatusSuccessResponse" },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        tags: ["[Shared] Health"],
        summary: "Liveness health check",
        responses: {
          "200": {
            description: "Server is alive",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StatusSuccessResponse" },
              },
            },
          },
        },
      },
    },
    "/health/ready": {
      get: {
        tags: ["[Shared] Health"],
        summary: "Readiness check (verifies Supabase PostgreSQL connection)",
        responses: {
          "200": {
            description: "Server and database are ready",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthReadySuccessResponse" },
              },
            },
          },
          "500": {
            description: "Database connection failed",
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
    StatusSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
          },
        },
      },
    },
    HealthReadySuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
            database: { type: "string", example: "up" },
          },
        },
      },
    },
  },
} as const;
