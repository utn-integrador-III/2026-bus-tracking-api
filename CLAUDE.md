# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Backend REST + real-time API for a **Real-Time Bus Tracking** application (think "Waze for public transit"). It serves three roles — **Passenger**, **Driver**, **Administrator** — backing a React Native mobile client (separate repo). This repo is currently an **empty scaffold**: the folder layout exists but contains no implementation yet.

> **This repo is backend only.** No frontend / React Native code lives here. The mobile client is a separate project; do not add UI code, components, or frontend tooling here.

## Tech stack (authoritative)

| Concern | Technology |
|---|---|
| API backend | **Node.js + Express 5** (CommonJS — `package.json` has `"type": "commonjs"`) |
| Database | **Supabase / PostgreSQL** (cloud-hosted, UUID PKs, JSONB for GeoJSON geometry) |
| Auth | **Supabase Auth** — JWT validated on every protected request |
| Real-time | **Supabase Realtime** WebSocket channels for telemetry broadcast |
| Routing / ETA | **OSRM** (Open Source Routing Machine), with path caching |
| Push notifications | **Expo Push API** |

> **The `__init__.py` files in every folder are a mistake.** This is a Node/Express project, not Python. New code goes in `.js` modules; do not add Python files. The `__init__.py` placeholders should be removed as folders get real implementations. `package.json` declares `main: index.js`, which does not exist yet and is the expected entry point to create.

## Commands

```bash
npm install              # install deps + auto-installs husky git hooks (prepare script)
npm run lint             # ESLint (flat config) — includes the zero-comments rule
npm run lint:fix         # ESLint with --fix
npm run strip:dry        # report any forbidden code comments (exits 1 if found) — CI gate
npm run strip:apply      # remove forbidden code comments in-place (preserves toolchain directives)
npm run env:check        # fail if a process.env.X used in code is missing from .env.example
npm test                 # placeholder — passes (exit 0); wire a real runner (node --test / Jest / Vitest) later
```

There is **no start script or entry point yet**. When adding one, create `index.js` (the `main` in package.json) and an npm `start`/`dev` script. Copy `.env.example` → `.env` before running; the app reads config from environment variables (`APP_PORT` defaults to 8000, Supabase keys, JWT settings, feature flags).

## Tooling & automation (defense-in-depth)

The same critical checks run locally (Husky hooks) and again in CI — see `INSTRUCTIVO`-style setup baked into this repo:

- **Husky `pre-commit`** (`.husky/pre-commit`): runs `npm run lint` + `gitleaks protect --staged` (gitleaks is optional locally; CI enforces it regardless).
- **Husky `pre-push`** (`.husky/pre-push`): blocks direct pushes to protected branches `main`/`qa`/`dev`. See branch-flow rules below.
- **ESLint flat config** (`eslint.config.mjs`): `@eslint/js` recommended + a **custom `local/no-comments` rule** (`tools/eslint-rules/no-comments.mjs`) that forbids code comments. `.js`/`.cjs` are linted as CommonJS, `.mjs` as ESM.
- **`tools/strip-comments.mjs`**: scope is hard-coded in `INCLUDE_DIRS`/`INCLUDE_ROOT_FILES` — update it if you add new top-level source folders.
- **`scripts/check-env-drift.mjs`**: scans source for `process.env.X` and fails if any key is absent from `.env.example`.
- **Gitleaks** (`.gitleaks.toml`): secret scanning; allowlist for `.env.example`, lockfiles, fixtures.
- **GitHub Actions**: `.github/workflows/ci.yml` (lint + zero-comments + env-check; `test` job gated behind repo var `TESTS_CI_ENABLED`) and `secret-scan.yml` (gitleaks over full history). `.github/dependabot.yml` groups weekly npm updates.

> **Zero-comments policy:** code carries **no comments** — all explanation goes to `.md` files / `docs/`. Only functional toolchain directives are exempt (`eslint-disable`, `@ts-*`, `prettier-ignore`, `/// <reference>`, `//# sourceMappingURL`, `/*! */`, `/* global */`). The lint rule blocks commits; `npm run strip:apply` cleans up.

## Restricción — Flujo de ramas Git (regla dura)

Toda integración a `main` pasa por `dev → qa → main`. Ramas cortas con prefijo
(`feature/* fix/* chore/* refactor/* docs/* test/*`) → PR a `dev`. Commit/push directo
a `main`/`qa`/`dev` **PROHIBIDO** (lo bloquea `.husky/pre-push`). Excepción: `hotfix/* → main`
+ back-merge (`main → qa → dev`) el mismo día. `--no-verify` prohibido salvo aprobación explícita.
Antes de commitear, verifica la rama: si es `main`/`qa`/`dev`, crea una rama corta primero.
Detalle completo: [`docs/git-workflow.md`](docs/git-workflow.md) · resumen para agentes: [`docs/AGENTS-reglas-ramas-y-pr.md`](docs/AGENTS-reglas-ramas-y-pr.md).

## Architecture — intended request flow

The folders define a **layered architecture**. A request should flow downward; each layer only talks to the one below it:

```
routes/         HTTP route definitions, wired to controllers
  └─ controllers/   parse/validate request, call services, shape HTTP response
       └─ services/      business logic, orchestration, domain rules
            └─ repositories/  data access — all Supabase/Postgres queries live here
                 └─ database/     Supabase client init + connection/config
models/         entity shapes / schema definitions (see Data model below)
```

Cross-cutting folders:

- **`middleware/`** — JWT signature validation on every protected request (Supabase tokens), RBAC enforcement, and strict JSON payload sanitization (block SQLi/XSS). RBAC is central: see rules below.
- **`realtime/`** — Supabase Realtime channel setup; ingests driver telemetry and broadcasts to passengers subscribed to a trip channel.
- **`tasks/`** — async/background jobs: intermediate trip-state transitions, geofence proximity checks, ETA recalculation, batch push notifications.
- **`constants/`** — enums and fixed values (roles, trip status, ticket status, proximity radius).
- **`utils/`** — helpers (geospatial math like haversine/geofencing, formatting).
- **`config/`** — environment/config loading.
- **`views/`** — response presenters/serializers (HTTP-layer output shaping).

**NFR-14 is a hard design constraint:** keep services modular and decoupled so the mapping provider (OSRM) and push vendor (Expo) can be swapped without touching business logic. Route external-provider calls through a dedicated service, never inline in controllers/repositories.

## Domain rules that span multiple files

These are the non-obvious invariants worth knowing before changing related code:

- **RBAC (FR-02/04/05):** every public self-registration is forced to role `Passenger`. Driver and Admin accounts can only be created by an Administrator. Backend must block vertical privilege escalation regardless of client input — never trust a client-supplied role.
- **Trip status lifecycle** (`Trip.status` enum): `Scheduled → Pending → In Progress → (Stopped | Delayed) → Completed | Cancelled`. The backend auto-derives intermediate states (In Progress / Delayed / Stopped) by cross-referencing live GPS against route stops — drivers only explicitly Start and End a trip.
- **Telemetry pipeline:** active driver streams `{latitude, longitude, speed, heading}` every ~2s (`TELEMETRY_UPDATE_INTERVAL_SECONDS`) over Realtime; end-to-end latency target < 2s; every point is also persisted to the `Location` table for audit/analytics. Tracking **must** stop the instant a trip is Completed/Cancelled.
- **Geofence proximity alerts (FR-21):** push alert fires when the bus is within a configurable threshold (`STOP_PROXIMITY_RADIUS_METERS`, default 500m) of the passenger's chosen stop, using spherical distance.
- **Tickets:** simulated checkout (dummy gateway auto-approves) → generates a unique ticket → app renders an encrypted QR from the ticket ID. **Senior exemption:** if `Passenger.is_senior`, bypass payment and issue a $0 ticket. Drivers scan QRs to validate boarding; concurrent scans must be ACID-safe (NFR-15).

## Data model (Supabase / PostgreSQL)

Core entities (all UUID PKs unless noted):
`User` (role enum: Passenger/Driver/Admin) → 1:1 `Passenger` / `Driver` / `Administrator` extension tables.
Operational: `Bus`, `Route` (`geometry_geojson` JSONB), `Stop` (ordered per route), `Trip` (FKs to route/bus/driver + status enum), `Location` (BIGINT PK — high-volume telemetry history), `Report` (user incidents w/ coords), `Notification`, `Ticket` (status + payment_type enums).

## Reference docs

Full functional/non-functional requirements (FR-01..FR-30, NFR-01..NFR-16), user stories, and the complete data schema live outside the repo at:
`D:\Universidad\2026\II-Cuatrimestre\ITI-823 PROYECTO INTEGRADOR III  DESARROLLO DE SOFTWARE II\00-Recursos\`
(`Functional and non-functional requirements - Buses Project.pdf`, `BusTrackingProject-CoreUserStoriesChecklists.pdf`, mockups).

## Workflow notes

- Branch flow is fixed: `feature/* → dev → qa → main` (see the hard rule above). `node_modules/`, `.env`, `.claude` are gitignored.
- `package.json`, `package-lock.json`, the tooling files, and `.husky/` are not yet committed — they should be committed (via a short branch → PR to `dev`) so `npm ci` works in CI and the hooks ship to the team.
