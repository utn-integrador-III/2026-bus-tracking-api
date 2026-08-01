-- Migration: one Generated ticket per passenger per trip.
--
-- Unblocks PR #98 (issue #83), which enforces the rule in application code only. Two concurrent
-- checkouts can still both pass the "does a Generated ticket already exist" read and both insert,
-- so the guarantee has to exist in the database.
--
-- WARNING - this migration can legitimately fail, and that is the point.
-- Issue #83 reports duplicates already present in the deployed project ("Seven tickets were created
-- for a single test passenger, five of them on the same trip"). A unique index cannot be created over
-- data that already violates it. The pre-flight below therefore refuses to proceed and reports how
-- many (passenger_id, trip_id) pairs are offending, instead of failing with an opaque
-- "could not create unique index" from Postgres.
--
-- The duplicates are NOT resolved automatically. There is no honest way to do it from here:
--   - deleting the surplus rows destroys tickets a passenger may already be holding a QR for;
--   - moving them to 'Scanned' records a boarding that never happened;
--   - a 'Superseded' status would have to be invented and added to the status type.
-- Which one is right is a product decision, and it needs the real data in front of whoever makes it.
--
-- To list the offending pairs before applying:
--
--   select passenger_id, trip_id, count(*), array_agg(id order by created_at)
--   from public.tickets
--   where status::text = 'Generated'
--   group by passenger_id, trip_id
--   having count(*) > 1;
--
-- Resolve them, then re-run this file. It is re-runnable and is a no-op once the index exists.

do $do$
declare
  v_duplicate_pairs bigint;
begin
  if to_regclass('public.uq_tickets_generated_per_passenger_trip') is not null then
    return;
  end if;

  select count(*) into v_duplicate_pairs
  from (
    select passenger_id, trip_id
    from public.tickets
    where status::text = 'Generated'
    group by passenger_id, trip_id
    having count(*) > 1
  ) as duplicates;

  if v_duplicate_pairs > 0 then
    raise exception 'TICKETS_DUPLICATE_GENERATED_ROWS'
      using detail = format(
        '%s (passenger_id, trip_id) pair(s) hold more than one Generated ticket. Resolve them before creating the unique index; see the header of 0013_tickets_unique_generated_per_trip.sql.',
        v_duplicate_pairs
      );
  end if;
end
$do$;

create unique index if not exists uq_tickets_generated_per_passenger_trip
  on public.tickets (passenger_id, trip_id)
  where status = 'Generated';
