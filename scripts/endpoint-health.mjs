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
  // The signature of a dead customer surface. 42501 here does not mean the
  // customer did something wrong — it means the path they are on was never
  // granted, so it fails identically for all of them. Name it, because
  // "unexpected 401" reads like an auth problem and this is not one.
  if (scope === 'anon' && /42501|permission denied/i.test(text)) {
    return { ok: false, kind: 'fail', note: 'anon has NO grant — customer surface is dead' };
  }
  if (scope === 'anon' && /PGRST202|does not exist/i.test(text)) {
    return { ok: false, kind: 'fail', note: 'no such routine for anon' };
  }
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

/**
 * The same request WITHOUT a session — i.e. exactly what a customer's browser
 * sends. Everything above this line runs as an authenticated contractor, which
 * is why three separate customer-facing surfaces could be dead in production
 * while this harness reported 19/26 green (2026-08-19).
 */
async function callAnon(path, { method = 'POST', body } = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, text: await res.text().catch(() => '') };
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
// ANON CUSTOMER SURFACE — the half of the product that has no login
// ---------------------------------------------------------------------------
/**
 * Quote acceptance links, the decision portal, the signature capture: all of
 * it is used by the contractor's CUSTOMER, who has no account. Those calls go
 * out with the anon key alone.
 *
 * Every one of them was broken on 2026-08-19 and none of it showed here,
 * because `anon` holds zero table grants in this project and nothing in this
 * harness had ever sent a request without a session. The failures were
 * uniform 42501s that the customer's UI reported as "this link is not valid".
 *
 * Each probe below is deliberately called with junk arguments — a real access
 * code would be a fixture to maintain. What we are asserting is that the
 * surface EXISTS and is REACHABLE by an anon caller: 42501 (no grant), 42883 /
 * PGRST202 (no such function) and 5xx are failures. A clean NULL or `false` is
 * a pass — the guard did its job.
 *
 * ⚠️ Reachable is not the same as working. `get_portal_by_access_code`
 * returned a clean 200 here for months while failing on every REAL code
 * (`column di.priority does not exist`) — the format guard returns NULL before
 * touching a table, and a guard's 200 looks like a query's 200. Anything this
 * section says must be confirmed against real data before it is believed.
 */
const ANON_SURFACE = [
  { name: 'get_portal_by_access_code',      body: { p_access_code: 'HEALTHCHK' } },
  { name: 'get_acceptance_link_by_token',   body: { p_token: 'healthcheck0000' } },
  { name: 'decide_acceptance_link',         body: { p_token: 'healthcheck0000', p_decision: 'accepted', p_reason: null } },
  { name: 'submit_decision_via_portal',     body: { p_access_code: 'HEALTHCHK', p_item_id: '00000000-0000-0000-0000-000000000000', p_value: 'x', p_notes: null, p_photos: null, p_linked_product_url: null, p_time_to_decide_seconds: null } },
  { name: 'log_portal_activity',            body: { p_access_code: 'HEALTHCHK', p_activity_type: 'health_check', p_item_id: null, p_metadata: null } },
  { name: 'record_portal_event',            body: { p_access_code: 'HEALTHCHK', p_event_type: 'health_check', p_decision_id: null, p_quote_id: null, p_duration_ms: null, p_metadata: null } },
];

/**
 * Tables the anon customer paths must NOT be able to read. This is the other
 * half of the same story: the fix for "the customer can't accept" is one
 * `GRANT ... TO anon` away, and that grant would expose every quote token on
 * the platform (the RLS policy that was there read `USING (true)`). If someone
 * reaches for the grant, this fails.
 */
const ANON_MUST_NOT_READ = ['quote_acceptance_links', 'decision_submissions', 'decision_trackers', 'customers', 'documents'];

// ---------------------------------------------------------------------------
// Client → RPC drift — the same check as functions, for the other call surface
// ---------------------------------------------------------------------------
/**
 * `update_tracker_progress` was called after every decision submission for
 * months and had never been written — not in prod, not in any migration in
 * this repo. It sat inside a bare try/catch marked "Non-critical", so
 * `decision_trackers.completed_items` never moved and every tracker read
 * "0 of N decided". The function drift check would have caught the same
 * mistake made against an edge function; RPCs simply had no equivalent.
 *
 * Same narrowing as invokedFunctions(): literal single-quoted names only.
 * A miss is acceptable, a false alarm is not.
 */
function invokedRpcs() {
  const names = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(p);
      } else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) {
        const src = fs.readFileSync(p, 'utf8').replace(/^\s*\/\/.*$/gm, '');
        for (const m of src.matchAll(/\.rpc\s*(?:as any\))?\s*\(\s*['"`]([a-z0-9_]+)['"`]/g)) names.add(m[1]);
        for (const m of src.matchAll(/\/rest\/v1\/rpc\/([a-z0-9_]+)/g)) names.add(m[1]);
      }
    }
  };
  for (const d of ['src', 'app']) {
    const full = path.join(ROOT, d);
    if (fs.existsSync(full)) walk(full);
  }
  return [...names].sort();
}

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

console.log('\n── Anon customer surface (no session) ──');
for (const r of ANON_SURFACE) {
  await step(
    `anon rpc/${r.name}`,
    () => callAnon(`/rest/v1/rpc/${r.name}`, { body: r.body }),
    [200, 204],
    'anon',
  );
}
for (const t of ANON_MUST_NOT_READ) {
  const { status } = await callAnon(`/rest/v1/${t}?select=*&limit=1`, { method: 'GET' });
  const ok = status === 401 || status === 403;
  results.push({ label: `anon cannot read ${t}`, status, ok, kind: ok ? 'ok' : 'fail', note: ok ? '' : 'ANON CAN READ THIS TABLE' });
  console.log(`${ok ? '✓' : '✗'} ${`anon cannot read ${t}`.padEnd(45)} ${status}${ok ? '' : '  ← anon can read this table'}`);
}

console.log('\n── Client → RPC drift ──');
{
  /**
   * Exact, from the catalog. `list_public_routines()` (migration
   * 20260819000004) exists for this: PostgREST cannot answer "does this
   * routine exist" over HTTP — a no-arg call returns PGRST202 for a missing
   * routine and for a wrong overload alike, and the `hint` field that looks
   * like a discriminator is a fuzzy-similarity suggestion. Reading it as one
   * produced 55 phantoms including six RPCs verified working minutes earlier.
   *
   * The controls stay: a set that comes back empty, or without a routine we
   * know is there, means the probe is broken and this check must say so
   * rather than declare every call site a phantom.
   */
  const { status, text } = await call('/rest/v1/rpc/list_public_routines', { body: {} });
  let live = null;
  try { live = JSON.parse(text); } catch { /* handled below */ }

  if (!Array.isArray(live) || live.length === 0 || !live.includes('get_portal_by_access_code')) {
    console.log(`· skipped — could not read the routine list (HTTP ${status})`);
    results.push({ label: 'rpc drift detector', status, ok: false, kind: 'fail',
                   note: 'could not read routine list — RPC drift NOT checked this run' });
  } else {
    const known = new Set(live);
    const names = invokedRpcs();
    const phantomRpcs = names.filter(n => !known.has(n));
    if (phantomRpcs.length === 0) {
      console.log(`✓ every RPC the app calls exists in the database (${names.length} checked)`);
    } else {
      for (const n of phantomRpcs) {
        console.log(`✗ ${n.padEnd(45)} PHANTOM — app calls it, no such routine`);
        results.push({ label: `phantom rpc:${n}`, status: 0, ok: false, kind: 'fail',
                       note: 'app calls an RPC that does not exist' });
      }
    }
  }
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
