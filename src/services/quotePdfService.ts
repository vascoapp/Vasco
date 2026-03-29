/**
 * Quote PDF Service — pro-grade multilingual quote/offerte template
 * Generates branded PDF quotes with country-specific labels.
 * Design matches invoicePdfService — Stripe/Linear-inspired minimal.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { DEMO_MODE } from '../config/demo';
import type { Country } from '../context/AuthContext';

const fmt = (n: number, locale?: string) =>
  n.toLocaleString(locale || 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getCurrencySymbol = (country?: Country): string =>
  country === 'UK' ? '£' : '€';

// ── Types ────────────────────────────────────────────────

export interface QuotePdfData {
  quoteNumber: string;
  customerName: string;
  customerAddress?: string;
  customerEmail?: string;
  jobTitle: string;
  issueDate: string;
  validUntil: string;
  lineItems: { description: string; quantity: number; unitPrice: number; vatRate: number }[];
  subtotal: number;
  vatAmount: number;
  total: number;
  notes?: string;
  terms?: string;
  tiers?: { name: string; description: string; total: number }[];
}

// ── Multilingual labels ──────────────────────────────────

interface QuoteLabels {
  title: string;
  quoteNumber: string;
  from: string;
  to: string;
  issueDate: string;
  validUntil: string;
  jobRef: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vat: string;
  amount: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  notes: string;
  terms: string;
  validityMsg: string;
  acceptMsg: string;
  optionLabel: string;
  poweredBy: string;
}

const LABELS: Record<string, QuoteLabels> = {
  en: {
    title: 'Quote', quoteNumber: 'Quote No.', from: 'From', to: 'Prepared For',
    issueDate: 'Date', validUntil: 'Valid Until', jobRef: 'Project',
    description: 'Description', quantity: 'Qty', unitPrice: 'Price', vat: 'VAT', amount: 'Amount',
    subtotal: 'Subtotal', vatAmount: 'VAT', total: 'Total',
    notes: 'Notes', terms: 'Terms & Conditions',
    validityMsg: 'This quote is valid until',
    acceptMsg: 'To accept this quote, please reply or contact us directly.',
    optionLabel: 'Option', poweredBy: 'Powered by Vasco',
  },
  nl: {
    title: 'Offerte', quoteNumber: 'Offertenr.', from: 'Van', to: 'Opgesteld voor',
    issueDate: 'Datum', validUntil: 'Geldig tot', jobRef: 'Project',
    description: 'Omschrijving', quantity: 'Aantal', unitPrice: 'Prijs', vat: 'BTW', amount: 'Bedrag',
    subtotal: 'Subtotaal', vatAmount: 'BTW', total: 'Totaal incl. BTW',
    notes: 'Opmerkingen', terms: 'Voorwaarden',
    validityMsg: 'Deze offerte is geldig tot',
    acceptMsg: 'Om deze offerte te accepteren, reageer of neem contact met ons op.',
    optionLabel: 'Optie', poweredBy: 'Mogelijk gemaakt door Vasco',
  },
  de: {
    title: 'Angebot', quoteNumber: 'Angebotsnr.', from: 'Von', to: 'Erstellt fur',
    issueDate: 'Datum', validUntil: 'Gultig bis', jobRef: 'Projekt',
    description: 'Beschreibung', quantity: 'Menge', unitPrice: 'Preis', vat: 'USt', amount: 'Betrag',
    subtotal: 'Zwischensumme', vatAmount: 'USt', total: 'Gesamtbetrag',
    notes: 'Anmerkungen', terms: 'Allgemeine Geschaftsbedingungen',
    validityMsg: 'Dieses Angebot ist gultig bis',
    acceptMsg: 'Um dieses Angebot anzunehmen, antworten Sie bitte oder kontaktieren Sie uns direkt.',
    optionLabel: 'Option', poweredBy: 'Betrieben von Vasco',
  },
  fr: {
    title: 'Devis', quoteNumber: 'Devis n°', from: 'De', to: 'Etabli pour',
    issueDate: 'Date', validUntil: 'Valable jusqu\'au', jobRef: 'Chantier',
    description: 'Description', quantity: 'Qte', unitPrice: 'Prix', vat: 'TVA', amount: 'Montant',
    subtotal: 'Sous-total', vatAmount: 'TVA', total: 'Total TTC',
    notes: 'Remarques', terms: 'Conditions generales',
    validityMsg: 'Ce devis est valable jusqu\'au',
    acceptMsg: 'Pour accepter ce devis, veuillez repondre ou nous contacter directement.',
    optionLabel: 'Option', poweredBy: 'Propulse par Vasco',
  },
  es: {
    title: 'Presupuesto', quoteNumber: 'Presupuesto n°', from: 'De', to: 'Preparado para',
    issueDate: 'Fecha', validUntil: 'Valido hasta', jobRef: 'Proyecto',
    description: 'Descripcion', quantity: 'Cant.', unitPrice: 'Precio', vat: 'IVA', amount: 'Importe',
    subtotal: 'Subtotal', vatAmount: 'IVA', total: 'Total',
    notes: 'Notas', terms: 'Terminos y Condiciones',
    validityMsg: 'Este presupuesto es valido hasta',
    acceptMsg: 'Para aceptar este presupuesto, responda o contactenos directamente.',
    optionLabel: 'Opcion', poweredBy: 'Desarrollado por Vasco',
  },
  it: {
    title: 'Preventivo', quoteNumber: 'Preventivo n°', from: 'Da', to: 'Preparato per',
    issueDate: 'Data', validUntil: 'Valido fino al', jobRef: 'Progetto',
    description: 'Descrizione', quantity: 'Qta', unitPrice: 'Prezzo', vat: 'IVA', amount: 'Importo',
    subtotal: 'Subtotale', vatAmount: 'IVA', total: 'Totale',
    notes: 'Note', terms: 'Termini e Condizioni',
    validityMsg: 'Questo preventivo e valido fino al',
    acceptMsg: 'Per accettare questo preventivo, rispondete o contattateci direttamente.',
    optionLabel: 'Opzione', poweredBy: 'Offerto da Vasco',
  },
};

function getLabels(lang?: string): QuoteLabels {
  return LABELS[lang || 'en'] || LABELS.en;
}

// ── HTML Template ────────────────────────────────────────

function buildQuoteHtml(
  quote: QuotePdfData,
  businessName: string,
  businessAddress: string,
  kvkNumber: string,
  vatNumber: string,
  language?: string,
  country?: Country,
  phone?: string,
  email?: string,
  showPoweredBy?: boolean,
): string {
  const L = getLabels(language);
  const curr = getCurrencySymbol(country);
  const locale = language || 'en';

  const lineItemRows = quote.lineItems.map(item => `
    <tr>
      <td class="item-desc">${item.description}</td>
      <td class="item-num">${item.quantity}</td>
      <td class="item-num">${curr}${fmt(item.unitPrice, locale)}</td>
      <td class="item-num">${item.vatRate}%</td>
      <td class="item-num item-total">${curr}${fmt(item.quantity * item.unitPrice, locale)}</td>
    </tr>`).join('\n');

  const vatByRate = new Map<number, number>();
  quote.lineItems.forEach(li => {
    const vatAmt = li.quantity * li.unitPrice * li.vatRate / 100;
    vatByRate.set(li.vatRate, (vatByRate.get(li.vatRate) ?? 0) + vatAmt);
  });
  const vatRows = Array.from(vatByRate.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, amount]) => `<div class="summary-row"><span>${L.vatAmount} ${rate}%</span><span>${curr}${fmt(amount, locale)}</span></div>`)
    .join('\n');

  // Tiered options (if present)
  const tiersHtml = quote.tiers && quote.tiers.length > 0 ? `
    <div class="tiers-section">
      <div class="section-title">${L.optionLabel}s</div>
      <div class="tiers-grid">
        ${quote.tiers.map((tier, i) => `
          <div class="tier-card ${i === 1 ? 'tier-recommended' : ''}">
            ${i === 1 ? '<div class="tier-badge">RECOMMENDED</div>' : ''}
            <div class="tier-name">${tier.name}</div>
            <div class="tier-desc">${tier.description}</div>
            <div class="tier-price">${curr}${fmt(tier.total, locale)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="${language || 'en'}">
<head>
<meta charset="UTF-8"/>
<style>
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #111827; background: #fff; padding: 48px 52px; font-size: 13px; line-height: 1.6;
  }

  .doc-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 28px; border-bottom: 2px solid #E35205; margin-bottom: 32px;
  }
  .brand-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; background: #E35205; border-radius: 10px;
    color: #fff; font-size: 20px; font-weight: 800; margin-bottom: 8px;
  }
  .brand-name { font-size: 16px; font-weight: 700; }
  .brand-detail { font-size: 11px; color: #6B7280; margin-top: 1px; }
  .doc-title { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase; }
  .doc-number { font-size: 14px; font-weight: 600; color: #E35205; margin-top: 4px; }

  .addresses { display: flex; gap: 48px; margin-bottom: 28px; }
  .addr-block { flex: 1; }
  .addr-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; margin-bottom: 6px; }
  .addr-name { font-size: 15px; font-weight: 700; }
  .addr-detail { font-size: 12px; color: #6B7280; margin-top: 1px; }

  .meta-strip {
    display: flex; gap: 40px; margin-bottom: 28px; padding: 14px 20px;
    background: #F9FAFB; border-radius: 8px;
  }
  .meta-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; }
  .meta-value { font-size: 13px; font-weight: 600; color: #111827; margin-top: 2px; }

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

  .summary { display: flex; justify-content: flex-end; margin-bottom: 28px; }
  .summary-table { width: 260px; }
  .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #374151; }
  .summary-total {
    display: flex; justify-content: space-between; padding: 12px 0 0;
    margin-top: 6px; border-top: 2px solid #111827; font-size: 20px; font-weight: 800;
  }

  /* Tiers */
  .tiers-section { margin-bottom: 28px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; margin-bottom: 12px; }
  .tiers-grid { display: flex; gap: 12px; }
  .tier-card {
    flex: 1; border: 2px solid #E5E7EB; border-radius: 10px; padding: 20px;
    text-align: center; position: relative;
  }
  .tier-recommended { border-color: #E35205; background: #FFF7ED; }
  .tier-badge {
    position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
    background: #E35205; color: #fff; font-size: 8px; font-weight: 800;
    letter-spacing: 1px; padding: 3px 10px; border-radius: 4px;
  }
  .tier-name { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
  .tier-desc { font-size: 11px; color: #6B7280; margin-bottom: 12px; }
  .tier-price { font-size: 22px; font-weight: 800; color: #111827; }

  /* Notes */
  .notes-box {
    background: #FFF7ED; border-left: 3px solid #E35205; border-radius: 0 8px 8px 0;
    padding: 16px 20px; margin-bottom: 20px;
  }
  .notes-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #E35205; margin-bottom: 6px; }
  .notes-text { font-size: 12px; color: #374151; }

  .terms-box { font-size: 10px; color: #9CA3AF; line-height: 1.5; margin-bottom: 20px; }
  .terms-title { font-weight: 700; margin-bottom: 4px; }

  /* Validity CTA */
  .validity-cta {
    background: #111827; color: #fff; border-radius: 8px; padding: 16px 24px;
    text-align: center; margin-bottom: 24px;
  }
  .validity-text { font-size: 14px; font-weight: 600; }
  .validity-sub { font-size: 11px; color: #9CA3AF; margin-top: 4px; }

  .doc-footer {
    margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E7EB;
    display: flex; justify-content: space-between; font-size: 10px; color: #9CA3AF;
  }
  .doc-footer a { color: #E35205; text-decoration: none; font-weight: 600; }

  .demo-watermark {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 100px; font-weight: 900; color: rgba(227, 82, 5, 0.06);
    pointer-events: none; z-index: 0; letter-spacing: 20px;
  }
</style>
</head>
<body>

<div class="doc-header">
  <div>
    <div class="brand-mark">V</div>
    <div class="brand-name">${businessName || 'Your Business'}</div>
    <div class="brand-detail">${businessAddress || ''}</div>
    ${kvkNumber ? `<div class="brand-detail">${kvkNumber}</div>` : ''}
    ${vatNumber ? `<div class="brand-detail">${L.vat}: ${vatNumber}</div>` : ''}
    ${phone ? `<div class="brand-detail">${phone}</div>` : ''}
    ${email ? `<div class="brand-detail">${email}</div>` : ''}
  </div>
  <div style="text-align:right">
    <div class="doc-title">${L.title}</div>
    <div class="doc-number">${quote.quoteNumber}</div>
  </div>
</div>

<div class="addresses">
  <div class="addr-block">
    <div class="addr-label">${L.from}</div>
    <div class="addr-name">${businessName || ''}</div>
  </div>
  <div class="addr-block">
    <div class="addr-label">${L.to}</div>
    <div class="addr-name">${quote.customerName}</div>
    ${quote.customerAddress ? `<div class="addr-detail">${quote.customerAddress}</div>` : ''}
    ${quote.customerEmail ? `<div class="addr-detail">${quote.customerEmail}</div>` : ''}
  </div>
</div>

<div class="meta-strip">
  <div><div class="meta-label">${L.issueDate}</div><div class="meta-value">${quote.issueDate}</div></div>
  <div><div class="meta-label">${L.jobRef}</div><div class="meta-value">${quote.jobTitle}</div></div>
  <div><div class="meta-label">${L.validUntil}</div><div class="meta-value">${quote.validUntil}</div></div>
</div>

${tiersHtml}

<table>
  <thead><tr>
    <th>${L.description}</th>
    <th class="num">${L.quantity}</th>
    <th class="num">${L.unitPrice}</th>
    <th class="num">${L.vat}</th>
    <th class="num">${L.amount}</th>
  </tr></thead>
  <tbody>${lineItemRows}</tbody>
</table>

<div class="summary">
  <div class="summary-table">
    <div class="summary-row"><span>${L.subtotal}</span><span>${curr}${fmt(quote.subtotal, locale)}</span></div>
    ${vatRows}
    <div class="summary-total"><span>${L.total}</span><span>${curr}${fmt(quote.total, locale)}</span></div>
  </div>
</div>

${quote.notes ? `<div class="notes-box"><div class="notes-title">${L.notes}</div><div class="notes-text">${quote.notes}</div></div>` : ''}

${quote.terms ? `<div class="terms-box"><div class="terms-title">${L.terms}</div>${quote.terms}</div>` : ''}

<div class="validity-cta">
  <div class="validity-text">${L.validityMsg} ${quote.validUntil}</div>
  <div class="validity-sub">${L.acceptMsg}</div>
</div>

<div class="doc-footer">
  <div>${businessName}${businessAddress ? ' · ' + businessAddress : ''}</div>
  <div>${showPoweredBy !== false ? `<a href="https://vasco.eu">${L.poweredBy}</a>` : ''}</div>
</div>

${DEMO_MODE ? '<div class="demo-watermark">DEMO</div>' : ''}
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────

export async function generateQuotePdf(
  quote: QuotePdfData,
  businessName: string = '',
  businessAddress: string = '',
  kvkNumber: string = '',
  vatNumber: string = '',
  options?: {
    language?: string;
    country?: Country;
    phone?: string;
    email?: string;
    showPoweredBy?: boolean;
  },
): Promise<void> {
  const html = buildQuoteHtml(
    quote, businessName, businessAddress, kvkNumber, vatNumber,
    options?.language, options?.country, options?.phone, options?.email,
    options?.showPoweredBy,
  );
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${quote.quoteNumber}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
