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
    timeout_milliseconds := 5000
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
