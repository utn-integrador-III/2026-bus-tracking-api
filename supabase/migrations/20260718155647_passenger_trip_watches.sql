create table if not exists public.passenger_trip_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  stop_id uuid not null references public.stops (id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'alerted', 'passed')),
  alerted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, trip_id)
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'passenger_trip_watches_status_check'
      and conrelid = 'public.passenger_trip_watches'::regclass
  ) then
    alter table public.passenger_trip_watches
      drop constraint passenger_trip_watches_status_check;
  end if;

  alter table public.passenger_trip_watches
    add constraint passenger_trip_watches_status_check
    check (status in ('waiting', 'alerted', 'passed'));
end $$;

create index if not exists idx_passenger_trip_watches_trip_status
  on public.passenger_trip_watches (trip_id, status);

alter table public.passenger_trip_watches enable row level security;

drop policy if exists "Passengers manage their own stop watches"
  on public.passenger_trip_watches;

create policy "Passengers manage their own stop watches"
  on public.passenger_trip_watches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);;
