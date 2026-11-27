import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://bizflow360-p3sp.onrender.com";

// Maximum timeout before failing gracefully
const PROXY_TIMEOUT_MS = 50000;

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const path = Array.isArray(pathSegments) ? pathSegments.join("/") : "";
  const searchParams = req.nextUrl.search;
  const targetUrl = `${BACKEND_BASE_URL}/api/${path}${searchParams}`;

  // Clone headers - omit headers that interfere with upstream fetch
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!["host", "connection", "content-length", "cookie"].includes(lowerKey)) {
      headers.set(key, value);
    }
  });

  // Extract body for mutating HTTP methods
  let body: ArrayBuffer | undefined = undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    try {
      body = await req.arrayBuffer();
    } catch {
      body = undefined;
    }
  }

  // Create an abort controller for timeout safety
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const res = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    res.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!["content-encoding", "transfer-encoding", "content-length"].includes(lower)) {
        responseHeaders.set(key, value);
      }
    });

    const data = await res.arrayBuffer();

    // Check if the backend responded with 500 INTERNAL_ERROR (typically Supabase DB connection paused or timeout)
    if (res.status === 500) {
      try {
        const text = new TextDecoder().decode(data);
        if (text.includes("INTERNAL_ERROR") || text.includes("Something went wrong")) {
          return NextResponse.json(
            {
              success: false,
              code: "DATABASE_UNAVAILABLE",
              message:
                "The cloud database (Supabase) is sleeping or paused. Please restore the project from your Supabase dashboard or wait a moment while it reconnects.",
            },
            { status: 503, headers: responseHeaders }
          );
        }
      } catch {
        // Fallback to normal response forwarding
      }
    }

    return new NextResponse(data, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.message?.includes("aborted"));
    const message = err instanceof Error ? err.message : "Proxy request failed";
    console.error(`[API Proxy Error] ${req.method} ${targetUrl}:`, message);

    if (isTimeout) {
      return NextResponse.json(
        {
          success: false,
          code: "BACKEND_TIMEOUT",
          message:
            "The backend server or database took too long to respond (>50s). This usually happens when the Supabase database is paused or Render is waking up.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: "BACKEND_UNREACHABLE",
        message:
          "Unable to communicate with the cloud backend service. Please check your network connection or verify the backend status.",
      },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params.path);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params.path);
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params.path);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params.path);
}
