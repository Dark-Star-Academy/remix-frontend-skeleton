import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/_auth.login";
import { commitSession, getSession, type SessionUser } from "~/lib/auth.server";
import {
  apiFetch,
  buildAuthForwardHeaders,
  extractUserFromAuthPayload,
  getSetCookieHeaders,
} from "~/lib/api.server";

function normalizeUser(candidate: Record<string, unknown>): SessionUser | null {
  const rawId = candidate.id;
  const rawEmail = candidate.email;
  const rawName = candidate.name;
  const rawRole = candidate.role;

  if (
    (typeof rawId !== "string" && typeof rawId !== "number") ||
    typeof rawEmail !== "string"
  ) {
    return null;
  }

  return {
    id: String(rawId),
    email: rawEmail,
    name: typeof rawName === "string" ? rawName : undefined,
    role: typeof rawRole === "string" ? rawRole : undefined,
  };
}

function sanitizeRedirectTo(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/";
  }

  return value;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = sanitizeRedirectTo(url.searchParams.get("redirectTo"));
  return { redirectTo };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = sanitizeRedirectTo(formData.get("redirectTo"));

  if (typeof email !== "string" || typeof password !== "string") {
    return {
      error: "Credenciales inválidas.",
    };
  }

  const response = await apiFetch("/auth/login", {
    method: "POST",
    headers: buildAuthForwardHeaders(request, "/login", "ADMIN"),
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let errorMessage = "No fue posible iniciar sesión.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        errorMessage = payload.message;
      }
    } catch {
      // Ignore parse errors and use default message.
    }

    return { error: errorMessage };
  }

  const payload = (await response.json()) as unknown;
  const userCandidate = extractUserFromAuthPayload(payload);
  const user = userCandidate ? normalizeUser(userCandidate) : null;

  if (!user) {
    return { error: "La respuesta del servidor no incluye un usuario válido." };
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.set("user", user);

  const headers = new Headers();
  headers.append("Set-Cookie", await commitSession(session));
  for (const setCookie of getSetCookieHeaders(response)) {
    headers.append("Set-Cookie", setCookie);
  }

  return redirect(redirectTo, { headers });
}

export default function LoginRoute({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground">
          Accede con tu cuenta para continuar.
        </p>
      </header>

      {actionData?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {actionData.error}
        </p>
      ) : null}

      <Form method="post" className="space-y-4">
        <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />

        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            className="w-full border rounded-md px-3 py-2 bg-background"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            required
            type="password"
            name="password"
            autoComplete="current-password"
            className="w-full border rounded-md px-3 py-2 bg-background"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-foreground text-background py-2 font-medium"
        >
          Entrar
        </button>
      </Form>

      <p className="text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link to="/register" className="underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
