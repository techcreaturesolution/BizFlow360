import { isAxiosError } from "axios";
import { api } from "./api";
import { getUser, updateUser } from "./storage";
import type {
  AuthSuccessResponse,
  ErrorResponse,
  LoginInput,
  LoginUser,
  MeSuccessResponse,
  RegisterInput,
} from "../types/auth";

export function normalizeLoginUser(raw: unknown): LoginUser {
  const stored = getUser();
  if (!raw || typeof raw !== "object") {
    return (
      stored || {
        id: "",
        tenantId: null,
        fullName: "User",
        email: "",
        phone: null,
        roles: ["MEMBER"],
      }
    );
  }

  const obj = raw as Record<string, unknown>;
  const source =
    (obj.user && typeof obj.user === "object" ? (obj.user as Record<string, unknown>) : null) ||
    (obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : null) ||
    obj;

  const innerSource =
    source.user && typeof source.user === "object"
      ? (source.user as Record<string, unknown>)
      : source;

  const id = String(innerSource.id || innerSource._id || innerSource.userId || stored?.id || "");
  const tenantId =
    innerSource.tenantId !== undefined
      ? (innerSource.tenantId as string | null)
      : innerSource.tenant_id !== undefined
      ? (innerSource.tenant_id as string | null)
      : stored?.tenantId || null;

  const fullName = String(
    innerSource.fullName ||
      innerSource.full_name ||
      innerSource.name ||
      stored?.fullName ||
      (innerSource.email ? String(innerSource.email).split("@")[0] : "User")
  );

  const email = String(innerSource.email || stored?.email || "");
  const phone =
    (innerSource.phone as string | null) ||
    (innerSource.phoneNumber as string | null) ||
    (innerSource.phone_number as string | null) ||
    stored?.phone ||
    null;

  let roles: string[] = [];
  if (Array.isArray(innerSource.roles) && innerSource.roles.length > 0) {
    roles = innerSource.roles.map(String);
  } else if (Array.isArray(innerSource.role)) {
    roles = innerSource.role.map(String);
  } else if (typeof innerSource.role === "string" && innerSource.role) {
    roles = [innerSource.role];
  } else if (stored?.roles && stored.roles.length > 0) {
    roles = stored.roles;
  } else {
    roles = ["MEMBER"];
  }

  const normalized: LoginUser = {
    id,
    tenantId,
    fullName,
    email,
    phone,
    roles,
  };

  updateUser(normalized);
  return normalized;
}

export async function registerUser(payload: RegisterInput): Promise<AuthSuccessResponse> {
  const sanitizedPhone =
    payload.phone && payload.phone.trim().length > 0
      ? payload.phone.trim().replace(/[\s-]+/g, "")
      : null;

  const body: RegisterInput = {
    fullName: payload.fullName.trim(),
    email: payload.email.trim().toLowerCase(),
    phone: sanitizedPhone,
    password: payload.password,
    confirmPassword: payload.confirmPassword,
    companyName: payload.companyName.trim(),
    workspaceSlug: payload.workspaceSlug.trim().toLowerCase(),
    timezone: payload.timezone || "Asia/Kolkata",
    defaultCurrency: payload.defaultCurrency || "INR",
  };

  const response = await api.post<AuthSuccessResponse>("/api/v1/auth/register", body);
  return response.data;
}

export async function loginUser(payload: LoginInput): Promise<AuthSuccessResponse> {
  const body: LoginInput = {
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  };

  const response = await api.post<AuthSuccessResponse>("/api/v1/auth/login", body);
  return response.data;
}

export async function getMe(): Promise<LoginUser> {
  try {
    const response = await api.get<unknown>("/api/v1/auth/me");
    return normalizeLoginUser(response.data);
  } catch (error) {
    const stored = getUser();
    if (stored) {
      return stored;
    }
    throw error;
  }
}

export interface ParsedError {
  message: string;
  fieldErrors: Record<string, string>;
  statusCode?: number;
  code?: string;
}

export function parseRegisterError(error: unknown): ParsedError {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const responseData = error.response?.data as ErrorResponse | undefined;
    const fieldErrors: Record<string, string> = {};

    // 429: Too many attempts
    if (status === 429) {
      return {
        message: "Too many attempts, please try again later",
        fieldErrors,
        statusCode: 429,
        code: "TOO_MANY_REQUESTS",
      };
    }

    // 409: Conflict (duplicate email or workspace slug)
    if (status === 409) {
      const message =
        responseData?.message ||
        responseData?.error ||
        "Email or workspace slug already exists";

      const lower = message.toLowerCase();
      if (lower.includes("email")) {
        fieldErrors.email = "This email is already registered";
      }
      if (lower.includes("workspace") || lower.includes("slug")) {
        fieldErrors.workspaceSlug = "This workspace URL is already taken";
      }

      return {
        message,
        fieldErrors,
        statusCode: 409,
        code: responseData?.code || "CONFLICT",
      };
    }

    // 400: Validation error
    if (status === 400) {
      if (responseData?.errors && Array.isArray(responseData.errors)) {
        responseData.errors.forEach((err) => {
          if (err.field && err.message) {
            fieldErrors[err.field] = err.message;
          }
        });
      }

      const message =
        responseData?.message ||
        responseData?.error ||
        "Validation error. Please verify the fields below.";

      return {
        message,
        fieldErrors,
        statusCode: 400,
        code: responseData?.code || "VALIDATION_ERROR",
      };
    }

    // Any other response error
    if (responseData?.message || responseData?.error) {
      return {
        message: responseData.message || responseData.error || "Request failed",
        fieldErrors,
        statusCode: status,
        code: responseData.code,
      };
    }

    // Network / timeout error
    if (error.code === "ECONNABORTED" || error.message?.includes("Network Error") || !error.response) {
      return {
        message: "Unable to reach server. Please check your connection and ensure the backend is running.",
        fieldErrors,
        statusCode: 0,
        code: "NETWORK_ERROR",
      };
    }
  }

  return {
    message: "An unexpected error occurred. Please try again.",
    fieldErrors: {},
  };
}

export function parseLoginError(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const responseData = error.response?.data;

    if (status === 401) {
      return "Invalid email or password";
    }

    if (status === 403) {
      if (typeof responseData === "object" && responseData && "message" in responseData) {
        return String((responseData as Record<string, unknown>).message);
      }
      return "Account is disabled";
    }

    if (status === 429) {
      return "Too many login attempts, please try again later";
    }

    if (status === 400) {
      if (typeof responseData === "object" && responseData) {
        const dObj = responseData as Record<string, unknown>;
        if (Array.isArray(dObj.errors) && dObj.errors[0]?.message) {
          return String(dObj.errors[0].message);
        }
        if (dObj.message || dObj.error) {
          return String(dObj.message || dObj.error);
        }
      }
      return "Invalid login credentials";
    }

    if (status === 500) {
      if (typeof responseData === "object" && responseData) {
        const dObj = responseData as Record<string, unknown>;
        if (dObj.message && dObj.message !== "Something went wrong") {
          return String(dObj.message);
        }
      }
      return "The cloud database (Supabase) is currently sleeping, paused, or waking up. If you are on Supabase free tier, please check your Supabase dashboard and restore the project.";
    }

    if (status === 502 || status === 503 || status === 504) {
      if (typeof responseData === "object" && responseData) {
        const dObj = responseData as Record<string, unknown>;
        if (dObj.message) {
          return String(dObj.message);
        }
      }
      return "Unable to connect to the cloud backend or database. If using free tiers (Render/Supabase), they may be waking up from sleep. Please wait a moment and try again.";
    }

    if (typeof responseData === "object" && responseData) {
      const dObj = responseData as Record<string, unknown>;
      if (dObj.message || dObj.error) {
        return String(dObj.message || dObj.error);
      }
    } else if (typeof responseData === "string" && responseData.trim() && !responseData.includes("<")) {
      return responseData.trim();
    }

    if (error.code === "ECONNABORTED" || error.message?.includes("Network Error") || !error.response) {
      return "Unable to reach server. Please check your connection and ensure the backend is running.";
    }
  }

  return "An unexpected error occurred during login. Please try again.";
}
