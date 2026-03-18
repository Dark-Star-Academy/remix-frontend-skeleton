import { Link } from "react-router";

/**
 * RUTA HIJA del layout _landing
 *
 * Nombre de archivo: _landing.about
 *   - "_landing"  → pertenece al layout _landing (sin segmento en URL)
 *   - ".about"    → agrega el segmento "about" a la URL
 *
 * URL resultante: /about
 *
 * El contenido de este componente se inyecta en el <Outlet /> de _landing/route.tsx
 */
export default function LandingAbout() {
  const teamMembers = [
    { name: "Ana García",    role: "CEO",              avatar: "👩‍💼" },
    { name: "Carlos López",  role: "Lead Developer",   avatar: "👨‍💻" },
    { name: "María Martín",  role: "UX Designer",      avatar: "👩‍🎨" },
  ];

  return (
    <div>
      <p style={{ color: "#888", fontSize: "0.8rem" }}>
        Renderizando: <code>_landing.about/route.tsx</code> → URL: <strong>/about</strong>
      </p>

      <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
        Sobre Nosotros 👥
      </h1>
      <p style={{ color: "#555", maxWidth: "500px", marginBottom: "2rem" }}>
        Esta página está en <code>/about</code>. También usa el layout <code>_landing</code>,
        por eso ves el mismo header y footer que en la Home.
      </p>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {teamMembers.map((member) => (
          <div
            key={member.name}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "1.5rem",
              minWidth: "160px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "3rem" }}>{member.avatar}</div>
            <strong>{member.name}</strong>
            <p style={{ color: "#888", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
              {member.role}
            </p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "2rem" }}>
        <Link to="/" style={{ color: "#2563eb" }}>← Volver a la Home</Link>
      </div>
    </div>
  );
}
