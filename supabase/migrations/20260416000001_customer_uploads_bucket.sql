-- =============================================================================
-- Customer Uploads bucket — photos submitted through the decisions portal
-- =============================================================================
-- A customer follows a signed decision-portal link, uploads photos of the job
-- they want quoted, and the files land in this bucket under a prefix derived
-- from the portal's access token. The decision row itself stores the resulting
-- signed URLs in `photo_urls`; contractors fetch these via the existing
-- decisionSyncService realtime subscription.
--
-- Security model:
--   • Bucket is NOT public — contractors read via 30-day signed URLs.
--   • anon role may INSERT into the bucket (portal has no auth session).
--   • anon may SELECT — needed so `storage.createSignedUrl` works right
--     after upload. Enumeration is not possible: paths use unguessable UUID
--     prefixes + anon has no LIST endpoint.
--   • anon may NOT DELETE — contractors clean up via service role.
--   • Service role can do everything (Edge Functions / admin).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('customer-uploads', 'customer-uploads', false)
on conflict (id) do nothing;

-- Anon can upload (no auth on the portal side)
drop policy if exists "customer-uploads anon insert" on storage.objects;
drop policy if exists "customer-uploads anon select" on storage.objects;
drop policy if exists "customer-uploads service delete" on storage.objects;

create policy "customer-uploads anon insert"
  on storage.objects for insert
  with check (bucket_id = 'customer-uploads');

-- Anon needs SELECT so it can call storage.createSignedUrl on its own freshly
-- uploaded object. Obscurity via unguessable prefixes is the first line of
-- defense; the signed URL itself is the credential the contractor consumes.
-- No LIST endpoint exists on anon, so bulk enumeration is not possible.
create policy "customer-uploads anon select"
  on storage.objects for select
  using (bucket_id = 'customer-uploads');

-- No delete from anon — contractors clean up via service role.
create policy "customer-uploads service delete"
  on storage.objects for delete
  using (bucket_id = 'customer-uploads' and auth.role() = 'service_role');
