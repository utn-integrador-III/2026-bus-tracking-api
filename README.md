# 2026-bus-tracking-api

# 2026 Bus Tracking API

## Project Structure

This repository contains the backend API of the Real-Time Bus Tracking Application. The backend is built with Python and is responsible for handling business logic, trip management, real-time tracking support, incident reports, notifications, external services, and communication with the cloud database.

The project structure is designed to keep the backend modular, scalable, secure, and easy to maintain as the application grows.

```bash
bus-tracking-api/
├── app/
│   ├── main.py
│   ├── config/
│   ├── core/
│   ├── modules/
│   ├── services/
│   ├── middlewares/
│   └── utils/
├── supabase/
│   ├── migrations/
│   ├── policies/
│   └── seed/
├── tests/
├── docs/
├── scripts/
├── .env.example
├── .gitignore
├── requirements.txt
├── README.md
└── Dockerfile
```

## Folder Overview

### `app/`

Contains the main backend application source code.

This folder includes the API entry point, configuration files, core logic, business modules, external services, middlewares, and utility functions.

### `app/main.py`

Main entry point of the backend API.

It is responsible for initializing the application, loading routes, configuring middlewares, and exposing the API service.

### `config/`

Contains application configuration files.

This folder manages environment variables, project settings, Supabase configuration, Firebase configuration, OSRM configuration, and other external service settings.

### `core/`

Contains core backend logic shared across the application.

This includes security utilities, constants, permissions, custom exceptions, and shared backend rules.

### `modules/`

Contains the main business modules of the backend.

Each module is organized by system responsibility, such as trips, locations, reports, and notifications. This keeps the backend separated by domain and easier to maintain.

### `services/`

Contains integrations and reusable backend services.

This folder handles communication with external providers such as Supabase, OSRM, Firebase Cloud Messaging, ETA calculations, speed calculations, and real-time communication support.

### `middlewares/`

Contains middleware logic used before or after API requests.

This may include authentication validation, role-based access control, error handling, request logging, and security checks.

### `utils/`

Contains reusable helper functions used across the backend.

This includes response formatting, validation helpers, distance calculations, date utilities, and other shared logic.

### `supabase/`

Contains database-related resources for Supabase.

This includes database migrations, security policies, seed data, and future database setup files.

### `supabase/migrations/`

Contains SQL migration files used to create or update the database structure.

These files define tables, relationships, enums, indexes, and other database objects.

### `supabase/policies/`

Contains Supabase Row Level Security policies.

These policies define who can read, insert, update, or delete information based on the authenticated user role.

### `supabase/seed/`

Contains initial data used for development or testing.

This may include sample buses, routes, stops, administrators, drivers, or test trips.

### `tests/`

Contains automated tests for backend modules.

This folder is used to validate the behavior of API endpoints, business logic, services, and data processing.

### `docs/`

Contains technical documentation related to the backend.

This may include API endpoints, database model documentation, backend architecture, deployment notes, and integration details.

### `scripts/`

Contains helper scripts for development and maintenance tasks.

This may include scripts for testing the Supabase connection, loading seed data, running local checks, or preparing development data.

## Recommended Backend Structure

```bash
app/
├── main.py
│
├── config/
│   └── settings.py
│
├── core/
│   ├── security.py
│   └── constants.py
│
├── modules/
│   ├── trips/
│   │   ├── trip_router.py
│   │   ├── trip_service.py
│   │   └── trip_schema.py
│   │
│   ├── locations/
│   │   ├── location_router.py
│   │   ├── location_service.py
│   │   └── location_schema.py
│   │
│   ├── reports/
│   │   ├── report_router.py
│   │   ├── report_service.py
│   │   └── report_schema.py
│   │
│   └── notifications/
│       ├── notification_router.py
│       ├── notification_service.py
│       └── notification_schema.py
│
├── services/
│   ├── supabase_service.py
│   ├── osrm_service.py
│   ├── eta_service.py
│   └── firebase_service.py
│
├── middlewares/
│   └── auth_middleware.py
│
└── utils/
    ├── response.py
    ├── validators.py
    └── distance.py
```

## Module Overview

### `trips/`

Handles trip-related operations.

This module manages daily trips, assigned drivers, assigned buses, route selection, trip status changes, trip start, trip completion, and trip cancellation.

### `locations/`

Handles location and telemetry records.

This module stores GPS coordinates, timestamps, speed data, and trip-related location updates while a bus is active.

### `reports/`

Handles incident reports submitted by passengers and drivers.

This module manages reports related to accidents, delays, traffic congestion, overcrowding, road problems, mechanical failures, and other trip incidents.

### `notifications/`

Handles notification-related operations.

This module is responsible for preparing and sending notifications related to departures, delays, critical incidents, nearby stops, and trip completion.

## Backend Responsibilities

The backend is responsible for processing the main business logic of the system.

It validates requests, manages trip operations, connects with external services, calculates route-related data, supports real-time tracking, and coordinates notifications.

Main responsibilities include:

* Managing trip creation, updates, cancellation, start, and completion.
* Validating user roles and permissions.
* Processing bus location updates.
* Storing telemetry records in the cloud database.
* Calculating estimated speed based on location updates.
* Calculating Estimated Time of Arrival for upcoming stops.
* Communicating with OSRM for route and trajectory information.
* Managing incident reports submitted by users.
* Sending notifications through Firebase Cloud Messaging.
* Connecting with Supabase for database operations.
* Supporting real-time data consistency between the mobile app and the cloud database.
* Keeping the backend modular and maintainable.

## General Architecture

```bash
React Native App
    │
    ├── Supabase Auth
    │   └── User authentication and session management
    │
    ├── Supabase Realtime
    │   └── Real-time trip status, bus location, and reports
    │
    └── Backend API
        │
        ├── Supabase PostgreSQL
        │   └── Users, trips, buses, routes, stops, locations, reports, and notifications
        │
        ├── OSRM
        │   └── Route geometry, trajectory, and ETA support
        │
        └── Firebase Cloud Messaging
            └── Push notifications for passengers and drivers
```

## External Services

### Supabase

Supabase is used as the cloud database provider and authentication service.

The backend connects to Supabase to manage users, trips, buses, routes, stops, locations, reports, notifications, and database policies.

### Supabase Realtime

Supabase Realtime is used to support real-time updates for bus location, trip status, and incident reports.

### OSRM

OSRM is used as the routing engine.

It helps calculate route trajectories, distances, travel paths, and estimated arrival information based on geographic coordinates.

### Firebase Cloud Messaging

Firebase Cloud Messaging is used to send push notifications to mobile users.

Notifications may be triggered when a bus departs, when a delay occurs, when an incident is reported, when the bus is near a selected stop, or when a trip is completed.

## Supabase Structure

```bash
supabase/
├── migrations/
├── policies/
└── seed/
```

### `migrations/`

Contains SQL files used to create and update the database schema.

### `policies/`

Contains Row Level Security policies to protect data access according to user roles.

### `seed/`

Contains initial sample data for development and testing.

## Documentation Structure

```bash
docs/
├── api-endpoints.md
├── database-model.md
└── backend-architecture.md
```

### `api-endpoints.md`

Documents the available API endpoints, request methods, expected parameters, and response formats.

### `database-model.md`

Documents the database entities, fields, relationships, and main data rules.

### `backend-architecture.md`

Documents the backend architecture, module responsibilities, external integrations, and technical decisions.

## Testing Structure

```bash
tests/
├── test_trips.py
├── test_locations.py
└── test_reports.py
```

### `test_trips.py`

Contains tests related to trip creation, trip status updates, trip assignment, and trip completion.

### `test_locations.py`

Contains tests related to GPS tracking, telemetry records, and location processing.

### `test_reports.py`

Contains tests related to incident report creation, validation, and moderation.

## Environment Variables

The backend uses environment variables to manage sensitive configuration values.

These values should be defined in a local `.env` file and documented in `.env.example`.

Example variables:

```bash
APP_NAME=Bus Tracking API
APP_ENV=development
APP_DEBUG=true

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

OSRM_BASE_URL=https://router.project-osrm.org

FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json

CORS_ORIGINS=http://localhost:8081,http://localhost:19006
```

The `SUPABASE_SERVICE_ROLE_KEY` must only be used in the backend and must never be exposed in the mobile application.

## Development Notes

This structure separates responsibilities clearly across the backend.

Business logic is organized inside `modules/`. External integrations are placed in `services/`. Shared configuration is stored in `config/`. Security and constants are placed in `core/`. Request processing logic is supported by `middlewares/`. Reusable helper functions are stored in `utils/`.

Database-related files are organized inside `supabase/`, while technical documentation is stored in `docs/`. Tests are placed in `tests/`, and development helper scripts are placed in `scripts/`.

This organization allows the backend to grow in a clean and maintainable way without mixing API routes, business logic, database configuration, external services, and utility functions.
