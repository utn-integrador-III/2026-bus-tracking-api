-- Migration: add 'archived' to the report_moderation_status enum (US-09 admin incident moderation)
-- The admin web console moderates reports as Pending / Validated / Archived / Dismissed.
-- The deployed enum only had pending / validated / dismissed, so add archived (idempotent).

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'report_moderation_status'
      and e.enumlabel = 'archived'
  ) then
    alter type public.report_moderation_status add value 'archived';
  end if;
end $$;
