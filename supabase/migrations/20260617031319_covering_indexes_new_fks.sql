-- Índices de cobertura para las FK nuevas señaladas por el advisor.
CREATE INDEX idx_reports_moderated_by            ON public.reports (moderated_by);
CREATE INDEX idx_tickets_scanned_by              ON public.tickets (scanned_by);
CREATE INDEX idx_trip_stops_stop                 ON public.trip_stops (stop_id);
CREATE INDEX idx_trip_subscriptions_boarding     ON public.trip_subscriptions (boarding_stop_id);
CREATE INDEX idx_trip_subscriptions_destination  ON public.trip_subscriptions (destination_stop_id);;
