import { Link } from "react-router";
import { useLocation } from "react-router";

/**
 * RUTA CATCH-ALL ($)
 *
 * El símbolo "$" como nombre de archivo es la convención para capturar
 * cualquier URL que no coincida con ninguna otra ruta definida.
 *
 * Ejemplos de URLs que llegan aquí:
 *   /esto-no-existe
 *   /productos/123/variante/rojo
 *   /cualquier/cosa/que/no/este/definida
 *
 * URL resultante: /* (todo lo que no matchee)
 */
export default function CatchAll() {
  const location = useLocation();

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff1f2",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <p style={{ color: "#888", fontSize: "0.8rem" }}>
        Renderizando: <code>$.tsx</code> → URL: <strong>*</strong>
      </p>

      <div style={{ fontSize: "6rem" }}>🤷</div>
      <h1 style={{ fontSize: "3rem", color: "#be123c" }}>404</h1>
      <p style={{ fontSize: "1.1rem", color: "#555", maxWidth: "400px" }}>
        La ruta <code style={{ background: "#fecdd3", padding: "0.1em 0.4em", borderRadius: "4px" }}>
          {location.pathname}
        </code> no existe.
      </p>
      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "2rem" }}>
        Este componente (<code>$.tsx</code>) es el catch-all: captura cualquier URL
        que no haya sido definida como ruta en el proyecto.
      </p>

      <Link
        to="/"
        style={{
          padding: "0.75rem 1.5rem",
          background: "#be123c",
          color: "white",
          borderRadius: "8px",
          textDecoration: "none",
        }}
      >
        Volver a la Home
      </Link>
    </div>
  );
}
