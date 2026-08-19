-- =============================================================================
-- 20260819000011 — business_settings: the seller's fiscal identity
-- =============================================================================
-- The customer side landed in 20260819000010. This is the other half, and
-- without it the Spanish and Italian mappers cannot be written at all:
--
--   · FatturaPA requires the seller's RegimeFiscale (RF01 ordinario, RF19
--     forfettario, …) in CedentePrestatore/DatiAnagrafici. There is no
--     defaultable value — RF01 for a forfettario contractor is a fiscally
--     WRONG invoice that SDI accepts, which is worse than a rejected one,
--     because nobody finds out.
--   · FatturaPA and Facturae both require the PROVINCIA (2 letters: MI, RM,
--     28) in the address. `state` exists but is the US state field; overloading
--     it would make a Texan and a Milanese share a column with different
--     meaning and different validation.
--   · Facturae requires PersonTypeCode — F (física) or J (jurídica) — on both
--     parties, and a sole trader vs a company is not derivable from anything
--     the app already stores.
--
-- ONE generic `fiscal_regime` rather than `regime_fiscale` + `regimen_fiscal`:
-- a contractor operates in one country, so the column is only ever read by
-- that country's mapper, and two columns would leave one permanently NULL.
--
-- All nullable. The invoice readiness gate refuses an export that needs a
-- field the contractor has not filled in — that is where the requirement is
-- enforced, not here, because a NOT NULL would lock out every existing row.
-- =============================================================================

ALTER TABLE public.business_settings
  -- IT provincia / ES provincia. Two letters in both.
  ADD COLUMN IF NOT EXISTS province      text,
  -- Country-interpreted. IT: RegimeFiscale RF01–RF19. ES: régimen fiscal.
  ADD COLUMN IF NOT EXISTS fiscal_regime text,
  -- 'F' natural person / 'J' legal person. Facturae needs it explicitly; it
  -- also decides Nome+Cognome vs Denominazione in FatturaPA.
  ADD COLUMN IF NOT EXISTS person_type   text;

ALTER TABLE public.business_settings
  DROP CONSTRAINT IF EXISTS business_settings_person_type_check;
ALTER TABLE public.business_settings
  ADD CONSTRAINT business_settings_person_type_check
  CHECK (person_type IS NULL OR person_type IN ('F', 'J'));

COMMENT ON COLUMN public.business_settings.fiscal_regime IS
  'Country-interpreted fiscal regime. IT: RegimeFiscale RF01-RF19 (mandatory in FatturaPA; RF01 defaulted for a forfettario is a fiscally wrong invoice SDI ACCEPTS). ES: regimen fiscal.';
COMMENT ON COLUMN public.business_settings.province IS
  'IT/ES provincia, 2 letters. Deliberately separate from `state`, which is the US state and has different values and validation.';
