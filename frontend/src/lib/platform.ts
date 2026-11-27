import { isAxiosError } from "axios";
import { api } from "./api";
import type {
  AdjustSubscriptionInput,
  AuditLogDetail,
  AuditLogDetailSuccessResponse,
  AuditLogItem,
  AuditLogListSuccessResponse,
  CreateTenantInput,
  DashboardOverview,
  DashboardOverviewSuccessResponse,
  EntitlementsSuccessResponse,
  InvoiceDetail,
  InvoiceDetailSuccessResponse,
  InvoiceItem,
  InvoiceListSuccessResponse,
  PageMeta,
  PaymentListSuccessResponse,
  PaymentTransactionItem,
  PlanDetailSuccessResponse,
  PlanItem,
  PlanListSuccessResponse,
  SubscriptionDetailSuccessResponse,
  SubscriptionListItem,
  SubscriptionListSuccessResponse,
  TenantDetail,
  TenantDetailSuccessResponse,
  TenantListItem,
  TenantListSuccessResponse,
  UpdateEntitlementsInput,
  UpdateTenantInput,
  UpdateTenantStatusInput,
  UpsertPlanInput,
} from "../types/platform";
import type { ErrorResponse } from "../types/auth";

// Dashboard
export async function getDashboard(params?: {
  from?: string;
  to?: string;
}): Promise<DashboardOverview> {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);

  const queryString = query.toString();
  const endpoint = `/api/v1/platform/dashboard${queryString ? `?${queryString}` : ""}`;

  const response = await api.get<DashboardOverviewSuccessResponse>(endpoint);
  return response.data.data;
}

// Tenants
export async function getTenants(params?: {
  search?: string;
  status?: string;
  plan_id?: string;
  page?: number;
  limit?: number;
}): Promise<{ tenants: TenantListItem[]; meta: PageMeta }> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search.trim());
  if (params?.status) query.set("status", params.status);
  if (params?.plan_id) query.set("plan_id", params.plan_id.trim());
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const queryString = query.toString();
  const endpoint = `/api/v1/platform/tenants${queryString ? `?${queryString}` : ""}`;

  const response = await api.get<TenantListSuccessResponse>(endpoint);
  return {
    tenants: response.data.data || [],
    meta: response.data.meta || {
      page: 1,
      limit: 20,
      total: response.data.data?.length || 0,
      totalPages: 1,
    },
  };
}

export async function createTenant(input: CreateTenantInput): Promise<TenantDetail> {
  const body: CreateTenantInput = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    status: input.status || "TRIAL",
    timezone: input.timezone || "Asia/Kolkata",
    default_currency: input.default_currency || "INR",
    plan_id: input.plan_id && input.plan_id.trim() ? input.plan_id.trim() : null,
    owner: {
      full_name: input.owner.full_name.trim(),
      email: input.owner.email.trim().toLowerCase(),
      phone:
        input.owner.phone && input.owner.phone.trim()
          ? input.owner.phone.trim().replace(/[\s-]+/g, "")
          : undefined,
      password:
        input.owner.password && input.owner.password.trim()
          ? input.owner.password
          : undefined,
    },
  };

  const response = await api.post<TenantDetailSuccessResponse>(
    "/api/v1/platform/tenants",
    body
  );
  return response.data.data;
}

export async function getTenant(id: string): Promise<TenantDetail> {
  const response = await api.get<TenantDetailSuccessResponse>(
    `/api/v1/platform/tenants/${id}`
  );
  return response.data.data;
}

export async function updateTenant(
  id: string,
  input: UpdateTenantInput
): Promise<TenantDetail> {
  const body: UpdateTenantInput = {};
  if (input.name && input.name.trim()) body.name = input.name.trim();
  if (input.timezone && input.timezone.trim()) body.timezone = input.timezone.trim();
  if (input.default_currency && input.default_currency.trim())
    body.default_currency = input.default_currency.trim().toUpperCase();

  const response = await api.patch<TenantDetailSuccessResponse>(
    `/api/v1/platform/tenants/${id}`,
    body
  );
  return response.data.data;
}

export async function updateTenantStatus(
  id: string,
  input: UpdateTenantStatusInput
): Promise<TenantDetail> {
  const body: UpdateTenantStatusInput = {
    status: input.status,
    reason: input.reason.trim(),
  };

  const response = await api.post<TenantDetailSuccessResponse>(
    `/api/v1/platform/tenants/${id}/status`,
    body
  );
  return response.data.data;
}

export async function getEntitlements(id: string): Promise<EntitlementsSuccessResponse["data"]> {
  const response = await api.get<EntitlementsSuccessResponse>(
    `/api/v1/platform/tenants/${id}/entitlements`
  );
  return response.data.data;
}

export async function updateEntitlements(
  id: string,
  input: UpdateEntitlementsInput
): Promise<EntitlementsSuccessResponse["data"]> {
  const response = await api.put<EntitlementsSuccessResponse>(
    `/api/v1/platform/tenants/${id}/entitlements`,
    input
  );
  return response.data.data;
}

// 1) Plans API
export async function getPlans(params?: {
  search?: string;
  billing_interval?: string;
  active?: string;
  page?: number;
  limit?: number;
}): Promise<{ plans: PlanItem[]; meta: PageMeta }> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search.trim());
  if (params?.billing_interval) query.set("billing_interval", params.billing_interval);
  if (params?.active !== undefined && params.active !== "") query.set("active", params.active);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const queryString = query.toString();
  const endpoint = `/api/v1/platform/plans${queryString ? `?${queryString}` : ""}`;

  const response = await api.get<PlanListSuccessResponse>(endpoint);
  return {
    plans: response.data.data || [],
    meta: response.data.meta || {
      page: 1,
      limit: 20,
      total: response.data.data?.length || 0,
      totalPages: 1,
    },
  };
}

export async function getPlan(id: string): Promise<PlanItem> {
  const response = await api.get<PlanDetailSuccessResponse>(`/api/v1/platform/plans/${id}`);
  return response.data.data;
}

export async function createPlan(input: UpsertPlanInput): Promise<PlanItem> {
  const response = await api.post<PlanDetailSuccessResponse>("/api/v1/platform/plans", input);
  return response.data.data;
}

export async function updatePlan(id: string, input: UpsertPlanInput): Promise<PlanItem> {
  const response = await api.put<PlanDetailSuccessResponse>(`/api/v1/platform/plans/${id}`, input);
  return response.data.data;
}

export async function updatePlanStatus(id: string, active: boolean): Promise<PlanItem> {
  const response = await api.patch<PlanDetailSuccessResponse>(
    `/api/v1/platform/plans/${id}/status`,
    { active }
  );
  return response.data.data;
}

// 2) Subscriptions API
export async function getSubscriptions(params?: {
  status?: string;
  plan_id?: string;
  tenant_id?: string;
  page?: number;
  limit?: number;
}): Promise<{ subscriptions: SubscriptionListItem[]; meta: PageMeta }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.plan_id) query.set("plan_id", params.plan_id.trim());
  if (params?.tenant_id) query.set("tenant_id", params.tenant_id.trim());
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const queryString = query.toString();
  const endpoint = `/api/v1/platform/subscriptions${queryString ? `?${queryString}` : ""}`;

  const response = await api.get<SubscriptionListSuccessResponse>(endpoint);
  return {
    subscriptions: response.data.data || [],
    meta: response.data.meta || {
      page: 1,
      limit: 20,
      total: response.data.data?.length || 0,
      totalPages: 1,
    },
  };
}

export async function adjustSubscription(
  id: string,
  input: AdjustSubscriptionInput
): Promise<SubscriptionListItem> {
  // Omit empty/undefined fields cleanly
  const body: AdjustSubscriptionInput = {
    adjustment_type: input.adjustment_type,
    reason: input.reason.trim(),
  };

  if (input.plan_id && input.plan_id.trim()) body.plan_id = input.plan_id.trim();
  if (input.trial_ends_at && input.trial_ends_at.trim())
    body.trial_ends_at = input.trial_ends_at.trim();
  if (input.invoice_id && input.invoice_id.trim()) body.invoice_id = input.invoice_id.trim();

  const response = await api.post<SubscriptionDetailSuccessResponse>(
    `/api/v1/platform/subscriptions/${id}/adjust`,
    body
  );
  return response.data.data;
}

// 3) Invoices API
export async function getInvoices(params?: {
  tenant_id?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<{ invoices: InvoiceItem[]; meta: PageMeta }> {
  const query = new URLSearchParams();
  if (params?.tenant_id) query.set("tenant_id", params.tenant_id.trim());
  if (params?.status) query.set("status", params.status);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const queryString = query.toString();
  const endpoint = `/api/v1/platform/invoices${queryString ? `?${queryString}` : ""}`;

  const response = await api.get<InvoiceListSuccessResponse>(endpoint);
  return {
    invoices: response.data.data || [],
    meta: response.data.meta || {
      page: 1,
      limit: 20,
      total: response.data.data?.length || 0,
      totalPages: 1,
    },
  };
}

export async function getInvoice(id: string): Promise<InvoiceDetail> {
  const response = await api.get<InvoiceDetailSuccessResponse>(
    `/api/v1/platform/invoices/${id}`
  );
  return response.data.data;
}

// 4) Payments API
export async function getPayments(params?: {
  tenant_id?: string;
  provider?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<{ payments: PaymentTransactionItem[]; meta: PageMeta }> {
  const query = new URLSearchParams();
  if (params?.tenant_id) query.set("tenant_id", params.tenant_id.trim());
  if (params?.provider) query.set("provider", params.provider.trim());
  if (params?.status) query.set("status", params.status);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const queryString = query.toString();
  const endpoint = `/api/v1/platform/payments${queryString ? `?${queryString}` : ""}`;

  const response = await api.get<PaymentListSuccessResponse>(endpoint);
  return {
    payments: response.data.data || [],
    meta: response.data.meta || {
      page: 1,
      limit: 20,
      total: response.data.data?.length || 0,
      totalPages: 1,
    },
  };
}

// 5) Audit Logs API
export async function getAuditLogs(params?: {
  tenant_id?: string;
  actor_user_id?: string;
  action?: string;
  entity_type?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<{ logs: AuditLogItem[]; meta: PageMeta }> {
  const query = new URLSearchParams();
  if (params?.tenant_id) query.set("tenant_id", params.tenant_id.trim());
  if (params?.actor_user_id) query.set("actor_user_id", params.actor_user_id.trim());
  if (params?.action) query.set("action", params.action.trim());
  if (params?.entity_type) query.set("entity_type", params.entity_type.trim());
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const queryString = query.toString();
  const endpoint = `/api/v1/platform/audit-logs${queryString ? `?${queryString}` : ""}`;

  const response = await api.get<AuditLogListSuccessResponse>(endpoint);
  return {
    logs: response.data.data || [],
    meta: response.data.meta || {
      page: 1,
      limit: 20,
      total: response.data.data?.length || 0,
      totalPages: 1,
    },
  };
}

export async function getAuditLog(id: string): Promise<AuditLogDetail> {
  const response = await api.get<AuditLogDetailSuccessResponse>(
    `/api/v1/platform/audit-logs/${id}`
  );
  return response.data.data;
}

export function parsePlatformError(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const responseData = error.response?.data as ErrorResponse | undefined;

    if (status === 403) {
      return "Forbidden: Super Admin access required.";
    }

    if (status === 404) {
      return responseData?.message || "Requested resource not found.";
    }

    if (status === 409) {
      return (
        responseData?.message ||
        responseData?.error ||
        "A resource with this identifier or code already exists."
      );
    }

    if (status === 400) {
      if (
        responseData?.errors &&
        Array.isArray(responseData.errors) &&
        responseData.errors[0]?.message
      ) {
        return responseData.errors[0].message;
      }
      return responseData?.message || responseData?.error || "Invalid request parameters.";
    }

    if (responseData?.message || responseData?.error) {
      return responseData.message || responseData.error || "Request failed.";
    }

    if (error.code === "ECONNABORTED" || error.message?.includes("Network Error") || !error.response) {
      return "Unable to reach server. Please check your connection.";
    }
  }

  return "An unexpected error occurred. Please try again.";
}
