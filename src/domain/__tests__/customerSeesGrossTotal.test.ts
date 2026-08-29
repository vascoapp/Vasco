// =============================================================================
// THE NUMBER THE CUSTOMER CONFIRMS IS THE NUMBER THEY WILL BE INVOICED
// =============================================================================
// `Quote.amount` / `documents.total_amount` are NET. Both customer-facing quote
// pages rendered that net figure under a bare "Gesamt / Totaal / Total / Totale"
// — no VAT line — and the confirm button repeated it. The customer accepted
// €6.800; the invoice minted from the same quote was €8.092. The gap is the
// market's VAT rate, so it was worst in Italy (22%) and France (20%).
//
// Third instance of the same unit confusion (#241 the quote screen, #242 the
// invoice confirmation, this one the customer's own page). The first two were
// caught by looking; this guard is here so the third cannot come back silently.
import fs from 'fs';
import path from 'path';
import { VAT_RATES } from '../../constants/taxRates';

const ROOT = path.resolve(__dirname, '../../..');

/** A sibling detector writes decoys into the tree and jest runs suites in
 *  parallel, so never let a missing file throw — return '' and let the
 *  assertion below report a readable failure. */
function read(rel: string): string {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return '';
  }
}

describe('the customer is shown the gross total', () => {
  it('the app sends the gross total, never quote.amount, to the acceptance link', () => {
    const src = read('app/quotes/[id].tsx');
    expect(src).not.toBe('');

    // Every call must pass the screen's computed `total` (net + VAT).
    const calls = src.match(/shareQuoteWithAcceptanceLink\(\{[\s\S]*?\}\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/amount:\s*total\b/);
      expect(call).not.toMatch(/amount:\s*quote\.amount\b/);
    }
  });

  it('verify-quote-token grosses up before it returns or mints anything', () => {
    const fn = read('supabase/functions/verify-quote-token/index.ts');
    expect(fn).not.toBe('');

    // The response and the acceptance row it mints must both carry the gross.
    expect(fn).toMatch(/total:\s*grossTotal/);
    expect(fn).toMatch(/quote_amount:\s*grossTotal/);
    // ...and the breakdown, so the page can show WHY the total is what it is.
    expect(fn).toMatch(/subtotal:\s*netTotal/);
    expect(fn).toMatch(/vatAmount/);
  });

  it('the edge function follows the QUOTE\'s rates, not just the country default', () => {
    // Same rule as `grossFromDocumentLines` in the app: a renovation quoted at
    // the reduced rate must not be shown to the customer grossed at the
    // standard one, or the page and the invoice disagree again — one step
    // further out than the bug this file was written for.
    const fn = read('supabase/functions/verify-quote-token/index.ts');
    expect(fn).toMatch(/vat_rate/);                 // it must ASK for the rates
    expect(fn).toMatch(/standardRate/);             // the country rate is the fallback, not the answer
    // A mixed-rate quote reports no single rate rather than an averaged one.
    expect(fn).toMatch(/hasSingleRate/);
  });

  it('the edge function VAT table matches the app VAT table', () => {
    // The edge function cannot import from `src/`, so the rates are duplicated.
    // A silent drift here would mis-state the total in exactly one market.
    const fn = read('supabase/functions/verify-quote-token/index.ts');
    const block = fn.match(/const VAT_RATES: Record<string, number> = \{([\s\S]*?)\};/);
    expect(block).not.toBeNull();

    const edgeRates: Record<string, number> = {};
    for (const [, country, rate] of block![1].matchAll(/([A-Z]{2}):\s*([0-9.]+)/g)) {
      edgeRates[country] = Number(rate);
    }
    expect(edgeRates).toEqual(VAT_RATES);
  });

  it('the customer page renders a VAT line, not just a total', () => {
    const page = read('admin/src/app/quote/[id]/page.tsx');
    expect(page).not.toBe('');
    // All six markets need the two new labels; a missing one falls back to
    // nothing and the row renders blank.
    expect((page.match(/subtotal:\s*'/g) ?? []).length).toBe(6);
    expect((page.match(/\bvat:\s*'/g) ?? []).length).toBe(6);
    expect(page).toMatch(/quote\.vatAmount/);
  });
});
