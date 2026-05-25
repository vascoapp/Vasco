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
        if (!hasNested(primaryLocale, key)) {
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

// Match: t('foo.bar', '...', { count: x, name: y })
// Extracts the object keys (count, name, etc.).
const T_CALL_WITH_OPTS_RE = /\bt\(\s*['"]([a-z][a-zA-Z0-9_.]*)['"]\s*,\s*[^,)]*,\s*\{\s*([^}]*)\}\s*\)/g;
const OPT_KEY_RE = /([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;

async function checkInterpolationMismatch() {
  process.stdout.write('5. {{var}} interpolation matches call sites ... ');
  if (!primaryLocale) { console.log('skip'); return; }
  const flat = flattenJson(primaryLocale);
  const mismatches = [];
  for (const dir of SCAN_DIRS) {
    for await (const file of walkFiles(dir)) {
      const text = await readFile(file, 'utf8');
      T_CALL_WITH_OPTS_RE.lastIndex = 0;
      for (const m of text.matchAll(T_CALL_WITH_OPTS_RE)) {
        const key = m[1];
        const optsBody = m[2];
        const value = flat[key];
        if (!value) continue; // covered by check 3
        const placeholders = [...value.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)].map(p => p[1]);
        if (placeholders.length === 0) continue;
        const callerKeys = new Set([...optsBody.matchAll(OPT_KEY_RE)].map(o => o[1]));
        // 'defaultValue' is a reserved i18next option, ignore it
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
async function main() {
  console.log('OTA-update preflight\n');
  const t0 = Date.now();
  checkTypeScript();
  await checkLocaleJson();
  await checkMissingI18nKeys();
  await checkSeedArrays();
  await checkInterpolationMismatch();
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
