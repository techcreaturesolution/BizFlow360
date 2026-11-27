import axios from "axios";
import { clearAuth, getAccessToken } from "./storage";

// Determine the backend base URL.
// In the browser, we default to "" (relative URL) so all calls route through the
// Next.js rewrite proxy configured in next.config.mjs (/api/:path* -> Render).
// This completely avoids browser cross-origin CORS policy blocks.
const getBaseURL = () => {
  if (typeof window !== "undefined") {
    // When direct API is explicitly requested via NEXT_PUBLIC_DIRECT_API === "true", use direct URL
    if (process.env.NEXT_PUBLIC_DIRECT_API === "true") {
      return (
        process.env.NEXT_PUBLIC_API_URL ||
        "https://bizflow360-p3sp.onrender.com"
      );
    }
    // Default in browser: use Next.js rewrite proxy (same-origin, zero CORS issues)
    return "";
  }
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://bizflow360-p3sp.onrender.com"
  );
};

export const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 90000, // 90s to comfortably tolerate Render free-tier cold starts
});

// Request interceptor: attach Bearer token if available
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 on protected requests
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url || "";
      const isAuthEndpoint =
        url.includes("/api/v1/auth/login") || url.includes("/api/v1/auth/register");

      if (!isAuthEndpoint) {
        clearAuth();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login?session=expired";
        }
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Generates or reuses an Idempotency-Key header for state-mutating requests.
 * Use once per user action; pass the returned key on retries of the exact same action.
 */
export function withIdempotency(existingKey?: string): {
  headers: { "Idempotency-Key": string };
  key: string;
} {
  const key =
    existingKey ||
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`);
  return {
    headers: {
      "Idempotency-Key": key,
    },
    key,
  };
}
