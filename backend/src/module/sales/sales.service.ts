// Sales Service: Catalogue, Quotations, Orders, Invoices & Payments with server-side math & Record Scope.
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  crmCustomers,
  salesInvoiceItems,
  salesInvoicePayments,
  salesInvoices,
  salesOrderItems,
  salesOrders,
  salesProducts,
  salesQuotationItems,
  salesQuotations,
  tenants,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import { hasTenantWideScope, type AuthContext } from "../../middlewares/guards";
import type {
  CreateOrderInput,
  CreateProductInput,
  CreateQuotationInput,
  CreateSalesInvoiceInput,
  LineItemInput,
  OrdersQuery,
  ProductsQuery,
  QuotationsQuery,
  RecordPaymentInput,
  SalesInvoicesQuery,
  UpdateProductInput,
} from "./sales.model";

// Server-side line item calculation engine (Rule #3: never trust frontend totals)
function computeOrderTotals(items: LineItemInput[]) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  const computedItems = items.map((item) => {
    const gross = Number((item.quantity * item.unitPrice).toFixed(2));
    const discount = Math.min(gross, Math.max(0, Number(item.discountAmount.toFixed(2))));
    const netSubtotal = Number((gross - discount).toFixed(2));
    const taxAmount = Number(((netSubtotal * item.taxRate) / 100).toFixed(2));
    const lineTotal = Number((netSubtotal + taxAmount).toFixed(2));

    subtotal += gross;
    discountTotal += discount;
    taxTotal += taxAmount;
    grandTotal += lineTotal;

    return {
      productId: item.productId ?? null,
      description: item.description,
      quantity: item.quantity.toFixed(2),
      unitPrice: item.unitPrice.toFixed(2),
      discountAmount: discount.toFixed(2),
      taxRate: item.taxRate.toFixed(2),
      lineSubtotal: netSubtotal.toFixed(2),
      lineTax: taxAmount.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
    };
  });

  return {
    items: computedItems,
    subtotal: subtotal.toFixed(2),
    discountTotal: discountTotal.toFixed(2),
    taxTotal: taxTotal.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
  };
}

async function getTenantCurrency(tenantId: string): Promise<string> {
  const [t] = await db
    .select({ defaultCurrency: tenants.defaultCurrency })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return t?.defaultCurrency.trim() ?? "INR";
}

async function assertCustomerExists(tenantId: string, customerId: string) {
  const [c] = await db
    .select({ id: crmCustomers.id, name: crmCustomers.name })
    .from(crmCustomers)
    .where(and(eq(crmCustomers.id, customerId), eq(crmCustomers.tenantId, tenantId)))
    .limit(1);
  if (!c) {
    throw Errors.notFound("Customer not found in your company.");
  }
  return c;
}

// ==========================================
// 1. CATALOGUE (PRODUCTS)
// ==========================================
export async function listProducts(tenantId: string, query: ProductsQuery) {
  const conditions = [eq(salesProducts.tenantId, tenantId)];
  if (query.itemType) conditions.push(eq(salesProducts.itemType, query.itemType));
  if (query.isActive !== undefined) conditions.push(eq(salesProducts.isActive, query.isActive));
  if (query.search) {
    const p = `%${query.search}%`;
    conditions.push(or(ilike(salesProducts.name, p), ilike(salesProducts.sku, p))!);
  }

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(salesProducts).where(and(...conditions)),
    db
      .select()
      .from(salesProducts)
      .where(and(...conditions))
      .orderBy(desc(salesProducts.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    products: rows.map((p) => ({
      ...p,
      purchasePrice: Number(p.purchasePrice),
      sellingPrice: Number(p.sellingPrice),
      taxRate: Number(p.taxRate),
      stockQuantity: Number(p.stockQuantity),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createProduct(
  auth: AuthContext,
  input: CreateProductInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;

  const [dup] = await db
    .select({ id: salesProducts.id })
    .from(salesProducts)
    .where(and(eq(salesProducts.tenantId, tenantId), eq(salesProducts.sku, input.sku)))
    .limit(1);

  if (dup) {
    throw Errors.conflict(`Product with SKU '${input.sku}' already exists.`);
  }

  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(salesProducts)
      .values({
        tenantId,
        sku: input.sku,
        name: input.name,
        description: input.description ?? null,
        itemType: input.itemType,
        unit: input.unit,
        purchasePrice: input.purchasePrice.toFixed(2),
        sellingPrice: input.sellingPrice.toFixed(2),
        taxRate: input.taxRate.toFixed(2),
        trackInventory: input.trackInventory,
        stockQuantity: input.stockQuantity.toFixed(2),
        isActive: input.isActive,
        createdBy: auth.userId,
      })
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.PRODUCT.CREATE",
      entityType: "sales_product",
      entityId: rows[0].id,
      afterData: { sku: input.sku, name: input.name, sellingPrice: input.sellingPrice },
      requestId,
    });

    return rows;
  });

  return {
    product: {
      ...created,
      purchasePrice: Number(created.purchasePrice),
      sellingPrice: Number(created.sellingPrice),
      taxRate: Number(created.taxRate),
      stockQuantity: Number(created.stockQuantity),
    },
  };
}

export async function updateProduct(
  auth: AuthContext,
  productId: string,
  input: UpdateProductInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const [existing] = await db
    .select()
    .from(salesProducts)
    .where(and(eq(salesProducts.id, productId), eq(salesProducts.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw Errors.notFound("Product not found.");
  }

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(salesProducts)
      .set({
        ...(input.sku !== undefined && { sku: input.sku }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.itemType !== undefined && { itemType: input.itemType }),
        ...(input.unit !== undefined && { unit: input.unit }),
        ...(input.purchasePrice !== undefined && { purchasePrice: input.purchasePrice.toFixed(2) }),
        ...(input.sellingPrice !== undefined && { sellingPrice: input.sellingPrice.toFixed(2) }),
        ...(input.taxRate !== undefined && { taxRate: input.taxRate.toFixed(2) }),
        ...(input.trackInventory !== undefined && { trackInventory: input.trackInventory }),
        ...(input.stockQuantity !== undefined && { stockQuantity: input.stockQuantity.toFixed(2) }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
      })
      .where(and(eq(salesProducts.id, productId), eq(salesProducts.tenantId, tenantId)))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.PRODUCT.UPDATE",
      entityType: "sales_product",
      entityId: productId,
      beforeData: { sellingPrice: existing.sellingPrice, isActive: existing.isActive },
      afterData: { sellingPrice: rows[0].sellingPrice, isActive: rows[0].isActive },
      requestId,
    });

    return rows;
  });

  return {
    product: {
      ...updated,
      purchasePrice: Number(updated.purchasePrice),
      sellingPrice: Number(updated.sellingPrice),
      taxRate: Number(updated.taxRate),
      stockQuantity: Number(updated.stockQuantity),
    },
  };
}

// ==========================================
// 2. QUOTATIONS
// ==========================================
export async function listQuotations(auth: AuthContext, query: QuotationsQuery) {
  const tenantId = auth.tenantId!;
  const isCompanyWide = hasTenantWideScope(auth, "SALES.QUOTATIONS.VIEW_ALL");

  const conditions = [eq(salesQuotations.tenantId, tenantId)];
  if (!isCompanyWide) {
    conditions.push(or(eq(salesQuotations.ownerUserId, auth.userId), eq(salesQuotations.createdBy, auth.userId))!);
  }
  if (query.status) conditions.push(eq(salesQuotations.status, query.status));
  if (query.customerId) conditions.push(eq(salesQuotations.customerId, query.customerId));

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(salesQuotations).where(and(...conditions)),
    db
      .select({
        quotation: salesQuotations,
        customerName: crmCustomers.name,
      })
      .from(salesQuotations)
      .leftJoin(crmCustomers, eq(crmCustomers.id, salesQuotations.customerId))
      .where(and(...conditions))
      .orderBy(desc(salesQuotations.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    scope: isCompanyWide ? "COMPANY_WIDE" : "ASSIGNED_ONLY",
    quotations: rows.map((r) => ({
      ...r.quotation,
      customerName: r.customerName ?? null,
      subtotal: Number(r.quotation.subtotal),
      discountTotal: Number(r.quotation.discountTotal),
      taxTotal: Number(r.quotation.taxTotal),
      grandTotal: Number(r.quotation.grandTotal),
      currency: r.quotation.currency.trim(),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createQuotation(
  auth: AuthContext,
  input: CreateQuotationInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  await assertCustomerExists(tenantId, input.customerId);
  const currency = await getTenantCurrency(tenantId);

  const calc = computeOrderTotals(input.items);
  const quotationNo = `QTN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const created = await db.transaction(async (tx) => {
    const [quotation] = await tx
      .insert(salesQuotations)
      .values({
        tenantId,
        quotationNo,
        customerId: input.customerId,
        ownerUserId: auth.userId,
        status: "DRAFT",
        issueDate: input.issueDate,
        validUntil: input.validUntil,
        terms: input.terms ?? null,
        currency,
        subtotal: calc.subtotal,
        discountTotal: calc.discountTotal,
        taxTotal: calc.taxTotal,
        grandTotal: calc.grandTotal,
        createdBy: auth.userId,
      })
      .returning();

    const insertedItems = await tx
      .insert(salesQuotationItems)
      .values(
        calc.items.map((item) => ({
          tenantId,
          quotationId: quotation.id,
          ...item,
        })),
      )
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.QUOTATION.CREATE",
      entityType: "sales_quotation",
      entityId: quotation.id,
      afterData: { quotationNo, grandTotal: Number(quotation.grandTotal), itemCount: insertedItems.length },
      requestId,
    });

    return { quotation, items: insertedItems };
  });

  return {
    quotation: {
      ...created.quotation,
      subtotal: Number(created.quotation.subtotal),
      discountTotal: Number(created.quotation.discountTotal),
      taxTotal: Number(created.quotation.taxTotal),
      grandTotal: Number(created.quotation.grandTotal),
      currency: created.quotation.currency.trim(),
      items: created.items,
    },
  };
}

export async function getQuotationDetail(auth: AuthContext, quotationId: string) {
  const tenantId = auth.tenantId!;
  const [row] = await db
    .select({
      quotation: salesQuotations,
      customerName: crmCustomers.name,
    })
    .from(salesQuotations)
    .leftJoin(crmCustomers, eq(crmCustomers.id, salesQuotations.customerId))
    .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)))
    .limit(1);

  if (!row) {
    throw Errors.notFound("Quotation not found.");
  }

  const isCompanyWide = hasTenantWideScope(auth, "SALES.QUOTATIONS.VIEW_ALL");
  if (!isCompanyWide && row.quotation.ownerUserId !== auth.userId && row.quotation.createdBy !== auth.userId) {
    throw Errors.forbidden("You do not have access to this quotation.");
  }

  const items = await db
    .select()
    .from(salesQuotationItems)
    .where(eq(salesQuotationItems.quotationId, quotationId));

  return {
    quotation: {
      ...row.quotation,
      customerName: row.customerName ?? null,
      subtotal: Number(row.quotation.subtotal),
      discountTotal: Number(row.quotation.discountTotal),
      taxTotal: Number(row.quotation.taxTotal),
      grandTotal: Number(row.quotation.grandTotal),
      currency: row.quotation.currency.trim(),
      items,
    },
  };
}

export async function approveQuotation(
  auth: AuthContext,
  quotationId: string,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const [existing] = await db
    .select()
    .from(salesQuotations)
    .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)))
    .limit(1);

  if (!existing) throw Errors.notFound("Quotation not found.");
  if (existing.status === "CONVERTED") throw Errors.conflict("Converted quotation cannot be re-approved.");

  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(salesQuotations)
      .set({
        status: "APPROVED",
        approvedBy: auth.userId,
        approvedAt: now,
        updatedAt: now,
      })
      .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.QUOTATION.APPROVE",
      entityType: "sales_quotation",
      entityId: quotationId,
      beforeData: { status: existing.status },
      afterData: { status: "APPROVED", approvedBy: auth.userId },
      requestId,
    });

    return rows;
  });

  return { quotation: updated, message: "Quotation approved successfully." };
}

export async function sendQuotation(
  auth: AuthContext,
  quotationId: string,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const [existing] = await db
    .select()
    .from(salesQuotations)
    .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)))
    .limit(1);

  if (!existing) throw Errors.notFound("Quotation not found.");

  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(salesQuotations)
      .set({
        status: "SENT",
        sentAt: now,
        updatedAt: now,
      })
      .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.QUOTATION.SEND",
      entityType: "sales_quotation",
      entityId: quotationId,
      beforeData: { status: existing.status },
      afterData: { status: "SENT", sentAt: now.toISOString() },
      requestId,
    });

    return rows;
  });

  return { quotation: updated, message: "Quotation marked as sent to customer." };
}

export async function convertQuotationToOrder(
  auth: AuthContext,
  quotationId: string,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const [quotation] = await db
    .select()
    .from(salesQuotations)
    .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)))
    .limit(1);

  if (!quotation) throw Errors.notFound("Quotation not found.");
  if (quotation.status === "CONVERTED") {
    throw Errors.conflict("Quotation has already been converted to an order.");
  }

  const qItems = await db
    .select()
    .from(salesQuotationItems)
    .where(eq(salesQuotationItems.quotationId, quotationId));

  const orderNo = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const todayStr = new Date().toISOString().slice(0, 10);

  const created = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(salesOrders)
      .values({
        tenantId,
        orderNo,
        customerId: quotation.customerId,
        quotationId: quotation.id,
        ownerUserId: quotation.ownerUserId ?? auth.userId,
        status: "CONFIRMED",
        orderDate: todayStr,
        currency: quotation.currency.trim(),
        subtotal: quotation.subtotal,
        discountTotal: quotation.discountTotal,
        taxTotal: quotation.taxTotal,
        grandTotal: quotation.grandTotal,
        createdBy: auth.userId,
      })
      .returning();

    if (qItems.length > 0) {
      await tx.insert(salesOrderItems).values(
        qItems.map((it) => ({
          tenantId,
          orderId: order.id,
          productId: it.productId,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountAmount: it.discountAmount,
          taxRate: it.taxRate,
          lineSubtotal: it.lineSubtotal,
          lineTax: it.lineTax,
          lineTotal: it.lineTotal,
        })),
      );
    }

    await tx
      .update(salesQuotations)
      .set({ status: "CONVERTED", updatedAt: new Date() })
      .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)));

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.QUOTATION.CONVERT_ORDER",
      entityType: "sales_order",
      entityId: order.id,
      afterData: { quotationId, orderNo, grandTotal: Number(order.grandTotal) },
      requestId,
    });

    return order;
  });

  return {
    order: {
      ...created,
      grandTotal: Number(created.grandTotal),
      currency: created.currency.trim(),
    },
    message: "Quotation converted to Sales Order successfully.",
  };
}

// ==========================================
// 3. ORDERS
// ==========================================
export async function listOrders(auth: AuthContext, query: OrdersQuery) {
  const tenantId = auth.tenantId!;
  const isCompanyWide = hasTenantWideScope(auth, "SALES.QUOTATIONS.VIEW_ALL");
  const conditions = [eq(salesOrders.tenantId, tenantId)];

  if (!isCompanyWide) {
    conditions.push(or(eq(salesOrders.ownerUserId, auth.userId), eq(salesOrders.createdBy, auth.userId))!);
  }
  if (query.status) conditions.push(eq(salesOrders.status, query.status));
  if (query.customerId) conditions.push(eq(salesOrders.customerId, query.customerId));

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(salesOrders).where(and(...conditions)),
    db
      .select({ order: salesOrders, customerName: crmCustomers.name })
      .from(salesOrders)
      .leftJoin(crmCustomers, eq(crmCustomers.id, salesOrders.customerId))
      .where(and(...conditions))
      .orderBy(desc(salesOrders.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    orders: rows.map((r) => ({
      ...r.order,
      customerName: r.customerName ?? null,
      subtotal: Number(r.order.subtotal),
      discountTotal: Number(r.order.discountTotal),
      taxTotal: Number(r.order.taxTotal),
      grandTotal: Number(r.order.grandTotal),
      currency: r.order.currency.trim(),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createOrder(
  auth: AuthContext,
  input: CreateOrderInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  await assertCustomerExists(tenantId, input.customerId);
  const currency = await getTenantCurrency(tenantId);

  let itemsToUse: LineItemInput[] = input.items ?? [];

  if (input.quotationId && itemsToUse.length === 0) {
    const qItems = await db
      .select()
      .from(salesQuotationItems)
      .where(
        and(
          eq(salesQuotationItems.quotationId, input.quotationId),
          eq(salesQuotationItems.tenantId, tenantId),
        ),
      );
    if (qItems.length === 0) {
      throw Errors.notFound("Referenced quotation has no items or does not exist.");
    }
    itemsToUse = qItems.map((it) => ({
      productId: it.productId,
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      discountAmount: Number(it.discountAmount),
      taxRate: Number(it.taxRate),
    }));
  }

  if (itemsToUse.length === 0) {
    throw Errors.badRequest("Kam se kam 1 item ya valid quotationId dein.");
  }

  const calc = computeOrderTotals(itemsToUse);
  const orderNo = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const created = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(salesOrders)
      .values({
        tenantId,
        orderNo,
        customerId: input.customerId,
        quotationId: input.quotationId ?? null,
        ownerUserId: auth.userId,
        status: "CONFIRMED",
        orderDate: input.orderDate,
        currency,
        subtotal: calc.subtotal,
        discountTotal: calc.discountTotal,
        taxTotal: calc.taxTotal,
        grandTotal: calc.grandTotal,
        createdBy: auth.userId,
      })
      .returning();

    const insertedItems = await tx
      .insert(salesOrderItems)
      .values(calc.items.map((it) => ({ tenantId, orderId: order.id, ...it })))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.ORDER.CREATE",
      entityType: "sales_order",
      entityId: order.id,
      afterData: { orderNo, grandTotal: Number(order.grandTotal) },
      requestId,
    });

    return { order, items: insertedItems };
  });

  return {
    order: {
      ...created.order,
      grandTotal: Number(created.order.grandTotal),
      currency: created.order.currency.trim(),
      items: created.items,
    },
  };
}

// ==========================================
// 4. INVOICES & PAYMENTS
// ==========================================
export async function listSalesInvoices(auth: AuthContext, query: SalesInvoicesQuery) {
  const tenantId = auth.tenantId!;
  const isCompanyWide = hasTenantWideScope(auth, "SALES.QUOTATIONS.VIEW_ALL");
  const conditions = [eq(salesInvoices.tenantId, tenantId)];

  if (!isCompanyWide) {
    conditions.push(or(eq(salesInvoices.ownerUserId, auth.userId), eq(salesInvoices.createdBy, auth.userId))!);
  }
  if (query.status) conditions.push(eq(salesInvoices.status, query.status));
  if (query.customerId) conditions.push(eq(salesInvoices.customerId, query.customerId));

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(salesInvoices).where(and(...conditions)),
    db
      .select({ invoice: salesInvoices, customerName: crmCustomers.name })
      .from(salesInvoices)
      .leftJoin(crmCustomers, eq(crmCustomers.id, salesInvoices.customerId))
      .where(and(...conditions))
      .orderBy(desc(salesInvoices.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    invoices: rows.map((r) => ({
      ...r.invoice,
      customerName: r.customerName ?? null,
      subtotal: Number(r.invoice.subtotal),
      discountTotal: Number(r.invoice.discountTotal),
      taxTotal: Number(r.invoice.taxTotal),
      grandTotal: Number(r.invoice.grandTotal),
      paidAmount: Number(r.invoice.paidAmount),
      balanceDue: Number(r.invoice.balanceDue),
      currency: r.invoice.currency.trim(),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createSalesInvoice(
  auth: AuthContext,
  input: CreateSalesInvoiceInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  await assertCustomerExists(tenantId, input.customerId);
  const currency = await getTenantCurrency(tenantId);

  let itemsToUse: LineItemInput[] = input.items ?? [];

  if (input.orderId && itemsToUse.length === 0) {
    const oItems = await db
      .select()
      .from(salesOrderItems)
      .where(and(eq(salesOrderItems.orderId, input.orderId), eq(salesOrderItems.tenantId, tenantId)));

    if (oItems.length === 0) {
      throw Errors.notFound("Referenced sales order has no items or does not exist.");
    }
    itemsToUse = oItems.map((it) => ({
      productId: it.productId,
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      discountAmount: Number(it.discountAmount),
      taxRate: Number(it.taxRate),
    }));
  }

  if (itemsToUse.length === 0) {
    throw Errors.badRequest("Kam se kam 1 line item ya valid orderId dein.");
  }

  const calc = computeOrderTotals(itemsToUse);
  const invoiceNo = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const created = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(salesInvoices)
      .values({
        tenantId,
        invoiceNo,
        customerId: input.customerId,
        orderId: input.orderId ?? null,
        ownerUserId: auth.userId,
        status: "ISSUED",
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        currency,
        subtotal: calc.subtotal,
        discountTotal: calc.discountTotal,
        taxTotal: calc.taxTotal,
        grandTotal: calc.grandTotal,
        paidAmount: "0.00",
        balanceDue: calc.grandTotal,
        createdBy: auth.userId,
      })
      .returning();

    const insertedItems = await tx
      .insert(salesInvoiceItems)
      .values(calc.items.map((it) => ({ tenantId, invoiceId: invoice.id, ...it })))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.INVOICE.CREATE",
      entityType: "sales_invoice",
      entityId: invoice.id,
      afterData: { invoiceNo, grandTotal: Number(invoice.grandTotal) },
      requestId,
    });

    return { invoice, items: insertedItems };
  });

  return {
    invoice: {
      ...created.invoice,
      grandTotal: Number(created.invoice.grandTotal),
      paidAmount: Number(created.invoice.paidAmount),
      balanceDue: Number(created.invoice.balanceDue),
      currency: created.invoice.currency.trim(),
      items: created.items,
    },
  };
}

export async function getSalesInvoiceDetail(auth: AuthContext, invoiceId: string) {
  const tenantId = auth.tenantId!;
  const [row] = await db
    .select({ invoice: salesInvoices, customerName: crmCustomers.name })
    .from(salesInvoices)
    .leftJoin(crmCustomers, eq(crmCustomers.id, salesInvoices.customerId))
    .where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.tenantId, tenantId)))
    .limit(1);

  if (!row) throw Errors.notFound("Invoice not found.");

  const [items, payments] = await Promise.all([
    db.select().from(salesInvoiceItems).where(eq(salesInvoiceItems.invoiceId, invoiceId)),
    db
      .select()
      .from(salesInvoicePayments)
      .where(eq(salesInvoicePayments.invoiceId, invoiceId))
      .orderBy(desc(salesInvoicePayments.paidAt)),
  ]);

  return {
    invoice: {
      ...row.invoice,
      customerName: row.customerName ?? null,
      subtotal: Number(row.invoice.subtotal),
      discountTotal: Number(row.invoice.discountTotal),
      taxTotal: Number(row.invoice.taxTotal),
      grandTotal: Number(row.invoice.grandTotal),
      paidAmount: Number(row.invoice.paidAmount),
      balanceDue: Number(row.invoice.balanceDue),
      currency: row.invoice.currency.trim(),
      items,
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        currency: p.currency.trim(),
      })),
    },
  };
}

// Record Invoice Payment (Rule #3: Server-side balance & status calculation + Rule #4: Transaction & Audit)
export async function recordInvoicePayment(
  auth: AuthContext,
  invoiceId: string,
  input: RecordPaymentInput,
  requestId?: string,
) {
  const tenantId = auth.tenantId!;

  const result = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(salesInvoices)
      .where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      throw Errors.notFound("Invoice not found.");
    }

    if (invoice.status === "VOID") {
      throw Errors.badRequest("Cannot record payment on a VOID invoice.");
    }

    if (invoice.status === "PAID") {
      throw Errors.conflict("Invoice is already fully paid.");
    }

    const currentBalance = Number(invoice.balanceDue);
    const paymentAmt = Number(input.amount.toFixed(2));

    if (paymentAmt > currentBalance) {
      throw Errors.badRequest(
        `Payment amount (${paymentAmt}) exceeds remaining balance due (${currentBalance}).`,
      );
    }

    const newPaidAmount = Number((Number(invoice.paidAmount) + paymentAmt).toFixed(2));
    const newBalanceDue = Number((Number(invoice.grandTotal) - newPaidAmount).toFixed(2));
    const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";
    const paidAtDate = input.paidAt ? new Date(input.paidAt) : new Date();

    const [payment] = await tx
      .insert(salesInvoicePayments)
      .values({
        tenantId,
        invoiceId,
        amount: paymentAmt.toFixed(2),
        currency: invoice.currency.trim(),
        paymentMethod: input.paymentMethod,
        paidAt: paidAtDate,
        paymentRef: input.paymentRef ?? null,
        notes: input.notes ?? null,
        recordedBy: auth.userId,
      })
      .returning();

    const [updatedInvoice] = await tx
      .update(salesInvoices)
      .set({
        paidAmount: newPaidAmount.toFixed(2),
        balanceDue: Math.max(0, newBalanceDue).toFixed(2),
        status: newStatus,
        paidAt: newStatus === "PAID" ? paidAtDate : invoice.paidAt,
        updatedAt: new Date(),
      })
      .where(eq(salesInvoices.id, invoiceId))
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.INVOICE.PAYMENT",
      entityType: "sales_invoice",
      entityId: invoiceId,
      beforeData: {
        paidAmount: Number(invoice.paidAmount),
        balanceDue: currentBalance,
        status: invoice.status,
      },
      afterData: {
        paymentId: payment.id,
        paymentAmount: paymentAmt,
        paidAmount: newPaidAmount,
        balanceDue: Math.max(0, newBalanceDue),
        status: newStatus,
      },
      requestId,
    });

    return { payment, invoice: updatedInvoice };
  });

  return {
    payment: {
      ...result.payment,
      amount: Number(result.payment.amount),
      currency: result.payment.currency.trim(),
    },
    invoice: {
      id: result.invoice.id,
      invoiceNo: result.invoice.invoiceNo,
      status: result.invoice.status,
      grandTotal: Number(result.invoice.grandTotal),
      paidAmount: Number(result.invoice.paidAmount),
      balanceDue: Number(result.invoice.balanceDue),
    },
    message: "Payment recorded and invoice balance updated successfully.",
  };
}
