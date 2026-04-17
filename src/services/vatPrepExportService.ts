// =============================================================================
// VAT PREP EXPORT SERVICE
// =============================================================================
// Three export paths for a VatReturnDraft:
//   1. Plain-text summary (shareSummary) — native Share sheet. Contractor can
//      paste into their boekhouder's email or copy to Belastingdienst portal.
//   2. PDF (sharePdf) — formatted BTW return preview for email-to-boekhouder.
//   3. DigiD deep link (openDigiD) — jumps to the Belastingdienst business
//      portal where the contractor completes and files the actual return.
//
// Strict prepare-only: this service NEVER files. It only produces artifacts.
// =============================================================================

import { Share, Linking } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { VatReturnDraft, VatLine } from './vatPrepService';

// Belastingdienst business portal — the landing page where EH- or eHerkenning-
// authenticated entrepreneurs file their BTW return. NOT a deep link to the
// form itself (Belastingdienst does not publish one), but close enough that
// the contractor lands in the right place.
const DIGID_BTW_URL = 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/btw_aangifte_doen_en_betalen/';

function fmtEur(n: number): string {
  return `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Compact plain-text summary suitable for pasting into email, Belastingdienst
 * portal fields, or a boekhouder's intake form. Keep one column — many
 * webforms collapse whitespace.
 */
export function formatSummary(draft: VatReturnDraft, businessName: string): string {
  const lines: string[] = [];
  lines.push(`BTW-aangifte — ${draft.period}`);
  lines.push(`${businessName}`);
  lines.push(`Periode: ${draft.periodStart} → ${draft.periodEnd}`);
  lines.push('');
  lines.push('─ Rubrieken ─');
  lines.push(`1a (21%):       ${fmtEur(draft.rubriek_1a.net)} / ${fmtEur(draft.rubriek_1a.vat)}`);
  lines.push(`1b (9%):        ${fmtEur(draft.rubriek_1b.net)} / ${fmtEur(draft.rubriek_1b.vat)}`);
  lines.push(`1c (0%):        ${fmtEur(draft.rubriek_1c.net)} / ${fmtEur(draft.rubriek_1c.vat)}`);
  lines.push(`2a (verlegd):   ${fmtEur(draft.rubriek_2a.net)} / ${fmtEur(draft.rubriek_2a.vat)}`);
  lines.push(`3a (EU):        ${fmtEur(draft.rubriek_3a.net)} / ${fmtEur(draft.rubriek_3a.vat)}`);
  lines.push(`3b (non-EU):    ${fmtEur(draft.rubriek_3b.net)} / ${fmtEur(draft.rubriek_3b.vat)}`);
  lines.push(`4a (intra-EU):  ${fmtEur(draft.rubriek_4a.net)} / ${fmtEur(draft.rubriek_4a.vat)}`);
  lines.push(`5b (voorbelasting, kosten): ${fmtEur(draft.rubriek_5b.net)} / ${fmtEur(draft.rubriek_5b.vat)}`);
  lines.push('');
  lines.push('─ Totalen ─');
  lines.push(`Verschuldigde BTW: ${fmtEur(draft.totalOutputVat)}`);
  lines.push(`Voorbelasting:     ${fmtEur(draft.totalInputVat)}`);
  lines.push(`Te betalen/terug:  ${fmtEur(draft.netPayable)}`);
  if (draft.yoyVariancePct !== null) {
    lines.push(`YoY variatie:      ${draft.yoyVariancePct.toFixed(1)}%`);
  }
  if (draft.lowConfidenceLines > 0) {
    lines.push('');
    lines.push(`⚠ ${draft.lowConfidenceLines} regels met lage zekerheid — controleer voor verzending.`);
  }
  if (draft.warnings.length > 0) {
    lines.push('');
    lines.push('─ Waarschuwingen ─');
    for (const w of draft.warnings) lines.push(`• ${w}`);
  }
  lines.push('');
  lines.push('Vasco bereidt voor. Zelf indienen via Belastingdienst DigiD of boekhouder.');
  return lines.join('\n');
}

/** Trigger the native Share sheet with the plain-text summary. iOS surfaces
 * "Copy" + "Mail" + "WhatsApp" etc.; Android surfaces intent targets. */
export async function shareSummary(draft: VatReturnDraft, businessName: string): Promise<void> {
  const message = formatSummary(draft, businessName);
  await Share.share({
    message,
    title: `BTW-aangifte ${draft.period}`,
  });
}

/** Render the draft to an HTML table, print to a local PDF file, and hand it
 * to the native share sheet — same pattern as invoicePdfService. Contractor
 * emails the PDF to their boekhouder. */
export async function sharePdf(draft: VatReturnDraft, businessName: string): Promise<void> {
  const html = renderHtml(draft, businessName);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `BTW ${draft.period}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

/** Open the Belastingdienst portal in the device browser. Contractor
 * authenticates via DigiD or eHerkenning and completes the return manually. */
export async function openDigiD(): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(DIGID_BTW_URL);
    if (!supported) return false;
    await Linking.openURL(DIGID_BTW_URL);
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function renderHtml(draft: VatReturnDraft, businessName: string): string {
  const row = (label: string, net: number, vat: number) => `
    <tr>
      <td class="label">${escape(label)}</td>
      <td class="num">${fmtEur(net)}</td>
      <td class="num">${fmtEur(vat)}</td>
    </tr>
  `;
  const lowConf = draft.lines.filter((l) => l.confidence < 0.75);
  const warningsHtml = draft.warnings.length
    ? `<section><h2>Waarschuwingen</h2><ul>${draft.warnings.map((w) => `<li>${escape(w)}</li>`).join('')}</ul></section>`
    : '';
  const lowConfHtml = lowConf.length
    ? `<section><h2>Regels met lage zekerheid (${lowConf.length})</h2>${renderLines(lowConf)}</section>`
    : '';
  return `
<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>BTW-aangifte ${escape(draft.period)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Inter, Helvetica, Arial, sans-serif; color: #111; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.3px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.8px; color: #666; margin: 28px 0 10px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  .banner { background: #FFF7F0; border: 1px solid #E35205; border-radius: 10px; padding: 10px 14px; color: #8A3400; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 6px; border-bottom: 1px solid #EAEAEA; font-size: 12px; }
  th { text-align: left; color: #666; font-weight: 600; }
  td.label { color: #111; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .total-row td { font-weight: 700; border-top: 2px solid #111; }
  .footer { margin-top: 32px; color: #666; font-size: 11px; }
  ul { padding-left: 16px; }
  li { font-size: 12px; margin-bottom: 4px; }
</style>
</head>
<body>
  <h1>BTW-aangifte — ${escape(draft.period)}</h1>
  <div class="meta">${escape(businessName)} · ${escape(draft.periodStart)} → ${escape(draft.periodEnd)}</div>

  <div class="banner">
    Vasco heeft deze aangifte voorbereid op basis van je facturen en kosten. Controleer de cijfers. <strong>Vasco dient nooit automatisch in.</strong>
    Jij dient zelf in via Belastingdienst (DigiD/eHerkenning) of geef dit document door aan je boekhouder.
  </div>

  <h2>Rubrieken</h2>
  <table>
    <thead>
      <tr><th>Rubriek</th><th class="num">Omzet</th><th class="num">BTW</th></tr>
    </thead>
    <tbody>
      ${row('1a — Leveringen/diensten belast met 21%', draft.rubriek_1a.net, draft.rubriek_1a.vat)}
      ${row('1b — Leveringen/diensten belast met 9%', draft.rubriek_1b.net, draft.rubriek_1b.vat)}
      ${row('1c — Leveringen/diensten belast met 0%', draft.rubriek_1c.net, draft.rubriek_1c.vat)}
      ${row('2a — Verleggingsregeling (B2B bouw)', draft.rubriek_2a.net, draft.rubriek_2a.vat)}
      ${row('3a — Leveringen binnen EU', draft.rubriek_3a.net, draft.rubriek_3a.vat)}
      ${row('3b — Leveringen buiten EU', draft.rubriek_3b.net, draft.rubriek_3b.vat)}
      ${row('4a — Verwervingen binnen EU', draft.rubriek_4a.net, draft.rubriek_4a.vat)}
      ${row('5b — Voorbelasting (inkoop & kosten)', draft.rubriek_5b.net, draft.rubriek_5b.vat)}
    </tbody>
  </table>

  <h2>Totalen</h2>
  <table>
    <tbody>
      <tr><td class="label">Verschuldigde BTW</td><td class="num">${fmtEur(draft.totalOutputVat)}</td></tr>
      <tr><td class="label">Voorbelasting</td><td class="num">${fmtEur(draft.totalInputVat)}</td></tr>
      <tr class="total-row"><td class="label">Te betalen / terug te ontvangen</td><td class="num">${fmtEur(draft.netPayable)}</td></tr>
      ${draft.yoyVariancePct !== null ? `<tr><td class="label">YoY variatie vs vorig jaar</td><td class="num">${draft.yoyVariancePct.toFixed(1)}%</td></tr>` : ''}
    </tbody>
  </table>

  ${lowConfHtml}
  ${warningsHtml}

  <div class="footer">
    Gegenereerd door Vasco · ${new Date(draft.generatedAt).toLocaleString('nl-NL')} · Voor jouw eigen administratie. Vasco dient niet zelf in.
  </div>
</body>
</html>
`;
}

function renderLines(lines: VatLine[]): string {
  const rows = lines
    .map(
      (l) => `
    <tr>
      <td class="label">${escape(l.description)}</td>
      <td class="num">${fmtEur(l.netAmount)}</td>
      <td class="num">${fmtEur(l.vatAmount)}</td>
      <td class="num">${Math.round(l.confidence * 100)}%</td>
    </tr>`,
    )
    .join('');
  return `
    <table>
      <thead>
        <tr><th>Omschrijving</th><th class="num">Netto</th><th class="num">BTW</th><th class="num">Zekerheid</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
