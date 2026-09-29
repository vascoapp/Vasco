// Dutch copy addresses the CONTRACTOR as "je" and the contractor's CUSTOMER as
// "u". The quote review mixed both on one screen ("Je klant krijgt…" above
// "Elk pakket gebruikt uw eigen prijzen… stelt u…"), and five more
// contractor-facing strings said "u" (walk, 2026-09-29).
import fs from 'fs';
import path from 'path';

const nl = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../i18n/locales/nl.json'), 'utf8'));
const get = (k: string) => k.split('.').reduce((o: any, p) => o?.[p], nl);

it.each([
  'quotes.tiersSamePriceHint', 'onboarding.complianceInfo', 'paymentAlerts.linkCreatedBody',
  'vatBasis.istHint', 'vatBasis.filingSection', 'vatBasis.frDebitsHint',
])('%s speaks to the contractor as je', (k) => {
  expect(get(k)).toBeTruthy();
  expect(get(k)).not.toMatch(/\b(uw|u)\b/);
});
