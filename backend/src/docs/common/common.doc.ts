// Shared OpenAPI components (Bearer JWT auth aur common error schemas).
export const commonDoc = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    },
  },
  schemas: {
    FieldError: {
      type: "object",
      properties: {
        field: { type: "string", example: "email" },
        message: { type: "string", example: "Valid email address dalein" },
      },
    },
    ErrorResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        code: { type: "string", example: "UNAUTHORIZED" },
        message: { type: "string", example: "Invalid email or password" },
        errors: {
          type: "array",
          items: { $ref: "#/components/schemas/FieldError" },
        },
      },
    },
  },
} as const;
