-- NFR-06 / NFR-03: emitir cambios por WebSocket para telemetría, estado de
-- viaje, notificaciones e incidentes.
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;;
