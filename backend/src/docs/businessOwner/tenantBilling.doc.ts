// Business Owner Swagger documentation: Section D - Tenant Subscription & Billing.
export const tenantBillingDoc = {
  tags: [
    {
      name: "[Business Owner] Tenant Subscription & Billing",
      description: "Browse plans, view active subscription, download invoices, check usage quotas, checkout, upgrade/downgrade, or cancel plan",
    },
  ],
  paths: {
    "/api/v1/billing/plans": {
      get: {
        tags: ["[Business Owner] Tenant Subscription & Billing"],
        summary: "List available SaaS subscription plans",
        description: "Returns all active subscription plans with pricing, quotas, trial days, and enabled module features.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Available active plans catalog" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/v1/billing/subscription": {
      get: {
        tags: ["[Business Owner] Tenant Subscription & Billing"],
        summary: "Get company current subscription & entitlements",
        description: "Returns active plan details, renewal date, status, cancelAtPeriodEnd flag, and enabled module entitlements.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Current workspace subscription and entitlements" },
        },
      },
    },
    "/api/v1/billing/invoices": {
      get: {
        tags: ["[Business Owner] Tenant Subscription & Billing"],
        summary: "List company billing invoices",
        description: "Returns subscription invoices for the company with server-calculated tax, totals, and download URLs.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "ISSUED", "PAID", "OVERDUE", "VOID"] } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "Paginated billing invoices" },
        },
      },
    },
    "/api/v1/billing/invoices/{id}/download": {
      get: {
        tags: ["[Business Owner] Tenant Subscription & Billing"],
        summary: "Get invoice breakdown for download",
        description: "Returns full invoice data and company tax/billing address breakdown for PDF/print generation.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Invoice download details" },
          "404": { description: "Invoice not found" },
        },
      },
    },
    "/api/v1/billing/usage": {
      get: {
        tags: ["[Business Owner] Tenant Subscription & Billing"],
        summary: "Get seats, storage & API usage vs quotas",
        description: "Returns current usage metrics compared against plan quotas and utilization percentages.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Usage metrics and quotas" },
        },
      },
    },
    "/api/v1/billing/checkout": {
      post: {
        tags: ["[Business Owner] Tenant Subscription & Billing"],
        summary: "Start hosted payment gateway checkout",
        description:
          "Initiates a payment checkout session (Razorpay/Stripe), calculates tax and totals server-side, creates an invoice & pending transaction, and writes an audit log. Supports Idempotency-Key.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" },
            description: "Optional key to prevent duplicate checkout sessions",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TenantCheckoutInput" },
            },
          },
        },
        responses: {
          "201": { description: "Checkout session started successfully" },
          "404": { description: "Plan not found or inactive" },
        },
      },
    },
    "/api/v1/billing/change-plan": {
      post: {
        tags: ["[Business Owner] Tenant Subscription & Billing"],
        summary: "Upgrade or downgrade subscription plan",
        description:
          "Switches the company to a new plan, calculates amounts server-side, syncs module entitlements & quotas, issues an invoice, and records an audit log. Supports Idempotency-Key.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" },
            description: "Optional key to prevent duplicate plan changes",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TenantChangePlanInput" },
            },
          },
        },
        responses: {
          "200": { description: "Subscription plan updated successfully" },
          "404": { description: "Target plan not found" },
        },
      },
    },
    "/api/v1/billing/cancel": {
      post: {
        tags: ["[Business Owner] Tenant Subscription & Billing"],
        summary: "Cancel subscription (period-end or immediate)",
        description:
          "Cancels the subscription either at the end of the current billing cycle or immediately, and writes an audit log. Supports Idempotency-Key.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" },
            description: "Optional key to prevent duplicate cancellation calls",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TenantCancelSubscriptionInput" },
            },
          },
        },
        responses: {
          "200": { description: "Subscription cancellation processed" },
          "404": { description: "No active subscription found" },
          "409": { description: "Subscription is already cancelled" },
        },
      },
    },
  },
  schemas: {
    TenantCheckoutInput: {
      type: "object",
      required: ["planId"],
      properties: {
        planId: { type: "string", format: "uuid" },
        provider: { type: "string", enum: ["RAZORPAY", "STRIPE"], default: "RAZORPAY" },
        successUrl: { type: "string", format: "uri", example: "https://bizflow360.com/billing/success" },
        cancelUrl: { type: "string", format: "uri", example: "https://bizflow360.com/billing/cancel" },
      },
    },
    TenantChangePlanInput: {
      type: "object",
      required: ["planId"],
      properties: {
        planId: { type: "string", format: "uuid" },
        prorationMode: { type: "string", enum: ["IMMEDIATE", "NEXT_CYCLE"], default: "IMMEDIATE" },
      },
    },
    TenantCancelSubscriptionInput: {
      type: "object",
      properties: {
        cancelAtPeriodEnd: { type: "boolean", default: true },
        reason: { type: "string", example: "Switching to seasonal operations" },
      },
    },
  },
} as const;
