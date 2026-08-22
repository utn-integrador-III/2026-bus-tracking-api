-- Extensión espacial en el esquema recomendado por Supabase (no en public).
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Columnas geográficas derivadas (generadas) para usar geocercas esféricas
-- e intersecciones espaciales nativas en lugar de cálculos manuales.
ALTER TABLE public.stops
  ADD COLUMN geog extensions.geography(Point,4326)
    GENERATED ALWAYS AS (
      extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    ) STORED,
  ADD COLUMN geofence_radius_meters integer NOT NULL DEFAULT 100;

ALTER TABLE public.reports
  ADD COLUMN geog extensions.geography(Point,4326)
    GENERATED ALWAYS AS (
      extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    ) STORED;

ALTER TABLE public.locations
  ADD COLUMN geog extensions.geography(Point,4326)
    GENERATED ALWAYS AS (
      extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    ) STORED;

-- Índices espaciales para proximidad (FR-21) y buffers de incidentes (FR-29).
CREATE INDEX idx_stops_geog     ON public.stops     USING gist (geog);
CREATE INDEX idx_reports_geog   ON public.reports   USING gist (geog);
CREATE INDEX idx_locations_geog ON public.locations USING gist (geog);

ALTER TABLE public.stops
  ADD CONSTRAINT chk_stops_geofence_radius CHECK (geofence_radius_meters > 0);;
