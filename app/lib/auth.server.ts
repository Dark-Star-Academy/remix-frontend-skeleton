import { createCookieSessionStorage, redirect } from "react-router";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("Missing SESSION_SECRET environment variable");
}

export type SessionUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
};

type SessionData = {
  user: SessionUser;
  accessToken?: string;
};

type SessionFlashData = {
  error: string;
};

const sessionStorage = createCookieSessionStorage<SessionData, SessionFlashData>(
  {
    cookie: {
      name: "__session",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      secrets: [sessionSecret],
      maxAge: 60 * 60 * 24 * 7,
    },
  },
);

export const { getSession, commitSession, destroySession } = sessionStorage;

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
