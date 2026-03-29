# Autenticación y Manejo de Sesiones

Esta documentación describe en detalle cómo funciona el sistema de autenticación de este proyecto, construido con **React Router v7** bajo un modelo **server-first**.

---

## Tabla de contenidos

1. [Principio general](#1-principio-general)
2. [Estructura de archivos](#2-estructura-de-archivos)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Sesión de usuario — `auth.server.ts`](#4-sesión-de-usuario--authserverts)
5. [Cliente HTTP — `api.server.ts`](#5-cliente-http--apiservert)
6. [Flujo de login](#6-flujo-de-login)
7. [Flujo de registro](#7-flujo-de-registro)
8. [Flujo de logout](#8-flujo-de-logout)
9. [Protección de rutas](#9-protección-de-rutas)
10. [Layout de rutas de auth](#10-layout-de-rutas-de-auth)
11. [Acceso al usuario en componentes](#11-acceso-al-usuario-en-componentes)
12. [Seguridad CSRF y device fingerprint](#12-seguridad-csrf-y-device-fingerprint)
13. [Mapa de rutas completo](#13-mapa-de-rutas-completo)
14. [Decisiones de diseño y garantías de seguridad](#14-decisiones-de-diseño-y-garantías-de-seguridad)

---

## 1. Principio general

En React Router v7 **no existe middleware de Edge** equivalente al de Next.js. Toda la lógica de autenticación vive en el **servidor**, dentro de `loader` y `action` functions.

El flujo central es:

```
Request del browser
  │
  └─► loader del Layout Route (_protected.tsx)
        │
        ├─► getSession(cookie) → usuario en sesión
        │       ├─ Sin sesión → redirect("/login?redirectTo=...")
        │       └─ Con sesión → devuelve { user } al componente
        │
        └─► Componente se renderiza con datos del servidor
```

No hay estado de autenticación en el cliente (no hay `AuthContext`, `useState`, ni Zustand para el usuario). **El servidor es la única fuente de verdad**, y valida la sesión en cada petición mediante la cookie `__session`.

---

## 2. Estructura de archivos

```
app/
├── lib/
│   ├── auth.server.ts        # Núcleo de sesión: cookies, getUser, requireUser
│   └── api.server.ts         # Cliente HTTP: apiFetch, headers CSRF y fingerprint
├── routes/
│   ├── _auth.tsx             # Layout para páginas públicas de auth
│   ├── _auth.login.tsx       # Página /login  (loader + action)
│   ├── _auth.register.tsx    # Página /register (action)
│   ├── _protected.tsx        # Layout para rutas privadas (requireUser)
│   ├── _protected._index.tsx # Dashboard en / (solo usuarios autenticados)
│   └── _protected.logout.tsx # Endpoint POST /logout (action)
docs/
└── AUTH.md                   # Este archivo
.env                          # Variables de entorno reales (git-ignored)
.env.example                  # Plantilla de variables sin secretos
```

### Convención de nombres de rutas

React Router v7 usa **flat file routing** con `flatRoutes()`. El prefijo `_` en un nombre de archivo indica un **layout route** sin segmento de URL propio:

| Archivo | URL | Rol |
|---|---|---|
| `_auth.tsx` | (ninguna) | Layout para login y register |
| `_auth.login.tsx` | `/login` | Página de login |
| `_auth.register.tsx` | `/register` | Página de registro |
| `_protected.tsx` | (ninguna) | Layout para rutas privadas |
| `_protected._index.tsx` | `/` | Dashboard privado (index) |
| `_protected.logout.tsx` | `/logout` | Endpoint de logout |

---

## 3. Variables de entorno

| Variable | Descripción | Requerida |
|---|---|---|
| `SESSION_SECRET` | Secreto para firmar la cookie de sesión (HMAC-SHA256). Generar con `openssl rand -hex 64`. | Sí |
| `API_URL` | URL base del backend (ej: `http://localhost:8080`) | Sí |
| `WEB_ORIGIN` | Origen del frontend (ej: `http://localhost:5173`) | Recomendada |
| `APP_LOCALE` | Locale por defecto de la aplicación | No |
| `CLOUDFLARE_IMAGE_URL` | URL base de entrega de imágenes CDN | No |
| `MAX_STORE_PROFILES`, `MAX_PRODUCTS`, etc. | Límites de negocio | No |

> Todas las variables son **server-only**. Ninguna se expone al bundle del cliente automáticamente. Si un componente necesita un valor del entorno, debe recibirlo explícitamente desde el `return` de un `loader`.

Copiar `.env.example` a `.env` y completar los valores:

```bash
cp .env.example .env
```

---

## 4. Sesión de usuario — `auth.server.ts`

**Ubicación:** `app/lib/auth.server.ts`

Este archivo es el núcleo del sistema. Implementa el almacenamiento de sesión mediante `createCookieSessionStorage` de React Router.

### Cookie de sesión

```ts
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,                                        // No accesible desde JS del browser
    secure: process.env.NODE_ENV === "production",         // Solo HTTPS en producción
    sameSite: "lax",                                       // Protección CSRF básica
    path: "/",                                             // Válida en toda la app
    secrets: [process.env.SESSION_SECRET],                 // Firma HMAC con el secreto
    maxAge: 60 * 60 * 24 * 7,                             // 7 días
  },
});
```

La cookie `__session` está firmada digitalmente con `SESSION_SECRET`. Si alguien modifica su contenido en el browser, la firma no coincidirá y la sesión será inválida.

### Tipo `SessionUser`

El objeto que se almacena en la sesión y que representa al usuario autenticado:

```ts
type SessionUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
};
```

### Helpers exportados

#### `getSession / commitSession / destroySession`

Funciones nativas de React Router para leer, guardar y destruir la sesión:

```ts
// Leer la sesión desde la cookie del request
const session = await getSession(request.headers.get("Cookie"));

// Persistir la sesión (devuelve el header Set-Cookie)
const cookieHeader = await commitSession(session);

// Destruir la sesión (borra la cookie)
const cookieHeader = await destroySession(session);
```

#### `getUser(request)`

Lee la sesión y devuelve el usuario o `null` si no existe. **No redirige.**

```ts
const user = await getUser(request);
// → SessionUser | null
```

Uso típico: en layouts de auth para redirigir si el usuario ya está logueado.

#### `requireUser(request, redirectTo?)`

Igual que `getUser` pero, si no hay usuario en sesión, **lanza un redirect** al login con la URL original en `redirectTo`. Nunca devuelve `null`.

```ts
const user = await requireUser(request);
// → SessionUser (siempre, o redirect automático)
```

El redirect preserva la URL de destino:

```
/dashboard → /login?redirectTo=%2Fdashboard
```

Después de autenticarse, el login usará ese parámetro para redirigir de vuelta.

---

## 5. Cliente HTTP — `api.server.ts`

**Ubicación:** `app/lib/api.server.ts`

Centraliza todas las llamadas HTTP al backend. **Solo se importa desde código de servidor** (loaders, actions).

### `apiFetch(path, init?)`

Wrapper base sobre `fetch`. Agrega `Content-Type: application/json` automáticamente si hay body.

```ts
const response = await apiFetch("/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});
// → Promise<Response>  (sin procesar)
```

### `apiJson<T>(path, init?)`

Como `apiFetch` pero deserializa el JSON y lanza `Response` con el status HTTP si la respuesta no es `ok`.

```ts
const data = await apiJson<{ user: User }>("/me");
// → T  o  throw Response(status)
```

### `getSetCookieHeaders(response)`

Extrae los headers `Set-Cookie` de una respuesta del backend. Es necesario para reenviar las cookies de JWT del backend (access/refresh tokens) al browser junto con la cookie de sesión del frontend.

```ts
const backendCookies = getSetCookieHeaders(apiResponse);
// → string[]
```

### `extractUserFromAuthPayload(payload)`

Normaliza distintos formatos de respuesta del backend para localizar el objeto `user`. Soporta:

- `{ user: { ... } }`
- `{ data: { user: { ... } } }`

### `buildCsrfForwardHeaders(request, fallbackPath)`

Genera los headers `Origin` y `Referer` a partir del request del browser para reenviarlos al backend. El backend usa estos headers para validación CSRF.

### `buildAuthForwardHeaders(request, fallbackPath, frontendType?)`

Helper completo que combina todos los headers necesarios para llamadas de autenticación:

```ts
{
  Origin: "http://localhost:5173",
  Referer: "http://localhost:5173/login",
  "X-Device-Fingerprint": "...",
  "X-Frontend-Type": "ADMIN",
  "User-Agent": "Mozilla/5.0 ...",
}
```

> Ver sección [Seguridad CSRF y device fingerprint](#12-seguridad-csrf-y-device-fingerprint) para más detalle.

---

## 6. Flujo de login

**Ruta:** `POST /login`  
**Archivo:** `app/routes/_auth.login.tsx`

```
Browser (Form submit)
  │  POST /login  {email, password, redirectTo}
  ▼
action() en el servidor
  │
  ├─1. Valida que email y password existan en el formData
  │
  ├─2. POST al backend: /auth/login
  │     Headers: Origin, Referer, X-Device-Fingerprint, X-Frontend-Type
  │     Body: { email, password }
  │
  ├─3. Si el backend responde con error:
  │     └─ return { error: mensajeDelBackend }
  │          → El componente muestra el error en pantalla
  │
  ├─4. Extrae y normaliza el usuario de la respuesta
  │     (normalizeUser convierte id a string si viene como number)
  │
  ├─5. Crea/abre la sesión cookie del frontend:
  │     session.set("user", { id, email, name, role })
  │
  ├─6. Construye headers de respuesta:
  │     Set-Cookie: __session=...  (sesión del frontend)
  │     Set-Cookie: access_token=... (JWT del backend, si los devuelve)
  │     Set-Cookie: refresh_token=... (JWT del backend, si los devuelve)
  │
  └─7. redirect(redirectTo, { headers })
        → Browser va a "/" (o a la URL guardada en redirectTo)
```

### Parámetro `redirectTo`

El loader del login lee `?redirectTo` de la URL y lo pasa al formulario como campo oculto:

```ts
// loader
const redirectTo = url.searchParams.get("redirectTo") ?? "/";
return { redirectTo };

// JSX
<input type="hidden" name="redirectTo" value={loaderData.redirectTo} />
```

Así, si el usuario intentaba acceder a `/pedidos` sin sesión y fue redirigido a `/login?redirectTo=%2Fpedidos`, después de autenticarse vuelve directamente a `/pedidos`.

El valor de `redirectTo` se sanitiza para que solo se acepten rutas que comiencen con `/`, evitando open redirect attacks:

```ts
function sanitizeRedirectTo(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  return value;
}
```

---

## 7. Flujo de registro

**Ruta:** `POST /register`  
**Archivo:** `app/routes/_auth.register.tsx`

```
Browser (Form submit)
  │  POST /register  {name, email, password}
  ▼
action() en el servidor
  │
  ├─1. Valida los campos del formData
  │
  ├─2. POST al backend: /auth/register
  │     Headers: Origin, Referer, X-Device-Fingerprint, X-Frontend-Type
  │
  ├─3. Si el backend responde con error:
  │     └─ return { error: mensajeDelBackend }
  │
  ├─4. Si el backend devuelve un usuario en la respuesta:
  │     └─ Crea sesión y redirect("/")
  │          (login automático tras registro exitoso)
  │
  └─5. Si el backend no devuelve usuario:
        └─ redirect("/login")
             (el usuario debe autenticarse manualmente)
```

---

## 8. Flujo de logout

**Ruta:** `POST /logout`  
**Archivo:** `app/routes/_protected.logout.tsx`

El logout es un `action` puro, sin componente visual. Se invoca enviando un formulario `POST` al endpoint:

```tsx
<Form method="post" action="/logout">
  <button type="submit">Cerrar sesión</button>
</Form>
```

```
Browser (Form submit)
  │  POST /logout
  ▼
action() en el servidor
  │
  ├─1. Lee la sesión actual desde la cookie
  │
  ├─2. Llama al backend: POST /auth/logout  (best-effort)
  │     Reenvía la cookie original del browser para que el backend
  │     pueda invalidar los JWT (access/refresh tokens) en su DB/Redis.
  │     Si esta llamada falla, el proceso continúa de todas formas.
  │
  ├─3. destroySession(session)
  │     Genera el header Set-Cookie que borra la cookie __session del browser.
  │
  └─4. redirect("/login", { headers: { "Set-Cookie": ... } })
        → Browser pierde la sesión y va al login
```

> **Por qué best-effort:** Si el servidor del backend está caído, el usuario igual pierde la sesión en el frontend. El riesgo es que el refresh token en el backend quede activo hasta su expiración natural, pero la cookie `__session` del frontend ya fue destruida, por lo que no podrá acceder a rutas protegidas.

---

## 9. Protección de rutas

**Archivo:** `app/routes/_protected.tsx`

Este archivo es un **Layout Route** que actúa como guardián de todas las rutas privadas. Su `loader` se ejecuta en cada petición a cualquier ruta bajo su árbol:

```ts
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}
```

`requireUser` opera así internamente:

```
¿Hay cookie __session válida y firmada?
  │
  ├─ NO → throw redirect("/login?redirectTo=<url-actual>")
  │         React Router intercepta el redirect y el browser navega al login
  │
  └─ SÍ → return SessionUser
            El loader devuelve { user } al componente
```

### Cómo agregar una ruta protegida

Basta con nombrar el archivo con el prefijo `_protected.`:

```
app/routes/_protected.pedidos.tsx   →  /pedidos  (protegida automáticamente)
app/routes/_protected.perfil.tsx    →  /perfil   (protegida automáticamente)
```

No hay que escribir ninguna lógica de verificación adicional en esas rutas. El layout padre (`_protected.tsx`) ya lo hace por todas ellas.

### Cómo agregar una ruta pública

Cualquier archivo que **no** use el prefijo `_protected.` es público:

```
app/routes/about.tsx    →  /about   (pública)
app/routes/landing.tsx  →  /landing (pública)
```

---

## 10. Layout de rutas de auth

**Archivo:** `app/routes/_auth.tsx`

Actúa como layout para `/login` y `/register`. Su único propósito es **redirigir al usuario ya autenticado** si intenta acceder a esas páginas:

```ts
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (user) throw redirect("/");
  return null;
}
```

Si el usuario ya tiene sesión activa e intenta ir a `/login`, es redirigido automáticamente al dashboard. Esto evita el antipatrón de mostrar un formulario de login a alguien que ya está autenticado.

El layout también centra visualmente el formulario en pantalla:

```tsx
<main className="min-h-screen flex items-center justify-center p-6">
  <div className="w-full max-w-md border rounded-xl p-6 bg-background">
    <Outlet />
  </div>
</main>
```

---

## 11. Acceso al usuario en componentes

### En un layout protegido

El `loader` de `_protected.tsx` devuelve `{ user }`, accesible via `loaderData`:

```tsx
export default function ProtectedLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  // user.id, user.email, user.name, user.role
}
```

### En rutas hijas via Outlet context

El layout pasa el usuario a sus rutas hijas mediante `context` en el `<Outlet />`:

```tsx
// En _protected.tsx
<Outlet context={{ user: loaderData.user } satisfies ProtectedOutletContext} />
```

Las rutas hijas lo consumen con `useOutletContext`:

```tsx
// En _protected._index.tsx (u otras rutas hijas)
import { useOutletContext } from "react-router";
import type { ProtectedOutletContext } from "./_protected";

const { user } = useOutletContext<ProtectedOutletContext>();
```

### En rutas hijas con su propio loader

Si una ruta hija necesita acceder al usuario en su propio `loader` (por ejemplo para hacer una query a la API), puede llamar a `requireUser` directamente:

```ts
// app/routes/_protected.pedidos.tsx
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const pedidos = await apiJson(`/users/${user.id}/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { user, pedidos };
}
```

---

## 12. Seguridad CSRF y device fingerprint

El backend implementa un guard CSRF que valida los headers `Origin` y `Referer` en métodos mutantes (`POST`, `PUT`, `DELETE`). Como el frontend hace estas llamadas **server-to-server** (desde el `action` en Node.js, no desde el browser), los headers no se propagan automáticamente y hay que construirlos manualmente.

### `buildCsrfForwardHeaders`

Para solicitudes simples como logout:

```ts
buildCsrfForwardHeaders(request, "/")
// → { Origin: "http://localhost:5173", Referer: "http://localhost:5173/" }
```

Extrae `Origin` y `Referer` del request original del browser. Si no existen (casos edge), los construye desde la URL del request.

### `buildAuthForwardHeaders`

Para login y registro, que además requieren `X-Device-Fingerprint` y `X-Frontend-Type`:

```ts
buildAuthForwardHeaders(request, "/login", "ADMIN")
// → {
//     Origin: "http://localhost:5173",
//     Referer: "http://localhost:5173/login",
//     "X-Device-Fingerprint": "Mozilla/5.0...|es-ES|server|...|sha256hash",
//     "X-Frontend-Type": "ADMIN",
//     "User-Agent": "Mozilla/5.0...",
//   }
```

### Device Fingerprint

El backend usa `X-Device-Fingerprint` para vincular sesiones a dispositivos específicos y detectar session hijacking. El frontend lo genera así:

1. **Si existe** la cookie `device_fp` (seteada previamente por el backend o el cliente): se reenvía tal cual. Esto garantiza consistencia entre sesiones.
2. **Si no existe**: se genera un fingerprint determinístico desde headers del browser:
   - `User-Agent`
   - `Accept-Language` (primer idioma)
   - `Sec-CH-UA-Platform`
   - Un digest SHA-256 de los anteriores como quinto segmento

El formato tiene 5 segmentos separados por `|`, compatible con el comparador del backend:

```
userAgent|language|platform|timezone|sha256digest
```

### `X-Frontend-Type`

El backend distingue entre frontends `ADMIN` y `CUSTOMER`. Este header le indica al backend con qué tipo de frontend se está autenticando, lo que le permite validar que el rol del usuario corresponda:

- Un usuario con rol `CUSTOMER` que intenta loguearse en el frontend `ADMIN` recibirá un error `403`.
- Un usuario con rol `ADMIN` que intenta loguearse en el frontend `CUSTOMER` recibirá un error `403`.

---

## 13. Mapa de rutas completo

```
/ (raíz)
├── /                          _protected._index.tsx   ← PRIVADA (dashboard)
├── /login                     _auth.login.tsx         ← pública (redirige si hay sesión)
├── /register                  _auth.register.tsx      ← pública (redirige si hay sesión)
├── /logout                    _protected.logout.tsx   ← solo acepta POST
├── /about                     about.tsx               ← pública
├── /landing                   landing.tsx             ← pública
├── /users                     users.tsx               ← pública (demo de layout anidado)
│   ├── /users                 users._index.tsx        ← lista de usuarios (demo)
│   └── /users/:id             users.$id.tsx           ← detalle de usuario (demo)
```

### Flujo completo de una petición a ruta protegida

```
Usuario sin sesión → GET /
  │
  └─► _protected.tsx loader
        └─► requireUser() → no hay sesión
              └─► redirect("/login?redirectTo=%2F")

Browser → GET /login?redirectTo=%2F
  │
  └─► _auth.tsx loader → getUser() → null → ok
  └─► _auth.login.tsx loader → { redirectTo: "/" }
        └─► Renderiza formulario de login

Usuario escribe credenciales → POST /login
  │
  └─► _auth.login.tsx action
        ├─► POST /auth/login al backend
        ├─► Crea __session con el usuario
        └─► redirect("/")  ← usa redirectTo recuperado

Browser → GET /
  │
  └─► _protected.tsx loader
        └─► requireUser() → hay sesión → devuelve user
              └─► Renderiza _protected._index.tsx con el usuario
```

---

## 14. Decisiones de diseño y garantías de seguridad

### Server-first: sin estado de auth en el cliente

No hay `AuthContext`, `useState`, ni stores de autenticación en el browser. El estado del usuario vive **exclusivamente en la cookie de sesión del servidor**. Esto elimina toda una clase de bugs donde el estado cliente y servidor divergen.

### Fail-closed

Si `requireUser` no encuentra sesión, **siempre** redirige al login. No existe un camino de "acceso de emergencia" ni comportamiento permisivo ante errores. Errores de red al validar la sesión resultan en redirección, no en acceso concedido.

### Cookie `__session` firmada con HMAC

`createCookieSessionStorage` firma el contenido de la cookie con `SESSION_SECRET` usando HMAC-SHA256. Cualquier modificación del contenido (por ejemplo, cambiar el `role` desde las DevTools del browser) invalida la firma y React Router rechaza la sesión.

### `httpOnly: true`

La cookie `__session` no es accesible desde JavaScript del browser (`document.cookie`). Un ataque XSS no puede robar la sesión del usuario.

### `secure: true` en producción

En producción la cookie solo se envía sobre HTTPS. En desarrollo local (`NODE_ENV !== "production"`) se permite HTTP para comodidad.

### `sameSite: "lax"`

Protege contra la mayoría de ataques CSRF mientras permite el funcionamiento normal de links externos (por ejemplo, un enlace en un email que lleva al usuario a la app).

### Logout garantizado

`destroySession` genera un header `Set-Cookie` que borra la cookie `__session` del browser. Aunque el backend no esté disponible, el usuario pierde su sesión en el frontend de forma garantizada.

### Sanitización de `redirectTo`

El parámetro `redirectTo` solo acepta strings que comiencen con `/`. Esto previene ataques de open redirect donde un atacante podría construir una URL como `/login?redirectTo=https://malicious.com`.

### Headers de seguridad hacia el backend

Las llamadas de auth incluyen `Origin`, `Referer`, `X-Device-Fingerprint` y `X-Frontend-Type`. Esto permite al backend:

- Validar CSRF (headers `Origin`/`Referer`)
- Vincular sesiones a dispositivos (`X-Device-Fingerprint`)
- Validar que el rol del usuario corresponde al frontend (`X-Frontend-Type`)
