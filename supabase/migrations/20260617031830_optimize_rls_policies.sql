-- =========================================================================
-- Optimización de RLS (advisors auth_rls_initplan + multiple_permissive):
--  * auth.uid()  -> (select auth.uid())
--  * is_admin()  -> (select public.is_admin())
--  * una sola política permisiva por (rol, acción)
-- Comportamiento de acceso equivalente al anterior.
-- =========================================================================

-- ---------- Tablas catálogo: lectura abierta + escritura admin ----------
-- buses
DROP POLICY buses_select_all  ON public.buses;
DROP POLICY buses_write_admin ON public.buses;
CREATE POLICY buses_select_all  ON public.buses FOR SELECT TO authenticated USING (true);
CREATE POLICY buses_insert_admin ON public.buses FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY buses_update_admin ON public.buses FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY buses_delete_admin ON public.buses FOR DELETE TO authenticated USING ((select public.is_admin()));

-- routes
DROP POLICY routes_select_all  ON public.routes;
DROP POLICY routes_write_admin ON public.routes;
CREATE POLICY routes_select_all  ON public.routes FOR SELECT TO authenticated USING (true);
CREATE POLICY routes_insert_admin ON public.routes FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY routes_update_admin ON public.routes FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY routes_delete_admin ON public.routes FOR DELETE TO authenticated USING ((select public.is_admin()));

-- stops
DROP POLICY stops_select_all  ON public.stops;
DROP POLICY stops_write_admin ON public.stops;
CREATE POLICY stops_select_all  ON public.stops FOR SELECT TO authenticated USING (true);
CREATE POLICY stops_insert_admin ON public.stops FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY stops_update_admin ON public.stops FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY stops_delete_admin ON public.stops FOR DELETE TO authenticated USING ((select public.is_admin()));

-- trip_stops
DROP POLICY trip_stops_select_all  ON public.trip_stops;
DROP POLICY trip_stops_write_admin ON public.trip_stops;
CREATE POLICY trip_stops_select_all  ON public.trip_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY trip_stops_insert_admin ON public.trip_stops FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY trip_stops_update_admin ON public.trip_stops FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY trip_stops_delete_admin ON public.trip_stops FOR DELETE TO authenticated USING ((select public.is_admin()));

-- trips: lectura abierta, INSERT/DELETE admin, UPDATE conductor-propio o admin
DROP POLICY trips_select_all   ON public.trips;
DROP POLICY trips_update_driver ON public.trips;
DROP POLICY trips_write_admin  ON public.trips;
CREATE POLICY trips_select_all  ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY trips_insert_admin ON public.trips FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY trips_update_driver_or_admin ON public.trips FOR UPDATE TO authenticated
  USING ((driver_id = (select auth.uid())) OR (select public.is_admin()))
  WITH CHECK ((driver_id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY trips_delete_admin ON public.trips FOR DELETE TO authenticated USING ((select public.is_admin()));

-- ---------- locations: lectura abierta, inserción propia/ admin ----------
DROP POLICY locations_select_all  ON public.locations;
DROP POLICY locations_insert_self ON public.locations;
DROP POLICY locations_admin_all   ON public.locations;
CREATE POLICY locations_select_all ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY locations_insert_self_or_admin ON public.locations FOR INSERT TO authenticated
  WITH CHECK ((user_id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY locations_update_admin ON public.locations FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY locations_delete_admin ON public.locations FOR DELETE TO authenticated USING ((select public.is_admin()));

-- ---------- notifications ----------
DROP POLICY notif_select_own_or_admin ON public.notifications;
DROP POLICY notif_update_own          ON public.notifications;
DROP POLICY notif_admin_all           ON public.notifications;
CREATE POLICY notif_select_own_or_admin ON public.notifications FOR SELECT TO authenticated
  USING ((user_id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY notif_insert_admin ON public.notifications FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY notif_update_own_or_admin ON public.notifications FOR UPDATE TO authenticated
  USING ((user_id = (select auth.uid())) OR (select public.is_admin()))
  WITH CHECK ((user_id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY notif_delete_admin ON public.notifications FOR DELETE TO authenticated USING ((select public.is_admin()));

-- ---------- user_roles ----------
DROP POLICY user_roles_select_self_or_admin ON public.user_roles;
DROP POLICY user_roles_admin_write          ON public.user_roles;
CREATE POLICY user_roles_select_self_or_admin ON public.user_roles FOR SELECT TO authenticated
  USING ((user_id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY user_roles_insert_admin ON public.user_roles FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));
CREATE POLICY user_roles_update_admin ON public.user_roles FOR UPDATE TO authenticated USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY user_roles_delete_admin ON public.user_roles FOR DELETE TO authenticated USING ((select public.is_admin()));

-- ---------- Resto: solo envoltura en (select ...) ----------
-- users
DROP POLICY users_select_self_or_admin ON public.users;
DROP POLICY users_update_self_or_admin ON public.users;
CREATE POLICY users_select_self_or_admin ON public.users FOR SELECT TO authenticated
  USING ((id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY users_update_self_or_admin ON public.users FOR UPDATE TO authenticated
  USING ((id = (select auth.uid())) OR (select public.is_admin()))
  WITH CHECK ((id = (select auth.uid())) OR (select public.is_admin()));

-- passengers
DROP POLICY passengers_select_self_or_admin ON public.passengers;
DROP POLICY passengers_update_self_or_admin ON public.passengers;
CREATE POLICY passengers_select_self_or_admin ON public.passengers FOR SELECT TO authenticated
  USING ((user_id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY passengers_update_self_or_admin ON public.passengers FOR UPDATE TO authenticated
  USING ((user_id = (select auth.uid())) OR (select public.is_admin()))
  WITH CHECK ((user_id = (select auth.uid())) OR (select public.is_admin()));

-- reports
DROP POLICY reports_select_all          ON public.reports;
DROP POLICY reports_insert_self         ON public.reports;
DROP POLICY reports_update_owner_or_admin ON public.reports;
DROP POLICY reports_delete_owner_or_admin ON public.reports;
CREATE POLICY reports_select_all ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY reports_insert_self ON public.reports FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY reports_update_owner_or_admin ON public.reports FOR UPDATE TO authenticated
  USING ((user_id = (select auth.uid())) OR (select public.is_admin()))
  WITH CHECK ((user_id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY reports_delete_owner_or_admin ON public.reports FOR DELETE TO authenticated
  USING ((user_id = (select auth.uid())) OR (select public.is_admin()));

-- report_validations
DROP POLICY rv_select_all          ON public.report_validations;
DROP POLICY rv_insert_self         ON public.report_validations;
DROP POLICY rv_delete_owner_or_admin ON public.report_validations;
CREATE POLICY rv_select_all ON public.report_validations FOR SELECT TO authenticated USING (true);
CREATE POLICY rv_insert_self ON public.report_validations FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY rv_delete_owner_or_admin ON public.report_validations FOR DELETE TO authenticated
  USING ((user_id = (select auth.uid())) OR (select public.is_admin()));

-- tickets
DROP POLICY tickets_insert_self        ON public.tickets;
DROP POLICY tickets_select_own_or_admin ON public.tickets;
DROP POLICY tickets_update_own_or_admin ON public.tickets;
CREATE POLICY tickets_insert_self ON public.tickets FOR INSERT TO authenticated WITH CHECK (passenger_id = (select auth.uid()));
CREATE POLICY tickets_select_own_or_admin ON public.tickets FOR SELECT TO authenticated
  USING ((passenger_id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY tickets_update_own_or_admin ON public.tickets FOR UPDATE TO authenticated
  USING ((passenger_id = (select auth.uid())) OR (select public.is_admin()))
  WITH CHECK ((passenger_id = (select auth.uid())) OR (select public.is_admin()));

-- trip_subscriptions
DROP POLICY trip_subscriptions_select_own_or_admin ON public.trip_subscriptions;
DROP POLICY trip_subscriptions_insert_self         ON public.trip_subscriptions;
DROP POLICY trip_subscriptions_update_own_or_admin ON public.trip_subscriptions;
DROP POLICY trip_subscriptions_delete_own_or_admin ON public.trip_subscriptions;
CREATE POLICY trip_subscriptions_select_own_or_admin ON public.trip_subscriptions FOR SELECT TO authenticated
  USING ((passenger_id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY trip_subscriptions_insert_self ON public.trip_subscriptions FOR INSERT TO authenticated
  WITH CHECK (passenger_id = (select auth.uid()));
CREATE POLICY trip_subscriptions_update_own_or_admin ON public.trip_subscriptions FOR UPDATE TO authenticated
  USING ((passenger_id = (select auth.uid())) OR (select public.is_admin()))
  WITH CHECK ((passenger_id = (select auth.uid())) OR (select public.is_admin()));
CREATE POLICY trip_subscriptions_delete_own_or_admin ON public.trip_subscriptions FOR DELETE TO authenticated
  USING ((passenger_id = (select auth.uid())) OR (select public.is_admin()));

-- audit_logs
DROP POLICY audit_logs_select_admin ON public.audit_logs;
CREATE POLICY audit_logs_select_admin ON public.audit_logs FOR SELECT TO authenticated
  USING ((select public.is_admin()));;
