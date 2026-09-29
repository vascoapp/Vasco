// On Android, "did it go out?" is asked only when the answer can change the
// quote: markQuoteSent moves a draft to sent (or refreshes a sent quote's
// timestamp) and no-ops for anything else. Re-sharing an accepted quote asked
// a question whose answer did nothing (review 2026-09-29).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/quotes/[id].tsx'), 'utf8'));

it('derives the gate from the same statuses markQuoteSent accepts', () => {
  expect(src).toMatch(/const statusCanChange = quote\.status === 'draft' \|\| quote\.status === 'sent';/);
});

it('asks and records only behind the gate, on both paths', () => {
  expect(src).toMatch(/if \(statusCanChange && await confirmShareSent\(res\)\) markQuoteSent\(quote\.id\)/);
  expect(src).toMatch(/\{ askIfUnknown: statusCanChange \}\);\s*if \(statusCanChange && fallback\.shared\) markQuoteSent\(quote\.id\)/);
});
