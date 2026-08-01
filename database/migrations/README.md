# Database migrations

Files in this folder are applied in ascending order of their four digit prefix. The prefix is a
**total order**: no two files may share one, ever. Tooling and humans both apply them by sorting on
the prefix, so a duplicate makes the sequence ambiguous and a fresh environment can end up with a
different schema depending on which of the two ran first.

## Rule when you add a migration

1. List this folder and take the **highest** prefix in use, including the reservations in the ledger
   below. Never reuse a prefix that appears in an open pull request.
2. If your change must run **before** an existing migration (for example because an existing file
   already references the object you are adding), do not renumber the existing files. Use a lower
   free prefix instead. `0000` is the baseline slot for objects that predate the folder.
3. Add a row to the ledger below in the same pull request. That is what makes the reservation
   visible to the next person before they pick a number.
4. Ship the migration in the same pull request as the code that depends on it.

If two open pull requests end up on the same prefix, the one that has not merged yet is the one that
gets renamed. Renaming after a merge means some environments have applied the old name and some the
new one, and there is no record of which.

## Ledger

| Prefix | File | Status |
|---|---|---|
| 0000 | `0000_baseline_unversioned_objects.sql` | in PR, issue #72 |
| 0001 | `0001_routes_add_is_active.sql` | on `dev` |
| 0002 | `0002_auth_login_audit_logs.sql` | on `dev` |
| 0003 | `0003_create_locations_table.sql` | on `dev` |
| 0004 | `0004_create_scan_ticket_function.sql` | on `dev` |
| 0005 | `0005_passenger_trip_watches.sql` | on `dev` |
| 0006 | `0006_ticket_payment_enum.sql` | on `dev` |
| 0007 | `0007_create_reports_table.sql` | on `dev` |
| 0008 | `0008_geofence_proximity_alerts.sql` | **reserved for PR #49** |
| 0009 | `0009_reports_indexes_and_geog.sql` | in PR, issue #65 |
| 0010 | `0010_reports_rls_hardening.sql` | in PR, issue #66 |
| 0011 | `0011_create_report_validations.sql` | in PR, issue #72 |

Next free prefix: **0012**.

## The 0005 collision

`dev` carries `0005_passenger_trip_watches.sql`. PR #49 adds a different migration,
`0005_geofence_proximity_alerts.sql`, under the same prefix.

`0005_passenger_trip_watches.sql` is already merged into `dev` and has been applied, so it keeps its
number. The incoming file is the one that moves: it must be renamed to
`0008_geofence_proximity_alerts.sql` on branch `Alex/US-07B` before PR #49 merges. `0008` is held
open for it in the ledger above and is skipped by every migration added since, so the rename needs
no further coordination.
