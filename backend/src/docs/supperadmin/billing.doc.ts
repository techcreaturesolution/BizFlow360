// Super Admin Subscriptions & Billing (States, Invoices, Adjustments, Webhooks) Swagger docs.
export const billingDoc = {
  tags: [
    {
      name: "[Super Admin] Subscriptions & Billing",
      description: "Subscriptions, manual adjustments, invoices, payment history, aur gateway webhooks",
    },
  ],
  paths: {
    "/api/v1/platform/subscriptions": {
      get: {
        tags: ["[Super Admin] Subscriptions & Billing"],
        summary: "List subscriptions",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED", "EXPIRED"],
            },
          },
          { name: "plan_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "tenant_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          "200": {
            description: "Paginated subscriptions list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SubscriptionListSuccessResponse" },
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
    "/api/v1/platform/subscriptions/{id}/adjust": {
      post: {
        tags: ["[Super Admin] Subscriptions & Billing"],
        summary: "Perform manual billing adjustment (audit logged)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/AdjustSubscriptionInput" } },
          },
        },
        responses: {
          "200": {
            description: "Adjusted subscription",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SubscriptionDetailSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "404": {
            description: "Subscription, plan, or invoice not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/api/v1/platform/invoices": {
      get: {
        tags: ["[Super Admin] Subscriptions & Billing"],
        summary: "List subscription invoices",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "tenant_id", in: "query", schema: { type: "string", format: "uuid" } },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["DRAFT", "ISSUED", "PAID", "OVERDUE", "VOID"] },
          },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          "200": {
            description: "Paginated invoices list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InvoiceListSuccessResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/platform/invoices/{id}": {
      get: {
        tags: ["[Super Admin] Subscriptions & Billing"],
        summary: "Get invoice detail with linked payments",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Invoice detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InvoiceDetailSuccessResponse" },
              },
            },
          },
          "404": {
            description: "Invoice not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/api/v1/platform/payments": {
      get: {
        tags: ["[Super Admin] Subscriptions & Billing"],
        summary: "List payment transactions and failed webhooks",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "tenant_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "provider", in: "query", schema: { type: "string", example: "RAZORPAY" } },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"] },
          },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          "200": {
            description: "Paginated payment transactions",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaymentListSuccessResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/billing/webhooks/{provider}": {
      post: {
        tags: ["[Super Admin] Subscriptions & Billing"],
        summary: "Payment gateway webhook receiver (signature verify + idempotent)",
        parameters: [
          {
            name: "provider",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["razorpay", "stripe"] },
          },
          {
            name: "x-razorpay-signature",
            in: "header",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "stripe-signature",
            in: "header",
            required: false,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  event_id: { type: "string", example: "evt_rzp_12345" },
                  event: { type: "string", example: "payment.captured" },
                  tenant_id: { type: "string", format: "uuid" },
                  invoice_id: { type: "string", format: "uuid" },
                  provider_payment_id: { type: "string", example: "pay_12345" },
                  amount: { type: "number", example: 1178.82 },
                  currency: { type: "string", example: "INR" },
                  status: { type: "string", enum: ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Webhook processed (or duplicate safely ignored)",
          },
          "401": {
            description: "Invalid webhook signature",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
  },
  schemas: {
    AdjustSubscriptionInput: {
      type: "object",
      required: ["adjustment_type", "reason"],
      properties: {
        adjustment_type: {
          type: "string",
          enum: ["EXTEND_TRIAL", "CHANGE_PLAN", "MANUAL_ACTIVATE", "MARK_INVOICE_PAID", "SUSPEND"],
          example: "EXTEND_TRIAL",
        },
        plan_id: { type: "string", format: "uuid" },
        trial_ends_at: { type: "string", format: "date-time", example: "2026-12-31T23:59:59.000Z" },
        invoice_id: { type: "string", format: "uuid" },
        reason: { type: "string", example: "Customer requested 7-day trial extension" },
      },
    },
    SubscriptionListItem: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        tenant_id: { type: "string", format: "uuid" },
        tenant_name: { type: "string", nullable: true, example: "Apex Solutions" },
        tenant_slug: { type: "string", nullable: true, example: "apex-solutions" },
        plan_id: { type: "string", format: "uuid" },
        plan_code: { type: "string", nullable: true, example: "STARTER_MONTHLY" },
        plan_name: { type: "string", nullable: true, example: "Starter" },
        billing_interval: { type: "string", nullable: true, example: "MONTHLY" },
        plan_price: { type: "number", nullable: true, example: 999 },
        plan_currency: { type: "string", nullable: true, example: "INR" },
        status: {
          type: "string",
          enum: ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED", "EXPIRED"],
        },
        starts_at: { type: "string", format: "date-time" },
        ends_at: { type: "string", format: "date-time" },
        trial_ends_at: { type: "string", format: "date-time", nullable: true },
        cancel_at_period_end: { type: "boolean" },
        provider_customer_ref: { type: "string", nullable: true },
        provider_subscription_ref: { type: "string", nullable: true },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
      },
    },
    InvoiceItem: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        tenant_id: { type: "string", format: "uuid" },
        tenant_name: { type: "string", nullable: true },
        tenant_slug: { type: "string", nullable: true },
        subscription_id: { type: "string", format: "uuid" },
        invoice_no: { type: "string", example: "INV-2026-0001" },
        amount: { type: "number", example: 999 },
        tax: { type: "number", example: 179.82 },
        total: { type: "number", example: 1178.82 },
        currency: { type: "string", example: "INR" },
        status: { type: "string", enum: ["DRAFT", "ISSUED", "PAID", "OVERDUE", "VOID"] },
        due_date: { type: "string", format: "date", example: "2026-12-05" },
        paid_at: { type: "string", format: "date-time", nullable: true },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
      },
    },
    PaymentTransactionItem: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        tenant_id: { type: "string", format: "uuid" },
        tenant_name: { type: "string", nullable: true },
        invoice_id: { type: "string", format: "uuid", nullable: true },
        provider: { type: "string", example: "RAZORPAY" },
        provider_event_id: { type: "string", nullable: true },
        provider_payment_id: { type: "string", nullable: true },
        amount: { type: "number", example: 1178.82 },
        currency: { type: "string", example: "INR" },
        status: { type: "string", enum: ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"] },
        raw_payload: { type: "object", nullable: true },
        created_at: { type: "string", format: "date-time" },
      },
    },
    SubscriptionListSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { type: "array", items: { $ref: "#/components/schemas/SubscriptionListItem" } },
        meta: { $ref: "#/components/schemas/PageMeta" },
      },
    },
    SubscriptionDetailSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: "#/components/schemas/SubscriptionListItem" },
      },
    },
    InvoiceListSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { type: "array", items: { $ref: "#/components/schemas/InvoiceItem" } },
        meta: { $ref: "#/components/schemas/PageMeta" },
      },
    },
    InvoiceDetailSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          allOf: [
            { $ref: "#/components/schemas/InvoiceItem" },
            {
              type: "object",
              properties: {
                payments: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PaymentTransactionItem" },
                },
              },
            },
          ],
        },
      },
    },
    PaymentListSuccessResponse: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { type: "array", items: { $ref: "#/components/schemas/PaymentTransactionItem" } },
        meta: { $ref: "#/components/schemas/PageMeta" },
      },
    },
  },
} as const;
