#!/usr/bin/env node
/**
 * Bundle-size audit. R66r71.
 *
 * Exports the production JS bundle, prints total size + top 30
 * heaviest source modules, and flags suspicious imports
 * (lodash full-package, moment, full-icon-set imports, etc.)
 *
 * Run:
 *   npm run analyze:bundle              # iOS
 *   PLATFORM=android npm run analyze:bundle
 *
 * Compares against a baseline if .bundle-baseline.json exists.
 * Use as a CI gate: fail if bundle grows >10% without an explicit
 * `BUNDLE_BUDGET_OK=1` env override.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const platform = process.env.PLATFORM || 'ios';
const baselinePath = join(repoRoot, `.bundle-baseline.${platform}.json`);
const outDir = join(repoRoot, '.bundle-analyze');
mkdirSync(outDir, { recursive: true });

const bundlePath = join(outDir, `bundle.${platform}.js`);
const sourcemapPath = join(outDir, `bundle.${platform}.map`);

console.log(`▶ Exporting ${platform} bundle (this takes ~30s)…`);
try {
  execSync(
    `npx expo export:embed --platform ${platform} --dev false --minify true ` +
    `--bundle-output "${bundlePath}" --sourcemap-output "${sourcemapPath}" ` +
    `--assets-dest "${outDir}/assets"`,
    { cwd: repoRoot, stdio: 'inherit' }
  );
} catch (e) {
  console.error('✗ Bundle export failed.');
  process.exit(1);
}

const bundleSize = statSync(bundlePath).size;
const bundleKb = (bundleSize / 1024).toFixed(1);
const bundleMb = (bundleSize / 1024 / 1024).toFixed(2);

console.log(`\n📦 Bundle size (${platform}): ${bundleKb} KB / ${bundleMb} MB`);

// ─── Source-module attribution via sourcemap ──────────────────────────────
console.log('\n▶ Computing per-module sizes from sourcemap…');
const sourcemap = JSON.parse(readFileSync(sourcemapPath, 'utf8'));
const sources = sourcemap.sources || [];
const sourcesContent = sourcemap.sourcesContent || [];

const moduleSizes = sources.map((src, i) => {
  const content = sourcesContent[i] || '';
  return { src, bytes: Buffer.byteLength(content, 'utf8') };
});
moduleSizes.sort((a, b) => b.bytes - a.bytes);

console.log('\n🏋 Top 30 heaviest source modules:\n');
console.log('  KB    Path');
console.log('  ──    ────');
for (const { src, bytes } of moduleSizes.slice(0, 30)) {
  const kb = (bytes / 1024).toFixed(1).padStart(6);
  const short = src.replace(repoRoot + '/', '').replace(/^.*node_modules\//, 'node_modules/');
  console.log(`  ${kb}  ${short}`);
}

// ─── Aggregate by node_modules package ────────────────────────────────────
console.log('\n📚 Top 15 npm packages by total weight:\n');
const packageWeights = new Map();
for (const { src, bytes } of moduleSizes) {
  const m = src.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if (!m) continue;
  packageWeights.set(m[1], (packageWeights.get(m[1]) || 0) + bytes);
}
const sortedPkgs = [...packageWeights.entries()].sort((a, b) => b[1] - a[1]);
console.log('  KB    Package');
console.log('  ──    ───────');
for (const [pkg, bytes] of sortedPkgs.slice(0, 15)) {
  const kb = (bytes / 1024).toFixed(1).padStart(6);
  console.log(`  ${kb}  ${pkg}`);
}

// ─── Suspicious-import audit ─────────────────────────────────────────────
console.log('\n🔍 Suspicious-import audit:');
const warnings = [];

const allCode = sourcesContent.join('\n');
if (/require\(['"]lodash['"]\)|from ['"]lodash['"]\s*$/m.test(allCode)) {
  warnings.push('Full lodash import detected — use `lodash/<fn>` per function to tree-shake.');
}
if (/from ['"]moment['"]/.test(allCode)) {
  warnings.push('moment.js detected — replace with date-fns or Intl.DateTimeFormat (saves ~280KB).');
}
if (/from ['"]@expo\/vector-icons['"]/.test(allCode) && !/from ['"]@expo\/vector-icons\/Ionicons['"]/.test(allCode)) {
  warnings.push('Importing all of @expo/vector-icons — pin to one set (Ionicons) to drop ~1MB of glyphs.');
}
const heavyPkgs = ['rxjs', 'aws-sdk', '@aws-sdk/client-s3', 'firebase'];
for (const pkg of heavyPkgs) {
  if (packageWeights.has(pkg)) {
    warnings.push(`${pkg} in bundle (${(packageWeights.get(pkg) / 1024).toFixed(1)} KB) — confirm it ships in mobile.`);
  }
}

if (warnings.length === 0) {
  console.log('  ✓ No suspicious imports found.');
} else {
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

// ─── Baseline comparison ─────────────────────────────────────────────────
console.log('\n📊 Baseline comparison:');
if (!existsSync(baselinePath)) {
  console.log(`  No baseline yet — writing ${baselinePath}.`);
  writeFileSync(baselinePath, JSON.stringify({ bundleBytes: bundleSize, ts: new Date().toISOString() }, null, 2));
  console.log(`  ✓ Baseline saved: ${bundleKb} KB.`);
  process.exit(0);
}
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const baselineKb = (baseline.bundleBytes / 1024).toFixed(1);
const deltaBytes = bundleSize - baseline.bundleBytes;
const deltaKb = (deltaBytes / 1024).toFixed(1);
const deltaPct = ((deltaBytes / baseline.bundleBytes) * 100).toFixed(1);
const sign = deltaBytes >= 0 ? '+' : '';

console.log(`  Baseline: ${baselineKb} KB (${baseline.ts})`);
console.log(`  Current:  ${bundleKb} KB`);
console.log(`  Delta:    ${sign}${deltaKb} KB (${sign}${deltaPct}%)`);

const pctNum = Math.abs(parseFloat(deltaPct));
if (deltaBytes > 0 && pctNum > 10 && !process.env.BUNDLE_BUDGET_OK) {
  console.error(`\n✗ Bundle grew >10%. Set BUNDLE_BUDGET_OK=1 to bless + rebase the baseline.`);
  process.exit(1);
}
if (process.env.BUNDLE_BUDGET_OK === '1') {
  writeFileSync(baselinePath, JSON.stringify({ bundleBytes: bundleSize, ts: new Date().toISOString() }, null, 2));
  console.log(`  ✓ Baseline rebased to ${bundleKb} KB.`);
}
console.log('\n✓ Bundle analysis complete.');
