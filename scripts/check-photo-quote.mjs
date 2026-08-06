#!/usr/bin/env node
// =============================================================================
// PHOTO → QUOTE: does the vision model actually read a job photo?
// =============================================================================
// The pricing pitch is "photograph the job, get a quote priced from what you
// actually paid". Everything between the model and the customer-facing number
// is unit-tested (src/services/__tests__/quoteMoatRepricing.test.ts). The one
// thing tests cannot answer is whether the model READS THE PHOTO WELL — that
// needs a real image and a real key.
//
// On 2026-08-06 it could not be answered at all: no ANTHROPIC_API_KEY existed
// in production, so analyze-photo returned HTTP 500 and the headline capability
// was simply off. This script exists so that the moment a key is set, the
// question takes one command instead of an afternoon of rediscovery.
//
// It deliberately reports rather than asserts. "Is this quote any good?" is a
// judgement a tradesperson makes, not something a script should pretend to
// score. What it CAN do is surface the things that make output untrustworthy
// and would otherwise be skimmed past.
//
// Usage:
//   node scripts/check-photo-quote.mjs <path-to-job-photo.jpg> [trade] [country]
//   npm run check:photo -- ~/Desktop/badkamer.jpg plumbing NL
// =============================================================================

import { readFileSync } from 'fs';
import { basename, extname } from 'path';

const [, , imagePath, trade = 'general', country = 'NL'] = process.argv;

if (!imagePath) {
  console.error('Usage: node scripts/check-photo-quote.mjs <photo.jpg> [trade] [country]');
  process.exit(2);
}

// Credentials come from the repo .env, same as the app. Never printed.
const env = {};
try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch {
  console.error('Could not read .env — run this from the repo root.');
  process.exit(2);
}

const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) {
  console.error('EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY missing from .env');
  process.exit(2);
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const ext = extname(imagePath).toLowerCase();
if (!MIME[ext]) {
  console.error(`Unsupported image type "${ext}". Use jpg, png or webp.`);
  process.exit(2);
}

const bytes = readFileSync(imagePath);
const base64 = `data:${MIME[ext]};base64,${bytes.toString('base64')}`;
const mb = (bytes.length / 1024 / 1024).toFixed(2);

console.log('='.repeat(70));
console.log('PHOTO → QUOTE CHECK');
console.log('='.repeat(70));
console.log(`image   : ${basename(imagePath)} (${mb} MB)`);
console.log(`trade   : ${trade}   country: ${country}`);
console.log('');

// ── Auth ────────────────────────────────────────────────────────────────────
// analyze-photo is deployed with verify_jwt: true, so the anon key alone gets a
// 401 before the function ever runs. It needs a real signed-in USER token —
// which is correct (the function bills tokens against the project), but it does
// mean this script needs credentials for a test account.
//
// Set these in .env to make the check one command:
//   VASCO_TEST_EMAIL=...      VASCO_TEST_PASSWORD=...
let authToken = KEY;
if (env.VASCO_TEST_EMAIL && env.VASCO_TEST_PASSWORD) {
  const signIn = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.VASCO_TEST_EMAIL, password: env.VASCO_TEST_PASSWORD }),
  }).then((r) => r.json()).catch(() => null);
  if (signIn?.access_token) {
    authToken = signIn.access_token;
    console.log(`auth    : signed in as ${env.VASCO_TEST_EMAIL}`);
  } else {
    console.log(`auth    : sign-in FAILED (${signIn?.error_description ?? 'unknown'}) — falling back to anon`);
  }
} else {
  console.log('auth    : anon key only — expect 401 (see note below on failure)');
}
console.log('');

const started = Date.now();
let res;
try {
  res = await fetch(`${URL_}/functions/v1/analyze-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagesBase64: [base64], imageBase64: base64, trade, country }),
    signal: AbortSignal.timeout(90_000),
  });
} catch (err) {
  console.error(`✗ Request failed: ${err}`);
  process.exit(1);
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
const text = await res.text();
let data;
try { data = JSON.parse(text); } catch { data = null; }

if (!res.ok) {
  console.error(`✗ HTTP ${res.status} after ${elapsed}s`);
  console.error(`  ${(data?.error ?? text).toString().slice(0, 300)}`);
  if (res.status === 401) {
    console.error('');
    console.error('  → analyze-photo runs with verify_jwt: true, so it needs a signed-in');
    console.error('    USER token, not the anon key. Add a test account to .env:');
    console.error('      VASCO_TEST_EMAIL=...   VASCO_TEST_PASSWORD=...');
    console.error('    This says nothing yet about whether the model works.');
  }
  if (String(data?.error ?? text).includes('ANTHROPIC_API_KEY')) {
    console.error('');
    console.error('  → No provider key is set on the project. Nothing about the');
    console.error('    model can be judged until it is:');
    console.error('    npx supabase secrets set ANTHROPIC_API_KEY=... \\');
    console.error('      --project-ref gblhqhorkarocmputhte');
  }
  process.exit(1);
}

const items = Array.isArray(data?.detectedItems) ? data.detectedItems : [];

console.log(`✓ HTTP 200 in ${elapsed}s`);
console.log('');

// ── The promise is "a quote in two minutes". Latency is part of the product. ──
if (Number(elapsed) > 15) {
  console.log(`⚠ ${elapsed}s is slow for a contractor standing in a customer's hallway.`);
}

if (items.length === 0) {
  console.log('⚠ No line items detected. Either the photo does not show billable');
  console.log('  work, or the model failed to read it. Try a clearer, closer shot.');
  process.exit(0);
}

console.log(`DETECTED ${items.length} LINE(S)`);
console.log('-'.repeat(70));
let total = 0;
for (const it of items) {
  const qty = Number(it.suggestedQuantity ?? 0);
  const price = Number(it.suggestedPrice ?? 0);
  const conf = it.confidence;
  total += qty * price;
  console.log(`• ${it.description ?? '(no description)'}`);
  console.log(
    `    ${qty} ${it.unit ?? ''} × ${price.toFixed(2)} = ${(qty * price).toFixed(2)}` +
    `${conf != null ? `   confidence ${conf}` : '   confidence —'}`,
  );
  const bits = [];
  if (it.ean) bits.push(`EAN ${it.ean}`);
  if (it.articleNumber) bits.push(`art ${it.articleNumber}`);
  if (it.materialCostPerUnit != null && it.laborCostPerUnit != null) {
    bits.push(`split material ${it.materialCostPerUnit} / labour ${it.laborCostPerUnit}`);
  }
  if (bits.length) console.log(`    ${bits.join(' · ')}`);
}
console.log('-'.repeat(70));
console.log(`raw total (pre-moat): ${total.toFixed(2)}`);
console.log('');

// ── The things that quietly make output untrustworthy ──────────────────────
const notes = [];
const confs = items.map((i) => i.confidence).filter((c) => typeof c === 'number');
if (confs.length === 0) {
  notes.push('No confidence scores returned — the review gate (CONFIDENCE_GATE=60) cannot fire, so nothing will ever be flagged for review.');
} else if (confs.every((c) => c === confs[0])) {
  notes.push(`Every line scored ${confs[0]}. Identical confidence usually means the model is not really scoring, which makes the gate decorative.`);
}
if (items.some((i) => !i.unit)) notes.push('Some lines have no unit — repricing only matches discrete material units, so those cannot be repriced from your scans.');
if (!items.some((i) => i.ean || i.articleNumber)) {
  notes.push('No EAN/article numbers read. Expected unless a product label was visible; identifiers are what make an exact scan match possible.');
}
if (!items.some((i) => i.materialCostPerUnit != null)) {
  notes.push('No material/labour split returned — repricing then moves the whole line rather than just the material portion.');
}

if (notes.length) {
  console.log('WORTH CHECKING');
  for (const n of notes) console.log(`  ⚠ ${n}`);
  console.log('');
}

console.log('THE JUDGEMENT THIS SCRIPT CANNOT MAKE');
console.log('  Are these the right lines, at roughly the right quantities, for the');
console.log('  work in that photo? Show it to someone who does the trade. If they');
console.log('  would have to redo it, the pitch does not hold yet.');
