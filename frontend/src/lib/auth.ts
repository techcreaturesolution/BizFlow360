import { isAxiosError } from "axios";
import { api } from "./api";
import type {
  AuthSuccessResponse,
  ErrorResponse,
  LoginInput,
  LoginUser,
  MeSuccessResponse,
  RegisterInput,
} from "../types/auth";

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
  const response = await api.get<MeSuccessResponse>("/api/v1/auth/me");
  return response.data.data;
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
    const responseData = error.response?.data as ErrorResponse | undefined;

    if (status === 401) {
      return "Invalid email or password";
    }

    if (status === 403) {
      return responseData?.message || "Account is disabled";
    }

    if (status === 429) {
      return "Too many login attempts, please try again later";
    }

    if (status === 400) {
      if (responseData?.errors && Array.isArray(responseData.errors) && responseData.errors[0]?.message) {
        return responseData.errors[0].message;
      }
      return responseData?.message || responseData?.error || "Invalid login credentials";
    }

    if (responseData?.message || responseData?.error) {
      return responseData.message || responseData.error || "Login failed";
    }

    if (error.code === "ECONNABORTED" || error.message?.includes("Network Error") || !error.response) {
      return "Unable to reach server. Please check your connection and ensure the backend is running.";
    }
  }

  return "An unexpected error occurred during login. Please try again.";
}
