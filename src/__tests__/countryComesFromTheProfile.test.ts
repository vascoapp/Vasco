/**
 * The contractor's country comes from the business PROFILE, the account only
 * as a fallback (#218, CLAUDE.md) — in every live file, not per screen.
 *
 * `user?.country ?? 'NL'` read only the account, so a contractor whose account
 * still carried its signup country quoted at that country's VAT rate (the
 * quote builder: 21 % for a German profile), saw its currency and its payment
 * provider (payments: € and Mollie for a UK profile), and its price list and
 * photo pricing (sweep 2026-09-23 D5; fixed 2026-10-04). The per-file guard in
 * countryIsNotAssumedDutch.test.ts never looked at these files.
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set<string>(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/dormant.files.json'), 'utf8')).files);

/** Whole files, each with its reason. */
const ALLOWED = new Map([
  // Root layout, above the AppState provider: no profile exists there.
  ['app/_layout.tsx', 'outside the AppState provider (sync start, weather prefetch)'],
  // The account itself.
  ['src/context/AuthContext.tsx', 'is the account'],
]);

/** Lines that read the account on purpose. */
const ALLOWED_LINE = [
  /^\s*\}, \[.*\]\);\s*$/, // an effect's dependency list
  /useFeatureFlag\(/, // flag targeting is per ACCOUNT
];

const files: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['__tests__', 'node_modules', 'test-utils'].includes(e.name)) walk(full); }
    else if (/\.tsx?$/.test(e.name)) files.push(path.relative(ROOT, full));
  }
};
walk(path.join(ROOT, 'app'));
walk(path.join(ROOT, 'src'));

// ANY read of the account's country — with or without a default, in any
// position (`user?.country ?? 'NL'`, `x ?? user?.country`, `currencySymbol(
// user?.country)`, `user?.country === 'US'`) …
const ACCOUNT_READ = /\b(?:user|currentUser|authUser)\??\.country\b/g;
// … is legal only straight after the profile's: `businessProfile?.country ?? user?.country`.
const AFTER_PROFILE = /\b(?:businessProfile|bp)\??\.country\s*(?:\?\?|\|\|)\s*$/;

function offenders(src: string): number[] {
  const lines = src.split('\n');
  const out: number[] = [];
  for (const m of src.matchAll(ACCOUNT_READ)) {
    const before = src.slice(Math.max(0, m.index! - 80), m.index);
    if (AFTER_PROFILE.test(before)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    if (ALLOWED_LINE.some((re) => re.test(lines[line - 1]))) continue;
    out.push(line);
  }
  return out;
}

describe('the country comes from the profile', () => {
  it('no live file reads the account country before (or instead of) the profile', () => {
    const hits: string[] = [];
    for (const f of files) {
      if (dormant.has(f) || ALLOWED.has(f)) continue;
      const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      for (const line of offenders(src)) hits.push(`${f}:${line}`);
    }
    expect(hits).toEqual([]);
  });

  it('the rule catches every shape the reviews found (self-check)', () => {
    for (const bad of [
      "const country = user?.country ?? 'NL';",
      "const c = (user?.country ?? 'NL') as Country;",
      "const c = country ?? user?.country ?? 'NL';", // a PROP in front is not the profile
      'currencySymbol(user?.country as never)',
      "const isUS = user?.country === 'US';",
      'const c = currentUser?.country;',
    ]) expect(offenders(bad)).toEqual([1]);
    for (const good of [
      "const c = businessProfile?.country ?? user?.country ?? 'NL';",
      "const c = country ?? bp?.country ?? user?.country ?? 'NL';",
      "}, [selectedJob, user?.country]);",
      "const on = useFeatureFlag('x', { country: user?.country as any });",
    ]) expect(offenders(good)).toEqual([]);
  });
});
