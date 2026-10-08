// An event's / card's customerId is the customer's ID, never the display slot.
// `Invoice.customer` / `Quote.customer` hold the NAME on most rows; the UK walk
// (2026-10-08) found invoice_sent events with customerId "Sarah Jones", so
// every per-customer payment-timing join missed them.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../../utils/stripComments';

it('no customerId is assigned from a document\'s `.customer` slot in AppState', () => {
  const src = stripComments(fs.readFileSync(path.join(__dirname, '../AppState.tsx'), 'utf8'));
  const offenders = src.split('\n').filter((l) => /customerId:\s*[\w?.]*\.customer\b(?!Id)/.test(l)).map((l) => l.trim());
  expect(offenders).toEqual([]);
});
