import { createHash } from "node:crypto";
import { ApiError, isApiErrorResponse } from "~/lib/api-error";
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
    // Read body once — the stream can only be consumed once.
    const text = await response.text();

    // Attempt to parse as structured backend ErrorResponse.
    try {
      const parsed: unknown = JSON.parse(text);
      if (isApiErrorResponse(parsed)) {
        throw new ApiError(parsed);
      }
    } catch (e) {
      // Re-throw ApiError — it was constructed inside the try, not from JSON.parse.
      // Without this, it would be swallowed by the catch and fall through to the Response throw.
      if (e instanceof ApiError) throw e;
      // JSON.parse failed or shape didn't match — fall through.
    }

    // Fallback for unstructured errors (nginx 502, plain text, etc.)
    throw new Response(text || "Request failed", { status: response.status });
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

// Parses a specific cookie value from an array of Set-Cookie response header strings.
// Each string has the format: "name=value; Path=/; HttpOnly; Max-Age=900"
// Only the first segment (before the first ";") is inspected.
export function extractCookieValue(
  setCookieHeaders: string[],
  name: string,
): string | null {
  for (const header of setCookieHeaders) {
    const firstSegment = header.split(";")[0]?.trim() ?? "";
    const eqIndex = firstSegment.indexOf("=");
    if (eqIndex === -1) continue;

    const cookieName = firstSegment.slice(0, eqIndex).trim();
    const cookieValue = firstSegment.slice(eqIndex + 1).trim();

    if (cookieName === name && cookieValue.length > 0) {
      return cookieValue;
    }
  }
  return null;
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

// Used only for anonymous endpoints (login, register) where device fingerprint is relevant.
// Protected API calls use Cookie: access_token=<value> directly — no CSRF headers needed
// because server-to-server calls carry no csrf_token cookie, and Ktor's CsrfPlugin
// skips validation when that cookie is absent.
export function buildAuthForwardHeaders(
  request: Request,
  fallbackPath: string,
  frontendType: "ADMIN" | "CUSTOMER" = "ADMIN",
): Record<string, string> {
  const requestUrl = new URL(request.url);
  const fallbackOrigin = `${requestUrl.protocol}//${requestUrl.host}`;
  const origin = request.headers.get("origin") ?? fallbackOrigin;
  const referer = request.headers.get("referer") ?? `${origin}${fallbackPath}`;
  const userAgent = request.headers.get("user-agent") ?? "browser-forwarded";

  return {
    Origin: origin,
    Referer: referer,
    "X-Device-Fingerprint": buildDeviceFingerprint(request),
    "X-Frontend-Type": frontendType,
    "User-Agent": userAgent,
  };
}

// Reads device_fp cookie or derives a SHA-256 fingerprint from request headers.
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

  // Format compatible with the backend comparator (5 segments separated by "|").
  return `${userAgent}|${language}|server|${timezone}|${digest}`;
}

// Parses a cookie value from a request Cookie header string.
// Format: "name=val; name2=val2" (different from Set-Cookie headers).
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
