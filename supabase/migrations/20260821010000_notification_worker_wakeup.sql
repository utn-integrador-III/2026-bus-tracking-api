create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.request_notification_worker_wakeup(
  p_source text,
  p_event_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  worker_url text;
  worker_secret text;
  request_id bigint;
begin
  select decrypted_secret
  into worker_url
  from vault.decrypted_secrets
  where name = 'notification_worker_url'
  order by created_at desc
  limit 1;

  select decrypted_secret
  into worker_secret
  from vault.decrypted_secrets
  where name = 'notification_worker_secret'
  order by created_at desc
  limit 1;

  if worker_url is null or worker_secret is null then
    return null;
  end if;

  select net.http_post(
    url := worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', worker_secret
    ),
    body := jsonb_strip_nulls(jsonb_build_object(
      'source', p_source,
      'event_id', p_event_id
    )),
    timeout_milliseconds := 1000
  )
  into request_id;

  return request_id;
exception
  when others then
    raise warning 'notification worker wakeup failed: %', sqlerrm;
    return null;
end;
$$;

revoke all on function public.request_notification_worker_wakeup(text, uuid)
from public, anon, authenticated;

grant execute on function public.request_notification_worker_wakeup(text, uuid)
to service_role;

create or replace function public.wake_notification_worker_after_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.request_notification_worker_wakeup('database_webhook', new.id);
  return new;
end;
$$;

revoke all on function public.wake_notification_worker_after_event()
from public, anon, authenticated;

drop trigger if exists trip_operational_events_wake_worker
on public.trip_operational_events;

create trigger trip_operational_events_wake_worker
after insert on public.trip_operational_events
for each row
execute function public.wake_notification_worker_after_event();

do $schedule$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'drain-core-event-notifications'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'drain-core-event-notifications',
    '* * * * *',
    $command$
      select public.request_notification_worker_wakeup('cron', null::uuid);
    $command$
  );
end;
$schedule$;
