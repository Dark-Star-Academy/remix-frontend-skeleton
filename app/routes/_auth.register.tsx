import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/_auth.register";
import {
  commitSession,
  getSession,
  normalizeSessionUser,
} from "~/lib/auth.server";
import {
  apiFetch,
  buildAuthForwardHeaders,
  extractCookieValue,
  extractUserFromAuthPayload,
  getSetCookieHeaders,
} from "~/lib/api.server";
import { isApiErrorResponse } from "~/lib/api-error";

function sanitizeRedirectTo(value: FormDataEntryValue | string | null) {
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
  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = sanitizeRedirectTo(formData.get("redirectTo"));

  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return { error: "Datos de registro inválidos." };
  }

  // Step 1: Register the user (returns flat user object, no auth tokens).
  const registerResponse = await apiFetch("/auth/register", {
    method: "POST",
    headers: buildAuthForwardHeaders(request, "/register", "CUSTOMER"),
    body: JSON.stringify({ firstName, lastName, email, password }),
  });

  if (!registerResponse.ok) {
    let errorMessage = "No fue posible crear la cuenta.";
    try {
      const parsed: unknown = await registerResponse.json();
      if (isApiErrorResponse(parsed)) {
        errorMessage = parsed.message;
      }
    } catch {
      // Ignore parse errors and use default message.
    }
    return { error: errorMessage };
  }

  // Step 2: Auto-login with the same credentials to obtain auth tokens.
  // The register endpoint does not issue cookies — a login call is required.
  const loginResponse = await apiFetch("/auth/login", {
    method: "POST",
    headers: buildAuthForwardHeaders(request, "/login", "CUSTOMER"),
    body: JSON.stringify({ email, password }),
  });

  if (!loginResponse.ok) {
    // Registration succeeded but auto-login failed — redirect to login.
    return redirect("/login");
  }

  const payload = (await loginResponse.json()) as unknown;
  const userCandidate = extractUserFromAuthPayload(payload);
  const user = userCandidate ? normalizeSessionUser(userCandidate) : null;

  if (!user) {
    return redirect("/login");
  }

  const setCookies = getSetCookieHeaders(loginResponse);
  const accessToken = extractCookieValue(setCookies, "access_token");
  const refreshToken = extractCookieValue(setCookies, "refresh_token");

  if (!accessToken || !refreshToken) {
    return redirect("/login");
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.set("user", user);
  session.set("accessToken", accessToken);
  session.set("refreshToken", refreshToken);

  return redirect(redirectTo, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function RegisterRoute({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Crear cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Regístrate para acceder al panel privado.
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
          <span className="text-sm font-medium">Nombre</span>
          <input
            required
            type="text"
            name="firstName"
            autoComplete="given-name"
            className="w-full border rounded-md px-3 py-2 bg-background"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Apellido</span>
          <input
            required
            type="text"
            name="lastName"
            autoComplete="family-name"
            className="w-full border rounded-md px-3 py-2 bg-background"
          />
        </label>

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
            autoComplete="new-password"
            className="w-full border rounded-md px-3 py-2 bg-background"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-foreground text-background py-2 font-medium"
        >
          Crear cuenta
        </button>
      </Form>

      <p className="text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
