// Organization & Company Setup Controller: Company Profile, Branches, Departments, Teams.
import type { RequestHandler } from "express";
import { Errors } from "../../lib/errors";
import { sendSuccess } from "../../lib/response";
import {
  createBranchSchema,
  createDepartmentSchema,
  createTeamSchema,
  orgQuerySchema,
  updateBranchSchema,
  updateCompanySchema,
  updateDepartmentSchema,
  updateTeamSchema,
} from "./companySetup.model";
import {
  createBranch,
  createDepartment,
  createTeam,
  getCompanyProfile,
  listBranches,
  listDepartments,
  listTeams,
  updateBranch,
  updateCompanyProfile,
  updateDepartment,
  updateTeam,
} from "./companySetup.service";

function requireTenantId(req: Parameters<RequestHandler>[0]): string {
  const tenantId = req.auth?.tenantId;
  if (!tenantId) {
    throw Errors.forbidden("Operation requires an active tenant workspace context.");
  }
  return tenantId;
}

function requireUserId(req: Parameters<RequestHandler>[0]): string {
  const userId = req.auth?.userId;
  if (!userId) {
    throw Errors.unauthorized("Authentication required.");
  }
  return userId;
}

// 1. Company Profile
export const getCompanyProfileHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const company = await getCompanyProfile(tenantId);
  return sendSuccess(res, { company });
};

export const updateCompanyProfileHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = updateCompanySchema.parse(req.body);
  const company = await updateCompanyProfile(tenantId, actorUserId, input, req.requestId);
  return sendSuccess(res, { company });
};

// 2. Branches
export const listBranchesHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const query = orgQuerySchema.parse(req.query);
  const result = await listBranches(tenantId, query);
  return sendSuccess(res, result);
};

export const createBranchHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = createBranchSchema.parse(req.body);
  const result = await createBranch(tenantId, actorUserId, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const updateBranchHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = updateBranchSchema.parse(req.body);
  const branchId = (req.params.id as string | undefined) ?? input.id;
  if (!branchId) {
    throw Errors.badRequest("Branch ID is required (either in URL path or request body).");
  }
  const result = await updateBranch(tenantId, actorUserId, branchId, input, req.requestId);
  return sendSuccess(res, result);
};

// 3. Departments
export const listDepartmentsHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const query = orgQuerySchema.parse(req.query);
  const result = await listDepartments(tenantId, query);
  return sendSuccess(res, result);
};

export const createDepartmentHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = createDepartmentSchema.parse(req.body);
  const result = await createDepartment(tenantId, actorUserId, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const updateDepartmentHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = updateDepartmentSchema.parse(req.body);
  const departmentId = (req.params.id as string | undefined) ?? input.id;
  if (!departmentId) {
    throw Errors.badRequest("Department ID is required (either in URL path or request body).");
  }
  const result = await updateDepartment(tenantId, actorUserId, departmentId, input, req.requestId);
  return sendSuccess(res, result);
};

// 4. Teams
export const listTeamsHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const query = orgQuerySchema.parse(req.query);
  const result = await listTeams(tenantId, query);
  return sendSuccess(res, result);
};

export const createTeamHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const input = createTeamSchema.parse(req.body);
  const result = await createTeam(tenantId, actorUserId, input, req.requestId);
  return sendSuccess(res, result, { status: 201 });
};

export const updateTeamHandler: RequestHandler = async (req, res) => {
  const tenantId = requireTenantId(req);
  const actorUserId = requireUserId(req);
  const teamId = req.params.id as string;
  const input = updateTeamSchema.parse(req.body);
  const result = await updateTeam(tenantId, actorUserId, teamId, input, req.requestId);
  return sendSuccess(res, result);
};
