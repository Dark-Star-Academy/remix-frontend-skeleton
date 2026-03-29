import { Link } from "react-router";

export default function LandingRoute() {
  return (
    <main className="p-10 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">React Router v7 — Demo</h1>
        <p className="text-gray-500 mt-2">
          Página pública de ejemplo. El dashboard protegido vive en la ruta raíz.
        </p>
      </div>

      <ul className="space-y-3">
        <li>
          <Link
            to="/login"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50"
          >
            <span className="font-mono text-sm text-indigo-600 w-32">/login</span>
            <span className="text-gray-700">Iniciar sesión</span>
          </Link>
        </li>
        <li>
          <Link
            to="/about"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50"
          >
            <span className="font-mono text-sm text-indigo-600 w-32">/about</span>
            <span className="text-gray-700">Página estática simple</span>
          </Link>
        </li>
        <li>
          <Link
            to="/users"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50"
          >
            <span className="font-mono text-sm text-indigo-600 w-32">/users</span>
            <span className="text-gray-700">
              Layout anidado + rutas hijas + rutas dinámicas
            </span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
