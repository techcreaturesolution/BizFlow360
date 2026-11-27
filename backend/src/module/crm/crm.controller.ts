// CRM Controller: Leads, Activities, Followups, Pipeline, and Customers.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  assignLeadSchema,
  convertLeadSchema,
  createCustomerSchema,
  createLeadActivitySchema,
  createLeadFollowupSchema,
  createLeadSchema,
  customersQuerySchema,
  leadsQuerySchema,
  updateFollowupSchema,
  updateLeadSchema,
} from "./crm.model";
import {
  addLeadActivity,
  addLeadFollowup,
  assignLead,
  convertLeadToCustomer,
  createCustomer,
  createLead,
  getCrmPipeline,
  getCustomerDetail,
  getLeadDetail,
  listCustomers,
  listLeads,
  updateFollowup,
  updateLead,
} from "./crm.service";

function requireAuthTenant(req: Parameters<RequestHandler>[0]) {
  if (!req.auth || !req.auth.tenantId) {
    throw Errors.forbidden("Operation requires an active authenticated tenant workspace.");
  }
  return req.auth;
}

export const listLeadsHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = leadsQuerySchema.parse(req.query);
  const result = await listLeads(auth, query);
  return sendSuccess(res, result);
};

export const createLeadHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = createLeadSchema.parse(req.body);
  const result = await createLead(auth, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const getLeadDetailHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await getLeadDetail(auth, req.params.id as string);
  return sendSuccess(res, result);
};

export const updateLeadHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = updateLeadSchema.parse(req.body);
  const result = await updateLead(auth, req.params.id as string, input, req.requestId);
  return sendSuccess(res, result);
};

export const assignLeadHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = assignLeadSchema.parse(req.body);
  const result = await assignLead(auth, req.params.id as string, input, req.requestId);
  return sendSuccess(res, result);
};

export const addLeadActivityHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = createLeadActivitySchema.parse(req.body);
  const result = await addLeadActivity(auth, req.params.id as string, input);
  return sendSuccess(res, result, { status: 201 });
};

export const addLeadFollowupHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = createLeadFollowupSchema.parse(req.body);
  const result = await addLeadFollowup(auth, req.params.id as string, input);
  return sendSuccess(res, result, { status: 201 });
};

export const updateFollowupHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = updateFollowupSchema.parse(req.body);
  const result = await updateFollowup(auth, req.params.id as string, input);
  return sendSuccess(res, result);
};

export const convertLeadHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = convertLeadSchema.parse(req.body ?? {});
  const result = await convertLeadToCustomer(auth, req.params.id as string, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const getCrmPipelineHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await getCrmPipeline(auth);
  return sendSuccess(res, result);
};

export const listCustomersHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = customersQuerySchema.parse(req.query);
  const result = await listCustomers(auth, query);
  return sendSuccess(res, result);
};

export const createCustomerHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = createCustomerSchema.parse(req.body);
  const result = await createCustomer(auth, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const getCustomerDetailHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await getCustomerDetail(auth, req.params.id as string);
  return sendSuccess(res, result);
};
