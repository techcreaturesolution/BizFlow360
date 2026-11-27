// Business Owner Swagger documentation: Section C - Dashboard & Reports.
export const dashboardReportsDoc = {
  tags: [
    {
      name: "[Business Owner] Dashboard & Reports",
      description: "Overview KPIs, department analytics (Sales, Finance, HR, Projects), async CSV/XLSX/PDF exports, and saved dashboard widgets",
    },
  ],
  paths: {
    "/api/v1/dashboard/summary": {
      get: {
        tags: ["[Business Owner] Dashboard & Reports"],
        summary: "Get Business Overview KPIs",
        description:
          "Returns revenue, sales pipeline, due invoices, expenses, tasks, organization counts, and recent activity filtered by period, branch, department, owner, and status.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["TODAY", "7D", "30D", "90D", "YTD", "CUSTOM"], default: "30D" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Required when period=CUSTOM" },
          { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "Required when period=CUSTOM" },
          { name: "branch_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "department_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "owner_user_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Overview KPI metrics" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/api/v1/analytics/sales": {
      get: {
        tags: ["[Business Owner] Dashboard & Reports"],
        summary: "Sales Module Analytics",
        description:
          "Department-wise sales charts, conversion rates, and pipeline funnel metrics. Requires SALES entitlement.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["TODAY", "7D", "30D", "90D", "YTD", "CUSTOM"], default: "30D" } },
          { name: "branch_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "department_id", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Sales analytics metrics and charts" },
          "403": { description: "Module SALES not enabled or missing permission" },
        },
      },
    },
    "/api/v1/analytics/finance": {
      get: {
        tags: ["[Business Owner] Dashboard & Reports"],
        summary: "Finance Module Analytics (AR/AP)",
        description:
          "Accounts Receivable (AR) / Accounts Payable (AP) aging buckets, net cashflow, and department-wise expenses. Requires FINANCE entitlement.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["TODAY", "7D", "30D", "90D", "YTD", "CUSTOM"], default: "30D" } },
          { name: "branch_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "department_id", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Finance analytics metrics and charts" },
          "403": { description: "Module FINANCE not enabled or missing permission" },
        },
      },
    },
    "/api/v1/analytics/hr": {
      get: {
        tags: ["[Business Owner] Dashboard & Reports"],
        summary: "HR Module Analytics",
        description:
          "Active headcount, department-wise & branch-wise staff distribution, attendance and leave stats. Requires HR entitlement.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["TODAY", "7D", "30D", "90D", "YTD", "CUSTOM"], default: "30D" } },
          { name: "branch_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "department_id", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "HR analytics metrics and charts" },
          "403": { description: "Module HR not enabled or missing permission" },
        },
      },
    },
    "/api/v1/analytics/projects": {
      get: {
        tags: ["[Business Owner] Dashboard & Reports"],
        summary: "Projects & Tasks Module Analytics",
        description:
          "Project delivery metrics, department-wise task completion, and team workload breakdown. Requires TASKS entitlement.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["TODAY", "7D", "30D", "90D", "YTD", "CUSTOM"], default: "30D" } },
          { name: "branch_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "department_id", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Projects analytics metrics and charts" },
          "403": { description: "Module TASKS not enabled or missing permission" },
        },
      },
    },
    "/api/v1/reports/export": {
      get: {
        tags: ["[Business Owner] Dashboard & Reports"],
        summary: "List report export jobs",
        description: "Returns recent async CSV/XLSX/PDF export jobs triggered by this company.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "List of export jobs" },
        },
      },
      post: {
        tags: ["[Business Owner] Dashboard & Reports"],
        summary: "Trigger async report export (P1)",
        description:
          "Queues an asynchronous CSV, XLSX, or PDF report export job. Checks REPORTS.EXPORT.CREATE permission, supports Idempotency-Key header, and writes an audit log.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" },
            description: "Optional key to prevent duplicate export job triggers",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ExportReportInput" },
            },
          },
        },
        responses: {
          "202": { description: "Export job queued successfully" },
          "403": { description: "Missing REPORTS.EXPORT.CREATE permission" },
        },
      },
    },
    "/api/v1/dashboard/widgets": {
      get: {
        tags: ["[Business Owner] Dashboard & Reports"],
        summary: "Get saved dashboard widget layout (P2)",
        description: "Returns the authenticated user's saved widget layout (or default layout if none saved yet).",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "layoutName", in: "query", schema: { type: "string", default: "default" } },
        ],
        responses: {
          "200": { description: "Saved widget configuration" },
        },
      },
      put: {
        tags: ["[Business Owner] Dashboard & Reports"],
        summary: "Save custom dashboard widget layout (P2)",
        description: "Saves or updates the user's personalized dashboard widget positions and visibility. Writes an audit log.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SaveWidgetsInput" },
            },
          },
        },
        responses: {
          "200": { description: "Dashboard widget layout saved" },
        },
      },
    },
  },
  schemas: {
    ExportReportInput: {
      type: "object",
      required: ["reportType", "format"],
      properties: {
        reportType: {
          type: "string",
          enum: ["DASHBOARD_SUMMARY", "SALES", "FINANCE", "HR", "PROJECTS", "TEAM", "AUDIT_LOGS"],
          example: "SALES",
        },
        format: {
          type: "string",
          enum: ["CSV", "XLSX", "PDF"],
          example: "CSV",
        },
        filters: {
          type: "object",
          example: { period: "30D" },
        },
      },
    },
    SaveWidgetsInput: {
      type: "object",
      required: ["widgets"],
      properties: {
        layoutName: { type: "string", default: "default", example: "default" },
        widgets: {
          type: "array",
          items: {
            type: "object",
            required: ["widgetId", "type", "title", "position"],
            properties: {
              widgetId: { type: "string", example: "w-revenue" },
              type: { type: "string", example: "REVENUE_KPI" },
              title: { type: "string", example: "Revenue Overview" },
              position: {
                type: "object",
                properties: {
                  x: { type: "integer", example: 0 },
                  y: { type: "integer", example: 0 },
                  w: { type: "integer", example: 4 },
                  h: { type: "integer", example: 2 },
                },
              },
              isVisible: { type: "boolean", default: true },
              settings: { type: "object" },
            },
          },
        },
      },
    },
  },
} as const;
