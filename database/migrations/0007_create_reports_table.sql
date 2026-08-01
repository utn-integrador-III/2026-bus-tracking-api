create type public.report_type as enum ('Traffic', 'Accident', 'Overcrowding', 'Mechanical', 'Hazard', 'Other');
create type public.report_moderation_status as enum ('pending', 'validated', 'dismissed');

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.report_type not null,
  description text,
  latitude numeric not null,
  longitude numeric not null,
  timestamp timestamptz not null default now(),
  geog extensions.geography,
  moderation_status public.report_moderation_status not null default 'pending'::public.report_moderation_status,
  moderated_by uuid references auth.users(id),
  moderated_at timestamptz
);

alter table public.reports enable row level security;

create policy "Authenticated users can insert reports"
  on public.reports for insert
  with check (auth.role() = 'authenticated');

create policy "Anyone can read reports"
  on public.reports for select
  using (true);
