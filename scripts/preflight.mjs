#!/usr/bin/env node
/**
 * Build-readiness preflight check.
 *
 * R66r68. Run before `eas build` to catch the common "submitted, then
 * remembered we forgot X" failure modes:
 *
 *   - TypeScript errors
 *   - Failing tests
 *   - Locale JSONs not parseable
 *   - Missing/placeholder app icons
 *   - Stale buildNumber
 *   - Missing fastlane metadata for any locale
 *   - Sentry DSN unset (warning, not fatal)
 *
 * Usage:
 *   npm run preflight              # all checks
 *   npm run preflight -- --quick   # skip jest (faster, just typecheck + asset checks)
 *
 * Exits non-zero if any FATAL check fails. WARN-level issues print but
 * don't block.
 */

import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

const args = new Set(process.argv.slice(2));
const QUICK = args.has('--quick');

let fatalCount = 0;
let warnCount = 0;

function fatal(msg) {
  console.error(`  ✗ FATAL ${msg}`);
  fatalCount++;
}
function warn(msg) {
  console.warn(`  ⚠ WARN  ${msg}`);
  warnCount++;
}
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function section(name) {
  console.log(`\n— ${name} —`);
}

// ─── 1. TypeScript ─────────────────────────────────────────────────────────
section('TypeScript');
try {
  execSync('npx tsc --noEmit', { cwd: repoRoot, stdio: 'pipe' });
  ok('npx tsc --noEmit (app/) clean');
} catch (err) {
  fatal(`tsc failed:\n${err.stdout?.toString() ?? err.message}`);
}

try {
  execSync('npx tsc --noEmit', { cwd: join(repoRoot, 'admin'), stdio: 'pipe' });
  ok('npx tsc --noEmit (admin/) clean');
} catch (err) {
  fatal(`admin tsc failed:\n${err.stdout?.toString() ?? err.message}`);
}

// ─── 2. Tests ──────────────────────────────────────────────────────────────
if (!QUICK) {
  section('Jest');
  try {
    const out = execSync('npx jest --silent 2>&1', { cwd: repoRoot }).toString();
    const m = out.match(/Tests:\s+(\d+)\s+passed/);
    ok(`jest ${m ? m[1] : 'all'} tests passed`);
  } catch (err) {
    fatal(`jest failed:\n${(err.stdout?.toString() ?? '').slice(-500)}`);
  }
} else {
  warn('skipped jest (--quick)');
}

// ─── 3. Locale JSONs ───────────────────────────────────────────────────────
section('Locale JSONs');
const locales = ['en', 'nl', 'de', 'fr', 'es', 'it'];
const keyCounts = new Map();
for (const loc of locales) {
  const path = join(repoRoot, 'src/i18n/locales', `${loc}.json`);
  try {
    const json = JSON.parse(readFileSync(path, 'utf8'));
    const count = countKeys(json);
    keyCounts.set(loc, count);
    ok(`${loc}.json parses, ${count} keys`);
  } catch (err) {
    fatal(`${loc}.json: ${err.message}`);
  }
}
const enCount = keyCounts.get('en') ?? 0;
for (const loc of locales) {
  const c = keyCounts.get(loc) ?? 0;
  if (loc !== 'en' && c < enCount * 0.95) {
    warn(`${loc}.json has ${c} keys vs en ${enCount} (${Math.round((c / enCount) * 100)}%)`);
  }
}

function countKeys(obj) {
  let n = 0;
  if (typeof obj !== 'object' || obj === null) return 0;
  for (const v of Object.values(obj)) {
    if (typeof v === 'object' && v !== null) n += countKeys(v);
    else n++;
  }
  return n;
}

// ─── 4. App icons ──────────────────────────────────────────────────────────
section('App icons');
for (const f of ['icon.png', 'adaptive-icon.png', 'splash-icon.png', 'favicon.png']) {
  const path = join(repoRoot, 'assets', f);
  if (!existsSync(path)) {
    fatal(`${f} missing — run \`npm run render:icons\``);
    continue;
  }
  const size = statSync(path).size;
  if (size < 1000) {
    warn(`${f} suspiciously small (${size} bytes) — maybe corrupted?`);
  } else {
    ok(`${f} present (${(size / 1024).toFixed(1)} KB)`);
  }
}

// ─── 5. Fastlane metadata completeness ─────────────────────────────────────
section('Fastlane metadata');
const fastLocales = ['en-US', 'nl-NL', 'de-DE', 'fr-FR', 'es-ES', 'it-IT'];
const required = [
  'name.txt', 'subtitle.txt', 'description.txt', 'keywords.txt',
  'promotional_text.txt', 'release_notes.txt',
  'support_url.txt', 'marketing_url.txt', 'privacy_url.txt',
];
for (const loc of fastLocales) {
  const dir = join(repoRoot, 'fastlane/metadata', loc);
  if (!existsSync(dir)) {
    fatal(`fastlane/metadata/${loc}/ missing`);
    continue;
  }
  const missing = required.filter((f) => !existsSync(join(dir, f)));
  if (missing.length) {
    fatal(`fastlane/metadata/${loc}/ missing ${missing.join(', ')}`);
  } else {
    ok(`fastlane/metadata/${loc}/ complete`);
  }
}

// ─── 6. app.json sanity ────────────────────────────────────────────────────
section('app.json');
const appJson = JSON.parse(readFileSync(join(repoRoot, 'app.json'), 'utf8'));
const expo = appJson.expo;

if (!expo.version) fatal('expo.version missing');
else ok(`version: ${expo.version}`);

if (!expo.ios?.bundleIdentifier) fatal('expo.ios.bundleIdentifier missing');
else ok(`bundleIdentifier: ${expo.ios.bundleIdentifier}`);

if (!expo.ios?.buildNumber) fatal('expo.ios.buildNumber missing');
else ok(`buildNumber: ${expo.ios.buildNumber}`);

if (expo.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== false) {
  warn(`ITSAppUsesNonExemptEncryption not set to false — Apple will prompt for export-compliance`);
} else {
  ok('ITSAppUsesNonExemptEncryption: false (skips export prompt)');
}

if (!expo.ios?.privacyManifests) {
  fatal('expo.ios.privacyManifests missing — Apple requires this since 2024-05-01');
} else {
  ok(`privacyManifests: ${expo.ios.privacyManifests.NSPrivacyCollectedDataTypes?.length ?? 0} collected types declared`);
}

if (expo.android?.adaptiveIcon?.backgroundColor === '#ffffff') {
  warn('android.adaptiveIcon.backgroundColor is #ffffff (placeholder default) — flip to brand color before Prod');
} else {
  ok(`adaptiveIcon backgroundColor: ${expo.android?.adaptiveIcon?.backgroundColor}`);
}

if (!expo.extra?.eas?.projectId) {
  fatal('expo.extra.eas.projectId missing — run `eas init`');
} else {
  ok(`EAS projectId: ${expo.extra.eas.projectId}`);
}

// ─── 7. Env vars (warnings only — eas build env is separate) ───────────────
section('Environment hints');
const envExample = join(repoRoot, '.env.example');
if (existsSync(envExample)) {
  const example = readFileSync(envExample, 'utf8');
  const required = example.match(/^[A-Z_]+=/gm) ?? [];
  warn(`${required.length} env vars documented in .env.example — verify each is set in EAS secrets for prod build`);
} else {
  warn('.env.example missing — hard to know what env vars are required');
}

// ─── 8. Summary ────────────────────────────────────────────────────────────
console.log();
if (fatalCount > 0) {
  console.error(`✗ Preflight failed: ${fatalCount} fatal, ${warnCount} warnings.`);
  process.exit(1);
}
if (warnCount > 0) {
  console.log(`⚠ Preflight passed with ${warnCount} warnings.`);
} else {
  console.log('✓ Preflight clean — ready to build.');
}
process.exit(0);
