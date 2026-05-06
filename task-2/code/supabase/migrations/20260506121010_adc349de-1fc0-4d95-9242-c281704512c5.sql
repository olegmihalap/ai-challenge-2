alter table public.reports
  add column if not exists feedback_id uuid,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid;

-- Exactly one target
alter table public.reports drop constraint if exists reports_one_target;
alter table public.reports add constraint reports_one_target check (
  (case when event_id is not null then 1 else 0 end)
  + (case when gallery_item_id is not null then 1 else 0 end)
  + (case when feedback_id is not null then 1 else 0 end)
  = 1
);

-- Helper: can current user moderate this report?
create or replace function public.can_moderate_report(_r public.reports)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(auth.uid(), 'admin'::app_role)
    or (
      _r.event_id is not null and exists(
        select 1 from public.events e where e.id = _r.event_id and e.host_id = auth.uid()
      )
    )
    or (
      _r.gallery_item_id is not null and exists(
        select 1 from public.gallery_items g
        join public.events e on e.id = g.event_id
        where g.id = _r.gallery_item_id and e.host_id = auth.uid()
      )
    )
    or (
      _r.feedback_id is not null and exists(
        select 1 from public.feedback f
        join public.events e on e.id = f.event_id
        where f.id = _r.feedback_id and e.host_id = auth.uid()
      )
    )
$$;

-- Replace SELECT/UPDATE policies
drop policy if exists "Admins view all reports" on public.reports;
drop policy if exists "Admins manage reports" on public.reports;
drop policy if exists "Hosts and admins view reports" on public.reports;
drop policy if exists "Hosts and admins moderate reports" on public.reports;

create policy "Hosts and admins view reports"
on public.reports for select
using (public.can_moderate_report(reports));

create policy "Hosts and admins moderate reports"
on public.reports for update
using (public.can_moderate_report(reports));