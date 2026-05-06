-- Add 'hidden' to gallery_status enum
alter type public.gallery_status add value if not exists 'hidden';

-- Storage bucket for gallery photos
insert into storage.buckets (id, name, public)
values ('event-gallery', 'event-gallery', true)
on conflict (id) do nothing;

-- Public read
drop policy if exists "Gallery images are publicly readable" on storage.objects;
create policy "Gallery images are publicly readable"
on storage.objects for select
using (bucket_id = 'event-gallery');

-- Signed-in users upload to their own folder: {user_id}/...
drop policy if exists "Users upload own gallery files" on storage.objects;
create policy "Users upload own gallery files"
on storage.objects for insert
with check (
  bucket_id = 'event-gallery'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users update own gallery files" on storage.objects;
create policy "Users update own gallery files"
on storage.objects for update
using (
  bucket_id = 'event-gallery'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users delete own gallery files" on storage.objects;
create policy "Users delete own gallery files"
on storage.objects for delete
using (
  bucket_id = 'event-gallery'
  and auth.uid()::text = (storage.foldername(name))[1]
);