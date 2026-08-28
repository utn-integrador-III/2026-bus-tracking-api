alter table public.routes
  add column if not exists is_active boolean not null default true;

create index if not exists routes_is_active_idx
  on public.routes (is_active);;
