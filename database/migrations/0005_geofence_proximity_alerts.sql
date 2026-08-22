alter table public.passengers
  add column if not exists fcm_token text;

create table if not exists public.passenger_trip_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  stop_id uuid not null references public.stops (id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'alerted', 'cancelled')),
  alerted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, trip_id)
);

create index if not exists idx_passenger_trip_watches_trip_status
  on public.passenger_trip_watches (trip_id, status);
