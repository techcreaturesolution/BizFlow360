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
  item_type: z.enum(ITEM_TYPES).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createProductSchema = z
  .object({
    sku: z.string().trim().min(1).max(80),
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(1000).optional(),
    itemType: z.enum(ITEM_TYPES).optional(),
    item_type: z.enum(ITEM_TYPES).optional(),
    unit: z.string().trim().min(1).max(40).default("PCS"),
    purchasePrice: z.coerce.number().min(0).optional(),
    purchase_price: z.coerce.number().min(0).optional(),
    sellingPrice: z.coerce.number().min(0).optional(),
    selling_price: z.coerce.number().min(0).optional(),
    taxRate: z.coerce.number().min(0).max(100).optional(),
    tax_rate: z.coerce.number().min(0).max(100).optional(),
    trackInventory: z.boolean().optional(),
    track_inventory: z.boolean().optional(),
    stockQuantity: z.coerce.number().min(0).optional(),
    stock_quantity: z.coerce.number().min(0).optional(),
    isActive: z.boolean().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((d) => d.sellingPrice !== undefined || d.selling_price !== undefined, {
    message: "sellingPrice ya selling_price required hai",
  });

export const updateProductSchema = z.object({
  sku: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  itemType: z.enum(ITEM_TYPES).optional(),
  item_type: z.enum(ITEM_TYPES).optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  purchase_price: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  selling_price: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  tax_rate: z.coerce.number().min(0).max(100).optional(),
  trackInventory: z.boolean().optional(),
  track_inventory: z.boolean().optional(),
  stockQuantity: z.coerce.number().min(0).optional(),
  stock_quantity: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const lineItemSchema = z
  .object({
    productId: z.string().uuid().optional().nullable(),
    product_id: z.string().uuid().optional().nullable(),
    description: z.string().trim().min(1).max(500),
    quantity: z.coerce.number().positive("Quantity 0 se badi honi chahiye"),
    unitPrice: z.coerce.number().min(0).optional(),
    unit_price: z.coerce.number().min(0).optional(),
    discountAmount: z.coerce.number().min(0).optional(),
    discount_amount: z.coerce.number().min(0).optional(),
    taxRate: z.coerce.number().min(0).max(100).optional(),
    tax_rate: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((d) => d.unitPrice !== undefined || d.unit_price !== undefined, {
    message: "unitPrice ya unit_price required hai",
  });

export const quotationsQuerySchema = z.object({
  status: z.enum(QUOTATION_STATUSES).optional(),
  customerId: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  created_by: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  owner_user_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createQuotationSchema = z
  .object({
    customerId: z.string().uuid("Valid Customer ID dalein").optional(),
    customer_id: z.string().uuid("Valid Customer ID dalein").optional(),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein").optional(),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein").optional(),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein").optional(),
    valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein").optional(),
    terms: z.string().trim().max(2000).optional(),
    submitForApproval: z.boolean().default(false),
    items: z.array(lineItemSchema).min(1, "Kam se kam 1 line item add karein"),
  })
  .refine((d) => Boolean(d.customerId || d.customer_id), {
    message: "customerId ya customer_id required hai",
  })
  .refine((d) => Boolean(d.issueDate || d.issue_date), {
    message: "issueDate ya issue_date required hai",
  })
  .refine((d) => Boolean(d.validUntil || d.valid_until), {
    message: "validUntil ya valid_until required hai",
  });

export const approveQuotationSchema = z.object({
  comment: z.string().trim().max(1000).optional(),
  reason: z.string().trim().max(1000).optional(),
});

export const sendQuotationSchema = z.object({
  recipientEmail: z.string().trim().email().optional(),
  recipient_email: z.string().trim().email().optional(),
  deliveryChannel: z.enum(["EMAIL", "PDF_LINK", "WHATSAPP"]).default("EMAIL"),
  delivery_channel: z.enum(["EMAIL", "PDF_LINK", "WHATSAPP"]).optional(),
  message: z.string().trim().max(2000).optional(),
});

export const convertQuotationOrderSchema = z.object({
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein").optional(),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein").optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const ordersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  customerId: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  owner_user_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createOrderSchema = z
  .object({
    customerId: z.string().uuid("Valid Customer ID dalein").optional(),
    customer_id: z.string().uuid("Valid Customer ID dalein").optional(),
    quotationId: z.string().uuid().optional().nullable(),
    quotation_id: z.string().uuid().optional().nullable(),
    orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein").optional(),
    order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format mein dalein").optional(),
    items: z.array(lineItemSchema).optional(),
  })
  .refine((d) => Boolean(d.customerId || d.customer_id), {
    message: "customerId ya customer_id required hai",
  })
  .refine((d) => Boolean(d.orderDate || d.order_date), {
    message: "orderDate ya order_date required hai",
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
export type ApproveQuotationInput = z.infer<typeof approveQuotationSchema>;
export type SendQuotationInput = z.infer<typeof sendQuotationSchema>;
export type ConvertQuotationOrderInput = z.infer<typeof convertQuotationOrderSchema>;
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type SalesInvoicesQuery = z.infer<typeof salesInvoicesQuerySchema>;
export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
