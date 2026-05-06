
do $$ begin
  create type public.event_visibility as enum ('public','unlisted');
exception when duplicate_object then null; end $$;

alter table public.events
  add column if not exists visibility public.event_visibility not null default 'public',
  add column if not exists timezone text,
  add column if not exists organizer_contact text,
  add column if not exists is_free boolean not null default true;
