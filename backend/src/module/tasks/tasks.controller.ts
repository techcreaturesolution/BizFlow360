// Tasks Controller.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  addTaskCommentSchema,
  assignTaskSchema,
  createTaskSchema,
  tasksQuerySchema,
  updateTaskSchema,
} from "./tasks.model";
import {
  addTaskComment,
  assignTask,
  createTask,
  getTaskDetail,
  listTasks,
  updateTask,
} from "./tasks.service";

function requireAuthTenant(req: Parameters<RequestHandler>[0]) {
  if (!req.auth || !req.auth.tenantId) {
    throw Errors.forbidden("Operation requires an active authenticated tenant workspace.");
  }
  return req.auth;
}

export const listTasksHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = tasksQuerySchema.parse(req.query);
  const result = await listTasks(auth, query, false);
  return sendSuccess(res, result);
};

export const listMyTasksHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const query = tasksQuerySchema.parse(req.query);
  const result = await listTasks(auth, query, true);
  return sendSuccess(res, result);
};

export const createTaskHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = createTaskSchema.parse(req.body);
  const result = await createTask(auth, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const getTaskDetailHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const result = await getTaskDetail(auth, req.params.id as string);
  return sendSuccess(res, result);
};

export const updateTaskHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = updateTaskSchema.parse(req.body);
  const result = await updateTask(auth, req.params.id as string, input, req.requestId);
  return sendSuccess(res, result);
};

export const assignTaskHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = assignTaskSchema.parse(req.body);
  const result = await assignTask(auth, req.params.id as string, input, req.requestId);
  return sendSuccess(res, result);
};

export const addTaskCommentHandler: RequestHandler = async (req, res) => {
  const auth = requireAuthTenant(req);
  const input = addTaskCommentSchema.parse(req.body);
  const result = await addTaskComment(auth, req.params.id as string, input);
  return sendSuccess(res, result, { status: 201 });
};
