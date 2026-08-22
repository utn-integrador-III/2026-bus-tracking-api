-- Migration: version the public.buses table (live DB object with no migration file, issue #46)
-- Shape reconstructed from scripts/test-driver-flow.js inserts and trips FK references.

create table if not exists public.buses (
  id uuid primary key default gen_random_uuid(),
  plate_number varchar(50) not null,
  capacity integer not null default 40,
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists idx_buses_status
  on public.buses (status);
