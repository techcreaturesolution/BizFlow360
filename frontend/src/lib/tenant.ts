import { api, withIdempotency } from "./api";
import { normalizeList, normalizeItem } from "./normalize";
import type {
  AddressObject,
  BranchItem,
  CreateBranchInput,
  UpdateBranchInput,
  CompanyProfile,
  UpdateCompanyInput,
  CreateDepartmentInput,
  DepartmentItem,
  CreateTeamInput,
  TeamItem,
  StaffUserItem,
  TeamMember,
  GetTeamMembersResponse,
  InviteMemberInput,
  InvitationData,
  RoleItem,
  RolePermissionItem,
  RolesListResponseData,
  CreateRoleInput,
  ApprovalItem,
  ApprovalInboxResponse,
  ApproveDecisionInput,
  RejectDecisionInput,
  NotificationItem,
  NotificationsListResponse,
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
  CreateExportJobInput,
  DashboardSummaryParams,
  DashboardWidgetConfig,
  ExportJobItem,
  PutWidgetsInput,
  TenantSubscriptionInfo,
} from "@/types/tenant";

/**
 * Fetch tenant subscription details and module entitlements.
 */
export async function getTenantSubscription(): Promise<TenantSubscriptionInfo> {
  try {
    const res = await api.get<unknown>("/api/v1/billing/subscription");
    const item = normalizeItem<TenantSubscriptionInfo>(res.data);
    return item;
  } catch (error) {
    console.warn("Failed to load subscription info, falling back to permissive entitlements:", error);
    return {
      status: "ACTIVE",
      modules: [],
    };
  }
}

/**
 * Fetch unread notification count.
 */
export async function getUnreadNotificationsCount(): Promise<number> {
  try {
    const res = await api.get<unknown>("/api/v1/notifications?isRead=false&limit=1");
    const raw = res.data as Record<string, unknown> | undefined;
    if (typeof raw?.unreadCount === "number") return raw.unreadCount;
    if (typeof raw?.totalUnread === "number") return raw.totalUnread;
    const { pagination } = normalizeList(res.data);
    return pagination.total || 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch dashboard overview summary data with snake_case query params.
 */
export async function getDashboardSummary(
  params?: DashboardSummaryParams
): Promise<Record<string, unknown>> {
  const query = new URLSearchParams();
  if (params?.period) query.set("period", params.period);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.branch_id) query.set("branch_id", params.branch_id);
  if (params?.department_id) query.set("department_id", params.department_id);
  if (params?.owner_user_id) query.set("owner_user_id", params.owner_user_id);
  if (params?.status) query.set("status", params.status);

  const qs = query.toString();
  const endpoint = `/api/v1/dashboard/summary${qs ? `?${qs}` : ""}`;

  const res = await api.get<unknown>(endpoint);
  return normalizeItem<Record<string, unknown>>(res.data);
}

/**
 * Fetch configured dashboard widget layout.
 */
export async function getDashboardWidgets(
  layoutName = "default"
): Promise<DashboardWidgetConfig[]> {
  try {
    const res = await api.get<unknown>(
      `/api/v1/dashboard/widgets?layoutName=${encodeURIComponent(layoutName)}`
    );
    const { items } = normalizeList<DashboardWidgetConfig>(res.data, "widgets");
    return items;
  } catch (error) {
    console.warn("Failed to load custom widget layout, returning empty:", error);
    return [];
  }
}

/**
 * Save custom dashboard widget layout.
 */
export async function saveDashboardWidgets(
  input: PutWidgetsInput
): Promise<DashboardWidgetConfig[]> {
  const res = await api.put<unknown>("/api/v1/dashboard/widgets", input);
  const { items } = normalizeList<DashboardWidgetConfig>(res.data, "widgets");
  return items.length > 0 ? items : input.widgets;
}

/**
 * Fetch branches list for tenant dropdown filters.
 */
export async function getBranches(): Promise<BranchItem[]> {
  try {
    const res = await api.get<unknown>("/api/v1/branches?status=ACTIVE");
    const { items } = normalizeList<BranchItem>(res.data, "branches");
    return items;
  } catch (error) {
    console.warn("Failed to load branches:", error);
    return [];
  }
}

/**
 * Fetch departments list for tenant dropdown filters.
 */
export async function getDepartments(): Promise<DepartmentItem[]> {
  try {
    const res = await api.get<unknown>("/api/v1/departments?status=ACTIVE");
    const { items } = normalizeList<DepartmentItem>(res.data, "departments");
    return items;
  } catch (error) {
    console.warn("Failed to load departments:", error);
    return [];
  }
}

function buildAnalyticsQuery(params?: DashboardSummaryParams): string {
  const query = new URLSearchParams();
  if (params?.period) query.set("period", params.period);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.branch_id) query.set("branch_id", params.branch_id);
  if (params?.department_id) query.set("department_id", params.department_id);
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Analytics: Sales tab API
 */
export async function getAnalyticsSales(
  params?: DashboardSummaryParams
): Promise<Record<string, unknown>> {
  const qs = buildAnalyticsQuery(params);
  const res = await api.get<unknown>(`/api/v1/analytics/sales${qs}`);
  return normalizeItem<Record<string, unknown>>(res.data);
}

/**
 * Analytics: Finance tab API
 */
export async function getAnalyticsFinance(
  params?: DashboardSummaryParams
): Promise<Record<string, unknown>> {
  const qs = buildAnalyticsQuery(params);
  const res = await api.get<unknown>(`/api/v1/analytics/finance${qs}`);
  return normalizeItem<Record<string, unknown>>(res.data);
}

/**
 * Analytics: HR tab API
 */
export async function getAnalyticsHr(
  params?: DashboardSummaryParams
): Promise<Record<string, unknown>> {
  const qs = buildAnalyticsQuery(params);
  const res = await api.get<unknown>(`/api/v1/analytics/hr${qs}`);
  return normalizeItem<Record<string, unknown>>(res.data);
}

/**
 * Analytics: Projects tab API
 */
export async function getAnalyticsProjects(
  params?: DashboardSummaryParams
): Promise<Record<string, unknown>> {
  const qs = buildAnalyticsQuery(params);
  const res = await api.get<unknown>(`/api/v1/analytics/projects${qs}`);
  return normalizeItem<Record<string, unknown>>(res.data);
}

/**
 * Reports: Create export job with Idempotency-Key
 */
export async function createReportExport(
  input: CreateExportJobInput,
  idempotencyKey?: string
): Promise<{ success: boolean; data?: unknown; message?: string }> {
  const { headers } = withIdempotency(idempotencyKey);
  const res = await api.post<unknown>("/api/v1/reports/export", input, {
    headers,
  });
  return res.data as { success: boolean; data?: unknown; message?: string };
}

/**
 * Reports: List recent export jobs
 */
export async function getReportExports(): Promise<ExportJobItem[]> {
  try {
    const res = await api.get<unknown>("/api/v1/reports/export");
    const { items } = normalizeList<ExportJobItem>(res.data, "jobs");
    return items;
  } catch (error) {
    console.warn("Failed to load export jobs:", error);
    return [];
  }
}

/**
 * Company Profile: Fetch company details, address, and preferences
 */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  const res = await api.get<unknown>("/api/v1/company");
  const data = res.data as { data?: { company?: CompanyProfile } } | undefined;
  if (data?.data?.company) {
    return normalizeItem<CompanyProfile>(data.data.company);
  }
  return normalizeItem<CompanyProfile>(res.data);
}

/**
 * Company Profile: Update changed company profile and preference fields
 */
export async function updateCompanyProfile(
  input: UpdateCompanyInput
): Promise<CompanyProfile> {
  const res = await api.put<unknown>("/api/v1/company", input);
  const data = res.data as { data?: { company?: CompanyProfile } } | undefined;
  if (data?.data?.company) {
    return normalizeItem<CompanyProfile>(data.data.company);
  }
  return normalizeItem<CompanyProfile>(res.data);
}

/**
 * Branches: List branches with optional status and search filter
 */
export async function getBranchesList(params?: {
  status?: string;
  search?: string;
}): Promise<BranchItem[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "ALL") query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();

  const res = await api.get<unknown>(`/api/v1/branches${qs ? `?${qs}` : ""}`);
  const { items } = normalizeList<BranchItem>(res.data, "branches");
  return items;
}

/**
 * Branches: Create a new branch
 */
export async function createBranch(input: CreateBranchInput): Promise<BranchItem> {
  const res = await api.post<unknown>("/api/v1/branches", input);
  return normalizeItem<BranchItem>(res.data);
}

/**
 * Branches: Update branch by ID
 */
export async function updateBranch(
  id: string,
  input: UpdateBranchInput
): Promise<BranchItem> {
  const res = await api.put<unknown>(`/api/v1/branches/${id}`, input);
  return normalizeItem<BranchItem>(res.data);
}

/**
 * Departments: List departments with optional status, branchId, and search filter
 */
export async function getDepartmentsList(params?: {
  status?: string;
  branchId?: string;
  search?: string;
}): Promise<DepartmentItem[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "ALL") query.set("status", params.status);
  if (params?.branchId && params.branchId !== "ALL") query.set("branchId", params.branchId);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();

  const res = await api.get<unknown>(`/api/v1/departments${qs ? `?${qs}` : ""}`);
  const { items } = normalizeList<DepartmentItem>(res.data, "departments");
  return items;
}

/**
 * Departments: Create a new department
 */
export async function createDepartment(
  input: CreateDepartmentInput
): Promise<DepartmentItem> {
  const res = await api.post<unknown>("/api/v1/departments", input);
  return normalizeItem<DepartmentItem>(res.data);
}

/**
 * Departments: Update department by ID
 */
export async function updateDepartment(
  id: string,
  input: Partial<CreateDepartmentInput>
): Promise<DepartmentItem> {
  const res = await api.put<unknown>(`/api/v1/departments/${id}`, input);
  return normalizeItem<DepartmentItem>(res.data);
}

/**
 * Teams: List teams with hierarchy and members
 */
export async function getTeamsList(params?: {
  status?: string;
  departmentId?: string;
  search?: string;
}): Promise<TeamItem[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "ALL") query.set("status", params.status);
  if (params?.departmentId && params.departmentId !== "ALL") query.set("departmentId", params.departmentId);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();

  const res = await api.get<unknown>(`/api/v1/teams${qs ? `?${qs}` : ""}`);
  const { items } = normalizeList<TeamItem>(res.data, "teams");
  return items;
}

/**
 * Teams: Create a team and map members
 */
export async function createTeam(input: CreateTeamInput): Promise<TeamItem> {
  const res = await api.post<unknown>("/api/v1/teams", input);
  return normalizeItem<TeamItem>(res.data);
}

/**
 * Teams: Update team hierarchy and members
 */
export async function updateTeam(
  id: string,
  input: CreateTeamInput
): Promise<TeamItem> {
  const res = await api.put<unknown>(`/api/v1/teams/${id}`, input);
  return normalizeItem<TeamItem>(res.data);
}

/**
 * Users: List company team members for manager and member dropdowns
 */
export async function getUsersList(params?: {
  status?: string;
  search?: string;
}): Promise<StaffUserItem[]> {
  try {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();

    const res = await api.get<unknown>(`/api/v1/users${qs ? `?${qs}` : ""}`);
    const { items } = normalizeList<StaffUserItem>(res.data, "members");
    return items;
  } catch (error) {
    console.warn("Failed to load staff users:", error);
    return [];
  }
}

/**
 * Team Members: List members with pagination and filtering
 * GET /api/v1/users
 */
export async function getTeamMembers(params?: {
  status?: string;
  branch?: string;
  department?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<GetTeamMembersResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "ALL") query.set("status", params.status);
  if (params?.branch && params.branch !== "ALL") query.set("branch", params.branch);
  if (params?.department && params.department !== "ALL") query.set("department", params.department);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.limit) query.set("limit", params.limit.toString());
  const qs = query.toString();

  const res = await api.get<unknown>(`/api/v1/users${qs ? `?${qs}` : ""}`);
  const data = res.data as {
    data?: {
      members?: TeamMember[];
      pagination?: { page: number; limit: number; total: number; totalPages: number };
    };
    members?: TeamMember[];
    pagination?: { page: number; limit: number; total: number; totalPages: number };
  } | undefined;

  const rawMembers = data?.data?.members || data?.members || [];
  const { items } = normalizeList<TeamMember>(rawMembers);

  const rawPagination = data?.data?.pagination || data?.pagination || {
    page: params?.page || 1,
    limit: params?.limit || 20,
    total: items.length,
    totalPages: Math.ceil(items.length / (params?.limit || 20)) || 1,
  };

  return {
    members: items,
    pagination: rawPagination,
  };
}

/**
 * Team Members: Activate or deactivate member
 * PATCH /api/v1/users/{id}/status
 */
export async function updateUserStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<{ success: boolean; message?: string }> {
  const res = await api.patch<unknown>(`/api/v1/users/${id}/status`, { status });
  return res.data as { success: boolean; message?: string };
}

/**
 * Team Members: Invite new member with Idempotency-Key
 * POST /api/v1/users/invitations
 */
export async function inviteTeamMember(
  input: InviteMemberInput,
  idempotencyKey?: string
): Promise<{ invitation: InvitationData; message?: string }> {
  const { headers } = withIdempotency(idempotencyKey);
  const res = await api.post<unknown>("/api/v1/users/invitations", input, {
    headers,
  });

  const data = res.data as {
    data?: { invitation?: InvitationData; message?: string };
    invitation?: InvitationData;
    message?: string;
  } | undefined;

  const invitation = data?.data?.invitation || data?.invitation || {
    email: input.email,
    fullName: input.fullName,
    status: "PENDING",
  };

  const message = data?.data?.message || data?.message;

  return {
    invitation,
    message,
  };
}

/**
 * RBAC: List roles and available system permissions
 * GET /api/v1/roles
 */
export async function getRolesAndPermissions(): Promise<RolesListResponseData> {
  const res = await api.get<unknown>("/api/v1/roles");
  const data = res.data as {
    data?: {
      roles?: RoleItem[];
      availablePermissions?: RolePermissionItem[];
    };
    roles?: RoleItem[];
    availablePermissions?: RolePermissionItem[];
  } | undefined;

  const roles = data?.data?.roles || data?.roles || [];
  const availablePermissions =
    data?.data?.availablePermissions || data?.availablePermissions || [];

  return {
    roles,
    availablePermissions,
  };
}

/**
 * RBAC: Create a custom role
 * POST /api/v1/roles
 */
export async function createCustomRole(
  input: CreateRoleInput
): Promise<RoleItem> {
  const res = await api.post<unknown>("/api/v1/roles", input);
  const data = res.data as { data?: { role?: RoleItem }; role?: RoleItem } | undefined;
  if (data?.data?.role) return data.data.role;
  if (data?.role) return data.role;
  return normalizeItem<RoleItem>(res.data);
}

/**
 * RBAC: Replace assigned permissions for a custom role
 * PUT /api/v1/roles/{id}/permissions
 */
export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<{ success: boolean; message?: string; assignedPermissions?: string[] }> {
  const res = await api.put<unknown>(`/api/v1/roles/${roleId}/permissions`, {
    permissionIds,
  });
  return res.data as { success: boolean; message?: string; assignedPermissions?: string[] };
}

/**
 * Approvals: List approval inbox queue
 * GET /api/v1/approvals/inbox
 */
export async function getApprovalInbox(params?: {
  status?: string;
  entityType?: string;
  branchId?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}): Promise<ApprovalInboxResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "ALL") query.set("status", params.status);
  if (params?.entityType && params.entityType !== "ALL") query.set("entityType", params.entityType);
  if (params?.branchId && params.branchId !== "ALL") query.set("branchId", params.branchId);
  if (params?.departmentId && params.departmentId !== "ALL") query.set("departmentId", params.departmentId);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.limit) query.set("limit", params.limit.toString());
  const qs = query.toString();

  const res = await api.get<unknown>(`/api/v1/approvals/inbox${qs ? `?${qs}` : ""}`);
  const data = res.data as {
    data?: {
      approvals?: ApprovalItem[];
      pendingCountsByType?: { entityType: string; count: number }[];
      pagination?: { page: number; limit: number; total: number; totalPages: number };
    };
    approvals?: ApprovalItem[];
    pendingCountsByType?: { entityType: string; count: number }[];
    pagination?: { page: number; limit: number; total: number; totalPages: number };
  } | undefined;

  const rawApprovals = data?.data?.approvals || data?.approvals || [];
  const { items } = normalizeList<ApprovalItem>(rawApprovals);

  const pendingCounts =
    data?.data?.pendingCountsByType || data?.pendingCountsByType || [];

  const rawPagination = data?.data?.pagination || data?.pagination || {
    page: params?.page || 1,
    limit: params?.limit || 20,
    total: items.length,
    totalPages: Math.ceil(items.length / (params?.limit || 20)) || 1,
  };

  return {
    approvals: items,
    pendingCountsByType: pendingCounts,
    pagination: rawPagination,
  };
}

/**
 * Approvals: Approve a pending request with Idempotency-Key
 * POST /api/v1/approvals/{id}/approve
 */
export async function approveApprovalRequest(
  id: string,
  input?: ApproveDecisionInput,
  idempotencyKey?: string
): Promise<{ success: boolean; message?: string }> {
  const { headers } = withIdempotency(idempotencyKey);
  const res = await api.post<unknown>(`/api/v1/approvals/${id}/approve`, input || {}, {
    headers,
  });
  return res.data as { success: boolean; message?: string };
}

/**
 * Approvals: Reject a pending request with required reason and Idempotency-Key
 * POST /api/v1/approvals/{id}/reject
 */
export async function rejectApprovalRequest(
  id: string,
  input: RejectDecisionInput,
  idempotencyKey?: string
): Promise<{ success: boolean; message?: string }> {
  const { headers } = withIdempotency(idempotencyKey);
  const res = await api.post<unknown>(`/api/v1/approvals/${id}/reject`, input, {
    headers,
  });
  return res.data as { success: boolean; message?: string };
}

/**
 * Notifications: List in-app alerts and unreadCount
 * GET /api/v1/notifications
 */
export async function getNotificationsList(params?: {
  isRead?: "true" | "false";
  category?: string;
  page?: number;
  limit?: number;
}): Promise<NotificationsListResponse> {
  const query = new URLSearchParams();
  if (params?.isRead) query.set("isRead", params.isRead);
  if (params?.category && params.category !== "ALL") query.set("category", params.category);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.limit) query.set("limit", params.limit.toString());
  const qs = query.toString();

  const res = await api.get<unknown>(`/api/v1/notifications${qs ? `?${qs}` : ""}`);
  const data = res.data as {
    data?: {
      notifications?: NotificationItem[];
      unreadCount?: number;
      pagination?: { page: number; limit: number; total: number; totalPages: number };
    };
    notifications?: NotificationItem[];
    unreadCount?: number;
    pagination?: { page: number; limit: number; total: number; totalPages: number };
  } | undefined;

  const rawNotifications = data?.data?.notifications || data?.notifications || [];
  const { items } = normalizeList<NotificationItem>(rawNotifications);

  const unreadCount = data?.data?.unreadCount ?? data?.unreadCount ?? 0;

  const rawPagination = data?.data?.pagination || data?.pagination || {
    page: params?.page || 1,
    limit: params?.limit || 20,
    total: items.length,
    totalPages: Math.ceil(items.length / (params?.limit || 20)) || 1,
  };

  return {
    notifications: items,
    unreadCount,
    pagination: rawPagination,
  };
}

/**
 * Notifications: Mark single notification as read
 * PATCH /api/v1/notifications/{id}/read
 */
export async function markNotificationRead(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.patch<unknown>(`/api/v1/notifications/${id}/read`);
  return res.data as { success: boolean; message?: string };
}

/**
 * Notifications: Mark all user notifications as read
 * POST /api/v1/notifications/read-all
 */
export async function markAllNotificationsRead(): Promise<{ success: boolean; message?: string }> {
  const res = await api.post<unknown>("/api/v1/notifications/read-all");
  return res.data as { success: boolean; message?: string };
}

/**
 * Notification Preferences: Get user preferences
 * GET /api/v1/notification-preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const defaultPrefs: NotificationPreferences = {
    emailApprovals: true,
    emailBilling: true,
    emailTeamUpdates: true,
    emailDigestDaily: false,
    inAppApprovals: true,
    inAppBilling: true,
    inAppMentions: true,
    inAppTasks: true,
  };

  try {
    const res = await api.get<unknown>("/api/v1/notification-preferences");
    const data = res.data as {
      data?: { preferences?: NotificationPreferences };
      preferences?: NotificationPreferences;
    } | undefined;

    const prefs = data?.data?.preferences || data?.preferences;
    return prefs ? { ...defaultPrefs, ...prefs } : defaultPrefs;
  } catch (error) {
    console.warn("Failed to load notification preferences:", error);
    return defaultPrefs;
  }
}

/**
 * Notification Preferences: Update toggles
 * PUT /api/v1/notification-preferences
 */
export async function updateNotificationPreferences(
  input: UpdateNotificationPreferencesInput
): Promise<NotificationPreferences> {
  const res = await api.put<unknown>("/api/v1/notification-preferences", input);
  const data = res.data as {
    data?: { preferences?: NotificationPreferences };
    preferences?: NotificationPreferences;
  } | undefined;

  const prefs = data?.data?.preferences || data?.preferences;
  return prefs ? (prefs as NotificationPreferences) : (input as NotificationPreferences);
}
