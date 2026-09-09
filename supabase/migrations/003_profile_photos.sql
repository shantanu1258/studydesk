-- StudyDesk: optional profile photos for signed-in administrators
-- Run this once after 002_library_preferences.sql.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-photos',
  'profile-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile photos are publicly readable" on storage.objects;
create policy "profile photos are publicly readable"
on storage.objects for select
using (bucket_id = 'profile-photos');

drop policy if exists "users upload their own profile photo" on storage.objects;
create policy "users upload their own profile photo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users update their own profile photo" on storage.objects;
create policy "users update their own profile photo"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users remove their own profile photo" on storage.objects;
create policy "users remove their own profile photo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
