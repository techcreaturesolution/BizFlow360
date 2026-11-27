export type TenantStatus =
  | "TRIAL"
  | "ACTIVE"
  | "PAST_DUE"
  | "GRACE"
  | "SUSPENDED"
  | "CANCELLED"
  | "ARCHIVED";

export type SubscriptionStatus = TenantStatus | "EXPIRED";

export type ModuleCode =
  | "CRM"
  | "SALES"
  | "FINANCE"
  | "TASKS"
  | "DOCUMENTS"
  | "HR"
  | "INVENTORY";

export type BillingInterval = "MONTHLY" | "ANNUAL";

export type AdjustmentType =
  | "EXTEND_TRIAL"
  | "CHANGE_PLAN"
  | "MANUAL_ACTIVATE"
  | "MARK_INVOICE_PAID"
  | "SUSPEND";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "VOID";

export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export interface TenantOwnerInfo {
  id?: string;
  full_name: string;
  email: string;
  phone?: string | null;
}

export interface TenantUsageInfo {
  seats_used: number;
  storage_used_mb: number;
  api_calls_used: number;
}

export interface ModuleQuotas {
  max_seats: number;
  max_storage_mb: number;
  max_api_calls: number;
}

export interface TenantEntitlementItem {
  module_code: ModuleCode;
  is_enabled: boolean;
  quotas: ModuleQuotas;
  entitlement_version?: number;
}

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  timezone: string;
  default_currency: string;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
  owner: TenantOwnerInfo | null;
}

export interface TenantDetail extends TenantListItem {
  current_plan?: { plan_id: string | null };
  current_usage?: TenantUsageInfo;
  entitlements?: TenantEntitlementItem[];
}

export interface DashboardPeriod {
  from: string;
  to: string;
}

export interface RevenueByCurrency {
  currency: string;
  mrr: number;
  arr: number;
}

export interface PlanMixItem {
  plan_id: string | null;
  plan_name: string;
  tenant_count: number;
}

export interface DashboardOverview {
  period: DashboardPeriod;
  total_tenants: number;
  tenants_by_status: Record<TenantStatus, number>;
  active_subscriptions: number;
  mrr: number;
  arr: number;
  revenue_by_currency: RevenueByCurrency[];
  plan_mix: PlanMixItem[];
  failed_payments_count: number;
  churn_rate: number;
  recent_tenants: TenantListItem[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TenantListSuccessResponse {
  success: boolean;
  data: TenantListItem[];
  meta: PageMeta;
}

export interface TenantDetailSuccessResponse {
  success: boolean;
  data: TenantDetail;
}

export interface EntitlementsSuccessResponse {
  success: boolean;
  data: {
    tenant_id: string;
    entitlements: TenantEntitlementItem[];
    current_usage?: TenantUsageInfo;
  };
}

export interface DashboardOverviewSuccessResponse {
  success: boolean;
  data: DashboardOverview;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  status?: TenantStatus;
  timezone?: string;
  default_currency?: string;
  plan_id?: string | null;
  owner: {
    full_name: string;
    email: string;
    phone?: string | null;
    password?: string | null;
  };
}

export interface UpdateTenantInput {
  name?: string;
  timezone?: string;
  default_currency?: string;
}

export interface UpdateTenantStatusInput {
  status: TenantStatus;
  reason: string;
}

export interface UpdateEntitlementsInput {
  modules: Array<{
    module_code: ModuleCode;
    is_enabled: boolean;
    quotas: ModuleQuotas;
  }>;
}

// 1) Plans
export interface PlanQuotas {
  max_seats: number;
  max_storage_mb: number;
  api_rate_limit: number;
}

export interface PlanFeatureItem {
  module_code: ModuleCode;
  enabled: boolean;
  limit?: number | null;
}

export interface UpsertPlanInput {
  code: string;
  name: string;
  billing_interval: BillingInterval;
  price: number;
  currency?: string;
  trial_days?: number;
  active?: boolean;
  quotas: PlanQuotas;
  modules: PlanFeatureItem[];
}

export interface PlanItem extends UpsertPlanInput {
  id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PlanListSuccessResponse {
  success: boolean;
  data: PlanItem[];
  meta: PageMeta;
}

export interface PlanDetailSuccessResponse {
  success: boolean;
  data: PlanItem;
}

// 2) Subscriptions
export interface AdjustSubscriptionInput {
  adjustment_type: AdjustmentType;
  reason: string;
  plan_id?: string;
  trial_ends_at?: string;
  invoice_id?: string;
}

export interface SubscriptionListItem {
  id: string;
  tenant_id: string;
  tenant_name?: string | null;
  tenant_slug?: string | null;
  plan_id: string;
  plan_code?: string | null;
  plan_name?: string | null;
  billing_interval?: string | null;
  plan_price?: number | null;
  plan_currency?: string | null;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string;
  trial_ends_at?: string | null;
  cancel_at_period_end: boolean;
  provider_customer_ref?: string | null;
  provider_subscription_ref?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionListSuccessResponse {
  success: boolean;
  data: SubscriptionListItem[];
  meta: PageMeta;
}

export interface SubscriptionDetailSuccessResponse {
  success: boolean;
  data: SubscriptionListItem;
}

// 3) Invoices & Payments
export interface PaymentTransactionItem {
  id: string;
  tenant_id: string;
  tenant_name?: string | null;
  invoice_id?: string | null;
  provider: string;
  provider_event_id?: string | null;
  provider_payment_id?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  tenant_id: string;
  tenant_name?: string | null;
  tenant_slug?: string | null;
  subscription_id: string;
  invoice_no: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  due_date: string;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceDetail extends InvoiceItem {
  payments?: PaymentTransactionItem[];
}

export interface InvoiceListSuccessResponse {
  success: boolean;
  data: InvoiceItem[];
  meta: PageMeta;
}

export interface InvoiceDetailSuccessResponse {
  success: boolean;
  data: InvoiceDetail;
}

export interface PaymentListSuccessResponse {
  success: boolean;
  data: PaymentTransactionItem[];
  meta: PageMeta;
}

// 4) Audit Logs
export interface AuditActorInfo {
  id?: string;
  full_name: string;
  email: string;
  roles: string[];
}

export interface AuditDiffField {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditLogItem {
  id: string;
  tenant_id?: string | null;
  tenant_name?: string | null;
  actor_user_id?: string | null;
  actor: AuditActorInfo | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  reason?: string | null;
  request_id?: string | null;
  created_at: string;
}

export interface AuditLogDetail extends AuditLogItem {
  diff?: AuditDiffField[];
}

export interface AuditLogListSuccessResponse {
  success: boolean;
  data: AuditLogItem[];
  meta: PageMeta;
}

export interface AuditLogDetailSuccessResponse {
  success: boolean;
  data: AuditLogDetail;
}
