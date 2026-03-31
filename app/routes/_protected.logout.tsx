import { redirect } from "react-router";
import type { Route } from "./+types/_protected.logout";
import { apiFetch } from "~/lib/api.server";
import { destroySession, getSession, getSessionTokens } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const tokens = await getSessionTokens(request);

  if (tokens) {
    // Best-effort: invalidate the Ktor session.
    // No csrf_token cookie is sent → Ktor's CsrfPlugin skips CSRF validation automatically.
    await apiFetch("/auth/logout", {
      method: "POST",
      headers: {
        Cookie: `access_token=${tokens.accessToken}`,
      },
    }).catch(() => undefined);
  }

  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}
