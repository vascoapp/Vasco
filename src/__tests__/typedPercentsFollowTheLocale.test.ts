// A percentage the contractor types (an instalment, retention, a deduction)
// printed "30.5%" on a Dutch screen (aannemer walk, 2026-09-29) — `${x}%`.
import fs from 'fs';
import path from 'path';
import { formatPercentValue } from '../i18n/formatting';
import { stripComments } from '../utils/stripComments';

it.each([
  ['NL', /^30,5\s?%$/], ['DE', /^30,5\s%$/], ['FR', /^30,5\s%$/], ['UK', /^30\.5%$/],
] as const)('%s', (country, re) => {
  expect(formatPercentValue(30.5, country as any)).toMatch(re);
});

it('whole numbers stay whole', () => { expect(formatPercentValue(30, 'NL')).toMatch(/^30\s?%$/); });

it.each([
  ['app/contractor/project-billing/[id].tsx', /\$\{term\.percent\}%|retentionPercent \?\? 0\)\}%/],
  ['app/contractor/expenses.tsx', /\{expense\.deductionPercentage\}%/],
])('%s prints no raw percent', (f, bad) => {
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8'));
  expect(src).not.toMatch(bad);
});
