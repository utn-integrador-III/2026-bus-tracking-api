-- NFR-11: registrar acciones importantes (login, creación de viaje, salida,
-- llegada, cancelación, reportes de incidente).
CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,                 -- nulo para acciones del sistema
  action      varchar(100) NOT NULL,
  entity_type varchar(60),
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_user_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_audit_logs_user       ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_entity     ON public.audit_logs (entity_type, entity_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Solo lectura para administradores; la escritura la hace el backend
-- (service role) o triggers SECURITY DEFINER, que omiten RLS.
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());;
