#!/usr/bin/env node
// =============================================================================
// ENDPOINT HEALTH HARNESS (R223)
// =============================================================================
// Pings every Vasco Edge Function + a representative RLS-protected SELECT
// and asserts each returns an allowed status. Runs against a live Supabase
// project.
//
// ENVIRONMENT
//   SUPABASE_URL       https://<ref>.supabase.co                (required)
//   SUPABASE_ANON_KEY  public anon JWT                           (required)
//   TEST_USER_JWT      session access_token of a real test user  (required)
//
// OPTIONAL
//   SKIP_FUNCTIONS     comma-separated fn names to skip (default: webhooks)
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

const url  = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const jwt  = process.env.TEST_USER_JWT;
const verbose = process.env.VERBOSE === '1';
const skip = new Set(
  (process.env.SKIP_FUNCTIONS ?? 'mollie-webhook,stripe-webhook,weekly-digest,drain-account-deletions')
    .split(',').map(s => s.trim()).filter(Boolean),
);

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
 * fine — it proves the function is live and input-checked. 5xx is always
 * failure. 2xx is ideal. 401/403 on endpoints we *know* the user JWT
 * cannot access is tagged explicitly.
 */
function judge({ status, expectStatuses = [200, 201, 204, 400, 401, 403, 422] }) {
  if (status >= 500) return { ok: false, note: 'server error' };
  if (expectStatuses.includes(status)) return { ok: true };
  return { ok: false, note: `unexpected ${status}` };
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

const FUNCTIONS = [
  // Input-validated — empty body intentionally triggers 400/422; function liveness proven.
  { name: 'analyze-photo',              body: {}, expect: [200, 400, 422] },
  { name: 'classify-customer-question', body: {}, expect: [200, 400, 422] },
  { name: 'draft-customer-reply',       body: {}, expect: [200, 400, 422] },
  { name: 'place-supplier-order',       body: {}, expect: [200, 400, 422] },
  { name: 'predict-duration',           body: { trade: 'plumbing' }, expect: [200, 400, 422] },
  { name: 'predict-price',              body: { trade: 'plumbing' }, expect: [200, 400, 422] },
  { name: 'send-invoice',               body: {}, expect: [200, 400, 422] },
  { name: 'send-push',                  body: {}, expect: [200, 400, 422] },
  { name: 'sign-quote-token',           body: { quoteId: 'smoke-test' }, expect: [200, 400, 422] },
  { name: 'verify-quote-token',         body: { token: 'smoke.invalid.token' }, expect: [200, 400, 401, 422] },
  { name: 'create-subscription-checkout', body: { tier: 'vakman' }, expect: [200, 400, 422] },
  // Webhooks + service-role are SKIPPED by default — they reject user-JWT
  // invocations by design. Listed so the registry stays truthful.
  { name: 'mollie-webhook',            body: {}, expect: [200, 400, 401, 422] },
  { name: 'stripe-webhook',            body: {}, expect: [200, 400, 401, 422] },
  { name: 'weekly-digest',             body: {}, expect: [200, 401, 403] },
  { name: 'drain-account-deletions',   body: {}, expect: [200, 401, 403] },
];

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

async function step(label, fn, expectStatuses) {
  try {
    const { status, text } = await fn();
    const { ok, note } = judge({ status, expectStatuses });
    results.push({ label, status, ok, note });
    const mark = ok ? '✓' : '✗';
    console.log(`${mark} ${label.padEnd(45)} ${status}${note ? ` (${note})` : ''}`);
    if (verbose) console.log(`    ${text.slice(0, 200)}`);
  } catch (e) {
    results.push({ label, status: 0, ok: false, note: String(e?.message ?? e) });
    console.log(`✗ ${label.padEnd(45)} ERR ${e?.message ?? e}`);
  }
}

console.log(`\nEndpoint health check against ${url}\n`);
console.log('── Edge Functions ──');

for (const fn of FUNCTIONS) {
  if (skip.has(fn.name)) {
    console.log(`· ${fn.name.padEnd(45)} skipped`);
    continue;
  }
  await step(
    fn.name,
    () => call(`/functions/v1/${fn.name}`, { body: fn.body }),
    fn.expect,
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

const failed = results.filter(r => !r.ok);
console.log(`\n── Summary ──`);
console.log(`${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) {
  console.log(`\nFailures:`);
  for (const f of failed) console.log(`  ${f.label}: ${f.status} ${f.note ?? ''}`);
  process.exit(1);
}
process.exit(0);
