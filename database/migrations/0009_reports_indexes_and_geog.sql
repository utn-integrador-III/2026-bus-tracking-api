-- Migration: indexes for the public.reports read path and population of the geog column
-- Ordinal 0008 is reserved for the geofence proximity alerts migration incoming in PR #49 (see issue #77).

create index if not exists idx_reports_trip_id_timestamp
  on public.reports (trip_id, timestamp desc);

create index if not exists idx_reports_type
  on public.reports (type);

create or replace function public.reports_set_geog()
returns trigger
language plpgsql
as $$
begin
  if new.latitude is null or new.longitude is null then
    new.geog := null;
  else
    new.geog := extensions.st_setsrid(
      extensions.st_makepoint(new.longitude::double precision, new.latitude::double precision),
      4326
    )::extensions.geography;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reports_set_geog on public.reports;

create trigger trg_reports_set_geog
  before insert or update of latitude, longitude on public.reports
  for each row
  execute function public.reports_set_geog();

update public.reports
  set geog = extensions.st_setsrid(
    extensions.st_makepoint(longitude::double precision, latitude::double precision),
    4326
  )::extensions.geography
  where geog is null
    and latitude is not null
    and longitude is not null;

create index if not exists idx_reports_geog
  on public.reports using gist (geog);
