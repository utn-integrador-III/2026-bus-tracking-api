-- Relaciona pasajero <-> viaje en modo seguimiento, con parada de abordaje
-- y destino elegidas, y el umbral de proximidad configurable (FR-21: 500 m).
CREATE TYPE subscription_status AS ENUM ('active', 'exited');

CREATE TABLE public.trip_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id        uuid NOT NULL,
  trip_id             uuid NOT NULL,
  boarding_stop_id    uuid,
  destination_stop_id uuid,
  alert_radius_meters integer NOT NULL DEFAULT 500,
  status              subscription_status NOT NULL DEFAULT 'active',
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_subscriptions_passenger_fkey FOREIGN KEY (passenger_id)
    REFERENCES public.passengers (user_id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT trip_subscriptions_trip_fkey FOREIGN KEY (trip_id)
    REFERENCES public.trips (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT trip_subscriptions_boarding_stop_fkey FOREIGN KEY (boarding_stop_id)
    REFERENCES public.stops (id) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT trip_subscriptions_destination_stop_fkey FOREIGN KEY (destination_stop_id)
    REFERENCES public.stops (id) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT uq_trip_subscriptions_passenger_trip UNIQUE (passenger_id, trip_id),
  CONSTRAINT chk_trip_subscriptions_radius CHECK (alert_radius_meters > 0)
);

CREATE INDEX idx_trip_subscriptions_trip      ON public.trip_subscriptions (trip_id);
CREATE INDEX idx_trip_subscriptions_passenger ON public.trip_subscriptions (passenger_id);
-- Acelera FR-30 (push por lotes a quienes siguen activamente un viaje).
CREATE INDEX idx_trip_subscriptions_trip_active
  ON public.trip_subscriptions (trip_id) WHERE status = 'active';

ALTER TABLE public.trip_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_subscriptions_select_own_or_admin ON public.trip_subscriptions
  FOR SELECT TO authenticated
  USING (passenger_id = auth.uid() OR public.is_admin());

CREATE POLICY trip_subscriptions_insert_self ON public.trip_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (passenger_id = auth.uid());

CREATE POLICY trip_subscriptions_update_own_or_admin ON public.trip_subscriptions
  FOR UPDATE TO authenticated
  USING (passenger_id = auth.uid() OR public.is_admin())
  WITH CHECK (passenger_id = auth.uid() OR public.is_admin());

CREATE POLICY trip_subscriptions_delete_own_or_admin ON public.trip_subscriptions
  FOR DELETE TO authenticated
  USING (passenger_id = auth.uid() OR public.is_admin());;
