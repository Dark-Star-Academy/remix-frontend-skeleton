import { Outlet, redirect } from "react-router";
import type { Route } from "./+types/_auth";
import { getUser } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (user) {
    throw redirect("/");
  }

  return null;
}

export default function AuthLayout() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-xl p-6 bg-background">
        <Outlet />
      </div>
    </main>
  );
}
