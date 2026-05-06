
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_host_id_fkey;
ALTER TABLE public.events ALTER COLUMN host_id DROP NOT NULL;
