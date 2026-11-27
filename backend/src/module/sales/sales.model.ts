// Sales Module validation schemas: Products, Quotations, Orders, Invoices & Payments.
import { z } from "zod";
import {
  ITEM_TYPES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  QUOTATION_STATUSES,
  SALES_INVOICE_STATUSES,
} from "../../db/schema";

export const productsQuerySchema = z.object({
  itemType: z.enum(ITEM_TYPES).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  itemType: z.enum(ITEM_TYPES).default("PRODUCT"),
  unit: z.string().trim().min(1).max(40).default("PCS"),
  purchasePrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).default(18),
  trackInventory: z.boolean().default(false),
  stockQuantity: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const lineItemSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive("Quantity 0 se badi honi chahiye"),
  unitPrice: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(18),
});

export const quotationsQuerySchema = z.object({
  status: z.enum(QUOTATION_STATUSES).optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createQuotationSchema = z.object({
  customerId: z.string().uuid("Valid Customer ID dalein"),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein"),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein"),
  terms: z.string().trim().max(2000).optional(),
  items: z.array(lineItemSchema).min(1, "Kam se kam 1 line item add karein"),
});

export const ordersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createOrderSchema = z.object({
  customerId: z.string().uuid("Valid Customer ID dalein"),
  quotationId: z.string().uuid().optional().nullable(),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein"),
  items: z.array(lineItemSchema).optional(),
});

export const salesInvoicesQuerySchema = z.object({
  status: z.enum(SALES_INVOICE_STATUSES).optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createSalesInvoiceSchema = z.object({
  customerId: z.string().uuid("Valid Customer ID dalein"),
  orderId: z.string().uuid().optional().nullable(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein"),
  items: z.array(lineItemSchema).optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive("Payment amount 0 se bada hona chahiye"),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paidAt: z.string().datetime().optional(),
  paymentRef: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type ProductsQuery = z.infer<typeof productsQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type QuotationsQuery = z.infer<typeof quotationsQuerySchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type SalesInvoicesQuery = z.infer<typeof salesInvoicesQuerySchema>;
export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
