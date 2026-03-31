// Ruta: /users  (index de la sección /users)
//
// users._index.tsx es la "index route" del layout users.tsx.
// Se renderiza cuando la URL es exactamente /users, dentro del
// <Outlet /> del layout. No añade ningún segmento a la URL.
//
// <Link to={user.id}> usa una ruta RELATIVA (sin "/" inicial).
// Desde /users, "1" resuelve a /users/1.

import { Link } from "react-router";
import { USERS } from "~/lib/mock-users";

export default function UsersList() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Usuarios</h2>
        <p className="text-gray-500 text-sm mt-1">
          Archivo:{" "}
          <code className="bg-gray-100 px-1 rounded">
            routes/users._index.tsx
          </code>
        </p>
      </div>

      <ul className="space-y-3 max-w-md">
        {USERS.map((user) => (
          <li key={user.id}>
            {/*
              Ruta relativa: "user.id" (ej: "1") sin "/" inicial.
              React Router resuelve esto como /users/1.
            */}
            <Link
              to={user.id}
              className="flex items-center gap-4 p-4 border rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-semibold text-indigo-600 shrink-0">
                {user.name[0]}
              </div>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-gray-500">{user.role}</p>
              </div>
              <span className="ml-auto text-gray-300">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
