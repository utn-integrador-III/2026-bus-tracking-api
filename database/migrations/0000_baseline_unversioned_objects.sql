-- Migration 0000: baseline for live objects that were never shipped as a migration (issue #72).
--
-- Reconstructed from the application code, not from a database dump: the Supabase project was
-- unreachable when this file was authored. Every statement is guarded, so applying it against the
-- already-deployed database is a no-op.
--
-- Numbered 0000 on purpose. These objects must exist before the migrations that already reference
-- them: 0004_create_scan_ticket_function.sql declares "returns setof public.tickets",
-- 0005_passenger_trip_watches.sql has a foreign key to public.stops (id), and
-- 0006_ticket_payment_enum.sql alters public.payment_type. Appending the backfill at the end of the
-- sequence would leave a fresh environment unable to apply 0004 or 0005.
--
-- Still not versioned anywhere and assumed to exist: public.users, public.passengers, public.trips,
-- public.routes. Row level security policies for the tables below are not reproduced here because
-- the live policies could not be read; they need their own migration once dumped.

do $do$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ticket_status' and n.nspname = 'public'
  ) then
    create type public.ticket_status as enum ('Generated', 'Scanned');
  end if;
end
$do$;

do $do$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'payment_type' and n.nspname = 'public'
  ) then
    create type public.payment_type as enum ('Mock', 'Senior_Exemption');
  end if;
end
$do$;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.passengers (user_id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  status public.ticket_status not null default 'Generated',
  payment_type public.payment_type not null default 'Mock',
  generated_at timestamptz not null default now(),
  scanned_at timestamptz,
  scanned_by uuid references public.users (id),
  qr_token text,
  qr_payload text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tickets_passenger_id_created_at
  on public.tickets (passenger_id, created_at desc);

create index if not exists idx_tickets_trip_id
  on public.tickets (trip_id);

do $do$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'senior_verification_status' and n.nspname = 'public'
  ) then
    create type public.senior_verification_status as enum ('pending', 'approved', 'rejected');
  end if;
end
$do$;

create table if not exists public.senior_verification_requests (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.passengers (user_id) on delete cascade,
  document_image_bucket text not null,
  document_image_path text not null,
  status public.senior_verification_status not null default 'pending',
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_senior_verification_requests_status_created_at
  on public.senior_verification_requests (status, created_at desc);

-- public.stops has no migration anywhere, yet 0005_passenger_trip_watches.sql declares a foreign key
-- to public.stops (id), so the sequence cannot be replayed from scratch without it. Columns are taken
-- from models/stopSchema.js and from the embed in SupabaseTripWatchRepository
-- ("id, route_id, latitude, longitude, stop_order, geofence_radius_meters").
--
-- The table already exists in the deployed project, so "create table if not exists" is a no-op there.
-- The separate "add column if not exists" below is what actually closes the live gap: it is the
-- geofence_radius_meters column that PR #123 has to degrade around today.

create table if not exists public.stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  name varchar(255) not null,
  latitude numeric not null,
  longitude numeric not null,
  stop_order integer not null,
  geofence_radius_meters integer not null default 500
);

alter table public.stops
  add column if not exists geofence_radius_meters integer not null default 500;

-- Added as a named constraint rather than inline so the fresh-replay path and the already-deployed
-- path converge on the same shape. NOT VALID because the live rows cannot be inspected from here: it
-- is enforced on every insert and update from now on, and can be promoted later with
-- "alter table public.stops validate constraint stops_geofence_radius_meters_check;".

alter table public.stops
  drop constraint if exists stops_geofence_radius_meters_check;

alter table public.stops
  add constraint stops_geofence_radius_meters_check
  check (geofence_radius_meters > 0)
  not valid;

create index if not exists idx_stops_route_id_stop_order
  on public.stops (route_id, stop_order);

alter table public.passengers
  add column if not exists expo_push_token varchar;

alter table public.passengers
  add column if not exists birth_date date;

alter table public.passengers
  add column if not exists senior_status text not null default 'not_applicable';

do $do$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'review_senior_verification_request' and n.nspname = 'public'
  ) then
    execute $sql$
      create function public.review_senior_verification_request(
        p_request_id uuid,
        p_action text,
        p_reviewed_by uuid,
        p_rejection_reason text
      )
      returns setof public.senior_verification_requests
      language plpgsql
      as $fn$
      declare
        v_request public.senior_verification_requests%rowtype;
      begin
        if p_action not in ('approved', 'rejected') then
          raise exception 'SENIOR_VERIFICATION_INVALID_ACTION'
            using detail = format('Action %s is not approved or rejected.', p_action);
        end if;

        select * into v_request
        from public.senior_verification_requests
        where id = p_request_id
        for update;

        if not found then
          raise exception 'SENIOR_VERIFICATION_NOT_FOUND'
            using detail = format('Request %s does not exist.', p_request_id);
        end if;

        if v_request.status is distinct from 'pending' then
          raise exception 'SENIOR_VERIFICATION_ALREADY_REVIEWED'
            using detail = format('Request status is %s, expected pending.', v_request.status);
        end if;

        update public.senior_verification_requests
        set status = p_action::public.senior_verification_status,
            reviewed_by = p_reviewed_by,
            reviewed_at = now(),
            rejection_reason = case when p_action = 'rejected' then p_rejection_reason else null end,
            updated_at = now()
        where id = p_request_id
        returning * into v_request;

        update public.passengers
        set senior_status = p_action,
            is_senior = (p_action = 'approved')
        where user_id = v_request.passenger_id;

        return next v_request;
      end;
      $fn$;
    $sql$;
  end if;
end
$do$;
