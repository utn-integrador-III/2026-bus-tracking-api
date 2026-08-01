# Passenger incidents - moderation status

## Deployed schema

`public.reports` carries a moderation workflow:

| Column | Type | Notes |
|---|---|---|
| `moderation_status` | `public.report_moderation_status` (`pending`, `validated`, `dismissed`) | defaults to `pending` |
| `moderated_by` | `uuid` -> `auth.users(id)` | null until a moderator acts |
| `moderated_at` | `timestamptz` | null until a moderator acts |

The deployed project also holds a `report_validations` table (`report_id`, `user_id`, `vote_type` with `confirm` / `reject`) intended for community voting.

## What the API implements today

- `POST /api/passenger/incidents` creates a report. The database assigns `moderation_status = 'pending'`.
- `GET /api/passenger/incidents?trip_id=` returns the reports of a trip, **excluding** any report whose `moderation_status` is `dismissed`.
- Neither endpoint returns the reporter `user_id`. The passenger-facing projection drops it.

## What is not implemented

There is **no** moderation endpoint and **no** voting endpoint in this milestone:

- nothing writes `moderation_status`, `moderated_by` or `moderated_at`, so reports stay `pending` indefinitely;
- `report_validations` is never read or written by the API.

As a consequence the passenger-facing list serves `pending` reports. Restricting the list to `validated` only would make the community feature return nothing at all until a moderation surface exists, so `pending` remains visible on purpose.

The columns above are therefore **not** a working feature. They are schema prepared for a later milestone. The rule to apply when that milestone starts:

1. expose a moderation endpoint that sets `moderation_status`, `moderated_by` and `moderated_at`;
2. expose a voting endpoint backed by `report_validations`;
3. then narrow the passenger-facing list to `validated` plus the caller's own reports.

The visible statuses live in `constants/reportModerationStatus.js`, which is the single place to change when step 3 happens.
