-- Guardia: un usuario no puede cambiarse su propio rol.
CREATE OR REPLACE FUNCTION public.guard_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No autorizado para cambiar el rol';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_user_role
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_role();

-- ============================================================
-- Habilitar RLS en todas las tablas
-- ============================================================
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passengers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrators     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stops              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_validations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- users: cada quien ve/edita su perfil; el admin, todo.
-- (el INSERT lo hace el trigger handle_new_user con SECURITY DEFINER)
-- ============================================================
CREATE POLICY users_select_self_or_admin ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY users_update_self_or_admin ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- ============================================================
-- passengers: dueño o admin. (guardia ya protege is_senior/senior_status)
-- ============================================================
CREATE POLICY passengers_select_self_or_admin ON public.passengers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY passengers_update_self_or_admin ON public.passengers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- drivers / administrators: lectura propia o admin; escritura solo admin.
-- ============================================================
CREATE POLICY drivers_select_self_or_admin ON public.drivers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY drivers_write_admin ON public.drivers FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY admins_select_self_or_admin ON public.administrators FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY admins_write_admin ON public.administrators FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- buses / routes / stops: lectura para todo autenticado; escritura admin.
-- ============================================================
CREATE POLICY buses_select_all ON public.buses FOR SELECT TO authenticated USING (true);
CREATE POLICY buses_write_admin ON public.buses FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY routes_select_all ON public.routes FOR SELECT TO authenticated USING (true);
CREATE POLICY routes_write_admin ON public.routes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY stops_select_all ON public.stops FOR SELECT TO authenticated USING (true);
CREATE POLICY stops_write_admin ON public.stops FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- trips: lectura para todos; el conductor actualiza sus viajes; admin todo.
-- ============================================================
CREATE POLICY trips_select_all ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY trips_update_driver ON public.trips FOR UPDATE TO authenticated
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY trips_write_admin ON public.trips FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- locations: lectura para todos (tracking); inserta el propio usuario; admin todo.
-- ============================================================
CREATE POLICY locations_select_all ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY locations_insert_self ON public.locations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY locations_admin_all ON public.locations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- reports: lectura para todos; el autor inserta; autor o admin editan/borran.
-- ============================================================
CREATE POLICY reports_select_all ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY reports_insert_self ON public.reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY reports_update_owner_or_admin ON public.reports FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY reports_delete_owner_or_admin ON public.reports FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- report_validations: lectura para todos; el autor vota; autor/admin borran.
-- ============================================================
CREATE POLICY rv_select_all ON public.report_validations FOR SELECT TO authenticated USING (true);
CREATE POLICY rv_insert_self ON public.report_validations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY rv_delete_owner_or_admin ON public.report_validations FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- notifications: el usuario ve/actualiza las suyas; admin todo.
-- (la inserción real la hace el backend con service_role, que omite RLS)
-- ============================================================
CREATE POLICY notif_select_own_or_admin ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY notif_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_admin_all ON public.notifications FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- tickets: el pasajero ve/crea/edita los suyos; admin todo.
-- ============================================================
CREATE POLICY tickets_select_own_or_admin ON public.tickets FOR SELECT TO authenticated
  USING (passenger_id = auth.uid() OR public.is_admin());
CREATE POLICY tickets_insert_self ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (passenger_id = auth.uid());
CREATE POLICY tickets_update_own_or_admin ON public.tickets FOR UPDATE TO authenticated
  USING (passenger_id = auth.uid() OR public.is_admin())
  WITH CHECK (passenger_id = auth.uid() OR public.is_admin());;
