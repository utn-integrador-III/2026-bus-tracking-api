# Geofence Proximity Alerts (US-07B / FR-21)

Push a passenger a "bus approaching" alert when a tracked bus enters the geofence
radius (default **500 m**) of the stop they are watching.

## Flow

```
Driver telemetry (POST /driver/trips/:id/location)
  └─ driver-trips ingest
       ├─ persist Location + broadcast realtime location
       └─ PassengerTrackingService.checkProximity(tripId, lat, lng)   [Node, Haversine]
            ├─ load waiting watches for the trip (+ stop coords/radius)
            ├─ distance_m = haversineDistanceMeters(bus, stop)         [utils/distance.js]
            ├─ for each watch with distance_m <= radius (threshold crossing):
            │    ├─ markAsAlerted  → status 'waiting' → 'alerted'  (fires once)
            │    ├─ realtime emit  → passenger:{id}:alerts  event 'bus_approaching'
            │    │                    payload { passenger_id, trip_id, stop_id, distance_m }
            │    └─ PushNotificationsService.sendGeofenceAlert(...)
            │         └─ POST {SUPABASE_FUNCTIONS_URL}/geofence-alert
            │              body { passenger_id, distance_m, trip_id, stop_id }
            └─ Edge Function geofence-alert  [Deno]
                 ├─ look up passengers.fcm_token by user_id
                 └─ FCM HTTP v1 push  (supabase/functions/_shared/fcm.ts)
```

**Threshold crossing = once.** A watch starts as `status = 'waiting'`. The first
telemetry point inside the radius flips it to `'alerted'`; `getActiveWatchesForTrip`
only returns `'waiting'` rows, so the passenger is not spammed on every 2 s update.

## Two triggers for `checkProximity`

The proximity evaluation runs from two places and stays correct under both because the
`waiting -> alerted` transition is idempotent (double evaluation cannot double-alert):

1. **Reactive** — inline in the driver-trips telemetry ingest, evaluated the instant a
   new GPS point arrives (lowest latency).
2. **Proximity Worker** (`tasks/proximityWorker.js`) — a recursive background layer that
   actively monitors live telemetry. It reschedules itself with `setTimeout`
   (`PROXIMITY_WORKER_INTERVAL_SECONDS`, default 5 s), lists active trips
   (`CONSUMER_VISIBLE_STATUSES`), pulls each trip's latest `Location`
   (`locationRepository.getLatestByTripId`), and calls `checkProximity`. This is the
   "Proximity Worker" the user story asks for; enable it with `ENABLE_PROXIMITY_WORKER`.
   Started/stopped in `index.js` and halted on `SIGINT`/`SIGTERM`.

## Asynchronous push dispatch

`checkProximity` awaits only `markAsAlerted` and the realtime emit. The FCM dispatch
(`_dispatchPush`) is **not awaited** — it is fired and its own errors are caught
internally — so the push round-trip never blocks telemetry ingest (keeps the < 2 s
telemetry latency target) and the Edge Function is triggered asynchronously.

## Distance math

`utils/distance.js → haversineDistanceMeters(lat1, lon1, lat2, lon2)` — spherical
(Haversine) distance in metres, Earth radius `6371e3`. `distance_m` is rounded to the
nearest metre before it enters any payload.

## Payload (`distance_m`)

Both the realtime broadcast and the Edge Function invocation carry the core event
payload required by the user story:

```json
{ "passenger_id": "<uuid>", "distance_m": 320, "trip_id": "<uuid>", "stop_id": "<uuid>" }
```

## Vendor decoupling (NFR-14)

- `services/pushNotifications.service.js` — transport-neutral dispatcher. Knows only
  *"POST this payload to the geofence-alert function"*. Swapping vendors never touches
  `checkProximity`.
- `supabase/functions/_shared/fcm.ts` — the only place that knows FCM specifics
  (service-account JWT → OAuth2 access token → FCM HTTP v1 `messages:send`).

## Configuration

Backend (`.env`):

| Var | Purpose | Default |
|---|---|---|
| `STOP_PROXIMITY_RADIUS_METERS` | Fallback radius when a stop has none | `500` |
| `ENABLE_PUSH_NOTIFICATIONS` | Master switch for the push dispatch | `false` |
| `SUPABASE_FUNCTIONS_URL` | Edge functions base URL; derived from `SUPABASE_URL` + `/functions/v1` if empty | — |
| `ENABLE_PROXIMITY_WORKER` | Start the recursive Proximity Worker in `index.js` | `false` |
| `PROXIMITY_WORKER_INTERVAL_SECONDS` | Worker tick interval | `5` |

Edge Function secrets (set in Supabase, **not** in the Node `.env`):

```bash
supabase secrets set FCM_PROJECT_ID=... FCM_CLIENT_EMAIL=... FCM_PRIVATE_KEY="<service-account private_key, newlines as \n>"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into hosted functions
automatically.

## Deploy the Edge Function

```bash
supabase functions deploy geofence-alert
```

## Database

`database/migrations/0005_geofence_proximity_alerts.sql`:

- adds `passengers.fcm_token` (the device token the Edge Function pushes to);
- ensures `passenger_trip_watches` exists (`unique (user_id, trip_id)` backs the
  upsert in `SupabaseTripWatchRepository.addWatch`, indexed by `(trip_id, status)`).

## Frontend (out of scope for this repo)

The user story's frontend requirements — native push permissions, FCM listeners, an
audible trigger, and correct rendering across foreground / background / sleep-lock —
belong to the **React Native client** (`2026-bus-traking-frotend`), not this backend.
This repo is backend-only (see `CLAUDE.md`). The backend contract the client integrates
against:

- Register the device: persist `passengers.fcm_token` for the signed-in passenger.
- Data-message shape delivered via FCM: `{ type: "bus_approaching", passenger_id,
  distance_m, trip_id, stop_id }` (all string values).
- The passenger also receives the same event live over Supabase Realtime on
  `passenger:{user_id}:alerts`, event `bus_approaching`.

The RN work (permissions, listeners, sound, background/lock handling) should be tracked
as a separate story in the frontend repo.

## Note

The `supabase/functions/**` tree is a **Deno** runtime deployed separately; it is
intentionally outside the Node ESLint / zero-comments scope
(`INCLUDE_DIRS` in `tools/strip-comments.mjs`, `SOURCE_GLOBS` in `eslint.config.mjs`).
