import { Form, Link, Outlet } from "react-router";
import type { Route } from "./+types/_protected";
import { requireUser, type SessionUser } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export type ProtectedOutletContext = {
  user: SessionUser;
};

export default function ProtectedLayout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold">Zona privada</p>
            <p className="text-sm text-muted-foreground">{loaderData.user.email}</p>
          </div>

          <nav className="flex items-center gap-4">
            <Link to="/" className="text-sm underline">
              Dashboard
            </Link>
            <Link to="/users" className="text-sm underline">
              Users demo
            </Link>

            <Form method="post" action="/logout">
              <button type="submit" className="text-sm underline">
                Cerrar sesión
              </button>
            </Form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet context={{ user: loaderData.user } satisfies ProtectedOutletContext} />
      </main>
    </div>
  );
}
