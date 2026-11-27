import { api, withIdempotency } from "./api";
import { normalizeList, normalizeItem, NormalizedPagination } from "./normalize";
import type {
  PipelineData,
  PipelineStageItem,
  LeadItem,
  LeadActivity,
  LeadFollowup,
  LeadDetail,
  CustomerItem,
  LeadsQueryParams,
  CustomersQueryParams,
  CreateLeadInput,
  UpdateLeadInput,
  AssignLeadInput,
  CreateLeadActivityInput,
  CreateLeadFollowupInput,
  UpdateFollowupInput,
  ConvertLeadInput,
  CreateCustomerInput,
  LeadStage,
} from "@/types/crm";

export interface GetPipelineResponse {
  scope: "COMPANY_WIDE" | "ASSIGNED_ONLY";
  pipeline: PipelineStageItem[];
  raw: unknown;
}

export interface GetLeadsResponse {
  leads: LeadItem[];
  pagination: NormalizedPagination;
  raw: unknown;
}

export interface GetLeadDetailResponse {
  lead: LeadItem;
  activities: LeadActivity[];
  followups: LeadFollowup[];
  raw: unknown;
}

export interface GetCustomersResponse {
  customers: CustomerItem[];
  pagination: NormalizedPagination;
  raw: unknown;
}

export interface ConvertLeadResponse {
  customer: CustomerItem;
  lead: LeadItem;
  message: string;
  raw: unknown;
}

/**
 * 1. GET /api/v1/crm/pipeline
 * Fetches stage-wise counts and values.
 */
export async function getPipeline(): Promise<GetPipelineResponse> {
  const res = await api.get<unknown>("/api/v1/crm/pipeline");
  const data = (res.data as Record<string, unknown>)?.data || res.data || {};
  const dObj = data as Record<string, unknown>;

  const scope = (dObj.scope as "COMPANY_WIDE" | "ASSIGNED_ONLY") || "COMPANY_WIDE";
  const pipelineRaw = Array.isArray(dObj.pipeline)
    ? (dObj.pipeline as PipelineStageItem[])
    : Array.isArray(res.data)
    ? (res.data as PipelineStageItem[])
    : [];

  const defaultStages: LeadStage[] = [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL",
    "NEGOTIATION",
    "WON",
    "LOST",
  ];

  const stageMap = new Map<string, PipelineStageItem>();
  pipelineRaw.forEach((item) => {
    if (item && item.stage) {
      stageMap.set(item.stage, {
        stage: item.stage,
        count: Number(item.count || 0),
        totalValue: Number(item.totalValue || 0),
      });
    }
  });

  const pipeline: PipelineStageItem[] = defaultStages.map((stage) => {
    return (
      stageMap.get(stage) || {
        stage,
        count: 0,
        totalValue: 0,
      }
    );
  });

  return {
    scope,
    pipeline,
    raw: res.data,
  };
}

/**
 * 2. GET /api/v1/crm/leads
 * Paginated list of CRM leads with filters.
 */
export async function getLeads(
  params?: LeadsQueryParams
): Promise<GetLeadsResponse> {
  const query = new URLSearchParams();
  if (params?.stage && params.stage !== "ALL") query.set("stage", params.stage);
  if (params?.priority && params.priority !== "ALL") query.set("priority", params.priority);
  if (params?.ownerUserId && params.ownerUserId !== "ALL") query.set("ownerUserId", params.ownerUserId);
  if (params?.search) query.set("search", params.search.trim());
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  const endpoint = `/api/v1/crm/leads${qs ? `?${qs}` : ""}`;

  const res = await api.get<unknown>(endpoint);
  const { items, pagination } = normalizeList<LeadItem>(res.data, "leads");

  // Defensively normalize estimatedValue to number
  const leads = items.map((l) => ({
    ...l,
    estimatedValue: Number(l.estimatedValue || 0),
    currency: (l.currency || "INR").trim(),
  }));

  return {
    leads,
    pagination,
    raw: res.data,
  };
}

/**
 * 3. POST /api/v1/crm/leads
 * Creates a new CRM lead.
 */
export async function createLead(
  input: CreateLeadInput
): Promise<{ lead: LeadItem; raw: unknown }> {
  const res = await api.post<unknown>("/api/v1/crm/leads", input);
  const data = (res.data as Record<string, unknown>)?.data || res.data;
  const leadRaw = (data as Record<string, unknown>)?.lead || data;
  const lead = normalizeItem<LeadItem>(leadRaw);
  return {
    lead: {
      ...lead,
      estimatedValue: Number(lead.estimatedValue || 0),
      currency: (lead.currency || "INR").trim(),
    },
    raw: res.data,
  };
}

/**
 * 4. GET /api/v1/crm/leads/{id}
 * Retrieves lead details, activities timeline, and scheduled followups.
 */
export async function getLeadDetail(
  id: string
): Promise<GetLeadDetailResponse> {
  const res = await api.get<unknown>(`/api/v1/crm/leads/${encodeURIComponent(id)}`);
  const data = (res.data as Record<string, unknown>)?.data || res.data || {};
  const dObj = data as Record<string, unknown>;

  const leadRaw = dObj.lead || dObj;
  const lead = normalizeItem<LeadItem>(leadRaw);

  const activities = Array.isArray(dObj.activities)
    ? (dObj.activities as LeadActivity[])
    : [];

  const followups = Array.isArray(dObj.followups)
    ? (dObj.followups as LeadFollowup[])
    : [];

  return {
    lead: {
      ...lead,
      estimatedValue: Number(lead.estimatedValue || 0),
      currency: (lead.currency || "INR").trim(),
    },
    activities,
    followups,
    raw: res.data,
  };
}

/**
 * 5. PATCH /api/v1/crm/leads/{id}
 * Updates lead fields or stage.
 */
export async function updateLead(
  id: string,
  input: UpdateLeadInput
): Promise<{ lead: LeadItem; raw: unknown }> {
  const res = await api.patch<unknown>(`/api/v1/crm/leads/${encodeURIComponent(id)}`, input);
  const data = (res.data as Record<string, unknown>)?.data || res.data;
  const leadRaw = (data as Record<string, unknown>)?.lead || data;
  const lead = normalizeItem<LeadItem>(leadRaw);
  return {
    lead: {
      ...lead,
      estimatedValue: Number(lead.estimatedValue || 0),
      currency: (lead.currency || "INR").trim(),
    },
    raw: res.data,
  };
}

/**
 * 6. POST /api/v1/crm/leads/{id}/assign
 * Assigns lead to a team member.
 */
export async function assignLead(
  id: string,
  input: AssignLeadInput
): Promise<{ lead: LeadItem; raw: unknown }> {
  const res = await api.post<unknown>(`/api/v1/crm/leads/${encodeURIComponent(id)}/assign`, input);
  const data = (res.data as Record<string, unknown>)?.data || res.data;
  const leadRaw = (data as Record<string, unknown>)?.lead || data;
  const lead = normalizeItem<LeadItem>(leadRaw);
  return {
    lead,
    raw: res.data,
  };
}

/**
 * 7. POST /api/v1/crm/leads/{id}/activities
 * Logs a lead interaction activity (NOTE, CALL, EMAIL, MEETING).
 */
export async function logLeadActivity(
  id: string,
  input: CreateLeadActivityInput
): Promise<{ activity: LeadActivity; raw: unknown }> {
  const res = await api.post<unknown>(
    `/api/v1/crm/leads/${encodeURIComponent(id)}/activities`,
    input
  );
  const data = (res.data as Record<string, unknown>)?.data || res.data;
  const actRaw = (data as Record<string, unknown>)?.activity || data;
  const activity = normalizeItem<LeadActivity>(actRaw);
  return {
    activity,
    raw: res.data,
  };
}

/**
 * 8. POST /api/v1/crm/leads/{id}/followups
 * Schedules a followup reminder on a lead.
 */
export async function scheduleLeadFollowup(
  id: string,
  input: CreateLeadFollowupInput
): Promise<{ followup: LeadFollowup; raw: unknown }> {
  const res = await api.post<unknown>(
    `/api/v1/crm/leads/${encodeURIComponent(id)}/followups`,
    input
  );
  const data = (res.data as Record<string, unknown>)?.data || res.data;
  const folRaw = (data as Record<string, unknown>)?.followup || data;
  const followup = normalizeItem<LeadFollowup>(folRaw);
  return {
    followup,
    raw: res.data,
  };
}

/**
 * 9. PATCH /api/v1/crm/followups/{id}
 * Updates followup status (PENDING, COMPLETED, CANCELLED, MISSED) or schedule.
 */
export async function updateFollowup(
  id: string,
  input: UpdateFollowupInput
): Promise<{ followup: LeadFollowup; raw: unknown }> {
  const res = await api.patch<unknown>(
    `/api/v1/crm/followups/${encodeURIComponent(id)}`,
    input
  );
  const data = (res.data as Record<string, unknown>)?.data || res.data;
  const folRaw = (data as Record<string, unknown>)?.followup || data;
  const followup = normalizeItem<LeadFollowup>(folRaw);
  return {
    followup,
    raw: res.data,
  };
}

/**
 * 10. POST /api/v1/crm/leads/{id}/convert
 * Converts a lead into a customer record (Idempotent).
 */
export async function convertLeadToCustomer(
  id: string,
  input?: ConvertLeadInput,
  idempotencyKey?: string
): Promise<ConvertLeadResponse> {
  const { headers } = withIdempotency(idempotencyKey);
  const res = await api.post<unknown>(
    `/api/v1/crm/leads/${encodeURIComponent(id)}/convert`,
    input || {},
    { headers }
  );

  const data = (res.data as Record<string, unknown>)?.data || res.data || {};
  const dObj = data as Record<string, unknown>;

  const customerRaw = dObj.customer || {};
  const leadRaw = dObj.lead || {};
  const message = (dObj.message as string) || "Lead converted to customer successfully.";

  const customer = normalizeItem<CustomerItem>(customerRaw);
  const lead = normalizeItem<LeadItem>(leadRaw);

  return {
    customer: {
      ...customer,
      creditLimit: Number(customer.creditLimit || 0),
      currency: (customer.currency || "INR").trim(),
    },
    lead,
    message,
    raw: res.data,
  };
}

/**
 * 11. GET /api/v1/crm/customers
 * Paginated list of customers with search and filters.
 */
export async function getCustomers(
  params?: CustomersQueryParams
): Promise<GetCustomersResponse> {
  const query = new URLSearchParams();
  if (params?.customerType && params.customerType !== "ALL") {
    query.set("customerType", params.customerType);
  }
  if (params?.status && params.status !== "ALL") {
    query.set("status", params.status);
  }
  if (params?.search) query.set("search", params.search.trim());
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  const endpoint = `/api/v1/crm/customers${qs ? `?${qs}` : ""}`;

  const res = await api.get<unknown>(endpoint);
  const { items, pagination } = normalizeList<CustomerItem>(res.data, "customers");

  const customers = items.map((c) => ({
    ...c,
    creditLimit: Number(c.creditLimit || 0),
    currency: (c.currency || "INR").trim(),
  }));

  return {
    customers,
    pagination,
    raw: res.data,
  };
}

/**
 * 12. POST /api/v1/crm/customers
 * Creates a new customer account.
 */
export async function createCustomer(
  input: CreateCustomerInput
): Promise<{ customer: CustomerItem; raw: unknown }> {
  const res = await api.post<unknown>("/api/v1/crm/customers", input);
  const data = (res.data as Record<string, unknown>)?.data || res.data;
  const custRaw = (data as Record<string, unknown>)?.customer || data;
  const customer = normalizeItem<CustomerItem>(custRaw);
  return {
    customer: {
      ...customer,
      creditLimit: Number(customer.creditLimit || 0),
      currency: (customer.currency || "INR").trim(),
    },
    raw: res.data,
  };
}

/**
 * 13. GET /api/v1/crm/customers/{id}
 * Retrieves profile and financial details of a customer.
 */
export async function getCustomerDetail(
  id: string
): Promise<{ customer: CustomerItem; raw: unknown }> {
  const res = await api.get<unknown>(`/api/v1/crm/customers/${encodeURIComponent(id)}`);
  const data = (res.data as Record<string, unknown>)?.data || res.data;
  const custRaw = (data as Record<string, unknown>)?.customer || data;
  const customer = normalizeItem<CustomerItem>(custRaw);
  return {
    customer: {
      ...customer,
      creditLimit: Number(customer.creditLimit || 0),
      currency: (customer.currency || "INR").trim(),
    },
    raw: res.data,
  };
}
