-- =============================================================================
-- The record that an erasure was carried out survives the erasure.
--
-- account_deletion_requests.user_id cascaded from auth.users, so the moment
-- drain-account-deletions deleted the auth user, the request row — the only
-- evidence the Art. 17 request was fulfilled (GDPR Art. 5(2) accountability)
-- — went with it, and the worker's "done" update matched nothing.
--
-- Decided 2026-09-24 (user): EXPORT, THEN DELETE. The contractor downloads
-- their records before deleting (their own retention duty — Vasco is not the
-- taxpayer, and for their customers' data only their processor); Vasco then
-- deletes EVERYTHING, issued invoices included, and keeps only this minimal
-- record: an id, the (now meaningless) account uuid, dates and status. The
-- worker clears the free-text `reason` on completion and deletes records older
-- than 3 years.
-- =============================================================================
alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_user_id_fkey;
