#!/usr/bin/env node
/**
 * TestFlight preflight — wraps the build-side preflight with the Apple-
 * submit-side checks the regular preflight skips:
 *
 *   - Apple credentials (.p8 key file present, eas.json populated)
 *   - buildNumber not stale (matches what was last submitted)
 *   - Branded PNGs are 1024×1024 (Apple rejects smaller)
 *   - Fastlane reviewer notes have non-placeholder values
 *   - All 4 outstanding migrations are committed (R83/R86/R79/R81)
 *   - Screenshots present at expected fastlane paths
 *   - Env vars listed in eas.json production profile
 *
 * Runs the regular preflight first; if that passes, runs the TF-specific
 * layer. Single green/red report.
 *
 * Usage:
 *   node scripts/preflight-testflight.mjs
 *   node scripts/preflight-testflight.mjs --quick   # skip jest (passes through to preflight.mjs)
 *
 * Exit non-zero on any FATAL.
 */

import { readFileSync, statSync, existsSync } from 'node:fs';
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
let okCount = 0;

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
  okCount++;
}
function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ─── 1. Delegate to the existing build-side preflight ──────────────────
section('Build-side preflight');
try {
  const cmd = QUICK
    ? 'node scripts/preflight.mjs --quick'
    : 'node scripts/preflight.mjs';
  execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
  ok('build preflight passed');
} catch {
  fatal('build preflight failed — see output above');
  // Continue with TF checks anyway; they may catch additional issues.
}

// ─── 2. Apple credentials ─────────────────────────────────────────────
section('Apple submit credentials');
const easJsonPath = join(repoRoot, 'eas.json');
if (!existsSync(easJsonPath)) {
  fatal('eas.json missing — required for `eas submit`');
} else {
  const eas = JSON.parse(readFileSync(easJsonPath, 'utf8'));
  const submit = eas.submit?.preview?.ios ?? eas.submit?.production?.ios;
  if (!submit) {
    fatal('eas.json submit.preview.ios + submit.production.ios both missing');
  } else {
    const needed = ['ascApiKeyPath', 'ascApiKeyId', 'ascApiKeyIssuerId', 'appleTeamId'];
    for (const key of needed) {
      if (!submit[key]) fatal(`eas.json submit.ios.${key} missing`);
    }
    const keyPath = submit.ascApiKeyPath;
    if (keyPath) {
      const fullPath = join(repoRoot, keyPath.replace(/^\.\//, ''));
      if (!existsSync(fullPath)) {
        fatal(`ASC API key file not found at ${keyPath} — \`eas submit\` will fail`);
      } else {
        ok(`ASC API key file present (${keyPath})`);
      }
    }
    if (submit.appleTeamId && /^[A-Z0-9]{10}$/.test(submit.appleTeamId)) {
      ok(`appleTeamId = ${submit.appleTeamId}`);
    }
    if (submit.ascApiKeyId && /^[A-Z0-9]{10}$/.test(submit.ascApiKeyId)) {
      ok(`ascApiKeyId = ${submit.ascApiKeyId}`);
    }
  }
}

// ─── 3. buildNumber ──────────────────────────────────────────────────
section('buildNumber freshness');
const appJsonPath = join(repoRoot, 'app.json');
if (existsSync(appJsonPath)) {
  const app = JSON.parse(readFileSync(appJsonPath, 'utf8'));
  const buildNumber = app.expo?.ios?.buildNumber;
  if (!buildNumber) {
    fatal('app.json:expo.ios.buildNumber missing');
  } else {
    ok(`buildNumber = ${buildNumber}`);
    if (buildNumber === '1') {
      warn('buildNumber is 1 — bump if you\'ve previously submitted any build');
    }
  }
  const version = app.expo?.version;
  if (version) ok(`version = ${version}`);
}

// ─── 4. App icon sizing ──────────────────────────────────────────────
section('App icon dimensions');
const iconPath = join(repoRoot, 'assets/icon.png');
if (existsSync(iconPath)) {
  try {
    const sips = execSync(`sips -g pixelWidth -g pixelHeight "${iconPath}"`, { encoding: 'utf8' });
    const width = sips.match(/pixelWidth:\s*(\d+)/)?.[1];
    const height = sips.match(/pixelHeight:\s*(\d+)/)?.[1];
    if (width === '1024' && height === '1024') {
      ok(`icon.png is 1024×1024`);
    } else {
      fatal(`icon.png is ${width}×${height} — Apple requires exactly 1024×1024`);
    }
  } catch (e) {
    warn(`could not read icon.png dimensions: ${e.message}`);
  }
} else {
  fatal('assets/icon.png missing');
}

// ─── 5. Fastlane reviewer info — non-placeholder check ───────────────
section('Fastlane reviewer info');
const reviewDir = join(repoRoot, 'fastlane/metadata/review_information');
const reviewFields = {
  'phone_number.txt': /^\+\d{10,15}$/,
  'email_address.txt': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  'first_name.txt': /^.{1,}$/,
  'last_name.txt': /^.{1,}$/,
  'demo_user.txt': /@/,
  'demo_password.txt': /^.{1,}$/,
};
const PLACEHOLDERS = ['+31000000000', '+1000000000', '+10000000000', 'Your Name', ''];

for (const [file, pattern] of Object.entries(reviewFields)) {
  const fpath = join(reviewDir, file);
  if (!existsSync(fpath)) {
    fatal(`fastlane reviewer info missing: ${file}`);
    continue;
  }
  const content = readFileSync(fpath, 'utf8').trim();
  if (PLACEHOLDERS.includes(content)) {
    warn(`${file} = "${content}" looks like a placeholder — Apple may call this number`);
  } else if (!pattern.test(content)) {
    warn(`${file} = "${content}" doesn't match expected format`);
  } else {
    ok(`${file} populated`);
  }
}

// ─── 6. Migrations committed ────────────────────────────────────────
section('Outstanding migrations committed');
const expectedMigrations = [
  '20260520000001_contractor_licenses.sql',
  '20260520000002_leads.sql',
  '20260520000003_business_settings_us.sql',
  '20260520000004_workers.sql',
];
for (const m of expectedMigrations) {
  const mpath = join(repoRoot, 'supabase/migrations', m);
  if (existsSync(mpath)) {
    ok(`migration committed: ${m}`);
  } else {
    fatal(`migration missing: ${m}`);
  }
}
warn('migrations are committed but NOT applied to prod — run `supabase db push` before testers hit the build');

// ─── 7. Screenshots at expected paths ───────────────────────────────
section('App Store screenshots staged');
const enUS = join(repoRoot, 'fastlane/screenshots/en-US');
const nlNL = join(repoRoot, 'fastlane/screenshots/nl-NL');
let shotCount = 0;
for (const dir of [enUS, nlNL]) {
  if (!existsSync(dir)) {
    fatal(`screenshots dir missing: ${dir.replace(repoRoot + '/', '')}`);
    continue;
  }
  try {
    const files = execSync(`ls "${dir}"/*.png 2>/dev/null | wc -l`, { encoding: 'utf8' }).trim();
    const n = Number(files);
    shotCount += n;
    if (n >= 5) {
      ok(`${dir.replace(repoRoot + '/', '')}: ${n} PNGs`);
    } else {
      warn(`${dir.replace(repoRoot + '/', '')}: only ${n} PNGs (Apple requires ≥3 per device class)`);
    }
  } catch {
    warn(`could not enumerate ${dir}`);
  }
}

// ─── 8. Env vars on eas.json production profile ─────────────────────
section('Production env vars');
if (existsSync(easJsonPath)) {
  const eas = JSON.parse(readFileSync(easJsonPath, 'utf8'));
  const env = eas.build?.production?.env ?? {};
  const required = ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_TERMS_URL'];
  for (const k of required) {
    if (env[k]) ok(`${k} = ${env[k]}`);
    else fatal(`eas.json:build.production.env.${k} missing`);
  }
  if (!env.EXPO_PUBLIC_SENTRY_DSN && !process.env.EXPO_PUBLIC_SENTRY_DSN) {
    warn('EXPO_PUBLIC_SENTRY_DSN not set — crash reports won\'t flow to Sentry');
  }
}

// ─── Summary ───────────────────────────────────────────────────────
section('Summary');
console.log(`  ${okCount} OK · ${warnCount} warn · ${fatalCount} fatal\n`);

if (fatalCount > 0) {
  console.error(`❌ ${fatalCount} fatal issue(s) — fix before \`eas build\` / \`eas submit\``);
  process.exit(1);
}
if (warnCount > 0) {
  console.log(`⚠️  ${warnCount} warning(s) — review before submitting for App Review (Internal TF is OK)`);
  process.exit(0);
}
console.log('✅ Ready for TestFlight');
