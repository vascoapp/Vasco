// =============================================================================
// Facturae export: sign or not, and what to tell the contractor when not
// =============================================================================
// DECISIONS (2026-10-01):
//   · Public body, FACe-only (NIF P / S): a signature is REQUIRED. No stored
//     certificate → "needCertificate" (the screen offers the certificate
//     screen); an expired / wrong-NIF certificate → "certificateProblem".
//     Never an unsigned file FACe would bounce.
//   · Everyone else (B2B, and Q bodies that may sit outside FACe): signed WHEN
//     a usable certificate is stored, unsigned otherwise. Trade-off: a signed
//     B2B Facturae proves origin and integrity (and RD 238/2026 will require an
//     advanced signature on private-platform B2B exchange once B2B
//     e-invoicing applies), at the cost of the file carrying the contractor's
//     certificate (name + NIF, already on the invoice). A certificate that
//     has expired is NOT used for B2B — the file goes out unsigned, which is
//     valid between businesses (RD 1619/2012 art. 10), rather than blocked.
// =============================================================================

import type { TFunction } from 'i18next';
import { isFaceOnlyNif } from '../integrations/fiscalIds';
import { signFacturae } from '../integrations/facturaeSignature';
import { judgeStoredCertificate, type CertificateInfo, type CertificateProblem } from '../integrations/signingCertificate';
import { loadSigningCertificate } from './signingCertificateStore';
import { formatDateShortAuto } from '../i18n/formatting';
import { logWarn } from '../utils/errorHandler';

/** The seller NIF a certificate must carry — the field toFacturae reads (vatNumber ?? registrationNumber). */
export const sellerNifOf = (bp: Record<string, any> | null | undefined): string | undefined =>
  (bp?.vatNumber || bp?.registrationNumber || undefined) as string | undefined;

export type FacturaeSignOutcome =
  | { kind: 'signed'; xml: string; info: CertificateInfo }
  /** `because`: a certificate IS stored but cannot sign (expired, other NIF…)
   *  — the contractor is told, not left to find out at the next FACe invoice. */
  | { kind: 'unsigned'; xml: string; because?: { problem: CertificateProblem; info?: CertificateInfo } }
  | { kind: 'needCertificate' }
  | { kind: 'certificateProblem'; problem: CertificateProblem; info?: CertificateInfo }
  | { kind: 'failed' };

export async function signFacturaeForExport(
  xml: string,
  opts: { buyerNif: string | undefined; sellerNif: string | undefined; owner: string | null | undefined; now?: Date },
): Promise<FacturaeSignOutcome> {
  const required = isFaceOnlyNif(opts.buyerNif);
  const stored = await loadSigningCertificate(opts.owner);
  if (!stored) return required ? { kind: 'needCertificate' } : { kind: 'unsigned', xml };
  const judged = judgeStoredCertificate(stored.material, opts.sellerNif, opts.now);
  if (!judged.ok) {
    return required
      ? { kind: 'certificateProblem', problem: judged.problem, info: judged.info }
      : { kind: 'unsigned', xml, because: { problem: judged.problem, info: judged.info } };
  }
  try {
    return { kind: 'signed', xml: signFacturae(xml, judged.material, { signingTime: opts.now }), info: judged.info };
  } catch (err) {
    // The message names a reference or a key mismatch — never key material.
    logWarn('FacturaeSigning', `signing failed: ${(err as Error)?.message ?? 'error'}`);
    return { kind: 'failed' };
  }
}

export function certificateProblemText(t: TFunction | ((k: string, o?: any) => string), problem: CertificateProblem, info: CertificateInfo | undefined, nif: string | undefined): string {
  const tt = t as (k: string, o?: any) => string;
  const date = (iso?: string) => (iso ? formatDateShortAuto(iso) : '');
  switch (problem) {
    case 'unreadable': return tt('facturaeCertificate.problem.unreadable', 'Wrong password, or not a .p12 / .pfx certificate file.');
    case 'noKey': return tt('facturaeCertificate.problem.noKey', 'This file has no private key. Export the certificate together with its private key (.p12 / .pfx).');
    case 'notRsa': return tt('facturaeCertificate.problem.notRsa', 'This certificate uses a key type the Facturae signature policy does not accept (RSA is required).');
    case 'expired': return tt('facturaeCertificate.problem.expired', { date: date(info?.notAfter), defaultValue: 'This certificate expired on {{date}}.' });
    case 'notYetValid': return tt('facturaeCertificate.problem.notYetValid', { date: date(info?.notBefore), defaultValue: 'This certificate is not valid until {{date}}.' });
    case 'noNif': return tt('facturaeCertificate.problem.noNif', 'This certificate carries no Spanish NIF.');
    case 'cannotSign': return tt('facturaeCertificate.problem.cannotSign', 'This certificate is not for signing (it is only for logging in). Import the certificate your provider issued for electronic signatures.');
    case 'nifMismatch': return tt('facturaeCertificate.problem.nifMismatch', { nif: nif ?? '—', defaultValue: 'This certificate does not carry your business\'s NIF ({{nif}}). An invoice must be signed by its issuer — check the NIF/CIF in your business profile or import your own certificate.' });
  }
}
