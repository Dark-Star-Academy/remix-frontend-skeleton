import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/_auth.register";
import {
  apiFetch,
  buildAuthForwardHeaders,
  extractUserFromAuthPayload,
} from "~/lib/api.server";
import { commitSession, getSession, type SessionUser } from "~/lib/auth.server";

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

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return { error: "Datos de registro inválidos." };
  }

  const response = await apiFetch("/auth/register", {
    method: "POST",
    headers: buildAuthForwardHeaders(request, "/register", "ADMIN"),
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    let errorMessage = "No fue posible crear la cuenta.";
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
    // Si no devuelve usuario, redirigimos al login para autenticación manual.
    return redirect("/login");
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.set("user", user);

  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function RegisterRoute({ actionData }: Route.ComponentProps) {
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
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nombre</span>
          <input
            required
            type="text"
            name="name"
            autoComplete="name"
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
