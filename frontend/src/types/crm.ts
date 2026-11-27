/**
 * CRM Module TypeScript Definitions
 */

export type { NormalizedPagination } from "@/lib/normalize";

export type LeadStage =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type LeadPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ActivityType =
  | "NOTE"
  | "CALL"
  | "EMAIL"
  | "MEETING"
  | "STAGE_CHANGE"
  | "ASSIGNMENT";

export type FollowupStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";

export type CustomerType = "B2B" | "B2C" | "ENTERPRISE" | "PARTNER";

export type CustomerStatus = "ACTIVE" | "INACTIVE";

export interface PipelineStageItem {
  stage: LeadStage;
  count: number;
  totalValue: number;
}

export interface PipelineData {
  scope: "COMPANY_WIDE" | "ASSIGNED_ONLY";
  pipeline: PipelineStageItem[];
}

export interface LeadItem {
  id: string;
  tenantId: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: LeadStage;
  priority: LeadPriority;
  estimatedValue: number;
  currency: string;
  ownerUserId: string | null;
  ownerName?: string | null;
  nextFollowupAt: string | null;
  convertedCustomerId: string | null;
  convertedAt: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  id: string;
  tenantId: string;
  leadId: string;
  actorUserId: string;
  actorName?: string | null;
  activityType: ActivityType;
  summary: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface LeadFollowup {
  id: string;
  tenantId: string;
  leadId: string;
  assignedToUserId: string | null;
  scheduledAt: string;
  status: FollowupStatus;
  notes: string | null;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LeadDetail {
  lead: LeadItem;
  activities: LeadActivity[];
  followups: LeadFollowup[];
}

export interface CustomerItem {
  id: string;
  tenantId: string;
  customerCode: string;
  name: string;
  customerType: CustomerType;
  status: CustomerStatus;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  paymentTermsDays: number;
  creditLimit: number;
  currency: string;
  billingAddress?: Record<string, unknown> | null;
  ownerUserId: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LeadsQueryParams {
  stage?: LeadStage | "ALL";
  priority?: LeadPriority | "ALL";
  ownerUserId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CustomersQueryParams {
  customerType?: CustomerType | "ALL";
  status?: CustomerStatus | "ALL";
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateLeadInput {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: string;
  stage?: LeadStage;
  priority?: LeadPriority;
  estimatedValue?: number;
  ownerUserId?: string;
  nextFollowupAt?: string;
  notes?: string;
}

export interface UpdateLeadInput extends Partial<CreateLeadInput> {}

export interface AssignLeadInput {
  ownerUserId: string;
  note?: string;
}

export interface CreateLeadActivityInput {
  activityType: "NOTE" | "CALL" | "EMAIL" | "MEETING";
  summary: string;
  details?: Record<string, unknown>;
}

export interface CreateLeadFollowupInput {
  scheduledAt: string;
  assignedToUserId?: string;
  notes?: string;
}

export interface UpdateFollowupInput {
  status?: FollowupStatus;
  scheduledAt?: string;
  notes?: string;
}

export interface ConvertLeadInput {
  customerCode?: string;
  customerType?: CustomerType;
  taxId?: string;
  paymentTermsDays?: number;
  creditLimit?: number;
}

export interface CreateCustomerInput {
  customerCode?: string;
  name: string;
  customerType?: CustomerType;
  email?: string;
  phone?: string;
  taxId?: string;
  paymentTermsDays?: number;
  creditLimit?: number;
  billingAddress?: Record<string, unknown>;
}
