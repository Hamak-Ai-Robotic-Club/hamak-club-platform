-- Public bucket for component pictures uploaded from the admin console.
-- Run once in Supabase → SQL Editor (or create the bucket from Storage UI:
-- name "component-images", Public bucket ON, 4 MB limit, image/webp).
-- Uploads are performed by the API with the service-role key (server only),
-- so no insert/update policies are required; public read comes from the
-- bucket being public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('component-images', 'component-images', true, 4194304, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
