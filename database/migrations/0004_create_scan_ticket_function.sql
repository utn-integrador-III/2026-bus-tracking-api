create or replace function public.scan_ticket(
  p_ticket_id uuid,
  p_driver_id uuid,
  p_active_trip_id uuid
)
returns setof public.tickets
language plpgsql
as $$
declare
  v_ticket public.tickets%rowtype;
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
$$;
