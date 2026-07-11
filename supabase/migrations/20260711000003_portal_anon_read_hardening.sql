-- ============================================================
-- FULL FIX for the two portal anon-capability leaks:
--   R14  customer_questions broad anon SELECT (token == access_code)
--   R15  customer-uploads   broad anon SELECT (path prefix == access_code)
-- Both are replaced with server-mediated, capability-scoped access. This
-- migration pairs with:
--   • edge fn  supabase/functions/sign-customer-upload  (server-side signed URLs)
--   • portal   admin/src/app/customer/[code]/page.tsx    (RPC poll + edge-fn signing)
-- *** NEEDS a customer-portal smoke-test (ask a question → see the reply; upload
--     a photo → it attaches) before production deploy. ***
-- ============================================================

-- ------------------------------------------------------------
-- 1. customer_questions — RPC-scoped anon read, drop broad anon SELECT
-- ------------------------------------------------------------
-- The portal polled customer_questions directly with the anon key under the
-- policy `using (tracker_access_token is not null)`. tracker_access_token IS
-- the portal access_code, so any anon-key holder could harvest all tokens and
-- open every portal (R14). Replace the direct read with a SECURITY DEFINER RPC
-- the anon calls with its OWN access_token: it returns only the matching
-- question's status fields, and the token is checked inside the function (never
-- returned). Then DROP the broad anon SELECT policy — which ALSO closes the
-- realtime vector, because Realtime applies the table's RLS: with no anon SELECT
-- policy, an anon subscription to customer_questions yields nothing.
create or replace function public.get_customer_question_status(
  p_access_token text,
  p_question_id uuid
)
returns table (
  status text,
  approved_reply text,
  auto_sent boolean,
  ai_reply_draft text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select q.status, q.approved_reply, q.auto_sent, q.ai_reply_draft
  from public.customer_questions q
  where q.id = p_question_id
    and q.tracker_access_token is not null
    and q.tracker_access_token = p_access_token
$$;

revoke all on function public.get_customer_question_status(text, uuid) from public;
grant execute on function public.get_customer_question_status(text, uuid) to anon, authenticated, service_role;

-- Drop the broad anon SELECT (closes both the REST leak and the realtime leak).
-- The contractor keeps their scoped select/update policies (contractor_user_id =
-- auth.uid()); anon now reads only via the RPC above. The column-revoke shipped
-- in 20260711000002 becomes moot but is harmless to leave in place.
drop policy if exists "anon reads by tracker token" on public.customer_questions;

-- ------------------------------------------------------------
-- 2. customer-uploads — drop broad anon SELECT (signing moves server-side)
-- ------------------------------------------------------------
-- The bucket's anon SELECT policy `using (bucket_id = 'customer-uploads')` let
-- anon read/enumerate every object; the object path prefix is the access_code,
-- so enumeration cascaded to portal takeover + leaked every customer's photos
-- (R15). Signed-URL generation moves to the sign-customer-upload edge fn
-- (service role, restricted to paths under the caller's own access_code prefix),
-- so anon no longer needs SELECT. Anon keeps INSERT (upload with upsert:false
-- does not require SELECT). Displaying an image uses the pre-authenticated signed
-- URL, which bypasses RLS — so no anon SELECT is needed anywhere.
drop policy if exists "customer-uploads anon select" on storage.objects;
