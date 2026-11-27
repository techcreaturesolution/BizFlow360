// Sales schema: Products Catalogue, Quotations, Orders, Client Invoices, and Payments.
import {
  boolean,
  char,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { crmCustomers } from "./crm";
import { tenants } from "./tenants";
import { users } from "./users";

export const ITEM_TYPES = ["PRODUCT", "SERVICE"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const QUOTATION_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "IN_PROGRESS",
  "FULFILLED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SALES_INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
] as const;
export type SalesInvoiceStatus = (typeof SALES_INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "UPI",
  "CARD",
  "CASH",
  "CHEQUE",
  "GATEWAY",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const salesProducts = pgTable(
  "sales_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 80 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    itemType: varchar("item_type", { length: 20 }).$type<ItemType>().notNull().default("PRODUCT"),
    unit: varchar("unit", { length: 40 }).notNull().default("PCS"),
    purchasePrice: numeric("purchase_price", { precision: 14, scale: 2 }).notNull().default("0.00"),
    sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }).notNull().default("0.00"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("18.00"),
    trackInventory: boolean("track_inventory").notNull().default(false),
    stockQuantity: numeric("stock_quantity", { precision: 14, scale: 2 }).notNull().default("0.00"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sales_products_tenant_id_idx").on(table.tenantId),
    uniqueIndex("sales_products_tenant_sku_uidx").on(table.tenantId, table.sku),
  ],
);

export const salesQuotations = pgTable(
  "sales_quotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    quotationNo: varchar("quotation_no", { length: 80 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => crmCustomers.id, { onDelete: "restrict" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 30 }).$type<QuotationStatus>().notNull().default("DRAFT"),
    issueDate: date("issue_date").notNull(),
    validUntil: date("valid_until").notNull(),
    terms: text("terms"),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0.00"),
    discountTotal: numeric("discount_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sales_quotations_tenant_id_idx").on(table.tenantId),
    index("sales_quotations_customer_id_idx").on(table.customerId),
    uniqueIndex("sales_quotations_tenant_no_uidx").on(table.tenantId, table.quotationNo),
  ],
);

export const salesQuotationItems = pgTable(
  "sales_quotation_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => salesQuotations.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => salesProducts.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
    lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 }).notNull(),
    lineTax: numeric("line_tax", { precision: 14, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [index("sales_quotation_items_quotation_id_idx").on(table.quotationId)],
);

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderNo: varchar("order_no", { length: 80 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => crmCustomers.id, { onDelete: "restrict" }),
    quotationId: uuid("quotation_id").references(() => salesQuotations.id, { onDelete: "set null" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 30 }).$type<OrderStatus>().notNull().default("CONFIRMED"),
    orderDate: date("order_date").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0.00"),
    discountTotal: numeric("discount_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sales_orders_tenant_id_idx").on(table.tenantId),
    uniqueIndex("sales_orders_tenant_no_uidx").on(table.tenantId, table.orderNo),
  ],
);

export const salesOrderItems = pgTable(
  "sales_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => salesProducts.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
    lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 }).notNull(),
    lineTax: numeric("line_tax", { precision: 14, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [index("sales_order_items_order_id_idx").on(table.orderId)],
);

export const salesInvoices = pgTable(
  "sales_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceNo: varchar("invoice_no", { length: 80 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => crmCustomers.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => salesOrders.id, { onDelete: "set null" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 30 }).$type<SalesInvoiceStatus>().notNull().default("ISSUED"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0.00"),
    discountTotal: numeric("discount_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
    balanceDue: numeric("balance_due", { precision: 14, scale: 2 }).notNull().default("0.00"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sales_invoices_tenant_id_idx").on(table.tenantId),
    index("sales_invoices_status_idx").on(table.status),
    uniqueIndex("sales_invoices_tenant_no_uidx").on(table.tenantId, table.invoiceNo),
  ],
);

export const salesInvoiceItems = pgTable(
  "sales_invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => salesProducts.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
    lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 }).notNull(),
    lineTax: numeric("line_tax", { precision: 14, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [index("sales_invoice_items_invoice_id_idx").on(table.invoiceId)],
);

export const salesInvoicePayments = pgTable(
  "sales_invoice_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    paymentMethod: varchar("payment_method", { length: 30 }).$type<PaymentMethod>().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    paymentRef: varchar("payment_ref", { length: 120 }),
    notes: text("notes"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sales_invoice_payments_invoice_id_idx").on(table.invoiceId),
    index("sales_invoice_payments_tenant_id_idx").on(table.tenantId),
  ],
);
