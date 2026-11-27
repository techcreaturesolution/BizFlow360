// Swagger documentation: Core CRM Module (Leads, Activities, Followups, Pipeline, Customers).
export const coreCrmDoc = {
  tags: [
    {
      name: "[Core] CRM (Leads & Customers)",
      description:
        "3-tier scoped: Company-wide for Owner/Admin, sales team/department scoped for Sales Manager, and own-assigned for Sales Executive (Entitlement: CRM)",
    },
  ],
  paths: {
    "/api/v1/crm/pipeline": {
      get: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Get CRM leads Kanban pipeline with deal cards and aging",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "owner_user_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "period", in: "query", schema: { type: "string", enum: ["TODAY", "7D", "30D", "90D", "YTD", "ALL"], default: "ALL" } },
        ],
        responses: { "200": { description: "Stage-wise lead counts, totals, and Kanban deal cards with agingDays" } },
      },
    },
    "/api/v1/crm/import": {
      post: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Bulk import CRM leads from CSV or row array (P1)",
        description: "Detects duplicate email/phone within tenant, validates team/tenant assignees, and returns import report.",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "Idempotency-Key", in: "header", schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  csvText: { type: "string", example: "name,companyName,email,phone,source,estimatedValue\nRahul Sharma,Sharma Corp,rahul@sharma.in,+919898989898,Website,75000" },
                  rows: { type: "array", items: { type: "object" } },
                  mapping: { type: "object" },
                  defaultOwnerUserId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Bulk import report with imported/duplicate/error counts" } },
      },
    },
    "/api/v1/crm/leads": {
      get: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "List CRM leads (3-tier scoped: Company / Sales Team / Executive)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "stage", in: "query", schema: { type: "string", enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] } },
          { name: "priority", in: "query", schema: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] } },
          { name: "source", in: "query", schema: { type: "string" } },
          { name: "owner_user_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { "200": { description: "Paginated leads list" } },
      },
      post: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Create a new CRM lead",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateLeadInput" } },
          },
        },
        responses: { "201": { description: "Lead created" } },
      },
    },
    "/api/v1/crm/leads/{id}": {
      get: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Get lead details with activities and followups",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Lead detail" }, "404": { description: "Lead not found" } },
      },
      patch: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Update lead details or stage",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateLeadInput" } },
          },
        },
        responses: { "200": { description: "Lead updated" } },
      },
    },
    "/api/v1/crm/leads/{id}/assign": {
      post: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Assign lead to a team member",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ownerUserId"],
                properties: {
                  ownerUserId: { type: "string", format: "uuid" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Lead assigned" } },
      },
    },
    "/api/v1/crm/leads/{id}/activities": {
      post: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Log activity (call, email, meeting, note) on lead",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["summary"],
                properties: {
                  activityType: { type: "string", enum: ["NOTE", "CALL", "EMAIL", "MEETING"], default: "NOTE" },
                  summary: { type: "string", example: "Discussed enterprise pricing" },
                  details: { type: "object" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Activity logged" } },
      },
    },
    "/api/v1/crm/leads/{id}/followups": {
      post: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Schedule a followup on lead",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["scheduledAt"],
                properties: {
                  scheduledAt: { type: "string", format: "date-time" },
                  assignedToUserId: { type: "string", format: "uuid" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Followup scheduled" } },
      },
    },
    "/api/v1/crm/followups/{id}": {
      patch: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Update followup status or schedule",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["PENDING", "COMPLETED", "CANCELLED", "MISSED"] },
                  scheduledAt: { type: "string", format: "date-time" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Followup updated" } },
      },
    },
    "/api/v1/crm/leads/{id}/convert": {
      post: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Convert lead into a Customer (Idempotent)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  customerCode: { type: "string", example: "CUST-1001" },
                  customerType: { type: "string", enum: ["B2B", "B2C", "ENTERPRISE", "PARTNER"], default: "B2B" },
                  taxId: { type: "string", example: "24AABCA1234D1Z5" },
                  paymentTermsDays: { type: "integer", default: 30 },
                  creditLimit: { type: "number", default: 0 },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Lead converted to customer" } },
      },
    },
    "/api/v1/crm/customers": {
      get: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "List customers",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "customerType", in: "query", schema: { type: "string", enum: ["B2B", "B2C", "ENTERPRISE", "PARTNER"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "INACTIVE"] } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { "200": { description: "Paginated customers list" } },
      },
      post: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Create a customer",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateCustomerInput" } },
          },
        },
        responses: { "201": { description: "Customer created" } },
      },
    },
    "/api/v1/crm/customers/{id}": {
      get: {
        tags: ["[Core] CRM (Leads & Customers)"],
        summary: "Get customer details, contacts, billing addresses & sales timeline (quotes, orders, invoices, activities)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Customer profile, contacts, addresses and sales timeline" } },
      },
    },
  },
  schemas: {
    CreateLeadInput: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", example: "Vikram Patel" },
        companyName: { type: "string", example: "Patel Logistics Pvt Ltd" },
        email: { type: "string", format: "email", example: "vikram@patellogistics.com" },
        phone: { type: "string", example: "+919876543210" },
        source: { type: "string", example: "Website" },
        stage: { type: "string", enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"], default: "NEW" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM" },
        estimatedValue: { type: "number", example: 250000 },
        ownerUserId: { type: "string", format: "uuid" },
        nextFollowupAt: { type: "string", format: "date-time" },
        notes: { type: "string" },
      },
    },
    CreateCustomerInput: {
      type: "object",
      required: ["name"],
      properties: {
        customerCode: { type: "string", example: "CUST-1001" },
        name: { type: "string", example: "Patel Logistics Pvt Ltd" },
        customerType: { type: "string", enum: ["B2B", "B2C", "ENTERPRISE", "PARTNER"], default: "B2B" },
        email: { type: "string", format: "email" },
        phone: { type: "string" },
        taxId: { type: "string", example: "24AABCP1234E1Z2" },
        paymentTermsDays: { type: "integer", default: 30 },
        creditLimit: { type: "number", default: 500000 },
      },
    },
  },
} as const;
