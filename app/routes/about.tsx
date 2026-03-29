// Ruta: /about
// Un archivo en app/routes/ con nombre simple → su nombre ES la URL.
// Este componente se renderiza dentro del <Outlet /> de root.tsx,
// pero no tiene ningún layout adicional propio.

import { Link } from "react-router";

export default function About() {
  return (
    <main className="p-10 max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">About</h1>
      <p className="text-gray-600">
        Esta es una página estática sin layout anidado. Su archivo es{" "}
        <code className="bg-gray-100 px-1 rounded">app/routes/about.tsx</code> y
        su URL es <code className="bg-gray-100 px-1 rounded">/about</code>.
      </p>
      <p className="text-gray-600">
        Para crear una nueva página basta con añadir un archivo aquí.
        <br />
        Ejemplo: <code className="bg-gray-100 px-1 rounded">
          contact.tsx
        </code> → <code className="bg-gray-100 px-1 rounded">/contact</code>
      </p>

      <Link to="/" className="inline-block text-indigo-600 hover:underline">
        ← Inicio
      </Link>
    </main>
  );
}
