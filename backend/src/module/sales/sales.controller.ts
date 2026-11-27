// Sales Controller: Products, Quotations, Orders, Invoices & Payments.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  createOrderSchema,
  createProductSchema,
  createQuotationSchema,
  createSalesInvoiceSchema,
  ordersQuerySchema,
  productsQuerySchema,
  quotationsQuerySchema,
  recordPaymentSchema,
  salesInvoicesQuerySchema,
  updateProductSchema,
} from "./sales.model";
import {
  approveQuotation,
  convertQuotationToOrder,
  createOrder,
  createProduct,
  createQuotation,
  createSalesInvoice,
  getQuotationDetail,
  getSalesInvoiceDetail,
  listOrders,
  listProducts,
  listQuotations,
  listSalesInvoices,
  recordInvoicePayment,
  sendQuotation,
  updateProduct,
} from "./sales.service";

function requireAuthTenant(req: Parameters<RequestHandler>[0]) {
  if (!req.auth || !req.auth.tenantId) {
    throw Errors.forbidden("Operation requires an active authenticated tenant workspace.");
  }
  return req.auth;
}

export const listProductsHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = productsQuerySchema.parse(req.query);
  const result = await listProducts(auth.tenantId!, query);
  return sendSuccess(res, result);
};

export const createProductHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = createProductSchema.parse(req.body);
  const result = await createProduct(auth, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const updateProductHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = updateProductSchema.parse(req.body);
  const result = await updateProduct(auth, req.params.id as string, input, req.requestId);
  return sendSuccess(res, result);
};

export const listQuotationsHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = quotationsQuerySchema.parse(req.query);
  const result = await listQuotations(auth, query);
  return sendSuccess(res, result);
};

export const createQuotationHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = createQuotationSchema.parse(req.body);
  const result = await createQuotation(auth, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const getQuotationDetailHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await getQuotationDetail(auth, req.params.id as string);
  return sendSuccess(res, result);
};

export const approveQuotationHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await approveQuotation(auth, req.params.id as string, req.requestId);
  return sendSuccess(res, result);
};

export const sendQuotationHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await sendQuotation(auth, req.params.id as string, req.requestId);
  return sendSuccess(res, result);
};

export const convertQuotationToOrderHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await convertQuotationToOrder(auth, req.params.id as string, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const listOrdersHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = ordersQuerySchema.parse(req.query);
  const result = await listOrders(auth, query);
  return sendSuccess(res, result);
};

export const createOrderHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = createOrderSchema.parse(req.body);
  const result = await createOrder(auth, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const listSalesInvoicesHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = salesInvoicesQuerySchema.parse(req.query);
  const result = await listSalesInvoices(auth, query);
  return sendSuccess(res, result);
};

export const createSalesInvoiceHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = createSalesInvoiceSchema.parse(req.body);
  const result = await createSalesInvoice(auth, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const getSalesInvoiceDetailHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await getSalesInvoiceDetail(auth, req.params.id as string);
  return sendSuccess(res, result);
};

export const recordInvoicePaymentHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = recordPaymentSchema.parse(req.body);
  const result = await recordInvoicePayment(auth, req.params.id as string, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};
