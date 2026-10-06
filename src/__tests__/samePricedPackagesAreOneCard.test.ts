/**
 * Packages that all cost the same are ONE card — no package name, no
 * "premium materials" promise at the Standard price (user's call, FR walk
 * 2026-10-06: three identical €1 488,60 cards). Three cards only once the
 * contractor priced packages apart in the price list.
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.join(__dirname, '../components/contractor/TieredQuoteBuilder.tsx'), 'utf8'));

it('the three cards render only when package totals differ', () => {
  expect(src).toMatch(/const packagesDiffer = new Set\(tiers\.map\(\(tier\) => tier\.total\)\)\.size > 1;/);
  const cards = src.indexOf('{tiers.map(tier =>');
  const gate = src.lastIndexOf('{packagesDiffer ? (<>', cards);
  expect(gate).toBeGreaterThan(-1);
  expect(cards - gate).toBeLessThan(2000);
});

it('one card names no package and makes no feature claim', () => {
  const single = src.slice(src.indexOf('<View style={s.singlePackage}>'), src.indexOf('</View>', src.indexOf('<View style={s.singlePackage}>')));
  expect(single).not.toMatch(/tier\.name|features/);
  expect(single).toMatch(/quotes\.setPackagePrices/);
});

it('the button and the lines title drop the package name when equal', () => {
  expect(src).toMatch(/packagesDiffer\s*\?\s*t\('quotes\.createPackage'[\s\S]{0,140}: t\('quotes\.createQuotePlain'/);
  expect(src).toMatch(/packagesDiffer\s*\?\s*t\('quotes\.linesForPackage'[\s\S]{0,140}: t\('quotes\.linesPlain'/);
});
