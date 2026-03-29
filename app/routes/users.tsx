// Ruta: /users  (actúa como LAYOUT para todas las rutas /users/*)
//
// Cuando un archivo y sus "hijos" comparten el mismo prefijo de nombre
// (ej: users.tsx, users._index.tsx, users.$id.tsx), React Router trata
// al archivo padre como un LAYOUT: lo monta una sola vez y renderiza la
// ruta hija activa dentro de su <Outlet />.
//
// <NavLink> es como <Link> pero recibe una función para aplicar estilos
// según si la ruta está activa (isActive) o en transición (isPending).

import { Link, NavLink, Outlet } from "react-router";
import { USERS } from "~/lib/mock-users";

export default function UsersLayout() {
  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-56 border-r p-4 flex flex-col gap-1">
        <Link
          to="/"
          className="text-xs text-gray-400 hover:text-gray-600 mb-3 block"
        >
          ← Inicio
        </Link>

        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
          Sección usuarios
        </p>

        {/* "end" hace que /users no quede activo cuando estamos en /users/1 */}
        <NavLink
          to="/users"
          end
          className={({ isActive }) =>
            `block px-3 py-2 rounded text-sm ${
              isActive
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "hover:bg-gray-50"
            }`
          }
        >
          Todos los usuarios
        </NavLink>

        {USERS.map((user) => (
          <NavLink
            key={user.id}
            to={`/users/${user.id}`}
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "hover:bg-gray-50"
              }`
            }
          >
            {user.name}
          </NavLink>
        ))}
      </aside>

      {/* ── Contenido: aquí se renderiza la ruta hija activa ── */}
      <main className="flex-1 p-10">
        <Outlet />
      </main>
    </div>
  );
}
