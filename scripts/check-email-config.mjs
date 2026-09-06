#!/usr/bin/env node
// =============================================================================
// check-email-config.mjs — is Vasco's outbound email actually wired up?
// =============================================================================
// Run:  npm run check:email
//
// Every other email check in this repo is a unit test against code. This one
// probes the things that are only true in PRODUCTION and that no test can see:
// live DNS, live Supabase auth config, live function deployments, live secrets.
//
// The history it exists to prevent: `RESEND_API_KEY` was never set, so
// `send-invoice` returned "Server misconfigured" on every call it had ever
// received — no invoice had EVER been emailed from production, and nothing
// anywhere reported that. A green test suite said nothing about it.
//
// Check 7 is the one with teeth over time. Resend rejects a From on an
// unverified domain with a 403, so a single new sender added on the bare
// `vascobuild.com` would silently kill that one function while every other
// email kept working — the exact failure that is hardest to notice.
// =============================================================================

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'gblhqhorkarocmputhte';

/** The ONE domain verified in Resend. Every sender must sit on it. */
const SEND_DOMAIN = 'mail.vascobuild.com';

let pass = 0, fail = 0, skip = 0;
const failures = [];

function ok(label, detail = '')  { pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  ${detail}` : ''}`); }
function bad(label, detail = '') { fail++; failures.push(label); console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `\n      ${detail}` : ''}`); }
function meh(label, detail = '') { skip++; console.log(`  \x1b[33m—\x1b[0m ${label}${detail ? `  ${detail}` : ''}`); }
function head(n, t)              { console.log(`\n\x1b[1m${n}. ${t}\x1b[0m`); }

function dig(type, name) {
  try {
    return execFileSync('dig', ['+short', type, name, '@1.1.1.1'], { encoding: 'utf8' }).trim();
  } catch { return ''; }
}

/** Management API token: env first, else the CLI's keychain entry. */
function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    const raw = execFileSync('security',
      ['find-generic-password', '-s', 'Supabase CLI', '-a', 'supabase', '-w'],
      { encoding: 'utf8' }).trim();
    return raw.startsWith('go-keyring-base64:')
      ? Buffer.from(raw.slice('go-keyring-base64:'.length), 'base64').toString('utf8').replace(/\0+$/, '')
      : raw;
  } catch { return null; }
}

async function api(path, token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}${path}`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

console.log(`\n\x1b[1mVasco email configuration\x1b[0m  ·  project ${PROJECT_REF}  ·  sending domain ${SEND_DOMAIN}`);

// ── 1-3. DNS ────────────────────────────────────────────────────────────────
head(1, 'DKIM');
{
  const v = dig('TXT', `resend._domainkey.${SEND_DOMAIN}`).replace(/"/g, '').replace(/\s/g, '');
  if (!v) bad('no DKIM record', `expected TXT at resend._domainkey.${SEND_DOMAIN}`);
  else if (!v.startsWith('p=')) bad('DKIM present but malformed', v.slice(0, 60));
  // A 1024-bit RSA key is ~216 base64 chars. A short value still RESOLVES, so
  // only a length check catches a paste that was silently truncated.
  else if (v.length < 200) bad('DKIM looks TRUNCATED', `${v.length} chars; a 1024-bit key is ~218`);
  else ok('published and complete', `${v.length} chars`);
}

head(2, 'SPF and MX');
{
  const spf = dig('TXT', `send.${SEND_DOMAIN}`).replace(/"/g, '').trim();
  spf.includes('amazonses.com') ? ok('SPF', spf) : bad('SPF missing or wrong', spf || '(empty)');

  const mx = dig('MX', `send.${SEND_DOMAIN}`).trim();
  if (!mx) bad('MX missing', `expected at send.${SEND_DOMAIN}`);
  else if (mx.includes('inbound-smtp')) bad('MX points at the RECEIVING host', `${mx}\n      Vasco only sends — this should be feedback-smtp.<region>.amazonses.com`);
  else if (mx.includes('feedback-smtp')) ok('MX', mx);
  else bad('MX unrecognised', mx);
}

head(3, 'DMARC');
{
  const d = dig('TXT', '_dmarc.vascobuild.com').replace(/"/g, '');
  if (!d) bad('no DMARC record at all');
  else {
    // aspf=s can never pass for Resend: the bounce domain is send.mail.<zone>,
    // not an exact match for the From domain. DKIM still carries DMARC, but
    // there is no SPF fallback — and at p=quarantine that is worth knowing.
    if (/aspf=s/.test(d)) bad('aspf=s — SPF can never align for Resend', `use aspf=r\n      current: ${d}`);
    else ok('SPF alignment relaxed');
    /rua=/.test(d) ? ok('aggregate reporting on') : bad('no rua= — enforcing with no visibility', d);
  }
}

// ── 4-6. Supabase (needs a token) ───────────────────────────────────────────
const token = accessToken();

head(4, 'Resend API key in Supabase secrets');
if (!token) meh('skipped — no SUPABASE_ACCESS_TOKEN and no CLI keychain entry', 'run: npx supabase login');
else {
  try {
    const secrets = await api('/secrets', token);
    secrets.map((s) => s.name).includes('RESEND_API_KEY')
      ? ok('RESEND_API_KEY set')
      : bad('RESEND_API_KEY NOT SET', 'every email function fails closed until this exists');
  } catch (e) { bad(`could not read secrets (${e.message})`); }
}

head(5, 'Auth email delivery');
if (!token) meh('skipped — no token');
else {
  try {
    const c = await api('/config/auth', token);
    c.smtp_host
      ? ok('custom SMTP', `${c.smtp_admin_email} via ${c.smtp_host}`)
      : bad('no custom SMTP', 'built-in sender: rate-limited and spam-foldered');
    (c.rate_limit_email_sent ?? 0) >= 100
      ? ok('send rate limit', String(c.rate_limit_email_sent))
      : bad(`rate limit is ${c.rate_limit_email_sent}/hour`, 'project-wide; raise via configure-auth-emails.mjs');
    c.hook_send_email_enabled
      ? ok('localized send-email hook ON', c.hook_send_email_uri || '')
      : meh('send-email hook OFF', 'every recipient gets ONE language — currently Dutch');
  } catch (e) { bad(`could not read auth config (${e.message})`); }
}

head(6, 'Functions deployed');
if (!token) meh('skipped — no token');
else {
  try {
    const { functions = [] } = await api('/functions', token).then(
      (r) => (Array.isArray(r) ? { functions: r } : r));
    const slugs = new Set(functions.map((f) => f.slug));
    for (const f of ['send-invoice', 'weekly-digest', 'churn-winback-email', 'send-automation-preview']) {
      slugs.has(f) ? ok(f) : bad(`${f} NOT deployed`);
    }
    slugs.has('send-email')
      ? ok('send-email')
      : meh('send-email not deployed', 'only needed for per-recipient languages (step 5)');
  } catch (e) { bad(`could not list functions (${e.message})`); }
}

// ── 7. Senders in code ──────────────────────────────────────────────────────
head(7, `Every sender sits on ${SEND_DOMAIN}`);
{
  const dir = join(ROOT, 'supabase/functions');
  const offenders = [];
  let checked = 0;

  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) {
        const src = readFileSync(p, 'utf8');
        if (!src.includes('api.resend.com') && !/FROM|from:/.test(src)) continue;
        // Any email-address literal that is NOT on the verified domain.
        for (const m of src.matchAll(/['"`<]([A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,}))/g)) {
          const [, addr, domain] = m;
          if (domain === SEND_DOMAIN) { checked++; continue; }
          if (/example\.(com|org)|\.test$/.test(domain)) continue;   // docs / fixtures
          offenders.push(`${p.replace(`${ROOT}/`, '')}  →  ${addr}`);
        }
      }
    }
  };
  if (existsSync(dir)) walk(dir);

  if (offenders.length) {
    bad(`${offenders.length} sender(s) on an UNVERIFIED domain`,
        `${offenders.join('\n      ')}\n      Resend 403s these — that function silently sends nothing.`);
  } else {
    ok(`all ${checked} sender literals on the verified domain`);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`);
console.log(`  \x1b[32m${pass} passed\x1b[0m   \x1b[31m${fail} failed\x1b[0m   \x1b[33m${skip} skipped\x1b[0m`);
if (fail) {
  console.log(`\n  Outstanding:\n${failures.map((f) => `    · ${f}`).join('\n')}`);
  console.log('\n  Runbook: memory/resend-email-golive.md\n');
  process.exit(1);
}
console.log('\n  Email is fully wired.\n');
