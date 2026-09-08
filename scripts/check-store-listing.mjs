#!/usr/bin/env node
// =============================================================================
// check-store-listing.mjs — do the Play listing strings actually fit?
// =============================================================================
// Run:  npm run check:listing
//
// Play truncates silently in some surfaces and rejects in others, and the limits
// are counted in UTF-16 code units, not bytes — German compounds and accented
// French run long in exactly the places a quick eyeball says "that looks short
// enough". This counts them.
//
// It also re-checks the register, because the store listing is the FIRST German
// a Handwerker ever reads and it sits outside src/i18n, which is precisely the
// blind spot that let the auth emails ship in `du` for six weeks (learning #287).
// =============================================================================

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = join(ROOT, 'docs/play-store-listing.md');

const LIMITS = { name: 30, short: 80, full: 4000 };
const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'];

let fail = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

const src = readFileSync(DOC, 'utf8');

// ── short descriptions live in a markdown table: | **de** | text | ──────────
console.log('\n\x1b[1mShort descriptions (80 max)\x1b[0m');
const shorts = new Map();
for (const m of src.matchAll(/^\|\s*\*\*(en|nl|de|fr|es|it)\*\*\s*\|\s*(.+?)\s*\|\s*$/gm)) {
  shorts.set(m[1], m[2]);
}
for (const loc of LOCALES) {
  const s = shorts.get(loc);
  if (!s) { bad(`${loc}: missing`); continue; }
  const n = s.length;
  n <= LIMITS.short
    ? ok(`${loc}  ${String(n).padStart(2)}/80  ${s}`)
    : bad(`${loc}  ${n}/80 — OVER by ${n - LIMITS.short}: ${s}`);
}

// ── full descriptions: everything under "### <loc>" up to the next heading ──
console.log('\n\x1b[1mFull descriptions (4000 max)\x1b[0m');
const fulls = new Map();
for (const loc of LOCALES) {
  const m = new RegExp(`\\n### ${loc}\\n([\\s\\S]*?)(?=\\n### |\\n---)`).exec(src);
  if (m) fulls.set(loc, m[1].trim());
}
for (const loc of LOCALES) {
  const s = fulls.get(loc);
  if (!s) { bad(`${loc}: missing`); continue; }
  const n = s.length;
  if (n > LIMITS.full) bad(`${loc}  ${n}/4000 — OVER by ${n - LIMITS.full}`);
  else if (n < 500) bad(`${loc}  ${n}/4000 — suspiciously short, is it truncated?`);
  else ok(`${loc}  ${String(n).padStart(4)}/4000`);
}

// ── register: de must be Sie, fr must be vous ───────────────────────────────
console.log('\n\x1b[1mRegister\x1b[0m');
const L = 'A-Za-zÀ-ɏ';
const words = (...f) => new RegExp(`(?<![${L}])(?:${f.join('|')})(?![${L}])`, 'i');
const CHECKS = {
  de: { forbid: words('du', 'dein', 'deine', 'deinen', 'deinem', 'dich', 'dir'), want: 'Sie' },
  fr: { forbid: words('tu', 'ton', 'ta', 'tes', 'toi'), want: 'vous' },
};
for (const [loc, { forbid, want }] of Object.entries(CHECKS)) {
  const body = `${shorts.get(loc) ?? ''}\n${fulls.get(loc) ?? ''}`;
  const hits = body
    .split(/\n+/)
    .filter((line) => forbid.test(line))
    // "Vasco" contains no forbidden word; brand and format names are safe, but
    // a URL or a product name could still trip the regex — surface, don't hide.
    .slice(0, 4);
  hits.length === 0
    ? ok(`${loc}: formal (${want}) throughout`)
    : bad(`${loc}: informal found —\n      ${hits.join('\n      ')}`);
}

// ── the honesty gate ────────────────────────────────────────────────────────
console.log('\n\x1b[1mNo claims about features that are dark in production\x1b[0m');
const DARK = /\b(AI|K\.?I\.?|kunstmatige intelligentie|intelligence artificielle|foto[- ]?scan|photo[- ]?to[- ]?quote|automatisch(e)? prijs)\b/i;
const claims = [];
for (const loc of LOCALES) {
  for (const line of (fulls.get(loc) ?? '').split(/\n+/)) {
    if (DARK.test(line)) claims.push(`${loc}: ${line.slice(0, 90)}`);
  }
}
claims.length === 0
  ? ok('no AI / photo-scanning claims — matches the unset LLM keys')
  : bad(`copy advertises features that throw in production:\n      ${claims.join('\n      ')}`);

// ---------------------------------------------------------------------------
// PHONE SCREENSHOTS
// ---------------------------------------------------------------------------
// The DARK check above reads the listing COPY only. A screenshot makes exactly
// the same claim to exactly the same reviewer, and nothing was looking at them:
// 4_photo_to_quote.png is titled "KI-Angebot" and pitches photo→AI quoting, and
// it would have shipped past a green run of this script.
console.log('\n\x1b[1mPhone screenshots\x1b[0m');

const PLAY_LOCALES = { en: 'en-US', nl: 'nl-NL', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };
// Names whose SCREEN advertises something dark in production. Filename-based on
// purpose: the capture pipeline names by screen, so this is stable and cheap.
const FORBIDDEN_SHOTS = /(photo[_-]?to[_-]?quote|ki[_-]?angebot|ai[_-]?quote)/i;

/** PNG dimensions straight from the IHDR chunk — no image library needed. */
function pngSize(file) {
  const b = readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const RATIOS = [9 / 16, 16 / 9];
for (const [loc, play] of Object.entries(PLAY_LOCALES)) {
  const dir = join(ROOT, 'fastlane/metadata/android', play, 'images/phoneScreenshots');
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort();
  } catch {
    bad(`${loc}: ${play}/images/phoneScreenshots is missing`);
    continue;
  }

  if (files.length < 2 || files.length > 8) {
    bad(`${loc}: ${files.length} screenshot(s) — Play requires 2–8`);
    continue;
  }

  const problems = [];
  for (const f of files) {
    if (FORBIDDEN_SHOTS.test(f)) {
      problems.push(`${f} advertises a feature that is dark in production`);
      continue;
    }
    const size = pngSize(join(dir, f));
    if (!size) { problems.push(`${f} is not a readable PNG`); continue; }
    const { w, h } = size;
    const r = w / h;
    if (!RATIOS.some((want) => Math.abs(r - want) < 0.01)) {
      problems.push(`${f} is ${w}×${h} (${r.toFixed(3)}) — Play needs 16:9 or 9:16`);
    }
    if (Math.min(w, h) < 320 || Math.max(w, h) > 3840) {
      problems.push(`${f} is ${w}×${h} — each side must be 320–3840px`);
    }
  }

  problems.length === 0
    ? ok(`${loc}: ${files.length} screenshot(s), 9:16, nothing dark advertised`)
    : bad(`${loc}:\n      ${problems.join('\n      ')}`);
}

console.log(`\n${'─'.repeat(58)}`);
if (fail) {
  console.log(`  \x1b[31m${fail} problem(s)\x1b[0m — fix docs/play-store-listing.md or the screenshots\n`);
  process.exit(1);
}
console.log('  \x1b[32mListing copy is within every limit.\x1b[0m\n');
