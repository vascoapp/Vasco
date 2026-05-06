/**
 * Invoice PDF Service — pro-grade multilingual invoice template
 * Generates branded PDF invoices with country-specific compliance fields.
 * Uses expo-print + expo-sharing.
 *
 * Design: Stripe/Linear-inspired — clean minimal, generous whitespace,
 * strong typographic hierarchy, Hermes Orange accent.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { AutoInvoice } from './invoiceAutomationService';
import { DEMO_MODE } from '../config/demo';
import type { Country } from '../context/AuthContext';

// ── Number formatting ────────────────────────────────────

const fmt = (n: number, locale?: string) =>
  n.toLocaleString(locale || 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getCurrencySymbol = (country?: Country): string =>
  country === 'UK' ? '£' : '€';

// Country-specific business registration number label (single source of truth
// for both header and footer — earlier, header used 'KvK' fallback for UK
// and 'P.IVA' for IT while footer used 'Co. no.' / 'C.F.' for the same id).
function registrationLabel(country?: Country): string {
  switch (country) {
    case 'DE': return 'HRB';
    case 'FR': return 'SIRET';
    case 'ES': return 'NIF';
    case 'IT': return 'P.IVA';
    case 'UK': return 'Co. no.';
    case 'NL':
    default:   return 'KvK';
  }
}

function vatLabel(country?: Country, fallback = 'VAT'): string {
  switch (country) {
    case 'NL': return 'BTW';
    case 'DE': return 'USt-IdNr';
    case 'FR': return 'TVA';
    case 'ES': return 'NIF-IVA';
    case 'IT': return 'P.IVA';
    case 'UK': return 'VAT';
    default:   return fallback;
  }
}

// ── Multilingual labels ──────────────────────────────────

interface DocLabels {
  title: string;
  invoiceNumber: string;
  from: string;
  to: string;
  issueDate: string;
  dueDate: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vat: string;
  amount: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  paymentInfo: string;
  paymentInstruction: string;
  paymentReference: string;
  payOnline: string;
  poweredBy: string;
  status: Record<string, string>;
  bankDetails: string;
}

const LABELS: Record<string, DocLabels> = {
  en: {
    title: 'Invoice', invoiceNumber: 'Invoice No.', from: 'From', to: 'Bill To',
    issueDate: 'Issue Date', dueDate: 'Due Date',
    description: 'Description', quantity: 'Qty', unitPrice: 'Price', vat: 'VAT', amount: 'Amount',
    subtotal: 'Subtotal', vatAmount: 'VAT', total: 'Total Due',
    paymentInfo: 'Payment Information', paymentInstruction: 'Please pay within the due date.',
    paymentReference: 'Reference', payOnline: 'Pay Online', poweredBy: 'Powered by Vasco',
    status: { draft: 'DRAFT', sent: 'SENT', paid: 'PAID', overdue: 'OVERDUE' },
    bankDetails: 'Bank Details',
  },
  nl: {
    title: 'Factuur', invoiceNumber: 'Factuurnr.', from: 'Van', to: 'Aan',
    issueDate: 'Factuurdatum', dueDate: 'Vervaldatum',
    description: 'Omschrijving', quantity: 'Aantal', unitPrice: 'Prijs', vat: 'BTW', amount: 'Bedrag',
    subtotal: 'Subtotaal', vatAmount: 'BTW', total: 'Totaal',
    paymentInfo: 'Betalingsinformatie', paymentInstruction: 'Gelieve binnen de vervaldatum te betalen.',
    paymentReference: 'Referentie', payOnline: 'Betaal Online', poweredBy: 'Mogelijk gemaakt door Vasco',
    status: { draft: 'CONCEPT', sent: 'VERZONDEN', paid: 'BETAALD', overdue: 'VERLOPEN' },
    bankDetails: 'Bankgegevens',
  },
  de: {
    title: 'Rechnung', invoiceNumber: 'Rechnungsnr.', from: 'Von', to: 'An',
    issueDate: 'Rechnungsdatum', dueDate: 'Falligkeitsdatum',
    description: 'Beschreibung', quantity: 'Menge', unitPrice: 'Preis', vat: 'USt', amount: 'Betrag',
    subtotal: 'Zwischensumme', vatAmount: 'USt', total: 'Gesamtbetrag',
    paymentInfo: 'Zahlungsinformationen', paymentInstruction: 'Bitte zahlen Sie bis zum Falligkeitsdatum.',
    paymentReference: 'Referenz', payOnline: 'Online Bezahlen', poweredBy: 'Betrieben von Vasco',
    status: { draft: 'ENTWURF', sent: 'GESENDET', paid: 'BEZAHLT', overdue: 'UBERFÄLLIG' },
    bankDetails: 'Bankverbindung',
  },
  fr: {
    title: 'Facture', invoiceNumber: 'Facture n°', from: 'De', to: 'A',
    issueDate: 'Date de facture', dueDate: 'Date d\'echeance',
    description: 'Description', quantity: 'Qte', unitPrice: 'Prix', vat: 'TVA', amount: 'Montant',
    subtotal: 'Sous-total', vatAmount: 'TVA', total: 'Total TTC',
    paymentInfo: 'Informations de paiement', paymentInstruction: 'Merci de regler avant la date d\'echeance.',
    paymentReference: 'Reference', payOnline: 'Payer en Ligne', poweredBy: 'Propulse par Vasco',
    status: { draft: 'BROUILLON', sent: 'ENVOYEE', paid: 'PAYEE', overdue: 'EN RETARD' },
    bankDetails: 'Coordonnees bancaires',
  },
  es: {
    title: 'Factura', invoiceNumber: 'Factura n°', from: 'De', to: 'Para',
    issueDate: 'Fecha de factura', dueDate: 'Fecha de vencimiento',
    description: 'Descripcion', quantity: 'Cant.', unitPrice: 'Precio', vat: 'IVA', amount: 'Importe',
    subtotal: 'Subtotal', vatAmount: 'IVA', total: 'Total',
    paymentInfo: 'Informacion de pago', paymentInstruction: 'Por favor pague antes de la fecha de vencimiento.',
    paymentReference: 'Referencia', payOnline: 'Pagar en Linea', poweredBy: 'Desarrollado por Vasco',
    status: { draft: 'BORRADOR', sent: 'ENVIADA', paid: 'PAGADA', overdue: 'VENCIDA' },
    bankDetails: 'Datos bancarios',
  },
  it: {
    title: 'Fattura', invoiceNumber: 'Fattura n°', from: 'Da', to: 'A',
    issueDate: 'Data fattura', dueDate: 'Data di scadenza',
    description: 'Descrizione', quantity: 'Qta', unitPrice: 'Prezzo', vat: 'IVA', amount: 'Importo',
    subtotal: 'Subtotale', vatAmount: 'IVA', total: 'Totale',
    paymentInfo: 'Informazioni di pagamento', paymentInstruction: 'Si prega di pagare entro la data di scadenza.',
    paymentReference: 'Riferimento', payOnline: 'Paga Online', poweredBy: 'Offerto da Vasco',
    status: { draft: 'BOZZA', sent: 'INVIATA', paid: 'PAGATA', overdue: 'SCADUTA' },
    bankDetails: 'Coordinate bancarie',
  },
};

function getLabels(lang?: string): DocLabels {
  return LABELS[lang || 'en'] || LABELS.en;
}

// ── Status colors ────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'paid': return '#10B981';
    case 'overdue': return '#EF4444';
    case 'sent': return '#3B82F6';
    default: return '#9CA3AF';
  }
}

// ── HTML Template ────────────────────────────────────────

function buildInvoiceHtml(
  invoice: AutoInvoice,
  businessName: string,
  businessAddress: string,
  kvkNumber: string,
  vatNumber: string,
  paymentUrl?: string,
  language?: string,
  country?: Country,
  iban?: string,
  showPoweredBy?: boolean,
  insuranceRef?: string,
  // R251: small-business VAT exemption (NL KOR / DE Kleinunternehmer §19)
  vatScheme?: 'standard' | 'small_business_NL_KOR' | 'small_business_DE_kleinunternehmer',
): string {
  const L = getLabels(language);
  const curr = getCurrencySymbol(country);
  const locale = language || 'en';

  const issueDate = invoice.issueDate.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const dueDate = invoice.dueDate.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });

  // R251: small-business scheme zeroes VAT and adds a legal note row.
  const isSmallBusinessExempt = vatScheme === 'small_business_NL_KOR'
    || vatScheme === 'small_business_DE_kleinunternehmer';
  const exemptionNote = vatScheme === 'small_business_NL_KOR'
    ? 'BTW niet van toepassing — kleineondernemersregeling (KOR).'
    : vatScheme === 'small_business_DE_kleinunternehmer'
      ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).'
      : null;

  const lineItemRows = invoice.lineItems.map(item => `
    <tr>
      <td class="item-desc">${item.description}</td>
      <td class="item-num">${item.quantity}</td>
      <td class="item-num">${curr}${fmt(item.unitPrice, locale)}</td>
      <td class="item-num">${isSmallBusinessExempt ? '0%' : item.vatRate + '%'}</td>
      <td class="item-num item-total">${curr}${fmt(item.quantity * item.unitPrice, locale)}</td>
    </tr>`).join('\n');

  const statusLabel = L.status[invoice.status] || L.status.draft;
  const sColor = statusColor(invoice.status);

  // VAT breakdown by rate — zero everything for small-business scheme.
  const vatByRate = new Map<number, number>();
  if (!isSmallBusinessExempt) {
    invoice.lineItems.forEach(li => {
      const vatAmt = li.quantity * li.unitPrice * li.vatRate / 100;
      vatByRate.set(li.vatRate, (vatByRate.get(li.vatRate) ?? 0) + vatAmt);
    });
  }
  const vatRows = isSmallBusinessExempt
    ? `<div class="summary-row"><span>${L.vatAmount}</span><span>${curr}${fmt(0, locale)}</span></div>`
    : Array.from(vatByRate.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([rate, amount]) => `<div class="summary-row"><span>${L.vatAmount} ${rate}%</span><span>${curr}${fmt(amount, locale)}</span></div>`)
        .join('\n');

  return `<!DOCTYPE html>
<html lang="${language || 'en'}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #111827; background: #fff; padding: 48px 52px; font-size: 13px; line-height: 1.6;
  }

  /* ── Header ── */
  .doc-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 28px; border-bottom: 2px solid #111827; margin-bottom: 32px;
  }
  .brand-block {}
  .brand-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; background: #F97316; border-radius: 10px;
    color: #fff; font-size: 20px; font-weight: 800; margin-bottom: 8px;
  }
  .brand-name { font-size: 16px; font-weight: 700; color: #111827; }
  .brand-address { font-size: 11px; color: #6B7280; margin-top: 2px; }
  .doc-title-block { text-align: right; }
  .doc-title { font-size: 32px; font-weight: 800; color: #111827; letter-spacing: -0.5px; text-transform: uppercase; }
  .doc-number { font-size: 14px; font-weight: 600; color: #F97316; margin-top: 4px; }
  .doc-status {
    display: inline-block; margin-top: 8px; padding: 3px 14px; border-radius: 4px;
    font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #fff; background: ${sColor};
  }

  /* ── Addresses ── */
  .addresses { display: flex; gap: 48px; margin-bottom: 28px; }
  .addr-block { flex: 1; }
  .addr-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; margin-bottom: 6px; }
  .addr-name { font-size: 15px; font-weight: 700; color: #111827; }
  .addr-detail { font-size: 12px; color: #6B7280; margin-top: 1px; }

  /* ── Date strip ── */
  .date-strip {
    display: flex; gap: 40px; margin-bottom: 28px; padding: 14px 20px;
    background: #F9FAFB; border-radius: 8px;
  }
  .date-item {}
  .date-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; }
  .date-value { font-size: 13px; font-weight: 600; color: #111827; margin-top: 2px; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  th {
    text-align: left; padding: 10px 12px; font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF;
    border-bottom: 2px solid #E5E7EB;
  }
  th.num { text-align: right; }
  td { padding: 12px; border-bottom: 1px solid #F3F4F6; font-size: 13px; }
  .item-desc { color: #111827; font-weight: 500; }
  .item-num { text-align: right; color: #374151; font-variant-numeric: tabular-nums; }
  .item-total { font-weight: 600; color: #111827; }
  tr:last-child td { border-bottom: none; }

  /* ── Summary ── */
  .summary { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .summary-table { width: 260px; }
  .summary-row {
    display: flex; justify-content: space-between; padding: 5px 0;
    font-size: 13px; color: #374151;
  }
  .summary-total {
    display: flex; justify-content: space-between; padding: 12px 0 0;
    margin-top: 6px; border-top: 2px solid #111827;
    font-size: 20px; font-weight: 800; color: #111827;
  }

  /* ── Payment ── */
  .payment-box {
    background: #F9FAFB; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;
  }
  .payment-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; margin-bottom: 10px; }
  .payment-detail { font-size: 13px; color: #374151; margin-top: 4px; }
  .payment-detail strong { color: #111827; }
  .pay-btn {
    display: inline-block; margin-top: 16px; padding: 12px 36px;
    background: #F97316; color: #fff; border-radius: 8px;
    text-decoration: none; font-weight: 700; font-size: 14px; letter-spacing: 0.3px;
  }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 40px; padding-top: 16px; border-top: 1px solid #E5E7EB;
    display: flex; justify-content: space-between; font-size: 10px; color: #9CA3AF;
  }
  .doc-footer a { color: #F97316; text-decoration: none; font-weight: 600; }

  /* ── Insurance (FR) ── */
  .insurance-ref { font-size: 11px; color: #6B7280; margin-top: 4px; }

  .demo-watermark {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 100px; font-weight: 900; color: rgba(227, 82, 5, 0.06);
    pointer-events: none; z-index: 0; letter-spacing: 20px;
  }
</style>
</head>
<body>

<!-- Header -->
<div class="doc-header">
  <div class="brand-block">
    <div class="brand-mark">V</div>
    <div class="brand-name">${businessName || 'Your Business'}</div>
    <div class="brand-address">${businessAddress || ''}</div>
    ${kvkNumber ? `<div class="brand-address">${registrationLabel(country)}: ${kvkNumber}</div>` : ''}
    ${vatNumber ? `<div class="brand-address">${vatLabel(country, L.vat)}: ${vatNumber}</div>` : ''}
    ${insuranceRef ? `<div class="insurance-ref">${insuranceRef}</div>` : ''}
  </div>
  <div class="doc-title-block">
    <div class="doc-title">${L.title}</div>
    <div class="doc-number">${invoice.invoiceNumber}</div>
    <div class="doc-status">${statusLabel}</div>
  </div>
</div>

<!-- Addresses -->
<div class="addresses">
  <div class="addr-block">
    <div class="addr-label">${L.from}</div>
    <div class="addr-name">${businessName || ''}</div>
    <div class="addr-detail">${businessAddress || ''}</div>
  </div>
  <div class="addr-block">
    <div class="addr-label">${L.to}</div>
    <div class="addr-name">${invoice.customerName}</div>
    <div class="addr-detail">${invoice.customerAddress}</div>
    ${invoice.customerEmail ? `<div class="addr-detail">${invoice.customerEmail}</div>` : ''}
  </div>
</div>

<!-- Date strip -->
<div class="date-strip">
  <div class="date-item">
    <div class="date-label">${L.issueDate}</div>
    <div class="date-value">${issueDate}</div>
  </div>
  <div class="date-item">
    <div class="date-label">${L.dueDate}</div>
    <div class="date-value">${dueDate}</div>
  </div>
  <div class="date-item">
    <div class="date-label">${L.paymentReference}</div>
    <div class="date-value">${invoice.invoiceNumber}</div>
  </div>
</div>

<!-- Line items -->
<table>
  <thead>
    <tr>
      <th>${L.description}</th>
      <th class="num">${L.quantity}</th>
      <th class="num">${L.unitPrice}</th>
      <th class="num">${L.vat}</th>
      <th class="num">${L.amount}</th>
    </tr>
  </thead>
  <tbody>
    ${lineItemRows}
  </tbody>
</table>

<!-- Summary -->
<div class="summary">
  <div class="summary-table">
    <div class="summary-row"><span>${L.subtotal}</span><span>${curr}${fmt(invoice.subtotal, locale)}</span></div>
    ${vatRows}
    <div class="summary-total"><span>${L.total}</span><span>${curr}${fmt(invoice.total, locale)}</span></div>
  </div>
</div>

${exemptionNote ? `<!-- Small-business VAT exemption legal note (R251) -->
<div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#78350F;">
  ${exemptionNote}
</div>` : ''}

<!-- Payment -->
<div class="payment-box">
  <div class="payment-title">${L.paymentInfo}</div>
  <div class="payment-detail">${L.paymentInstruction}</div>
  <div class="payment-detail"><strong>${L.total}: ${curr}${fmt(invoice.total, locale)}</strong></div>
  <div class="payment-detail">${L.paymentReference}: <strong>${invoice.invoiceNumber}</strong></div>
  ${iban ? `<div class="payment-detail" style="margin-top:8px"><span style="color:#9CA3AF">${L.bankDetails}:</span> ${iban}</div>` : ''}
  ${paymentUrl ? `<div style="text-align:center;margin-top:16px"><a href="${paymentUrl}" class="pay-btn">${L.payOnline}</a></div>` : ''}
</div>

<!-- Footer -->
<div class="doc-footer">
  <div>${businessName}${businessAddress ? ' · ' + businessAddress : ''}</div>
  ${(() => {
    const parts: string[] = [];
    if (kvkNumber) parts.push(`${registrationLabel(country)}: ${kvkNumber}`);
    if (vatNumber) parts.push(`${vatLabel(country, L.vat)}: ${vatNumber}`);
    return parts.length ? `<div style="margin-top:4px;font-size:10px;color:#6B7280">${parts.join(' · ')}</div>` : '';
  })()}
  <div>${showPoweredBy !== false ? `<a href="https://vasco.eu">${L.poweredBy}</a>` : ''}</div>
</div>

${DEMO_MODE ? '<div class="demo-watermark">DEMO</div>' : ''}
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────

export function buildInvoiceShareText(invoice: AutoInvoice, businessName?: string, paymentUrl?: string): string {
  const lines = invoice.lineItems.map(li =>
    `• ${li.description}: ${li.quantity}x €${fmt(li.unitPrice)} = €${fmt(li.quantity * li.unitPrice)}`,
  ).join('\n');

  const parts = [
    `${invoice.invoiceNumber}`,
    `From: ${businessName || 'Your business'}`,
    `To: ${invoice.customerName}`,
    ``, lines, ``,
    `Subtotal: €${fmt(invoice.subtotal)}`,
    `VAT: €${fmt(invoice.vatAmount)}`,
    `Total: €${fmt(invoice.total)}`,
    ``, `Due: ${invoice.dueDate.toLocaleDateString()}`,
  ];

  if (paymentUrl) parts.push(``, `Pay online: ${paymentUrl}`);
  if (invoice.customerId) parts.push(``, `Track your project: https://app.vasco.eu/customer/${invoice.customerId}`);

  return parts.join('\n');
}

export async function generateInvoicePdf(
  invoice: AutoInvoice,
  businessProfile?: {
    businessName?: string;
    address?: string;
    kvkNumber?: string;
    vatNumber?: string;
    iban?: string;
    insuranceRef?: string;
    country?: Country;
    language?: string;
    // R251: small-business scheme controls VAT rendering
    vatScheme?: 'standard' | 'small_business_NL_KOR' | 'small_business_DE_kleinunternehmer';
  },
  paymentUrl?: string,
  options?: {
    showPoweredBy?: boolean; // true for Gratis tier
    // R301: optional customer-handover signature embed. When supplied,
    // signatureHtmlBlock is appended to the invoice HTML.
    customerSignature?: {
      svgDataUri: string;
      signedAt: string;
      signerName: string;
    };
  },
): Promise<void> {
  let html = buildInvoiceHtml(
    invoice,
    businessProfile?.businessName ?? '',
    businessProfile?.address ?? '',
    businessProfile?.kvkNumber ?? '',
    businessProfile?.vatNumber ?? '',
    paymentUrl,
    businessProfile?.language,
    businessProfile?.country,
    businessProfile?.iban,
    options?.showPoweredBy,
    businessProfile?.insuranceRef,
    businessProfile?.vatScheme,
  );

  // R301: embed signature when customer signed off on the linked job.
  // Inserted before the closing </body> tag so it appears at the end of
  // the document, after totals.
  if (options?.customerSignature) {
    const { signatureHtmlBlock } = await import('./signatureService');
    const block = signatureHtmlBlock({
      id: `sig_${Date.now()}`,
      context: 'handover',
      referenceId: invoice.id,
      referenceType: 'invoice',
      signerName: options.customerSignature.signerName,
      signerRole: 'customer',
      signatureDataUri: options.customerSignature.svgDataUri,
      signedAt: options.customerSignature.signedAt,
      legalText: '',
    });
    html = html.replace('</body>', `${block}</body>`);
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${invoice.invoiceNumber}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
