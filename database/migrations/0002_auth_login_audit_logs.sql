create table if not exists public.auth_login_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  email text not null,
  role text null,
  auth_strategy text not null,
  oauth_provider text null,
  was_successful boolean not null,
  failure_code text null,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists auth_login_audit_logs_email_idx
  on public.auth_login_audit_logs (email, created_at desc);

create index if not exists auth_login_audit_logs_user_id_idx
  on public.auth_login_audit_logs (user_id, created_at desc);

create or replace function public.prevent_auth_login_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'auth_login_audit_logs is immutable';
end;
$$;

drop trigger if exists auth_login_audit_logs_no_update on public.auth_login_audit_logs;
create trigger auth_login_audit_logs_no_update
before update on public.auth_login_audit_logs
for each row execute function public.prevent_auth_login_audit_log_mutation();

drop trigger if exists auth_login_audit_logs_no_delete on public.auth_login_audit_logs;
create trigger auth_login_audit_logs_no_delete
before delete on public.auth_login_audit_logs
for each row execute function public.prevent_auth_login_audit_log_mutation();