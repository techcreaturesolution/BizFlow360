/**
 * Normalization utilities for defensive extraction of API response payloads.
 * Handles undocumented backend shapes, nested wrappers, arrays, and pagination variants.
 */

export interface NormalizedPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface NormalizedListResult<T> {
  items: T[];
  pagination: NormalizedPagination;
  raw: unknown;
}

/**
 * Extracts a list of items and pagination metadata from diverse response envelopes:
 * e.g. { data: [...] }, { data: { items: [...] } }, { data: { members: [...] } },
 * plain arrays, { meta: ... }, { pagination: ... }, etc.
 */
export function normalizeList<T = Record<string, unknown>>(
  response: unknown,
  resourceKey?: string
): NormalizedListResult<T> {
  if (!response) {
    return {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      raw: response,
    };
  }

  // 1. If response is already an array
  if (Array.isArray(response)) {
    return {
      items: response as T[],
      pagination: {
        page: 1,
        limit: response.length || 20,
        total: response.length,
        totalPages: 1,
      },
      raw: response,
    };
  }

  const obj = response as Record<string, unknown>;
  const data = obj.data as Record<string, unknown> | unknown[] | undefined;

  let items: T[] = [];

  // Check data directly if array
  if (Array.isArray(data)) {
    items = data as T[];
  } else if (data && typeof data === "object") {
    // Check specific resourceKey or common list keys
    if (resourceKey && Array.isArray(data[resourceKey])) {
      items = data[resourceKey] as T[];
    } else if (Array.isArray(data.items)) {
      items = data.items as T[];
    } else if (Array.isArray(data.rows)) {
      items = data.rows as T[];
    } else if (Array.isArray(data.list)) {
      items = data.list as T[];
    } else {
      // Find first property on data that is an array
      const arrayKey = Object.keys(data).find((k) => Array.isArray(data[k]));
      if (arrayKey) {
        items = data[arrayKey] as T[];
      }
    }
  } else if (resourceKey && Array.isArray(obj[resourceKey])) {
    items = obj[resourceKey] as T[];
  } else if (Array.isArray(obj.items)) {
    items = obj.items as T[];
  }

  // 2. Extract pagination
  const paginationObj =
    (obj.meta as Record<string, unknown> | undefined) ||
    (obj.pagination as Record<string, unknown> | undefined) ||
    (data && typeof data === "object" && !Array.isArray(data)
      ? ((data as Record<string, unknown>).meta as Record<string, unknown> | undefined) ||
        ((data as Record<string, unknown>).pagination as Record<string, unknown> | undefined)
      : undefined);

  const page = Number(paginationObj?.page || paginationObj?.currentPage || 1);
  const limit = Number(paginationObj?.limit || paginationObj?.pageSize || 20);
  const total =
    paginationObj?.total !== undefined
      ? Number(paginationObj.total)
      : paginationObj?.totalCount !== undefined
      ? Number(paginationObj.totalCount)
      : items.length;
  const totalPages =
    paginationObj?.totalPages !== undefined
      ? Number(paginationObj.totalPages)
      : Math.max(1, Math.ceil(total / (limit || 1)));

  return {
    items,
    pagination: {
      page: isNaN(page) || page < 1 ? 1 : page,
      limit: isNaN(limit) || limit < 1 ? 20 : limit,
      total: isNaN(total) ? items.length : total,
      totalPages: isNaN(totalPages) || totalPages < 1 ? 1 : totalPages,
    },
    raw: response,
  };
}

/**
 * Extracts a single resource entity from { data: { ... } }, { data: entity }, or plain object.
 */
export function normalizeItem<T = Record<string, unknown>>(
  response: unknown,
  resourceKey?: string
): T {
  if (!response || typeof response !== "object") {
    return (response ?? {}) as T;
  }

  const obj = response as Record<string, unknown>;
  const data = obj.data;

  if (resourceKey) {
    if (data && typeof data === "object" && resourceKey in (data as Record<string, unknown>)) {
      return (data as Record<string, unknown>)[resourceKey] as T;
    }
    if (resourceKey in obj) {
      return obj[resourceKey] as T;
    }
  }

  if (data !== undefined && data !== null) {
    return data as T;
  }

  return response as T;
}

/**
 * Converts camelCase, PascalCase, or snake_case keys to Title Case for UI display.
 * e.g. "totalRevenue" -> "Total Revenue", "due_invoices_count" -> "Due Invoices Count"
 */
export function formatKeyToTitle(key: string): string {
  if (!key) return "";

  // Common acronym replacements
  const ACRONYMS: Record<string, string> = {
    mrr: "MRR",
    arr: "ARR",
    kpi: "KPI",
    crm: "CRM",
    hr: "HR",
    id: "ID",
    url: "URL",
    api: "API",
    gst: "GST",
    tax: "Tax",
    ar: "AR",
    ap: "AP",
    ytd: "YTD",
  };

  const words = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/);

  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYMS[lower]) return ACRONYMS[lower];
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Detects whether a key represents currency, percentage, integer, or plain text.
 */
export function detectMetricType(
  key: string,
  value?: unknown
): "currency" | "percentage" | "number" | "text" {
  const lower = key.toLowerCase();

  // Currency indicators
  if (
    lower.includes("revenue") ||
    lower.includes("amount") ||
    lower.includes("price") ||
    lower.includes("expense") ||
    lower.includes("due") ||
    lower.includes("balance") ||
    lower.includes("total_sales") ||
    lower.includes("cashflow") ||
    lower.includes("receivable") ||
    lower.includes("payable") ||
    lower.includes("cost")
  ) {
    return "currency";
  }

  // Percentage indicators
  if (
    lower.includes("rate") ||
    lower.includes("percent") ||
    lower.includes("percentage") ||
    lower.includes("margin") ||
    lower.includes("churn") ||
    lower.includes("conversion")
  ) {
    return "percentage";
  }

  if (typeof value === "number") {
    return "number";
  }

  return "text";
}

/**
 * Formats a metric value with appropriate currency or percentage symbols.
 */
export function formatMetricValue(
  value: unknown,
  key: string,
  currency = "INR"
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const num = Number(value);
  const type = detectMetricType(key, value);

  if (isNaN(num)) {
    return String(value);
  }

  if (type === "currency") {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: (currency || "INR").toUpperCase(),
        maximumFractionDigits: 0,
      }).format(num);
    } catch {
      return `${currency.toUpperCase()} ${num.toLocaleString()}`;
    }
  }

  if (type === "percentage") {
    return `${num.toFixed(1)}%`;
  }

  return num.toLocaleString();
}
