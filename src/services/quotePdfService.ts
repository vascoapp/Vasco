/**
 * Quote PDF Service — generates a branded PDF quote (offerte)
 * and shares it via the system share sheet.
 * Mirrors invoicePdfService.ts pattern.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface QuotePdfData {
  quoteNumber: string;
  customerName: string;
  customerAddress?: string;
  jobTitle: string;
  issueDate: string;
  validUntil: string;
  lineItems: { description: string; quantity: number; unitPrice: number; vatRate: number }[];
  subtotal: number;
  vatAmount: number;
  total: number;
  notes?: string;
}

function buildQuoteHtml(
  quote: QuotePdfData,
  businessName: string,
  businessAddress: string,
  kvkNumber: string,
  vatNumber: string,
): string {
  const lineItemRows = quote.lineItems
    .map(item => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">\u20AC${fmt(item.unitPrice)}</td>
      <td style="text-align:center">${item.vatRate}%</td>
      <td style="text-align:right">\u20AC${fmt(item.quantity * item.unitPrice)}</td>
    </tr>`)
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 40px; color: #1a1a1a; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .brand { font-size: 24px; font-weight: 800; color: #E35205; }
    .label { font-size: 28px; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 2px; }
    .info-grid { display: flex; justify-content: space-between; margin-bottom: 24px; }
    .info-block { max-width: 48%; }
    .info-block h3 { font-size: 10px; text-transform: uppercase; color: #999; letter-spacing: 1px; margin: 0 0 4px 0; }
    .info-block p { margin: 2px 0; }
    .meta { display: flex; gap: 32px; margin-bottom: 24px; padding: 12px 16px; background: #f8f8f8; border-radius: 8px; }
    .meta-item { }
    .meta-item .label2 { font-size: 10px; color: #999; text-transform: uppercase; }
    .meta-item .value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #E35205; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
    td { padding: 10px 8px; border-bottom: 1px solid #eee; }
    .totals { text-align: right; margin-top: 16px; }
    .totals .row { display: flex; justify-content: flex-end; gap: 24px; padding: 4px 0; }
    .totals .total-row { font-size: 18px; font-weight: 700; border-top: 2px solid #E35205; padding-top: 8px; margin-top: 8px; }
    .notes { margin-top: 24px; padding: 16px; background: #FFF5F0; border-radius: 8px; border-left: 3px solid #E35205; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
    .validity { margin-top: 16px; padding: 12px 16px; background: #E35205; color: white; border-radius: 8px; text-align: center; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">VASCO</div>
      <div>${businessName}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Offerte</div>
      <div>${quote.quoteNumber}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <h3>Van</h3>
      <p><strong>${businessName}</strong></p>
      <p>${businessAddress}</p>
      ${kvkNumber ? `<p>KvK: ${kvkNumber}</p>` : ''}
      ${vatNumber ? `<p>BTW: ${vatNumber}</p>` : ''}
    </div>
    <div class="info-block">
      <h3>Aan</h3>
      <p><strong>${quote.customerName}</strong></p>
      ${quote.customerAddress ? `<p>${quote.customerAddress}</p>` : ''}
    </div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="label2">Datum</div>
      <div class="value">${quote.issueDate}</div>
    </div>
    <div class="meta-item">
      <div class="label2">Klus</div>
      <div class="value">${quote.jobTitle}</div>
    </div>
    <div class="meta-item">
      <div class="label2">Geldig tot</div>
      <div class="value">${quote.validUntil}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Omschrijving</th>
        <th style="text-align:center">Aantal</th>
        <th style="text-align:right">Prijs</th>
        <th style="text-align:center">BTW</th>
        <th style="text-align:right">Totaal</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotaal:</span><span>\u20AC${fmt(quote.subtotal)}</span></div>
    <div class="row"><span>BTW:</span><span>\u20AC${fmt(quote.vatAmount)}</span></div>
    <div class="row total-row"><span>Totaal incl. BTW:</span><span>\u20AC${fmt(quote.total)}</span></div>
  </div>

  ${quote.notes ? `<div class="notes"><strong>Opmerkingen:</strong><br>${quote.notes}</div>` : ''}

  <div class="validity">
    Deze offerte is geldig tot ${quote.validUntil}
  </div>

  <div class="footer">
    <div>${businessName} · ${businessAddress}</div>
    <div>Gegenereerd met Vasco</div>
  </div>
</body>
</html>`;
}

export async function generateQuotePdf(
  quote: QuotePdfData,
  businessName: string = 'Mijn Bedrijf',
  businessAddress: string = '',
  kvkNumber: string = '',
  vatNumber: string = '',
): Promise<void> {
  const html = buildQuoteHtml(quote, businessName, businessAddress, kvkNumber, vatNumber);
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Offerte ${quote.quoteNumber}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
