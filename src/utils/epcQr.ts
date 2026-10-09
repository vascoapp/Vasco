// =============================================================================
// THE BANK-TRANSFER QR CODE ON AN INVOICE (EPC069-12, "GiroCode")
// =============================================================================
// User, 2026-10-09: one payment method that works in every EU market. This is
// the free one: the European Payments Council's SEPA credit-transfer QR. The
// customer scans it with their banking app and the transfer is filled in —
// beneficiary, IBAN, amount, the invoice number as the reference. No account,
// no provider, no fee; the money goes straight to the contractor's IBAN.
//
// Only where it is TRUE:
//   - a SEPA credit transfer is in EURO — so EUR invoices only (NL, DE, FR,
//     ES, IT). The UK pays in pounds by Faster Payments; it gets no code.
//   - the IBAN must be valid (checksum) — a QR that fills in a wrong account
//     sends a customer's money nowhere;
//   - something must be payable (not paid, amount > 0).
// It does not claim the invoice gets marked paid: a transfer is matched by the
// contractor, as with any bank transfer.
//
// Payload (EPC069-12 v002): newline-separated, at most 331 bytes,
//   BCD · 002 · 1 (UTF-8) · SCT · BIC (optional in v002) · name (≤70) ·
//   IBAN · EUR<amount> · purpose (empty) · structured ref (empty) ·
//   unstructured remittance (≤140) · info (empty)
// Error-correction level M, as the standard asks.
// =============================================================================

import qrcode from 'qrcode-generator';
import { isValidIBAN } from './validation';

// The standard declares the character set (line 3 = "1" = UTF-8); the
// library's default byte mapping is Latin-1, which would garble "Müller".
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

export interface EpcTransfer {
  /** Who is paid — the contractor's business name. */
  name: string;
  iban: string;
  bic?: string | null;
  /** In euro. */
  amount: number;
  /** What the customer's bank statement says — the invoice number. */
  reference: string;
}

/** EUR-only: the markets where a SEPA credit transfer is how invoices get paid. */
export const EPC_QR_COUNTRIES = ['NL', 'DE', 'FR', 'ES', 'IT'] as const;

export function epcQrApplies(country: string | null | undefined): boolean {
  return (EPC_QR_COUNTRIES as readonly string[]).includes((country ?? '').toUpperCase());
}

/** Newlines would break the line structure; the standard counts characters. */
const clean = (s: string, max: number) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, max);

/** The EPC payload, or null when a code would not be true (see header). */
export function epcPayload(t: EpcTransfer): string | null {
  const iban = (t.iban ?? '').replace(/\s/g, '').toUpperCase();
  if (!iban || !isValidIBAN(iban)) return null;
  const name = clean(t.name ?? '', 70);
  if (!name) return null;
  if (!Number.isFinite(t.amount) || t.amount < 0.01 || t.amount > 999999999.99) return null;
  const bic = (t.bic ?? '').replace(/\s/g, '').toUpperCase();
  const lines = [
    'BCD',
    '002',
    '1',
    'SCT',
    /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic) ? bic : '',
    name,
    iban,
    `EUR${t.amount.toFixed(2)}`,
    '',
    '',
    clean(t.reference ?? '', 140),
    '',
  ];
  // Trailing empty lines may be dropped (EPC069-12 §3.4).
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const payload = lines.join('\n');
  // The standard's hard limit, in BYTES.
  // (The library's own UTF-8 encoder — TextEncoder is not on every Hermes.)
  if (qrcode.stringToBytes(payload).length > 331) return null;
  return payload;
}

/** The code's dark modules (no quiet zone) — for drawers other than SVG (pdf-lib). */
export function epcQrMatrix(payload: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(payload, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/**
 * The QR as an inline SVG (black on white, quiet zone of 4 modules) — for the
 * PDF's HTML, which prints it as vectors.
 */
export function epcQrSvg(payload: string, sizePx: number = 120): string {
  const qr = qrcode(0, 'M');
  qr.addData(payload, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  const total = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`
    + `<rect width="${total}" height="${total}" fill="#FFFFFF"/><path d="${d}" fill="#000000"/></svg>`;
}
