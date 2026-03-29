import { Link, useOutletContext } from "react-router";
import type { ProtectedOutletContext } from "./_protected";

export default function ProtectedIndexRoute() {
  const { user } = useOutletContext<ProtectedOutletContext>();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido{user.name ? `, ${user.name}` : ""}. Esta ruta está protegida
          desde el loader del servidor.
        </p>
      </header>

      <div className="border rounded-xl p-5 space-y-2">
        <p className="text-sm text-muted-foreground">Datos de sesión actuales</p>
        <p>
          <strong>ID:</strong> {user.id}
        </p>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>Rol:</strong> {user.role ?? "Sin rol"}
        </p>
      </div>

      <Link to="/users" className="underline text-sm">
        Ir al ejemplo de rutas anidadas
      </Link>
    </section>
  );
}
