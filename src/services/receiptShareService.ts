// =============================================================================
// RECEIPT SHARE — generate a compact receipt PDF locally and open Share sheet
// =============================================================================
// Used after "Mark as paid" in the invoice detail — gives the contractor a
// ready-to-send receipt for WhatsApp/email without waiting for the webhook
// loop. Uses expo-print (already installed) to render HTML to PDF.
// =============================================================================

import * as Print from 'expo-print';
import { Share } from 'react-native';
import type { Invoice } from '../domain/documents';

interface ReceiptArgs {
  invoice: Pick<Invoice, 'id' | 'amount' | 'customer'>;
  businessName: string;
  paidAt?: Date;
  paymentMethod?: string;
  locale?: 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
  currency?: string;
}

const HEADINGS: Record<string, string> = {
  en: 'Receipt',
  nl: 'Ontvangstbewijs',
  de: 'Zahlungsbeleg',
  fr: 'Reçu',
  es: 'Recibo',
  it: 'Ricevuta',
};

const PAID_LABEL: Record<string, string> = {
  en: 'Paid',
  nl: 'Betaald',
  de: 'Bezahlt',
  fr: 'Payé',
  es: 'Pagado',
  it: 'Pagato',
};

function html(args: ReceiptArgs): string {
  const loc = args.locale ?? 'nl';
  const currency = args.currency ?? (loc === 'en' ? 'GBP' : 'EUR');
  const paidAt = args.paidAt ?? new Date();
  const paidStr = paidAt.toLocaleString(loc);
  const amount = `${currency} ${args.invoice.amount.toFixed(2)}`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Inter, sans-serif; color: #0D1B2A; padding: 40px; }
    h1 { color: #E35205; margin: 0; font-size: 28px; }
    .ref { color: #6B7280; font-size: 13px; margin-top: 2px; }
    .row { display: flex; justify-content: space-between; margin: 24px 0; padding: 16px 0; border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; }
    .amount { font-size: 32px; font-weight: 700; color: #0D1B2A; }
    .meta { margin-top: 24px; font-size: 13px; color: #6B7280; }
    .meta strong { color: #0D1B2A; }
    .biz { margin-top: 40px; font-size: 12px; color: #9CA3AF; }
    .tag { display: inline-block; padding: 4px 10px; background: #D1FAE5; color: #065F46; border-radius: 6px; font-size: 12px; font-weight: 600; }
  </style></head><body>
    <h1>${HEADINGS[loc] ?? HEADINGS.en}</h1>
    <div class="ref">${args.invoice.id}</div>
    <div class="row">
      <div>
        <div class="amount">${amount}</div>
        <div style="margin-top:8px"><span class="tag">${PAID_LABEL[loc] ?? PAID_LABEL.en}</span></div>
      </div>
      <div style="text-align:right">
        <div class="meta"><strong>${args.invoice.customer}</strong></div>
        <div class="meta">${paidStr}</div>
        ${args.paymentMethod ? `<div class="meta">${args.paymentMethod}</div>` : ''}
      </div>
    </div>
    <div class="biz">${args.businessName}</div>
  </body></html>`;
}

export async function shareReceipt(args: ReceiptArgs): Promise<{ ok: boolean; uri?: string; error?: string }> {
  try {
    const { uri } = await Print.printToFileAsync({ html: html(args) });
    await Share.share({ url: uri, title: `${HEADINGS[args.locale ?? 'nl'] ?? 'Receipt'} ${args.invoice.id}` });
    return { ok: true, uri };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
