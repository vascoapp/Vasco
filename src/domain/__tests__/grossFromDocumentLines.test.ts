// A quote agreed at a reduced rate must become an invoice at that rate.
//
// `addInvoice` grossed every quote at the country's STANDARD rate while copying
// the quote's line items — rates included — onto the invoice. A French
// renovation quoted at 10% became an invoice whose lines said 10% and whose
// amount had been grossed at 20%: the customer billed the wrong VAT, and the
// document disagreeing with itself. Latent for NL 9% since that toggle shipped;
// reachable for FR/IT/ES the moment they got a reduced rate.
import { grossFromDocumentLines, grossFromNet } from '../business';

const line = (net: number, vatRate?: number) => ({ quantity: 1, unitPrice: net, vatRate });

describe('grossFromDocumentLines', () => {
  it('uses the quote\'s agreed reduced rate, not the country standard', () => {
    // FR renovation: 1000 net at 10%, contractor's standard rate is 20%.
    expect(grossFromDocumentLines(1000, [line(1000, 10)], 20)).toBeCloseTo(1100, 2);
    // IT ristrutturazione: standard is 22%.
    expect(grossFromDocumentLines(1000, [line(1000, 10)], 22)).toBeCloseTo(1100, 2);
    // NL, the case that was already live and wrong.
    expect(grossFromDocumentLines(1000, [line(1000, 9)], 21)).toBeCloseTo(1090, 2);
  });

  it('sums a MIXED-rate quote line by line', () => {
    // NL plumbing: 9% labour + 21% materials. One blended rate cannot express
    // this, which is why the lines are summed rather than a rate picked.
    const gross = grossFromDocumentLines(1000, [line(600, 9), line(400, 21)], 21);
    expect(gross).toBeCloseTo(600 * 1.09 + 400 * 1.21, 2);
  });

  it('honours a single agreed rate even when the lines no longer add up', () => {
    // A discount or a hand-edited total makes the line sum drift from `amount`.
    // The agreed RATE is still the agreed rate.
    expect(grossFromDocumentLines(900, [line(1000, 10)], 20)).toBeCloseTo(990, 2);
  });

  it('falls back to the profile rate when the quote carries no rates', () => {
    expect(grossFromDocumentLines(1000, [line(1000, undefined)], 20)).toBeCloseTo(1200, 2);
    expect(grossFromDocumentLines(1000, [], 20)).toBeCloseTo(1200, 2);
    expect(grossFromDocumentLines(1000, undefined, 20)).toBeCloseTo(1200, 2);
  });

  it('falls back when only SOME lines carry a rate', () => {
    // A half-rated document is not evidence of an agreed rate.
    expect(grossFromDocumentLines(1000, [line(600, 10), line(400, undefined)], 20))
      .toBeCloseTo(1200, 2);
  });

  it('falls back on mixed rates that do not reconcile with the total', () => {
    expect(grossFromDocumentLines(900, [line(600, 9), line(400, 21)], 21))
      .toBeCloseTo(grossFromNet(900, 21), 2);
  });

  it('exempt beats every line rate — KOR / Kleinunternehmer charge nothing', () => {
    expect(grossFromDocumentLines(1000, [line(1000, 21)], 0)).toBeCloseTo(1000, 2);
  });

  it('agrees with grossFromNet whenever there is one rate and it reconciles', () => {
    for (const r of [9, 10, 19, 20, 21, 22]) {
      expect(grossFromDocumentLines(1000, [line(1000, r)], 21))
        .toBeCloseTo(grossFromNet(1000, r), 2);
    }
  });
});
