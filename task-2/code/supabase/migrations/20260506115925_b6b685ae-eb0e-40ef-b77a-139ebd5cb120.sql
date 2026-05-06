
insert into storage.buckets (id, name, public)
values ('event-banners','event-banners', true)
on conflict (id) do nothing;

create policy "Banners are public"
on storage.objects for select
using (bucket_id = 'event-banners');

create policy "Authed users upload banners to own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'event-banners' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owners update own banners"
on storage.objects for update to authenticated
using (bucket_id = 'event-banners' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owners delete own banners"
on storage.objects for delete to authenticated
using (bucket_id = 'event-banners' and (auth.uid()::text = (storage.foldername(name))[1] or has_role(auth.uid(),'admin')));
