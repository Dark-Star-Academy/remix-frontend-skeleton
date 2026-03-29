import { redirect } from "react-router";
import type { Route } from "./+types/_protected.logout";
import { apiFetch, buildCsrfForwardHeaders } from "~/lib/api.server";
import { destroySession, getSession } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  // Invalidar la sesión remota con las cookies actuales (best-effort).
  await apiFetch("/auth/logout", {
    method: "POST",
    headers: {
      ...buildCsrfForwardHeaders(request, "/"),
      Cookie: request.headers.get("Cookie") ?? "",
    },
  }).catch(() => undefined);

  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}
