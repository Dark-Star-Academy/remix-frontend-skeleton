import { Link } from "react-router";

/**
 * RUTA CON SEGMENTO DE URL (app._index)
 *
 * Nombre de archivo: app._index
 *   - "app"     → agrega el segmento "app" a la URL (NO empieza con "_", así que SÍ aparece)
 *   - "._index" → es la ruta índice de ese segmento
 *
 * URL resultante: /app
 *
 * IMPORTANTE: No hay un layout "app" definido en este proyecto,
 * así que esta ruta renderiza directamente en el <Outlet /> de root.tsx
 * (sin header ni footer compartido).
 *
 * Si existiera un archivo app/route.tsx (o app.tsx), ese sería el layout
 * y este componente se inyectaría en su <Outlet />.
 */
export default function AppIndex() {
  const stats = [
    { label: "Usuarios activos", value: "1,284" },
    { label: "Proyectos",        value: "42"    },
    { label: "Tareas pendientes", value: "7"   },
  ];

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", minHeight: "100vh", background: "#f8fafc" }}>
      <p style={{ color: "#888", fontSize: "0.8rem" }}>
        Renderizando: <code>app._index/route.tsx</code> → URL: <strong>/app</strong>
      </p>

      <h1 style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>Dashboard 📊</h1>
      <p style={{ color: "#64748b", marginBottom: "2rem" }}>
        Esta ruta vive en <code>/app</code>. No tiene un layout padre propio —
        renderiza directamente en el <code>{"<Outlet />"}</code> de <code>root.tsx</code>.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "1.25rem 2rem",
              flex: 1,
            }}
          >
            <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#1a1a2e" }}>{s.value}</div>
            <div style={{ color: "#64748b", fontSize: "0.875rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Link to="/" style={{ color: "#2563eb" }}>
        ← Volver a la Landing
      </Link>
    </div>
  );
}
