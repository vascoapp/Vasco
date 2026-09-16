/**
 * @jest-environment node
 */
// German market facts a contractor relies on, checked against the law and the
// market as they stand (#339, sweep 2026-09-16). Each of these was stale:
//
//  - giropay was shut down at the end of 2024 (Mollie dropped it 30.06.2024)
//    and standalone Sofort ended at Mollie on 30.09.2024 — it is part of
//    Klarna now. Both were still offered as ways for a customer to pay.
//  - Retention: the Bürokratieentlastungsgesetz IV cut invoices and booking
//    vouchers to 8 years (§14b UStG, §147(3) AO, §257 HGB). Books, inventories
//    and annual accounts still run 10. The app said 10 for everything.
//  - A Handelsregister entry is not required of a non-Kaufmann sole trader —
//    Gewerbeanmeldung is, and the Handwerksrolle depends on the trade.
import fs from 'fs';
import path from 'path';
import { GERMAN_RETENTION_PERIODS } from '../types/german-compliance';
import { getPaymentDisplayForCountry } from '../config/paymentMethods';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('retired payment methods are not offered', () => {
  it('the German list has neither giropay nor standalone Sofort', () => {
    const names = getPaymentDisplayForCountry('DE').map((m) => m.name.toLowerCase());
    expect(names).not.toContain('giropay');
    expect(names).not.toContain('sofort');
    // …and still offers the ones that exist.
    expect(names).toEqual(expect.arrayContaining(['sepa', 'klarna']));
  });

  // The union type and the brand-colour map may still NAME them — old rows
  // exist. What matters is the list each market is offered.
  it.each(['src/config/paymentMethods.ts', 'src/integrations/mollie.ts', 'src/services/paymentMarginService.ts'])(
    '%s does not put them in the German list',
    (rel) => {
      // The German entry is a list on the same line in some files and an
      // object spanning a few in others — take a window after each DE marker.
      const lines = stripComments(read(rel)).split('\n');
      const windows: string[] = [];
      lines.forEach((l, i) => {
        if (/\bDE:\s*[[{]|'DE'\)\s*return\s*\[/.test(l)) windows.push(lines.slice(i, i + 6).join('\n'));
      });
      expect(windows.length).toBeGreaterThan(0);
      expect(windows.filter((w) => /giropay|sofort/i.test(w))).toEqual([]);
    },
  );
});

describe('German retention periods are the BEG IV ones', () => {
  it('invoices and booking vouchers are 8 years, books 10', () => {
    expect(GERMAN_RETENTION_PERIODS.rechnungen).toBe(8 * 365);
    expect(GERMAN_RETENTION_PERIODS.buchungsbelege).toBe(8 * 365);
    expect(GERMAN_RETENTION_PERIODS.steuererklaerungen).toBe(10 * 365);
  });

  it.each(['de', 'en', 'nl', 'fr', 'es', 'it'])('%s does not tell a contractor 10 years for invoices', (loc) => {
    const j = JSON.parse(read(`src/i18n/locales/${loc}.json`));
    const foot = Object.values(j).find((v): v is Record<string, string> =>
      typeof v === 'object' && v !== null && 'footnoteGobd' in (v as object))?.footnoteGobd;
    expect(foot).toBeDefined();
    expect(foot).toMatch(/8/);
  });
});

describe('the German legal summary', () => {
  const de = read('app/contractor/legal.tsx');
  it('does not claim a Handelsregister entry is required of everyone', () => {
    expect(de).toMatch(/Gewerbeanmeldung/);
    expect(de).not.toMatch(/body: 'Handelsregister-Eintrag/);
  });
});
