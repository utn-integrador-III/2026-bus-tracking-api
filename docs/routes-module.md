# Módulo de Rutas (Routes CRUD)

Backend del CRUD de **rutas** del sistema de Bus Tracking. Cubre la creación, edición y
desactivación de rutas (solo Administrador) y la consulta de rutas activas por parte de los
consumidores autenticados (Pasajeros y Conductores).

Requerimientos cubiertos: **FR-06** (Admin gestiona CRUD de rutas), **FR-15 / FR-16**
(consulta de rutas por pasajeros), **FR-23** (geometría GeoJSON), **NFR-02** (JWT en cada
request), **NFR-10** (sanitización estricta del payload), **NFR-14** (proveedor de datos
desacoplado).

> ⚠️ **Estado actual:** la autenticación y el RBAC (**NFR-02**) están **temporalmente
> desactivados** mientras no exista el módulo de usuarios. Todos los endpoints están abiertos.
> El middleware queda como costura lista para reactivar — ver
> [Autenticación](#autenticación-estado-desactivada).

## Endpoints (nombres exactos del CSV oficial de endpoints REST)

| ID | Método | Ruta | Rol | Descripción | Respuesta |
|---|---|---|---|---|---|
| EP-04 | `GET` | `/api/admin/routes` | Admin | Lista completa de rutas (incluye inactivas). | `200` · array de rutas (forma admin) |
| EP-05 | `POST` | `/api/admin/routes` | Admin | Crea una ruta con geometría GeoJSON. | `201` · `{ "id": "<uuid>" }` |
| EP-06 | `PUT` | `/api/admin/routes/:id` | Admin | Edita metadatos o geometría de una ruta. | `200` · `{ "updated": true }` |
| EP-07 | `DELETE` | `/api/admin/routes/:id` | Admin | Desactiva lógicamente una ruta (soft-delete). | `200` · `{ "deleted": true }` |
| — | `GET` | `/api/admin/routes/:id` | Admin | **Aditivo.** Obtiene una ruta por id (incluye inactivas), forma admin. | `200` · ruta (forma admin) |
| — | `POST` | `/api/admin/routes/:id/reactivate` | Admin | **Aditivo.** Reactiva una ruta (deshace el soft-delete, `is_active=true`). | `200` · `{ "reactivated": true }` |
| EP-14 | `GET` | `/api/passenger/routes` | Passenger / Driver / Admin | Lista de rutas **activas** para consumidores. | `200` · array de rutas (forma consumidor) |

Además: `GET /health` → `200 { "status": "ok" }` (sin autenticación).

### Notas de contrato

- La base es `/api` (sin `/api/v1`); la segmentación por rol vive en el path
  (`/admin/...` vs `/passenger/...`), tal como en el CSV.
- `GET /api/admin/routes/:id` y `POST /api/admin/routes/:id/reactivate` son **endpoints
  aditivos** fuera del CSV oficial: se añadieron para cerrar la simetría del CRUD (leer una
  ruta puntual y revertir el soft-delete). El detalle por id devuelve la forma admin e
  incluye rutas inactivas; la reactivación es idempotente.
- El CRUD es **conceptualmente solo del Admin**. Pasajeros y conductores únicamente
  **consultan** vía `GET /api/passenger/routes`, compartido por todos los roles.
- El campo `schedules` del ejemplo de respuesta de EP-14 depende del módulo de **Trips**
  (fuera de alcance) y se omite. El campo `status` se deriva de `is_active`
  (`Active` / `Inactive`).
- "Seguir ruta" / "favoritas" del pasajero es funcionalidad futura, fuera de este CRUD.

## Matriz RBAC (estado objetivo, hoy NO aplicada)

> ⚠️ La autenticación y el RBAC están **temporalmente desactivados** (ver
> [Autenticación](#autenticación-estado-desactivada)). Hoy **todos** los endpoints están
> abiertos. La matriz siguiente describe el estado **objetivo** que volverá a regir cuando
> se reactive el middleware junto con el módulo de usuarios.

| Operación | Passenger | Driver | Admin | No autenticado |
|---|---|---|---|---|
| `GET /api/passenger/routes` | ✅ | ✅ | ✅ | ❌ 401 |
| `GET /api/admin/routes` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `GET /api/admin/routes/:id` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `POST /api/admin/routes` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `PUT /api/admin/routes/:id` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `DELETE /api/admin/routes/:id` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `POST /api/admin/routes/:id/reactivate` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |

El rol **nunca** se lee del body: cuando el middleware esté activo se resuelve en
`requireAuth` y se valida en `requireRole`. Esto bloquea la escalada vertical de
privilegios (FR-02 / FR-04 / FR-05).

## Forma de los datos

### Forma admin (EP-04)
```json
{
  "id": "uuid",
  "name": "San José - Puntarenas",
  "origin": "San José",
  "destination": "Puntarenas",
  "geometry_geojson": { "type": "LineString", "coordinates": [[-84.07, 9.93], [-84.75, 9.98]] },
  "is_active": true,
  "created_at": "2026-06-20T12:00:00.000Z"
}
```

### Forma consumidor (EP-14)
```json
{
  "id": "uuid",
  "name": "San José - Puntarenas",
  "origin": "San José",
  "destination": "Puntarenas",
  "status": "Active",
  "geometry_geojson": { "type": "LineString", "coordinates": [[-84.07, 9.93], [-84.75, 9.98]] }
}
```

## Validación de entrada (zod)

`models/routeSchema.js` define los esquemas. Todos son `.strict()` (rechazan claves
desconocidas → sanitización NFR-10).

- **`createRouteSchema`**: `name`, `origin`, `destination` (string 1–255, trim) y
  `geometry_geojson` requeridos.
- **`updateRouteSchema`**: los mismos campos pero parciales; exige **al menos uno**.
- **`geoJsonRouteGeometrySchema`**: acepta un `LineString` GeoJSON o un
  `Feature<LineString>`. Coordenadas `[lng, lat]` con `lng ∈ [-180, 180]`,
  `lat ∈ [-90, 90]`, mínimo **2** posiciones.
- **`idParamSchema`**: `:id` debe ser un UUID válido (`400` si no lo es).

Errores de validación → `400` con envelope `{ error: { code: "ROUTE_VALIDATION_FAILED", message, details } }`.

## Códigos de error (`constants/errorCodes.js`)

| Code | HTTP | Cuándo |
|---|---|---|
| `ROUTE_NOT_FOUND` | 404 | La ruta `:id` no existe (GET por id / PUT / DELETE / reactivate). |
| `ROUTE_VALIDATION_FAILED` | 400 | Body / params / query no pasan zod. |
| `AUTH_TOKEN_MISSING` | 401 | Falta `Authorization: Bearer`. **Dormido** (auth desactivada). |
| `AUTH_TOKEN_INVALID` | 401 | Token inválido/expirado. **Dormido** (auth desactivada). |
| `FORBIDDEN_ROLE` | 403 | El rol autenticado no puede ejecutar la operación. **Dormido** (auth desactivada). |
| `DATABASE_ERROR` | 500 | Error de Supabase/PostgreSQL. |
| `NOT_FOUND` | 404 | Ruta HTTP no resuelta. |
| `INTERNAL_ERROR` | 500 | Error inesperado no controlado. |

Todas las respuestas de error usan el envelope `{ error: { code, message, details? } }`.

## Arquitectura por capas

```
routes/  →  controllers/  →  services/  →  repositories/  →  database/ (Supabase)
   middleware/ (requireAuth, requireRole, validate, errorHandler, notFound)
   models/ (zod)   constants/   views/ (presenters)   config/   utils/
```

- El SDK de Supabase está aislado en `database/supabaseClient.js` (NFR-14): para cambiar
  de proveedor solo se reemplaza ese archivo.
- Toda lectura de `process.env.*` está centralizada en `config/env.js`.

## Autenticación (estado: desactivada)

El módulo de **login y usuarios no es parte de esta tarea**. Mientras no exista, el
middleware de autenticación/RBAC está **desactivado**: los routers (`routes/adminRoutesRouter.js`
y `routes/passengerRoutesRouter.js`) **no** encadenan `requireAuth` / `requireRole`, por lo
que todos los endpoints están **abiertos**. Se eliminó también el bypass de desarrollo
(`AUTH_DEV_BYPASS` y las cabeceras `x-dev-*`).

Los archivos `middleware/requireAuth.js` y `middleware/requireRole.js` se conservan como
**costura lista para reactivar**. `requireAuth` ya valida `Authorization: Bearer <jwt>`
contra Supabase Auth (`verifyAccessToken`).

### Cómo reactivar (cuando exista el módulo de usuarios)

1. En `routes/adminRoutesRouter.js` añadir, antes de las rutas:
   `router.use(requireAuth, requireRole(ROLES.ADMIN));` (reimportando `requireAuth`,
   `requireRole` y `ROLES`).
2. En `routes/passengerRoutesRouter.js` añadir `router.use(requireAuth);`.
3. **Importante:** el rol **no viaja en el JWT** de Supabase. La fuente de verdad es la tabla
   `public.user_roles` (la misma que usa `is_admin()`). Por eso `resolveRoleFromUser` (que hoy
   lee `app_metadata.role`) debe sustituirse por un lookup real del rol en `user_roles` a
   partir del `user.id` del token. Ese lookup pertenece al módulo de usuarios.
4. Restaurar en el OpenAPI (`config/openapi.js`) los esquemas de seguridad y las respuestas
   `401`/`403`, y volver a documentar la matriz RBAC como vigente.

## Base de datos

### Estado del esquema

La tabla `public.routes` **ya existe** en el proyecto Supabase (creada por las migraciones
base del equipo, `init_bus_tracking_schema`). Sus columnas y políticas RLS ya estaban
definidas; esta tarea solo añade la columna de soft-delete que el CRUD necesita.

| Columna | Tipo | Notas | Origen |
|---|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` | esquema base |
| `name` | `varchar` | not null | esquema base |
| `origin` | `varchar` | not null | esquema base |
| `destination` | `varchar` | not null | esquema base |
| `geometry_geojson` | `jsonb` | not null (GeoJSON) | esquema base |
| `created_at` | `timestamptz` | default `now()` | esquema base |
| `is_active` | `boolean` | not null, default `true` (soft-delete) | **esta migración** |

El proyecto **no usa `updated_at`** en ninguna tabla (solo `created_at`); el módulo se alinea
con esa convención. El soft-delete vía `is_active` sigue el mismo patrón que `public.users`.

### Migración aplicada

`database/migrations/0001_routes_add_is_active.sql` (aditiva):

```sql
alter table public.routes
  add column if not exists is_active boolean not null default true;
create index if not exists routes_is_active_idx on public.routes (is_active);
```

Aplicada vía MCP de Supabase como migración `routes_add_is_active_soft_delete`.

### RLS

La tabla ya tiene RLS habilitado con políticas que coinciden con el RBAC del módulo:

- `routes_select_all` — `SELECT` para cualquier `authenticated`.
- `routes_insert_admin` / `routes_update_admin` / `routes_delete_admin` — escritura solo si
  `is_admin()`.

La API usa la service-role key (que omite RLS) y aplica el RBAC en el middleware; las
políticas RLS quedan como segunda capa de defensa a nivel de fila.

## Variables de entorno

Reutiliza `APP_PORT`, `APP_HOST`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Ver `.env.example`. (Se eliminó `AUTH_DEV_BYPASS` al desactivar
el middleware de auth.)

## Pruebas

```bash
npm test
```

Cobertura: esquemas zod, servicio (reglas de negocio con repositorio mockeado), middleware
(`requireRole`, `validate`), presenters y un test de integración con supertest sobre `app.js`
con el repositorio de Supabase mockeado (CRUD completo, GET por id, reactivación, validación,
soft-delete, 400/404). Los casos 401/403 quedan latentes hasta reactivar el middleware.

### Prueba manual end-to-end (auth desactivada)

Con `.env` real (Supabase) y los endpoints abiertos, **no hacen falta tokens ni cabeceras**:

```bash
npm run dev

# Admin crea -> { "id": "<uuid>" }
curl -X POST http://localhost:8000/api/admin/routes \
  -H "Content-Type: application/json" \
  -d '{"name":"SJ-PT","origin":"San José","destination":"Puntarenas","geometry_geojson":{"type":"LineString","coordinates":[[-84.07,9.93],[-84.75,9.98]]}}'

# Lista completa (incluye inactivas)
curl http://localhost:8000/api/admin/routes

# Detalle por id (forma admin)
curl http://localhost:8000/api/admin/routes/<uuid>

# Desactiva (soft-delete) -> { "deleted": true }
curl -X DELETE http://localhost:8000/api/admin/routes/<uuid>

# Reactiva -> { "reactivated": true }
curl -X POST http://localhost:8000/api/admin/routes/<uuid>/reactivate

# Consumidor lista solo activas
curl http://localhost:8000/api/passenger/routes
```
