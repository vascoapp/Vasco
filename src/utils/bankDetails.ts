// Where a customer pays by bank transfer, in the form their bank asks for.
//
// UK domestic payments go by SORT CODE + ACCOUNT NUMBER; a UK invoice that
// printed only an IBAN made the customer convert it (UK walk, 2026-10-08). The
// US uses routing + account (ACH). Everyone else: IBAN.
//
// Storage: `routingNumber` (business_settings.routing_number) is the DOMESTIC
// BANK CODE — the US ABA routing number, the UK sort code. `bankAccountNumber`
// is the account in both. No second column for one concept.

/** "200000" / "20 00 00" / "20-00-00" → "20-00-00"; anything else unchanged. */
export function formatSortCode(raw: string | undefined | null): string {
  const d = (raw ?? '').replace(/\D/g, '');
  return d.length === 6 ? `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}` : (raw ?? '').trim();
}

export function isValidSortCode(raw: string | undefined | null): boolean {
  return (raw ?? '').replace(/[\s-]/g, '').match(/^\d{6}$/) !== null;
}

export function isValidUkAccountNumber(raw: string | undefined | null): boolean {
  return (raw ?? '').replace(/\s/g, '').match(/^\d{8}$/) !== null;
}

export interface BankLineLabels {
  sortCode: string;
  account: string;
  routing: string;
}

/**
 * The line that tells the customer where to pay, or null when nothing usable is
 * on file. UK: sort code + account when both are there, else the IBAN.
 */
export function bankTransferLine(
  p: { country?: string | null; routingNumber?: string | null; bankAccountNumber?: string | null; iban?: string | null } | null | undefined,
  labels: BankLineLabels,
): string | null {
  if (!p) return null;
  const code = (p.routingNumber ?? '').trim();
  const account = (p.bankAccountNumber ?? '').trim();
  if (p.country === 'UK' && code && account) {
    return `${labels.sortCode} ${formatSortCode(code)} · ${labels.account} ${account}`;
  }
  if (p.country === 'US') {
    if (!code && !account) return null;
    return [code && `${labels.routing} ${code}`, account && `${labels.account} ${account}`].filter(Boolean).join(' · ');
  }
  const iban = (p.iban ?? '').trim();
  return iban || null;
}
