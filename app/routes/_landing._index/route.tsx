import { Link } from "react-router";

/**
 * RUTA ÍNDICE del layout _landing
 *
 * Nombre de archivo: _landing._index
 *   - "_landing"  → pertenece al layout _landing (sin segmento en URL)
 *   - "._index"   → es la ruta índice (se activa cuando la URL es exactamente "/")
 *
 * URL resultante: /
 *
 * El contenido de este componente se inyecta en el <Outlet /> de _landing/route.tsx
 */
export default function LandingIndex() {
  return (
    <div>
      <p style={{ color: "#888", fontSize: "0.8rem" }}>
        Renderizando: <code>_landing._index/route.tsx</code> → URL: <strong>/</strong>
      </p>

      <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
        Bienvenido a la Home 🏠
      </h1>
      <p style={{ color: "#555", maxWidth: "500px" }}>
        Esta página se muestra en la URL raíz <code>/</code>. Comparte el header y el footer
        definidos en el layout <code>_landing</code>, pero este contenido es exclusivo de esta ruta.
      </p>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <Link
          to="/about"
          style={{
            padding: "0.75rem 1.5rem",
            background: "#1a1a2e",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Ver página About →
        </Link>
        <Link
          to="/app"
          style={{
            padding: "0.75rem 1.5rem",
            background: "#2563eb",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Ir a la App →
        </Link>
      </div>
    </div>
  );
}
