import { Outlet, Link } from "react-router";

/**
 * LAYOUT PATHLESS (_landing)
 *
 * El prefijo "_" hace que este segmento NO aparezca en la URL.
 * Actúa como un layout compartido para todas las rutas que empiecen con "_landing."
 *
 * Rutas que usan este layout:
 *   _landing._index  →  /
 *   _landing.about   →  /about
 *
 * El <Outlet /> es donde React Router inyecta el contenido de la ruta hija activa.
 */
export default function LandingLayout() {
  return (
    <div style={{ fontFamily: "sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* HEADER — compartido por / y /about */}
      <header style={{ background: "#1a1a2e", color: "white", padding: "1rem 2rem", display: "flex", gap: "2rem", alignItems: "center" }}>
        <strong style={{ fontSize: "1.2rem" }}>🏠 Mi Sitio</strong>
        <nav style={{ display: "flex", gap: "1rem" }}>
          <Link to="/" style={{ color: "#aef" }}>Inicio</Link>
          <Link to="/about" style={{ color: "#aef" }}>Nosotros</Link>
          <Link to="/login" style={{ color: "#aef" }}>Login</Link>
        </nav>
        <span style={{ marginLeft: "auto", fontSize: "0.8rem", opacity: 0.6 }}>
          [Layout: _landing]
        </span>
      </header>

      {/* OUTLET — aquí se renderiza _landing._index o _landing.about */}
      <main style={{ flex: 1, padding: "2rem" }}>
        <Outlet />
      </main>

      {/* FOOTER — compartido por / y /about */}
      <footer style={{ background: "#eee", padding: "1rem 2rem", textAlign: "center", fontSize: "0.85rem", color: "#555" }}>
        © 2026 Mi Sitio — Footer compartido del layout _landing
      </footer>

    </div>
  );
}
