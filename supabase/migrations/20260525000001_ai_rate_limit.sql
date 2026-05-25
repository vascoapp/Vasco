-- =============================================================================
-- R192 — Per-user rate limit for ai-command edge function
-- =============================================================================
-- Caps Anthropic spend per contractor. Pre-R192 the ai-command edge fn was
-- JWT-gated but unlimited — a single contractor (or compromised JWT) could
-- burn unbounded Anthropic credits at ~$0.0005/call.
--
-- Window: rolling 60 seconds, hard cap of 30 requests. Picks reasonable
-- normal-use ceilings (5/sec sustained is still bot-like for office chat).
--
-- Cleanup is opportunistic — every successful write upserts the row, so
-- stale buckets stay around until next call. Optional cron-based GC can
-- prune old rows monthly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_rate_limit (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Index supports the per-user lookup that the edge fn does on every call.
CREATE INDEX IF NOT EXISTS ai_rate_limit_window_idx
  ON public.ai_rate_limit (user_id, window_start);

-- Service role bypasses RLS; that's intentional — only the edge fn
-- (running with service role) should write to this table.
ALTER TABLE public.ai_rate_limit ENABLE ROW LEVEL SECURITY;

-- Read own row (used for diagnostics if we later expose a "you've used
-- X/30 today" indicator in the UI).
CREATE POLICY IF NOT EXISTS ai_rate_limit_select_own
  ON public.ai_rate_limit
  FOR SELECT
  USING (auth.uid() = user_id);
