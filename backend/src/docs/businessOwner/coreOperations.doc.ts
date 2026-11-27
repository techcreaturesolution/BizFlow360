// Swagger documentation: Core Operations (Finance Expenses/Receivables, Tasks, Documents).
export const coreOperationsDoc = {
  tags: [
    {
      name: "[Core] Finance (Expenses & Receivables)",
      description: "Expense claims workflow + AR aging summary (Entitlement: FINANCE)",
    },
    {
      name: "[Core] Tasks",
      description: "Company tasks, My Tasks, assignment, and task comments (Entitlement: TASKS)",
    },
    {
      name: "[Core] Documents",
      description: "Signed upload/download URLs, metadata registration, and storage quota checks (Entitlement: DOCUMENTS)",
    },
  ],
  paths: {
    // Finance
    "/api/v1/finance/expenses": {
      get: {
        tags: ["[Core] Finance (Expenses & Receivables)"],
        summary: "List expenses",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID"] } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { "200": { description: "Paginated expenses" } },
      },
      post: {
        tags: ["[Core] Finance (Expenses & Receivables)"],
        summary: "Create draft expense",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateExpenseInput" } },
          },
        },
        responses: { "201": { description: "Expense created" } },
      },
    },
    "/api/v1/finance/expenses/{id}/submit": {
      post: {
        tags: ["[Core] Finance (Expenses & Receivables)"],
        summary: "Submit expense for approval",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Expense submitted to approval inbox" } },
      },
    },
    "/api/v1/finance/expenses/{id}/approve": {
      post: {
        tags: ["[Core] Finance (Expenses & Receivables)"],
        summary: "Approve expense",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": { schema: { type: "object", properties: { comment: { type: "string" } } } },
          },
        },
        responses: { "200": { description: "Expense approved" } },
      },
    },
    "/api/v1/finance/expenses/{id}/reject": {
      post: {
        tags: ["[Core] Finance (Expenses & Receivables)"],
        summary: "Reject expense",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["reason"],
                properties: { reason: { type: "string", example: "Missing GST invoice receipt" } },
              },
            },
          },
        },
        responses: { "200": { description: "Expense rejected" } },
      },
    },
    "/api/v1/finance/receivables": {
      get: {
        tags: ["[Core] Finance (Expenses & Receivables)"],
        summary: "Get Accounts Receivable summary & aging buckets",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "AR summary and invoice aging" } },
      },
    },

    // Tasks
    "/api/v1/tasks/my": {
      get: {
        tags: ["[Core] Tasks"],
        summary: "List my assigned tasks",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Tasks assigned to current user" } },
      },
    },
    "/api/v1/tasks": {
      get: {
        tags: ["[Core] Tasks"],
        summary: "List tasks (company-wide for Owner, assigned-only for staff)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"] } },
          { name: "priority", in: "query", schema: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] } },
          { name: "assigneeUserId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated tasks" } },
      },
      post: {
        tags: ["[Core] Tasks"],
        summary: "Create a task",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateTaskInput" } },
          },
        },
        responses: { "201": { description: "Task created" } },
      },
    },
    "/api/v1/tasks/{id}": {
      get: {
        tags: ["[Core] Tasks"],
        summary: "Get task detail and comments",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Task detail" } },
      },
      patch: {
        tags: ["[Core] Tasks"],
        summary: "Update task status, priority, or details",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateTaskInput" } },
          },
        },
        responses: { "200": { description: "Task updated" } },
      },
    },
    "/api/v1/tasks/{id}/assign": {
      post: {
        tags: ["[Core] Tasks"],
        summary: "Assign task to a user",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["assigneeUserId"],
                properties: { assigneeUserId: { type: "string", format: "uuid" } },
              },
            },
          },
        },
        responses: { "200": { description: "Task assigned" } },
      },
    },
    "/api/v1/tasks/{id}/comments": {
      post: {
        tags: ["[Core] Tasks"],
        summary: "Add comment on a task",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["comment"],
                properties: { comment: { type: "string", example: "Sent revised deck to client" } },
              },
            },
          },
        },
        responses: { "201": { description: "Comment added" } },
      },
    },

    // Documents
    "/api/v1/documents": {
      get: {
        tags: ["[Core] Documents"],
        summary: "List company documents",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "entityType", in: "query", schema: { type: "string" } },
          { name: "entityId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated documents list" } },
      },
      post: {
        tags: ["[Core] Documents"],
        summary: "Register uploaded document metadata",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RegisterDocumentInput" } },
          },
        },
        responses: { "201": { description: "Document registered" } },
      },
    },
    "/api/v1/documents/upload-url": {
      post: {
        tags: ["[Core] Documents"],
        summary: "Get signed upload URL & object key",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fileName", "mimeType", "fileSize"],
                properties: {
                  fileName: { type: "string", example: "receipt.pdf" },
                  mimeType: { type: "string", example: "application/pdf" },
                  fileSize: { type: "integer", example: 245000 },
                  category: { type: "string", example: "RECEIPT" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Upload URL and objectKey generated" } },
      },
    },
    "/api/v1/documents/{id}": {
      get: {
        tags: ["[Core] Documents"],
        summary: "Get document metadata",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Document metadata" } },
      },
      delete: {
        tags: ["[Core] Documents"],
        summary: "Delete document",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Document deleted" } },
      },
    },
    "/api/v1/documents/{id}/download-url": {
      get: {
        tags: ["[Core] Documents"],
        summary: "Get signed download URL",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Temporary signed download URL" } },
      },
    },
  },
  schemas: {
    CreateExpenseInput: {
      type: "object",
      required: ["category", "description", "amount", "expenseDate"],
      properties: {
        category: { type: "string", example: "TRAVEL" },
        description: { type: "string", example: "Client site visit Mumbai flight" },
        amount: { type: "number", example: 6450 },
        expenseDate: { type: "string", format: "date", example: "2026-11-27" },
        receiptDocumentId: { type: "string", format: "uuid", nullable: true },
      },
    },
    CreateTaskInput: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", example: "Prepare Q4 client proposal" },
        description: { type: "string" },
        status: { type: "string", enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"], default: "TODO" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM" },
        assigneeUserId: { type: "string", format: "uuid", nullable: true },
        dueAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    RegisterDocumentInput: {
      type: "object",
      required: ["fileName", "mimeType", "fileSize", "objectKey"],
      properties: {
        entityType: { type: "string", example: "EXPENSE" },
        entityId: { type: "string", format: "uuid", nullable: true },
        category: { type: "string", example: "RECEIPT" },
        fileName: { type: "string", example: "receipt.pdf" },
        mimeType: { type: "string", example: "application/pdf" },
        fileSize: { type: "integer", example: 245000 },
        objectKey: { type: "string", example: "tenants/xxx/receipt/uuid-receipt.pdf" },
      },
    },
  },
} as const;
