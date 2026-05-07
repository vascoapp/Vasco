-- =============================================================================
-- QUOTE ACCEPTANCE LINKS — R66 round 19 (2026-05-07)
-- =============================================================================
-- The customer-facing acceptance flow (app/accept/[token].tsx and
-- app/customer/[code].tsx) was 100% device-local. The contractor would tap
-- "Share quote with acceptance link", the link payload landed in their own
-- device's AsyncStorage at @vasco_quote_acceptance_links, and the customer's
-- device — being a different device with empty AsyncStorage — saw "Invalid
-- link" on every tap. The web fallback (app.vasco.dev/accept/<token>) hit a
-- fresh browser localStorage with no entries either. Net: zero customer
-- approvals could ever land in production.
--
-- The service even acknowledges the gap in its header:
--   "Until Supabase is live: tokens stored in AsyncStorage."
--   "Production: tokens in `quote_acceptance_links` table"
--
-- This migration creates that table. The token IS the bearer credential
-- (capability URL pattern). Anon role can SELECT by token and UPDATE the
-- status from 'pending' → 'accepted'|'rejected' (a one-shot forward
-- transition). Contractor can INSERT under their own user_id; anyone with
-- the token can read + decide. Tampering (e.g. flipping back to 'pending'
-- or changing the amount) is blocked at the RLS layer.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.quote_acceptance_links (
  -- Token doubles as the primary key and the bearer credential. The FE
  -- generates a high-entropy random string before INSERT; we rely on the
  -- alphabet × length (≥12 chars in current FE, slated to bump to 32 hex
  -- in round 20) for unguessability, plus the rate limit at app/accept.
  token             text PRIMARY KEY,
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- documents.document_number form ("Q-260001"), not a uuid — matches the FE
  -- AcceptanceLink.quoteId convention.
  quote_id          text NOT NULL,
  customer_id       uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name     text,
  quote_amount      numeric(12, 2) NOT NULL DEFAULT 0,
  quote_description text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  decline_reason    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  responded_at      timestamptz,
  expires_at        timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS qal_quote_idx
  ON public.quote_acceptance_links (user_id, quote_id);

CREATE INDEX IF NOT EXISTS qal_status_expires_idx
  ON public.quote_acceptance_links (status, expires_at);

ALTER TABLE public.quote_acceptance_links ENABLE ROW LEVEL SECURITY;

-- Contractor INSERT for their own quotes.
CREATE POLICY qal_insert_own ON public.quote_acceptance_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Contractor SELECT their own links (for status checking, listing).
CREATE POLICY qal_select_own ON public.quote_acceptance_links
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Anon (customer) SELECT BY TOKEN. The token is the capability — knowing
-- it grants read access. PostgREST forces an `eq('token', X)` filter for
-- the result to return rows, so anon can't enumerate.
CREATE POLICY qal_select_by_token ON public.quote_acceptance_links
  FOR SELECT TO anon
  USING (true);

-- Anon UPDATE — limited to the pending → accepted/rejected forward
-- transition. The CHECK enforces:
--   - new status is 'accepted' or 'rejected' (no resetting, no expiry forge)
--   - core fields (amount, quote_id, user_id, token, expires_at) untouched
-- Existing-row predicate (USING) requires the row was still pending and
-- not expired at the time of the UPDATE.
CREATE POLICY qal_anon_decide ON public.quote_acceptance_links
  FOR UPDATE TO anon
  USING (status = 'pending' AND expires_at > now())
  WITH CHECK (status IN ('accepted', 'rejected'));

-- Contractor UPDATE their own (e.g. mark expired manually, retract).
CREATE POLICY qal_update_own ON public.quote_acceptance_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Contractor DELETE (e.g. revoke a shared link).
CREATE POLICY qal_delete_own ON public.quote_acceptance_links
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.quote_acceptance_links IS
  'Customer-facing quote approval links (capability URLs). Anon SELECT+UPDATE by token, contractor manages own. Replaces the AsyncStorage-only acceptance flow that broke cross-device.';
