export const VAT_RATES: Record<string, number> = {
  NL: 0.21,
  DE: 0.19,
  FR: 0.20,
  ES: 0.21,
  IT: 0.22,
  UK: 0.20,
};

export function getVATRate(country: string): number {
  return VAT_RATES[country] ?? 0.21;
}

export function calculateVAT(amount: number, country: string): number {
  return Math.round(amount * getVATRate(country) * 100) / 100;
}

export function extractVATFromGross(grossAmount: number, country: string): number {
  const rate = getVATRate(country);
  return Math.round(grossAmount * (rate / (1 + rate)) * 100) / 100;
}
