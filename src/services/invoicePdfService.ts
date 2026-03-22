/**
 * Invoice PDF Service — generates a branded Dutch PDF invoice
 * and shares it via the system share sheet.
 * Uses expo-print + expo-sharing (same pattern as budgetPdfService).
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { AutoInvoice } from './invoiceAutomationService';

// ── Number formatting (Dutch) ──────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── HTML Template ──────────────────────────────────────────

function buildInvoiceHtml(
  invoice: AutoInvoice,
  businessName: string,
  businessAddress: string,
  kvkNumber: string,
  vatNumber: string,
  paymentUrl?: string,
): string {
  const issueDate = invoice.issueDate.toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dueDate = invoice.dueDate.toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lineItemRows = invoice.lineItems
    .map(
      (item) => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">\u20AC${fmt(item.unitPrice)}</td>
      <td style="text-align:center">${item.vatRate}%</td>
      <td style="text-align:right">\u20AC${fmt(item.quantity * item.unitPrice)}</td>
    </tr>`,
    )
    .join('\n');

  const statusLabel = (() => {
    switch (invoice.status) {
      case 'paid': return 'BETAALD';
      case 'overdue': return 'VERLOPEN';
      case 'sent': return 'VERZONDEN';
      default: return 'CONCEPT';
    }
  })();

  const statusColor = (() => {
    switch (invoice.status) {
      case 'paid': return '#34C759';
      case 'overdue': return '#FF3B30';
      case 'sent': return '#007AFF';
      default: return '#999';
    }
  })();

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; padding: 40px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #E35205; padding-bottom: 20px; }
    .header h1 { font-size: 28px; font-weight: 700; color: #1a1a1a; }
    .header .invoice-number { font-size: 16px; color: #E35205; font-weight: 600; margin-top: 4px; }
    .header .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: #fff; background: ${statusColor}; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 32px; gap: 40px; }
    .address-block { flex: 1; }
    .address-block .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 6px; }
    .address-block .name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
    .address-block .detail { font-size: 13px; color: #666; margin-top: 2px; }
    .dates { display: flex; gap: 32px; margin-bottom: 32px; }
    .date-item .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #999; }
    .date-item .value { font-size: 14px; font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f5f5f3; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #666; text-align: left; padding: 10px 12px; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
    tr:last-child td { border-bottom: none; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .totals-table { width: 280px; }
    .totals-table .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .totals-table .row.total { border-top: 2px solid #1a1a1a; padding-top: 10px; margin-top: 4px; font-size: 18px; font-weight: 700; }
    .payment-info { background: #f8f8f6; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .payment-info h3 { font-size: 13px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
    .payment-info .detail { font-size: 13px; color: #1a1a1a; margin-top: 4px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #999; }
    .accent { color: #E35205; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Factuur</h1>
      <div class="invoice-number">${invoice.invoiceNumber}</div>
    </div>
    <div style="text-align:right">
      <span class="status">${statusLabel}</span>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <div class="label">Van</div>
      <div class="name">${businessName || 'Uw Bedrijf'}</div>
      <div class="detail">${businessAddress || ''}</div>
      ${kvkNumber ? `<div class="detail">KvK: ${kvkNumber}</div>` : ''}
      ${vatNumber ? `<div class="detail">BTW: ${vatNumber}</div>` : ''}
    </div>
    <div class="address-block">
      <div class="label">Aan</div>
      <div class="name">${invoice.customerName}</div>
      <div class="detail">${invoice.customerAddress}</div>
      ${invoice.customerEmail ? `<div class="detail">${invoice.customerEmail}</div>` : ''}
    </div>
  </div>

  <div class="dates">
    <div class="date-item">
      <div class="label">Factuurdatum</div>
      <div class="value">${issueDate}</div>
    </div>
    <div class="date-item">
      <div class="label">Vervaldatum</div>
      <div class="value">${dueDate}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Omschrijving</th>
        <th style="text-align:center">Aantal</th>
        <th style="text-align:right">Prijs</th>
        <th style="text-align:center">BTW</th>
        <th style="text-align:right">Bedrag</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="row">
        <span>Subtotaal</span>
        <span>\u20AC${fmt(invoice.subtotal)}</span>
      </div>
      ${(() => {
        // Group VAT by rate
        const vatByRate = new Map<number, number>();
        invoice.lineItems.forEach(li => {
          const vatAmt = li.quantity * li.unitPrice * li.vatRate / 100;
          vatByRate.set(li.vatRate, (vatByRate.get(li.vatRate) ?? 0) + vatAmt);
        });
        return Array.from(vatByRate.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([rate, amount]) => `<div class="row"><span>BTW ${rate}%</span><span>\\u20AC${fmt(amount)}</span></div>`)
          .join('\\n');
      })()}
      <div class="row total">
        <span>Totaal</span>
        <span>\u20AC${fmt(invoice.total)}</span>
      </div>
    </div>
  </div>

  <div class="payment-info">
    <h3>Betalingsinformatie</h3>
    <div class="detail">Gelieve het bedrag van <strong>\u20AC${fmt(invoice.total)}</strong> over te maken binnen 14 dagen.</div>
    <div class="detail">Vermeld het factuurnummer <strong>${invoice.invoiceNumber}</strong> bij uw betaling.</div>
    ${paymentUrl ? `<div style="margin-top:16px;text-align:center"><a href="${paymentUrl}" style="display:inline-block;background:#E35205;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Betaal direct online</a></div>` : ''}
  </div>

  <div class="footer">
    Gegenereerd met <span class="accent">Vasco</span> \u2014 AI-platform voor de installatiebranche
  </div>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────

export function buildInvoiceShareText(invoice: AutoInvoice, businessName?: string, paymentUrl?: string): string {
  const lines = invoice.lineItems.map(li =>
    `• ${li.description}: ${li.quantity}× €${fmt(li.unitPrice)} = €${fmt(li.quantity * li.unitPrice)}`,
  ).join('\n');

  const parts = [
    `Factuur ${invoice.invoiceNumber}`,
    `Van: ${businessName || 'Uw bedrijf'}`,
    `Aan: ${invoice.customerName}`,
    ``,
    lines,
    ``,
    `Subtotaal: €${fmt(invoice.subtotal)}`,
    `BTW: €${fmt(invoice.vatAmount)}`,
    `Totaal: €${fmt(invoice.total)}`,
    ``,
    `Vervaldatum: ${invoice.dueDate.toLocaleDateString('nl-NL')}`,
    `Vermeld "${invoice.invoiceNumber}" bij betaling.`,
  ];

  if (paymentUrl) {
    parts.push(``, `Betaal direct: ${paymentUrl}`);
  }

  return parts.join('\n');
}

export async function generateInvoicePdf(
  invoice: AutoInvoice,
  businessProfile?: {
    businessName?: string;
    address?: string;
    kvkNumber?: string;
    vatNumber?: string;
  },
  paymentUrl?: string,
): Promise<void> {
  const html = buildInvoiceHtml(
    invoice,
    businessProfile?.businessName ?? '',
    businessProfile?.address ?? '',
    businessProfile?.kvkNumber ?? '',
    businessProfile?.vatNumber ?? '',
    paymentUrl,
  );

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Factuur ${invoice.invoiceNumber}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
