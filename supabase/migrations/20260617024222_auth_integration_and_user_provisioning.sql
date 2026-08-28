-- ============================================================
-- 1. Enlazar public.users con Supabase Auth (auth.users)
-- ============================================================
-- El id de nuestra tabla de perfil pasa a ser el mismo id de auth.users.
-- Quitamos el default aleatorio: el id siempre proviene de Auth.
ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_auth_fkey
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- ============================================================
-- 2. Soporte de verificación de adulto mayor en passengers
-- ============================================================
CREATE TYPE senior_verification_status AS ENUM (
  'not_applicable',  -- menor de 65: no aplica exención
  'pending',         -- 65+ registrado, cédula sin validar
  'approved',        -- admin validó la cédula -> exención activa
  'rejected'         -- admin rechazó la cédula
);

ALTER TABLE public.passengers
  ADD COLUMN "birth_date" date,
  ADD COLUMN "senior_status" senior_verification_status NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN "cedula_path" text;

-- ============================================================
-- 3. Recrear las FK hacia users/passengers con ON DELETE CASCADE
--    para que el borrado de la cuenta de Auth limpie el resto.
-- ============================================================
ALTER TABLE public.passengers DROP CONSTRAINT passengers_user_id_fkey;
ALTER TABLE public.passengers ADD CONSTRAINT passengers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.drivers DROP CONSTRAINT drivers_user_id_fkey;
ALTER TABLE public.drivers ADD CONSTRAINT drivers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.administrators DROP CONSTRAINT administrators_user_id_fkey;
ALTER TABLE public.administrators ADD CONSTRAINT administrators_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.locations DROP CONSTRAINT locations_user_id_fkey;
ALTER TABLE public.locations ADD CONSTRAINT locations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE public.reports DROP CONSTRAINT reports_user_id_fkey;
ALTER TABLE public.reports ADD CONSTRAINT reports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT notifications_user_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.report_validations DROP CONSTRAINT report_validations_user_id_fkey;
ALTER TABLE public.report_validations ADD CONSTRAINT report_validations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.tickets DROP CONSTRAINT tickets_passenger_id_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_passenger_id_fkey
  FOREIGN KEY (passenger_id) REFERENCES passengers(user_id) ON DELETE CASCADE;

-- ============================================================
-- 4. Helper: ¿el usuario actual es administrador?
--    SECURITY DEFINER para evitar recursión con las políticas RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.administrators a WHERE a.user_id = auth.uid()
  );
$$;

-- ============================================================
-- 5. Aprovisionamiento: al crear un usuario en Auth se crea su
--    perfil en public.users + subtipo passengers.
--    El rol de auto-registro SIEMPRE es 'Passenger' (los Driver/Admin
--    se aprovisionan por separado con privilegios).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name        text;
  v_phone       text;
  v_birth_date  date;
  v_age         int;
  v_senior      senior_verification_status := 'not_applicable';
BEGIN
  v_name  := COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  v_phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');

  -- birth_date llega como 'YYYY-MM-DD' en los metadatos de signUp
  BEGIN
    v_birth_date := (NEW.raw_user_meta_data->>'birth_date')::date;
  EXCEPTION WHEN others THEN
    v_birth_date := NULL;
  END;

  -- Perfil base
  INSERT INTO public.users (id, name, email, role)
  VALUES (NEW.id, v_name, NEW.email, 'Passenger');

  -- Adulto mayor (65+) -> queda pendiente de validar la cédula
  IF v_birth_date IS NOT NULL THEN
    v_age := date_part('year', age(v_birth_date))::int;
    IF v_age >= 65 THEN
      v_senior := 'pending';
    END IF;
  END IF;

  INSERT INTO public.passengers (user_id, phone, birth_date, senior_status, is_senior)
  VALUES (NEW.id, v_phone, v_birth_date, v_senior, false);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. Guardia: un pasajero NO puede auto-otorgarse la exención.
--    is_senior y senior_status solo cambian vía función de admin.
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_passenger_senior_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.is_senior     IS DISTINCT FROM OLD.is_senior
    OR NEW.senior_status IS DISTINCT FROM OLD.senior_status THEN
      RAISE EXCEPTION 'No autorizado para modificar el estado de adulto mayor';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_passenger_senior
  BEFORE UPDATE ON public.passengers
  FOR EACH ROW EXECUTE FUNCTION public.guard_passenger_senior_fields();

-- ============================================================
-- 7. Función de admin para validar la cédula y activar/rechazar
--    la exención de adulto mayor.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_senior_status(
  p_passenger uuid,
  p_approve   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede validar la exención';
  END IF;

  UPDATE public.passengers
  SET senior_status = CASE WHEN p_approve THEN 'approved'::senior_verification_status
                                          ELSE 'rejected'::senior_verification_status END,
      is_senior     = p_approve
  WHERE user_id = p_passenger;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pasajero % no encontrado', p_passenger;
  END IF;
END;
$$;;
