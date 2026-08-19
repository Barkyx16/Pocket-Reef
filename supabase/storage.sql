-- Pocket Reef — journal photo storage.
--
-- Run once in the SQL editor, after schema.sql.
--
-- Journal photos were device-local: the snapshot synced only the local file
-- URI, so signing in on a new phone gave you journal entries with broken
-- images. This bucket holds the actual files.
--
-- The bucket is PRIVATE. Photos are of people's homes; a public bucket means
-- anyone with the URL can view them forever, and tank photos routinely include
-- rooms, furniture, and family. The app reads them through short-lived signed
-- URLs instead.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reef-photos',
  'reef-photos',
  false,
  10485760, -- 10 MB per photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  -- Not "do nothing": a bucket created by hand before this script was run keeps
  -- whatever it was created with, and the default in the dashboard is PUBLIC.
  -- The comment above promised private; only this makes it true. These are
  -- also the settings a later Supabase change could quietly reset.
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Every object lives under <user-id>/..., and each policy checks that the first
-- path segment is the caller's own id. That's what keeps one account's photos
-- out of another's reach.

drop policy if exists "reef_photos_read_own" on storage.objects;
create policy "reef_photos_read_own"
  on storage.objects for select
  using (bucket_id = 'reef-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reef_photos_insert_own" on storage.objects;
create policy "reef_photos_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'reef-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reef_photos_update_own" on storage.objects;
create policy "reef_photos_update_own"
  on storage.objects for update
  using (bucket_id = 'reef-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reef_photos_delete_own" on storage.objects;
create policy "reef_photos_delete_own"
  on storage.objects for delete
  using (bucket_id = 'reef-photos' and (storage.foldername(name))[1] = auth.uid()::text);
