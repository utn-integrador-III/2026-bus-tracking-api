-- Funciones de trigger: nadie debe poder llamarlas por RPC.
-- (el disparador las ejecuta con los privilegios del dueño, no requiere EXECUTE)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_passenger_senior_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_user_role()             FROM PUBLIC, anon, authenticated;

-- is_admin(): la usan las políticas RLS de usuarios autenticados; el anónimo no la necesita.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;

-- admin_set_senior_status: solo usuarios autenticados (y valida is_admin internamente).
REVOKE EXECUTE ON FUNCTION public.admin_set_senior_status(uuid, boolean) FROM PUBLIC, anon;;
