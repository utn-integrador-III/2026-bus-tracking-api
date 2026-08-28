-- FR-08: moderar / validar / descartar alertas comunitarias desde el admin.
CREATE TYPE report_moderation_status AS ENUM ('pending', 'validated', 'dismissed');

ALTER TABLE public.reports
  ADD COLUMN moderation_status report_moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN moderated_by uuid,
  ADD COLUMN moderated_at timestamptz,
  ADD CONSTRAINT reports_moderated_by_fkey FOREIGN KEY (moderated_by)
    REFERENCES public.users (id) DEFERRABLE INITIALLY IMMEDIATE;

-- FR-28: tipologías de incidentes indexadas.
CREATE INDEX idx_reports_type ON public.reports (type);
-- FR-29: alertas de la última hora (combina con el índice GiST geog).
CREATE INDEX idx_reports_timestamp ON public.reports ("timestamp" DESC);
CREATE INDEX idx_reports_moderation_status ON public.reports (moderation_status);

-- Normalizar el voto comunitario (FR-08) de varchar libre a enum.
CREATE TYPE report_vote AS ENUM ('confirm', 'reject');
ALTER TABLE public.report_validations
  ALTER COLUMN vote_type TYPE report_vote USING vote_type::report_vote;;
