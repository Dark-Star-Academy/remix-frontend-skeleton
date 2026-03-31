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
10. [Refresco automático de tokens](#10-refresco-automático-de-tokens)
11. [Layout de rutas de auth](#11-layout-de-rutas-de-auth)
12. [Acceso al usuario en componentes](#12-acceso-al-usuario-en-componentes)
13. [Seguridad CSRF y device fingerprint](#13-seguridad-csrf-y-device-fingerprint)
14. [Mapa de rutas completo](#14-mapa-de-rutas-completo)
15. [Decisiones de diseño y garantías de seguridad](#15-decisiones-de-diseño-y-garantías-de-seguridad)

---

## 1. Principio general

En React Router v7 **no existe middleware de Edge** equivalente al de Next.js. Toda la lógica de autenticación vive en el **servidor**, dentro de `loader` y `action` functions.

El flujo central es:

```
Request del browser
  │
  └─► loader del Layout Route (_protected.tsx)
        │
        ├─► requireUser(request) → usuario en sesión
        │       ├─ Sin sesión → redirect("/login?redirectTo=...")
        │       └─ Con sesión → devuelve { user } al componente
        │
        └─► Componente se renderiza con datos del servidor
```

No hay estado de autenticación en el cliente (no hay `AuthContext`, `useState`, ni Zustand para el usuario). **El servidor es la única fuente de verdad**, y valida la sesión en cada petición mediante la cookie `__session`.

### Arquitectura de tokens: `__session` como almacén

El backend Ktor emite tres cookies al autenticar: `access_token` (JWT, 15 min), `refresh_token` (JWT, 30 días, `path=/api/auth/refresh`) y `csrf_token`. Como el `refresh_token` tiene un `path` restringido, el browser **nunca lo envía** a rutas Remix. Para poder refrescar tokens desde el SSR, ambos tokens se almacenan dentro del `__session` encriptado de Remix, no como cookies independientes en el browser.

Todas las llamadas de Remix al backend se hacen **servidor a servidor** con `Cookie: access_token=<valor>`. Sin `csrf_token` cookie en esas peticiones, el `CsrfPlugin` de Ktor lo omite automáticamente — es un comportamiento documentado para clientes no-browser.

```
Browser  ←──────  __session (httpOnly, firmada)  ──────►  Remix SSR
                       │  contiene: user, accessToken, refreshToken
                       │
                  Remix SSR  ──►  Cookie: access_token=<valor>  ──►  Ktor
```

---

## 2. Estructura de archivos

```
app/
├── lib/
│   ├── auth.server.ts        # Núcleo de sesión: cookies, getUser, requireUser, callWithRefresh
│   ├── api.server.ts         # Cliente HTTP: apiFetch, extractCookieValue, buildAuthForwardHeaders
│   ├── api-error.ts          # Tipos de error isomórficos: ApiError, ApiErrorResponse
│   └── api-error.server.ts   # Helpers server-only: throwApiError, getApiErrorMessage
├── routes/
│   ├── _auth.tsx             # Layout para páginas públicas de auth
│   ├── _auth.login.tsx       # Página /login  (loader + action)
│   ├── _auth.register.tsx    # Página /register (loader + action)
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
| `API_URL` | URL base del backend incluyendo el prefijo de la API (ej: `http://localhost:8080/api`). | Sí |

> Todas las variables son **server-only**. Ninguna se expone al bundle del cliente automáticamente. Si un componente necesita un valor del entorno, debe recibirlo explícitamente desde el `return` de un `loader`.

Copiar `.env.example` a `.env` y completar los valores:

```bash
cp .env.example .env
```

---

## 4. Sesión de usuario — `auth.server.ts`

**Ubicación:** `app/lib/auth.server.ts`

Este archivo es el núcleo del sistema. Implementa el almacenamiento de sesión, la normalización de usuarios y el ciclo de vida de los tokens JWT.

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

La cookie `__session` está firmada digitalmente con `SESSION_SECRET`. Contiene tres campos: el usuario autenticado y ambos tokens JWT. Si alguien modifica su contenido en el browser, la firma no coincidirá y la sesión será inválida.

### Tipo `SessionUser`

El objeto que se almacena en la sesión y que representa al usuario autenticado. Los nombres de campo coinciden exactamente con la respuesta del backend Ktor:

```ts
type SessionUser = {
  userId: string;     // ID del usuario en el backend
  email: string;
  firstName: string;
  lastName: string;
  role: string;       // "ADMIN" | "CUSTOMER"
  status: string;     // "ACTIVE" | "INACTIVE" | "BLOCKED"
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

#### `normalizeSessionUser(candidate)`

Convierte el objeto `user` de la respuesta del backend en un `SessionUser`. Valida que los campos requeridos (`userId`, `email`) estén presentes. Devuelve `null` si faltan.

```ts
const user = normalizeSessionUser(rawUserFromBackend);
// → SessionUser | null
```

Usada internamente en el login, register y `callWithRefresh`. No es necesario llamarla desde rutas directamente.

#### `getUser(request)`

Lee la sesión y devuelve el usuario o `null` si no existe. **No redirige.**

```ts
const user = await getUser(request);
// → SessionUser | null
```

Uso típico: en el layout `_auth.tsx` para redirigir si el usuario ya está logueado.

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

#### `getSessionTokens(request)`

Lee la sesión y devuelve user + ambos tokens. Devuelve `null` si alguno de los tres falta (por ejemplo, en sesiones antiguas sin tokens).

```ts
const tokens = await getSessionTokens(request);
// → { user: SessionUser, accessToken: string, refreshToken: string } | null
```

Usada internamente por `callWithRefresh` y por el logout.

#### `callWithRefresh<T>(request, call)`

Utilidad central para todos los loaders y actions que necesiten llamar a endpoints protegidos de Ktor. Gestiona automáticamente el ciclo de vida de los tokens:

```ts
const { data, sessionHeaders } = await callWithRefresh<MiTipo>(
  request,
  (accessToken) =>
    apiFetch("/alguna-ruta", {
      headers: { Cookie: `access_token=${accessToken}` },
    }),
);

// Si el token fue refrescado, sessionHeaders contiene el nuevo Set-Cookie.
// Debe incluirse en la respuesta del loader para persistir la nueva sesión.
return data({ items: data }, { headers: sessionHeaders });
```

Ver la sección [Refresco automático de tokens](#10-refresco-automático-de-tokens) para el flujo completo.

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

Como `apiFetch` pero deserializa el JSON y lanza `ApiError` (con código y categoría del backend) o `Response` si la respuesta no es `ok`.

```ts
const data = await apiJson<{ items: Item[] }>("/items");
// → T  o  throw ApiError | Response
```

### `getSetCookieHeaders(response)`

Extrae todos los headers `Set-Cookie` de una respuesta. Necesario para parsear los tokens del backend en login y register.

```ts
const setCookies = getSetCookieHeaders(loginResponse);
// → string[]  (ej: ["access_token=eyJ...; Path=/; HttpOnly", ...])
```

### `extractCookieValue(setCookieHeaders, name)`

Parsea el valor de una cookie específica de un array de headers `Set-Cookie`. Opera sobre headers de **respuesta** (formato `name=value; attr1; attr2`).

```ts
const accessToken = extractCookieValue(setCookies, "access_token");
// → "eyJhbGci..." | null
```

### `extractUserFromAuthPayload(payload)`

Normaliza distintos formatos de respuesta del backend para localizar el objeto `user`. Soporta:

- `{ user: { ... } }` — login y refresh
- `{ data: { user: { ... } } }` — formatos alternativos

### `buildAuthForwardHeaders(request, fallbackPath, frontendType?)`

Construye todos los headers necesarios para llamadas a endpoints de **autenticación anónimos** (login, register). No debe usarse en llamadas a endpoints protegidos.

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

> Para endpoints protegidos, usar directamente `Cookie: access_token=<valor>`. Ver [Seguridad CSRF y device fingerprint](#13-seguridad-csrf-y-device-fingerprint).

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
  ├─4. Extrae el usuario de la respuesta:
  │     extractUserFromAuthPayload(payload) → { userId, email, firstName, lastName, ... }
  │     normalizeSessionUser(candidate) → SessionUser
  │
  ├─5. Extrae los tokens de los headers Set-Cookie de la respuesta:
  │     extractCookieValue(setCookies, "access_token")  → string
  │     extractCookieValue(setCookies, "refresh_token") → string
  │     (Las cookies de Ktor NO se reenvían al browser)
  │
  ├─6. Guarda todo en la sesión de Remix:
  │     session.set("user", user)
  │     session.set("accessToken", accessToken)
  │     session.set("refreshToken", refreshToken)
  │
  └─7. redirect(redirectTo, { headers: { "Set-Cookie": await commitSession(session) } })
        → Browser recibe solo __session. No hay access_token ni refresh_token visibles.
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

El formulario tiene cuatro campos: `firstName`, `lastName`, `email` y `password`. El endpoint de registro del backend **no emite tokens**, por lo que se realiza un login automático tras el registro exitoso.

```
Browser (Form submit)
  │  POST /register  {firstName, lastName, email, password, redirectTo}
  ▼
action() en el servidor
  │
  ├─1. Valida los cuatro campos del formData
  │
  ├─2. POST al backend: /auth/register
  │     Body: { firstName, lastName, email, password }
  │     Si el backend responde con error → return { error: mensaje }
  │
  ├─3. Registro exitoso (201). El backend devuelve el usuario creado pero sin tokens.
  │
  ├─4. Auto-login: POST al backend /auth/login con las mismas credenciales
  │     (mismo flujo que el login normal — pasos 4 a 6 del flujo de login)
  │     Si el auto-login falla → redirect("/login")
  │
  └─5. Crea la sesión con user + tokens y redirect(redirectTo)
```

El soporte de `redirectTo` funciona igual que en el login: el loader lo lee de `?redirectTo` y el formulario lo pasa como campo oculto.

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
  ├─1. Lee la sesión y extrae los tokens con getSessionTokens(request)
  │
  ├─2. Si hay tokens: llama al backend POST /auth/logout  (best-effort)
  │     Header: Cookie: access_token=<valor>
  │     Sin csrf_token cookie → CsrfPlugin de Ktor omite la validación automáticamente.
  │     Si esta llamada falla, el proceso continúa de todas formas.
  │
  ├─3. destroySession(session)
  │     Genera el header Set-Cookie que borra la cookie __session del browser.
  │
  └─4. redirect("/login", { headers: { "Set-Cookie": ... } })
        → Browser pierde la sesión y va al login
```

> **Por qué best-effort:** Si el servidor del backend está caído, el usuario igual pierde la sesión en el frontend. El riesgo es que la sesión en el backend quede activa hasta la expiración natural del access token (15 min), pero la cookie `__session` del frontend ya fue destruida, por lo que no podrá acceder a rutas protegidas.

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
¿Hay cookie __session válida y firmada con campo "user"?
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

### Llamadas a la API desde rutas protegidas

Cualquier loader o action protegido que necesite llamar al backend debe usar `callWithRefresh`:

```ts
// app/routes/_protected.pedidos.tsx
export async function loader({ request }: Route.LoaderArgs) {
  const { data, sessionHeaders } = await callWithRefresh<PedidosResponse>(
    request,
    (accessToken) =>
      apiFetch("/pedidos", {
        headers: { Cookie: `access_token=${accessToken}` },
      }),
  );

  return data({ pedidos: data.items }, { headers: sessionHeaders });
}
```

### Cómo agregar una ruta pública

Cualquier archivo que **no** use el prefijo `_protected.` es público:

```
app/routes/about.tsx    →  /about   (pública)
app/routes/landing.tsx  →  /landing (pública)
```

---

## 10. Refresco automático de tokens

**Función:** `callWithRefresh<T>` en `app/lib/auth.server.ts`

Cuando el access token expira (TTL: 15 min), las llamadas al backend responden con `401`. `callWithRefresh` gestiona este ciclo de forma transparente:

```
callWithRefresh(request, call)
  │
  ├─1. getSessionTokens(request)
  │     → null: throw redirect("/login?redirectTo=...")
  │     → { accessToken, refreshToken, user }
  │
  ├─2. call(accessToken) — primer intento
  │     → 200 OK: return { data, sessionHeaders: new Headers() }
  │     → != 401: throw Response(status) → ErrorBoundary
  │     → 401: continuar al refresco
  │
  ├─3. POST /auth/refresh
  │     Header: Cookie: refresh_token=<valor>
  │     → Error: destroySession + throw redirect("/login")
  │     → 200: parsear nuevos tokens y usuario
  │
  ├─4. Actualizar sesión con los nuevos tokens:
  │     session.set("user", newUser)
  │     session.set("accessToken", newAccessToken)
  │     session.set("refreshToken", newRefreshToken)
  │     commitSession(session) → sessionHeaders con Set-Cookie
  │
  └─5. call(newAccessToken) — segundo intento
        → 200: return { data, sessionHeaders }
        → Error: throw Response(status) → ErrorBoundary
```

El caller **debe** incluir `sessionHeaders` en la respuesta del loader cuando no está vacío, para que el browser reciba la sesión actualizada:

```ts
return data({ items }, { headers: sessionHeaders });
```

Si se omite este paso, la sesión actualizada no se persiste y el siguiente request generará otro refresco innecesario (o fallará si el nuevo access token también expiró).

---

## 11. Layout de rutas de auth

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

## 12. Acceso al usuario en componentes

### En un layout protegido

El `loader` de `_protected.tsx` devuelve `{ user }`, accesible via `loaderData`:

```tsx
export default function ProtectedLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  // user.userId, user.email, user.firstName, user.lastName, user.role, user.status
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
// user.firstName, user.lastName, user.userId, user.role, user.status
```

### En rutas hijas con su propio loader

Si una ruta hija necesita llamar a la API del backend, debe usar `callWithRefresh`:

```ts
// app/routes/_protected.perfil.tsx
export async function loader({ request }: Route.LoaderArgs) {
  const { data, sessionHeaders } = await callWithRefresh<PerfilResponse>(
    request,
    (accessToken) =>
      apiFetch("/perfil", {
        headers: { Cookie: `access_token=${accessToken}` },
      }),
  );

  return data({ perfil: data }, { headers: sessionHeaders });
}
```

> No es necesario llamar a `requireUser` en loaders hijos si ya van a usar `callWithRefresh` — esta función redirige al login si no hay sesión válida.

---

## 13. Seguridad CSRF y device fingerprint

### Llamadas a endpoints protegidos (sin CSRF)

Las llamadas de Remix al backend para rutas protegidas se hacen **servidor a servidor** enviando únicamente el access token:

```ts
apiFetch("/alguna-ruta", {
  headers: { Cookie: `access_token=${accessToken}` },
})
```

No se envía la cookie `csrf_token`. El `CsrfPlugin` de Ktor está diseñado para omitir la validación CSRF cuando esa cookie no está presente, tratando al caller como un cliente no-browser (API, mobile, SSR). Esto significa que **no es necesario gestionar CSRF manualmente** en las llamadas a rutas protegidas.

### Llamadas a endpoints anónimos (login, register)

Para los endpoints de autenticación anónimos, el backend usa `Origin`, `Referer` y el device fingerprint para tracking de dispositivos. Por eso se usan `buildAuthForwardHeaders` en esos casos específicos.

### `buildAuthForwardHeaders`

Solo para login y register:

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

1. **Si existe** la cookie `device_fp` (seteada previamente): se reenvía tal cual.
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

El backend distingue entre frontends `ADMIN` y `CUSTOMER`. Este header le indica con qué tipo de frontend se está autenticando:

- Un usuario `CUSTOMER` en el frontend `ADMIN` recibirá `403`.
- Un usuario `ADMIN` en el frontend `CUSTOMER` recibirá `403`.

---

## 14. Mapa de rutas completo

```
/ (raíz)
├── /                          _protected._index.tsx   ← PRIVADA (dashboard)
├── /login                     _auth.login.tsx         ← pública (redirige si hay sesión)
├── /register                  _auth.register.tsx      ← pública (redirige si hay sesión)
├── /logout                    _protected.logout.tsx   ← solo acepta POST
└── /users                     _protected.users.tsx    ← PRIVADA (layout anidado)
    ├── /users                 _protected.users._index.tsx  ← lista
    └── /users/:id             _protected.users.$id.tsx     ← detalle
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
        ├─► Extrae user + tokens del response
        ├─► Crea __session con user + accessToken + refreshToken
        └─► redirect("/")  ← usa redirectTo recuperado

Browser → GET /
  │
  └─► _protected.tsx loader
        └─► requireUser() → hay sesión → devuelve user
              └─► Renderiza _protected._index.tsx con el usuario
```

---

## 15. Decisiones de diseño y garantías de seguridad

### Tokens en `__session`, no en cookies del browser

El `refresh_token` de Ktor tiene `path=/api/auth/refresh`. El browser solo lo enviaría al acceder a esa ruta exacta — nunca a rutas Remix como `/users` o `/`. Almacenar los tokens en el `__session` encriptado de Remix resuelve este problema: el SSR siempre tiene acceso a ambos tokens y puede refrescarlos de forma transparente.

Como consecuencia, el browser solo ve **una cookie** (`__session`). Las cookies `access_token`, `refresh_token` y `csrf_token` de Ktor nunca llegan al browser.

### CSRF implícito: sin código adicional

Las llamadas SSR de Remix a Ktor van sin cookie `csrf_token`. El `CsrfPlugin` de Ktor omite la validación cuando esa cookie no está presente — es un comportamiento diseñado para clientes no-browser. No hay que gestionar tokens CSRF manualmente para ninguna llamada a rutas protegidas.

La protección CSRF de las rutas Remix (formularios de login, register, logout) la provee la cookie `__session` con `sameSite: lax` — el browser no la envía en cross-origin POSTs.

### Server-first: sin estado de auth en el cliente

No hay `AuthContext`, `useState`, ni stores de autenticación en el browser. El estado del usuario vive **exclusivamente en la cookie de sesión del servidor**. Esto elimina toda una clase de bugs donde el estado cliente y servidor divergen.

### Fail-closed

Si `requireUser` no encuentra sesión, **siempre** redirige al login. `callWithRefresh` también redirige al login si el refresh falla. No existe ningún camino de acceso permisivo ante errores.

### Cookie `__session` firmada con HMAC

`createCookieSessionStorage` firma el contenido de la cookie con `SESSION_SECRET` usando HMAC-SHA256. Cualquier modificación del contenido (por ejemplo, cambiar el `role` desde las DevTools del browser) invalida la firma y React Router rechaza la sesión.

### `httpOnly: true`

La cookie `__session` no es accesible desde JavaScript del browser (`document.cookie`). Un ataque XSS no puede robar la sesión del usuario ni los tokens JWT almacenados en ella.

### `secure: true` en producción

En producción la cookie solo se envía sobre HTTPS. En desarrollo local (`NODE_ENV !== "production"`) se permite HTTP para comodidad.

### `sameSite: "lax"`

Protege contra la mayoría de ataques CSRF mientras permite el funcionamiento normal de links externos (por ejemplo, un enlace en un email que lleva al usuario a la app).

### Logout garantizado

`destroySession` genera un header `Set-Cookie` que borra la cookie `__session` del browser. Aunque el backend no esté disponible, el usuario pierde su sesión en el frontend de forma garantizada.

### Sanitización de `redirectTo`

El parámetro `redirectTo` solo acepta strings que comiencen con `/`. Esto previene ataques de open redirect donde un atacante podría construir una URL como `/login?redirectTo=https://malicious.com`.

### Headers de seguridad hacia el backend (auth anónimo)

Las llamadas de login y register incluyen `Origin`, `Referer`, `X-Device-Fingerprint` y `X-Frontend-Type`. Esto permite al backend:

- Construir el fingerprint del dispositivo para tracking de sesiones (`X-Device-Fingerprint`)
- Validar que el rol del usuario corresponde al frontend (`X-Frontend-Type`)
