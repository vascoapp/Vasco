-- =============================================================================
-- 20260819000010 — customers: the address a structured invoice needs
-- =============================================================================
-- `customers` has name, email, phone and a single free-text `address`. Every
-- structured e-invoice format in this product needs more than that, and the
-- gap is not theoretical:
--
--   · XRechnung BR-DE-8/9 require the buyer's CITY and POST CODE as separate
--     elements. app/invoices/[id].tsx passes `(invoice as any).customerCity`
--     and `.customerPostcode` — fields that exist nowhere. They are undefined
--     on every invoice, so the elements are omitted and **every real German
--     invoice violates BR-DE-8/9**. The generator was fixed on 2026-08-19; it
--     can only emit what it is given, and it is given nothing.
--   · Facturae needs the buyer NIF, province and post code.
--   · FatturaPA needs P.IVA or Codice Fiscale, CAP, comune, provincia, and a
--     Codice Destinatario or PEC — without which SDI rejects outright
--     (00311/00312), and in Italy a rejected invoice was never legally issued.
--
-- One free-text line cannot be split into these reliably: "Marktplatz 3, 10178
-- Berlin" and "Via Roma 1 — 20100 Milano (MI)" do not share a grammar, and
-- guessing produces a confidently wrong invoice rather than a missing field.
--
-- Deliberately GENERIC rather than one column per country. `vat_id` carries a
-- USt-IdNr, a NIF or a P.IVA; `tax_id` carries the second identifier some
-- markets need alongside it (Codice Fiscale in Italy, where a private customer
-- has a CF and no P.IVA). `einvoice_routing` carries whatever addresses the
-- buyer's receiving channel — an Italian Codice Destinatario or PEC today, a
-- Peppol participant ID later. Six near-empty country columns would rot.
--
-- All nullable and additive: existing customers keep working, and the invoice
-- readiness gate is what refuses an export that needs a field the contractor
-- has not filled in.
-- =============================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS city             text,
  ADD COLUMN IF NOT EXISTS postcode         text,
  -- ISO 3166-1 alpha-2. Null means "same country as the contractor", which is
  -- the overwhelming case and avoids making every existing row wrong.
  ADD COLUMN IF NOT EXISTS country          text,
  -- Province / region code where the format demands one: IT provincia (MI, RM),
  -- ES provincia. Two letters in both.
  ADD COLUMN IF NOT EXISTS province         text,
  -- The buyer's primary tax identifier: USt-IdNr / NIF / P.IVA / BTW.
  ADD COLUMN IF NOT EXISTS vat_id           text,
  -- The second identifier some markets need alongside it — Codice Fiscale in
  -- Italy, where a consumer has a CF and no P.IVA at all.
  ADD COLUMN IF NOT EXISTS tax_id           text,
  -- How the buyer's system receives it. IT: 7-char Codice Destinatario, or
  -- '0000000' when routing by PEC. Later: a Peppol participant ID.
  ADD COLUMN IF NOT EXISTS einvoice_routing text,
  ADD COLUMN IF NOT EXISTS einvoice_email   text;

COMMENT ON COLUMN public.customers.country IS
  'ISO 3166-1 alpha-2. NULL means the contractor''s own country — the common case, and it keeps every pre-existing row correct.';
COMMENT ON COLUMN public.customers.einvoice_routing IS
  'Where the buyer''s system receives structured invoices. IT: Codice Destinatario (7 chars, or 0000000 when routing by PEC in einvoice_email). Without it SDI rejects with 00311/00312.';
