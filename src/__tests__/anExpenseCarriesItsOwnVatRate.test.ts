/**
 * @jest-environment node
 */
// Every expense was stamped with the country's STANDARD VAT rate — there was
// no way to say otherwise — including the categories that are commonly exempt
// or reduced. A € 500 insurance premium stored € 105,00 of input VAT that was
// never charged, and `vat-prep` reclaims exactly this field as voorbelasting:
// the over-claim goes to the Belastingdienst (#354).
//
// The fix is NOT to decide which categories are exempt. Vasco does not judge
// eligibility — the same principle `getReducedVatRate` states for a quote's
// reduced rate. The contractor picks the rate; the default is unchanged, so
// nothing moves for anyone who does not.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { round2 } from '../domain/business';

const ROOT = path.resolve(__dirname, '../..');
const SRC = stripComments(fs.readFileSync(path.join(ROOT, 'app/contractor/expenses.tsx'), 'utf8'));

describe('the contractor sets the rate on the expense', () => {
  it('the form holds a rate of its own, defaulted to the country standard', () => {
    expect(SRC).toMatch(/const \[newVatPct, setNewVatPct\] = useState<number>\(vatPct\);/);
  });

  it('the saved expense carries THAT rate, not the country standard', () => {
    const at = SRC.indexOf('const handleAddExpense');
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf('const stats', at));
    expect(body).toMatch(/vatRate: newVatPct,/);
    expect(body).toMatch(/vatAmount: round2\(amt \* \(newVatPct \/ 100\)\),/);
    // The stamp that ignored the category entirely.
    expect(body).not.toMatch(/vatRate: vatPct,/);
    expect(body).not.toMatch(/vatAmount: amt \* vatRate,/);
  });

  it('offers exempt and the reduced rate, not only the standard one', () => {
    const at = SRC.indexOf('const vatRateOptions');
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf('}, [vatPct', at));
    expect(body).toMatch(/getReducedVatRate\(/);
    expect(body).toMatch(/getEnergyRenovationVatRate\(/);
    // 0% must always be offered: an exempt supply exists in every market.
    expect(body).toMatch(/\[vatPct, reduced, energy, 0\]/);
    // De-duplicated and ordered, so a country whose reduced rate equals its
    // standard one does not show the same line twice.
    expect(body).toMatch(/Array\.from\(new Set\(/);
  });

  it('is a menu, because the contractor is choosing ONE rate', () => {
    // CLAUDE.md: one-of-N is a DKMenu, never a chip strip.
    const at = SRC.indexOf('items={vatRateOptions.map');
    expect(at).toBeGreaterThan(-1);
    expect(SRC.slice(Math.max(0, at - 400), at)).toMatch(/<DKMenu/);
  });

  it('resets to the default after each add, so a rate does not stick silently', () => {
    expect(SRC).toMatch(/setNewVatPct\(vatPct\);/);
  });

  it('the default follows the profile, which hydrates after the first render', () => {
    // A plain `useState(vatPct)` initialiser freezes at whatever the profile
    // held on mount — 0 before it hydrates — so the form would have defaulted
    // every expense to 0% for a contractor whose profile loaded a tick later.
    // The same shape as the deliveryAddress initialiser in #339.
    expect(SRC).toMatch(/useEffect\(\(\) => \{\s*\n\s*if \(!showAddForm\) setNewVatPct\(vatPct\);\s*\n\s*\}, \[vatPct, showAddForm\]\);/);
  });
});

describe('the amount reclaimed is a cent value', () => {
  it('rounds what a VAT return will claim', () => {
    // 33,33 at 21% is 6.999300000000001 before rounding.
    expect(round2(33.33 * 0.21)).toBe(7);
    expect(round2(500 * 0)).toBe(0);
    expect(round2(95 * 0.21)).toBe(19.95);
  });
});

describe('every market can read the picker', () => {
  it.each(['en', 'nl', 'de', 'fr', 'es', 'it'])('%s has the rate labels', (loc) => {
    const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${loc}.json`), 'utf8'));
    for (const key of ['vatRate', 'vatStandard', 'vatReduced', 'vatExempt']) {
      expect({ loc, key, present: typeof dict.expenses?.[key] === 'string' })
        .toEqual({ loc, key, present: true });
    }
    // The percentage is interpolated, not baked into the sentence.
    expect(dict.expenses.vatStandard).toContain('{{pct}}');
    expect(dict.expenses.vatReduced).toContain('{{pct}}');
  });
});
