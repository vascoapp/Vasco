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

export function calculateVAT(amount: number, country: string): number {
  return Math.round(amount * getVATRate(country) * 100) / 100;
}

export function extractVATFromGross(grossAmount: number, country: string): number {
  const rate = getVATRate(country);
  return Math.round(grossAmount * (rate / (1 + rate)) * 100) / 100;
}
