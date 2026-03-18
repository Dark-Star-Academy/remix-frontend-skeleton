/**
 * RUTA HIJA del layout _auth
 *
 * Nombre de carpeta: _auth.login/
 *   - "_auth"   → pertenece al layout _auth (sin segmento en URL)
 *   - ".login"  → agrega el segmento "login" a la URL
 *
 * URL resultante: /login
 *
 * Al estar en carpeta, aquí podrías agregar archivos auxiliares como:
 *   login-form.tsx       → componente del formulario
 *   login.schema.ts      → validación con zod
 *   login.server.ts      → lógica de servidor (action)
 * ...sin que ninguno se convierta en una ruta por sí solo.
 */
export default function AuthLogin() {
  return (
    <div>
      <p style={{ color: "#888", fontSize: "0.75rem", textAlign: "center" }}>
        <code>_auth.login/route.tsx</code> → <strong>/login</strong>
      </p>

      <h2
        style={{ textAlign: "center", marginBottom: "1.5rem", color: "black" }}
      >
        Iniciar sesión
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
            Email
          </label>
          <input
            type="email"
            defaultValue="usuario@ejemplo.com"
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
            background: "#1a1a2e",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
