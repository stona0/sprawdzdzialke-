-- Bucket dla cache map uzbrojenia terenu (Playwright/Leaflet renders)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('utility-maps', 'utility-maps', true, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Publiczny dostęp do odczytu (CDN URL działa bez auth)
create policy "Public read utility-maps"
  on storage.objects for select
  using (bucket_id = 'utility-maps');

-- Service role może zapisywać (używane przez report-generator)
create policy "Service insert utility-maps"
  on storage.objects for insert
  with check (bucket_id = 'utility-maps');

-- Service role może nadpisywać (upsert przy regeneracji)
create policy "Service update utility-maps"
  on storage.objects for update
  using (bucket_id = 'utility-maps');
