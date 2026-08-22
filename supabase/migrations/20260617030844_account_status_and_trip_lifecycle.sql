-- FR-02: permitir desactivar cuentas sin romper integridad histórica.
ALTER TABLE public.users
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN deactivated_at timestamptz;

-- FR-10 / NFR-11: separar horario programado (departure_time/arrival_time)
-- de las marcas reales de inicio y cierre del turno.
ALTER TABLE public.trips
  ADD COLUMN started_at timestamptz,
  ADD COLUMN ended_at   timestamptz;

ALTER TABLE public.trips
  ADD CONSTRAINT chk_trips_ended_after_started
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at);

CREATE INDEX idx_users_is_active ON public.users (is_active);;
