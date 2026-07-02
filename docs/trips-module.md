# Módulo de Viajes (Trips CRUD)

Backend del CRUD de **viajes** del sistema de Bus Tracking. Cubre la creación, edición y
cancelación de viajes (solo Administrador) y la consulta de viajes visibles por parte de los
consumidores (Pasajeros y Conductores). Un viaje relaciona una **ruta**, un **bus** y un
**conductor**, y avanza por un ciclo de estados (`trip_status`).

Alcance acotado: este módulo se enfoca **solo en Trips**. Los módulos de usuarios, pasajeros
y conductores quedan fuera; los identificadores `route_id`, `bus_id` y `driver_id` se reciben
del cliente y su integridad la garantiza la **FK de la base de datos**.

> ⚠️ **Estado actual:** la autenticación y el RBAC (**NFR-02**) están **temporalmente
> desactivados** mientras no exista el módulo de usuarios. Todos los endpoints están abiertos.
> El middleware queda como costura lista para reactivar — ver
> [Autenticación](#autenticación-estado-desactivada).

## Endpoints

| Método | Ruta | Rol | Descripción | Respuesta |
|---|---|---|---|---|
| `GET` | `/api/admin/trips` | Admin | Lista completa de viajes (todos los estados). | `200` · array de viajes (forma admin) |
| `POST` | `/api/admin/trips` | Admin | Crea un viaje. | `201` · `{ "id": "<uuid>" }` |
| `GET` | `/api/admin/trips/:id` | Admin | **Aditivo.** Obtiene un viaje por id (forma admin). | `200` · viaje (forma admin) |
| `PUT` | `/api/admin/trips/:id` | Admin | Edita un viaje (incluye `status`). | `200` · `{ "updated": true }` |
| `DELETE` | `/api/admin/trips/:id` | Admin | Cancela lógicamente un viaje (soft-delete, `status=Cancelled`). | `200` · `{ "deleted": true }` |
| `POST` | `/api/admin/trips/:id/reactivate` | Admin | **Aditivo.** Reactiva un viaje (`status=Scheduled`). | `200` · `{ "reactivated": true }` |
| `GET` | `/api/passenger/trips` | Passenger / Driver / Admin | Lista de viajes **visibles** (excluye `Cancelled` y `Completed`). | `200` · array de viajes (forma consumidor) |

Además: `GET /health` → `200 { "status": "ok" }` (sin autenticación).

### Notas de contrato

- La base es `/api`; la segmentación por rol vive en el path (`/admin/...` vs `/passenger/...`),
  igual que en el módulo de Rutas.
- `GET /api/admin/trips/:id` y `POST /api/admin/trips/:id/reactivate` son **endpoints aditivos**:
  cierran la simetría del CRUD (leer un viaje puntual y revertir el soft-delete). La
  reactivación es idempotente y lleva el viaje a `Scheduled`.
- El **soft-delete** no usa `is_active` (la tabla `trips` no lo tiene): se modela con el enum
  `status`. `DELETE` marca `Cancelled`; `reactivate` vuelve a `Scheduled`.
- El CRUD es **conceptualmente solo del Admin**. Pasajeros y conductores únicamente
  **consultan** vía `GET /api/passenger/trips`.

## Matriz RBAC (estado objetivo, hoy NO aplicada)

> ⚠️ La autenticación y el RBAC están **temporalmente desactivados**. Hoy **todos** los
> endpoints están abiertos. La matriz describe el estado **objetivo** que regirá al reactivar
> el middleware junto con el módulo de usuarios.

| Operación | Passenger | Driver | Admin | No autenticado |
|---|---|---|---|---|
| `GET /api/passenger/trips` | ✅ | ✅ | ✅ | ❌ 401 |
| `GET /api/admin/trips` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `GET /api/admin/trips/:id` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `POST /api/admin/trips` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `PUT /api/admin/trips/:id` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `DELETE /api/admin/trips/:id` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |
| `POST /api/admin/trips/:id/reactivate` | ❌ 403 | ❌ 403 | ✅ | ❌ 401 |

## Ciclo de estados (`trip_status`)

`Scheduled → Pending → In_Progress → (Stopped | Delayed) → Completed | Cancelled`.

Valor por defecto en la BD: `Scheduled`. En el alcance actual el Admin puede **fijar y editar
`status` libremente** (cualquier valor del enum) vía el CRUD; la derivación automática de los
estados intermedios (a partir de telemetría GPS) pertenece a una tarea posterior.

## Forma de los datos

### Forma admin
```json
{
  "id": "uuid",
  "route_id": "uuid",
  "bus_id": "uuid",
  "driver_id": "uuid",
  "departure_time": "2026-06-21T08:00:00.000Z",
  "arrival_time": null,
  "status": "Scheduled",
  "created_at": "2026-06-20T12:00:00.000Z",
  "started_at": null,
  "ended_at": null
}
```

### Forma consumidor
```json
{
  "id": "uuid",
  "route_id": "uuid",
  "bus_id": "uuid",
  "departure_time": "2026-06-21T08:00:00.000Z",
  "arrival_time": null,
  "status": "Scheduled"
}
```

Oculta `driver_id` y los timestamps de auditoría (`created_at`, `started_at`, `ended_at`).

## Validación de entrada (zod)

`models/tripSchema.js` define los esquemas. Todos son `.strict()` (rechazan claves
desconocidas → sanitización NFR-10).

- **`createTripSchema`**: `route_id`, `bus_id`, `driver_id` (UUID) y `departure_time`
  (ISO 8601 datetime) requeridos; `arrival_time` (datetime nullable) y `status` (enum)
  opcionales.
- **`updateTripSchema`**: los mismos campos pero parciales; exige **al menos uno**.
- **`idParamSchema`**: `:id` debe ser un UUID válido (`400` si no lo es).

Errores de validación → `400` con envelope
`{ error: { code: "TRIP_VALIDATION_FAILED", message, details } }`.

## Códigos de error (`constants/errorCodes.js`)

| Code | HTTP | Cuándo |
|---|---|---|
| `TRIP_NOT_FOUND` | 404 | El viaje `:id` no existe (GET por id / PUT / DELETE / reactivate). |
| `TRIP_VALIDATION_FAILED` | 400 | Body / params no pasan zod. |
| `TRIP_REFERENCE_INVALID` | 409 | `route_id`, `bus_id` o `driver_id` no corresponde a un registro existente (violación de FK). |
| `DATABASE_ERROR` | 500 | Error de Supabase/PostgreSQL. |
| `NOT_FOUND` | 404 | Ruta HTTP no resuelta. |
| `INTERNAL_ERROR` | 500 | Error inesperado no controlado. |

Todas las respuestas de error usan el envelope `{ error: { code, message, details? } }`.

### Integridad referencial

La validación zod garantiza el **formato UUID**, pero no la existencia de los registros
referenciados. Como los módulos de usuarios y buses están fuera de alcance, la existencia se
delega a las **FKs de la base de datos**: si `route_id`/`bus_id`/`driver_id` no existen,
PostgreSQL responde con el código `23503` y `tripsRepository` lo traduce a un **409
`TRIP_REFERENCE_INVALID`**.

## Arquitectura por capas

```
routes/  →  controllers/  →  services/  →  repositories/  →  database/ (Supabase)
   middleware/ (requireAuth, requireRole, validate, errorHandler, notFound)
   models/ (zod)   constants/   views/ (presenters)   config/   utils/
```

Replica 1:1 el patrón del módulo de Rutas. El SDK de Supabase está aislado en
`database/supabaseClient.js` (NFR-14). El middleware `validate` acepta un segundo parámetro
opcional `code`, que este módulo usa para emitir `TRIP_VALIDATION_FAILED` (Rutas mantiene su
default `ROUTE_VALIDATION_FAILED`).

## Autenticación (estado: desactivada)

Igual que en Rutas: los routers (`routes/adminTripsRouter.js`, `routes/passengerTripsRouter.js`)
**no** encadenan `requireAuth` / `requireRole`, por lo que todos los endpoints están abiertos.
Los middlewares se conservan como costura lista para reactivar cuando exista el módulo de
usuarios. Para reactivar, ver la guía equivalente en [`routes-module.md`](routes-module.md).

## Base de datos

La tabla `public.trips` **ya existe completa** en el proyecto Supabase (creada por las
migraciones base del equipo). **No requiere migración** para este módulo.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `route_id` | `uuid` | not null, FK → `routes.id` |
| `bus_id` | `uuid` | not null, FK → `buses.id` |
| `driver_id` | `uuid` | not null, FK → `users.id` |
| `departure_time` | `timestamptz` | not null |
| `arrival_time` | `timestamptz` | nullable |
| `status` | `trip_status` | not null, default `Scheduled` |
| `created_at` | `timestamptz` | default `now()` |
| `started_at` | `timestamptz` | nullable |
| `ended_at` | `timestamptz` | nullable |

Enum `trip_status`: `Scheduled, Pending, In_Progress, Stopped, Delayed, Completed, Cancelled`.
El proyecto **no usa `updated_at`**; el módulo se alinea con esa convención.

### RLS

La tabla ya tiene RLS habilitado. La API usa la service-role key (que omite RLS) y aplicará el
RBAC en el middleware cuando se reactive; las políticas RLS quedan como segunda capa de defensa.

## Variables de entorno

Reutiliza `APP_PORT`, `APP_HOST`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Ver `.env.example`.

## Pruebas

```bash
npm test
```

Cobertura: esquemas zod (`models/__tests__/tripSchema.test.js`), servicio con repositorio
mockeado (`services/__tests__/tripsService.test.js`), presenters
(`views/__tests__/tripView.test.js`) e integración con supertest sobre `app.js` con el
repositorio de Supabase mockeado (`routes/__tests__/trips.integration.test.js`): CRUD completo,
GET por id, reactivación, validación, soft-delete, 400/404 y el mapeo **409
`TRIP_REFERENCE_INVALID`**. Los casos 401/403 quedan latentes hasta reactivar el middleware.

### Prueba manual end-to-end (auth desactivada)

Requiere `.env` real (Supabase) y filas existentes de `route`, `bus` y `user` (driver):

```bash
npm run dev

# Admin crea -> { "id": "<uuid>" }
curl -X POST http://localhost:8000/api/admin/trips \
  -H "Content-Type: application/json" \
  -d '{"route_id":"<uuid>","bus_id":"<uuid>","driver_id":"<uuid>","departure_time":"2026-06-21T08:00:00Z"}'

# FK inexistente -> 409 TRIP_REFERENCE_INVALID
curl -X POST http://localhost:8000/api/admin/trips \
  -H "Content-Type: application/json" \
  -d '{"route_id":"00000000-0000-0000-0000-000000000000","bus_id":"<uuid>","driver_id":"<uuid>","departure_time":"2026-06-21T08:00:00Z"}'

# Lista completa (todos los estados)
curl http://localhost:8000/api/admin/trips

# Detalle por id (forma admin)
curl http://localhost:8000/api/admin/trips/<uuid>

# Edita el estado -> { "updated": true }
curl -X PUT http://localhost:8000/api/admin/trips/<uuid> \
  -H "Content-Type: application/json" -d '{"status":"Delayed"}'

# Cancela (soft-delete) -> { "deleted": true }
curl -X DELETE http://localhost:8000/api/admin/trips/<uuid>

# Reactiva -> { "reactivated": true }
curl -X POST http://localhost:8000/api/admin/trips/<uuid>/reactivate

# Consumidor lista solo viajes visibles (sin Cancelled ni Completed)
curl http://localhost:8000/api/passenger/trips
```
