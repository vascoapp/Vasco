-- =============================================================================
-- 20261003000001 — line_items.vat_nature: WHY a 0 % line carries no VAT (Italy)
-- =============================================================================
-- FatturaPA requires a Natura on every 0 % line (SDI 00400 / 00429). The app
-- wrote N2.2 ("non soggette – altri casi") on all of them: right for a
-- forfettario, wrong for the commonest 0 % line of an ordinary-regime
-- tradesperson — a building subcontract, which is reverse charge (N6.3,
-- DPR 633/72 art. 17 c. 6 lett. a). SDI accepts the N2.2; the invoice states
-- the wrong legal basis. The nature is a fact about the LINE, chosen by the
-- contractor (src/domain/vatNature.ts).
--
-- Nullable and additive: NULL = no nature stated (every line before this, and
-- every non-zero line). RLS on line_items is row-level (user_id) — the new
-- column inherits it; the data export selects `*`; deletion cascades the row.
--
-- CHECK: only codes FatturaPA accepts today (Schema VFPR12 1.2.3 NaturaType,
-- without the generic N2 / N3 / N6 that SDI refuses since 2021, 00445). The
-- app only ever sends one of these or NULL (`isVatNature` in every writer),
-- so the constraint cannot reject an app write. NOT VALID + VALIDATE: no
-- existing row has a value.
--
-- 🔴 Apply BEFORE any OTA that ships the client writing this column:
-- PostgREST rejects the WHOLE line insert when one column is unknown
-- (PGRST204) — every quote and invoice save would lose its lines.
-- =============================================================================

ALTER TABLE public.line_items
  ADD COLUMN IF NOT EXISTS vat_nature text;

ALTER TABLE public.line_items
  ADD CONSTRAINT line_items_vat_nature_code
    CHECK (vat_nature IS NULL OR vat_nature IN (
      'N1', 'N2.1', 'N2.2',
      'N3.1', 'N3.2', 'N3.3', 'N3.4', 'N3.5', 'N3.6',
      'N4', 'N5',
      'N6.1', 'N6.2', 'N6.3', 'N6.4', 'N6.5', 'N6.6', 'N6.7', 'N6.8', 'N6.9',
      'N7'
    )) NOT VALID;
ALTER TABLE public.line_items VALIDATE CONSTRAINT line_items_vat_nature_code;

COMMENT ON COLUMN public.line_items.vat_nature IS
  'Italy: FatturaPA Natura of a 0 % line (N1 … N7, e.g. N6.3 reverse charge subappalto edile). NULL = none stated. See src/domain/vatNature.ts.';
