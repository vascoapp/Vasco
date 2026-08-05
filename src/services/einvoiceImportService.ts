// =============================================================================
// E-INVOICE IMPORT — a supplier's XRechnung, read and turned into data
// =============================================================================
// Two things happen when a supplier sends a structured e-invoice, and only one
// of them is obvious.
//
// The obvious one: the contractor cannot open it. From 1 January 2025 every
// German business must be able to RECEIVE structured invoices, and merchants
// are already sending them. An XRechnung arrives, it is XML, and it looks like
// nothing. That is a real problem today, two years before the same contractor
// is obliged to issue one.
//
// The one that matters more: an XRechnung is PERFECT pricing data. The moat is
// currently fed by photographing invoices and running vision extraction over
// them — which works, and which needs a confidence gate, an arithmetic check
// and a tolerance for mis-read decimals. A structured invoice needs none of
// that. It arrives with article numbers, quantities, units and unit prices as
// declared by the supplier. The mandate is about to force every merchant in
// four countries to send that data to our users, for free, at scale.
//
// So this deliberately reuses the existing pipeline rather than building a
// parallel one: parseEInvoiceXml (already written and tested, previously with
// no callers at all) produces the same ScannedInvoice shape the photo path
// produces, and it feeds the same feedPricingMoat. One downstream, two intakes.
//
// The arithmetic gate in feedPricingMoat still applies. A structured invoice
// should sail through it — and if one does not, the supplier's document really
// does not add up, which is worth knowing before it poisons the price history.
// =============================================================================

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseEInvoiceXml, detectFormat, extractZugferdXml } from '../integrations/einvoiceParser';
import { feedPricingMoat, type ScannedInvoice } from './invoiceScanService';
import { logWarn } from '../utils/errorHandler';

export interface ImportResult {
  ok: boolean;
  invoice?: ScannedInvoice;
  format?: string;
  /** Non-fatal notes from the parser, surfaced rather than swallowed. */
  warnings: string[];
  error?: string;
  /** Whether the line items reached the price index. */
  fedMoat: boolean;
}

/** Bytes above which we refuse to parse rather than freeze the UI. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Parse e-invoice XML that is already in hand.
 *
 * Separated from the file picking so it can be tested without a device and
 * reused by any other intake — a share-sheet handover, an email attachment, or
 * a paste.
 */
export async function importEInvoiceXml(xml: string): Promise<ImportResult> {
  if (!xml || xml.trim().length === 0) {
    return { ok: false, warnings: [], error: 'empty_file', fedMoat: false };
  }

  const format = detectFormat(xml);
  if (format === 'unknown') {
    return {
      ok: false,
      warnings: [],
      // The overwhelmingly likely cause: they picked the PDF, not the XML.
      error: 'unrecognised_format',
      fedMoat: false,
    };
  }

  let parsed;
  try {
    parsed = parseEInvoiceXml(xml);
  } catch (err) {
    logWarn('EInvoiceImport', `parse failed: ${String(err)}`);
    return { ok: false, warnings: [], error: 'parse_failed', fedMoat: false };
  }

  const invoice = parsed.invoice;

  // No lines means nothing to price and nothing useful to show. Report it
  // rather than presenting an empty invoice as a success.
  if (invoice.lineItems.length === 0) {
    return {
      ok: false,
      invoice,
      format: parsed.format,
      warnings: parsed.warnings,
      error: 'no_line_items',
      fedMoat: false,
    };
  }

  // The moat feed keeps its own arithmetic gate; this only reports whether the
  // attempt was made, and never blocks the import if it throws.
  let fedMoat = false;
  try {
    // Tagged 'einvoice', not 'invoice_scan'. These rows are the supplier's own
    // declared quantities and unit prices; the OCR rows are a model's reading
    // of a photograph. Same table, materially different evidence — and if the
    // vision path ever regresses, provenance is the only thing that makes the
    // trustworthy rows separable.
    await feedPricingMoat(invoice, 'einvoice');
    fedMoat = true;
  } catch (err) {
    logWarn('EInvoiceImport', `moat feed failed: ${String(err)}`);
  }

  return { ok: true, invoice, format: parsed.format, warnings: parsed.warnings, fedMoat };
}

/**
 * Let the contractor pick an e-invoice from their device and import it.
 *
 * Accepts XML and PDF: ZUGFeRD and Factur-X carry the XML inside a PDF/A-3, and
 * a contractor has no reason to know that. Picking the PDF is the natural thing
 * to do, so we try to pull the XML out of it rather than refusing.
 */
export async function pickAndImportEInvoice(): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['text/xml', 'application/xml', 'application/pdf'],
    copyToCacheDirectory: true,
  });

  if (picked.canceled || !picked.assets?.[0]) {
    return { ok: false, warnings: [], error: 'cancelled', fedMoat: false };
  }

  const asset = picked.assets[0];
  if ((asset.size ?? 0) > MAX_BYTES) {
    return { ok: false, warnings: [], error: 'too_large', fedMoat: false };
  }

  const isPdf = asset.mimeType === 'application/pdf' || asset.name?.toLowerCase().endsWith('.pdf');

  try {
    if (isPdf) {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      const embedded = extractZugferdXml(base64);
      if (!embedded) {
        return {
          ok: false,
          warnings: [],
          // A plain PDF is not a structured invoice at all — the single most
          // common misunderstanding about the mandate, so it gets its own
          // error rather than a generic failure.
          error: 'pdf_without_xml',
          fedMoat: false,
        };
      }
      return importEInvoiceXml(embedded);
    }

    const xml = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8' });
    return importEInvoiceXml(xml);
  } catch (err) {
    logWarn('EInvoiceImport', `read failed: ${String(err)}`);
    return { ok: false, warnings: [], error: 'read_failed', fedMoat: false };
  }
}
