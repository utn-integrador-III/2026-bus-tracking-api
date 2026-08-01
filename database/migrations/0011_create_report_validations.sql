-- Migration: backfill the live public.report_validations table, which has no migration file (issue #72).
--
-- Reconstructed from the shape described in issue #82, not from a database dump. Guarded, so it is a
-- no-op against the already-deployed database. It cannot live in 0000_baseline_unversioned_objects.sql
-- because it references public.reports, which 0007_create_reports_table.sql creates.
--
-- Ordinal 0008 is reserved for the geofence proximity alerts migration incoming in PR #49 (issue #77).
-- No API code reads or writes this table yet; see docs/passenger-incidents-moderation.md.

do $do$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'report_vote_type' and n.nspname = 'public'
  ) then
    create type public.report_vote_type as enum ('confirm', 'reject');
  end if;
end
$do$;

create table if not exists public.report_validations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote_type public.report_vote_type not null,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create index if not exists idx_report_validations_report_id
  on public.report_validations (report_id);
