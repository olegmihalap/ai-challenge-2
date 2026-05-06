-- Status enum + column
do $$ begin
  create type public.feedback_status as enum ('pending','visible','hidden');
exception when duplicate_object then null; end $$;

alter table public.feedback
  add column if not exists status public.feedback_status not null default 'visible';

-- Unique: one feedback per (event,user)
create unique index if not exists feedback_event_user_unique on public.feedback(event_id, user_id);

-- Validation trigger: only attendees, only after event ended, rating 1-5
create or replace function public.tg_validate_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _ev public.events;
  _has_rsvp boolean;
begin
  if new.rating is null or new.rating < 1 or new.rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;
  select * into _ev from public.events where id = new.event_id;
  if _ev.id is null then raise exception 'Event not found'; end if;
  if coalesce(_ev.ends_at, _ev.starts_at) > now() then
    raise exception 'Feedback is only available after the event ends';
  end if;
  select exists(
    select 1 from public.rsvps r
    where r.event_id = new.event_id and r.user_id = new.user_id and r.status = 'going'
  ) into _has_rsvp;
  if not _has_rsvp then
    raise exception 'Only attendees can leave feedback';
  end if;
  return new;
end $$;

drop trigger if exists trg_validate_feedback on public.feedback;
create trigger trg_validate_feedback
before insert on public.feedback
for each row execute function public.tg_validate_feedback();

-- RLS: replace SELECT policy to expose visible feedback publicly + own + host/admin
drop policy if exists "Feedback viewable by event host and admin" on public.feedback;
drop policy if exists "Visible feedback is public" on public.feedback;
create policy "Visible feedback is public"
on public.feedback for select
using (
  status = 'visible'
  or auth.uid() = user_id
  or exists (select 1 from public.events e where e.id = feedback.event_id and e.host_id = auth.uid())
  or public.has_role(auth.uid(), 'admin'::app_role)
);

-- Hosts/admins can moderate (update status)
drop policy if exists "Hosts moderate feedback" on public.feedback;
create policy "Hosts moderate feedback"
on public.feedback for update
using (
  exists (select 1 from public.events e where e.id = feedback.event_id and e.host_id = auth.uid())
  or public.has_role(auth.uid(), 'admin'::app_role)
);