# Módulo de Rutas (Routes CRUD)

Backend del CRUD de **rutas** del sistema de Bus Tracking. Cubre la creación, edición y
desactivación de rutas (solo Administrador) y la consulta de rutas activas por parte de los
consumidores autenticados (Pasajeros y Conductores).

Requerimientos cubiertos: **FR-06** (Admin gestiona CRUD de rutas), **FR-15 / FR-16**
(consulta de rutas por pasajeros), **FR-23** (geometría GeoJSON), **NFR-02** (JWT en cada
request), **NFR-10** (sanitización estricta del payload), **NFR-14** (proveedor de datos
desacoplado).

## Endpoints (nombres exactos del CSV oficial de endpoints REST)

| ID | Método | Ruta | Rol | Descripción | Respuesta |
|---|---|---|---|---|---|
| EP-04 | `GET` | `/api/admin/routes` | Admin | Lista completa de rutas (incluye inactivas). | `200` · array de rutas (forma admin) |
| EP-05 | `POST` | `/api/admin/routes` | Admin | Crea una ruta con geometría GeoJSON. | `201` · `{ "id": "<uuid>" }` |
| EP-06 | `PUT` | `/api/admin/routes/:id` | Admin | Edita metadatos o geometría de una ruta. | `200` · `{ "updated": true }` |
| EP-07 | `DELETE` | `/api/admin/routes/:id` | Admin | Desactiva lógicamente una ruta (soft-delete). | `200` · `{ "deleted": true }` |
| EP-14 | `GET` | `/api/passenger/routes` | Passenger / Driver / Admin | Lista de rutas **activas** para consumidores. | `200` · array de rutas (forma consumidor) |

Además: `GET /health` → `200 { "status": "ok" }` (sin autenticación).

### Notas de contrato

- La base es `/api` (sin `/api/v1`); la segmentación por rol vive en el path
  (`/admin/...` vs `/passenger/...`), tal como en el CSV.
- El CSV no define `GET /:id` individual ni `reactivate`; por eso **no** se implementan
  (se mantiene el contrato estricto). Reactivar una ruta se hace hoy directo en BD o se
  añadirá cuando exista el endpoint oficial.
- Solo el **Admin** posee el CRUD. Pasajeros y conductores únicamente **consultan** vía
  `GET /api/passenger/routes`, que es compartido por todos los roles autenticados.
- El campo `schedules` del ejemplo de respuesta de EP-14 depende del módulo de **Trips**
  (fuera de alcance) y se omite. El campo `status` se deriva de `is_active`
  (`Active` / `Inactive`).
- "Seguir ruta" / "favoritas" del pasajero es funcionalidad futura, fuera de este CRUD.

## Matriz RBAC

| Operación | Passenger | Driver | Admin | No autenticado |
|---|---|---|---|---|
| `GET /api/passenger/routes` | ✅ | ✅ | ✅ | ❌ 401 |
| `GET /api/admin/routes` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `POST /api/admin/routes` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `PUT /api/admin/routes/:id` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `DELETE /api/admin/routes/:id` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |

El rol **nunca** se lee del body: se resuelve en `requireAuth` a partir del token (o del
bypass de desarrollo) y se valida en `requireRole`. Esto bloquea la escalada vertical de
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
  "created_at": "2026-06-20T12:00:00.000Z",
  "updated_at": "2026-06-20T12:00:00.000Z"
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
| `ROUTE_NOT_FOUND` | 404 | La ruta `:id` no existe (PUT / DELETE). |
| `ROUTE_VALIDATION_FAILED` | 400 | Body / params / query no pasan zod. |
| `AUTH_TOKEN_MISSING` | 401 | Falta `Authorization: Bearer` (o cabeceras del bypass dev). |
| `AUTH_TOKEN_INVALID` | 401 | Token inválido/expirado o rol del bypass inválido. |
| `FORBIDDEN_ROLE` | 403 | El rol autenticado no puede ejecutar la operación. |
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

## Autenticación (estado: costura pendiente)

El módulo de **login y usuarios no es parte de esta tarea**. `requireAuth` queda listo para
integrarse y opera de dos formas:

1. **Producción / token real**: valida `Authorization: Bearer <jwt>` contra Supabase Auth
   (`verifyAccessToken`) y resuelve el rol desde el claim del token
   (`user.app_metadata.role`, con fallback a `user_metadata.role`). Si el rol no es válido,
   degrada a `Passenger`. Cuando exista el módulo de usuarios, aquí se conectará el lookup
   real del rol.
2. **Bypass de desarrollo** (`AUTH_DEV_BYPASS=true`, apagado por defecto): permite probar el
   CRUD sin Supabase Auth usando las cabeceras `x-dev-user-id` y `x-dev-role`
   (`Passenger` | `Driver` | `Admin`). **No debe activarse en producción.**

## Base de datos

### Migración

`database/migrations/0001_create_routes.sql` crea la tabla `public.routes`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `name` | `varchar(255)` | not null |
| `origin` | `varchar(255)` | not null |
| `destination` | `varchar(255)` | not null |
| `geometry_geojson` | `jsonb` | not null (GeoJSON) |
| `is_active` | `boolean` | not null, default `true` (soft-delete) |
| `created_at` | `timestamptz` | not null, default `now()` |
| `updated_at` | `timestamptz` | not null, default `now()`, trigger `set_updated_at` |

Incluye índice `routes_is_active_idx` y habilita RLS sin políticas. La API usa la
service-role key (que omite RLS) y aplica el RBAC en el middleware; RLS queda activado como
defensa en profundidad para bloquear el acceso anónimo directo.

### Cómo aplicar la migración

- **Vía MCP de Supabase**: ejecutar el contenido de `0001_create_routes.sql` contra el
  proyecto; verificar que existan la tabla `routes` y el trigger `routes_set_updated_at`.
- **Manual**: pegar el SQL en el SQL Editor del panel de Supabase.

El `.sql` versionado en el repo es la fuente de verdad del esquema.

## Variables de entorno

Reutiliza `APP_PORT`, `APP_HOST`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Añade **`AUTH_DEV_BYPASS`** (default `false`). Ver `.env.example`.

## Pruebas

```bash
npm test
```

Cobertura: esquemas zod, servicio (reglas de negocio con repositorio mockeado), middleware
(`requireAuth`, `requireRole`, `validate`), presenters y un test de integración con
supertest sobre `app.js` con el repositorio de Supabase mockeado (matriz RBAC, validación,
soft-delete, 401/403/404/400).

### Prueba manual end-to-end

Con `.env` real (Supabase) y `AUTH_DEV_BYPASS=true`:

```bash
npm run dev
# Admin crea
curl -X POST http://localhost:8000/api/admin/routes \
  -H "x-dev-user-id: dev-admin" -H "x-dev-role: Admin" -H "Content-Type: application/json" \
  -d '{"name":"SJ-PT","origin":"San José","destination":"Puntarenas","geometry_geojson":{"type":"LineString","coordinates":[[-84.07,9.93],[-84.75,9.98]]}}'
# Consumidor lista activas
curl http://localhost:8000/api/passenger/routes -H "x-dev-user-id: dev-pax" -H "x-dev-role: Passenger"
```
