
create or replace function public.rsvp_register(_event_id uuid)
returns table (rsvp_id uuid, rsvp_status rsvp_status, queue_position int)
language plpgsql security definer set search_path=public as $$
declare
  _user uuid := auth.uid();
  _capacity int;
  _going_count int;
  _existing public.rsvps;
  _new_status rsvp_status;
  _rsvp public.rsvps;
  _pos int := 0;
begin
  if _user is null then raise exception 'Not authenticated'; end if;

  select e.capacity into _capacity from public.events e where e.id = _event_id for update;
  if _capacity is null then raise exception 'Event not found'; end if;

  select * into _existing from public.rsvps r where r.event_id = _event_id and r.user_id = _user;

  if _existing.id is not null and _existing.status <> 'cancelled' then
    if _existing.status = 'waitlist' then
      select count(*)::int into _pos from public.rsvps r
        where r.event_id = _event_id and r.status = 'waitlist' and r.created_at <= _existing.created_at;
    end if;
    rsvp_id := _existing.id; rsvp_status := _existing.status; queue_position := _pos; return next; return;
  end if;

  select count(*)::int into _going_count from public.rsvps r
    where r.event_id = _event_id and r.status = 'going';

  if _going_count >= _capacity then _new_status := 'waitlist'; else _new_status := 'going'; end if;

  if _existing.id is not null then
    update public.rsvps set status = _new_status, created_at = now()
      where id = _existing.id returning * into _rsvp;
  else
    insert into public.rsvps(event_id, user_id, status)
      values (_event_id, _user, _new_status) returning * into _rsvp;
  end if;

  if _new_status = 'waitlist' then
    select count(*)::int into _pos from public.rsvps r
      where r.event_id = _event_id and r.status = 'waitlist' and r.created_at <= _rsvp.created_at;
  end if;

  rsvp_id := _rsvp.id; rsvp_status := _rsvp.status; queue_position := _pos; return next;
end $$;

create or replace function public.rsvp_cancel(_rsvp_id uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  _user uuid := auth.uid();
  _rsvp public.rsvps;
  _capacity int;
  _going_count int;
  _next_id uuid;
  _event_id uuid;
begin
  if _user is null then raise exception 'Not authenticated'; end if;
  select * into _rsvp from public.rsvps where id = _rsvp_id;
  if _rsvp.id is null then raise exception 'RSVP not found'; end if;
  if _rsvp.user_id <> _user then raise exception 'Forbidden'; end if;

  _event_id := _rsvp.event_id;
  select e.capacity into _capacity from public.events e where e.id = _event_id for update;

  update public.rsvps set status = 'cancelled' where id = _rsvp_id;

  if _rsvp.status = 'going' then
    select count(*)::int into _going_count from public.rsvps r
      where r.event_id = _event_id and r.status = 'going';
    if _going_count < _capacity then
      select id into _next_id from public.rsvps
        where event_id = _event_id and status = 'waitlist'
        order by created_at asc limit 1 for update;
      if _next_id is not null then
        update public.rsvps set status = 'going' where id = _next_id;
        return _next_id;
      end if;
    end if;
  end if;
  return null;
end $$;

create or replace function public.waitlist_position(_event_id uuid, _user_id uuid)
returns int language sql stable security definer set search_path=public as $$
  select coalesce((
    select count(*)::int from public.rsvps r
    where r.event_id = _event_id and r.status = 'waitlist'
    and r.created_at <= (select created_at from public.rsvps where event_id = _event_id and user_id = _user_id and status='waitlist')
  ), 0)
$$;
