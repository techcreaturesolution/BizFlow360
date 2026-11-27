// Sales Service: Catalogue, Quotations, Orders, Invoices & Payments with server-side math, atomic guards & 3-tier Record Scope.
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  approvalRequests,
  crmCustomers,
  departments,
  notifications,
  salesInvoiceItems,
  salesInvoicePayments,
  salesInvoices,
  salesOrderItems,
  salesOrders,
  salesProducts,
  salesQuotationItems,
  salesQuotations,
  tenants,
  users,
  workflowInstanceSteps,
} from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { Errors } from "../../lib/errors";
import {
  hasTenantWideScope,
  resolveRecordScope,
  type AuthContext,
  type RecordScopeContext,
} from "../../middlewares/guards";
import type {
  ApproveQuotationInput,
  ConvertQuotationOrderInput,
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
  SendQuotationInput,
  UpdateProductInput,
} from "./sales.model";

async function resolveSalesScope(auth: AuthContext, isOrder = false): Promise<RecordScopeContext> {
  if (hasTenantWideScope(auth, "SALES.QUOTATIONS.VIEW_ALL")) {
    return { scope: "COMPANY_WIDE", departmentIds: [], teamIds: [], teamUserIds: [] };
  }
  const teamPerm =
    isOrder && auth.permissions.includes("SALES.ORDERS.VIEW_TEAM")
      ? "SALES.ORDERS.VIEW_TEAM"
      : "SALES.QUOTATIONS.VIEW_TEAM";
  return resolveRecordScope(auth, "SALES.QUOTATIONS.VIEW_ALL", teamPerm);
}

function assertSalesRecordAccess(
  scopeCtx: RecordScopeContext,
  ownerUserId: string | null,
  createdBy: string | null,
  actorUserId: string,
  entityLabel: string,
) {
  if (scopeCtx.scope === "COMPANY_WIDE") return;

  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    const inTeam =
      (ownerUserId && scopeCtx.teamUserIds.includes(ownerUserId)) ||
      (createdBy && scopeCtx.teamUserIds.includes(createdBy));
    if (!inTeam) {
      throw Errors.forbidden(`You do not have access to this ${entityLabel} outside your sales team.`);
    }
    return;
  }

  if (ownerUserId !== actorUserId && createdBy !== actorUserId) {
    throw Errors.forbidden(`You do not have access to this ${entityLabel}.`);
  }
}

function applySalesOwnerFilter(
  scopeCtx: RecordScopeContext,
  auth: AuthContext,
  requestedOwnerId: string | undefined,
  ownerCol:
    | typeof salesQuotations.ownerUserId
    | typeof salesOrders.ownerUserId
    | typeof salesInvoices.ownerUserId,
  createdCol:
    | typeof salesQuotations.createdBy
    | typeof salesOrders.createdBy
    | typeof salesInvoices.createdBy,
) {
  if (scopeCtx.scope === "COMPANY_WIDE") {
    return requestedOwnerId ? [eq(ownerCol, requestedOwnerId)] : [];
  }

  if (scopeCtx.scope === "TEAM_DEPARTMENT") {
    if (requestedOwnerId) {
      if (!scopeCtx.teamUserIds.includes(requestedOwnerId)) {
        throw Errors.forbidden("Cannot view sales records outside your team.");
      }
      return [eq(ownerCol, requestedOwnerId)];
    }
    return [or(inArray(ownerCol, scopeCtx.teamUserIds), inArray(createdCol, scopeCtx.teamUserIds))!];
  }

  if (requestedOwnerId && requestedOwnerId !== auth.userId) {
    throw Errors.forbidden("You can only view your own assigned sales records.");
  }
  return [or(eq(ownerCol, auth.userId), eq(createdCol, auth.userId))!];
}

// Server-side line item calculation engine (Strict Rule #2: never trust frontend totals)
function computeOrderTotals(items: LineItemInput[]) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  const computedItems = items.map((item) => {
    const productId = item.productId ?? item.product_id ?? null;
    const rawUnitPrice = item.unitPrice ?? item.unit_price ?? 0;
    const rawDiscount = item.discountAmount ?? item.discount_amount ?? 0;
    const rawTaxRate = item.taxRate ?? item.tax_rate ?? 18;

    const gross = Number((item.quantity * rawUnitPrice).toFixed(2));
    const discount = Math.min(gross, Math.max(0, Number(rawDiscount.toFixed(2))));
    const netSubtotal = Number((gross - discount).toFixed(2));
    const taxAmount = Number(((netSubtotal * rawTaxRate) / 100).toFixed(2));
    const lineTotal = Number((netSubtotal + taxAmount).toFixed(2));

    subtotal = Number((subtotal + gross).toFixed(2));
    discountTotal = Number((discountTotal + discount).toFixed(2));
    taxTotal = Number((taxTotal + taxAmount).toFixed(2));
    grandTotal = Number((grandTotal + lineTotal).toFixed(2));

    return {
      productId,
      description: item.description,
      quantity: item.quantity.toFixed(2),
      unitPrice: rawUnitPrice.toFixed(2),
      discountAmount: discount.toFixed(2),
      taxRate: rawTaxRate.toFixed(2),
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

async function assertLineItemProductsExist(tenantId: string, items: LineItemInput[]) {
  const productIds = Array.from(
    new Set(items.map((it) => it.productId ?? it.product_id).filter(Boolean) as string[]),
  );
  if (productIds.length === 0) return;

  const found = await db
    .select({ id: salesProducts.id })
    .from(salesProducts)
    .where(and(eq(salesProducts.tenantId, tenantId), inArray(salesProducts.id, productIds)));

  if (found.length !== productIds.length) {
    throw Errors.badRequest("One or more referenced products do not exist in your company catalogue.");
  }
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
    .select({ id: crmCustomers.id, name: crmCustomers.name, email: crmCustomers.email })
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
  const itemType = query.itemType ?? query.item_type;
  const activeFilter =
    query.isActive !== undefined
      ? query.isActive
      : query.status !== undefined
        ? query.status === "ACTIVE"
        : undefined;

  if (itemType) conditions.push(eq(salesProducts.itemType, itemType));
  if (activeFilter !== undefined) conditions.push(eq(salesProducts.isActive, activeFilter));
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
      status: p.isActive ? "ACTIVE" : "INACTIVE",
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

  const itemType = input.itemType ?? input.item_type ?? "PRODUCT";
  const purchasePrice = input.purchasePrice ?? input.purchase_price ?? 0;
  const sellingPrice = (input.sellingPrice ?? input.selling_price)!;
  const taxRate = input.taxRate ?? input.tax_rate ?? 18;
  const trackInventory = input.trackInventory ?? input.track_inventory ?? false;
  const stockQuantity = input.stockQuantity ?? input.stock_quantity ?? 0;
  const isActive =
    input.isActive !== undefined
      ? input.isActive
      : input.status !== undefined
        ? input.status === "ACTIVE"
        : true;

  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(salesProducts)
      .values({
        tenantId,
        sku: input.sku,
        name: input.name,
        description: input.description ?? null,
        itemType,
        unit: input.unit,
        purchasePrice: purchasePrice.toFixed(2),
        sellingPrice: sellingPrice.toFixed(2),
        taxRate: taxRate.toFixed(2),
        trackInventory,
        stockQuantity: stockQuantity.toFixed(2),
        isActive,
        createdBy: auth.userId,
      })
      .returning();

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.PRODUCT.CREATE",
      entityType: "sales_product",
      entityId: rows[0].id,
      afterData: { sku: input.sku, name: input.name, sellingPrice },
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
      status: created.isActive ? "ACTIVE" : "INACTIVE",
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

  const itemType = input.itemType ?? input.item_type;
  const purchasePrice = input.purchasePrice ?? input.purchase_price;
  const sellingPrice = input.sellingPrice ?? input.selling_price;
  const taxRate = input.taxRate ?? input.tax_rate;
  const trackInventory = input.trackInventory ?? input.track_inventory;
  const stockQuantity = input.stockQuantity ?? input.stock_quantity;
  const isActive =
    input.isActive !== undefined
      ? input.isActive
      : input.status !== undefined
        ? input.status === "ACTIVE"
        : undefined;

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(salesProducts)
      .set({
        ...(input.sku !== undefined && { sku: input.sku }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(itemType !== undefined && { itemType }),
        ...(input.unit !== undefined && { unit: input.unit }),
        ...(purchasePrice !== undefined && { purchasePrice: purchasePrice.toFixed(2) }),
        ...(sellingPrice !== undefined && { sellingPrice: sellingPrice.toFixed(2) }),
        ...(taxRate !== undefined && { taxRate: taxRate.toFixed(2) }),
        ...(trackInventory !== undefined && { trackInventory }),
        ...(stockQuantity !== undefined && { stockQuantity: stockQuantity.toFixed(2) }),
        ...(isActive !== undefined && { isActive }),
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
      status: updated.isActive ? "ACTIVE" : "INACTIVE",
    },
  };
}

// ==========================================
// 2. QUOTATIONS
// ==========================================
export async function listQuotations(auth: AuthContext, query: QuotationsQuery) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveSalesScope(auth, false);
  const customerId = query.customerId ?? query.customer_id;
  const createdByFilter = query.createdBy ?? query.created_by;
  const requestedOwner = query.ownerUserId ?? query.owner_user_id;

  const conditions = [
    eq(salesQuotations.tenantId, tenantId),
    ...applySalesOwnerFilter(
      scopeCtx,
      auth,
      requestedOwner,
      salesQuotations.ownerUserId,
      salesQuotations.createdBy,
    ),
  ];

  if (query.status) conditions.push(eq(salesQuotations.status, query.status));
  if (customerId) conditions.push(eq(salesQuotations.customerId, customerId));
  if (createdByFilter) {
    if (scopeCtx.scope === "TEAM_DEPARTMENT" && !scopeCtx.teamUserIds.includes(createdByFilter)) {
      throw Errors.forbidden("Cannot filter quotations for a user outside your sales team.");
    }
    if (scopeCtx.scope === "OWN_ONLY" && createdByFilter !== auth.userId) {
      throw Errors.forbidden("You can only view your own quotations.");
    }
    conditions.push(eq(salesQuotations.createdBy, createdByFilter));
  }

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(salesQuotations).where(and(...conditions)),
    db
      .select({
        quotation: salesQuotations,
        customerName: crmCustomers.name,
        ownerName: users.fullName,
      })
      .from(salesQuotations)
      .leftJoin(crmCustomers, eq(crmCustomers.id, salesQuotations.customerId))
      .leftJoin(users, eq(users.id, salesQuotations.ownerUserId))
      .where(and(...conditions))
      .orderBy(desc(salesQuotations.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    scope: scopeCtx.scope,
    quotations: rows.map((r) => ({
      ...r.quotation,
      customerName: r.customerName ?? null,
      ownerName: r.ownerName ?? null,
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
  const customerId = (input.customerId ?? input.customer_id)!;
  const issueDate = (input.issueDate ?? input.issue_date)!;
  const validUntil = (input.validUntil ?? input.valid_until)!;

  const customer = await assertCustomerExists(tenantId, customerId);
  await assertLineItemProductsExist(tenantId, input.items);
  const currency = await getTenantCurrency(tenantId);

  const calc = computeOrderTotals(input.items);
  const quotationNo = `QTN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const initialStatus = input.submitForApproval ? "PENDING_APPROVAL" : "DRAFT";

  let departmentManagerId: string | null = null;
  if (input.submitForApproval && auth.departmentId) {
    const [dept] = await db
      .select({ managerUserId: departments.managerUserId })
      .from(departments)
      .where(and(eq(departments.id, auth.departmentId), eq(departments.tenantId, tenantId)))
      .limit(1);
    departmentManagerId = dept?.managerUserId ?? null;
  }

  const created = await db.transaction(async (tx) => {
    const [quotation] = await tx
      .insert(salesQuotations)
      .values({
        tenantId,
        quotationNo,
        customerId,
        ownerUserId: auth.userId,
        status: initialStatus,
        issueDate,
        validUntil,
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

    if (input.submitForApproval) {
      const [approval] = await tx
        .insert(approvalRequests)
        .values({
          tenantId,
          entityType: "QUOTATION",
          entityId: quotation.id,
          entityNumber: quotationNo,
          title: `Quotation ${quotationNo} for ${customer.name}`,
          amount: calc.grandTotal,
          currency,
          requestedBy: auth.userId,
          approverUserId: departmentManagerId,
          branchId: auth.branchId ?? null,
          departmentId: auth.departmentId ?? null,
          status: "PENDING",
          currentStage: "MANAGER_REVIEW",
        })
        .returning();

      await tx.insert(workflowInstanceSteps).values({
        tenantId,
        approvalRequestId: approval.id,
        stepNumber: 1,
        stepName: "QUOTATION_SUBMISSION",
        action: "SUBMITTED",
        actorUserId: auth.userId,
        comment: `Quotation ${quotationNo} submitted for approval`,
      });

      if (departmentManagerId && departmentManagerId !== auth.userId) {
        await tx.insert(notifications).values({
          tenantId,
          userId: departmentManagerId,
          category: "APPROVAL",
          title: "Quotation Approval Requested",
          message: `Quotation ${quotationNo} (${currency} ${calc.grandTotal}) requires your approval.`,
          entityType: "QUOTATION",
          entityId: quotation.id,
          actionUrl: `/sales/quotations/${quotation.id}`,
        });
      }
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.QUOTATION.CREATE",
      entityType: "sales_quotation",
      entityId: quotation.id,
      afterData: {
        quotationNo,
        status: initialStatus,
        grandTotal: Number(quotation.grandTotal),
        itemCount: insertedItems.length,
      },
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
  const scopeCtx = await resolveSalesScope(auth, false);

  const [row] = await db
    .select({
      quotation: salesQuotations,
      customerName: crmCustomers.name,
      customerEmail: crmCustomers.email,
      ownerName: users.fullName,
    })
    .from(salesQuotations)
    .leftJoin(crmCustomers, eq(crmCustomers.id, salesQuotations.customerId))
    .leftJoin(users, eq(users.id, salesQuotations.ownerUserId))
    .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)))
    .limit(1);

  if (!row) {
    throw Errors.notFound("Quotation not found.");
  }

  assertSalesRecordAccess(
    scopeCtx,
    row.quotation.ownerUserId,
    row.quotation.createdBy,
    auth.userId,
    "quotation",
  );

  const [items, linkedOrder] = await Promise.all([
    db.select().from(salesQuotationItems).where(eq(salesQuotationItems.quotationId, quotationId)),
    db
      .select({ id: salesOrders.id, orderNo: salesOrders.orderNo, status: salesOrders.status })
      .from(salesOrders)
      .where(and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.quotationId, quotationId)))
      .limit(1),
  ]);

  return {
    scope: scopeCtx.scope,
    quotation: {
      ...row.quotation,
      customerName: row.customerName ?? null,
      customerEmail: row.customerEmail ?? null,
      ownerName: row.ownerName ?? null,
      convertedOrder: linkedOrder[0] ?? null,
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
  input: ApproveQuotationInput = {},
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveSalesScope(auth, false);

  const [existing] = await db
    .select()
    .from(salesQuotations)
    .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)))
    .limit(1);

  if (!existing) throw Errors.notFound("Quotation not found.");

  assertSalesRecordAccess(scopeCtx, existing.ownerUserId, existing.createdBy, auth.userId, "quotation");

  if (existing.status === "CONVERTED") {
    throw Errors.conflict("Converted quotation cannot be re-approved.");
  }
  if (existing.status === "REJECTED") {
    throw Errors.conflict("Rejected quotation cannot be approved directly.");
  }

  const commentText = input.comment || input.reason || null;
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

    const [pendingApproval] = await tx
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.tenantId, tenantId),
          eq(approvalRequests.entityType, "QUOTATION"),
          eq(approvalRequests.entityId, quotationId),
          eq(approvalRequests.status, "PENDING"),
        ),
      )
      .limit(1);

    if (pendingApproval) {
      await tx
        .update(approvalRequests)
        .set({
          status: "APPROVED",
          currentStage: "COMPLETED",
          decisionComment: commentText,
          decidedBy: auth.userId,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(approvalRequests.id, pendingApproval.id));

      const [{ count: stepsCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowInstanceSteps)
        .where(eq(workflowInstanceSteps.approvalRequestId, pendingApproval.id));

      await tx.insert(workflowInstanceSteps).values({
        tenantId,
        approvalRequestId: pendingApproval.id,
        stepNumber: (stepsCount ?? 0) + 1,
        stepName: "SALES_MANAGER_APPROVAL",
        action: "APPROVED",
        actorUserId: auth.userId,
        comment: commentText,
        decidedAt: now,
      });
    }

    const notifyTarget = existing.ownerUserId ?? existing.createdBy;
    if (notifyTarget && notifyTarget !== auth.userId) {
      await tx.insert(notifications).values({
        tenantId,
        userId: notifyTarget,
        category: "SALES",
        title: "Quotation Approved",
        message: `Quotation ${existing.quotationNo} has been approved.${commentText ? ` Note: ${commentText}` : ""}`,
        entityType: "QUOTATION",
        entityId: quotationId,
        actionUrl: `/sales/quotations/${quotationId}`,
      });
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.QUOTATION.APPROVE",
      entityType: "sales_quotation",
      entityId: quotationId,
      beforeData: { status: existing.status },
      afterData: { status: "APPROVED", approvedBy: auth.userId, comment: commentText },
      reason: commentText ?? undefined,
      requestId,
    });

    return rows;
  });

  return {
    quotation: {
      ...updated,
      subtotal: Number(updated.subtotal),
      discountTotal: Number(updated.discountTotal),
      taxTotal: Number(updated.taxTotal),
      grandTotal: Number(updated.grandTotal),
      currency: updated.currency.trim(),
    },
    message: "Quotation approved successfully.",
  };
}

export async function sendQuotation(
  auth: AuthContext,
  quotationId: string,
  input: Partial<SendQuotationInput> = {},
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveSalesScope(auth, false);

  const [row] = await db
    .select({
      quotation: salesQuotations,
      customerEmail: crmCustomers.email,
      customerName: crmCustomers.name,
    })
    .from(salesQuotations)
    .leftJoin(crmCustomers, eq(crmCustomers.id, salesQuotations.customerId))
    .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)))
    .limit(1);

  if (!row) throw Errors.notFound("Quotation not found.");

  const existing = row.quotation;
  assertSalesRecordAccess(scopeCtx, existing.ownerUserId, existing.createdBy, auth.userId, "quotation");

  if (existing.status === "REJECTED") {
    throw Errors.badRequest("Rejected quotation cannot be sent to customer.");
  }

  const recipientEmail = input.recipientEmail ?? input.recipient_email ?? row.customerEmail ?? null;
  const deliveryChannel = input.deliveryChannel ?? input.delivery_channel ?? "EMAIL";
  const now = new Date();

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(salesQuotations)
      .set({
        status: existing.status === "CONVERTED" ? "CONVERTED" : "SENT",
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
      afterData: {
        status: rows[0].status,
        sentAt: now.toISOString(),
        recipientEmail,
        deliveryChannel,
      },
      requestId,
    });

    return rows;
  });

  return {
    quotation: {
      ...updated,
      subtotal: Number(updated.subtotal),
      discountTotal: Number(updated.discountTotal),
      taxTotal: Number(updated.taxTotal),
      grandTotal: Number(updated.grandTotal),
      currency: updated.currency.trim(),
    },
    delivery: {
      deliveryChannel,
      recipientEmail,
      generatedPdfFileName: `${existing.quotationNo}.pdf`,
      sentAt: now.toISOString(),
    },
    message: "Quotation marked as sent to customer.",
  };
}

// Strict Rule #3 (QA-012): Atomic duplicate order conversion prevention
export async function convertQuotationToOrder(
  auth: AuthContext,
  quotationId: string,
  input: ConvertQuotationOrderInput = {},
  requestId?: string,
) {
  const tenantId = auth.tenantId!;
  const scopeCtx = await resolveSalesScope(auth, false);

  const [precheck] = await db
    .select()
    .from(salesQuotations)
    .where(and(eq(salesQuotations.id, quotationId), eq(salesQuotations.tenantId, tenantId)))
    .limit(1);

  if (!precheck) throw Errors.notFound("Quotation not found.");
  assertSalesRecordAccess(scopeCtx, precheck.ownerUserId, precheck.createdBy, auth.userId, "quotation");

  if (precheck.status === "REJECTED") {
    throw Errors.badRequest("Rejected quotation cannot be converted to a Sales Order.");
  }
  if (precheck.status === "CONVERTED") {
    throw Errors.conflict("Quotation has already been converted to an order.");
  }

  const orderDate = input.orderDate ?? input.order_date ?? new Date().toISOString().slice(0, 10);
  const orderNo = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const created = await db.transaction(async (tx) => {
    const [existingOrder] = await tx
      .select({ id: salesOrders.id, orderNo: salesOrders.orderNo })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.tenantId, tenantId),
          eq(salesOrders.quotationId, quotationId),
          ne(salesOrders.status, "CANCELLED"),
        ),
      )
      .limit(1);

    if (existingOrder) {
      throw Errors.conflict(
        `Duplicate conversion blocked: Sales Order ${existingOrder.orderNo} already exists for this quotation.`,
      );
    }

    // Atomic compare-and-set transition on quotation status inside transaction
    const [lockedQuotation] = await tx
      .update(salesQuotations)
      .set({ status: "CONVERTED", updatedAt: new Date() })
      .where(
        and(
          eq(salesQuotations.id, quotationId),
          eq(salesQuotations.tenantId, tenantId),
          ne(salesQuotations.status, "CONVERTED"),
        ),
      )
      .returning();

    if (!lockedQuotation) {
      throw Errors.conflict("Quotation has already been converted to an order.");
    }

    const qItems = await tx
      .select()
      .from(salesQuotationItems)
      .where(eq(salesQuotationItems.quotationId, quotationId));

    const [order] = await tx
      .insert(salesOrders)
      .values({
        tenantId,
        orderNo,
        customerId: lockedQuotation.customerId,
        quotationId: lockedQuotation.id,
        ownerUserId: lockedQuotation.ownerUserId ?? auth.userId,
        status: "CONFIRMED",
        orderDate,
        currency: lockedQuotation.currency.trim(),
        subtotal: lockedQuotation.subtotal,
        discountTotal: lockedQuotation.discountTotal,
        taxTotal: lockedQuotation.taxTotal,
        grandTotal: lockedQuotation.grandTotal,
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

    const notifyTarget = lockedQuotation.ownerUserId ?? lockedQuotation.createdBy;
    if (notifyTarget && notifyTarget !== auth.userId) {
      await tx.insert(notifications).values({
        tenantId,
        userId: notifyTarget,
        category: "SALES",
        title: "Quotation Converted to Order",
        message: `Quotation ${lockedQuotation.quotationNo} was converted to Sales Order ${orderNo}.`,
        entityType: "SALES_ORDER",
        entityId: order.id,
        actionUrl: `/sales/orders/${order.id}`,
      });
    }

    await writeAudit(tx, {
      tenantId,
      actorUserId: auth.userId,
      action: "SALES.QUOTATION.CONVERT_ORDER",
      entityType: "sales_order",
      entityId: order.id,
      afterData: {
        quotationId,
        orderNo,
        grandTotal: Number(order.grandTotal),
        notes: input.notes ?? null,
      },
      requestId,
    });

    return order;
  });

  return {
    order: {
      ...created,
      subtotal: Number(created.subtotal),
      discountTotal: Number(created.discountTotal),
      taxTotal: Number(created.taxTotal),
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
  const scopeCtx = await resolveSalesScope(auth, true);
  const customerId = query.customerId ?? query.customer_id;
  const requestedOwner = query.ownerUserId ?? query.owner_user_id;

  const conditions = [
    eq(salesOrders.tenantId, tenantId),
    ...applySalesOwnerFilter(
      scopeCtx,
      auth,
      requestedOwner,
      salesOrders.ownerUserId,
      salesOrders.createdBy,
    ),
  ];

  if (query.status) conditions.push(eq(salesOrders.status, query.status));
  if (customerId) conditions.push(eq(salesOrders.customerId, customerId));

  const offset = (query.page - 1) * query.limit;

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(salesOrders).where(and(...conditions)),
    db
      .select({
        order: salesOrders,
        customerName: crmCustomers.name,
        ownerName: users.fullName,
      })
      .from(salesOrders)
      .leftJoin(crmCustomers, eq(crmCustomers.id, salesOrders.customerId))
      .leftJoin(users, eq(users.id, salesOrders.ownerUserId))
      .where(and(...conditions))
      .orderBy(desc(salesOrders.createdAt))
      .limit(query.limit)
      .offset(offset),
  ]);

  const total = totalRow?.count ?? 0;

  return {
    scope: scopeCtx.scope,
    orders: rows.map((r) => ({
      ...r.order,
      customerName: r.customerName ?? null,
      ownerName: r.ownerName ?? null,
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
  const customerId = (input.customerId ?? input.customer_id)!;
  const quotationId = input.quotationId ?? input.quotation_id ?? null;
  const orderDate = (input.orderDate ?? input.order_date)!;

  await assertCustomerExists(tenantId, customerId);
  const currency = await getTenantCurrency(tenantId);

  let itemsToUse: LineItemInput[] = input.items ?? [];

  if (quotationId && itemsToUse.length === 0) {
    const qItems = await db
      .select()
      .from(salesQuotationItems)
      .where(
        and(
          eq(salesQuotationItems.quotationId, quotationId),
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

  await assertLineItemProductsExist(tenantId, itemsToUse);
  const calc = computeOrderTotals(itemsToUse);
  const orderNo = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const created = await db.transaction(async (tx) => {
    if (quotationId) {
      const [existingOrder] = await tx
        .select({ id: salesOrders.id, orderNo: salesOrders.orderNo })
        .from(salesOrders)
        .where(
          and(
            eq(salesOrders.tenantId, tenantId),
            eq(salesOrders.quotationId, quotationId),
            ne(salesOrders.status, "CANCELLED"),
          ),
        )
        .limit(1);

      if (existingOrder) {
        throw Errors.conflict(
          `Duplicate conversion blocked: Sales Order ${existingOrder.orderNo} already exists for this quotation.`,
        );
      }

      const [updatedQuotation] = await tx
        .update(salesQuotations)
        .set({ status: "CONVERTED", updatedAt: new Date() })
        .where(
          and(
            eq(salesQuotations.id, quotationId),
            eq(salesQuotations.tenantId, tenantId),
            ne(salesQuotations.status, "CONVERTED"),
          ),
        )
        .returning();

      if (!updatedQuotation) {
        throw Errors.conflict("Referenced quotation has already been converted.");
      }
    }

    const [order] = await tx
      .insert(salesOrders)
      .values({
        tenantId,
        orderNo,
        customerId,
        quotationId,
        ownerUserId: auth.userId,
        status: "CONFIRMED",
        orderDate,
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
      subtotal: Number(created.order.subtotal),
      discountTotal: Number(created.order.discountTotal),
      taxTotal: Number(created.order.taxTotal),
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
  const scopeCtx = await resolveSalesScope(auth, false);
  const conditions = [
    eq(salesInvoices.tenantId, tenantId),
    ...applySalesOwnerFilter(
      scopeCtx,
      auth,
      undefined,
      salesInvoices.ownerUserId,
      salesInvoices.createdBy,
    ),
  ];

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
    scope: scopeCtx.scope,
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

  await assertLineItemProductsExist(tenantId, itemsToUse);
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
  const scopeCtx = await resolveSalesScope(auth, false);

  const [row] = await db
    .select({ invoice: salesInvoices, customerName: crmCustomers.name })
    .from(salesInvoices)
    .leftJoin(crmCustomers, eq(crmCustomers.id, salesInvoices.customerId))
    .where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.tenantId, tenantId)))
    .limit(1);

  if (!row) throw Errors.notFound("Invoice not found.");

  assertSalesRecordAccess(scopeCtx, row.invoice.ownerUserId, row.invoice.createdBy, auth.userId, "invoice");

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

// Record Invoice Payment (Server-side balance & status calculation + Transaction & Audit)
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
