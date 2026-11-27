/**
 * Type definitions for the Business Owner (Tenant) Dashboard and Modules.
 */

export type DashboardPeriod = "TODAY" | "7D" | "30D" | "90D" | "YTD" | "CUSTOM";

export interface DashboardSummaryParams {
  period?: DashboardPeriod;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  branch_id?: string;
  department_id?: string;
  owner_user_id?: string;
  status?: string;
}

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type WidgetType =
  | "REVENUE_KPI"
  | "PIPELINE"
  | "DUE_INVOICES"
  | "EXPENSES"
  | "TASKS"
  | "ORG_COUNTS"
  | "RECENT_ACTIVITY"
  | "CHART_MONTHLY"
  | "CUSTOM";

export interface DashboardWidgetConfig {
  widgetId: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  isVisible?: boolean;
  settings?: Record<string, unknown>;
}

export interface PutWidgetsInput {
  layoutName?: string;
  widgets: DashboardWidgetConfig[];
}

export interface AddressObject {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}

export interface NumberingPreferences {
  invoicePrefix?: string;
  quotationPrefix?: string;
  orderPrefix?: string;
  nextInvoiceNumber?: number;
  resetAnnually?: boolean;
}

export interface ModulePreferences {
  enableMultiBranch?: boolean;
  defaultTaxRate?: number;
  [key: string]: unknown;
}

export interface CompanyProfile {
  id?: string;
  name: string;
  legalName?: string | null;
  slug: string;
  logoUrl?: string | null;
  address?: AddressObject | null;
  taxId?: string | null;
  locale?: string;
  defaultCurrency?: string;
  timezone?: string;
  financialYear?: string;
  numberingPreferences?: NumberingPreferences | null;
  modulePreferences?: ModulePreferences | null;
  status?: string;
}

export interface UpdateCompanyInput {
  name?: string;
  legalName?: string;
  logoUrl?: string;
  address?: AddressObject;
  taxId?: string;
  locale?: string;
  defaultCurrency?: string;
  timezone?: string;
  financialYear?: string;
  numberingPreferences?: NumberingPreferences;
  modulePreferences?: ModulePreferences;
}

export interface BranchItem {
  id: string;
  name: string;
  code: string;
  address?: AddressObject | null;
  status?: string;
  isHeadOffice?: boolean;
}

export interface CreateBranchInput {
  name: string;
  code: string;
  address?: AddressObject;
  status?: "ACTIVE" | "INACTIVE";
  isHeadOffice?: boolean;
}

export interface UpdateBranchInput {
  id?: string;
  name?: string;
  code?: string;
  address?: AddressObject;
  status?: "ACTIVE" | "INACTIVE";
  isHeadOffice?: boolean;
}

export interface DepartmentItem {
  id: string;
  name: string;
  branchId?: string | null;
  branch?: { id: string; name: string; code: string } | null;
  managerUserId?: string | null;
  manager?: { id: string; fullName: string; email: string } | null;
  status?: string;
}

export interface CreateDepartmentInput {
  name: string;
  branchId?: string | null;
  managerUserId?: string | null;
  status?: "ACTIVE" | "INACTIVE";
}

export interface TeamMemberRef {
  id?: string;
  userId: string;
  fullName?: string;
  email?: string;
  roleName?: string;
}

export interface TeamItem {
  id: string;
  name: string;
  description?: string | null;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  parentTeamId?: string | null;
  parentTeam?: { id: string; name: string } | null;
  managerUserId?: string | null;
  manager?: { id: string; fullName: string; email: string } | null;
  memberIds?: string[];
  members?: TeamMemberRef[];
  status?: string;
}

export interface CreateTeamInput {
  name: string;
  description?: string;
  departmentId?: string | null;
  parentTeamId?: string | null;
  managerUserId?: string | null;
  memberIds?: string[];
  status?: "ACTIVE" | "INACTIVE";
}

export interface StaffUserItem {
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  roleName?: string;
  status?: string;
}

export interface TeamMember {
  membershipId?: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  roles: string[];
  roleName?: string;
  status: string;
  isActive: boolean;
  branchId?: string | null;
  departmentId?: string | null;
  joinedAt?: string | null;
  createdAt?: string;
}

export interface TeamMembersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GetTeamMembersResponse {
  members: TeamMember[];
  pagination: TeamMembersPagination;
}

export interface InviteMemberInput {
  email: string;
  fullName: string;
  roleId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
}

export interface InvitationData {
  id?: string;
  email: string;
  fullName: string;
  roleName?: string;
  status: string;
  expiresAt?: string;
  inviteLink?: string;
}

export interface RolePermissionItem {
  id: string;
  code: string;
  moduleCode: string;
  description?: string | null;
}

export interface RoleItem {
  id: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  permissions?: string[];
}

export interface RolesListResponseData {
  roles: RoleItem[];
  availablePermissions: RolePermissionItem[];
}

export interface CreateRoleInput {
  name: string;
  description?: string;
}

export interface ModuleEntitlement {
  moduleCode: string;
  enabled: boolean;
  is_enabled?: boolean;
}

export interface TenantSubscriptionInfo {
  id?: string;
  planId?: string | null;
  planName?: string | null;
  status?: string;
  renewalDate?: string | null;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  modules?: ModuleEntitlement[];
  entitlements?: ModuleEntitlement[];
}

export interface NotificationItem {
  id: string;
  tenantId?: string;
  userId?: string;
  category: NotificationCategory | string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ApprovalEntityType = "QUOTATION" | "EXPENSE" | "PURCHASE_ORDER" | "LEAVE_REQUEST";

export interface ApprovalItem {
  id: string;
  entityType: ApprovalEntityType | string;
  entityId: string;
  entityNumber?: string | null;
  title: string;
  amount?: number | null;
  currency?: string | null;
  status: ApprovalStatus | string;
  requestedBy?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
  } | null;
  approverUserId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  decisionComment?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface ApprovalPendingCount {
  entityType: string;
  count: number;
}

export interface ApprovalInboxResponse {
  approvals: ApprovalItem[];
  pendingCountsByType?: ApprovalPendingCount[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApproveDecisionInput {
  comment?: string;
}

export interface RejectDecisionInput {
  reason: string;
  comment?: string;
}

export type NotificationCategory =
  | "APPROVAL"
  | "BILLING"
  | "TEAM"
  | "SALES"
  | "FINANCE"
  | "GENERAL";

export interface NotificationsListResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationPreferences {
  emailApprovals: boolean;
  emailBilling: boolean;
  emailTeamUpdates: boolean;
  emailDigestDaily: boolean;
  inAppApprovals: boolean;
  inAppBilling: boolean;
  inAppMentions: boolean;
  inAppTasks: boolean;
}

export type UpdateNotificationPreferencesInput = Partial<NotificationPreferences>;

export type AnalyticsTab = "sales" | "finance" | "hr" | "projects";

export type ReportType =
  | "DASHBOARD_SUMMARY"
  | "SALES"
  | "FINANCE"
  | "HR"
  | "PROJECTS"
  | "TEAM"
  | "AUDIT_LOGS";

export type ExportFormat = "CSV" | "XLSX" | "PDF";

export interface CreateExportJobInput {
  reportType: ReportType;
  format: ExportFormat;
  filters?: Record<string, unknown>;
}

export interface ExportJobItem {
  id: string;
  reportType: string;
  format: string;
  status: "PENDING" | "PROCESSING" | "QUEUED" | "COMPLETED" | "FAILED" | string;
  createdAt: string;
  url?: string | null;
  fileUrl?: string | null;
  downloadUrl?: string | null;
  error?: string | null;
  message?: string | null;
}
