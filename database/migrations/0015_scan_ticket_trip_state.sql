-- Migration: make public.scan_ticket refuse tickets whose trip is Cancelled or Completed.
--
-- Addresses issue #84. The RPC created by 0004_create_scan_ticket_function.sql checks that the ticket
-- exists, that it belongs to the driver's active trip, and that it has not been scanned. It never
-- loads the trip, so the QR of a ticket stays scannable after the trip is cancelled.
--
-- Scope of the rule. Only 'Cancelled' and 'Completed' are refused. The trip_status enum has seven
-- values (Scheduled, Pending, In_Progress, Stopped, Delayed, Completed, Cancelled) and the other five
-- are all states a bus can legitimately be scanned in, including boarding before departure. Issue #84
-- leaves the wider checkout rule to the product owner; this migration only closes the part the issue
-- calls "clearly invalid".
--
-- This is the only migration in this set that rewrites an object that already exists, so it does not
-- use a bare "create or replace". The guard below refuses to touch a function whose live body is not
-- the one 0004 installed, so a definition that has drifted in the Supabase UI is reported instead of
-- being silently overwritten. It is also a no-op if the trip check is already present.
--
-- The new failure raises TICKET_TRIP_NOT_ACTIVE. See the cross-lane note in the PR: nothing maps that
-- message yet, so until repositories/ticketsRepository.js is updated it surfaces as a generic
-- TICKET_SCAN_FAILED 500 rather than a 409.

do $do$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'scan_ticket'
    and pg_get_function_identity_arguments(p.oid) = 'p_ticket_id uuid, p_driver_id uuid, p_active_trip_id uuid';

  if v_definition is null then
    raise exception 'SCAN_TICKET_NOT_FOUND'
      using detail = 'public.scan_ticket(uuid, uuid, uuid) does not exist. Apply 0004_create_scan_ticket_function.sql first.';
  end if;

  if v_definition like '%TICKET_TRIP_NOT_ACTIVE%' then
    raise notice 'public.scan_ticket already carries the trip state check. Nothing to do.';
    return;
  end if;

  if v_definition not like '%TICKET_ALREADY_SCANNED%'
     or v_definition not like '%TICKET_TRIP_MISMATCH%'
     or v_definition not like '%TICKET_NOT_FOUND%' then
    raise exception 'SCAN_TICKET_DEFINITION_DRIFT'
      using detail = 'The live public.scan_ticket body does not match the one installed by 0004. Refusing to overwrite it. Diff the live definition against 0004_create_scan_ticket_function.sql and reconcile by hand.';
  end if;

  execute $sql$
    create or replace function public.scan_ticket(
      p_ticket_id uuid,
      p_driver_id uuid,
      p_active_trip_id uuid
    )
    returns setof public.tickets
    language plpgsql
    as $fn$
    declare
      v_ticket public.tickets%rowtype;
      v_trip_status text;
    begin
      select * into v_ticket
      from public.tickets
      where id = p_ticket_id
      for update;

      if not found then
        raise exception 'TICKET_NOT_FOUND'
          using detail = format('Ticket %s does not exist.', p_ticket_id);
      end if;

      if v_ticket.trip_id is distinct from p_active_trip_id then
        raise exception 'TICKET_TRIP_MISMATCH'
          using detail = format('Ticket trip %s does not match active trip %s.', v_ticket.trip_id, p_active_trip_id);
      end if;

      select t.status::text into v_trip_status
      from public.trips t
      where t.id = v_ticket.trip_id;

      if v_trip_status is null then
        raise exception 'TICKET_TRIP_NOT_ACTIVE'
          using detail = format('Trip %s does not exist.', v_ticket.trip_id);
      end if;

      if v_trip_status in ('Cancelled', 'Completed') then
        raise exception 'TICKET_TRIP_NOT_ACTIVE'
          using detail = format('Trip status is %s; tickets cannot be scanned for a cancelled or completed trip.', v_trip_status);
      end if;

      if v_ticket.status is distinct from 'Generated' then
        raise exception 'TICKET_ALREADY_SCANNED'
          using detail = format('Ticket status is %s, expected Generated.', v_ticket.status);
      end if;

      update public.tickets
      set status = 'Scanned',
          scanned_at = now(),
          scanned_by = p_driver_id
      where id = p_ticket_id
      returning * into v_ticket;

      return next v_ticket;
    end;
    $fn$;
  $sql$;
end
$do$;
