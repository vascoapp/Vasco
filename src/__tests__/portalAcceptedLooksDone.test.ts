/**
 * The customer's "Accepted" screen in the quote portal shows a tick, not the
 * warning sign the error states use. On the German walk (2026-10-06) the
 * customer accepted and got an orange "!" above "Angenommen" — it read like a
 * failure. The accept-only page already used a green outcome.
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

it('the portal renders the accepted phase with the done tone', () => {
  const src = stripComments(fs.readFileSync(path.join(__dirname, '../../admin/src/app/quote/[id]/page.tsx'), 'utf8'));
  expect(src).toMatch(/phase === 'accepted' && <Problem tone="done"/);
  expect(src).toMatch(/tone === 'done' \?/);
});
