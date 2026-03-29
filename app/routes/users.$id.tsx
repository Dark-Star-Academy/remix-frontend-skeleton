// Ruta: /users/:id  (ruta dinámica)
//
// El segmento "$id" en el nombre del archivo se convierte en un parámetro
// de URL llamado "id". Funciona para /users/1, /users/2, /users/abc, etc.
//
// LOADER: función que React Router ejecuta en el SERVIDOR antes de
// renderizar el componente. Recibe { params, request } y devuelve datos.
// El componente los recibe via la prop "loaderData" (totalmente tipada).
//
// Si lanzamos un Response con status 404, React Router activa el
// ErrorBoundary más cercano (definido en root.tsx).

import { Link } from "react-router";
import type { Route } from "./+types/users.$id";
import { getUserById } from "~/lib/mock-users";

export async function loader({ params }: Route.LoaderArgs) {
  const user = getUserById(params.id);

  if (!user) {
    // Lanzar un Response dispara el ErrorBoundary con ese status
    throw new Response("Usuario no encontrado", { status: 404 });
  }

  return { user };
}

export default function UserDetail({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h2 className="text-2xl font-bold">Detalle del usuario</h2>
        <p className="text-gray-500 text-sm mt-1">
          Archivo:{" "}
          <code className="bg-gray-100 px-1 rounded">routes/users.$id.tsx</code>
        </p>
      </div>

      <div className="border rounded-xl p-6 space-y-4">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600">
          {user.name[0]}
        </div>

        <Field label="params.id (URL param)" value={user.id} mono />
        <Field label="Nombre" value={user.name} />
        <Field label="Rol" value={user.role} />
        <Field label="Email" value={user.email} />
      </div>

      {/*
        Ruta relativa con ".." → sube un nivel en la jerarquía de rutas.
        Desde users.$id, el padre es users (el layout), cuya URL es /users.
        relative="path" hace que ".." suba por la URL, no por el árbol de rutas.
      */}
      <Link
        to=".."
        relative="path"
        className="inline-block text-indigo-600 hover:underline text-sm"
      >
        ← Volver a la lista
      </Link>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={mono ? "font-mono text-sm" : "font-medium"}>{value}</p>
    </div>
  );
}
