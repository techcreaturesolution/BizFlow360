export interface RegisterInput {
  fullName: string;
  email: string;
  phone?: string | null;
  password: string;
  confirmPassword?: string;
  companyName: string;
  workspaceSlug: string;
  timezone: string;
  defaultCurrency: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginUser {
  id: string;
  tenantId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  roles: string[];
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  defaultCurrency: string;
  planId: string | null;
}

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  user: LoginUser;
  tenant: TenantInfo | null;
}

export interface AuthSuccessResponse {
  success: boolean;
  data: AuthData;
}

export interface MeSuccessResponse {
  success: boolean;
  data: LoginUser;
}

export interface ErrorResponse {
  success: boolean;
  code?: string;
  message: string;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface SavedAuthState {
  accessToken: string;
  refreshToken: string;
  user: LoginUser;
  tenant: TenantInfo | null;
}
