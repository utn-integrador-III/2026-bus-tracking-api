create extension if not exists pgmq cascade;

do $$
begin
  create type public.push_target_type as enum ('fid', 'registration_token');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.push_platform as enum ('android', 'ios', 'web');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.trip_operational_event_type as enum (
    'terminal_departure',
    'delay',
    'detour',
    'cancellation',
    'route_restored'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.trip_operational_event_source as enum ('database', 'driver', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_event_processing_status as enum (
    'queued',
    'processing',
    'completed',
    'completed_with_failures',
    'dead'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_delivery_status as enum (
    'pending',
    'processing',
    'retry',
    'sent',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.trip_detour_status as enum ('active', 'resolved');
exception
  when duplicate_object then null;
end $$;

alter table public.trips
  add column if not exists status_reason text,
  add column if not exists status_metadata jsonb not null default '{}'::jsonb,
  add column if not exists status_changed_by uuid references public.users(id) on delete set null,
  add column if not exists status_changed_at timestamptz;

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  installation_id uuid not null unique,
  target_type public.push_target_type not null,
  target_value text not null check (char_length(target_value) between 20 and 4096),
  platform public.push_platform not null,
  app_version text check (app_version is null or char_length(app_version) between 1 and 50),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  failure_count integer not null default 0 check (failure_count >= 0),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_value)
);

create index if not exists push_devices_user_active_idx
  on public.push_devices (user_id, is_active);

create index if not exists push_devices_last_seen_idx
  on public.push_devices (last_seen_at)
  where is_active = true;

create table if not exists public.trip_operational_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  event_type public.trip_operational_event_type not null,
  source public.trip_operational_event_source not null default 'database',
  actor_user_id uuid references public.users(id) on delete set null,
  previous_status public.trip_status,
  current_status public.trip_status,
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  dedup_key text not null unique,
  processing_status public.notification_event_processing_status not null default 'queued',
  subscriber_count integer not null default 0,
  delivery_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  last_error text,
  occurred_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists trip_operational_events_trip_occurred_idx
  on public.trip_operational_events (trip_id, occurred_at desc);

create index if not exists trip_operational_events_processing_idx
  on public.trip_operational_events (processing_status, occurred_at);

create table if not exists public.trip_detours (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  reported_by uuid references public.users(id) on delete set null,
  resolved_by uuid references public.users(id) on delete set null,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  details jsonb not null default '{}'::jsonb,
  status public.trip_detour_status not null default 'active',
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_detours
  add column if not exists resolved_by uuid references public.users(id) on delete set null;

create unique index if not exists trip_detours_one_active_per_trip_idx
  on public.trip_detours (trip_id)
  where status = 'active';

alter table public.notifications
  add column if not exists event_id uuid references public.trip_operational_events(id) on delete cascade,
  add column if not exists notification_type public.trip_operational_event_type,
  add column if not exists title text,
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists sent_at timestamptz,
  add column if not exists last_error_code text;

create unique index if not exists notifications_event_user_idx
  on public.notifications (event_id, user_id)
  where event_id is not null;

create index if not exists notifications_user_timestamp_idx
  on public.notifications (user_id, timestamp desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  push_device_id uuid not null references public.push_devices(id) on delete cascade,
  status public.notification_delivery_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  worker_id uuid,
  provider_message_id text,
  provider_error_code text,
  provider_error_message text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, push_device_id)
);

create index if not exists notification_deliveries_claim_idx
  on public.notification_deliveries (status, next_attempt_at, locked_until);

create unique index if not exists trip_subscriptions_passenger_trip_idx
  on public.trip_subscriptions (passenger_id, trip_id);

do $$
begin
  perform pgmq.create('core_event_notifications');
exception
  when duplicate_table then null;
  when unique_violation then null;
end $$;

create or replace function public.enqueue_trip_operational_event(
  p_trip_id uuid,
  p_event_type public.trip_operational_event_type,
  p_source public.trip_operational_event_source,
  p_actor_user_id uuid,
  p_previous_status public.trip_status,
  p_current_status public.trip_status,
  p_title text,
  p_message text,
  p_data jsonb,
  p_dedup_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  v_event_id uuid;
begin
  insert into public.trip_operational_events (
    trip_id,
    event_type,
    source,
    actor_user_id,
    previous_status,
    current_status,
    title,
    message,
    data,
    dedup_key
  )
  values (
    p_trip_id,
    p_event_type,
    p_source,
    p_actor_user_id,
    p_previous_status,
    p_current_status,
    p_title,
    p_message,
    coalesce(p_data, '{}'::jsonb),
    p_dedup_key
  )
  on conflict (dedup_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    perform pgmq.send(
      'core_event_notifications',
      jsonb_build_object('kind', 'event', 'event_id', v_event_id)
    );
  end if;

  return v_event_id;
end;
$$;

create or replace function public.prepare_trip_status_change()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status or old.route_id is distinct from new.route_id then
    new.status_changed_at := clock_timestamp();
    if new.status_reason is not distinct from old.status_reason then
      new.status_reason := null;
    end if;
    if new.status_metadata is not distinct from old.status_metadata then
      new.status_metadata := '{}'::jsonb;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trips_prepare_status_change on public.trips;
create trigger trips_prepare_status_change
before update of status, route_id on public.trips
for each row execute function public.prepare_trip_status_change();

create or replace function public.capture_trip_core_events()
returns trigger
language plpgsql
as $$
declare
  v_reason text;
  v_source public.trip_operational_event_source;
  v_data jsonb;
begin
  v_reason := nullif(trim(coalesce(new.status_reason, '')), '');
  select case
    when exists (
      select 1
      from public.user_roles
      where user_id = new.status_changed_by and role = 'Admin'
    ) then 'admin'::public.trip_operational_event_source
    when new.status_changed_by is not null then 'driver'::public.trip_operational_event_source
    else 'database'::public.trip_operational_event_source
  end into v_source;
  v_data := coalesce(new.status_metadata, '{}'::jsonb) || jsonb_build_object(
    'route_id', new.route_id,
    'bus_id', new.bus_id,
    'departure_time', new.departure_time,
    'reason', v_reason
  );

  if old.status is distinct from new.status then
    if new.status = 'In_Progress' and old.status in ('Scheduled', 'Pending') then
      perform public.enqueue_trip_operational_event(
        new.id,
        'terminal_departure',
        v_source,
        new.status_changed_by,
        old.status,
        new.status,
        'Salida de terminal',
        coalesce(v_reason, 'El autobús inició el viaje y salió de la terminal.'),
        v_data,
        format('trip:%s:departure:%s', new.id, new.status_changed_at)
      );
    elsif new.status = 'Delayed' then
      perform public.enqueue_trip_operational_event(
        new.id,
        'delay',
        v_source,
        new.status_changed_by,
        old.status,
        new.status,
        'Retraso en el viaje',
        coalesce(v_reason, 'El viaje presenta un retraso inesperado.'),
        v_data,
        format('trip:%s:delay:%s', new.id, new.status_changed_at)
      );
    elsif new.status = 'Cancelled' then
      perform public.enqueue_trip_operational_event(
        new.id,
        'cancellation',
        v_source,
        new.status_changed_by,
        old.status,
        new.status,
        'Viaje cancelado',
        coalesce(v_reason, 'El viaje fue cancelado.'),
        v_data,
        format('trip:%s:cancellation:%s', new.id, new.status_changed_at)
      );
    end if;
  end if;

  if old.route_id is distinct from new.route_id
    and old.status in ('In_Progress', 'Delayed', 'Stopped') then
    perform public.enqueue_trip_operational_event(
      new.id,
      'detour',
      v_source,
      new.status_changed_by,
      old.status,
      new.status,
      'Cambio de ruta',
      coalesce(v_reason, 'La ruta del viaje cambió inesperadamente.'),
      v_data || jsonb_build_object('previous_route_id', old.route_id),
      format('trip:%s:route:%s:%s', new.id, new.route_id, new.status_changed_at)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trips_capture_core_events on public.trips;
create trigger trips_capture_core_events
after update of status, route_id on public.trips
for each row execute function public.capture_trip_core_events();

create or replace function public.capture_trip_detour_events()
returns trigger
language plpgsql
as $$
declare
  v_trip public.trips%rowtype;
begin
  select * into v_trip from public.trips where id = new.trip_id;

  if tg_op = 'INSERT' and new.status = 'active' then
    perform public.enqueue_trip_operational_event(
      new.trip_id,
      'detour',
      'driver',
      new.reported_by,
      v_trip.status,
      v_trip.status,
      'Desvío temporal',
      new.reason,
      (new.details - 'geometry_geojson') || jsonb_build_object('detour_id', new.id),
      format('trip:%s:detour:%s', new.trip_id, new.id)
    );
  elsif tg_op = 'UPDATE' and old.status = 'active' and new.status = 'resolved' then
    perform public.enqueue_trip_operational_event(
      new.trip_id,
      'route_restored',
      'driver',
      new.resolved_by,
      v_trip.status,
      v_trip.status,
      'Ruta restablecida',
      'El viaje retomó su ruta regular.',
      (new.details - 'geometry_geojson') || jsonb_build_object('detour_id', new.id),
      format('trip:%s:detour-resolved:%s', new.trip_id, new.id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trip_detours_capture_events on public.trip_detours;
create trigger trip_detours_capture_events
after insert or update of status on public.trip_detours
for each row execute function public.capture_trip_detour_events();

create or replace function public.expire_notification_event(
  p_event_id uuid,
  p_max_age_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired boolean;
begin
  select exists (
    select 1
    from public.trip_operational_events
    where id = p_event_id
      and occurred_at < now() - make_interval(secs => greatest(60, p_max_age_seconds))
      and processing_status in ('queued', 'processing')
  ) into v_expired;

  if not v_expired then
    return false;
  end if;

  update public.notification_deliveries
  set status = 'failed',
      provider_error_code = 'EVENT_EXPIRED',
      provider_error_message = 'Operational notification expired before delivery.',
      locked_until = null,
      worker_id = null,
      updated_at = now()
  where notification_id in (
    select id from public.notifications where event_id = p_event_id
  )
    and status in ('pending', 'processing', 'retry');

  update public.notifications
  set status = 'Failed',
      last_error_code = 'EVENT_EXPIRED'
  where event_id = p_event_id
    and status = 'Pending';

  update public.trip_operational_events
  set processing_status = 'dead',
      last_error = 'EVENT_EXPIRED',
      completed_at = now()
  where id = p_event_id;

  return true;
end;
$$;

create or replace function public.prepare_notification_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscriber_count integer;
  v_delivery_count integer;
begin
  insert into public.notifications (
    user_id,
    trip_id,
    message,
    status,
    event_id,
    notification_type,
    title,
    data
  )
  select
    subscription.passenger_id,
    event.trip_id,
    event.message,
    'Pending',
    event.id,
    event.event_type,
    event.title,
    event.data || jsonb_build_object(
      'event_id', event.id,
      'trip_id', event.trip_id,
      'event_type', event.event_type,
      'occurred_at', event.occurred_at
    )
  from public.trip_operational_events event
  join public.trip_subscriptions subscription
    on subscription.trip_id = event.trip_id
   and subscription.status = 'active'
  join public.passengers passenger
    on passenger.user_id = subscription.passenger_id
  where event.id = p_event_id
    and coalesce(passenger.notification_preferences ->> 'push_enabled', 'true') = 'true'
    and coalesce(
      passenger.notification_preferences ->> event.event_type::text,
      'true'
    ) = 'true'
  on conflict do nothing;

  insert into public.notification_deliveries (notification_id, push_device_id)
  select notification.id, device.id
  from public.notifications notification
  join public.push_devices device
    on device.user_id = notification.user_id
   and device.is_active = true
  where notification.event_id = p_event_id
  on conflict do nothing;

  select count(*) into v_subscriber_count
  from public.notifications
  where event_id = p_event_id;

  select count(*) into v_delivery_count
  from public.notification_deliveries delivery
  join public.notifications notification on notification.id = delivery.notification_id
  where notification.event_id = p_event_id;

  update public.trip_operational_events
  set processing_status = 'processing',
      subscriber_count = v_subscriber_count,
      delivery_count = v_delivery_count
  where id = p_event_id
    and processing_status in ('queued', 'processing');

  return jsonb_build_object(
    'subscriber_count', v_subscriber_count,
    'delivery_count', v_delivery_count
  );
end;
$$;

create or replace function public.claim_notification_deliveries(
  p_event_id uuid,
  p_batch_size integer,
  p_worker_id uuid,
  p_lease_seconds integer default 90
)
returns table (
  delivery_id uuid,
  notification_id uuid,
  push_device_id uuid,
  target_type public.push_target_type,
  target_value text,
  platform public.push_platform,
  title text,
  message text,
  data jsonb,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select delivery.id
    from public.notification_deliveries delivery
    join public.notifications notification on notification.id = delivery.notification_id
    where notification.event_id = p_event_id
      and (
        (delivery.status in ('pending', 'retry') and delivery.next_attempt_at <= now())
        or (delivery.status = 'processing' and delivery.locked_until <= now())
      )
    order by delivery.created_at
    for update of delivery skip locked
    limit greatest(1, least(p_batch_size, 500))
  ), claimed as (
    update public.notification_deliveries delivery
    set status = 'processing',
        attempt_count = delivery.attempt_count + 1,
        worker_id = p_worker_id,
        locked_until = now() + make_interval(secs => greatest(30, p_lease_seconds)),
        last_attempt_at = now(),
        updated_at = now()
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select
    claimed.id,
    notification.id,
    device.id,
    device.target_type,
    device.target_value,
    device.platform,
    notification.title,
    notification.message,
    notification.data,
    claimed.attempt_count
  from claimed
  join public.notifications notification on notification.id = claimed.notification_id
  join public.push_devices device on device.id = claimed.push_device_id;
end;
$$;

create or replace function public.complete_notification_delivery(
  p_delivery_id uuid,
  p_provider_message_id text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notification_deliveries
  set status = 'sent',
      provider_message_id = p_provider_message_id,
      provider_error_code = null,
      provider_error_message = null,
      locked_until = null,
      worker_id = null,
      sent_at = now(),
      updated_at = now()
  where id = p_delivery_id;
$$;

create or replace function public.fail_notification_delivery(
  p_delivery_id uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean,
  p_retry_after_seconds integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notification_deliveries
  set status = case
        when p_retryable and attempt_count < 6 then 'retry'::public.notification_delivery_status
        else 'failed'::public.notification_delivery_status
      end,
      provider_error_code = p_error_code,
      provider_error_message = left(p_error_message, 1000),
      next_attempt_at = case
        when p_retryable and attempt_count < 6
          then now() + make_interval(secs => greatest(10, p_retry_after_seconds))
        else next_attempt_at
      end,
      locked_until = null,
      worker_id = null,
      updated_at = now()
  where id = p_delivery_id;
$$;

create or replace function public.disable_push_device(
  p_push_device_id uuid,
  p_error_code text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_devices
  set is_active = false,
      disabled_at = now(),
      failure_count = failure_count + 1,
      updated_at = now()
  where id = p_push_device_id;
$$;

create or replace function public.record_notification_delivery_results(p_results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with result_rows as (
    select *
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as result(
      delivery_id uuid,
      push_device_id uuid,
      success boolean,
      provider_message_id text,
      error_code text,
      error_message text,
      retryable boolean,
      retry_after_seconds integer,
      disable_device boolean
    )
  )
  update public.notification_deliveries delivery
  set status = case
        when result.success then 'sent'::public.notification_delivery_status
        when result.retryable and delivery.attempt_count < 6
          then 'retry'::public.notification_delivery_status
        else 'failed'::public.notification_delivery_status
      end,
      provider_message_id = result.provider_message_id,
      provider_error_code = result.error_code,
      provider_error_message = left(result.error_message, 1000),
      next_attempt_at = case
        when not result.success and result.retryable and delivery.attempt_count < 6
          then now() + make_interval(secs => greatest(10, result.retry_after_seconds))
        else delivery.next_attempt_at
      end,
      locked_until = null,
      worker_id = null,
      sent_at = case when result.success then now() else delivery.sent_at end,
      updated_at = now()
  from result_rows result
  where delivery.id = result.delivery_id;

  with result_rows as (
    select *
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as result(
      delivery_id uuid,
      push_device_id uuid,
      success boolean,
      provider_message_id text,
      error_code text,
      error_message text,
      retryable boolean,
      retry_after_seconds integer,
      disable_device boolean
    )
  )
  update public.push_devices device
  set is_active = false,
      disabled_at = now(),
      failure_count = failure_count + 1,
      updated_at = now()
  from result_rows result
  where device.id = result.push_device_id
    and result.disable_device = true;
end;
$$;

create or replace function public.refresh_notification_event_status(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending integer;
  v_sent integer;
  v_failed integer;
begin
  update public.notifications notification
  set status = case
        when exists (
          select 1 from public.notification_deliveries delivery
          where delivery.notification_id = notification.id and delivery.status = 'sent'
        ) then 'Sent'::public.notification_status
        when exists (
          select 1 from public.notification_deliveries delivery
          where delivery.notification_id = notification.id
            and delivery.status in ('pending', 'processing', 'retry')
        ) then 'Pending'::public.notification_status
        else 'Failed'::public.notification_status
      end,
      sent_at = case
        when exists (
          select 1 from public.notification_deliveries delivery
          where delivery.notification_id = notification.id and delivery.status = 'sent'
        ) then coalesce(notification.sent_at, now())
        else notification.sent_at
      end
  where notification.event_id = p_event_id;

  select
    count(*) filter (where delivery.status in ('pending', 'processing', 'retry')),
    count(*) filter (where delivery.status = 'sent'),
    count(*) filter (where delivery.status = 'failed')
  into v_pending, v_sent, v_failed
  from public.notification_deliveries delivery
  join public.notifications notification on notification.id = delivery.notification_id
  where notification.event_id = p_event_id;

  update public.trip_operational_events
  set processing_status = case
        when v_pending > 0 then 'processing'::public.notification_event_processing_status
        when v_failed > 0 then 'completed_with_failures'::public.notification_event_processing_status
        else 'completed'::public.notification_event_processing_status
      end,
      sent_count = v_sent,
      failed_count = v_failed,
      completed_at = case when v_pending = 0 then now() else null end
  where id = p_event_id;

  return jsonb_build_object(
    'pending_count', v_pending,
    'sent_count', v_sent,
    'failed_count', v_failed,
    'is_complete', v_pending = 0
  );
end;
$$;

create or replace function public.read_core_notification_queue(
  p_batch_size integer default 5,
  p_visibility_timeout integer default 120
)
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language sql
security definer
set search_path = public, pgmq
as $$
  select queue_message.msg_id,
         queue_message.read_ct,
         queue_message.enqueued_at,
         queue_message.vt,
         queue_message.message
  from pgmq.read(
    'core_event_notifications',
    greatest(30, p_visibility_timeout),
    greatest(1, least(p_batch_size, 20))
  ) queue_message;
$$;

create or replace function public.archive_core_notification_message(p_msg_id bigint)
returns boolean
language sql
security definer
set search_path = public, pgmq
as $$
  select pgmq.archive('core_event_notifications', p_msg_id);
$$;

alter table public.push_devices enable row level security;
alter table public.notifications enable row level security;
alter table public.trip_operational_events enable row level security;
alter table public.trip_detours enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Passengers manage their own push devices" on public.push_devices;
create policy "Passengers manage their own push devices"
  on public.push_devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Passengers read their own notifications" on public.notifications;
create policy "Passengers read their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Passengers mark their own notifications read" on public.notifications;
create policy "Passengers mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status = 'Read');

revoke update on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (status) on public.notifications to authenticated;

revoke all on function public.enqueue_trip_operational_event(
  uuid,
  public.trip_operational_event_type,
  public.trip_operational_event_source,
  uuid,
  public.trip_status,
  public.trip_status,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;

revoke all on function public.expire_notification_event(uuid, integer) from public, anon, authenticated;
revoke all on function public.prepare_notification_event(uuid) from public, anon, authenticated;
revoke all on function public.claim_notification_deliveries(uuid, integer, uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_notification_delivery(uuid, text, text, boolean, integer) from public, anon, authenticated;
revoke all on function public.disable_push_device(uuid, text) from public, anon, authenticated;
revoke all on function public.record_notification_delivery_results(jsonb) from public, anon, authenticated;
revoke all on function public.refresh_notification_event_status(uuid) from public, anon, authenticated;
revoke all on function public.read_core_notification_queue(integer, integer) from public, anon, authenticated;
revoke all on function public.archive_core_notification_message(bigint) from public, anon, authenticated;

grant execute on function public.prepare_notification_event(uuid) to service_role;
grant execute on function public.expire_notification_event(uuid, integer) to service_role;
grant execute on function public.claim_notification_deliveries(uuid, integer, uuid, integer) to service_role;
grant execute on function public.complete_notification_delivery(uuid, text) to service_role;
grant execute on function public.fail_notification_delivery(uuid, text, text, boolean, integer) to service_role;
grant execute on function public.disable_push_device(uuid, text) to service_role;
grant execute on function public.record_notification_delivery_results(jsonb) to service_role;
grant execute on function public.refresh_notification_event_status(uuid) to service_role;
grant execute on function public.read_core_notification_queue(integer, integer) to service_role;
grant execute on function public.archive_core_notification_message(bigint) to service_role;
