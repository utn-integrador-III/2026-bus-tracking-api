# Bus Tracking - Backend

This repository contains the backend of the Real-Time Bus Tracking application, a "Waze for public transportation" that serves three user roles: **Passengers**, **Drivers**, and **Administrators**. It is a **Node.js + Express 5 REST API** with Supabase (PostgreSQL, Auth, and Realtime) that backs the React Native mobile app and the Next.js web admin panel, which live in a separate frontend repository.

## Members

- Alex Herrera Manzanares
- Luis Alejandro López Reyes
- Sebastián Rodríguez Mesen
- Sergio Quesada Chavarría
- Samiel Marín Cambronero

---

## Features

- **Authentication and RBAC**: Supabase Auth with email/password and OAuth, JWT validation on every protected request, and strict role enforcement (public registration is always forced to `Passenger`; Driver and Admin accounts can only be created by an Administrator).
- **Trip Lifecycle Engine**: Trip statuses (`Scheduled`, `Pending`, `In Progress`, `Stopped`, `Delayed`, `Completed`, `Cancelled`) auto-derived by cross-referencing live GPS against route stops; drivers only explicitly start and end trips.
- **Real-Time Telemetry**: Supabase Realtime channels broadcast driver GPS telemetry (`latitude`, `longitude`, `speed`, `heading`) every ~2 seconds to subscribed passengers and admins, with every point persisted to the `Location` table for audit and analytics.
- **Geofence Proximity Alerts**: Background worker detects when a bus enters a configurable radius (default 500m) of a passenger's chosen stop and triggers a push notification.
- **Ticket Engine**: Simulated checkout (dummy gateway auto-approves), encrypted QR generation from the ticket ID, ACID-safe boarding validation on concurrent scans, and senior citizen exemption ($0 tickets).
- **Community Incidents**: Passenger and driver incident reports with coordinates, admin moderation workflow, and a one-hour listing window.
- **Push Notifications**: Firebase Cloud Messaging (HTTP v1) delivered through Supabase Edge Functions, with batched processing and a queue-based notification engine.
- **Routing and ETA**: Google Routes API integration for directions, distances, and travel-time calculations.
- **API Documentation**: Full OpenAPI specification served through Swagger UI.
- **Quality Gates**: Husky pre-commit and pre-push hooks, ESLint with a zero-comments policy, strict environment drift checks, Gitleaks secret scanning, Jest + Supertest suites, and GitHub Actions CI.

---

## Project Architecture

### 1. Layered Request Flow

A request flows downward; each layer only talks to the one below it:

```text
routes/              HTTP route definitions, wired to controllers
  └─ controllers/    Parse and validate requests, call services, shape HTTP responses
       └─ services/  Business logic, orchestration, and domain rules
            └─ repositories/  Data access; all Supabase/PostgreSQL queries live here
                 └─ database/ Supabase client initialization and connection config
models/              Zod schemas and entity shapes
```

### 2. Feature-First Modules (`src/modules/`)

The implementation is consolidating toward a feature-first structure, where each module groups its controller, application service, infrastructure adapters, and factory:

- **`auth/`**: Public passenger registration, login, and account provisioning.
- **`admin/`**: Administrator operations (drivers, senior requests, moderation).
- **`driver-trips/`**: Driver trip control, GPS telemetry persistence, and driver incidents.
- **`passenger-tracking/`**: Trip watch subscriptions, push tokens, and tracking services.
- **`passenger-incidents/`**: Community incident reports.
- **`routes/`** and **`trips/`**: Route and trip management with GeoJSON geometry.
- **`tickets/`**: Ticket generation and QR validation.
- **`notifications/`**: Notification persistence and delivery.

Patterns applied: **Dependency Injection**, **Repository Pattern**, **Factory Pattern**, and **Adapter Pattern** (NFR-14 keeps external providers like Google Routes and FCM swappable without touching business logic).

### 3. Cross-Cutting Layers

- **`middleware/`**: JWT validation, RBAC enforcement, Zod request validation, error handling, and 404 handling.
- **`realtime/`**: Supabase Realtime channel setup for telemetry broadcast.
- **`tasks/`**: Background jobs such as the geofence proximity worker.
- **`constants/`**: Enums and fixed values (roles, trip statuses, ticket statuses, proximity radius).
- **`utils/`**: Helpers (geospatial math such as haversine and geofencing, async handling, custom errors).
- **`config/`**: Environment loading and OpenAPI document generation.
- **`views/`**: Response presenters and serializers.

### 4. Database and Edge Functions (`supabase/`)

- **`supabase/migrations/`**: Versioned SQL migrations covering the full schema (users, roles, buses, routes, stops, trips, locations, reports, notifications, tickets), RLS policies, security definer functions, PostGIS geofences, realtime publication, and performance indexes.
- **`supabase/functions/`**: Supabase Edge Functions (Deno) for push notification delivery via FCM.

### 5. File Structure

```text
2026-bus-tracking-api
    |
    |-- src                      # Feature-first modules (new code lands here)
    |   |-- api                  # API router factory
    |   `-- modules              # auth, admin, driver-trips, passenger-tracking,
    |                            # passenger-incidents, routes, trips, tickets, notifications
    |
    |-- routes                   # HTTP route definitions
    |-- controllers              # Request handling and response shaping
    |-- services                 # Business logic and orchestration
    |-- repositories             # Supabase/PostgreSQL data access
    |-- database                 # Supabase client initialization
    |-- models                   # Zod schemas and entity shapes
    |-- middleware               # JWT auth, RBAC, validation, error handling
    |-- realtime                 # Supabase Realtime channel setup
    |-- tasks                    # Background jobs (proximity worker)
    |-- constants                # Enums and fixed values
    |-- utils                    # Geospatial math and shared helpers
    |-- config                   # Environment and OpenAPI configuration
    |-- views                    # Response presenters
    |
    |-- supabase
    |   |-- migrations           # Versioned SQL schema migrations
    |   `-- functions            # Edge Functions (push notifications)
    |
    |-- docs                     # Architecture and module documentation
    |-- .github                  # CI workflows (lint, test, secret scan)
    |-- app.js                   # Express application factory
    |-- index.js                 # Server entry point
    |-- Dockerfile               # Container image definition
    |-- fly.toml                 # Fly.io deployment configuration
    `-- package.json             # Dependencies and scripts
```

---

## Configuration

### Prerequisites

- Node.js (20 or higher, 22 recommended)
- npm
- Git
- A Supabase project (URL, anon key, and service role key) with the migrations from `supabase/migrations/` applied
- A Google Maps API key (backend) for routing and ETA calculations
- A Firebase project with a service account (for push notifications)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/utn-integrador-III/2026-bus-tracking-api.git
cd 2026-bus-tracking-api
```

2. Install dependencies:

```bash
npm install
```

3. Create the environment file from the template:

```bash
cp .env.example .env
```

The `.env` file must define the Supabase keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `GOOGLE_MAPS_API_KEY`, the JWT and ticket QR secrets (`JWT_SECRET_KEY`, `TICKET_QR_SECRET`), and the FCM credentials. Feature flags such as `ENABLE_PUSH_NOTIFICATIONS`, `ENABLE_GOOGLE_ROUTES`, and `ENABLE_SUPABASE_REALTIME` control optional integrations.

### Running the API

```bash
npm run dev             # start with auto-reload (node --watch)
npm start               # start the production server
```

Access: `http://localhost:8000` (configurable via `APP_PORT`).

### API Documentation

The OpenAPI specification is served through Swagger UI at:

```text
http://localhost:8000/api/docs
```

---

## Automated Testing

The API includes unit tests (Jest) and integration tests (Jest + Supertest) covering models, services, repositories, middleware, and the HTTP layer:

```bash
npm test                # run the full test suite
npm run test:watch      # run tests in watch mode
npm run test:coverage   # run tests with a coverage report
```

Quality gates available as npm scripts:

```bash
npm run lint            # ESLint (includes the zero-comments rule)
npm run strip:dry       # report forbidden code comments (CI gate)
npm run env:check       # fail if a process.env variable is missing from .env.example
```

---

## Demo Video

[Watch the demo video](https://drive.google.com/drive/folders/1ESZNOkoY20TGu7pt-pSl53VWlYAaMI9S?usp=sharing)

---

## Future Improvements

- **Map provider abstraction**: Google Maps was adopted in this delivery following the professor's recommendation. In future iterations the map layer will move behind an adapter so Google Maps, Mapbox, and MapLibre can be swapped without touching screens or backend services, avoiding dependence on a single provider.
- **Design polish**: refine the screens that still rely on native Android defaults so the entire UI follows the shared design system.

---

[Back to top](#bus-tracking---backend)