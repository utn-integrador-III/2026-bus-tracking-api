create extension if not exists "pgcrypto";

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  origin varchar(255) not null,
  destination varchar(255) not null,
  geometry_geojson jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists routes_is_active_idx on public.routes (is_active);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists routes_set_updated_at on public.routes;
create trigger routes_set_updated_at
  before update on public.routes
  for each row execute function public.set_updated_at();

alter table public.routes enable row level security;
