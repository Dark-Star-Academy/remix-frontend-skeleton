import { createHash } from "node:crypto";
const apiUrl = process.env.API_URL;

if (!apiUrl) {
  throw new Error("Missing API_URL environment variable");
}

type JsonRecord = Record<string, unknown>;

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
  });
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    const message = await response.text();
    throw new Response(message || "Request failed", { status: response.status });
  }

  return (await response.json()) as T;
}

export function getSetCookieHeaders(response: Response): string[] {
  const headersWithGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithGetSetCookie.getSetCookie === "function") {
    return headersWithGetSetCookie.getSetCookie();
  }

  const singleHeader = response.headers.get("set-cookie");
  return singleHeader ? [singleHeader] : [];
}

export function extractUserFromAuthPayload(payload: unknown): JsonRecord | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as JsonRecord;

  if (data.user && typeof data.user === "object") {
    return data.user as JsonRecord;
  }

  if (data.data && typeof data.data === "object") {
    const nested = data.data as JsonRecord;
    if (nested.user && typeof nested.user === "object") {
      return nested.user as JsonRecord;
    }
  }

  return null;
}

export function buildCsrfForwardHeaders(
  request: Request,
  fallbackPath: string,
): Record<string, string> {
  const requestUrl = new URL(request.url);
  const fallbackOrigin = `${requestUrl.protocol}//${requestUrl.host}`;
  const origin = request.headers.get("origin") ?? fallbackOrigin;
  const referer = request.headers.get("referer") ?? `${origin}${fallbackPath}`;

  return {
    Origin: origin,
    Referer: referer,
  };
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=");
    if (key === name) {
      return valueParts.join("=") || null;
    }
  }

  return null;
}

function buildDeviceFingerprint(request: Request): string {
  const cookieValue = getCookieValue(request.headers.get("Cookie"), "device_fp");
  if (cookieValue) {
    return cookieValue;
  }

  const userAgent = request.headers.get("user-agent") ?? "unknown-user-agent";
  const language =
    request.headers.get("accept-language")?.split(",")[0] ?? "unknown-lang";
  const platform = request.headers.get("sec-ch-ua-platform") ?? "unknown-platform";
  const timezone = request.headers.get("x-timezone") ?? "unknown-timezone";

  const digest = createHash("sha256")
    .update(`${userAgent}|${language}|${platform}`)
    .digest("hex");

  // Formato compatible con el comparador del backend (5 segmentos separados por "|").
  return `${userAgent}|${language}|server|${timezone}|${digest}`;
}

export function buildAuthForwardHeaders(
  request: Request,
  fallbackPath: string,
  frontendType: "ADMIN" | "CUSTOMER" = "ADMIN",
): Record<string, string> {
  const csrfHeaders = buildCsrfForwardHeaders(request, fallbackPath);
  const userAgent = request.headers.get("user-agent") ?? "browser-forwarded";

  return {
    ...csrfHeaders,
    "X-Device-Fingerprint": buildDeviceFingerprint(request),
    "X-Frontend-Type": frontendType,
    "User-Agent": userAgent,
  };
}
