#!/usr/bin/env node
// =============================================================================
// GENERATE-PHRASING — author generator wording with an LLM, out of band
// =============================================================================
// Calls the `generate-phrasing` edge function with phrasing SHAPES (key,
// placeholder names, character budget) and writes the validated result to
// src/intelligence/phrasing/generated/phrasings.json.
//
// This is an ops step, not a runtime one, and that is the entire point:
//
//   * The app never calls an LLM to render a card. Generators are synchronous
//     hooks; a per-render call would put seconds in front of every insight and
//     break the offline path.
//   * The output is committed, so a wording change shows up in `git diff` and
//     goes through review like any other user-facing string.
//   * Input carries no customer name, no business name and no figure, so this
//     can route to Kimi/Moonshot without a third-country transfer question.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... VASCO_ACCESS_TOKEN=... \
//     node scripts/generate-phrasing.mjs [--dry-run] [--keys a,b]
//
// Provider is chosen server-side by env on the edge function:
//   LLM_PHRASING_PROVIDER=moonshot  LLM_PHRASING_MODEL=kimi-k2-0905-preview
// Unset => Claude, per _shared/llm.ts defaults.
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SPEC_PATH = resolve(ROOT, 'src/intelligence/phrasing/phrasingSpecs.json');
const OUT_PATH = resolve(ROOT, 'src/intelligence/phrasing/generated/phrasings.json');
const PACK_VERSION = 1;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keyFilter = (() => {
  const i = args.indexOf('--keys');
  return i === -1 ? null : new Set(args[i + 1].split(','));
})();

const fail = (msg) => { console.error(`\x1b[31m✗ ${msg}\x1b[0m`); process.exit(1); };

// --- specs -------------------------------------------------------------------
const specData = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
const specs = keyFilter ? specData.specs.filter((s) => keyFilter.has(s.key)) : specData.specs;
if (specs.length === 0) fail('no specs selected');

// --- current wording, as a meaning reference ---------------------------------
// Pulled straight out of generatorTranslations.ts rather than duplicated. Only
// used to tell the model what the string MEANS; it is told not to copy it.
const current = (() => {
  const src = readFileSync(resolve(ROOT, 'src/intelligence/generatorTranslations.ts'), 'utf8');
  const out = {};

  // Brace-scan rather than regex: the values themselves contain "{{count}}",
  // so a lazy [^}]* stops inside the placeholder and silently returns nothing.
  // (It did exactly that on first run — only the one placeholder-free key came
  // back populated, which is the kind of partial success that reads as working.)
  const entryBody = (key) => {
    const at = src.search(new RegExp(`\\n\\s*${key}:\\s*\\{`));
    if (at === -1) return null;
    const open = src.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) return src.slice(open + 1, i);
      }
    }
    return null;
  };

  for (const spec of specs) {
    const body = entryBody(spec.key);
    if (!body) continue;
    // Locale values are single-quoted; allow escaped quotes inside.
    const pick = (lang) => {
      const m = body.match(new RegExp(`\\b${lang}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
      return m ? m[1] : undefined;
    };
    const en = pick('en');
    const nl = pick('nl');
    if (!en && !nl) continue;
    out[spec.key] = {};
    if (en) out[spec.key].en = en;
    if (nl) out[spec.key].nl = nl;
  }
  return out;
})();

const missingRef = specs.filter((s) => !current[s.key]).map((s) => s.key);
if (missingRef.length) {
  // Not fatal — the model can work from the key name and placeholders alone —
  // but silence here would hide a renamed key, so say it out loud.
  console.warn(`\x1b[33m⚠ no current wording found for: ${missingRef.join(', ')}\x1b[0m`);
}

console.log(`Generating phrasing for ${specs.length} key(s): ${specs.map((s) => s.key).join(', ')}`);

if (dryRun) {
  console.log('\n--- payload (dry run, nothing sent) ---');
  console.log(JSON.stringify({ specs, tone: specData.tone, current }, null, 2));
  process.exit(0);
}

// --- call the edge function --------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const TOKEN = process.env.VASCO_ACCESS_TOKEN;
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL) fail('SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) is required');
if (!TOKEN) fail('VASCO_ACCESS_TOKEN is required — a signed-in user JWT, the fn is auth-gated');

const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-phrasing`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
    ...(ANON ? { apikey: ANON } : {}),
  },
  body: JSON.stringify({ specs, tone: specData.tone, current, maxRepairs: 2 }),
});

if (!resp.ok) fail(`edge function returned HTTP ${resp.status}: ${(await resp.text()).slice(0, 400)}`);
const result = await resp.json();
if (!result.ok) fail(`generation failed: ${result.error}`);

// --- report ------------------------------------------------------------------
const accepted = Object.keys(result.entries ?? {});
console.log(`\n\x1b[32m✓ ${accepted.length}/${specs.length} accepted\x1b[0m (provider: ${result.provider})`);

if (result.unresolved?.length) {
  // These keep their built-in gt() wording. Never silent: a key that could not
  // be phrased is a signal about the spec (budget too tight? placeholders
  // impossible to use naturally?), not something to shrug at.
  console.warn(`\x1b[33m⚠ unresolved, keeping built-in wording: ${result.unresolved.join(', ')}\x1b[0m`);
  for (const v of (result.violations ?? []).slice(0, 12)) {
    console.warn(`    ${v.key}${v.language ? `[${v.language}]` : ''} ${v.rule}: ${v.detail}`);
  }
}

if (accepted.length === 0) fail('nothing accepted — not writing a pack');

// --- merge + write -----------------------------------------------------------
// Merge rather than overwrite so `--keys` regenerates one string without
// discarding the rest of the pack.
let existing = { entries: {} };
try { existing = JSON.parse(readFileSync(OUT_PATH, 'utf8')); } catch { /* first run */ }

const pack = {
  version: PACK_VERSION,
  generatedAt: new Date().toISOString(),
  provider: result.provider,
  entries: { ...(existing.entries ?? {}), ...result.entries },
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(pack, null, 2)}\n`);
console.log(`\x1b[32m✓ wrote ${OUT_PATH}\x1b[0m (${Object.keys(pack.entries).length} entries total)`);
console.log('\nReview the diff before committing — this is user-facing copy.');
