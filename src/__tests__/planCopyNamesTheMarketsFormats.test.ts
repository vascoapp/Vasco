// The plan card sells e-invoicing only where Vasco exports one, naming that
// market's formats (UK walk, 2026-10-08: "E-invoicing (XRechnung, Peppol)" was
// offered to a UK contractor; the UK has no export).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/onboarding.tsx'), 'utf8'));
const table = src.match(/const EINVOICE_FORMATS: Record<string, string> = \{([\s\S]*?)\};/)![1];

it('formats are listed for DE/FR/IT/ES only, each its own', () => {
  const keys = [...table.matchAll(/^\s*([A-Z]{2}):/gm)].map((m) => m[1]).sort();
  expect(keys).toEqual(['DE', 'ES', 'FR', 'IT']);
  expect(table).not.toMatch(/UK|NL|Peppol/);
});

it('the feature line is conditional on the market', () => {
  expect(src).toMatch(/\.\.\.\(EINVOICE_FORMATS\[country \?\? ''\] \?/);
});
