// Live i18next resolution over the real locale JSONs.
//
// The i18n:audit and the OTA preflight both check key PRESENCE; neither proves
// a value renders in the right language. This suite drives i18next itself, so
// it catches the two failure modes that shipped before:
//   1. English pasted into de/fr/es/it ("parity != translated") — ten whole
//      namespaces did this, incl. the customer-facing quote page.
//   2. Dutch sitting in en.json, which is the fallback for EVERY locale and the
//      language the UK/US product renders in.
import i18next from 'i18next';

import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
// `it` would shadow jest's global test fn — alias it.
import itLocale from '../locales/it.json';
import nl from '../locales/nl.json';

const TARGETS = ['de', 'fr', 'es', 'it'] as const;

// One representative key per namespace that was untranslated. If any of these
// falls back to the English string again, a whole screen has regressed.
const MUST_DIFFER_FROM_EN = [
  'customerView.acceptQuote', // the page the CUSTOMER reads to accept a quote
  'customerView.dear',
  'aiQuote.title', // photo -> quote moat path
  'aiQuote.estimatedHours',
  'receipt.processedTitle',
  'ingestion.uploadPdfDesc',
  'inkoop.stockOk',
  'suppliers.statusPending',
  'intel.title',
  'costs.contingencyTracker',
  'smartReply.suggested',
  'quotes.sendQuote',
  'quoteTemplates.useTemplate',
];

// Keys that used to hold DUTCH in en.json. English speakers saw Dutch.
const EN_MUST_BE_ENGLISH: Record<string, string> = {
  'savings.title': 'AI SAVINGS',
  'savings.order': 'Order',
  'market.title': 'Market prices',
  'market.margin': 'Margin',
  'vatPrep.inputVat': 'Input VAT',
  'vatPrep.outputVat': 'Output VAT',
  'invoices.view': 'View',
  'invoices.industry': 'Industry',
  'purchaseOrders.total': 'Total',
  'insurance.claimSubmitted': 'Claim submitted',
  'compliance.scoreCritical': 'Critical',
};

beforeAll(async () => {
  await i18next.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      nl: { translation: nl },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
      it: { translation: itLocale },
    },
    interpolation: { escapeValue: false },
  });
});

describe('locale resolution', () => {
  it('renders English (not Dutch) in en for the keys that held Dutch', async () => {
    await i18next.changeLanguage('en');
    for (const [key, expected] of Object.entries(EN_MUST_BE_ENGLISH)) {
      expect([key, i18next.t(key)]).toEqual([key, expected]);
    }
  });

  it.each(TARGETS)('%s does not fall back to the English string', async (lng) => {
    await i18next.changeLanguage(lng);
    for (const key of MUST_DIFFER_FROM_EN) {
      const enValue = i18next.t(key, { lng: 'en' });
      expect([lng, key, i18next.t(key)]).not.toEqual([lng, key, enValue]);
    }
  });

  it('keeps interpolation working after the value rewrite', async () => {
    await i18next.changeLanguage('de');
    expect(i18next.t('suppliers.count', { count: 3 })).toContain('3');
    expect(i18next.t('suppliers.count', { count: 3 })).not.toContain('{{');
    await i18next.changeLanguage('fr');
    expect(i18next.t('customerView.validUntil', { date: '01/09' })).toContain('01/09');
    await i18next.changeLanguage('it');
    expect(i18next.t('customerView.acceptedDesc', { business: 'Rossi SRL' })).toContain('Rossi SRL');
  });
});
