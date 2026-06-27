create table if not exists public.locations (
  id bigint primary key generated always as identity,
  trip_id uuid not null references public.trips(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  speed double precision null,
  heading double precision null,
  recorded_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'locations' and column_name = 'recorded_at'
  ) then
    alter table public.locations add column recorded_at timestamptz not null default now();
  end if;
end $$;

create index if not exists locations_trip_id_recorded_at_idx
  on public.locations (trip_id, recorded_at desc);

alter table public.locations enable row level security;

create policy "Drivers insert their trip locations"
  on public.locations for insert
  with check (
    auth.uid() in (
      select driver_id from public.trips where id = trip_id
    )
  );

create policy "Anyone can read locations"
  on public.locations for select
  using (true);
