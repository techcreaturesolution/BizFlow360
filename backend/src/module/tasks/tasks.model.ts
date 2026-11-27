// Tasks Module validation schemas.
import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../db/schema";

export const tasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeUserId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(TASK_STATUSES).default("TODO"),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  assigneeUserId: z.string().uuid().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  relatedEntityType: z.string().trim().max(50).optional(),
  relatedEntityId: z.string().uuid().optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const assignTaskSchema = z.object({
  assigneeUserId: z.string().uuid("Valid Assignee User ID dalein"),
});

export const addTaskCommentSchema = z.object({
  comment: z.string().trim().min(1, "Comment khali nahi ho sakta").max(2000),
});

export type TasksQuery = z.infer<typeof tasksQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type AddTaskCommentInput = z.infer<typeof addTaskCommentSchema>;
