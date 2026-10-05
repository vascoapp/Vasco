/**
 * The quote builder never shows a trade-wide "recommended hourly rate", and
 * predict-price never answers below k-anonymity.
 *
 * predict-price returned the median UNIT price of any quote line (a boiler, a
 * hose, an hour) from other contractors; the builder labelled it "Empfohlener
 * Stundensatz" with an acceptance rate. For German plumbing the data was ONE
 * contractor's single line (€ 232): every German plumber saw that contractor's
 * price as their recommended hourly rate (device walk, 2026-10-06).
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

const read = (f: string) => stripComments(fs.readFileSync(path.join(__dirname, '../..', f), 'utf8'));

it('the quote builder does not ask for or render the trade-wide price advice', () => {
  const src = read('src/components/contractor/TieredQuoteBuilder.tsx');
  expect(src).not.toMatch(/\bpredictPrice\s*\(/);
  expect(src).not.toMatch(/quotes\.priceAdvice/);
});

it('predict-price refuses fewer than 5 contractors or 20 rows', () => {
  const src = read('supabase/functions/predict-price/index.ts');
  expect(src).toMatch(/select\('user_id,/);
  expect(src).toMatch(/pricingData\.length < 20 \|\| contractors < 5/);
});
