// Dashboard & Reports schema: saved widget layouts and async report export jobs.
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export interface DashboardWidgetConfig {
  widgetId: string;
  type: string; // e.g., "REVENUE_KPI", "SALES_PIPELINE", "DUE_INVOICES", "EXPENSES_CHART", "TASKS_SUMMARY"
  title: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  isVisible: boolean;
  settings?: Record<string, unknown>;
}

export const EXPORT_FORMATS = ["CSV", "XLSX", "PDF"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_REPORT_TYPES = [
  "DASHBOARD_SUMMARY",
  "SALES",
  "FINANCE",
  "HR",
  "PROJECTS",
  "TEAM",
  "AUDIT_LOGS",
] as const;
export type ExportReportType = (typeof EXPORT_REPORT_TYPES)[number];

export const EXPORT_JOB_STATUSES = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"] as const;
export type ExportJobStatus = (typeof EXPORT_JOB_STATUSES)[number];

export const dashboardWidgets = pgTable(
  "dashboard_widgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    layoutName: varchar("layout_name", { length: 100 }).notNull().default("default"),
    widgets: jsonb("widgets").$type<DashboardWidgetConfig[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("dashboard_widgets_tenant_user_layout_uidx").on(
      table.tenantId,
      table.userId,
      table.layoutName,
    ),
    index("dashboard_widgets_tenant_id_idx").on(table.tenantId),
  ],
);

export const reportExportJobs = pgTable(
  "report_export_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportType: varchar("report_type", { length: 50 }).$type<ExportReportType>().notNull(),
    format: varchar("format", { length: 10 }).$type<ExportFormat>().notNull(),
    filters: jsonb("filters").$type<Record<string, unknown>>(),
    status: varchar("status", { length: 20 }).$type<ExportJobStatus>().notNull().default("QUEUED"),
    fileName: varchar("file_name", { length: 255 }),
    fileUrl: text("file_url"),
    errorMessage: text("error_message"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("report_export_jobs_tenant_id_idx").on(table.tenantId),
    index("report_export_jobs_requested_by_idx").on(table.requestedBy),
  ],
);
