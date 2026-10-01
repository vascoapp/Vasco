// =============================================================================
// E-INVOICE MAPPING — the neutral invoice model → each country's strict shape
// =============================================================================
// This file exists because it was missing, and its absence shipped as two
// crashing buttons. `app/invoices/[id].tsx` built `const data: any = {…}` and
// handed it to `generateFatturaPAXml` / `generateFacturaeXml`, whose inputs
// look nothing like it. The `any` is why tsc never said so; both threw
// TypeError on the first field they touched.
//
// So: one neutral input, one mapper per format, each returning the format's own
// TYPE — which is what makes the compiler useful again. A mapper can also fail
// honestly, and that matters more here than anywhere else in the app:
//
//   · FatturaPA without a Codice Destinatario is rejected by SDI (00311/00312)
//     and in Italy a rejected invoice was NEVER LEGALLY ISSUED.
//   · RegimeFiscale has no safe default. RF01 on a forfettario contractor is a
//     fiscally WRONG invoice that SDI ACCEPTS — worse than a rejection, since
//     nobody finds out.
//
// Hence `MappingResult`: either a document, or the list of fields the
// contractor must fill in. Never a half-built invoice with invented values.
// =============================================================================

import type { FatturaPA, FatturaPALineItem, RegimeFiscale } from './einvoice-it';
import { marcaDaBolloDue, MARCA_DA_BOLLO_EUR } from './einvoice-it';
import type { FacturaeInvoice, FacturaeLineItem, PersonTypeCode, RegimeFiscal } from './einvoice-es';
import { splitSpanishName } from './einvoice-es';
import { isValidCodiceFiscale, checkSpanishTaxId, spanishPersonType } from './fiscalIds';
import { round2 } from '../utils/round2';

/** What every screen already has: the invoice, its lines, and both parties. */
export interface EInvoiceSource {
  seller: {
    name: string;
    vatId?: string;
    taxId?: string;
    address?: string;
    city?: string;
    postcode?: string;
    province?: string;
    country?: string;
    fiscalRegime?: string;
    personType?: 'F' | 'J';
    email?: string;
    phone?: string;
    iban?: string;
  };
  buyer: {
    name: string;
    vatId?: string;
    taxId?: string;
    address?: string;
    city?: string;
    postcode?: string;
    province?: string;
    country?: string;
    einvoiceRouting?: string;
    einvoiceEmail?: string;
  };
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    vatRate: number;
    unit?: string;
  }>;
  totalNet: number;
  totalVat: number;
  totalGross: number;
}

/** A field the contractor has to supply, named so the UI can say which. */
export interface MissingField {
  /** i18n key for the label, e.g. 'profile.fiscalRegime'. */
  key: string;
  /** Where they fix it — the screen decides how to route. */
  where: 'profile' | 'customer';
}

export type MappingResult<T> =
  | { ok: true; document: T }
  | { ok: false; missing: MissingField[] };

const need = (
  missing: MissingField[],
  value: string | undefined | null,
  key: string,
  where: MissingField['where'],
): value is string => {
  if (value && String(value).trim().length > 0) return true;
  missing.push({ key, where });
  return false;
};

// ---------------------------------------------------------------------------
// Italy — FatturaPA
// ---------------------------------------------------------------------------

/**
 * ⚠️ Natura and AliquotaIVA are a matched pair, and SDI rejects on both sides:
 *   00400 — AliquotaIVA is 0 and Natura is absent
 *   00401 — Natura is present and AliquotaIVA is not 0
 * A zero-rated line therefore needs a reason code. N2.2 ("non soggette, altri
 * casi") is the honest catch-all for a trade invoice; anything more specific
 * (an export, a reverse charge) is a fact about the transaction that the app
 * does not know, so it is not guessed.
 */
function naturaFor(vatRate: number): FatturaPALineItem['natura'] {
  return vatRate === 0 ? 'N2.2' : undefined;
}

/**
 * FatturaPA splits a fiscal identity in two: `IdPaese` (the ISO country) and
 * `IdCodice` (the number ALONE). The app stores the VAT number the way its own
 * validator demands it — `IT\d{11}`, prefix included, because that is what a
 * contractor reads off their own paperwork — so passing `vatNumber` straight
 * through emitted
 *
 *     <IdPaese>IT</IdPaese><IdCodice>IT12345678901</IdCodice>
 *
 * for the transmitter, the seller AND the buyer. That is not an 11-digit
 * partita IVA, so SDI rejects the file on formal validation and the contractor
 * never learns why from anything the app showed them.
 *
 * Only strips when the prefix matches the country actually being emitted, so a
 * cross-border buyer keeps their own identifier intact.
 */
function bareFiscalCode(value: string | undefined, country: string | undefined): string | undefined {
  if (!value) return value;
  const v = value.trim().toUpperCase().replace(/\s/g, '');
  const iso = (country ?? '').trim().toUpperCase();
  if (iso.length === 2 && v.startsWith(iso)) return v.slice(2);
  return v;
}

export function toFatturaPA(src: EInvoiceSource): MappingResult<FatturaPA> {
  const missing: MissingField[] = [];

  const sellerVat = src.seller.vatId;
  need(missing, sellerVat, 'profile.vatNumberPartitaIva', 'profile');
  need(missing, src.seller.address, 'profile.address', 'profile');
  need(missing, src.seller.city, 'profile.city', 'profile');
  need(missing, src.seller.postcode, 'profile.postcode', 'profile');
  need(missing, src.seller.province, 'profile.province', 'profile');
  // No default. RF01 on a forfettario is accepted and wrong.
  need(missing, src.seller.fiscalRegime, 'profile.fiscalRegime', 'profile');

  need(missing, src.buyer.address, 'customer.address', 'customer');
  need(missing, src.buyer.city, 'customer.city', 'customer');
  need(missing, src.buyer.postcode, 'customer.postcode', 'customer');
  need(missing, src.buyer.province, 'customer.province', 'customer');
  // A buyer needs SOME fiscal identity: P.IVA for a business, Codice Fiscale
  // for a consumer. Either satisfies SDI; neither does not.
  if (!src.buyer.vatId && !src.buyer.taxId) {
    missing.push({ key: 'customer.vatOrTaxId', where: 'customer' });
  }
  // Routing: a 7-char Codice Destinatario, or '0000000' plus a PEC address.
  // Without one of the two SDI cannot deliver it at all.
  const routing = src.buyer.einvoiceRouting?.trim();
  if (!routing && !src.buyer.einvoiceEmail?.trim()) {
    missing.push({ key: 'customer.einvoiceRouting', where: 'customer' });
  }

  if (missing.length > 0) return { ok: false, missing };

  // Quantita is unsigned in the schema ([0-9]{1,12}\.[0-9]{2,8}); a credit
  // line entered as −1 × 50 is written 1 × −50 — the same line total, the
  // sign where FatturaPA allows it (PrezzoUnitario).
  const dettaglioLinee: FatturaPALineItem[] = src.lines.map((l) => ({
    descrizione: l.description,
    quantita: Math.abs(l.quantity),
    unitaMisura: l.unit,
    prezzoUnitario: l.quantity < 0 ? -l.unitPrice : l.unitPrice,
    prezzoTotale: l.lineTotal,
    aliquotaIva: l.vatRate,
    natura: naturaFor(l.vatRate),
  }));
  // The profile field that lands in `taxId` is, for Italy, labelled "Camera di
  // Commercio" (placeholder "REA MI-1234567") — it was written verbatim as the
  // seller's <CodiceFiscale>, which is [A-Z0-9]{11,16}: schema-invalid (SDI
  // 00200) for every contractor who filled it in. Only a real codice fiscale
  // is a codice fiscale; anything else is left out rather than mislabelled.
  const sellerCf = (src.seller.taxId ?? '').trim().toUpperCase().replace(/\s/g, '');
  const sellerCodiceFiscale = isValidCodiceFiscale(sellerCf) ? sellerCf : undefined;
  // SDI codes are upper-case [A-Z0-9]; a pasted lower-case code is the same code.
  const codiceDestinatario = routing ? routing.toUpperCase().replace(/\s/g, '') : '0000000';

  // An Italian invoice whose IVA-exempt amount exceeds € 77,47 legally requires
  // a € 2,00 marca da bollo, and nothing used to set it — every such invoice
  // went out without the stamp.
  //
  // It is DECLARED here and not recharged: the stamp is owed by the ISSUER, so
  // `ImportoTotaleDocumento` is unchanged and the XML still agrees with the
  // PDF and the screen to the cent. Passing it on to the customer is a
  // separate flag (`bolloRicaricato`) and a pricing decision that has to show
  // as a visible line in all three artefacts first (#354).
  const bolloDue = marcaDaBolloDue(
    src.lines.map((l) => ({ lineTotal: l.lineTotal, vatRate: l.vatRate })),
  );

  return {
    ok: true,
    document: {
      // FPR12 = private (B2B/B2C). FPA12 is public administration, which is a
      // different recipient and a different Codice Destinatario length.
      formatoTrasmissione: 'FPR12',
      // Max 10 chars, unique per transmission. The invoice number is unique
      // per contractor already and is what they will quote when chasing it.
      progressivoInvio: src.invoiceNumber.replace(/[^A-Za-z0-9]/g, '').slice(-10) || '1',
      codiceDestinatario,
      ...(bolloDue ? { bolloVirtuale: true, importoBollo: MARCA_DA_BOLLO_EUR } : {}),
      cedentePrestatore: {
        denominazione: src.seller.name,
        partitaIva: bareFiscalCode(sellerVat, src.seller.country ?? 'IT') as string,
        codiceFiscale: sellerCodiceFiscale,
        regimeFiscale: src.seller.fiscalRegime as RegimeFiscale,
        indirizzo: src.seller.address as string,
        cap: src.seller.postcode as string,
        comune: src.seller.city as string,
        provincia: src.seller.province as string,
        nazione: src.seller.country ?? 'IT',
      },
      cessionarioCommittente: {
        denominazione: src.buyer.name,
        partitaIva: bareFiscalCode(src.buyer.vatId, src.buyer.country ?? 'IT'),
        codiceFiscale: src.buyer.taxId ? src.buyer.taxId.trim().toUpperCase().replace(/\s/g, '') : undefined,
        indirizzo: src.buyer.address as string,
        cap: src.buyer.postcode as string,
        comune: src.buyer.city as string,
        provincia: src.buyer.province as string,
        nazione: src.buyer.country ?? 'IT',
        codiceDestinatario,
        pec: src.buyer.einvoiceEmail?.trim() || undefined,
      },
      tipoDocumento: 'TD01',
      numero: src.invoiceNumber,
      data: src.invoiceDate,
      divisa: src.currency,
      dettaglioLinee,
      totalNet: src.totalNet,
      totalVat: src.totalVat,
      totalGross: src.totalGross,
      condizioniPagamento: 'TP02',
      modalitaPagamento: 'MP05',
      iban: src.seller.iban,
      dataScadenzaPagamento: src.dueDate,
    },
  };
}

// ---------------------------------------------------------------------------
// Spain — Facturae
// ---------------------------------------------------------------------------

/**
 * A Spanish NIF as Facturae wants it on a DOMESTIC operation: without the "ES"
 * VAT prefix (Facturae 3.2.2, TaxIdentificationNumber: the country letters
 * precede the NIF only "en el caso de operaciones intracomunitarias"). An id
 * that is not a well-formed Spanish NIF is passed through as typed — the value
 * rules then name it (HAP/1650/2015 Anexo II 5b) rather than us guessing.
 */
function domesticNif(value: string | undefined): string | undefined {
  if (!value) return value;
  const c = checkSpanishTaxId(value);
  return c.kind ? c.bare : value.trim().toUpperCase();
}

/**
 * F or J from the NIF itself: a DNI (digits + letter), NIE (X/Y/Z…) or K/L/M
 * NIF is a natural person, an entity letter (A–W) a legal person. "Starts with
 * a letter ⇒ company" filed every NIE holder — and every DNI typed with its ES
 * prefix — as a company.
 */
function buyerPersonTypeFor(nif: string | undefined): PersonTypeCode {
  return spanishPersonType(nif) ?? (/^[A-Za-z]/.test(String(nif ?? '')) ? 'J' : 'F');
}

export function toFacturae(src: EInvoiceSource): MappingResult<FacturaeInvoice> {
  const missing: MissingField[] = [];

  const sellerNif = domesticNif(src.seller.vatId ?? src.seller.taxId);
  need(missing, sellerNif, 'profile.vatNumberNif', 'profile');
  need(missing, src.seller.address, 'profile.address', 'profile');
  need(missing, src.seller.city, 'profile.city', 'profile');
  need(missing, src.seller.postcode, 'profile.postcode', 'profile');
  need(missing, src.seller.province, 'profile.province', 'profile');
  // Facturae states F or J explicitly on both parties; a sole trader and a
  // company are not distinguishable from anything else the app stores.
  need(missing, src.seller.personType, 'profile.personType', 'profile');
  // A person is Name + FirstSurname in Facturae; a one-word name cannot be
  // split honestly, so it is asked for rather than guessed.
  if (src.seller.personType === 'F' && !splitSpanishName(src.seller.name)) missing.push({ key: 'profile.nameWithSurname', where: 'profile' });

  const buyerNif = domesticNif(src.buyer.vatId ?? src.buyer.taxId);
  need(missing, buyerNif, 'customer.vatOrTaxId', 'customer');
  need(missing, src.buyer.address, 'customer.address', 'customer');
  need(missing, src.buyer.city, 'customer.city', 'customer');
  need(missing, src.buyer.postcode, 'customer.postcode', 'customer');
  need(missing, src.buyer.province, 'customer.province', 'customer');
  if (buyerNif && buyerPersonTypeFor(buyerNif) === 'F' && !splitSpanishName(src.buyer.name)) {
    missing.push({ key: 'customer.nameWithSurname', where: 'customer' });
  }

  if (missing.length > 0) return { ok: false, missing };

  const lineItems: FacturaeLineItem[] = src.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    lineTotal: l.lineTotal,
    ivaRate: l.vatRate,
    // Per line, from that line's own rate — not the invoice total split
    // proportionally, which drifts by a cent on mixed-rate invoices and is
    // exactly what Facturae's arithmetic checks compare.
    ivaAmount: round2(l.lineTotal * (l.vatRate / 100)),
  }));

  return {
    ok: true,
    document: {
      sellerName: src.seller.name,
      sellerNif: sellerNif as string,
      sellerAddress: src.seller.address as string,
      sellerCity: src.seller.city as string,
      sellerPostalCode: src.seller.postcode as string,
      sellerProvince: src.seller.province as string,
      // Facturae uses ISO 3166-1 alpha-3.
      sellerCountry: 'ESP',
      sellerPersonType: src.seller.personType as PersonTypeCode,
      // '01' General is the regime for essentially every trade business, and
      // unlike Italy's RegimeFiscale a wrong value here does not change what
      // the customer owes — it is a classification, not a tax basis.
      sellerRegimeFiscal: '01' as RegimeFiscal,
      buyerName: src.buyer.name,
      buyerNif: buyerNif as string,
      buyerAddress: src.buyer.address as string,
      buyerCity: src.buyer.city as string,
      buyerPostalCode: src.buyer.postcode as string,
      buyerProvince: src.buyer.province as string,
      buyerCountry: 'ESP',
      buyerPersonType: buyerPersonTypeFor(buyerNif),
      invoiceNumber: src.invoiceNumber,
      invoiceDate: src.invoiceDate,
      dueDate: src.dueDate,
      currency: src.currency,
      lineItems,
      totalNet: src.totalNet,
      totalVat: src.totalVat,
      // No IRPF withholding: it applies when a professional invoices a
      // business, and whether it applies is a fact about the engagement the
      // app does not hold. Zero is the honest value, not an assumed 15%.
      totalIrpf: 0,
      totalGross: src.totalGross,
      iban: src.seller.iban,
      paymentMethod: '04',
    },
  };
}
