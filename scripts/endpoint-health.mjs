#!/usr/bin/env node
// =============================================================================
// ENDPOINT HEALTH HARNESS (R223)
// =============================================================================
// Pings every Vasco Edge Function + a representative RLS-protected SELECT
// and asserts each returns an allowed status. Runs against a live Supabase
// project.
//
// The function list is DERIVED from supabase/functions/*, never hardcoded. A
// hardcoded list rots in both directions and both rots are silent:
//   - `draft-customer-reply` was deleted in 3d2af52 and sat in this registry
//     for months, reporting a 404 "failure" for a function that was *supposed*
//     to be gone. A permanently-red check is a check nobody reads.
//   - Meanwhile 20 of the 35 real functions were listed nowhere and went
//     unprobed, including `rank-insights` — in the repo, invoked by the client,
//     never deployed.
// Deriving the list means adding a function enrols it automatically and
// deleting one retires it automatically.
//
// ENVIRONMENT
//   SUPABASE_URL       https://<ref>.supabase.co                (required)
//   SUPABASE_ANON_KEY  public anon JWT                           (required)
//   TEST_USER_JWT      session access_token of a real test user  (required)
//
// OPTIONAL
//   SKIP_FUNCTIONS     comma-separated fn names to skip (adds to SIDE_EFFECTING)
//   VERBOSE            '1' to print each response body excerpt
//
// USAGE
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_ANON_KEY=eyJ... \
//   TEST_USER_JWT=eyJ... \
//   node scripts/endpoint-health.mjs
//
// EXIT CODES
//   0 — every check hit an allowed status
//   1 — at least one check failed
//   2 — missing required env
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const url  = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const jwt  = process.env.TEST_USER_JWT;
const verbose = process.env.VERBOSE === '1';

/**
 * NOT probed: invoking these with a probe body has real-world side effects —
 * they email customers, charge cards, retrain models or fan out push. A health
 * check must never be the reason a contractor's client gets a win-back email.
 * They are listed, and reported as unprobed, so coverage stays honest.
 */
const SIDE_EFFECTING = new Set([
  'mollie-webhook', 'stripe-webhook',           // signature-verified, reject us by design
  'weekly-digest', 'daily-push-digest',          // fan out email/push to real users
  'churn-winback-email', 'send-email', 'send-sms',
  'send-automation-preview',
  'drain-account-deletions',                     // deletes accounts
  'grant-referral-credits',                      // mutates balances
  'weekly-retrain-models', 'train-extra-models', // expensive, writes model rows
  'pack-trigger-tick', 'watchdog-daily',         // cron fan-out
  'capture-lead',                                // writes a lead row
]);
for (const n of (process.env.SKIP_FUNCTIONS ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
  SIDE_EFFECTING.add(n);
}

if (!url || !anon || !jwt) {
  console.error('Missing env. Set SUPABASE_URL, SUPABASE_ANON_KEY, TEST_USER_JWT.');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Check registry
// ---------------------------------------------------------------------------
// Each check: { name, run() → { status, ok, note? } }
//   - `ok` is the caller's judgement call — 401 on a service-role-only
//     endpoint invoked with a user JWT is expected, so that's still 'ok'.

/**
 * An "allowed" response. A 4xx on validation (empty body, missing id) is
 * fine — it proves the endpoint is live and input-checked. 2xx is ideal.
 * 401/403 where the user JWT is not meant to reach is also fine.
 *
 * A 5xx is a failure, but not all failures want the same person: `kind`
 * separates a crash (engineer) from a missing secret (operator) from an
 * undeployed function (one CLI command).
 *
 * `scope` matters: 404 means "never deployed" only for an edge function whose
 * directory we just read off disk. On a REST read or an RPC a 404 means the
 * table or routine is missing, which is a different — and worse — problem, so
 * it must not be filed under the reassuring "just deploy it" bucket.
 */
function judge({ status, text = '', scope = 'other', expectStatuses = [200, 201, 204, 400, 401, 403, 422] }) {
  // A 404 on a function that EXISTS in the repo is deploy drift, not a code
  // fault — the distinction matters because the fix is `supabase functions
  // deploy`, not an edit. `rank-insights` is exactly this: present in the repo,
  // invoked by the client, never deployed, so it 404s on every real call.
  if (status === 404 && scope === 'function') {
    return { ok: false, kind: 'undeployed', note: 'in repo, NOT deployed' };
  }
  // A *handled* 5xx: the function booted, checked its env and told us a secret
  // is missing. Still broken in production, but an operator sets a key rather
  // than anyone editing code — so it is reported apart from a genuine crash.
  //
  // Three spellings, because the functions do not agree with each other:
  // `Server misconfigured` (500), `claude_not_configured` / `taxjar_not_configured`
  // (503). Matching only the first spelling filed ai-command and tax-lookup as
  // crashes for one run of this harness, which is the whole reason the pattern
  // is a list and not a word.
  if (status >= 500 && /misconfigur|not[_ ]configured/i.test(text)) {
    return { ok: false, kind: 'config', note: 'missing secret (handled)' };
  }
  if (status >= 500) return { ok: false, kind: 'fail', note: 'server error' };
  if (expectStatuses.includes(status)) return { ok: true, kind: 'ok' };
  return { ok: false, kind: 'fail', note: `unexpected ${status}` };
}

async function call(path, { method = 'POST', headers = {}, body } = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${jwt}`,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text().catch(() => '');
  return { status: res.status, text };
}

// ---------------------------------------------------------------------------
// Edge Function checks — name : invocation shape
// ---------------------------------------------------------------------------

/**
 * Probe bodies for functions that need more than `{}` to get past their first
 * validation gate. Anything absent gets `{}` — an empty body should produce a
 * clean 400/422, which is itself the thing being asserted.
 */
const PROBE_BODIES = {
  'predict-duration':            { trade: 'plumbing' },
  'predict-price':               { trade: 'plumbing' },
  'sign-quote-token':            { quoteId: 'smoke-test' },
  'verify-quote-token':          { token: 'smoke.invalid.token' },
  'create-subscription-checkout': { tier: 'vakman' },
  'tax-lookup':                  { country: 'NL' },
  'embed-text':                  { text: '' },
  'generate-embedding':          { text: '' },
};

/** 401 is the correct answer from anything a user JWT must not reach. */
const EXPECT = [200, 201, 204, 400, 401, 403, 422];

/** Every function directory in the repo — this IS the registry. */
function repoFunctions() {
  const dir = path.join(ROOT, 'supabase', 'functions');
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('_'))
    .map(e => e.name)
    .filter(n => fs.existsSync(path.join(dir, n, 'index.ts')))
    .sort();
}

/**
 * Every function name the CLIENT invokes, scraped from the app source. A name
 * here with no directory in supabase/functions is a phantom endpoint: the app
 * calls a URL that cannot exist. That is how `supplier-oauth-exchange` — an
 * edge function that was never written — sat in shipped config unnoticed.
 *
 * This is a TEXT scan, so it is deliberately narrowed twice:
 *   - tests and mocks are skipped — they name invented endpoints on purpose,
 *     and a fixture must never be able to raise a production alarm;
 *   - line comments are stripped, so prose like "mirrors /functions/v1/foo"
 *     does not register as a call site.
 * Both narrowings can only cause a miss, never a false alarm, which is the
 * right way round for a check that will otherwise be ignored once it cries wolf.
 */
const SKIP_DIRS = new Set(['node_modules', '__tests__', '__mocks__', '__fixtures__']);

function invokedFunctions() {
  const names = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(p);
      } else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) {
        const src = fs.readFileSync(p, 'utf8').replace(/^\s*\/\/.*$/gm, '');
        for (const m of src.matchAll(/functions\.invoke\(\s*['"`]([a-z0-9-]+)['"`]/g)) names.add(m[1]);
        for (const m of src.matchAll(/\/functions\/v1\/([a-z0-9-]+)/g)) names.add(m[1]);
      }
    }
  };
  for (const d of ['src', 'app']) {
    const full = path.join(ROOT, d);
    if (fs.existsSync(full)) walk(full);
  }
  return [...names].sort();
}

const FUNCTIONS = repoFunctions().map(name => ({
  name,
  body: PROBE_BODIES[name] ?? {},
  expect: EXPECT,
}));

// ---------------------------------------------------------------------------
// RLS / PostgREST reads — prove the user's session works end-to-end
// ---------------------------------------------------------------------------

const REST_READS = [
  { name: 'documents?limit=1',           path: '/rest/v1/documents?limit=1',           expect: [200, 206] },
  { name: 'customers?limit=1',           path: '/rest/v1/customers?limit=1',           expect: [200, 206] },
  { name: 'jobs?limit=1',                path: '/rest/v1/jobs?limit=1',                expect: [200, 206] },
  { name: 'feature_flags?limit=1',       path: '/rest/v1/feature_flags?limit=1',       expect: [200, 206] },
];

// ---------------------------------------------------------------------------
// RPC sanity — picks two cheap moat RPCs that should return a row shape
// even when the cohort is thin (k-anonymity suppressed).
// ---------------------------------------------------------------------------

const RPCS = [
  { name: 'get_cohort_dso',              body: { p_country: 'NL' },                                          expect: [200] },
  { name: 'get_trade_pricing_stats',     body: { p_trade: 'plumbing', p_country: 'NL' },                     expect: [200] },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const results = [];

async function step(label, fn, expectStatuses, scope = 'other') {
  try {
    const { status, text } = await fn();
    const { ok, kind, note } = judge({ status, text, scope, expectStatuses });
    results.push({ label, status, ok, kind, note });
    const mark = ok ? '✓' : '✗';
    console.log(`${mark} ${label.padEnd(45)} ${status}${note ? ` (${note})` : ''}`);
    if (verbose) console.log(`    ${text.slice(0, 200)}`);
  } catch (e) {
    results.push({ label, status: 0, ok: false, kind: 'fail', note: String(e?.message ?? e) });
    console.log(`✗ ${label.padEnd(45)} ERR ${e?.message ?? e}`);
  }
}

console.log(`\nEndpoint health check against ${url}\n`);
// ---------------------------------------------------------------------------
// Phantom endpoints — the client calling a URL that has no function behind it
// ---------------------------------------------------------------------------
const repoFns = new Set(FUNCTIONS.map(f => f.name));
const phantoms = invokedFunctions().filter(n => !repoFns.has(n));

console.log('── Edge Functions ──');

for (const fn of FUNCTIONS) {
  if (SIDE_EFFECTING.has(fn.name)) {
    console.log(`· ${fn.name.padEnd(45)} not probed (side-effecting)`);
    continue;
  }
  await step(
    fn.name,
    () => call(`/functions/v1/${fn.name}`, { body: fn.body }),
    fn.expect,
    'function',
  );
}

console.log('\n── PostgREST (RLS reads) ──');
for (const r of REST_READS) {
  await step(r.name, () => call(r.path, { method: 'GET' }), r.expect);
}

console.log('\n── RPC (moat readers) ──');
for (const r of RPCS) {
  await step(
    `rpc/${r.name}`,
    () => call(`/rest/v1/rpc/${r.name}`, { body: r.body }),
    r.expect,
  );
}

console.log('\n── Client → function drift ──');
if (phantoms.length === 0) {
  console.log('✓ every function the app invokes exists in supabase/functions');
} else {
  for (const p of phantoms) {
    console.log(`✗ ${p.padEnd(45)} PHANTOM — app invokes it, no such function`);
    results.push({ label: `phantom:${p}`, status: 0, ok: false, kind: 'fail', note: 'app invokes a function that does not exist' });
  }
}

const bucket = (k) => results.filter(r => !r.ok && r.kind === k);
const failed = results.filter(r => !r.ok);
const config = bucket('config');
const undeployed = bucket('undeployed');
const broken = bucket('fail');

console.log(`\n── Summary ──`);
console.log(`${results.length - failed.length}/${results.length} checks passed.`);
if (broken.length) {
  console.log(`\n🔴 Broken (code/runtime):`);
  for (const f of broken) console.log(`  ${f.label}: ${f.status} ${f.note ?? ''}`);
}
if (undeployed.length) {
  console.log(`\n🟠 In repo, not deployed — fix with \`supabase functions deploy <name>\`:`);
  for (const f of undeployed) console.log(`  ${f.label}`);
}
if (config.length) {
  console.log(`\n🟡 Live but missing a secret — operator sets the key, no code change:`);
  for (const f of config) console.log(`  ${f.label}`);
}
process.exit(failed.length > 0 ? 1 : 0);
