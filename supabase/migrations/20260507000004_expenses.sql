-- =============================================================================
-- EXPENSES — R66 round 14 (2026-05-07)
-- =============================================================================
-- NL launch compliance: Belastingdienst Art. 52 AWR requires 7-year retention
-- of business expense records. DE GoBD §147 HGB: 10 years. The expenseService
-- was AsyncStorage-only (R44) — every receipt scan + manual expense lived on
-- the device. Reinstall, OS migration, or device replacement → all expenses
-- gone. VAT reclaim, deduction history, and audit defense all collapse with
-- a single device wipe.
--
-- This migration creates a real BE table that mirrors the FE Expense type:
--   { id, description, category, amount, vat_amount, vat_rate, date,
--     supplier, receipt_url, job_id, job_title, deductible,
--     deduction_percentage, notes }
-- AsyncStorage stays as an offline cache; BE is source of truth.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description   text NOT NULL,
  category      text NOT NULL,
  amount        numeric(12, 2) NOT NULL,
  vat_amount    numeric(12, 2) NOT NULL DEFAULT 0,
  vat_rate      numeric(5, 2) NOT NULL DEFAULT 0,
  expense_date  timestamptz NOT NULL DEFAULT now(),
  supplier      text,
  receipt_url   text,
  job_id        uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_title     text,
  deductible    boolean NOT NULL DEFAULT true,
  deduction_percentage numeric(5, 2) NOT NULL DEFAULT 100,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_user_date_idx
  ON public.expenses (user_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS expenses_user_category_idx
  ON public.expenses (user_id, category);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY expenses_select_own ON public.expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY expenses_insert_own ON public.expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY expenses_update_own ON public.expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY expenses_delete_own ON public.expenses
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.expenses IS
  'Tax-deductible business expense records. 7-year retention (NL AWR Art. 52) / 10-year (DE GoBD §147 HGB). FE source of truth at src/services/expenseService.ts.';
