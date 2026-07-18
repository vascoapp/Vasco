#!/usr/bin/env node
// =============================================================================
// OTA-UPDATE PREFLIGHT (R120)
// =============================================================================
// Run this BEFORE every `eas update --channel production` push. Faster than
// the full preflight.mjs (which is for native builds) — only catches the
// bug classes that have actually shipped this week:
//
//   1. TS errors in src/ or app/                      (R*)
//   2. Locale JSONs not parseable                     (R*)
//   3. t('key', 'fallback') where key is missing
//      from en.json                                    (R111, R113, R116, R118)
//   4. Unconditional top-level SEED_/MOCK_/DEMO_
//      arrays in app/ that aren't gated by
//      DEMO_MODE or useSeedData                        (R113, R114, R119#13)
//   5. {{var}} interpolations in i18n values whose
//      variable name doesn't match the call site       (R118 notifications fix)
//
// Target runtime: <5s on a clean checkout. Fail-fast — non-zero exit if
// any check fails.
//
// Usage:
//   node scripts/ota-preflight.mjs
//   node scripts/ota-preflight.mjs --skip-tsc    (faster, skip tsc step)
//   npm run ota-preflight             (after adding to package.json)
// =============================================================================

const ARGS = new Set(process.argv.slice(2));
const SKIP_TSC = ARGS.has('--skip-tsc');

import { readFile, readdir, stat } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'];
const PRIMARY_LOCALE = 'en';
const LOCALE_DIR = join(ROOT, 'src', 'i18n', 'locales');

const SCAN_DIRS = [join(ROOT, 'src'), join(ROOT, 'app')];
const SKIP_DIRS = new Set([
  'node_modules', '__tests__', '__mocks__', '.next', '.expo', 'dist',
  'build', 'ios', 'android', '.git',
]);

// SEED/MOCK arrays that are EXPECTED to live unconditionally (utility
// fixtures imported into AppState behind a DEMO_MODE check).
const SEED_ARRAY_ALLOWLIST = new Set([
  // empty arrays are always fine; the actual gate lives at the consumer
]);

let errorCount = 0;
let warnCount = 0;
const errors = [];

function err(msg) {
  errorCount++;
  errors.push(`  ❌ ${msg}`);
}
function warn(msg) {
  warnCount++;
  errors.push(`  ⚠️  ${msg}`);
}

// ---------------------------------------------------------------------------
// CHECK 1: TypeScript clean
// ---------------------------------------------------------------------------
function checkTypeScript() {
  process.stdout.write('1. tsc --noEmit ... ');
  if (SKIP_TSC) {
    console.log('skipped (--skip-tsc)');
    return;
  }
  try {
    execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe' });
    console.log('✓');
  } catch (e) {
    console.log('✗');
    const out = e.stdout?.toString() || e.message;
    // Show only app/src errors; ignore stray test/node_modules noise
    const filtered = out.split('\n').filter(l => /^(app|src)\//.test(l)).slice(0, 10);
    err(`TypeScript errors:\n${filtered.map(l => `       ${l}`).join('\n')}`);
  }
}

// ---------------------------------------------------------------------------
// CHECK 2: Locale JSONs parse + en.json is the source of truth
// ---------------------------------------------------------------------------
async function loadLocale(loc) {
  const path = join(LOCALE_DIR, `${loc}.json`);
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

let primaryLocale = null;

async function checkLocaleJson() {
  process.stdout.write('2. locale JSONs parse ... ');
  let ok = true;
  for (const loc of LOCALES) {
    try {
      const json = await loadLocale(loc);
      if (loc === PRIMARY_LOCALE) primaryLocale = json;
    } catch (e) {
      ok = false;
      err(`${loc}.json: ${e.message}`);
    }
  }
  console.log(ok ? '✓' : '✗');
}

// ---------------------------------------------------------------------------
// CHECK 3: t('key', 'fallback') — key must exist in en.json
// ---------------------------------------------------------------------------
async function* walkFiles(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkFiles(full);
    } else if (e.isFile() && /\.(tsx?|jsx?)$/.test(e.name) && !/\.(test|spec)\.(tsx?|jsx?)$/.test(e.name)) {
      yield full;
    }
  }
}

function hasNested(obj, dotted) {
  let cur = obj;
  for (const p of dotted.split('.')) {
    if (!cur || typeof cur !== 'object' || !(p in cur)) return false;
    cur = cur[p];
  }
  return true;
}

// Match t('foo.bar', 'fallback...') and t("foo.bar", "fallback...")
// Skip t(field.i18nKey, ...) — dynamic keys can't be statically checked.
const T_CALL_RE = /\bt\(\s*['"]([a-z][a-zA-Z0-9_.]*)['"]\s*,/g;

async function checkMissingI18nKeys() {
  process.stdout.write('3. i18n keys referenced ⊆ en.json ... ');
  if (!primaryLocale) {
    console.log('skip (en.json not loaded)');
    return;
  }
  const missing = new Map(); // key -> [files...]
  for (const dir of SCAN_DIRS) {
    for await (const file of walkFiles(dir)) {
      const text = await readFile(file, 'utf8');
      T_CALL_RE.lastIndex = 0;
      for (const m of text.matchAll(T_CALL_RE)) {
        const key = m[1];
        // i18next plurals: t('x', { count }) resolves to x_one / x_other and the
        // base key need not exist (see customers.trackersCompleted). Treat a key
        // as present if any of its plural forms is. Without this the checker
        // blocks correct code — it flagged invoices.pendingApproval after that
        // key was converted from the "offerte(s)" hack to proper plurals.
        const PLURAL_SUFFIXES = ['_one', '_other', '_zero', '_two', '_few', '_many'];
        const present = hasNested(primaryLocale, key)
          || PLURAL_SUFFIXES.some((sfx) => hasNested(primaryLocale, key + sfx));
        if (!present) {
          if (!missing.has(key)) missing.set(key, []);
          missing.get(key).push(relative(ROOT, file));
        }
      }
    }
  }
  if (missing.size === 0) {
    console.log('✓');
  } else {
    console.log(`✗ (${missing.size} missing)`);
    const top = [...missing.entries()].slice(0, 12);
    for (const [k, files] of top) {
      err(`Missing i18n key: ${k}  (used in ${files[0]}${files.length > 1 ? ` +${files.length - 1}` : ''})`);
    }
    if (missing.size > 12) err(`...and ${missing.size - 12} more missing keys`);
  }
}

// ---------------------------------------------------------------------------
// CHECK 4: Unconditional SEED_/MOCK_ arrays in app/
//
// Match files like:
//   const SEED_TRACKERS: TrackerData[] = [ {...}, {...} ];
// and verify the file ALSO imports DEMO_MODE / USE_SEED_DATA / useSeedData,
// OR the array literal is empty []. Empty arrays are always safe.
// ---------------------------------------------------------------------------
async function checkSeedArrays() {
  process.stdout.write('4. SEED_/MOCK_ arrays in app/ are gated or empty ... ');
  const appDir = join(ROOT, 'app');
  const offenders = [];
  for await (const file of walkFiles(appDir)) {
    const text = await readFile(file, 'utf8');
    // Top-level const SEED_/MOCK_/DEMO_X: Type[] = [
    const matches = [...text.matchAll(/^const\s+(SEED|MOCK|DEMO|SAMPLE|FAKE)_([A-Z_]+)\s*(?::[^=]+)?=\s*\[([^\]]*)\]/gm)];
    for (const m of matches) {
      const arrayBody = m[3].trim();
      const isEmpty = arrayBody.length === 0 || /^\s*$/.test(arrayBody);
      if (isEmpty) continue; // empty is safe
      const name = `${m[1]}_${m[2]}`;
      if (SEED_ARRAY_ALLOWLIST.has(name)) continue;
      const gated = /\b(DEMO_MODE|USE_SEED_DATA|useSeedData)\b/.test(text);
      if (!gated) {
        offenders.push({ file: relative(ROOT, file), name });
      }
    }
  }
  if (offenders.length === 0) {
    console.log('✓');
  } else {
    console.log(`✗ (${offenders.length})`);
    for (const o of offenders) {
      err(`Unconditional seed array: ${o.name}  in ${o.file}`);
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 5: {{var}} interpolation mismatches
//
// If en.json has "{{hours}}h ago" but every caller passes {count: N},
// the placeholder never resolves. Cross-check {{X}} placeholders against
// the call sites we can find.
// ---------------------------------------------------------------------------
function flattenJson(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenJson(v, full, out);
    } else if (typeof v === 'string') {
      out[full] = v;
    }
  }
  return out;
}

// Parse t(...) calls with a brace/paren/string-aware scanner. The old regex
// (`{ ([^}]*) }` + `ident:` only) false-flagged every ES6 shorthand opts
// (`{ count }`), every nested object literal (`t('k', { d: f(x, { a }) })`),
// and spreads. We now tokenize the real argument list instead.
const T_CALL_START_RE = /\bt\(/g;

// Parse a JS string literal at the opening quote. Returns {value,end} or null
// (templates containing ${...} return null — can't be read statically).
function parseStringLiteral(text, i) {
  const q = text[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let s = '';
  for (let j = i + 1; j < text.length; j++) {
    const c = text[j];
    if (c === '\\') { const map = { n: '\n', t: '\t', r: '\r' }; const n = text[j + 1]; s += map[n] !== undefined ? map[n] : n; j++; continue; }
    if (c === q) return { value: s, end: j };
    if (q === '`' && c === '$' && text[j + 1] === '{') return null;
    s += c;
  }
  return null;
}

// Return the index of the closing quote/backtick of the literal starting at i,
// correctly skipping over ${ ... } interpolations (which may nest braces,
// parens and further literals). Depth-safe — used by the scanners below so a
// template literal inside an opts object can't corrupt brace counting.
function skipLiteralEnd(text, i) {
  const q = text[i];
  let j = i + 1;
  while (j < text.length) {
    const c = text[j];
    if (c === '\\') { j += 2; continue; }
    if (q === '`' && c === '$' && text[j + 1] === '{') {
      j += 2; let d = 1;
      while (j < text.length && d > 0) {
        const cc = text[j];
        if (cc === '\\') { j += 2; continue; }
        if (cc === "'" || cc === '"' || cc === '`') { j = skipLiteralEnd(text, j) + 1; continue; }
        if (cc === '{') d++;
        else if (cc === '}') d--;
        j++;
      }
      continue;
    }
    if (c === q) return j;
    j++;
  }
  return text.length - 1;
}

// Split a call's argument list (starting just after '(') into top-level arg
// source strings, respecting nested (), {}, [] and string/template literals.
function parseCallArgs(text, openParen) {
  const args = [];
  let depth = 0, cur = '';
  for (let j = openParen + 1; j < text.length; j++) {
    const c = text[j];
    if (c === "'" || c === '"' || c === '`') {
      const end = skipLiteralEnd(text, j);
      cur += text.slice(j, end + 1); j = end; continue;
    }
    if (c === '(' || c === '{' || c === '[') { depth++; cur += c; continue; }
    if (c === ')' || c === '}' || c === ']') {
      if (c === ')' && depth === 0) { if (cur.trim()) args.push(cur.trim()); return { args, end: j }; }
      depth--; cur += c; continue;
    }
    if (c === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return { args, end: -1 };
}

// Top-level property names from an object-literal source '{ a: 1, b, ...c }'.
// Handles long-form, shorthand, spread and computed keys (latter two => skip).
function objectKeys(src) {
  const inner = src.slice(src.indexOf('{') + 1, src.lastIndexOf('}'));
  const keys = new Set();
  let hasSpreadOrComputed = false, depth = 0, tokenStart = 0;
  const parts = [];
  for (let j = 0; j < inner.length; j++) {
    const c = inner[j];
    if (c === "'" || c === '"' || c === '`') { j = skipLiteralEnd(inner, j); continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push(inner.slice(tokenStart, j)); tokenStart = j + 1; }
  }
  parts.push(inner.slice(tokenStart));
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    if (p.startsWith('...') || p.startsWith('[')) { hasSpreadOrComputed = true; continue; }
    const m = p.match(/^([a-zA-Z_$][\w$]*)/);
    if (m) keys.add(m[1]);
  }
  return { keys, hasSpreadOrComputed };
}

async function checkInterpolationMismatch() {
  process.stdout.write('5. {{var}} interpolation matches call sites ... ');
  if (!primaryLocale) { console.log('skip'); return; }
  const flat = flattenJson(primaryLocale);
  const mismatches = [];
  for (const dir of SCAN_DIRS) {
    for await (const file of walkFiles(dir)) {
      const text = await readFile(file, 'utf8');
      T_CALL_START_RE.lastIndex = 0;
      for (const m of text.matchAll(T_CALL_START_RE)) {
        const open = m.index + m[0].length - 1; // index of '('
        const { args } = parseCallArgs(text, open);
        if (args.length < 2) continue;
        if (!/^['"]/.test(args[0])) continue; // dynamic key — can't check
        const keyParsed = parseStringLiteral(args[0], 0);
        if (!keyParsed) continue;
        const key = keyParsed.value;
        if (!/^[a-z][a-zA-Z0-9_.]*$/.test(key)) continue;
        const value = flat[key];
        if (!value) continue; // missing key — covered by check 3
        const placeholders = [...value.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)].map(p => p[1]);
        if (placeholders.length === 0) continue;
        // Only verify calls that actually pass an opts object — matches the
        // original check's scope. (Calls whose value has {{x}} but pass no opts
        // are a separate, pre-existing class not gated here.)
        const last = args[args.length - 1];
        if (!last.startsWith('{')) continue;
        const parsed = objectKeys(last);
        if (parsed.hasSpreadOrComputed) continue; // can't statically verify
        const callerKeys = parsed.keys;
        callerKeys.delete('defaultValue');
        for (const ph of placeholders) {
          if (!callerKeys.has(ph)) {
            mismatches.push({ key, placeholder: ph, value, caller: relative(ROOT, file), callerKeys: [...callerKeys] });
          }
        }
      }
    }
  }
  if (mismatches.length === 0) {
    console.log('✓');
  } else {
    console.log(`✗ (${mismatches.length})`);
    for (const mm of mismatches.slice(0, 8)) {
      err(`i18n placeholder mismatch: key='${mm.key}' wants {{${mm.placeholder}}}, caller passes {${mm.callerKeys.join(', ')}}  in ${mm.caller}`);
    }
    if (mismatches.length > 8) err(`...and ${mismatches.length - 8} more mismatches`);
  }
}

// ---------------------------------------------------------------------------
// RUN
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 6. No raw entity-id fallbacks in user- or customer-facing strings
// ---------------------------------------------------------------------------
// This bug class appeared in NINE separate producers during the 2026-07-18 e2e
// sweep, twice in text sent to CUSTOMERS over WhatsApp ("Herinnering: factuur
// inv-seed-1 …", "Hi cust-003, we've started work on …"). The shape is always
// a resolution chain that bottoms out at the row id:
//     customerName: cust?.name || j.customerId || ''
//     const invRef = inv.reference || inv.id
// The id belongs in its own field; display copy should degrade to a human
// label or to blank — never to an id.

// Fields whose value is rendered or sent. A `|| x.id` tail on one of these is
// the bug; the same tail on a lookup key or a React `key=` prop is fine.
const DISPLAY_FIELD_RE =
  /\b(title|subtitle|description|label|customerName|name|message|body|template|shareText|reason|heading|caption|placeholder)\s*:/;
const ID_FALLBACK_RE = /(?:\|\||\?\?)\s*[A-Za-z_$][\w$]*(?:\?)?\.(id|customerId|jobId|quoteId|invoiceId)\b/;

// Deliberate, reviewed exceptions — an id IS the useful handle here.
const ID_FALLBACK_ALLOWLIST = [
  'quoteToInvoice.notFound',   // error state; the id helps support
  'besparen.materialFallback', // only handle when a material name is missing
  'action.defectClosed',       // the defect id is the user-facing reference
];

async function checkRawIdFallbacks() {
  process.stdout.write('6. no raw entity-id fallbacks in display strings ... ');
  const hits = [];
  for (const dir of SCAN_DIRS) {
    for await (const file of walkFiles(dir)) {
      const text = await readFile(file, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!ID_FALLBACK_RE.test(line)) continue;
        if (!DISPLAY_FIELD_RE.test(line) && !line.includes('t(')) continue;
        if (ID_FALLBACK_ALLOWLIST.some((a) => line.includes(a))) continue;
        hits.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 100)}`);
      }
    }
  }
  if (hits.length === 0) {
    console.log('\u2713');
  } else {
    console.log(`\u2717 (${hits.length})`);
    for (const h of hits.slice(0, 12)) {
      err(`Raw id can reach display copy: ${h}`);
    }
    if (hits.length > 12) err(`...and ${hits.length - 12} more`);
  }
}

async function main() {
  console.log('OTA-update preflight\n');
  const t0 = Date.now();
  checkTypeScript();
  await checkLocaleJson();
  await checkMissingI18nKeys();
  await checkSeedArrays();
  await checkInterpolationMismatch();
  await checkRawIdFallbacks();
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('');
  if (errorCount === 0 && warnCount === 0) {
    console.log(`✅ All checks passed in ${dt}s — safe to \`eas update\``);
    process.exit(0);
  }
  for (const line of errors) console.log(line);
  console.log(`\nFinished in ${dt}s  ·  ${errorCount} error(s), ${warnCount} warning(s)`);
  if (errorCount > 0) {
    console.log('\n❌ Blocked. Fix the errors above before pushing an OTA update.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
