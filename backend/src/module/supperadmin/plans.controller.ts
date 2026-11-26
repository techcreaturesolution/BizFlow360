// Plans controller: Super Admin Plan Editor endpoints.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  planIdParamSchema,
  planListQuerySchema,
  updatePlanStatusSchema,
  upsertPlanSchema,
} from "./plans.model";
import {
  createPlan,
  getPlanById,
  listPlans,
  updatePlan,
  updatePlanStatus,
} from "./plans.service";

function requireActorId(userId?: string): string {
  if (!userId) throw Errors.unauthorized("Login required");
  return userId;
}

export const listPlansHandler: RequestHandler = async (req, res) => {
  const query = planListQuerySchema.parse(req.query);
  const { items, meta } = await listPlans(query);
  return sendSuccess(res, items, { meta });
};

export const createPlanHandler: RequestHandler = async (req, res) => {
  const actorId = requireActorId(req.auth?.userId);
  const input = upsertPlanSchema.parse(req.body);
  const created = await createPlan(input, actorId, req.requestId);
  return sendSuccess(res, created, { status: 201 });
};

export const getPlanDetailHandler: RequestHandler = async (req, res) => {
  const planId = planIdParamSchema.parse(req.params.id);
  const plan = await getPlanById(planId);
  return sendSuccess(res, plan);
};

export const updatePlanHandler: RequestHandler = async (req, res) => {
  const actorId = requireActorId(req.auth?.userId);
  const planId = planIdParamSchema.parse(req.params.id);
  const input = upsertPlanSchema.parse(req.body);
  const updated = await updatePlan(planId, input, actorId, req.requestId);
  return sendSuccess(res, updated);
};

export const updatePlanStatusHandler: RequestHandler = async (req, res) => {
  const actorId = requireActorId(req.auth?.userId);
  const planId = planIdParamSchema.parse(req.params.id);
  const input = updatePlanStatusSchema.parse(req.body);
  const updated = await updatePlanStatus(planId, input, actorId, req.requestId);
  return sendSuccess(res, updated);
};
