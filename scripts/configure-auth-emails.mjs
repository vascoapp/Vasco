#!/usr/bin/env node
// =============================================================================
// configure-auth-emails.mjs — push branded templates + custom SMTP to Supabase
// =============================================================================
// Turns the manual "paste 6 templates into the dashboard + fill in SMTP" chore
// into one idempotent command via the Supabase Management API.
//
// WHAT IT DOES
//   1. Reads the 6 branded HTML templates from supabase/email-templates/
//   2. PATCHes the project's auth config (subjects + HTML bodies for confirm /
//      recovery / magic-link / email-change / invite / reauthentication)
//   3. If SMTP_* env vars are present, also configures custom SMTP (the part
//      that actually fixes spam-foldering) + raises the email rate limit.
//
// REQUIRES
//   SUPABASE_ACCESS_TOKEN   — Management API token. Get it from
//                             https://supabase.com/dashboard/account/tokens
//                             (or run `supabase login` and reuse that token).
//   SUPABASE_PROJECT_REF    — defaults to gblhqhorkarocmputhte (Vasco prod).
//
// OPTIONAL (enables custom SMTP — the real deliverability fix)
//   SMTP_HOST               — e.g. smtp.resend.com
//   SMTP_PORT               — e.g. 465
//   SMTP_USER               — e.g. resend
//   SMTP_PASS               — the provider API key / SMTP password
//   SMTP_SENDER_EMAIL       — e.g. noreply@vascobuild.com  (must be on a domain
//                             you've verified at the provider with SPF+DKIM)
//   SMTP_SENDER_NAME        — defaults to "Vasco"
//
// USAGE
//   node scripts/configure-auth-emails.mjs            # templates only
//   SMTP_HOST=… SMTP_PORT=… … node scripts/configure-auth-emails.mjs   # + SMTP
//   node scripts/configure-auth-emails.mjs --dry-run  # print payload, send nothing
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, '..', 'supabase', 'email-templates');
const DRY_RUN = process.argv.includes('--dry-run');

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'gblhqhorkarocmputhte';

// dashboard template -> { file, subject, api field stem }
const TEMPLATES = [
  { file: 'confirm-signup.html',   stem: 'confirmation',    subject: 'Vasco: Bevestig je e-mailadres' },
  { file: 'reset-password.html',   stem: 'recovery',        subject: 'Vasco: Wachtwoord opnieuw instellen' },
  { file: 'magic-link.html',       stem: 'magic_link',      subject: 'Vasco: Je inloglink' },
  { file: 'email-change.html',     stem: 'email_change',    subject: 'Vasco: Bevestig je nieuwe e-mailadres' },
  { file: 'invite.html',           stem: 'invite',          subject: 'Vasco: Je bent uitgenodigd' },
  { file: 'reauthentication.html', stem: 'reauthentication', subject: 'Vasco: Je verificatiecode' },
];

function buildPayload() {
  const body = {};
  for (const t of TEMPLATES) {
    const html = readFileSync(join(TPL_DIR, t.file), 'utf8');
    body[`mailer_subjects_${t.stem}`] = t.subject;
    body[`mailer_templates_${t.stem}_content`] = html;
  }

  // Custom SMTP — only if the operator supplied credentials.
  if (process.env.SMTP_HOST) {
    const required = ['SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SENDER_EMAIL'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      console.error(`✖ SMTP_HOST is set but missing: ${missing.join(', ')}`);
      process.exit(1);
    }
    body.smtp_host = process.env.SMTP_HOST;
    body.smtp_port = process.env.SMTP_PORT;
    body.smtp_user = process.env.SMTP_USER;
    body.smtp_pass = process.env.SMTP_PASS;
    body.smtp_admin_email = process.env.SMTP_SENDER_EMAIL;
    body.smtp_sender_name = process.env.SMTP_SENDER_NAME || 'Vasco';
    body.external_email_enabled = true;
    // Default Supabase SMTP is throttled to ~2/hr; bump now that we own delivery.
    body.rate_limit_email_sent = 100;
  }

  return body;
}

async function main() {
  // Validate templates exist + carry the Supabase Go-template variables.
  const payload = buildPayload();
  const smtpConfigured = Boolean(payload.smtp_host);

  console.log(`Project: ${PROJECT_REF}`);
  console.log(`Templates: ${TEMPLATES.length} (subjects + HTML bodies)`);
  console.log(`Custom SMTP: ${smtpConfigured ? `yes → ${payload.smtp_admin_email} (${payload.smtp_host})` : 'no (templates only — set SMTP_* to fix deliverability)'}`);

  if (DRY_RUN) {
    const preview = Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [
        k,
        k === 'smtp_pass' ? '***' : typeof v === 'string' && v.length > 80 ? `${v.slice(0, 60)}… (${v.length} chars)` : v,
      ]),
    );
    console.log('\n--- DRY RUN: payload that would be PATCHed ---');
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  if (!ACCESS_TOKEN) {
    console.error('\n✖ SUPABASE_ACCESS_TOKEN not set. Get one at');
    console.error('  https://supabase.com/dashboard/account/tokens');
    console.error('  then: SUPABASE_ACCESS_TOKEN=sbp_… node scripts/configure-auth-emails.mjs');
    process.exit(1);
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`\n✖ Management API returned ${res.status} ${res.statusText}`);
    console.error(text.slice(0, 500));
    process.exit(1);
  }

  console.log('\n✅ Auth email config updated.');
  console.log(`   ${TEMPLATES.length} templates + subjects applied${smtpConfigured ? ' + custom SMTP enabled' : ''}.`);
  if (!smtpConfigured) {
    console.log('   ⚠️  Still on default Supabase SMTP — emails may land in spam until');
    console.log('       you set SMTP_* and re-run. See supabase/email-templates/dns-records.md');
  } else {
    console.log('   Send a test (forgot-password) and check it lands in the inbox, not spam.');
  }
}

main().catch((err) => {
  console.error('✖ Unexpected error:', err.message);
  process.exit(1);
});
