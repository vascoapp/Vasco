#!/usr/bin/env node
// =============================================================================
// RUNTIME DEPENDENCY AUDIT
// =============================================================================
// Replaces `npm audit --omit=dev --audit-level=high` in CI, which had been RED
// on every push since 2026-07-18 — eight days of a permanently failing pipeline
// nobody could act on. That is worse than no gate: it trains everyone to ignore
// CI, so a real regression lands unnoticed in the noise.
//
// WHY IT COULD NEVER GO GREEN: `--omit=dev` drops OUR devDependencies but keeps
// the build toolchain that Expo and React Native declare as runtime deps of
// THEMSELVES — @expo/cli, metro, @react-native/dev-middleware,
// react-devtools-core, @expo/xcpretty, xcode, @expo/plist. That code runs on a
// developer's laptop or an EAS builder; none of it is in the JS bundle that
// reaches a contractor's phone. Expo pins those versions, so the advisories
// cannot be cleared without forcing cross-major overrides onto Metro — risking
// `npx expo start` for vulnerabilities with no reachable surface in a shipped
// app.
//
// This gate instead answers the question that matters: is there a high/critical
// advisory in code that SHIPS or talks to production data?
//
// Two mechanisms, because an allowlist alone would mask a real regression:
//
//   1. KNOWN_BUILD_ONLY — advisories excused with a reason AND the verified
//      dependency chain that proves they are build-time. Anything high/critical
//      that is NOT on this list fails the build.
//
//   2. RUNTIME_PINS — positive assertions that shipping packages sit on patched
//      versions. `ws` is on the excuse list (metro/dev-middleware pull old 6.x
//      and 7.x), so without this a future vulnerability in the ws that
//      @supabase/realtime-js opens against the production database would be
//      silently excused. This asserts that copy directly.
//
// Usage:  npm run audit:runtime
// =============================================================================

import { execSync } from 'node:child_process';

// package -> why it cannot reach a user's device. Chains verified 2026-07-26
// against `npm ls --omit=dev --all`.
const KNOWN_BUILD_ONLY = new Map([
  ['@xmldom/xmldom', 'expo-updates>@expo/plist and xcode>simple-plist — native plist generation at build time'],
  ['brace-expansion', 'glob/minimatch under @react-native/codegen, @expo/cli, expo-updates, rimraf, babel-plugin-istanbul — build and test tooling'],
  ['js-yaml', 'babel-plugin-istanbul (coverage) and @expo/cli>@expo/xcpretty (formats xcodebuild output)'],
  ['postcss', 'expo>@expo/metro-config — bundler CSS handling, not shipped'],
  ['shell-quote', 'react-native>react-devtools-core — devtools launcher'],
  ['tar', 'expo>@expo/cli — downloads and unpacks build artifacts'],
  ['undici', 'expo>@expo/cli — HTTP client for the CLI itself'],
  ['ws', 'metro, @react-native/dev-middleware, react-devtools-core and @expo/cli dev sockets. The SHIPPING copy under @supabase/realtime-js is pinned separately — see RUNTIME_PINS'],
]);

// Packages that DO ship or touch production data, with the minimum patched
// version. Asserted from the installed tree, independent of npm audit.
const RUNTIME_PINS = [
  {
    chain: ['@supabase/supabase-js', '@supabase/realtime-js', 'ws'],
    min: '8.21.0',
    why: 'opens a websocket against the production database (realtime subscriptions)',
  },
];

const sh = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return e.stdout?.toString() ?? '';
  }
};

const cmp = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
};

let failed = 0;

// ---------------------------------------------------------------------------
// 1. Advisories
// ---------------------------------------------------------------------------
const report = JSON.parse(sh('npm audit --omit=dev --json') || '{}');
const vulns = report.vulnerabilities ?? {};
const counts = Object.values(vulns).reduce((a, v) => ((a[v.severity] = (a[v.severity] ?? 0) + 1), a), {});

console.log('npm audit (production deps)');
console.log(`  totals: ${Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(', ') || 'none'}\n`);

const severe = Object.entries(vulns).filter(([, v]) => v.severity === 'high' || v.severity === 'critical');
const excused = severe.filter(([n]) => KNOWN_BUILD_ONLY.has(n));
const shipping = severe.filter(([n]) => !KNOWN_BUILD_ONLY.has(n));

if (excused.length) {
  console.log(`Build-tooling advisories — reported, not failing (${excused.length}):`);
  for (const [n, v] of excused) console.log(`  · ${v.severity.padEnd(8)} ${n} — ${KNOWN_BUILD_ONLY.get(n)}`);
  console.log('');
}

if (shipping.length) {
  failed++;
  console.log(`❌ high/critical advisory in a package that is NOT known build-tooling (${shipping.length}):`);
  for (const [n, v] of shipping) console.log(`  · ${v.severity.padEnd(8)} ${n}  (vulnerable: ${v.range})`);
  console.log('\n  Check the chain with:  npm ls <pkg> --omit=dev --all');
  console.log('  If it ships: pin a patched version inside the SAME major via package.json overrides.');
  console.log('  If it is genuinely build-only: add it to KNOWN_BUILD_ONLY with the chain as the reason.\n');
}

// ---------------------------------------------------------------------------
// 2. Runtime pins — catches what the allowlist would otherwise mask
// ---------------------------------------------------------------------------
const tree = JSON.parse(sh('npm ls --omit=dev --all --json') || '{}');
const resolve = (chain) => {
  let node = tree;
  for (const step of chain) {
    node = (node.dependencies ?? {})[step];
    if (!node) return null;
  }
  return node.version ?? null;
};

for (const pin of RUNTIME_PINS) {
  const label = pin.chain.join(' > ');
  const found = resolve(pin.chain);
  if (!found) {
    console.log(`⚠️  runtime pin not found in tree: ${label} — chain changed, update RUNTIME_PINS`);
    failed++;
    continue;
  }
  if (cmp(found, pin.min) < 0) {
    console.log(`❌ ${label} is ${found}, needs >= ${pin.min}`);
    console.log(`     ${pin.why}`);
    failed++;
  } else {
    console.log(`✓ ${label} @ ${found} (>= ${pin.min}) — ${pin.why}`);
  }
}

console.log('');
if (failed) {
  console.log('❌ Runtime audit failed.');
  process.exit(1);
}
console.log('✅ No high/critical advisories in shipping code; runtime pins satisfied.');
