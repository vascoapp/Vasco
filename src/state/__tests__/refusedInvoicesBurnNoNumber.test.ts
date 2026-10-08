// A refused invoice burns no number (UK walk, 2026-10-08): addInvoice minted
// the next number BEFORE its duplicate check, so "Create invoice" on an
// already-invoiced quote left a gap in the series. Every invoice mutator that
// can refuse must decide first and mint after.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../../utils/stripComments';

const src = stripComments(fs.readFileSync(path.join(__dirname, '../AppState.tsx'), 'utf8'));
const body = (name: string) => {
  const i = src.indexOf(`${name}: async`);
  const j = src.indexOf('\n      },\n', i);
  return src.slice(i, j);
};

it.each([
  ['addInvoice', /validateInvoiceBeforeCreate\(/],
  ['addInvoiceFromJob', /validateInvoiceBeforeCreate\(/],
  ['addTermInvoice', /validateBillingSchedule\(project\)/],
  ['addChangeOrderInvoice', /canInvoiceChangeOrder\(/],
  ['addRetentionReleaseInvoice', /canReleaseRetention\(/],
])('%s checks before it mints', (name, check) => {
  const b = body(name as string);
  const mint = b.indexOf("nextDocumentNumber('invoice')");
  const m = b.match(check as RegExp);
  expect(mint).toBeGreaterThan(0);
  expect(m).not.toBeNull();
  expect(b.indexOf(m![0])).toBeLessThan(mint);
});
