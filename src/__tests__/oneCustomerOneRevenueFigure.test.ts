/**
 * @jest-environment node
 */
// The same customer read € 3.200 on the Kunden tab and "€ 2,7 Tsd." on
// Finanzen. Neither figure was a bug in isolation — the Kunden tab summed
// `Invoice.amount`, which is GROSS (#241/#242), while `analyzeFinancials`
// converts to NET because VAT is neither income nor cost for a VAT-registered
// contractor (#354's P&L fix). Two screens, one question, two answers.
//
// The shape: N places answering the same question, none of them agreeing.
// The fix is one exported helper both call, not a second correct division.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { netFromGross, grossFromNet, round2 } from '../domain/business';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('netFromGross is the inverse of grossFromNet', () => {
  it.each([
    [1000, 21],
    [2500.5, 19],
    [840.34, 9],
    [77.47, 22],
    [13.37, 5.5],
  ])('%s at %s%% round-trips', (net, rate) => {
    expect(netFromGross(grossFromNet(net, rate), rate)).toBe(round2(net));
  });

  it('the worked example from the mismatch', () => {
    // € 3.200 gross at 21% is € 2.644,63 net — which is what "€ 2,7 Tsd."
    // was compacting, while the Kunden tab printed the gross.
    expect(netFromGross(3200, 21)).toBe(2644.63);
  });

  it('a Kleinunternehmer / KOR contractor charges no VAT, so nothing divides', () => {
    expect(netFromGross(5000, 0)).toBe(5000);
    // A negative or nonsense rate must not invent a number either.
    expect(netFromGross(5000, -1)).toBe(5000);
    expect(netFromGross(5000, NaN)).toBe(5000);
  });

  it('the result is a whole number of cents', () => {
    for (const gross of [100, 33.33, 1.5, 12345.67, 0.01]) {
      const net = netFromGross(gross, 21);
      expect({ gross, cents: Math.abs(net * 100 - Math.round(net * 100)) < 1e-9 })
        .toEqual({ gross, cents: true });
    }
  });
});

describe('both screens ask the same helper', () => {
  const KUNDEN = read('app/(contractor)/bedrijf.tsx');
  const FINANZEN = read('src/services/financialAnalysisService.ts');

  it('the Kunden tab converts before summing', () => {
    expect(KUNDEN).toMatch(/netFromGross\(inv\.amount \|\| 0, vatRatePercent\)/);
    // The raw gross sum that produced the mismatch.
    expect(KUNDEN).not.toMatch(/\+ \(inv\.amount \|\| 0\);/);
  });

  it('the Kunden tab uses the contractor\'s effective rate, like Finanzen', () => {
    // Not a hardcoded 21 — a Kleinunternehmer would have had their revenue
    // reduced by a VAT they never charged.
    expect(KUNDEN).toMatch(/getEffectiveVatRate\(businessProfile\)/);
    expect(FINANZEN).toMatch(/getEffectiveVatRate\(businessProfile\)/);
  });

  it('the memo re-runs when the profile loads', () => {
    // The profile hydrates a tick after mount, so a dep list without it
    // freezes the rate at 0 and reports gross anyway — the stale-initialiser
    // shape from #354, one level over.
    expect(KUNDEN).toMatch(/\}, \[invoices, customers, businessProfile\]\);/);
  });

  it('neither file open-codes the division any more', () => {
    for (const [name, src] of [['kunden', KUNDEN], ['finanzen', FINANZEN]] as const) {
      expect({ name, openCoded: /\/ \(1 \+ [\w.]*[Vv]at\w*RatePercent \/ 100\)/.test(src) })
        .toEqual({ name, openCoded: false });
    }
    expect(FINANZEN).toMatch(/netFromGross\(grossAmount, vatRatePercent \?\? 0\)/);
  });

  it('every figure the Kunden tab shows comes from the one converted map', () => {
    // total, hero card and the per-contact meta line all derive from
    // `customerRevenue`, so fixing the map fixes all of them — and a future
    // figure that does NOT come from it is the regression to catch.
    expect(KUNDEN).toMatch(/const totalRevenue = useMemo\(\(\) => Object\.values\(customerRevenue\)/);
    expect(KUNDEN).toMatch(/Object\.entries\(customerRevenue\)\.sort/);
  });
});
