import { logWarn } from '../utils/errorHandler';

export const VAT_RATES: Record<string, number> = {
  NL: 0.21,
  DE: 0.19,
  FR: 0.20,
  ES: 0.21,
  IT: 0.22,
  UK: 0.20,
  // The US has no VAT. Sales tax is a different tax, levied by state and
  // locality on the SALE, and this app does not compute it. US was simply
  // absent from this table, so every US amount fell through to the Dutch 21%
  // below (#339).
  US: 0,
};

/**
 * The country's standard VAT rate, as a decimal.
 *
 * An unknown country returns 0 rather than the Dutch rate. Inventing a tax
 * figure is the worse failure: 21% on an unknown market silently overstates a
 * reclaim and puts tax on a document nobody can defend. 0 is visibly wrong and
 * costs nobody a claim they were entitled to.
 */
export function getVATRate(country: string): number {
  const rate = VAT_RATES[country];
  if (rate === undefined) {
    logWarn('taxRates', `no VAT rate for country "${country}" — using 0`);
    return 0;
  }
  return rate;
}

/**
 * Every VAT rate a supplier in this country can legitimately have charged —
 * i.e. the rates a contractor may need to RECORD on an expense, in percent.
 *
 * This is deliberately NOT `getReducedVatRate`. That one answers a different
 * question: which reduced rate a contractor may CHARGE on renovation work,
 * which is an eligibility assertion about their own job and is null for DE by
 * design. Reusing it for expenses meant a German contractor could not record a
 * 7 % purchase at all — only 19 % or exempt (#354, found on the device).
 *
 * Getting an entry wrong here costs nothing but an option the contractor does
 * not need: nothing is applied automatically, the rate is always picked by
 * hand, and the standard rate stays the default.
 */
export const PURCHASE_VAT_RATES: Record<string, number[]> = {
  NL: [21, 9, 0],
  DE: [19, 7, 0],
  // FR also has 5.5 (energy renovation, food, books) and 2.1 (press, some
  // medicines) — a tradesperson sees 5.5 on insulation materials.
  FR: [20, 10, 5.5, 2.1, 0],
  ES: [21, 10, 4, 0],
  IT: [22, 10, 5, 4, 0],
  UK: [20, 5, 0],
  // No VAT: a US expense carries sales tax, which this app does not compute.
  US: [0],
};

export function purchaseVatRates(country: string): number[] {
  const rates = PURCHASE_VAT_RATES[country];
  if (!rates) {
    // Same principle as `getVATRate`: an unknown market gets the honest
    // minimum rather than another country's table.
    logWarn('taxRates', `no purchase VAT rates for country "${country}" — offering 0 only`);
    return [0];
  }
  return rates;
}

export function calculateVAT(amount: number, country: string): number {
  return Math.round(amount * getVATRate(country) * 100) / 100;
}

export function extractVATFromGross(grossAmount: number, country: string): number {
  const rate = getVATRate(country);
  return Math.round(grossAmount * (rate / (1 + rate)) * 100) / 100;
}
