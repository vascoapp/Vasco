-- =============================================================================
-- Extend business_settings with fields required by invoice PDF footer +
-- country-specific legal info (KvK/HRB/SIRET etc. already exist as
-- kvk_number; we add banking + country/postcode/city + numbering prefixes).
-- =============================================================================

alter table public.business_settings
  add column if not exists iban text,
  add column if not exists bic text,
  add column if not exists country text,
  add column if not exists postcode text,
  add column if not exists city text,
  add column if not exists website text,
  add column if not exists invoice_prefix text default 'INV',
  add column if not exists quote_prefix text default 'Q',
  add column if not exists default_payment_terms int default 14;

-- Country constraint — add only if column was freshly created
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'business_settings'
      and constraint_name = 'business_settings_country_check'
  ) then
    alter table public.business_settings
      add constraint business_settings_country_check
      check (country is null or country in ('NL','DE','FR','ES','IT','UK'));
  end if;
end $$;
