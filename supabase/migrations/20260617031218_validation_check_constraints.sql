-- NFR-10: validación declarativa de entrada en la propia base de datos.
ALTER TABLE public.buses
  ADD CONSTRAINT chk_buses_capacity CHECK (capacity > 0);

ALTER TABLE public.stops
  ADD CONSTRAINT chk_stops_lat CHECK (latitude  BETWEEN -90  AND 90),
  ADD CONSTRAINT chk_stops_lon CHECK (longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT chk_stops_order CHECK (stop_order >= 0);

ALTER TABLE public.reports
  ADD CONSTRAINT chk_reports_lat CHECK (latitude  BETWEEN -90  AND 90),
  ADD CONSTRAINT chk_reports_lon CHECK (longitude BETWEEN -180 AND 180);

ALTER TABLE public.locations
  ADD CONSTRAINT chk_locations_lat   CHECK (latitude  BETWEEN -90  AND 90),
  ADD CONSTRAINT chk_locations_lon   CHECK (longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT chk_locations_speed CHECK (speed IS NULL OR speed >= 0);

ALTER TABLE public.tickets
  ADD CONSTRAINT chk_tickets_scanned_after_generated
  CHECK (scanned_at IS NULL OR scanned_at >= generated_at);;
