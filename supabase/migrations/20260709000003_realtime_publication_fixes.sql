-- =============================================================================
-- Add app-subscribed tables to the supabase_realtime publication
-- =============================================================================
-- BUG: invoicePaymentWatcher subscribes to postgres_changes on `documents`,
-- `signatures`, `jobs`, and `customers`, but none were ever added to the
-- supabase_realtime publication (only decision_submissions + customer_questions
-- were). A table not in the publication emits NO realtime events — the channel
-- subscribes "successfully" but the handler never fires. Net effect:
--   • payment-received push (webhook flips documents.status='paid') never fires
--   • "customer signed" push never fires
--   • cross-device sync of jobs/customers/documents never triggers refreshData()
--
-- Also: the payment watcher de-dupes on payload.old.status ('paid'), which needs
-- REPLICA IDENTITY FULL — default replica identity ships only the PK in .old, so
-- the guard would misfire and re-push on any subsequent update to a paid invoice.
--
-- Idempotent: guarded so it is safe if a table was already added out-of-band via
-- the Supabase Dashboard.
-- =============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documents', 'signatures', 'jobs', 'customers'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Needed for the payment watcher's paid-status de-dupe (reads payload.old.status).
ALTER TABLE public.documents REPLICA IDENTITY FULL;
