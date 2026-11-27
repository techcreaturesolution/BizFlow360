// Business Owner Team & RBAC models and validation schemas.
import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .pipe(z.email("Valid email address dalein"));

export const teamMembersQuerySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "INVITED", "SUSPENDED"]).optional(),
  roleId: z.string().uuid().optional(),
  role_id: z.string().uuid().optional(),
  branch: z.string().trim().optional(),
  branch_id: z.string().trim().optional(),
  department: z.string().trim().optional(),
  department_id: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const inviteMemberSchema = z.object({
  email: emailField,
  fullName: z
    .string()
    .trim()
    .min(2, "Full Name kam se kam 2 characters ka hona chahiye")
    .max(100, "Full Name bahut lamba hai"),
  roleId: z.string().uuid("Valid Role ID (UUID) dalein").optional(),
  roleIds: z.array(z.string().uuid("Valid Role ID (UUID) dalein")).optional(),
  branchId: z.string().trim().max(100).optional(),
  departmentId: z.string().trim().max(100).optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
  reason: z.string().trim().max(500).optional(),
});

export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Role name kam se kam 2 characters ka hona chahiye")
    .max(50, "Role name bahut lamba hai")
    .regex(/^[A-Za-z0-9_ -]+$/, "Role name me valid characters dalein"),
  description: z.string().trim().max(250).optional(),
  permissionIds: z.array(z.string().min(1)).optional(),
});

export const assignRolePermissionsSchema = z.object({
  permissionIds: z
    .array(z.string().min(1))
    .min(1, "Kam se kam 1 permission select karein"),
});

export const assignUserRolesSchema = z.object({
  roleIds: z
    .array(z.string().uuid("Valid Role ID (UUID) dalein"))
    .min(1, "Kam se kam 1 role select karein"),
});

export const updateRoleSchema = createRoleSchema
  .partial()
  .refine((d) => d.name !== undefined || d.description !== undefined, {
    message: "Kam se kam role name ya description dalein",
  });

export type TeamMembersQuery = z.infer<typeof teamMembersQuerySchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type AssignRolePermissionsInput = z.infer<typeof assignRolePermissionsSchema>;
export type AssignUserRolesInput = z.infer<typeof assignUserRolesSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
