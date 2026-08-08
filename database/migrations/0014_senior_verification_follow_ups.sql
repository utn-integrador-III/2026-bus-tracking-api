-- Migration: senior verification follow-ups.
--
-- Part A unblocks PR #113 (issue #85), which starts writing passengers.senior_status = 'pending' at
-- registration. Part B supports PR #117 (issue #86), which starts writing
-- senior_verification_requests.reviewed_by from the authenticated admin.
--
-- The Supabase project was unreachable when this file was authored (no credentials in the
-- environment), so the live shape of both columns could not be read. Everything below is guarded and
-- introspects the catalog at apply time rather than assuming. Diff it against the real project
-- before trusting it.

-- Part A: make sure passengers.senior_status admits 'pending'.
--
-- The documented domain is not_applicable / pending / approved / rejected (config/openapi.js).
-- Observed live values so far are 'not_applicable' (the default) and 'approved' (written by the
-- review RPC). Whether 'pending' is admitted is exactly what could not be verified.
--
-- Three cases are handled:
--   1. no CHECK constraint on the column  -> nothing to widen, 'pending' is already accepted;
--   2. a CHECK constraint that does not mention 'pending' -> replaced by the documented four values;
--   3. the column is an enum missing 'pending' -> refused, see the note in that branch.
-- Case 2 only ever widens: a constraint that already admits 'pending' is left untouched.

do $do$
declare
  v_enum_type text;
  v_constraint_name text;
  v_constraint_def text;
begin
  select t.typname into v_enum_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  where n.nspname = 'public'
    and c.relname = 'passengers'
    and a.attname = 'senior_status'
    and a.attnum > 0
    and not a.attisdropped
    and t.typtype = 'e';

  if v_enum_type is not null then
    if exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = v_enum_type and e.enumlabel = 'pending'
    ) then
      raise notice 'passengers.senior_status is enum %, which already admits pending. Nothing to do.', v_enum_type;
      return;
    end if;

    -- Deliberately not widened here. "alter type ... add value" is not reliable inside a plpgsql
    -- block, and silently converting the column to text would change its shape for every other
    -- consumer. Apply this by hand instead, outside any transaction:
    --   alter type public.<type> add value if not exists 'pending';
    raise exception 'SENIOR_STATUS_ENUM_MISSING_PENDING'
      using detail = format(
        'passengers.senior_status is enum %s and has no pending label. Add it by hand with "alter type public.%s add value if not exists ''pending'';" before applying PR #113.',
        v_enum_type, v_enum_type
      );
  end if;

  select con.conname, pg_get_constraintdef(con.oid)
    into v_constraint_name, v_constraint_def
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'passengers'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%senior_status%'
  limit 1;

  if v_constraint_name is null then
    raise notice 'passengers.senior_status has no check constraint. pending is already accepted.';
    return;
  end if;

  if v_constraint_def like '%pending%' then
    raise notice 'Constraint % already admits pending. Left untouched.', v_constraint_name;
    return;
  end if;

  execute format('alter table public.passengers drop constraint %I', v_constraint_name);

  alter table public.passengers
    add constraint passengers_senior_status_check
    check (senior_status in ('not_applicable', 'pending', 'approved', 'rejected'));
end
$do$;

-- Part B: require a reviewer on any request that is no longer pending.
--
-- The obvious form, "alter column reviewed_by set not null", is deliberately NOT used. Requests
-- reviewed before PR #117 were written with reviewed_by = null, and there is no honest value to
-- backfill them with: any uuid put there would name an admin who did not perform that review.
--
-- Instead the invariant is added as NOT VALID. Postgres enforces it on every insert and update from
-- now on, which is what PR #117 needs, while leaving the historical rows untouched and visibly
-- unverified rather than silently rewritten. Nothing is fabricated and nothing is deleted.
--
-- If the historical rows are ever attributed for real, the constraint can be promoted with:
--   alter table public.senior_verification_requests
--     validate constraint senior_verification_requests_reviewed_by_present;

alter table public.senior_verification_requests
  drop constraint if exists senior_verification_requests_reviewed_by_present;

alter table public.senior_verification_requests
  add constraint senior_verification_requests_reviewed_by_present
  check (status = 'pending' or reviewed_by is not null)
  not valid;
