import type { LoginUser, TenantInfo, SavedAuthState } from "../types/auth";

const ACCESS_TOKEN_KEY = "bizflow_access_token";
const REFRESH_TOKEN_KEY = "bizflow_refresh_token";
const USER_KEY = "bizflow_user";
const TENANT_KEY = "bizflow_tenant";

export function saveAuth({
  accessToken,
  refreshToken,
  user,
  tenant,
}: SavedAuthState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (tenant) {
      localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
    } else {
      localStorage.removeItem(TENANT_KEY);
    }
  } catch (error) {
    console.error("Failed to save auth state to localStorage:", error);
  }
}

export function saveAuthTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch (error) {
    console.error("Failed to save auth tokens to localStorage:", error);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAuthTokens(): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken(),
  };
}

export function getUser(): LoginUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LoginUser>;
    // Ensure fullName and roles have sensible defaults if corrupt or partial
    return {
      id: parsed.id || "",
      tenantId: parsed.tenantId !== undefined ? parsed.tenantId : null,
      fullName: parsed.fullName || (parsed as Record<string, unknown>).full_name as string || "User",
      email: parsed.email || "",
      phone: parsed.phone || null,
      roles: Array.isArray(parsed.roles) && parsed.roles.length > 0 ? parsed.roles : ["MEMBER"],
    };
  } catch {
    return null;
  }
}

export function updateUser(partialUser: Partial<LoginUser>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getUser() || {
      id: "",
      tenantId: null,
      fullName: "User",
      email: "",
      phone: null,
      roles: ["MEMBER"],
    };
    const merged: LoginUser = {
      ...existing,
      ...partialUser,
      roles: partialUser.roles || existing.roles,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error("Failed to update user in localStorage:", error);
  }
}

export function getTenant(): TenantInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TENANT_KEY);
    return raw ? (JSON.parse(raw) as TenantInfo) : null;
  } catch {
    return null;
  }
}

export function updateTenant(partialTenant: Partial<TenantInfo>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getTenant();
    if (!existing) return;
    const merged: TenantInfo = {
      ...existing,
      ...partialTenant,
    };
    localStorage.setItem(TENANT_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event("tenant_updated"));
  } catch (error) {
    console.error("Failed to update tenant in localStorage:", error);
  }
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
  } catch (error) {
    console.error("Failed to clear auth from localStorage:", error);
  }
}

export const clearAuthTokens = clearAuth;
