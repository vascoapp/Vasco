// iDEAL is a Dutch payment method. German emulator walk 2026-09-29: the Mollie
// screen promised a Handwerksbetrieb "Zahlungen via iDEAL", which their
// customers cannot use. Locale is not country, so non-Dutch copy names only
// methods that exist everywhere (card, bank transfer); the Dutch locale keeps it.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const root = path.resolve(__dirname, '../..');

it.each(['en', 'de', 'fr', 'es', 'it'])('%s copy never offers iDEAL', (loc) => {
  expect(fs.readFileSync(path.join(root, `src/i18n/locales/${loc}.json`), 'utf8')).not.toMatch(/iDEAL/);
});

it('the Mollie screen and the portal fall back without iDEAL', () => {
  for (const f of ['app/(modals)/mollie.tsx', 'src/components/customer/CustomerDecisionPortal.tsx']) {
    expect(stripComments(fs.readFileSync(path.join(root, f), 'utf8'))).not.toMatch(/iDEAL/);
  }
});
