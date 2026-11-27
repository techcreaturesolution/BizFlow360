// Swagger documentation: Core Sales Module (Products, Quotations, Orders, Invoices, Payments).
export const coreSalesDoc = {
  tags: [
    {
      name: "[Core] Sales (Catalogue, Quotes, Orders & Invoices)",
      description: "Server-side tax/discount/balance calculations + Idempotent conversion & payments (Entitlement: SALES)",
    },
  ],
  paths: {
    "/api/v1/sales/products": {
      get: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "List products & services catalogue",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "itemType", in: "query", schema: { type: "string", enum: ["PRODUCT", "SERVICE"] } },
          { name: "isActive", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { "200": { description: "Catalogue list" } },
      },
      post: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Create a product or service",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateProductInput" } },
          },
        },
        responses: { "201": { description: "Product created" } },
      },
    },
    "/api/v1/sales/products/{id}": {
      patch: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Update product or service",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateProductInput" } },
          },
        },
        responses: { "200": { description: "Product updated" } },
      },
    },
    "/api/v1/sales/quotations": {
      get: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "List quotations",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "customerId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { "200": { description: "Paginated quotations" } },
      },
      post: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Create quotation (server-side tax & totals)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateQuotationInput" } },
          },
        },
        responses: { "201": { description: "Quotation created" } },
      },
    },
    "/api/v1/sales/quotations/{id}": {
      get: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Get quotation with line items",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Quotation details" } },
      },
    },
    "/api/v1/sales/quotations/{id}/approve": {
      post: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Approve quotation",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Quotation approved" } },
      },
    },
    "/api/v1/sales/quotations/{id}/send": {
      post: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Send quotation to customer",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Quotation sent" } },
      },
    },
    "/api/v1/sales/quotations/{id}/convert-order": {
      post: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Convert quotation to Sales Order (Idempotent)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
        ],
        responses: { "201": { description: "Sales Order created from quotation" } },
      },
    },
    "/api/v1/sales/orders": {
      get: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "List sales orders",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Sales orders list" } },
      },
      post: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Create sales order",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateOrderInput" } },
          },
        },
        responses: { "201": { description: "Sales order created" } },
      },
    },
    "/api/v1/sales/invoices": {
      get: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "List client invoices",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Client invoices list" } },
      },
      post: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Create client invoice (server-side tax & balance calculation)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateSalesInvoiceInput" } },
          },
        },
        responses: { "201": { description: "Invoice created" } },
      },
    },
    "/api/v1/sales/invoices/{id}": {
      get: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Get invoice details, line items, and payments",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Invoice detail" } },
      },
    },
    "/api/v1/sales/invoices/{id}/payments": {
      post: {
        tags: ["[Core] Sales (Catalogue, Quotes, Orders & Invoices)"],
        summary: "Record partial or full invoice payment (Idempotent + Server Balance Update)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RecordPaymentInput" } },
          },
        },
        responses: { "201": { description: "Payment recorded & invoice balance updated" } },
      },
    },
  },
  schemas: {
    CreateProductInput: {
      type: "object",
      required: ["sku", "name", "sellingPrice"],
      properties: {
        sku: { type: "string", example: "SKU-CLOUD-01" },
        name: { type: "string", example: "Annual Cloud License" },
        itemType: { type: "string", enum: ["PRODUCT", "SERVICE"], default: "PRODUCT" },
        unit: { type: "string", default: "PCS" },
        purchasePrice: { type: "number", example: 5000 },
        sellingPrice: { type: "number", example: 12000 },
        taxRate: { type: "number", default: 18 },
        trackInventory: { type: "boolean", default: false },
      },
    },
    SalesLineItemInput: {
      type: "object",
      required: ["description", "quantity", "unitPrice"],
      properties: {
        productId: { type: "string", format: "uuid", nullable: true },
        description: { type: "string", example: "Annual Cloud License" },
        quantity: { type: "number", example: 2 },
        unitPrice: { type: "number", example: 12000 },
        discountAmount: { type: "number", default: 0 },
        taxRate: { type: "number", default: 18 },
      },
    },
    CreateQuotationInput: {
      type: "object",
      required: ["customerId", "issueDate", "validUntil", "items"],
      properties: {
        customerId: { type: "string", format: "uuid" },
        issueDate: { type: "string", format: "date", example: "2026-11-27" },
        validUntil: { type: "string", format: "date", example: "2026-12-27" },
        terms: { type: "string", example: "50% advance, balance on delivery" },
        items: { type: "array", items: { $ref: "#/components/schemas/SalesLineItemInput" } },
      },
    },
    CreateOrderInput: {
      type: "object",
      required: ["customerId", "orderDate"],
      properties: {
        customerId: { type: "string", format: "uuid" },
        quotationId: { type: "string", format: "uuid", nullable: true },
        orderDate: { type: "string", format: "date", example: "2026-11-27" },
        items: { type: "array", items: { $ref: "#/components/schemas/SalesLineItemInput" } },
      },
    },
    CreateSalesInvoiceInput: {
      type: "object",
      required: ["customerId", "issueDate", "dueDate"],
      properties: {
        customerId: { type: "string", format: "uuid" },
        orderId: { type: "string", format: "uuid", nullable: true },
        issueDate: { type: "string", format: "date", example: "2026-11-27" },
        dueDate: { type: "string", format: "date", example: "2026-12-27" },
        items: { type: "array", items: { $ref: "#/components/schemas/SalesLineItemInput" } },
      },
    },
    RecordPaymentInput: {
      type: "object",
      required: ["amount", "paymentMethod"],
      properties: {
        amount: { type: "number", example: 5000 },
        paymentMethod: { type: "string", enum: ["BANK_TRANSFER", "UPI", "CARD", "CASH", "CHEQUE", "GATEWAY"] },
        paidAt: { type: "string", format: "date-time" },
        paymentRef: { type: "string", example: "UTR1234567890" },
        notes: { type: "string" },
      },
    },
  },
} as const;
