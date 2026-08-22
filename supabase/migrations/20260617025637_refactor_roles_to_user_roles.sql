-- ============================================================
-- Refactor: drivers + administrators  ->  user_roles (multi-rol)
-- users pierde la columna role; el rol pasa a user_roles.
-- ============================================================

-- 1) Tabla intermedia de roles ------------------------------------------------
CREATE TABLE public.user_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  role          user_role NOT NULL,
  license_number varchar(80),
  employee_code  varchar(80),
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role),
  CONSTRAINT chk_user_roles_role_attrs CHECK (
       (role = 'Driver'    AND license_number IS NOT NULL AND employee_code  IS NULL)
    OR (role = 'Admin'     AND employee_code  IS NOT NULL AND license_number IS NULL)
    OR (role = 'Passenger' AND license_number IS NULL     AND employee_code  IS NULL)
  )
);

-- employee_code único solo cuando no es NULL
CREATE UNIQUE INDEX uq_user_roles_employee_code
  ON public.user_roles (employee_code) WHERE employee_code IS NOT NULL;
CREATE INDEX idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX idx_user_roles_role    ON public.user_roles (role);

-- 2) Backfill desde las tablas/columna que desaparecen ------------------------
INSERT INTO public.user_roles (user_id, role, license_number)
SELECT user_id, 'Driver'::user_role, license_number FROM public.drivers
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, employee_code)
SELECT user_id, 'Admin'::user_role, employee_code FROM public.administrators
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'Passenger'::user_role FROM public.passengers
ON CONFLICT (user_id, role) DO NOTHING;

-- Cubre cualquier users.role que no tuviera fila de subtipo
INSERT INTO public.user_roles (user_id, role, license_number, employee_code)
SELECT u.id, u.role,
       CASE WHEN u.role='Driver' THEN 'PENDIENTE' END,
       CASE WHEN u.role='Admin'  THEN 'PENDIENTE-'||left(u.id::text,8) END
FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=u.id AND ur.role=u.role)
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Repuntar trips.driver_id -> users(id) -----------------------------------
ALTER TABLE public.trips DROP CONSTRAINT trips_driver_id_fkey;
ALTER TABLE public.trips ADD CONSTRAINT trips_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.users (id) DEFERRABLE INITIALLY IMMEDIATE;

-- Trigger que garantiza que driver_id sí tenga el rol 'Driver'
CREATE OR REPLACE FUNCTION public.validate_trip_driver()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = NEW.driver_id AND ur.role = 'Driver'
  ) THEN
    RAISE EXCEPTION 'El usuario % no tiene el rol Driver en user_roles', NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_trip_driver
  BEFORE INSERT OR UPDATE OF driver_id ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.validate_trip_driver();

-- 4) is_admin() ahora consulta user_roles ------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'Admin'
  );
$$;

-- 5) handle_new_user(): sin users.role; alta de rol Passenger en user_roles --
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_birth_date date;
  v_age        int;
  v_senior     senior_verification_status := 'not_applicable';
BEGIN
  v_birth_date := NULLIF(NEW.raw_user_meta_data->>'birth_date','')::date;
  IF v_birth_date IS NOT NULL THEN
    v_age := date_part('year', age(v_birth_date))::int;
    IF v_age >= 65 THEN
      v_senior := 'pending';
    END IF;
  END IF;

  INSERT INTO public.users (id, name, email)
  VALUES (NEW.id,
          COALESCE(NULLIF(NEW.raw_user_meta_data->>'name',''), split_part(NEW.email,'@',1)),
          NEW.email);

  -- Todo auto-registro nace como Passenger
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'Passenger');

  INSERT INTO public.passengers (user_id, phone, birth_date, senior_status, is_senior, expo_push_token)
  VALUES (NEW.id,
          NEW.raw_user_meta_data->>'phone',
          v_birth_date, v_senior, false,
          NEW.raw_user_meta_data->>'expo_push_token');

  RETURN NEW;
END;
$$;

-- 6) Quitar el guard de users.role y la columna role -------------------------
DROP TRIGGER IF EXISTS trg_guard_user_role ON public.users;
DROP FUNCTION IF EXISTS public.guard_user_role();
ALTER TABLE public.users DROP COLUMN role;

-- 7) Eliminar tablas absorbidas ----------------------------------------------
DROP TABLE public.administrators;
DROP TABLE public.drivers;

-- 8) RLS y políticas de user_roles -------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Cada quien ve sus propios roles; el admin ve todos
CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Solo el admin asigna/edita/borra roles (el alta de Passenger la hace el
-- trigger handle_new_user, que es SECURITY DEFINER y omite RLS)
CREATE POLICY user_roles_admin_write ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 9) Hardening de funciones SECURITY DEFINER ---------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_trip_driver()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin()               FROM PUBLIC, anon;
;
