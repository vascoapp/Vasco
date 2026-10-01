-- =============================================================================
-- 20261001000011 — customers: the three DIR3 centres FACe routes on (Spain B2G)
-- =============================================================================
-- An invoice to a Spanish public body (NIF beginning P, Q or S) goes through
-- FACe, which rejects it unless the Facturae names three DIR3 administrative
-- centres of the buyer (Orden HAP/1650/2015, Anexo II, rule 8):
--   role 01  Oficina contable    (accounting office)
--   role 02  Órgano gestor       (managing body)
--   role 03  Unidad tramitadora  (processing unit)
-- The public body hands these to its suppliers (on the order / contract); a
-- code is 9 characters, first letter = administration (E, A, L, U, I …),
-- e.g. L01280796.
--
-- Three text columns rather than a JSON blob: one value per role, each with a
-- format the app checks on entry, and the same allow-list write mapper
-- (customerUpdatesToRowPayload) as every other customer field.
--
-- Nullable and additive. RLS: `customers` policies are row-level (user_id),
-- so new columns inherit them; the data export selects `*` and the account
-- deletion cascades the row — nothing else to do.
--
-- 🔴 Apply BEFORE any OTA that ships the client writing these columns:
-- PostgREST rejects the WHOLE customer update when one column is unknown
-- (PGRST204), so every Spanish customer edit would fail until this lands.
-- =============================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS dir3_oficina_contable   text,
  ADD COLUMN IF NOT EXISTS dir3_organo_gestor      text,
  ADD COLUMN IF NOT EXISTS dir3_unidad_tramitadora text;

-- The shape only (9 alphanumerics, first a letter; empty = cleared by the form,
-- which sends "" for a blanked field — the constraint must never reject a write
-- the app makes, or the offline queue retries it forever). Whether a code exists in
-- DIR3 is FACe's lookup. NOT VALID + VALIDATE: no existing row has a value.
ALTER TABLE public.customers
  ADD CONSTRAINT customers_dir3_oficina_contable_format
    CHECK (dir3_oficina_contable IS NULL OR dir3_oficina_contable = '' OR dir3_oficina_contable ~ '^[A-Z][A-Z0-9]{8}$') NOT VALID,
  ADD CONSTRAINT customers_dir3_organo_gestor_format
    CHECK (dir3_organo_gestor IS NULL OR dir3_organo_gestor = '' OR dir3_organo_gestor ~ '^[A-Z][A-Z0-9]{8}$') NOT VALID,
  ADD CONSTRAINT customers_dir3_unidad_tramitadora_format
    CHECK (dir3_unidad_tramitadora IS NULL OR dir3_unidad_tramitadora = '' OR dir3_unidad_tramitadora ~ '^[A-Z][A-Z0-9]{8}$') NOT VALID;
ALTER TABLE public.customers VALIDATE CONSTRAINT customers_dir3_oficina_contable_format;
ALTER TABLE public.customers VALIDATE CONSTRAINT customers_dir3_organo_gestor_format;
ALTER TABLE public.customers VALIDATE CONSTRAINT customers_dir3_unidad_tramitadora_format;

COMMENT ON COLUMN public.customers.dir3_oficina_contable IS
  'Spain B2G (FACe): DIR3 code of the Oficina contable, Facturae AdministrativeCentre RoleTypeCode 01. 9 chars, e.g. L01280796.';
COMMENT ON COLUMN public.customers.dir3_organo_gestor IS
  'Spain B2G (FACe): DIR3 code of the Órgano gestor, Facturae AdministrativeCentre RoleTypeCode 02.';
COMMENT ON COLUMN public.customers.dir3_unidad_tramitadora IS
  'Spain B2G (FACe): DIR3 code of the Unidad tramitadora, Facturae AdministrativeCentre RoleTypeCode 03.';
