// Dashboard & Reports validation schemas (Overview KPIs, Module Analytics, Async Exports, Saved Widgets).
import { z } from "zod";
import { EXPORT_FORMATS, EXPORT_REPORT_TYPES } from "../../db/schema";

const periodField = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(["TODAY", "7D", "30D", "90D", "YTD", "CUSTOM"]))
  .default("30D");

export const dashboardSummaryQuerySchema = z.object({
  period: periodField,
  from: z.string().optional(),
  to: z.string().optional(),
  branch_id: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  owner_user_id: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  status: z.string().trim().optional(),
});

export const analyticsQuerySchema = z.object({
  period: periodField,
  from: z.string().optional(),
  to: z.string().optional(),
  branch_id: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  owner_user_id: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
});

export const exportReportSchema = z.object({
  reportType: z.enum(EXPORT_REPORT_TYPES),
  format: z.enum(EXPORT_FORMATS),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const widgetConfigSchema = z.object({
  widgetId: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(12),
  }),
  isVisible: z.boolean().default(true),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const saveWidgetsSchema = z.object({
  layoutName: z.string().trim().min(1).max(100).default("default"),
  widgets: z.array(widgetConfigSchema).min(1, "Kam se kam 1 widget configure karein"),
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type ExportReportInput = z.infer<typeof exportReportSchema>;
export type SaveWidgetsInput = z.infer<typeof saveWidgetsSchema>;
