import { createCookieSessionStorage, redirect } from "react-router";
import {
  apiFetch,
  extractCookieValue,
  extractUserFromAuthPayload,
  getSetCookieHeaders,
} from "~/lib/api.server";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("Missing SESSION_SECRET environment variable");
}

export type SessionUser = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
};

type SessionData = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
};

const sessionStorage = createCookieSessionStorage<SessionData>({
  cookie: {
    name: "__session",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    secrets: [sessionSecret],
    maxAge: 60 * 60 * 24 * 7,
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

// Converts the backend user payload (from login/refresh responses) into a SessionUser.
// Handles the { user: { userId, email, firstName, lastName, role, status } } shape.
// Returns null if required fields (userId, email) are missing.
export function normalizeSessionUser(
  candidate: Record<string, unknown>,
): SessionUser | null {
  const userId = candidate.userId;
  const email = candidate.email;
  const firstName = candidate.firstName;
  const lastName = candidate.lastName;
  const role = candidate.role;
  const status = candidate.status;

  if (
    (typeof userId !== "string" && typeof userId !== "number") ||
    typeof email !== "string"
  ) {
    return null;
  }

  return {
    userId: String(userId),
    email,
    firstName: typeof firstName === "string" ? firstName : "",
    lastName: typeof lastName === "string" ? lastName : "",
    role: typeof role === "string" ? role : "UNKNOWN",
    status: typeof status === "string" ? status : "UNKNOWN",
  };
}

export async function getUser(request: Request): Promise<SessionUser | null> {
  const session = await getSession(request.headers.get("Cookie"));
  return session.get("user") ?? null;
}

export async function requireUser(
  request: Request,
  redirectTo = "/login",
): Promise<SessionUser> {
  const user = await getUser(request);

  if (!user) {
    const url = new URL(request.url);
    const returnTo = `${url.pathname}${url.search}`;
    const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
    throw redirect(`${redirectTo}?redirectTo=${encodeURIComponent(safeReturnTo)}`);
  }

  return user;
}

// Reads user + both tokens from the session.
// Returns null if any of the three are missing (e.g. old session without tokens).
export async function getSessionTokens(request: Request): Promise<{
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
} | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("user") ?? null;
  const accessToken = session.get("accessToken") ?? null;
  const refreshToken = session.get("refreshToken") ?? null;

  if (!user || !accessToken || !refreshToken) return null;

  return { user, accessToken, refreshToken };
}

// Central utility for all loaders/actions that call authenticated Ktor endpoints.
//
// Passes the current access token to `call`. On 401, attempts a silent token
// refresh using the stored refresh token, updates the session, and retries once.
// On refresh failure, destroys the session and redirects to /login.
//
// The caller MUST include sessionHeaders in their Remix response when non-empty,
// otherwise a refreshed session is never persisted to the browser.
//
// Usage:
//   const { data, sessionHeaders } = await callWithRefresh<MyType>(request, (token) =>
//     apiFetch("/some-path", { headers: { Cookie: `access_token=${token}` } })
//   );
//   return data({ items: data }, { headers: sessionHeaders });
export async function callWithRefresh<T>(
  request: Request,
  call: (accessToken: string) => Promise<Response>,
): Promise<{ data: T; sessionHeaders: Headers }> {
  const tokens = await getSessionTokens(request);

  if (!tokens) {
    const url = new URL(request.url);
    const returnTo = `${url.pathname}${url.search}`;
    throw redirect(`/login?redirectTo=${encodeURIComponent(returnTo)}`);
  }

  // First attempt with current access token.
  let response = await call(tokens.accessToken);

  if (response.ok) {
    const data = (await response.json()) as T;
    return { data, sessionHeaders: new Headers() };
  }

  // Only retry on 401 — other errors are surfaced immediately.
  if (response.status !== 401) {
    const text = await response.text();
    throw new Response(text || "Request failed", { status: response.status });
  }

  // Access token expired — attempt refresh using the stored refresh token.
  const refreshResponse = await apiFetch("/auth/refresh", {
    method: "POST",
    headers: {
      Cookie: `refresh_token=${tokens.refreshToken}`,
    },
  });

  if (!refreshResponse.ok) {
    // Refresh failed (revoked session, banned user, etc.) — force re-login.
    const session = await getSession(request.headers.get("Cookie"));
    throw redirect("/login", {
      headers: { "Set-Cookie": await destroySession(session) },
    });
  }

  // Parse rotated tokens and updated user from the refresh response.
  const refreshPayload = (await refreshResponse.json()) as unknown;
  const userCandidate = extractUserFromAuthPayload(refreshPayload);
  const newUser = userCandidate ? normalizeSessionUser(userCandidate) : null;

  const refreshSetCookies = getSetCookieHeaders(refreshResponse);
  const newAccessToken = extractCookieValue(refreshSetCookies, "access_token");
  const newRefreshToken = extractCookieValue(refreshSetCookies, "refresh_token");

  if (!newUser || !newAccessToken || !newRefreshToken) {
    const session = await getSession(request.headers.get("Cookie"));
    throw redirect("/login", {
      headers: { "Set-Cookie": await destroySession(session) },
    });
  }

  // Persist the new tokens and user in the session.
  const session = await getSession(request.headers.get("Cookie"));
  session.set("user", newUser);
  session.set("accessToken", newAccessToken);
  session.set("refreshToken", newRefreshToken);
  const newSessionCookie = await commitSession(session);

  const sessionHeaders = new Headers();
  sessionHeaders.set("Set-Cookie", newSessionCookie);

  // Retry the original call with the new access token.
  response = await call(newAccessToken);

  if (!response.ok) {
    const text = await response.text();
    throw new Response(text || "Request failed", { status: response.status });
  }

  const data = (await response.json()) as T;
  return { data, sessionHeaders };
}
