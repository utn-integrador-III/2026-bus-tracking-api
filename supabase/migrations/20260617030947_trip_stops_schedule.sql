-- Horario teórico parada por parada de cada viaje + registro del paso real,
-- soporta FR-16 (rejilla de horarios), FR-25 (ETA) y FR-11 (estados intermedios).
CREATE TABLE public.trip_stops (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             uuid NOT NULL,
  stop_id             uuid NOT NULL,
  stop_order          integer NOT NULL,
  scheduled_time      timestamptz,
  actual_arrival_time timestamptz,
  eta                 timestamptz,
  CONSTRAINT trip_stops_trip_fkey FOREIGN KEY (trip_id)
    REFERENCES public.trips (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT trip_stops_stop_fkey FOREIGN KEY (stop_id)
    REFERENCES public.stops (id) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT uq_trip_stops_trip_order UNIQUE (trip_id, stop_order),
  CONSTRAINT uq_trip_stops_trip_stop  UNIQUE (trip_id, stop_id),
  CONSTRAINT chk_trip_stops_order CHECK (stop_order >= 0)
);

CREATE INDEX idx_trip_stops_trip ON public.trip_stops (trip_id, stop_order);

ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;

-- Datos operativos: lectura para autenticados, escritura solo admin (como stops).
CREATE POLICY trip_stops_select_all ON public.trip_stops
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY trip_stops_write_admin ON public.trip_stops
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());;
