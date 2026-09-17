-- =============================================================================
-- 20260917000001 — a quote remembers what it is called
-- =============================================================================
-- The quote builder asks for a title ("Badsanierung komplett — Hoffmann") and
-- shows it everywhere: the list, the detail header, the PDF, the customer's
-- acceptance page. It was never stored. `documents` has no title column, so
-- `addQuote` dropped it and `mappers.ts` had nothing to read back — every quote
-- reopened as "Untitled" after a restart, and the contractor could not tell two
-- quotes for the same customer apart (#339 D6).
--
-- Additive and nullable: existing rows keep working and the FE falls back to
-- the job description exactly as it does today.
alter table public.documents
  add column if not exists title text;

comment on column public.documents.title is
  'What the contractor calls this quote/invoice. Free text, shown in the list, on the PDF and on the customer acceptance page. NULL = fall back to the job description.';
