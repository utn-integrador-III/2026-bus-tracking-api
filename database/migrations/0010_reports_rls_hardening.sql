-- Migration: harden row level security on public.reports
-- Ordinal 0008 is reserved for the geofence proximity alerts migration incoming in PR #49 (see issue #77).

alter table public.reports enable row level security;

drop policy if exists "Authenticated users can insert reports" on public.reports;
drop policy if exists "Anyone can read reports" on public.reports;
drop policy if exists "Users insert their own reports" on public.reports;
drop policy if exists "Authenticated users read reports" on public.reports;

create policy "Users insert their own reports"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Authenticated users read reports"
  on public.reports for select
  to authenticated
  using (true);
