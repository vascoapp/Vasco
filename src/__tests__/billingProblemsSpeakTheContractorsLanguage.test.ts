// Project-billing refusals were English sentences shown raw to a Dutch
// aannemer: '"Extra stopcontacten keuken" is approved but has no record of the
// price warning (art. 7:755 BW)' (walk, 2026-09-29). Every problem the service
// produces carries an i18nKey, and every key resolves in every locale.
import fs from 'fs';
import path from 'path';
import appI18n from '../i18n/i18n';
import {
  validateBillingSchedule, validateChangeOrders, canInvoiceChangeOrder, canReleaseRetention,
} from '../services/progressBillingService';
import { billingProblemText } from '../services/billingProblemText';

const order = (over: object) => ({ id: 'co1', title: 'Extra stopcontacten', amount: 450.75, status: 'approved', sortOrder: 1, ...over }) as any;

const problems = () => [
  ...validateBillingSchedule({
    totalQuoted: 1000, totalBudget: 1000, retentionPercent: 150, milestones: [],
    billingTerms: [
      { id: 't1', title: 'Start', basis: 'percent', percent: 80, sortOrder: 1, status: 'planned', milestoneId: 'gone' },
      { id: 't2', title: 'Eind', basis: 'percent', percent: 0, sortOrder: 1, status: 'planned' },
      { id: 't3', title: 'Vast', basis: 'fixed', amount: 2000, sortOrder: 2, status: 'planned' },
      { id: 't4', title: 'Neg', basis: 'percent', percent: 30, sortOrder: 3, status: 'planned' },
    ],
  } as any),
  ...validateChangeOrders({ totalQuoted: 100, totalBudget: 100, changeOrders: [order({ amount: -500 }), order({ id: 'co2', amount: 0, sortOrder: 1 }), order({ id: 'co3' })] } as any),
  canInvoiceChangeOrder(order({ status: 'invoiced' })),
  canInvoiceChangeOrder(order({ status: 'rejected' })),
  canInvoiceChangeOrder(order({ status: 'draft' })),
  canInvoiceChangeOrder(order({ amount: 0 })),
  canInvoiceChangeOrder(order({})),
  canReleaseRetention({ status: 'active', billingTerms: [] } as any, 0),
  canReleaseRetention({ status: 'active', billingTerms: [] } as any, 100),
  canReleaseRetention({ status: 'completed', billingTerms: [{ status: 'planned' }, { status: 'planned' }] } as any, 100),
];

it('every refusal carries an i18nKey', () => {
  const missing = problems().filter((p: any) => (p.message || p.reason) && !p.i18nKey);
  expect(missing).toEqual([]);
});

it.each(['en', 'nl', 'de', 'fr', 'es', 'it'])('%s has every billingProblem key', (loc) => {
  const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../i18n/locales/${loc}.json`), 'utf8'));
  for (const p of problems() as any[]) {
    if (!p.i18nKey) continue;
    const [grp, key] = p.i18nKey.split('.');
    const node = j.billingProblem?.[grp] ?? {};
    expect(node[key] ?? node[`${key}_other`]).toBeTruthy();
  }
});

it('renders Dutch, with the amount formatted, and never the English fallback', async () => {
  await appI18n.changeLanguage('nl');
  const out = (problems() as any[]).filter((p) => p.i18nKey).map((p) => billingProblemText(p));
  const english = (problems() as any[]).filter((p) => p.i18nKey).map((p) => p.message ?? p.reason);
  out.forEach((txt, i) => expect(txt).not.toBe(english[i]));
  expect(out.join(' ')).toMatch(/is door de klant afgewezen/);
  expect(out.join(' ')).toMatch(/€\s?1\.000,00/);   // contract value formatted, not "1000"
  await appI18n.changeLanguage('en');
});
