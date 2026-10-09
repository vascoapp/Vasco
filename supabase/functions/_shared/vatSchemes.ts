// The VAT schemes under which a seller charges NO VAT. ONE list for the app
// (src/domain/business.ts isSmallBusinessExempt) and the customer portal
// (verify-quote-token): the portal kept its own copy, which would have shown a
// UK trader who is not VAT-registered a VAT line the app never charged
// (2026-10-09). Pure TypeScript — jest imports it, Deno imports it.
export const EXEMPT_VAT_SCHEMES = [
  'small_business_NL_KOR',
  'small_business_DE_kleinunternehmer',
  'small_business_UK_unregistered',
] as const;

export function isExemptVatScheme(scheme: string | null | undefined): boolean {
  return !!scheme && (EXEMPT_VAT_SCHEMES as readonly string[]).includes(scheme);
}
