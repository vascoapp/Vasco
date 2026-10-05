/**
 * The message that carries a quote to the customer states the quote's amount
 * TO THE CENT and is signed by the business; and the signed portal link works
 * for the app's own quote ids (document numbers).
 *
 * German device walk, 2026-10-06 — the customer got: "hier ist Ihr Angebot für
 * Heizungswartung — € 226 … Mit freundlichen Grüßen" (quote: € 225,51; no
 * sender), because sign-quote-token looked the quote up by uuid while the app's
 * quote id IS its document number ("Q0001"): every real quote fell back to the
 * reduced accept-only link with the whole-euro message.
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../../utils/stripComments';
import i18n from '../../i18n/i18n';
import { setCurrentUser } from '../../lib/currentUser';
import { shareQuoteWithAcceptanceLink } from '../customerQuoteAcceptanceService';

jest.mock('../../lib/supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule({ userId: '11111111-1111-4111-8111-111111111111' }));
const mockShared: { message: string } = { message: '' };
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Share: { sharedAction: 'sharedAction', dismissedAction: 'dismissedAction', share: async (c: { message: string }) => { mockShared.message = c.message; return { action: 'sharedAction' }; } },
  Alert: { alert: () => {} },
}));

const read = (f: string) => stripComments(fs.readFileSync(path.join(__dirname, '../../..', f), 'utf8'));

beforeEach(async () => {
  mockShared.message = '';
  setCurrentUser({ id: '11111111-1111-4111-8111-111111111111', country: 'DE' });
  await i18n.changeLanguage('de');
});
afterEach(() => setCurrentUser(null));

it('states the amount to the cent and signs with the business name', async () => {
  await shareQuoteWithAcceptanceLink(
    { id: 'Q0001', customerName: 'Bäckerei Schmitz GmbH', amount: 225.51, job: 'Heizungswartung' },
    { askIfUnknown: false, senderName: 'Sanitär Weber GmbH' },
  );
  expect(mockShared.message).toMatch(/225,51/);
  expect(mockShared.message).not.toMatch(/€\s?226\b/);
  expect(mockShared.message.trimEnd().endsWith('Sanitär Weber GmbH')).toBe(true);
});

it('without a business name the message is unchanged (no dangling line)', async () => {
  await shareQuoteWithAcceptanceLink({ id: 'Q0001', customerName: 'X', amount: 10, job: 'Y' }, { askIfUnknown: false });
  expect(mockShared.message.trimEnd().endsWith('Mit freundlichen Grüßen')).toBe(true);
});

it('the quote screen signs the portal message and passes the sender to the fallback', () => {
  const src = read('app/quotes/[id].tsx');
  expect(src).toMatch(/message: sender \? `\$\{body\}\\n\\n\$\{sender\}` : body/);
  expect(src).toMatch(/const sender = \(businessProfile\.businessName \|\| user\?\.company \|\| ''\)\.trim\(\);/);
  expect(src).toMatch(/senderName: sender \}/);
});

it('sign-quote-token resolves a document number, owner-scoped, and signs the uuid', () => {
  const src = read('supabase/functions/sign-quote-token/index.ts');
  expect(src).toMatch(/invoiceLookup\(quoteId, user\.id\)/);
  expect(src).toMatch(/lookup\.eq\('user_id', ref\.userId\)/);
  expect(src).toMatch(/const payload = \{ quoteId: quote\.id,/);
  expect(src).toMatch(/encodeURIComponent\(quote\.id\)/);
});
