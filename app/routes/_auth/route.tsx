import { Outlet, Link } from "react-router";

/**
 * LAYOUT PATHLESS (_auth)
 *
 * Igual que _landing, el prefijo "_" elimina el segmento de la URL.
 * Todas las rutas "_auth.*" comparten este layout.
 *
 * Rutas que usan este layout:
 *   _auth.login     →  /login
 *   _auth.register  →  /register
 */
export default function AuthLayout() {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f4ff",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
          padding: "2.5rem",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <p style={{ fontSize: "0.75rem", color: "#999", textAlign: "center", marginBottom: "1rem" }}>
          [Layout: _auth]
        </p>

        {/* OUTLET — aquí se renderiza _auth.login o _auth.register */}
        <Outlet />

        <hr style={{ margin: "1.5rem 0", borderColor: "#eee" }} />
        <nav style={{ display: "flex", justifyContent: "center", gap: "1rem", fontSize: "0.875rem" }}>
          <Link to="/login">Iniciar sesión</Link>
          <Link to="/register">Registrarse</Link>
          <Link to="/">← Volver al inicio</Link>
        </nav>
      </div>
    </div>
  );
}
