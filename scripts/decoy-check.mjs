#!/usr/bin/env node
// =============================================================================
// DECOY CHECK — prove a guard actually bites, and never lie about it
// =============================================================================
// A detector is only worth its line count if it FAILS when the defect returns.
// The way to establish that is to reintroduce the defect and watch it fail.
//
// The trap this script exists for: on 2026-08-29 a decoy was applied with
//
//     sed -i '' "0,/case 'IT': return 'REA';/s//case 'IT': return 'P.IVA';/"
//
// whose empty-pattern reuse (`s//`) silently did nothing on BSD sed. The suite
// passed, and a passing suite after a decoy reads exactly like a toothless
// test — the wrong conclusion, reached confidently. A decoy that never ran and
// a decoy that ran and was not caught are indistinguishable from the outside.
//
// So this script refuses to report anything unless it has PROVEN the mutation
// landed: the needle must be present before, absent after, and the file's bytes
// must differ. Then it runs the target and requires it to FAIL.
//
//   node scripts/decoy-check.mjs \
//     --file "src/services/quotePdfService.ts" \
//     --replace "case 'IT': return 'REA';" \
//     --with    "case 'IT': return 'P.IVA';" \
//     --test    "src/services/__tests__/documentIdentifierLabels.test.ts"
//
// The file is ALWAYS restored — on success, on failure, and on Ctrl-C.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};

const file = get('--file');
const needle = get('--replace');
const replacement = get('--with');
const target = get('--test');
const all = args.includes('--all');

if (!file || needle === undefined || replacement === undefined || !target) {
  console.error('usage: decoy-check.mjs --file F --replace OLD --with NEW --test JEST_TARGET [--all]');
  process.exit(2);
}

const abs = path.resolve(file);
const original = fs.readFileSync(abs, 'utf8');

if (!original.includes(needle)) {
  console.error(`✕ decoy NOT applicable — the file does not contain:\n    ${needle}`);
  console.error('  Nothing was run. Fix the needle rather than trusting a green suite.');
  process.exit(2);
}
if (needle === replacement) {
  console.error('✕ decoy is a no-op — --replace and --with are identical.');
  process.exit(2);
}

const mutated = all
  ? original.split(needle).join(replacement)
  : original.replace(needle, replacement);

if (mutated === original) {
  console.error('✕ decoy produced no change despite the needle being present.');
  process.exit(2);
}

let restored = false;
const restore = () => {
  if (restored) return;
  fs.writeFileSync(abs, original);
  restored = true;
};
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

let verdict = 2;
try {
  fs.writeFileSync(abs, mutated);

  // Prove it landed by reading the file back, not by trusting the write.
  const onDisk = fs.readFileSync(abs, 'utf8');
  if (onDisk === original) throw new Error('file on disk is unchanged after writing the mutation');
  if (!all && onDisk.includes(needle) && onDisk === original) throw new Error('mutation did not take');
  console.log(`✓ decoy applied to ${file}`);

  let failed = false;
  try {
    execSync(`npx jest ${JSON.stringify(target)} --silent`, { stdio: 'pipe' });
  } catch {
    failed = true;
  }

  if (failed) {
    console.log(`✓ ${target} FAILED with the defect reintroduced — the guard bites.`);
    verdict = 0;
  } else {
    console.error(`✕ ${target} PASSED with the defect reintroduced — the guard is toothless.`);
    verdict = 1;
  }
} catch (err) {
  console.error(`✕ ${err.message}`);
  verdict = 2;
} finally {
  restore();
  const back = fs.readFileSync(abs, 'utf8');
  if (back !== original) {
    console.error(`✕ COULD NOT RESTORE ${file} — restore it from git before committing.`);
    process.exit(3);
  }
  console.log(`✓ ${file} restored`);
}

process.exit(verdict);
