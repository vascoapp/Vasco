// VAT settings read the English "Standard rate per country" to every FR/ES/IT
// contractor (walk 2026-09-29). Each market now names its own rates and tax.
import fs from 'fs';
import path from 'path';
import { standardRatesLine } from '../domain/business';

it.each([
  ['FR', /^20% \/ 10% \/ 5,5% \/ 0% \(TVA\)$/],
  ['ES', /^21% \/ .*0% \(IVA\)$/],
  ['IT', /^22% \/ .*0% \(IVA\)$/],
])('%s names its own rates', (c, re) => {
  expect(standardRatesLine(c)).toMatch(re);
});

it('an unknown market gets no line, not a guess', () => {
  expect(standardRatesLine(undefined)).toBe('');
  expect(standardRatesLine('XX')).toBe('');
});

it('the screen carries no English fallback line', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../app/contractor/vat-and-audit.tsx'), 'utf8');
  expect(src).not.toMatch(/Standard rate per country/);
});
