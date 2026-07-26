/**
 * @jest-environment node
 */

import {
  pickDailyPush,
  formatForLocale,
  localeForCountry,
  __internal,
} from '../pushDigestPolicy';

const zero = {
  overdueInvoiceCount: 0,
  overdueInvoiceAmount: 0,
  queuePendingCount: 0,
  stalingQuoteCount: 0,
  jobsTomorrowCount: 0,
};

describe('pushDigestPolicy.pickDailyPush', () => {
  test('no signal → null (no spam)', () => {
    expect(pickDailyPush(zero)).toBeNull();
  });

  test('overdue wins over everything else (priority 1)', () => {
    const r = pickDailyPush({
      ...zero,
      overdueInvoiceCount: 2,
      overdueInvoiceAmount: 3500,
      queuePendingCount: 10,
      stalingQuoteCount: 5,
      jobsTomorrowCount: 3,
    });
    expect(r?.type).toBe('overdue_invoices');
    expect(r?.title).toContain('3,500');
    expect(r?.body).toMatch(/2 invoices/);
  });

  test('overdue below minimum amount falls through to queue', () => {
    const r = pickDailyPush({
      ...zero,
      overdueInvoiceCount: 1,
      overdueInvoiceAmount: 50, // < MIN_OVERDUE_AMOUNT
      queuePendingCount: 3,
    });
    expect(r?.type).toBe('queue_waiting');
  });

  test('queue wins over staling when overdue absent', () => {
    const r = pickDailyPush({
      ...zero,
      queuePendingCount: 4,
      stalingQuoteCount: 2,
      jobsTomorrowCount: 1,
    });
    expect(r?.type).toBe('queue_waiting');
  });

  test('staling wins when overdue + queue are below thresholds', () => {
    const r = pickDailyPush({
      ...zero,
      queuePendingCount: 1, // below MIN_QUEUE
      stalingQuoteCount: 2,
      jobsTomorrowCount: 1,
    });
    expect(r?.type).toBe('staling_quotes');
    expect(r?.body.toLowerCase()).toContain('cohort');
  });

  test('jobs_tomorrow is the last-resort bucket', () => {
    const r = pickDailyPush({ ...zero, jobsTomorrowCount: 2 });
    expect(r?.type).toBe('jobs_tomorrow');
    expect(r?.title).toContain('2 jobs');
  });

  test('entityKey varies with the count (so dedupe refreshes on change)', () => {
    const a = pickDailyPush({ ...zero, overdueInvoiceCount: 1, overdueInvoiceAmount: 500 });
    const b = pickDailyPush({ ...zero, overdueInvoiceCount: 2, overdueInvoiceAmount: 900 });
    expect(a?.entityKey).not.toBe(b?.entityKey);
  });

  test('singular/plural body text switches on count', () => {
    const one = pickDailyPush({ ...zero, overdueInvoiceCount: 1, overdueInvoiceAmount: 500 });
    const many = pickDailyPush({ ...zero, overdueInvoiceCount: 3, overdueInvoiceAmount: 2000 });
    expect(one?.body).toMatch(/1 invoice /);
    expect(many?.body).toMatch(/3 invoices/);
  });

  test('thresholds are coherent', () => {
    expect(__internal.MIN_OVERDUE_AMOUNT).toBeGreaterThan(0);
    expect(__internal.MIN_QUEUE).toBeGreaterThan(__internal.MIN_STALING);
  });
});

// R227 — localization coverage
describe('localeForCountry', () => {
  test.each([
    ['NL', 'nl'], ['DE', 'de'], ['FR', 'fr'],
    ['ES', 'es'], ['IT', 'it'], ['UK', 'en'],
  ] as const)('%s → %s', (country, expected) => {
    expect(localeForCountry(country)).toBe(expected);
  });
  test('null / unknown → en', () => {
    expect(localeForCountry(null)).toBe('en');
    expect(localeForCountry('XX')).toBe('en');
    expect(localeForCountry(undefined)).toBe('en');
  });
});

describe('formatForLocale', () => {
  const overdue = pickDailyPush({
    ...zero,
    overdueInvoiceCount: 2,
    overdueInvoiceAmount: 3500,
  })!;

  test('NL overdue uses "te laat" with dot thousands', () => {
    const out = formatForLocale(overdue, 'nl', 'NL');
    expect(out.title).toContain('3.500');
    expect(out.title).toContain('te laat');
    expect(out.body).toContain('facturen staan open');
  });

  test('DE overdue uses "überfällig"', () => {
    const out = formatForLocale(overdue, 'de', 'DE');
    expect(out.title).toContain('überfällig');
    expect(out.body).toContain('Rechnungen');
  });

  test('FR overdue uses space thousands', () => {
    const out = formatForLocale(overdue, 'fr', 'FR');
    // FR uses space-as-thousands — match any whitespace char to avoid
    // flakes across Node ICU / intl datasets.
    expect(out.title).toMatch(/3\s500/);
    expect(out.body).toContain('factures');
  });

  test('ES overdue uses "vencidos" + dot thousands', () => {
    // ES (and IT) set CLDR minimumGroupingDigits=2: four-digit amounts are
    // written WITHOUT a separator ("3500 €"), grouping only kicks in at five
    // digits ("13.500 €"). The old hand-rolled formatter grouped every
    // thousand and was wrong here — assert the real rule, both halves.
    const out = formatForLocale(overdue, 'es', 'ES');
    expect(out.title).toContain('3500');
    expect(out.title).not.toContain('3.500');
    expect(out.title).toContain('vencidos');

    const bigger = pickDailyPush({ ...zero, overdueInvoiceCount: 2, overdueInvoiceAmount: 13500 })!;
    expect(formatForLocale(bigger, 'es', 'ES').title).toContain('13.500');
  });

  test('IT overdue uses "in scadenza"', () => {
    const out = formatForLocale(overdue, 'it', 'IT');
    expect(out.title).toContain('in scadenza');
    expect(out.body).toContain('fatture scadute');
  });

  test('queue_waiting has no plural variant — uses "any" in all 6 locales', () => {
    const dec = pickDailyPush({ ...zero, queuePendingCount: 4 })!;
    for (const loc of ['en', 'nl', 'de', 'fr', 'es', 'it'] as const) {
      const out = formatForLocale(dec, loc, 'NL');
      expect(out.title).toContain('4');
      expect(out.body.length).toBeGreaterThan(10);
    }
  });

  test('singular variant fires when count === 1', () => {
    const dec = pickDailyPush({ ...zero, stalingQuoteCount: 1 })!;
    const nl = formatForLocale(dec, 'nl', 'NL');
    // NL has distinct singular ("offerte loopt vast") vs plural ("offertes lopen vast")
    expect(nl.title).toContain('offerte loopt vast');
  });

  // R-currency: 'en' serves UK and US as well as generic English, and the
  // template used to hardcode "€{amount}" — so a British contractor read a
  // euro sign on their lock screen for money they bill in pounds. The symbol
  // now comes from the COUNTRY, never the locale.
  test('currency follows the country, not the locale', () => {
    expect(formatForLocale(overdue, 'en', 'UK').title).toContain('£');
    expect(formatForLocale(overdue, 'en', 'UK').title).not.toContain('€');
    expect(formatForLocale(overdue, 'en', 'US').title).toContain('$');
    expect(formatForLocale(overdue, 'en', 'US').title).not.toContain('€');
    expect(formatForLocale(overdue, 'nl', 'NL').title).toContain('€');
    expect(formatForLocale(overdue, 'de', 'DE').title).toContain('€');
  });

  test('every (locale, type) combo resolves to a non-empty title+body', () => {
    const fixtures = [
      pickDailyPush({ ...zero, overdueInvoiceCount: 1, overdueInvoiceAmount: 500 })!,
      pickDailyPush({ ...zero, queuePendingCount: 3 })!,
      pickDailyPush({ ...zero, stalingQuoteCount: 2 })!,
      pickDailyPush({ ...zero, jobsTomorrowCount: 1 })!,
    ];
    for (const dec of fixtures) {
      for (const loc of ['en', 'nl', 'de', 'fr', 'es', 'it'] as const) {
        const out = formatForLocale(dec, loc, 'NL');
        expect(out.title.length).toBeGreaterThan(0);
        expect(out.body.length).toBeGreaterThan(0);
        // {count} / {amount} placeholders must be resolved.
        expect(out.title).not.toContain('{count}');
        expect(out.title).not.toContain('{amount}');
        expect(out.body).not.toContain('{count}');
      }
    }
  });
});
