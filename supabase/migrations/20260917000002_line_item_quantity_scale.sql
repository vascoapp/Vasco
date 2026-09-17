-- =============================================================================
-- 20260917000002 — a quantity of 0,125 is not 0,13
-- =============================================================================
-- `line_items.quantity` is numeric(12,2), so the database ROUNDS every third
-- decimal: 0,125 kg of solder, 1,375 m of pipe or 2,625 h of labour were stored
-- as 0,13 / 1,38 / 2,63. The UI fix of 2026-09-15 let the contractor TYPE three
-- decimals (#337) and the commit message claimed the value was kept — it was
-- not, past the write. Widening the SCALE keeps every existing value (2,50
-- stays 2,500) and cannot fail on existing data.
--
-- unit_price stays at 2: a price is money and money has cents. It is the
-- QUANTITY that is measured.
alter table public.line_items
  alter column quantity type numeric(12,3);

comment on column public.line_items.quantity is
  'Measured amount, three decimals (hours, metres, kilograms). Was numeric(12,2), which rounded 0,125 to 0,13 on write.';
