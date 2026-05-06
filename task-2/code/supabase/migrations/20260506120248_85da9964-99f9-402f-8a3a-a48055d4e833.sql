-- Check-in RPCs with proper authorization and atomic duplicate prevention

create or replace function public.checkin_scan(_event_id uuid, _code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _u uuid := auth.uid();
  _rsvp public.rsvps;
  _existing public.check_ins;
  _ci public.check_ins;
  _name text;
begin
  if _u is null then raise exception 'Not authenticated'; end if;
  if not (
    public.has_role(_u, 'checker'::app_role)
    or public.has_role(_u, 'admin'::app_role)
    or exists(select 1 from public.events e where e.id = _event_id and e.host_id = _u)
  ) then
    raise exception 'Forbidden';
  end if;

  select * into _rsvp from public.rsvps where qr_code = _code limit 1;
  if _rsvp.id is null then
    return jsonb_build_object('status','invalid');
  end if;
  if _rsvp.event_id <> _event_id then
    return jsonb_build_object('status','wrong_event');
  end if;
  if _rsvp.status = 'cancelled' then
    return jsonb_build_object('status','cancelled');
  end if;
  if _rsvp.status = 'waitlist' then
    return jsonb_build_object('status','waitlist');
  end if;

  select * into _existing from public.check_ins where rsvp_id = _rsvp.id order by checked_in_at desc limit 1;
  select display_name into _name from public.profiles where id = _rsvp.user_id;

  if _existing.id is not null then
    return jsonb_build_object(
      'status','duplicate',
      'rsvp_id', _rsvp.id,
      'name', _name,
      'checked_in_at', _existing.checked_in_at,
      'check_in_id', _existing.id
    );
  end if;

  insert into public.check_ins(rsvp_id, event_id, checked_in_by)
    values (_rsvp.id, _event_id, _u) returning * into _ci;

  return jsonb_build_object(
    'status','ok',
    'rsvp_id', _rsvp.id,
    'name', _name,
    'checked_in_at', _ci.checked_in_at,
    'check_in_id', _ci.id
  );
end $$;

create or replace function public.checkin_undo(_check_in_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _u uuid := auth.uid();
  _ci public.check_ins;
begin
  if _u is null then raise exception 'Not authenticated'; end if;
  select * into _ci from public.check_ins where id = _check_in_id;
  if _ci.id is null then return; end if;
  if not (
    public.has_role(_u, 'checker'::app_role)
    or public.has_role(_u, 'admin'::app_role)
    or exists(select 1 from public.events e where e.id = _ci.event_id and e.host_id = _u)
  ) then
    raise exception 'Forbidden';
  end if;
  delete from public.check_ins where id = _check_in_id;
end $$;

-- Allow hosts/checkers/admins to delete check_ins (used by undo paths and for safety)
drop policy if exists "Hosts/checkers delete check_ins" on public.check_ins;
create policy "Hosts/checkers delete check_ins"
on public.check_ins for delete
using (
  public.has_role(auth.uid(), 'checker'::app_role)
  or public.has_role(auth.uid(), 'admin'::app_role)
  or exists(select 1 from public.events e where e.id = check_ins.event_id and e.host_id = auth.uid())
);