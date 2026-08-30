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
/**
 * Remove // and block comments, respecting string literals.
 *
 * Without this, a comment inside an options object is split on its own commas
 * and each fragment's first word is read as a KEY. A real call site annotated
 *   t('projectBilling.invoicedOf', {
 *     // Derived, not `project.totalInvoiced`: nothing maintains it, so ...
 *     invoiced: ..., total: ...,
 *   })
 * was reported as passing `{not, so, total}` and missing `{{invoiced}}` — the
 * prose swallowed the key that followed it. A gate that reports a correct call
 * site as broken is how gates get ignored, so the checker is fixed rather than
 * the comment moved.
 */
function stripComments(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') {
      const end = skipLiteralEnd(s, i);
      out += s.slice(i, end + 1);
      i = end;
      continue;
    }
    if (c === '/' && s[i + 1] === '/') {
      const nl = s.indexOf('\n', i);
      if (nl === -1) break;
      i = nl - 1;
      out += '\n';
      continue;
    }
    if (c === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 1;
      out += ' ';
      continue;
    }
    out += c;
  }
  return out;
}

function objectKeys(src) {
  const inner = stripComments(src.slice(src.indexOf('{') + 1, src.lastIndexOf('}')));
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


// ---------------------------------------------------------------------------
// 7. No hand-rolled currency formatting on contractor-facing surfaces
// ---------------------------------------------------------------------------
// `€${x.toFixed(2)}` forces a PERIOD decimal separator, which is wrong in
// nl/de/fr/es/it — the VAT-prep screen showed "€270.74" next to "€150,00"
// elsewhere, on the screen a contractor copies into the Belastingdienst
// portal. A hardcoded symbol is also wrong for UK (£) and US ($).
// Use formatCurrency / formatCurrency0 / compactCurrency from src/i18n/formatting.
//
// The enterprise surfaces (hub screens, CFO/director dashboards and the
// generators scoped to those roles) are deliberately excluded: they are a
// UK-oriented product where a fixed £ is intentional, not a locale bug.
// TWO shapes, because for a long time this only matched the first one and the
// JSX form is the commoner one in this codebase — 42 sites were invisible to a
// green check, incl. 8 on the Facturen tab and 2 on the photo->quote path:
//   1. template literal   `€${x.toFixed(2)}`   /  `€${x.toLocaleString()}`
//   2. JSX                 €{x.toLocaleString()}  /  {'€'}{x.toFixed(2)}
// `toLocaleString()` with no locale argument formats in the DEVICE locale, so
// a contractor whose phone is set to English reads "1,234.56" on a Dutch
// screen; passing i18n.language is no better, since the app locale and the
// contractor's COUNTRY are separate (an English-speaking NL contractor still
// bills in €1.234,56). Only formatCurrency/formatCurrency0/compactCurrency,
// which take the country, are correct.
// Kept as two explicit alternatives rather than one clever one: a combined
// `[€£$]\s*(?:\$\{|\{)` also matches a bare `${x.toFixed(2)}`, because the `$`
// of the interpolation satisfies the currency class — that fired on 190 lines
// with no currency symbol at all.
// Round 3 widened it twice more, both found by sites the green check missed:
//   a. the symbol can be UNICODE-ESCAPED — `€${amount.toLocaleString()}`
//      is the same bug as `€${...}` but the literal-char class never saw it
//      (it hid the Geld card's overdue metric and ~30 generator/report sites);
//   b. the number needs no .toFixed/.toLocaleString call at all — `€{price}`
//      on a RAW number is worse, not better (no grouping, full float tail:
//      "€1234.5666"). Requiring a format call made those invisible too.
// So the shapes are now "currency symbol immediately followed by an
// interpolation", in either template or JSX form, formatted or not.
const CURRENCY_TEMPLATE_RE = /(?:[€£]|\\u20AC|\\u00A3)\s*\$\{|\$\$\{/;
const CURRENCY_JSX_RE =
  /(?:[€£]|\{\s*'(?:\\u20AC|€|£|\$)'\s*\})\s*\{[^}]*\}/;
const CURRENCY_FMT_RE = {
  test: (line) => CURRENCY_TEMPLATE_RE.test(line) || CURRENCY_JSX_RE.test(line),
};
const CURRENCY_EXEMPT_PATHS = [
  // Enterprise surfaces: a UK-oriented product where a fixed £ is intentional.
  'app/hub/',
  'src/components/dashboards/',
  // Generators scoped to cfo/director/coo roles (see generators/index.ts).
  'src/intelligence/generators/valueDeliveryGenerator',
  'src/intelligence/generators/approvalBottleneckGenerator',
  'src/intelligence/generators/projectRiskScoreGenerator',
  'src/intelligence/generators/crossProjectRiskGenerator',
  'src/intelligence/generators/handoverBottleneckGenerator',
  'src/intelligence/generators/portfolioIRRGenerator',
  // Defines the per-country formats themselves.
  'src/modules/countryModules',
  // FILING FORMATS — deliberately stable and machine-readable. Locale-
  // formatting these would change a document the contractor submits; the
  // icpAangifte test asserts the exact "€1000.00" shape.
  'src/services/vatPrepExportService',
  'src/services/icpAangifteService',
  // US-market surfaces (R74/R87/R90): formatUsd and the USD office bot are
  // explicitly dollar-denominated, not a missed locale.
  'app/contractor/pipeline',
  'src/services/aiCommandService',
  // Already locale-aware via its own `cur` symbol resolved per locale.
  'src/services/lateFeeService',
  // Demo/aannemer-gated approval notes (see quote-approval gating).
  'src/services/quoteApprovalService',
  // VASCO'S OWN subscription pricing, not the contractor's money. The tier
  // prices in subscriptionService are single EUR numbers with no per-country
  // variant, so formatting them by contractor country would invent a £39 /
  // $39 tier that nobody can actually be billed. Changing this is a pricing
  // decision, not a locale fix.
  'app/contractor/profile',
];

async function checkManualCurrency() {
  process.stdout.write('7. no hand-rolled currency on contractor surfaces ... ');
  const hits = [];
  for (const dir of SCAN_DIRS) {
    for await (const file of walkFiles(dir)) {
      const rel = relative(ROOT, file);
      if (CURRENCY_EXEMPT_PATHS.some((x) => rel.includes(x))) continue;
      const text = await readFile(file, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        if (CURRENCY_FMT_RE.test(line)) {
          hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      }
    }
  }
  if (hits.length === 0) {
    console.log('\u2713');
  } else {
    console.log(`\u2717 (${hits.length})`);
    for (const h of hits.slice(0, 15)) err(`Hand-rolled currency: ${h}`);
    if (hits.length > 15) err(`...and ${hits.length - 15} more`);
  }
}

// ---------------------------------------------------------------------------
// CHECK 8: no untranslated locale VALUES ("parity != translated")
// ---------------------------------------------------------------------------
// i18n:audit compares key PRESENCE and reports 0 missing; the OTA preflight's
// check 3 only proves referenced ⊆ en.json. Neither can see that a value was
// never translated. That blind spot let TEN whole namespaces ship as English to
// de/fr/es/it — including customerView, the page the CUSTOMER reads to accept a
// quote. This check closes it: flag any value byte-identical to en.
//
// Signal vs noise: plenty of strings are legitimately identical (Total, Email,
// IBAN, SIRET, brand names, pure-format strings). Those are allowlisted below
// with a reason, so a NEW identical value is a real finding rather than noise.

// Values that are correct as-is in at least one target language. Compared
// case-sensitively against the en value.
const SAME_WORD_OK = new Set([
  // ── Dutch shares these with English (added when nl stopped being exempt
  //    from this check). Legal/entity identifiers MUST NOT be translated;
  //    the rest are ordinary Dutch loanwords in trade/business use.
  'Project', 'Later', 'Postcode', 'Camera', 'Stop', 'Week', 'Open', 'Inbox',
  'Checklist', 'Product', 'Chat', 'Percentage', 'Water', 'Code', 'Storm',
  'Complex', 'Premium', 'Deadline', 'Factoring', 'Dispatch', 'Conflict',
  'Gas / HVAC', 'Lead', 'Lead scoring', 'Download PDF', 'Quick wins: {{suppliers}}',
  'Account & privacy', 'Data Intelligence', 'Vasco business intelligence',
  'IBAN match', 'Planning Tools', 'items', 'Items', 'orders', 'Sale',
  // Legal forms, tax ids and standards — translating these would be WRONG,
  // not merely lazy: they are the literal registered terms.
  'EIRL', 'SARL', 'S.L.', 'S.A.', 'S.r.l.', 'S.n.c.', 'S-Corp', 'USt-IdNr.',
  // Tax identifiers named after their own country's scheme. "NIF / CIF" is
  // Spanish and "Partita IVA" is Italian in EVERY locale — a German reading
  // the Spanish field wants to see the term Spain actually uses, because that
  // is what is printed on the document they are looking for. Translating them
  // would be actively wrong, not lazy.
  'NIF / CIF', 'Partita IVA',
  // Genuinely the same word in French as in English.
  'Province',
  'SIRET', 'Partita IVA', 'Codice Fiscale', 'IBAN', 'BIC / SWIFT', 'RAMS',
  'LTIR', 'GoBD Audit-Trail', 'Vasco GoBD audit trail',
  'KOR — Kleineondernemersregeling', 'Kleinunternehmer (§19 UStG)',
  'State license #', 'Routing number', 'Secret key', 'Stripe Payments',
  'WhatsApp', 'Excel/CSV', 'Push', 'iDEAL & Mollie', 'Contractor',
  // Brand names.
  'Vasco Analyst', 'Vasco Finance', 'Vasco Engine', 'Vasco Queue',
  // Same word in Dutch, with interpolation around it.
  'Test onboarding', '+{{trend}}% trend', '1 week', 'Account: {{id}}',
  'Claims', 'Week {{n}}', '→ week {{week}}',
  // words English shares with de/fr/es/it in this domain
  'Total', 'Subtotal', 'Email', 'Date', 'Description', 'Notes', 'Photos',
  'Photo', 'Client', 'Status', 'Team', 'Standard', 'Budget', 'Material',
  'Installation', 'Excellent', 'Active', 'Legal', 'Error', 'Formal',
  'General', 'Support', 'Performance', 'Account', 'Radius', 'Filter', 'Info',
  'Optional', 'Details', 'Impact', 'Urgent', 'URGENT', 'Important', 'Options',
  'Attention', 'Stable', 'Confirmation', 'Certifications', 'Licences',
  'Inspection', 'Incident', 'Incidents', 'Observation', 'Observations',
  'Documents', 'Type', 'zones', 'Trend', 'Median', 'Winter', 'Manual',
  'Personal', 'PLAN', 'Notifications', 'Signatures', 'Timer', 'Feedback',
  'Follow-up', 'Start', 'Benchmarking', 'Stock', 'Cashflow', 'Compliance',
  'En route', 'Auto-entrepreneur', 'Simple', 'Actions', 'actions', 'photos',
  // ── Trade catalogue words that are genuinely the same in the target
  //    language. Verified against the SURROUNDING namespace, not by eye: every
  //    other German consumable is real German (Kreppband, Klebeband,
  //    Grundierfarbe, Haftgrund), which is exactly how "Primer" was caught as
  //    a real miss there and fixed to "Grundierung". nl keeps "Primer" because
  //    it already uses Grondverf/Voorstrijk for the neighbouring terms, and it
  //    keeps "Primer" in Italian because it.json's own bondingPrimer is
  //    "Primer aggrappante".
  'Primer', 'Tape', 'point',
  // Material, finish and style names identical in fr/es/it. "Shaker" is a
  // furniture style (a proper noun); the rest are true cognates.
  'Shaker', 'Quartz', 'Chrome', 'Induction', 'Programmable',
  'Premium (Farrow & Ball, Little Greene)',
  // Quantity strings whose only word is already correct: French uses "litres"
  // and "zones", Spanish "material", French "action(s)".
  '100 litres', '150 litres', '200 litres', '300 litres',
  '2 zones', '3 zones', '4 zones', '5 zones',
  '{{count}} action', '{{count}} actions', '{{count}} material',
  'Name', 'Name *', 'Contacts', 'Pipeline', 'Leads', 'Live', 'Normal',
  'Planning', 'Incidents (total)', 'Articles ({{count}})', 'Password',
  // interpolated strings whose only word is already correct in the target
  // language: "Feedback"/"Material" (de/it/es), "photo(s)" (fr), "d" = días (es)
  'Feedback: {{customer}}', 'Material {{id}}', '{{count}} photo',
  '{{count}} photos', '+{{days}}d · {{prob}}%',
  // acronyms, legal/registration terms, brand and product names
  'IBAN', 'BIC / SWIFT', 'SIRET', 'Partita IVA', 'USt-IdNr.', 'Codice Fiscale',
  'EIRL', 'SARL', 'S.L.', 'S.A.', 'S.r.l.', 'S.n.c.', 'S-Corp', 'LTIR', 'RAMS',
  'WhatsApp', 'Stripe Payments', 'Excel/CSV', 'Solar / PV', 'litre', 'container',
  'API + white-label', 'Kleinunternehmer (§19 UStG)',
  'KOR — Kleineondernemersregeling', 'GoBD Audit-Trail',
  'Vasco GoBD audit trail', 'Vasco Analyst', 'Vasco Finance', 'Vasco Engine',
  'Vasco Queue',
  // Loanwords carried unchanged into de/fr/es/it in this domain. "Factoring" is
  // the actual financial term in DE/ES/IT (not "Forderungsverkauf" in trade
  // usage); "Chat" and "Text" are the ordinary German/French words; French
  // spells "Suggestions" and "Optimisations" identically to English.
  'Factoring', 'Chat', 'Text', 'Suggestions', 'Optimisations ({{count}})',
  // Handover wizard step, one of five labels sharing a narrow strip. "Checklist"
  // is the ordinary trade word in fr/es/it; the native forms ("liste de
  // contrôle", "lista de control", "lista di controllo") do not fit and are not
  // what a site manager says.
  'Checklist',
  // Notification channel, shown as a tiny uppercase column beside EMAIL/SMS.
  // "Push" is the ordinary term in all five target languages; the descriptive
  // forms ("Pushmelding", "Push-Nachricht", "Notification push") do not fit
  // that column and are not what a tradesperson calls it.
  'Push',
  // Two product names. iDEAL is the Dutch bank-transfer scheme and Mollie is
  // the PSP — neither is translated anywhere.
  'iDEAL & Mollie',
  // Pricebook tiers: "Premium" and "POPULAR" are the same word in every target
  // language here. The neighbouring tiers ("Basis"/"Base", "Standard") do
  // differ and are translated.
  'Premium', 'POPULAR',
  // Asset categories: French spells 'Ventilation' and Spanish 'Exterior'
  // exactly as English. Their neighbours in the same list (Chauffage, Tejado,
  // Riscaldamento…) do differ and are translated.
  'Ventilation', 'Exterior',
  // 'Code' is the same word in German and French, and it is the label on an
  // authority's verbatim rejection code (SDI scarto, FACe).
  'Code',
  // de: the German word for material is 'Material'.
  'Material',
]);

// Catalogue options that NAME a manufacturer or a shop. A brand is spelled the
// same in every market — a "translated" Daikin is a different product, and
// IKEA is IKEA in Venlo and in Köln. These keys are exempt from the
// same-as-English check; the words AROUND them are not (de "Einstieg (Beko,
// Candy)" is still expected to differ from en "Budget (Beko, Candy)").
const BRAND_VALUE_KEYS = /^decisionCatalog\.items\.(item_boiler_brand|item_hp_brand|item_smart_home|item_reno_kitchen_supplier|item_reno_appliance_pkg)\.options\./;

// Namespaces whose locale values are DEAD CODE — never rendered, so an English
// value there is not a bug. workflowPackService.pickTemplateForLocale resolves
// `defaults[locale]` FIRST and ships de/fr/es/it copy for all 23 steps, so the
// i18n keys are a legacy fallback that never wins.
const DEAD_VALUE_NAMESPACES = new Set(['workflowPacks']);

// A value carrying no translatable words: only placeholders, digits, currency
// symbols and punctuation (e.g. '{{count}}×', ' (€{{amt}})', '10 min').
function isFormatOnly(v) {
  return /^[\s\d\p{P}\p{S}]*(\{\{\w+\}\}[\s\d\p{P}\p{S}]*)*(min|h|d|g|j|T|x)?[\s\d\p{P}\p{S}]*$/u.test(v);
}

async function checkUntranslatedValues() {
  process.stdout.write('8. locale values are translated, not copied from en ... ');
  const en = primaryLocale ?? (await loadLocale(PRIMARY_LOCALE));
  const flat = (obj, prefix = '', out = {}) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object') flat(v, key, out);
      else if (typeof v === 'string') out[key] = v;
    }
    return out;
  };
  const flatEn = flat(en);
  const hits = [];
  for (const loc of LOCALES) {
    // nl was skipped here on the theory that it is "hand-authored alongside
    // en". That exempted the PRIMARY MARKET's language from the only check
    // that asks whether a value was actually translated — and it was hiding
    // `aiChat.title = "Office manager"`, the header of a screen whose own body
    // text calls itself "je kantoorhulp". Dutch is checked like every other
    // locale now.
    if (loc === PRIMARY_LOCALE) continue;
    const flatLoc = flat(await loadLocale(loc));
    for (const [k, v] of Object.entries(flatLoc)) {
      if (flatEn[k] !== v) continue;
      if (v.length <= 3) continue;
      if (SAME_WORD_OK.has(v)) continue;
      if (DEAD_VALUE_NAMESPACES.has(k.split('.')[0])) continue;
      if (BRAND_VALUE_KEYS.test(k)) continue;
      if (isFormatOnly(v)) continue;
      hits.push(`${loc} ${k} = ${JSON.stringify(v)}`);
    }
  }
  if (hits.length === 0) {
    console.log('✓');
  } else {
    console.log(`✗ (${hits.length})`);
    for (const h of hits.slice(0, 15)) err(`Untranslated value: ${h}`);
    if (hits.length > 15) err(`...and ${hits.length - 15} more`);
  }
}

// ---------------------------------------------------------------------------
// CHECK 9: no currency symbol baked into a locale VALUE
// ---------------------------------------------------------------------------
// Check 7 only sees source files, so it cannot see "€{{amount}} outstanding"
// sitting in en/nl/de/fr/es/it.json. 51 keys did — including the WhatsApp
// invoice reminder and quote follow-up a CUSTOMER receives, the EVE queue
// impact lines, and the late-fee description. A UK contractor chasing £2,450
// sent a message that said €2,450, and no amount of correct formatting at the
// call site could fix it: the symbol was in the sentence, not the number.
//
// The rule: the LOCALE owns the words, the FORMATTER owns the money. A value
// may not put a currency symbol next to a placeholder — pass a formatted
// amount (formatMoney / formatMoney2 / formatCurrency0) in instead. Nor may it
// hardcode a unit label "(€)" over an input: pass currencySymbol().
//
// A symbol NOT adjacent to a placeholder is fine and deliberately not matched
// — "turnover above €20.000" is the KOR/Kleinunternehmer threshold, a fact
// about NL/DE tax law rather than a formatting decision.
const LOCALE_CURRENCY_ADJACENT_RE = /[€£$][   ]{0,2}\{\{|\}\}[   ]{0,2}[€£$]/;
const LOCALE_CURRENCY_UNIT_RE = /\(\s*[€£$]\s*\)/;
// Keys where a fixed symbol is correct because the FEATURE is single-market.
const LOCALE_CURRENCY_OK = new Map([
  ['pipeline.value', 'US-only leads CRM (R74) — dollars by definition'],
  ['crew.hourlyCost', 'US-only crew dispatch (R87) — dollars by definition'],
]);

async function checkCurrencyInLocaleValues() {
  process.stdout.write('9. no currency symbol baked into locale values ... ');
  const hits = [];
  const flat = (obj, prefix = '', out = {}) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object') flat(v, key, out);
      else if (typeof v === 'string') out[key] = v;
    }
    return out;
  };
  for (const loc of LOCALES) {
    const flatLoc = flat(await loadLocale(loc));
    for (const [k, v] of Object.entries(flatLoc)) {
      if (LOCALE_CURRENCY_OK.has(k)) continue;
      if (LOCALE_CURRENCY_ADJACENT_RE.test(v) || LOCALE_CURRENCY_UNIT_RE.test(v)) {
        hits.push(`${loc} ${k} = ${JSON.stringify(v).slice(0, 100)}`);
      }
    }
  }
  if (hits.length === 0) {
    console.log('✓');
  } else {
    console.log(`✗ (${hits.length})`);
    for (const h of hits.slice(0, 15)) err(`Currency in locale value: ${h}`);
    if (hits.length > 15) err(`...and ${hits.length - 15} more`);
  }
}

// ---------------------------------------------------------------------------
// 10. Dates and times must follow the CONTRACTOR, not the handset
// ---------------------------------------------------------------------------
// `toLocaleDateString(undefined, …)` / `toLocaleTimeString(undefined, …)` — and
// the no-argument forms — resolve against the DEVICE locale. The app language
// comes from the saved profile, so on any phone whose language differs from the
// contractor's the screen renders in two languages at once: "01:30 PM" above a
// badge reading "3u30", "Jul 26 · 14 dagen te laat" in one string.
//
// It is invisible on a nl-NL handset, which is why 49 of these survived every
// simulator walk. Use formatDate/formatTime/formatDayMonth(date, country) from
// src/i18n/formatting, or the *Auto siblings where `country` is out of reach.
const DEVICE_LOCALE_RE = /\.toLocale(?:Date|Time)String\s*\(\s*(?:undefined\b|\))/;

/**
 * `x.toISOString().split('T')[0]` (or `.slice(0, 10)`) is a UTC calendar day.
 * Every one of the six EU markets is east of Greenwich, so between local
 * midnight and 01:00/02:00 it returns YESTERDAY — and `new Date(2026, 6, 19)`
 * at local midnight formats as the 18th, which shifted every bucket in the
 * weekly planner by a day.
 *
 * 52 of these were swept on 2026-08-19; `src/utils/dateKey.ts` has had the
 * correct helpers (`todayKey`, `localDateKey`) the whole time. This check
 * exists because the shape is one keystroke away from being reintroduced and
 * the failure is a silently-wrong date, never an error.
 *
 * A real INSTANT — created_at, an API timestamp, a sort key — should keep
 * `toISOString()` in full. Only the truncation to a calendar day is flagged.
 */
const UTC_CALENDAR_DAY_RE = /\.toISOString\(\)\s*\.\s*(?:split\(\s*['"]T['"]\s*\)\s*\[0\]|slice\(\s*0\s*,\s*10\s*\))/;

async function checkDeviceLocaleDates() {
  process.stdout.write('10. dates/times follow the contractor, not the device ... ');
  const hits = [];
  // Scoped to the surfaces that ship. `app/hub`, `app/sitelead`, `app/(tabs)`
  // and the portfolio dashboards are the director/CFO/COO surface, which
  // `enterprise_portfolio: false` ships to nobody — blocking an OTA on their
  // date formatting would be a gate on code no contractor can reach.
  // `app/worker` IS in scope: those screens are the aannemer's own crew.
  for (const dir of [
    'app/(contractor)', 'app/contractor', 'app/invoices', 'app/quotes',
    'app/accept', 'app/customer', 'app/worker',
    'src/components/contractor', 'src/components/shared', 'src/components/customer',
    'src/services', 'src/utils', 'src/intelligence',
  ]) {
    for await (const file of walkFiles(dir)) {
      if (!/\.tsx?$/.test(file) || file.includes('__tests__')) continue;
      const src = await readFile(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        const code = line.trim();
        // Comments describing the rule are not violations of it.
        if (code.startsWith('//') || code.startsWith('*')) return;
        if (DEVICE_LOCALE_RE.test(line)) hits.push(`${file}:${i + 1}  ${code.slice(0, 90)}`);
        if (UTC_CALENDAR_DAY_RE.test(line)) {
          hits.push(`${file}:${i + 1}  ${code.slice(0, 90)}   ← UTC day; use localDateKey()/todayKey()`);
        }
      });
    }
  }
  if (hits.length === 0) {
    console.log('✓');
  } else {
    console.log(`✗ (${hits.length})`);
    for (const h of hits.slice(0, 15)) err(`Device-locale date/time: ${h}`);
    if (hits.length > 15) err(`...and ${hits.length - 15} more`);
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
  await checkManualCurrency();
  await checkUntranslatedValues();
  await checkCurrencyInLocaleValues();
  await checkDeviceLocaleDates();
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
