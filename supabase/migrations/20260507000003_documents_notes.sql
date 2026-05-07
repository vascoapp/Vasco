-- =============================================================================
-- DOCUMENTS NOTES — R66 round 13 (2026-05-07)
-- =============================================================================
-- The invoice detail screen (app/invoices/[id].tsx) has a full "Internal notes"
-- UI: TextInput, edit/save pencil, persisted via `updateInvoice(id, { notes })`.
-- But there was never a `notes` column on `documents`. The notes flowed through:
--   FE editor → setNotes(local React state) → updateInvoice → dbUpdates mapper
-- The mapper had no `notes` branch, so dbUpdates was empty, no BE call fired,
-- Object.keys(dbUpdates).length > 0 was false. Notes lived only in component
-- React state and were lost the moment the contractor navigated away or cold-
-- started the app.
--
-- This adds a single nullable `notes text` column on documents — minimal,
-- matches the FE shape, no extra table needed for solo-contractor scale.
-- =============================================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.documents.notes IS
  'Internal contractor notes on a quote/invoice. Free text, not customer-visible. Wired via R66/R13 mapper update.';
