/**
 * The "Why now?" line under a queue card is in the contractor's language and
 * cites nothing we did not measure (sweep 2026-09-23, E4).
 *
 * They were English template literals on every market, and most carried
 * invented statistics — "customers rate satisfaction 40% higher", "converts
 * 30% more quotes", "3x more likely to refer", "average time-to-invoice for
 * your trade is 2 days". The customer context line ("Repeat customer, 3 jobs,
 * slow payer") was English too.
 *
 * REAL i18next (jest.setup stubs it with a t that ignores the language).
 */
jest.unmock('../../i18n/i18n');
// jest.setup stubs this to return null in EVERY test — so no unit test had
// ever seen a customer context line. Real module here.
jest.unmock('../../intelligence/tradeContext');
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }] }));

import { readFileSync } from 'fs';
import { join } from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../i18n/i18n';
import { setAccountLanguage } from '../../i18n/savedLanguage';
import { stripComments } from '../../utils/stripComments';
import { populateQueue, getQueue } from '../aiActionQueueService';

const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'].map((l) => [l, require(`../../i18n/locales/${l}.json`)] as const);

beforeEach(async () => {
  await AsyncStorage.clear();
  setAccountLanguage(undefined);
  await i18n.changeLanguage('en');
});
afterAll(async () => { await i18n.changeLanguage('en'); });

it('a German contractor on an English phone gets German reasons and customer context', async () => {
  await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify({ language: 'de', country: 'DE' }));
  const jobs = [
    { id: 'j1', title: 'Bad', status: 'completed', customerId: 'c1', quotedAmount: 500, completedAt: new Date().toISOString() },
    { id: 'j2', title: 'Küche', status: 'completed', customerId: 'c1', quotedAmount: 700, completedAt: new Date().toISOString() },
  ];
  const overdue = [{ id: 'RE-1', customerId: 'c1', customer: 'c1', amount: 300, status: 'overdue', dueDate: new Date(Date.now() - 20 * 864e5).toISOString() }];
  await populateQueue({
    completedJobs: jobs, overdueInvoices: overdue, sentQuotes: [], expiringCerts: [],
    allJobs: jobs, allInvoices: overdue, customers: [{ id: 'c1', name: 'Familie Becker' }], country: 'DE',
  });
  const cards = await getQueue();
  const reasons = cards.map((c) => c.preparedData?.reasoning).filter(Boolean) as string[];
  const contexts = cards.map((c) => c.preparedData?.customerContext).filter(Boolean) as string[];
  expect(reasons.length).toBeGreaterThan(0);
  expect(contexts.length).toBeGreaterThan(0);
  for (const r of [...reasons, ...contexts]) {
    expect(r).not.toMatch(/\b(Job completed|overdue|Repeat customer|jobs?\b|payer|Invoice promptly|Sending a reminder)/);
  }
  expect(reasons.join(' ')).toContain('Auftrag abgeschlossen');
  expect(contexts.join(' ')).toContain('Stammkunde');
  // The name, not the id in `inv.customer`.
  expect(reasons.join(' ')).not.toContain('c1 —');
});

it('no reason or compliance card, in any language, cites an unmeasured statistic', () => {
  for (const [loc, json] of LOCALES) {
    const all = { ...json.aiQueue.why, ...json.complianceAgent } as Record<string, unknown>;
    for (const [k, v] of Object.entries(all)) {
      if (typeof v !== 'string') continue;
      // Any "N–M days" range (hyphen or en-dash) is a claimed duration nobody measured.
      expect(`${loc}.${k}: ${v}`).not.toMatch(/\d+\s?%\s?(higher|more|meer|mehr|plus|más|più)|\dx\b|\d+\s?[-–]\s?\d+\s?(business|working|werk|Werk|jours|días|giorni)/i);
    }
  }
});

it('counts agree with their noun: "1 paid invoice", not "1 paid invoices" (review)', async () => {
  await i18n.changeLanguage('de');
  expect(i18n.t('aiQueue.why.export', { count: 1 })).toMatch(/^1 bezahlte Rechnung ist/);
  expect(i18n.t('aiQueue.why.export', { count: 3 })).toMatch(/^3 bezahlte Rechnungen sind/);
  expect(i18n.t('aiQueue.why.certRenewal', { count: 1 })).toMatch(/morgen/);
  await i18n.changeLanguage('en');
  expect(i18n.t('aiQueue.why.handover', { count: 1, hours: '2.0' })).toContain('(1 photo,');
});

it('the late-fee line names the right law and term', async () => {
  await i18n.changeLanguage('nl');
  expect(i18n.t('aiQueue.why.lateFee', { days: 30, rate: '12,15', interest: '€ 5', fee: '€ 40' })).toContain('wettelijke handelsrente');
  await i18n.changeLanguage('en');
  expect(i18n.t('aiQueue.why.lateFeeUK', { days: 30, rate: '12', interest: '£5', fee: '£40' })).toContain('Late Payment of Commercial Debts (Interest) Act 1998');
  const src = stripComments(readFileSync(join(__dirname, '../aiActionQueueService.ts'), 'utf8'));
  expect(src).toMatch(/feeCountry === 'UK' \? 'aiQueue\.why\.lateFeeUK'/);
});

it('no reasoning is written as a literal in code', () => {
  const src = stripComments(readFileSync(join(__dirname, '../aiActionQueueService.ts'), 'utf8'));
  expect(src).not.toMatch(/reasoning:\s*[`'"]/);
});
