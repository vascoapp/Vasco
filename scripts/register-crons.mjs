#!/usr/bin/env node
// =============================================================================
// REGISTER-CRONS (R304)
// =============================================================================
// One-shot setup script — substitutes placeholders in supabase/cron.sql with
// real env values, then executes against the linked Supabase project. Closes
// the R8 launch-critical gap where pg_cron extension is installed but the
// schedules were never registered.
//
// The expected job names are DERIVED from cron.sql, never listed here. This
// file used to carry its own array of 9 while cron.sql defined 11, so a run
// would register all eleven and then verify nine — the same "the check is
// narrower than the truth" shape that let production sit at 1/11 unreported
// for months (#357). A fourth hand-written copy of a list is the defect.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/register-crons.mjs
//
// Idempotent — safe to re-run. cron.schedule() upserts by jobname.
//
// Exit codes:
//   0 = every schedule cron.sql defines is registered + verified
//   1 = pg_cron not installed (push migration 20260502000002 first)
//   2 = SQL execution failure
//   3 = env vars missing
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRON_SQL_PATH = join(__dirname, '..', 'supabase', 'cron.sql');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  console.error('Get the service-role key from Supabase Dashboard → Project Settings → API.');
  process.exit(3);
}

if (!SUPABASE_URL.startsWith('https://') || SUPABASE_URL.endsWith('/')) {
  console.error('SUPABASE_URL must be of the form https://xxxx.supabase.co (no trailing slash)');
  process.exit(3);
}

/**
 * The names cron.sql actually schedules — the single source of truth, shared
 * with the watchdog and cron-health.sql via the cronExpectationsMatchCronSql
 * guard. `select cron.schedule(` — the job name is the first argument.
 */
function jobsInCronSql(src) {
  const names = new Set();
  for (const m of src.matchAll(/cron\.schedule\(\s*'([^']+)'/g)) names.add(m[1]);
  return [...names].sort();
}

// All SQL goes through the linked CLI — there is no `exec` RPC in this project.
async function runViaSupabaseCli(sqlText) {
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync('supabase', ['db', 'query', '--linked', sqlText], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (res.status !== 0) {
    throw new Error(`supabase CLI failed: ${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

(async () => {
  console.log(`[register-crons] Target: ${SUPABASE_URL}`);

  // Read cron.sql template + substitute placeholders
  let cronSql;
  try {
    cronSql = readFileSync(CRON_SQL_PATH, 'utf-8');
  } catch (err) {
    console.error(`[register-crons] Cannot read ${CRON_SQL_PATH}:`, err.message);
    process.exit(2);
  }
  const expanded = cronSql
    .replaceAll('<SUPABASE_URL>', SUPABASE_URL)
    .replaceAll('<SERVICE_ROLE_KEY>', SERVICE_KEY);

  if (expanded.includes('<SUPABASE_URL>') || expanded.includes('<SERVICE_ROLE_KEY>')) {
    console.error('[register-crons] Placeholder substitution incomplete — refusing to run.');
    process.exit(2);
  }

  const REQUIRED_JOBS = jobsInCronSql(cronSql);
  if (REQUIRED_JOBS.length === 0) {
    // Two empty arrays compare equal; a parser that matched nothing would
    // "verify" a run that registered nothing. Refuse instead.
    console.error('[register-crons] Parsed no job names out of cron.sql — refusing to run.');
    process.exit(2);
  }

  // ── 1. Verify pg_cron is installed (R293 migration must already be applied)
  console.log('[register-crons] Verifying pg_cron extension…');
  try {
    const out = await runViaSupabaseCli(
      `select extname from pg_extension where extname in ('pg_cron','pg_net')`,
    );
    if (!out.includes('pg_cron')) {
      console.error('[register-crons] pg_cron not installed.');
      console.error('  Run: supabase db push --include-all (R293 migration enables it)');
      process.exit(1);
    }
    console.log('[register-crons] ✓ pg_cron + pg_net installed');
  } catch (err) {
    console.error('[register-crons] Verification failed:', err.message);
    process.exit(2);
  }

  // Execute the substituted cron.sql
  console.log(`[register-crons] Registering ${REQUIRED_JOBS.length} schedules…`);
  try {
    await runViaSupabaseCli(expanded);
    console.log('[register-crons] ✓ cron.sql executed without error');
  } catch (err) {
    console.error('[register-crons] cron.sql execution failed:', err.message);
    process.exit(2);
  }

  // Verify each expected job is now in cron.job
  console.log('[register-crons] Verifying registered schedules…');
  try {
    const out = await runViaSupabaseCli(
      `select jobname, schedule from cron.job order by jobname`,
    );
    const missing = REQUIRED_JOBS.filter((name) => !out.includes(name));
    if (missing.length > 0) {
      console.error('[register-crons] Missing schedules after run:');
      for (const m of missing) console.error(`  - ${m}`);
      process.exit(1);
    }
    console.log(`[register-crons] ✓ All ${REQUIRED_JOBS.length} schedules registered.`);
    console.log('\nNext: sleep tight. Crons fire on schedule; first run is the next matching cron tick.');
    console.log('Verify activity in 24h: select * from cron.job_run_details order by start_time desc limit 20;');
  } catch (err) {
    console.error('[register-crons] Verification failed:', err.message);
    process.exit(2);
  }
})().catch((err) => {
  console.error('[register-crons] Fatal:', err);
  process.exit(2);
});
