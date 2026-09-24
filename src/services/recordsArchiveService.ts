// =============================================================================
// Records archive — every issued invoice as PDF + e-invoice, in one ZIP.
// =============================================================================
// Export, then delete (user's decision 2026-09-24): the contractor keeps their
// own records, so before deleting they need the INVOICES — not only the JSON
// data export. Each issued invoice becomes:
//   - its PDF, through the one renderer with the shared extras (delivery date,
//     sign-off, FR 2026 mentions), REGENERATED from the current data;
//   - its e-invoice in the market's format (DE XRechnung, FR Factur-X,
//     ES Facturae, IT FatturaPA, other EU: EN 16931 CII; UK/US: none) — only
//     when the details a receiver requires are there;
//   - and README.txt lists whatever could NOT be produced, and why. An archive
//     that silently lacks a document is worse than one that says so.
// NOT plan-gated, unlike the single e-invoice export on the invoice screen:
// this is the contractor's own data on the way out (GDPR Art. 20), not a
// feature (review 2026-09-24, L1).
// The ZIP is streamed to disk entry by entry (StoredZipWriter): hundreds of
// PDFs never sit in memory at once.
// =============================================================================
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type { BusinessProfile } from '../domain/business';
import { getEffectiveVatRate } from '../domain/business';
import type { Invoice } from '../domain/documents';
import { documentNumber } from '../domain/documents';
import type { Customer } from '../domain/customers';
import { findDocumentCustomer } from '../domain/customers';
import {
  buildEInvoiceData, buildEInvoiceSource, invoiceLinesFor, invoicePdfExtras,
  type InvoiceDocInputs, type InvoiceLine,
} from '../domain/invoiceDocuments';
import { pdfInvoiceFromRecord } from './invoicePdfSource';
import { renderInvoicePdfFile } from './invoicePdfService';
import { generateXRechnungXML, generateZUGFeRDXML, generateFacturXXML } from '../integrations/einvoice';
import { toFacturae, toFatturaPA } from '../integrations/einvoiceMapping';
import { generateFacturaeXml } from '../integrations/einvoice-es';
import { generateFatturaPAXml } from '../integrations/einvoice-it';
import { checkInvoiceReadiness } from '../utils/businessProfileValidation';
import { safeZipName, utf8, StoredZipWriter } from '../utils/storedZip';
import { logWarn } from '../utils/errorHandler';
import { localDateKey } from '../utils/dateKey';

type Translate = (key: string, fallback: string, opts?: Record<string, unknown>) => string;

export interface RecordsArchiveInput {
  invoices: ReadonlyArray<Invoice>;
  lineItems: Record<string, ReadonlyArray<InvoiceLine> | undefined>;
  customers: ReadonlyArray<Customer>;
  jobs: ReadonlyArray<{ id: string; completedAt?: string | null; signatureSvg?: string | null; customerSignoffAt?: string | null; customerId?: string | null }>;
  businessProfile: BusinessProfile | null | undefined;
  /** The contractor's country (profile first, account as fallback). */
  country: string;
  t: Translate;
  now?: Date;
  /** Called after each invoice: rendering a long history takes minutes. */
  onProgress?: (done: number, total: number) => void;
}

export interface RecordsArchiveResult {
  ok: boolean;
  invoiceCount: number;
  /** Invoice numbers whose PDF could not be rendered. */
  pdfFailed: string[];
  /** Invoice numbers without an e-invoice, why, and whether that is a gap the
   *  contractor can fix (`fields`, `error`) or simply no format (`noFormat`). */
  xmlMissing: Array<{ number: string; reason: string; kind: 'fields' | 'noFormat' | 'error' }>;
  /** Every issued invoice has its PDF (the e-invoice is extra where a format exists). */
  complete: boolean;
}

const EU_CII = new Set(['NL', 'BE', 'AT', 'LU', 'PT', 'IE', 'FI', 'SE', 'DK', 'PL', 'CZ', 'SK', 'SI', 'HR', 'HU', 'RO', 'BG', 'GR', 'CY', 'MT', 'EE', 'LV', 'LT']);

type XmlOutcome = { suffix: string; xml: string } | { reason: string; kind: 'fields' | 'noFormat' };

/** The e-invoice for one invoice in the market's format, or why there is none. */
function eInvoiceFor(inp: InvoiceDocInputs, sellerMissing: string[], t: Translate): XmlOutcome {
  const c = inp.country;
  const missing = (fields: string[]): XmlOutcome =>
    ({ kind: 'fields', reason: t('recordsArchive.xmlMissingFields', 'missing details: {{fields}}', { fields: fields.join(', ') }) });

  if (c === 'ES' || c === 'IT') {
    const mapped = c === 'ES' ? toFacturae(buildEInvoiceSource(inp)) : toFatturaPA(buildEInvoiceSource(inp));
    if (!mapped.ok) return missing(mapped.missing.map((m) => t(m.key, m.key.split('.').pop() ?? m.key)));
    return c === 'ES'
      ? { suffix: 'facturae', xml: generateFacturaeXml(mapped.document as any) }
      : { suffix: 'fatturapa', xml: generateFatturaPAXml(mapped.document as any) };
  }
  if (c !== 'DE' && c !== 'FR' && !EU_CII.has(c)) {
    return { kind: 'noFormat', reason: t('recordsArchive.xmlNoFormat', 'no e-invoice format for this country') };
  }
  // XRechnung / Factur-X / CII had no field check: an XRechnung without the
  // BR-DE seller contact or address went into the archive as "the e-invoice"
  // (review 2026-09-24, M3). The seller side is the invoice screen's own gate.
  const gaps = [...sellerMissing];
  if (c === 'DE') {
    const buyer = findDocumentCustomer(inp.customers, inp.invoice);
    // BR-DE-8/9: the buyer's city and post code.
    if (!buyer?.city || !buyer?.postcode) gaps.push(t('recordsArchive.buyerAddress', 'customer city and post code'));
  }
  if (gaps.length) return missing(gaps);
  const data = buildEInvoiceData(inp);
  if (c === 'DE') return { suffix: 'xrechnung', xml: generateXRechnungXML(data) };
  if (c === 'FR') return { suffix: 'facturx', xml: generateFacturXXML(data) };
  return { suffix: 'en16931-cii', xml: generateZUGFeRDXML(data) };
}

/**
 * Builds the archive, handing each file to `add` as soon as it exists (the
 * writer streams it to disk). Pure of sharing — the part the tests drive.
 */
export async function buildRecordsArchive(
  input: RecordsArchiveInput,
  add: (name: string, data: Uint8Array) => void,
): Promise<RecordsArchiveResult> {
  const { t } = input;
  const issued = input.invoices.filter((inv) => inv.status !== 'draft');
  // No profile: the country's standard rate, as the screen falls back to one —
  // 0 billed a synthesised line's whole gross as net (review, L3).
  const profileRate = getEffectiveVatRate(input.businessProfile ?? { country: input.country as any }) / 100;
  const readiness = input.businessProfile ? checkInvoiceReadiness(input.businessProfile) : null;
  const sellerMissing = readiness
    ? (readiness.ready ? [] : [...readiness.missingLabels, ...readiness.invalidLabels])
    : [t('recordsArchive.noProfile', 'your business details')];
  const pdfFailed: string[] = [];
  const xmlMissing: RecordsArchiveResult['xmlMissing'] = [];
  const bases = new Set<string>();

  for (const [i, invoice] of issued.entries()) {
    const number = documentNumber(invoice) || invoice.id;
    // One base per INVOICE, so its PDF and XML always pair up — even when two
    // invoices share a number or one PDF fails (review, L4).
    let base = safeZipName(`invoices/${number}`);
    for (let n = 2; bases.has(base); n++) base = safeZipName(`invoices/${number}-${n}`);
    bases.add(base);

    // A retention release carries no new VAT (#354) — same rule as the screen.
    const effectiveRate = (invoice as any).isRetentionRelease ? 0 : profileRate;
    const lines = invoiceLinesFor(invoice, input.lineItems[invoice.id], effectiveRate, t('invoices.services', 'Services rendered'));
    const inp: InvoiceDocInputs = {
      invoice, lines, customers: input.customers, businessProfile: input.businessProfile,
      country: input.country, effectiveRate,
    };

    try {
      const autoInv = pdfInvoiceFromRecord({
        invoice,
        lines,
        customer: findDocumentCustomer(input.customers, invoice) ?? undefined,
        fallbackVatRatePercent: Math.round(effectiveRate * 100),
        fallbackDescription: t('invoices.services', 'Services rendered'),
      });
      const extras = invoicePdfExtras({ invoice, customers: input.customers, jobs: input.jobs, businessProfile: input.businessProfile });
      const uri = await renderInvoicePdfFile(
        { ...autoInv, deliveryDate: extras.deliveryDate ?? autoInv.deliveryDate },
        input.businessProfile as any,
        undefined,
        {
          ...(extras.customerSignature ? { customerSignature: extras.customerSignature } : {}),
          frMentions: extras.frMentions,
        },
      );
      const file = new File(uri);
      add(`${base}.pdf`, await file.bytes());
      try { file.delete(); } catch { /* a cache file; the OS reclaims it */ }
    } catch (err) {
      logWarn('recordsArchive', `PDF for ${number} failed: ${err instanceof Error ? err.message : String(err)}`);
      pdfFailed.push(number);
    }

    try {
      const x = eInvoiceFor(inp, sellerMissing, t);
      if ('xml' in x) add(`${base}-${x.suffix}.xml`, utf8(x.xml));
      else xmlMissing.push({ number, reason: x.reason, kind: x.kind });
    } catch (err) {
      xmlMissing.push({ number, reason: err instanceof Error ? err.message : String(err), kind: 'error' });
    }
    input.onProgress?.(i + 1, issued.length);
  }

  const now = input.now ?? new Date();
  const readme = [
    t('recordsArchive.readmeTitle', 'Invoices — exported from Vasco on {{date}}', { date: localDateKey(now) }),
    '',
    t('recordsArchive.readmeIntro', 'Each issued invoice as a PDF, and as an e-invoice where your country has a format — regenerated from your current details. If your details changed since, the invoices you actually sent are the originals.'),
    '',
    t('recordsArchive.readmeCount', 'Issued invoices: {{count}}', { count: issued.length }),
  ];
  if (pdfFailed.length) {
    readme.push('', t('recordsArchive.readmePdfFailed', 'PDF could not be created (open the invoice in the app and export it there):'));
    for (const n of pdfFailed) readme.push(`  - ${n}`);
  }
  if (xmlMissing.length) {
    readme.push('', t('recordsArchive.readmeXmlMissing', 'No e-invoice in this archive:'));
    for (const m of xmlMissing) readme.push(`  - ${m.number}: ${m.reason}`);
  }
  add('README.txt', utf8(readme.join('\r\n') + '\r\n'));

  return { ok: true, invoiceCount: issued.length, pdfFailed, xmlMissing, complete: pdfFailed.length === 0 };
}

/** Builds the archive straight into a ZIP file and opens the share sheet. */
export async function exportRecordsArchive(input: RecordsArchiveInput): Promise<RecordsArchiveResult> {
  let handle: ReturnType<File['open']> | null = null;
  try {
    const now = input.now ?? new Date();
    const file = new File(Paths.cache, `Vasco-invoices-${localDateKey(now)}.zip`);
    if (file.exists) file.delete();
    file.create();
    handle = file.open();
    // Position every write explicitly: correct whether or not writeBytes
    // advances the handle's offset on its own.
    let pos = 0;
    const h = handle;
    const writer = new StoredZipWriter((bytes) => { h.offset = pos; h.writeBytes(bytes); pos += bytes.length; }, now);
    const result = await buildRecordsArchive(input, (name, data) => writer.add(name, data));
    writer.finish();
    handle.close();
    handle = null;
    // No share sheet (web) = nothing reached the contractor: not a success.
    if (!(await Sharing.isAvailableAsync())) return { ...result, ok: false };
    await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', UTI: 'public.zip-archive', dialogTitle: file.name });
    return result;
  } catch (err) {
    logWarn('recordsArchive', `export failed: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, invoiceCount: 0, pdfFailed: [], xmlMissing: [], complete: false };
  } finally {
    try { handle?.close(); } catch { /* already closed */ }
  }
}
