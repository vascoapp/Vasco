// =============================================================================
// VAT REPORT EXPORT — the PDF and the spreadsheet the accountant receives
// =============================================================================
// The figures come from `buildVatReport` (src/services/vatReport.ts) and are
// only FORMATTED here: nothing is recomputed, so the export states what the
// screen states, which states what the invoices state.
//
// The CSV follows the ACCOUNTANT's spreadsheet, i.e. the market (not the
// phone's language): `;` and a decimal comma in NL/DE/FR/ES/IT, `,` and a
// point in the UK — a Dutch Excel opens "1,234.56" as one column of text.
// The `language` argument is that style: 'en' = UK, anything else = EU.
// =============================================================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Share } from 'react-native';
import type { VatReport, VatReportRow } from './vatReport';

type T = (key: string, opts?: Record<string, unknown>) => string;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Amount as the contractor's market writes it, without a currency symbol (CSV cells). */
export function csvAmount(n: number, language: string): string {
  const fixed = n.toFixed(2);
  return language === 'en' ? fixed : fixed.replace('.', ',');
}
const csvSep = (language: string) => (language === 'en' ? ',' : ';');
const csvCell = (raw: string, sep: string) => {
  // A customer, supplier or scanned text starting with = + - @ would run as a
  // formula in the accountant's Excel: neutralised with a leading quote
  // (amounts are written by us and never start that way).
  const v = /^[=+\-@]/.test(raw) && !/^-?\d/.test(raw) ? `'${raw}` : raw;
  return /["\n\r]/.test(v) || v.includes(sep) ? `"${v.replace(/"/g, '""')}"` : v;
};

export function rowLabel(r: VatReportRow, t: T): string {
  return r.ratePct === 0 && r.nature
    ? t('vatReport.rateNature', { nature: r.nature, defaultValue: '0 % — {{nature}}' })
    : t('vatReport.rate', { rate: String(r.ratePct).replace('.', ','), defaultValue: '{{rate}} %' });
}

/** One flat list: every sale (per invoice, per rate) and every purchase. */
export function vatReportCsv(report: VatReport, t: T, language: string): string {
  const sep = csvSep(language);
  const head = [
    t('vatReport.colSection', { defaultValue: 'Type' }),
    t('vatReport.colDate', { defaultValue: 'Date' }),
    t('vatReport.colDocument', { defaultValue: 'Document' }),
    t('vatReport.colParty', { defaultValue: 'Customer / supplier' }),
    t('vatReport.colRate', { defaultValue: 'Rate' }),
    t('vatReport.colNet', { defaultValue: 'Net' }),
    t('vatReport.colVat', { defaultValue: 'VAT' }),
  ];
  const lines: string[][] = [head];
  const sale = t('vatReport.sectionSale', { defaultValue: 'Sale' });
  const purchase = t('vatReport.sectionPurchase', { defaultValue: 'Purchase' });
  for (const inv of report.sales.invoices) {
    for (const r of inv.rows) lines.push([sale, inv.date, inv.number, inv.customer, rowLabel(r, t), csvAmount(r.net, language), csvAmount(r.vat, language)]);
  }
  for (const p of report.purchases.items) {
    lines.push([purchase, p.date, p.description, p.supplier, rowLabel({ ratePct: p.ratePct, net: p.net, vat: p.vat }, t), csvAmount(p.net, language), csvAmount(p.vat, language)]);
  }
  // The BOM makes Excel read UTF-8: without it "Fontanería" opened as "FontanerÃ­a".
  return '\uFEFF' + lines.map((l) => l.map((c) => csvCell(c, sep)).join(sep)).join('\r\n') + '\r\n';
}

/** The printed report: totals per rate, the balance, the documents behind them. */
export function vatReportHtml(report: VatReport, t: T, money: (n: number) => string, businessName: string): string {
  const rows = (rs: VatReportRow[]) => rs.map((r) => `<tr><td>${escapeHtml(rowLabel(r, t))}</td><td class="n">${money(r.net)}</td><td class="n">${money(r.vat)}</td></tr>`).join('');
  const invoices = report.sales.invoices.map((i) => `<tr><td>${escapeHtml(i.date)}</td><td>${escapeHtml(i.number)}</td><td>${escapeHtml(i.customer)}</td><td class="n">${money(i.net)}</td><td class="n">${money(i.vat)}</td></tr>`).join('');
  const purchases = report.purchases.items.map((p) => `<tr><td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.supplier)}</td><td>${escapeHtml(p.description)}</td><td class="n">${money(p.net)}</td><td class="n">${money(p.vat)}</td></tr>`).join('');
  const notIncluded = [
    ...(report.notIncluded.drafts.length ? [`<p><b>${escapeHtml(t('vatReport.draftsTitle', { defaultValue: 'Not included: drafts' }))}</b> — ${report.notIncluded.drafts.map((d) => escapeHtml(d.number)).join(', ')}</p>`] : []),
    ...(report.notIncluded.unpaidOnCashBasis.length ? [`<p><b>${escapeHtml(t('vatReport.unpaidTitle', { defaultValue: 'Not included: unpaid (cash basis)' }))}</b> — ${report.notIncluded.unpaidOnCashBasis.map((d) => escapeHtml(d.number)).join(', ')}</p>`] : []),
  ].join('');
  const balanceLabel = report.balance >= 0 ? t('vatReport.toPay', { defaultValue: 'To pay' }) : t('vatReport.toReclaim', { defaultValue: 'To reclaim' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;padding:32px;font-size:12px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:24px 0 8px}
table{width:100%;border-collapse:collapse}td,th{padding:5px 6px;border-bottom:1px solid #ddd;text-align:left}
th{font-size:11px;color:#555}.n{text-align:right;white-space:nowrap}.total td{font-weight:700;border-top:2px solid #111}
.note{color:#555;font-size:11px;margin-top:24px}
</style></head><body>
<h1>${escapeHtml(t('vatReport.title', { defaultValue: 'VAT report' }))} — ${escapeHtml(businessName)}</h1>
<div>${escapeHtml(report.periodStart)} – ${escapeHtml(report.periodEnd)} · ${escapeHtml(report.basis === 'cash' ? t('vatReport.basisCash', { defaultValue: 'Counted on the payment date' }) : t('vatReport.basisInvoice', { defaultValue: 'Counted on the invoice date' }))}</div>
${report.exempt ? `<p>${escapeHtml(t('vatReport.exemptBody', { defaultValue: 'Small-business scheme: you charge no VAT and reclaim none.' }))}</p>` : ''}
<h2>${escapeHtml(t('vatReport.sales', { defaultValue: 'Sales' }))}</h2>
<table><tr><th></th><th class="n">${escapeHtml(t('vatReport.net', { defaultValue: 'Net' }))}</th><th class="n">${escapeHtml(t('vatReport.vat', { defaultValue: 'VAT' }))}</th></tr>${rows(report.sales.rows)}
<tr class="total"><td></td><td class="n">${money(report.sales.net)}</td><td class="n">${money(report.sales.vat)}</td></tr></table>
<h2>${escapeHtml(t('vatReport.purchases', { defaultValue: 'Purchases' }))}</h2>
<table><tr><th></th><th class="n">${escapeHtml(t('vatReport.net', { defaultValue: 'Net' }))}</th><th class="n">${escapeHtml(t('vatReport.vat', { defaultValue: 'VAT' }))}</th></tr>${rows(report.purchases.rows)}
<tr class="total"><td></td><td class="n">${money(report.purchases.net)}</td><td class="n">${money(report.purchases.vat)}</td></tr></table>
<h2>${escapeHtml(t('vatReport.balance', { defaultValue: 'Balance' }))}: ${escapeHtml(balanceLabel)} ${money(Math.abs(report.balance))}</h2>
${notIncluded}
<h2>${escapeHtml(t('vatReport.invoices', { defaultValue: 'Invoices in this report' }))}</h2>
<table><tr><th>${escapeHtml(t('vatReport.colDate', { defaultValue: 'Date' }))}</th><th>${escapeHtml(t('vatReport.colDocument', { defaultValue: 'Document' }))}</th><th>${escapeHtml(t('vatReport.colParty', { defaultValue: 'Customer / supplier' }))}</th><th class="n">${escapeHtml(t('vatReport.net', { defaultValue: 'Net' }))}</th><th class="n">${escapeHtml(t('vatReport.vat', { defaultValue: 'VAT' }))}</th></tr>${invoices}</table>
<h2>${escapeHtml(t('vatReport.purchasesList', { defaultValue: 'Purchases in this report' }))}</h2>
<table><tr><th>${escapeHtml(t('vatReport.colDate', { defaultValue: 'Date' }))}</th><th>${escapeHtml(t('vatReport.colParty', { defaultValue: 'Customer / supplier' }))}</th><th></th><th class="n">${escapeHtml(t('vatReport.net', { defaultValue: 'Net' }))}</th><th class="n">${escapeHtml(t('vatReport.vat', { defaultValue: 'VAT' }))}</th></tr>${purchases}</table>
<p class="note">${escapeHtml(t('vatReport.disclaimer', { defaultValue: 'Vasco prepares this report from your invoices and receipts. You or your accountant file the VAT return. Reverse charge, cross-border work and private-use corrections are for your accountant.' }))}</p>
</body></html>`;
}

const fileTitle = (report: VatReport) => `vat-${report.periodStart}_${report.periodEnd}`;

export async function shareVatReportPdf(report: VatReport, t: T, money: (n: number) => string, businessName: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: vatReportHtml(report, t, money, businessName), base64: false });
  // Named by the period, so the accountant's inbox does not fill with "print-1.pdf".
  let shareUri = uri;
  try {
    const target = new File(Paths.cache, `${fileTitle(report)}.pdf`);
    if (target.exists) target.delete();
    new File(uri).move(target);
    shareUri = target.uri;
  } catch { /* the unnamed file still shares */ }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', dialogTitle: fileTitle(report), UTI: 'com.adobe.pdf' });
  }
}

export async function shareVatReportCsv(report: VatReport, t: T, language: string): Promise<void> {
  const content = vatReportCsv(report, t, language);
  const file = new File(Paths.cache, `${fileTitle(report)}.csv`);
  if (file.exists) file.delete();
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: fileTitle(report), UTI: 'public.comma-separated-values-text' });
  } else {
    await Share.share({ message: content, title: fileTitle(report) });
  }
}
