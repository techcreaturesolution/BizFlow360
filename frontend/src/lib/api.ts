import axios from "axios";
import { clearAuth, getAccessToken } from "./storage";

// In the browser, using a relative path ("") routes API requests through the Next.js
// proxy rewrite in next.config.mjs. This eliminates cross-origin browser CORS blocks
// and connection refused errors. On the server side, it falls back to the full Render backend URL.
const getBaseURL = () => {
  if (typeof window !== "undefined") {
    if (process.env.NEXT_PUBLIC_USE_PROXY === "false") {
      return process.env.NEXT_PUBLIC_API_URL || "https://bizflow360-p3sp.onrender.com";
    }
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
  timeout: 60000,
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
