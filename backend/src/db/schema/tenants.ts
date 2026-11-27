// Tenants table: company core record, profile settings, status lifecycle aur plan assignment.
import { char, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const TENANT_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "GRACE",
  "SUSPENDED",
  "CANCELLED",
  "ARCHIVED",
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const tenantStatusEnum = pgEnum("tenant_status", TENANT_STATUSES);

export interface CompanyAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface NumberingPreferences {
  invoicePrefix?: string;
  quotationPrefix?: string;
  orderPrefix?: string;
  purchaseOrderPrefix?: string;
  nextInvoiceNumber?: number;
  resetAnnually?: boolean;
}

export interface ModulePreferences {
  enableMultiBranch?: boolean;
  enableTaxCalculation?: boolean;
  defaultTaxRate?: number;
  dateFormat?: string;
  [key: string]: unknown;
}

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  legalName: varchar("legal_name", { length: 255 }),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  logoUrl: text("logo_url"),
  logoDocumentId: uuid("logo_document_id"),
  address: jsonb("address").$type<CompanyAddress>(),
  taxId: varchar("tax_id", { length: 100 }),
  locale: varchar("locale", { length: 20 }).notNull().default("en-IN"),
  status: tenantStatusEnum("status").notNull().default("TRIAL"),
  timezone: varchar("timezone", { length: 80 }).notNull().default("Asia/Kolkata"),
  defaultCurrency: char("default_currency", { length: 3 }).notNull().default("INR"),
  financialYear: varchar("financial_year", { length: 50 }).notNull().default("APR-MAR"),
  dateFormat: varchar("date_format", { length: 30 }).notNull().default("DD/MM/YYYY"),
  numberingPreferences: jsonb("numbering_preferences").$type<NumberingPreferences>(),
  modulePreferences: jsonb("module_preferences").$type<ModulePreferences>(),
  expenseApprovalThreshold: numeric("expense_approval_threshold", { precision: 14, scale: 2 })
    .notNull()
    .default("5000.00"),
  planId: uuid("plan_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
