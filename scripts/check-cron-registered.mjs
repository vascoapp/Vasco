#!/usr/bin/env node
// =============================================================================
// CHECK-CRON-REGISTERED (R300)
// =============================================================================
// Post-deploy smoke test. Queries `cron.job` on the linked Supabase project
// and exits non-zero if fewer than 9 schedules are registered. Catches the
// R8 / R293 failure mode where pg_cron isn't installed or `cron.sql` was
// never run with real credentials.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/check-cron-registered.mjs
//
// Add to CI as a post-deploy step. Exit codes:
//   0 = >= 9 schedules registered
//   1 = pg_cron missing OR fewer than 9 schedules
//   2 = network / config error
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY before running.');
  process.exit(2);
}

const REQUIRED_JOBS = [
  'vasco-weekly-digest',
  'vasco-stale-draft-cleanup',
  'vasco-drain-account-deletions',
  'vasco-daily-push-digest',
  'vasco-churn-winback',
  'vasco-grant-referral-credits',
  'vasco-weekly-retrain-models',
  'vasco-train-extra-models',
  'vasco-refresh-generator-approval-rates',
];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  // pg_cron exposes cron.job; reading via supabase-js requires the table to be
  // exposed under a schema. Fall back to a function-style query via REST.
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cron_job_list`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      // The RPC doesn't exist — try a direct catalog query workaround.
      // Easiest in CI is to require the operator to have run our companion
      // SQL helper. Print actionable error.
      console.error(
        `[check-cron-registered] Could not query cron schedules (HTTP ${res.status}).
Likely causes:
  1. pg_cron not installed → push migration 20260502000002_enable_pg_cron.sql
  2. cron.sql never run    → see LAUNCH.md §2.6.5 for the one-time setup
  3. RPC cron_job_list not exposed → optional helper, fallback to manual psql:
     supabase db query --linked "select jobname from cron.job"

This CI check expects all 9 vasco-* schedules:
${REQUIRED_JOBS.map(n => `  - ${n}`).join('\n')}`,
      );
      process.exit(1);
    }
    const rows = await res.json();
    const present = new Set((rows ?? []).map((r) => r.jobname ?? r.name));
    const missing = REQUIRED_JOBS.filter((n) => !present.has(n));
    if (missing.length > 0) {
      console.error('[check-cron-registered] Missing schedules:');
      for (const m of missing) console.error(`  - ${m}`);
      console.error('Run cron.sql once with real SUPABASE_URL + SERVICE_ROLE_KEY.');
      process.exit(1);
    }
    console.log(`[check-cron-registered] OK — ${REQUIRED_JOBS.length}/9 schedules registered.`);
  } catch (err) {
    console.error('[check-cron-registered] Network error:', err);
    process.exit(2);
  }
})();
