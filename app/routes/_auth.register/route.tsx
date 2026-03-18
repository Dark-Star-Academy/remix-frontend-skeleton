/**
 * RUTA HIJA del layout _auth
 *
 * Nombre de carpeta: _auth.register/
 *   - "_auth"      → pertenece al layout _auth (sin segmento en URL)
 *   - ".register"  → agrega el segmento "register" a la URL
 *
 * URL resultante: /register
 *
 * Al estar en carpeta, aquí podrías agregar archivos auxiliares como:
 *   register-form.tsx    → componente del formulario
 *   register.schema.ts   → validación con zod
 *   register.server.ts   → lógica de servidor (action)
 * ...sin que ninguno se convierta en una ruta por sí solo.
 */
export default function AuthRegister() {
  return (
    <div>
      <p style={{ color: "#888", fontSize: "0.75rem", textAlign: "center" }}>
        <code>_auth.register/route.tsx</code> → <strong>/register</strong>
      </p>

      <h2
        style={{ textAlign: "center", marginBottom: "1.5rem", color: "black" }}
      >
        Crear cuenta
      </h2>

      <form style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              color: "black",
            }}
          >
            Nombre completo
          </label>
          <input
            type="text"
            defaultValue="Ana García"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              color: "black",
            }}
          >
            Email
          </label>
          <input
            type="email"
            defaultValue="ana@ejemplo.com"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              color: "black",
            }}
          >
            Contraseña
          </label>
          <input
            type="password"
            defaultValue="••••••••"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              boxSizing: "border-box",
            }}
          />
        </div>
        <button
          type="button"
          style={{
            padding: "0.75rem",
            background: "#16a34a",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Registrarse
        </button>
      </form>
    </div>
  );
}
