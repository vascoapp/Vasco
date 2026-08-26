// =============================================================================
// ONE FIELD, ONE UNIT — Invoice.amount is GROSS on every path that mints one
// =============================================================================
// `Quote.amount` is the NET sum of its line items. `Invoice.amount` is GROSS
// everywhere in the app. Three code paths cross that boundary and they did not
// agree: `addInvoiceFromJob` grossed up at the profile rate, `addInvoice` — the
// most travelled of the three — copied the quote's net straight across, and
// the three PROJECT paths (term, change order, retention release) stored net.
//
// The project ones were the worst of the set and were recorded as a known
// deviation rather than fixed. They are not merely a reporting bug:
// `app/invoices/[id].tsx` synthesises a line as `amount / (1 + rate)` when a
// document has no line items, and these documents have none — so it divided the
// net back out and re-grossed it to itself. An aannemer's €24.000 instalment
// rendered a total of €24.000 with a VAT line of €0. Fixed 2026-08-26; the
// boundary now lives in AppState and progressBillingService stays in contract
// (net) money.
//
// Walking it on device: invoice I-OFF-02BD5D showed "Gesamt 126,14 €" on its
// own detail screen while carrying amount = 106, and Finanzen's UMSATZ rose by
// exactly 106. A contractor billing from quotes under-reported revenue by the
// VAT; one billing from jobs reported gross; the KPI summed both together.
//
// These pin the conversion itself, so the two callers cannot drift apart again.
// =============================================================================

import { grossFromNet, getEffectiveVatRate } from '../business';

describe('grossFromNet', () => {
  it('adds VAT and rounds to cents, not to whole euros', () => {
    // The exact case from the walk: one 106,00 € line at the German rate.
    expect(grossFromNet(106, 19)).toBe(126.14);
  });

  it('returns the net unchanged at 0% — KOR / Kleinunternehmer owe no VAT', () => {
    expect(grossFromNet(106, 0)).toBe(106);
    expect(grossFromNet(0, 19)).toBe(0);
  });

  it('uses the country rate, never a hardcoded NL 21%', () => {
    expect(grossFromNet(100, 19)).toBe(119); // DE
    expect(grossFromNet(100, 21)).toBe(121); // NL
    expect(grossFromNet(100, 20)).toBe(120); // FR
  });

  it('rounds half-cents rather than truncating them away', () => {
    // 33.33 * 1.19 = 39.6627 -> 39.66; 8.41 * 1.19 = 10.0079 -> 10.01
    expect(grossFromNet(33.33, 19)).toBe(39.66);
    expect(grossFromNet(8.41, 19)).toBe(10.01);
  });

  it('is what BOTH invoice paths apply, so an equal net gives an equal gross', () => {
    // addInvoice grosses the quote's net; addInvoiceFromJob grosses the job's
    // actuals net. Same helper, same rate -> the same number, which is the
    // property that was violated before.
    const net = 106;
    const rate = getEffectiveVatRate({ country: 'DE', vatScheme: 'standard' });
    expect(rate).toBe(19);
    expect(grossFromNet(net, rate)).toBe(126.14);
    expect(grossFromNet(net, rate)).toBeGreaterThan(net);
  });

  it('grosses a progress instalment, so a termijnfactuur charges VAT at all', () => {
    // 30% of an 80.000 contract, NL. Before the fix this document carried
    // 24.000 in a field the detail screen treats as gross, so the customer was
    // billed 24.000 with a VAT line of zero — 5.040 the contractor never
    // charged, on a single instalment.
    const netTerm = 80_000 * 0.3;
    expect(grossFromNet(netTerm, 21)).toBe(29_040);
  });

  it('grosses the retention withheld from that instalment in the SAME unit', () => {
    // `amount - retentionAmount` is what the customer pays now, and
    // `retentionHeld` sums these retentions into the release invoice's own
    // `amount`. A net retention subtracted from a gross amount would overstate
    // the payment due AND put a net figure back into a gross field one document
    // later, so both cross the boundary together.
    const netTerm = 80_000 * 0.3;
    const grossTerm = grossFromNet(netTerm, 21);
    const grossRetention = grossFromNet(netTerm * 0.05, 21);
    expect(grossRetention).toBe(1452);
    // Payable now stays a clean 95% of the gross document.
    expect(grossTerm - grossRetention).toBeCloseTo(grossTerm * 0.95, 2);
  });

  it('a Kleinunternehmer profile resolves to 0%, so invoices bill the net', () => {
    const rate = getEffectiveVatRate({
      country: 'DE',
      vatScheme: 'small_business_DE_kleinunternehmer',
    });
    expect(rate).toBe(0);
    expect(grossFromNet(250, rate)).toBe(250);
  });
});
