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

// Belastingdienst (NL) and Elster (DE) business portals — landing pages where
// authenticated entrepreneurs file their VAT return. NOT deep links to the
// form (neither portal publishes one), but close enough that the contractor
// lands in the right place.
const PORTAL_URL: Record<'NL' | 'DE', string> = {
  NL: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/btw_aangifte_doen_en_betalen/',
  DE: 'https://www.elster.de/eportal/start',
};

// R11.2: country-aware locale + currency formatting. Was hardcoded nl-NL even
// when a German contractor was filing UStVA — turning "1.234,56" (correct for
// both DE and NL but with different separators by convention) and Dutch label
// strings into a confusing mix.
function fmtEur(n: number, country: 'NL' | 'DE' = 'NL'): string {
  const locale = country === 'DE' ? 'de-DE' : 'nl-NL';
  return `€${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CountryStrings {
  returnTitle: string;          // "BTW-aangifte" / "Umsatzsteuer-Voranmeldung"
  rubriekenHeader: string;      // "Rubrieken" / "Kennzahlen"
  totalsHeader: string;         // "Totalen" / "Summen"
  warningsHeader: string;       // "Waarschuwingen" / "Hinweise"
  outputVatLabel: string;       // "Verschuldigde BTW" / "Geschuldete USt"
  inputVatLabel: string;        // "Voorbelasting" / "Vorsteuer"
  netPayableLabel: string;      // "Te betalen/terug" / "Zahllast / Erstattung"
  yoyVarianceLabel: string;     // "YoY variatie" / "VoJ-Abweichung"
  lowConfLine: string;          // "regels met lage zekerheid" / "Zeilen mit geringer Sicherheit"
  periodLabel: string;          // "Periode" / "Zeitraum"
  preparedFooter: string;
  rowLabels: Record<string, string>;
}

const NL_STRINGS: CountryStrings = {
  returnTitle: 'BTW-aangifte',
  rubriekenHeader: 'Rubrieken',
  totalsHeader: 'Totalen',
  warningsHeader: 'Waarschuwingen',
  outputVatLabel: 'Verschuldigde BTW',
  inputVatLabel: 'Voorbelasting',
  netPayableLabel: 'Te betalen/terug',
  yoyVarianceLabel: 'YoY variatie',
  lowConfLine: 'regels met lage zekerheid — controleer voor verzending.',
  periodLabel: 'Periode',
  preparedFooter: 'Vasco bereidt voor. Zelf indienen via Belastingdienst DigiD of boekhouder.',
  rowLabels: {
    rubriek_1a: '1a (21%)',
    rubriek_1b: '1b (9%)',
    rubriek_1c: '1c (0%)',
    rubriek_2a: '2a (verlegd)',
    rubriek_3a: '3a (EU)',
    rubriek_3b: '3b (non-EU)',
    rubriek_4a: '4a (intra-EU)',
    rubriek_5b: '5b (voorbelasting, kosten)',
  },
};

const DE_STRINGS: CountryStrings = {
  returnTitle: 'Umsatzsteuer-Voranmeldung',
  rubriekenHeader: 'Kennzahlen',
  totalsHeader: 'Summen',
  warningsHeader: 'Hinweise',
  outputVatLabel: 'Geschuldete USt',
  inputVatLabel: 'Vorsteuer',
  netPayableLabel: 'Zahllast / Erstattung',
  yoyVarianceLabel: 'VoJ-Abweichung',
  lowConfLine: 'Zeilen mit geringer Sicherheit — vor Übermittlung prüfen.',
  periodLabel: 'Zeitraum',
  preparedFooter: 'Vasco bereitet vor. Eigene Übermittlung per Elster oder Steuerberater.',
  rowLabels: {
    kz_81: 'KZ 81 (19% Standardsatz)',
    kz_86: 'KZ 86 (7% ermäßigt)',
    kz_35: 'KZ 35 (§13b Reverse Charge)',
    kz_41: 'KZ 41 (innergem. Lieferungen)',
    kz_43: 'KZ 43 (Ausfuhrlieferungen)',
    kz_66: 'KZ 66 (Vorsteuerabzug)',
  },
};

function stringsFor(country: 'NL' | 'DE'): CountryStrings {
  return country === 'DE' ? DE_STRINGS : NL_STRINGS;
}

/**
 * Compact plain-text summary suitable for pasting into email, Belastingdienst
 * portal fields, or a boekhouder's intake form. Keep one column — many
 * webforms collapse whitespace.
 */
export function formatSummary(draft: VatReturnDraft, businessName: string): string {
  // R11.2: country-aware. The screen supports NL BTW + DE UStVA but this
  // service was hardcoded to Dutch labels + Dutch portal — German contractors
  // got a confusing mix of NL labels with €0 values (since rubriek_* are zero
  // on DE returns; their data lives under rollups.kz_*).
  const country = draft.country ?? 'NL';
  const s = stringsFor(country);
  const lines: string[] = [];
  lines.push(`${s.returnTitle} — ${draft.period}`);
  lines.push(`${businessName}`);
  lines.push(`${s.periodLabel}: ${draft.periodStart} → ${draft.periodEnd}`);
  lines.push('');
  lines.push(`─ ${s.rubriekenHeader} ─`);

  // Iterate over rollups (country-agnostic source) — works for NL rubriek_* and DE kz_*.
  const orderedKeys = country === 'DE'
    ? ['kz_81', 'kz_86', 'kz_35', 'kz_41', 'kz_43', 'kz_66']
    : ['rubriek_1a', 'rubriek_1b', 'rubriek_1c', 'rubriek_2a', 'rubriek_3a', 'rubriek_3b', 'rubriek_4a', 'rubriek_5b'];
  for (const key of orderedKeys) {
    const bucket = draft.rollups[key];
    if (!bucket) continue;
    const label = s.rowLabels[key] ?? key;
    lines.push(`${label.padEnd(28)}${fmtEur(bucket.net, country)} / ${fmtEur(bucket.vat, country)}`);
  }
  lines.push('');
  lines.push(`─ ${s.totalsHeader} ─`);
  lines.push(`${s.outputVatLabel}: ${fmtEur(draft.totalOutputVat, country)}`);
  lines.push(`${s.inputVatLabel}:     ${fmtEur(draft.totalInputVat, country)}`);
  lines.push(`${s.netPayableLabel}:  ${fmtEur(draft.netPayable, country)}`);
  if (draft.yoyVariancePct !== null) {
    lines.push(`${s.yoyVarianceLabel}:      ${draft.yoyVariancePct.toFixed(1)}%`);
  }
  if (draft.lowConfidenceLines > 0) {
    lines.push('');
    lines.push(`⚠ ${draft.lowConfidenceLines} ${s.lowConfLine}`);
  }
  if (draft.warnings.length > 0) {
    lines.push('');
    lines.push(`─ ${s.warningsHeader} ─`);
    for (const w of draft.warnings) lines.push(`• ${w}`);
  }
  lines.push('');
  lines.push(s.preparedFooter);
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
    const country = draft.country ?? 'NL';
    const title = country === 'DE' ? 'UStVA' : 'BTW';
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${title} ${draft.period}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

/** Open the country's tax portal in the device browser. Contractor
 * authenticates (DigiD/eHerkenning for NL, ELSTER-Zertifikat for DE) and
 * completes the return manually. R11.2: was always NL — German contractors
 * got linked to Belastingdienst. */
export async function openDigiD(country: 'NL' | 'DE' = 'NL'): Promise<boolean> {
  const url = PORTAL_URL[country] ?? PORTAL_URL.NL;
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function renderHtml(draft: VatReturnDraft, businessName: string): string {
  const country = draft.country ?? 'NL';
  const s = stringsFor(country);
  const row = (label: string, net: number, vat: number) => `
    <tr>
      <td class="label">${escape(label)}</td>
      <td class="num">${fmtEur(net, country)}</td>
      <td class="num">${fmtEur(vat, country)}</td>
    </tr>
  `;
  const lowConf = draft.lines.filter((l) => l.confidence < 0.75);
  const lowConfTitle = country === 'DE' ? 'Zeilen mit geringer Sicherheit' : 'Regels met lage zekerheid';
  const warningsHtml = draft.warnings.length
    ? `<section><h2>${s.warningsHeader}</h2><ul>${draft.warnings.map((w) => `<li>${escape(w)}</li>`).join('')}</ul></section>`
    : '';
  const lowConfHtml = lowConf.length
    ? `<section><h2>${lowConfTitle} (${lowConf.length})</h2>${renderLines(lowConf, country)}</section>`
    : '';
  const orderedKeys = country === 'DE'
    ? ['kz_81', 'kz_86', 'kz_35', 'kz_41', 'kz_43', 'kz_66']
    : ['rubriek_1a', 'rubriek_1b', 'rubriek_1c', 'rubriek_2a', 'rubriek_3a', 'rubriek_3b', 'rubriek_4a', 'rubriek_5b'];
  const rowsHtml = orderedKeys
    .map(key => {
      const bucket = draft.rollups[key];
      if (!bucket) return '';
      return row(s.rowLabels[key] ?? key, bucket.net, bucket.vat);
    })
    .join('\n');
  const banner = country === 'DE'
    ? 'Vasco hat diese Voranmeldung anhand deiner Rechnungen und Kosten vorbereitet. Bitte prüfe die Zahlen. <strong>Vasco übermittelt nie automatisch.</strong> Du reichst selbst über ELSTER ein oder leitest dieses Dokument an deinen Steuerberater weiter.'
    : 'Vasco heeft deze aangifte voorbereid op basis van je facturen en kosten. Controleer de cijfers. <strong>Vasco dient nooit automatisch in.</strong> Jij dient zelf in via Belastingdienst (DigiD/eHerkenning) of geef dit document door aan je boekhouder.';
  const turnoverHeader = country === 'DE' ? 'Bemessungsgrundlage' : 'Omzet';
  const vatHeader = country === 'DE' ? 'USt' : 'BTW';
  const yoyLabel = country === 'DE' ? 'VoJ-Abweichung' : 'YoY variatie vs vorig jaar';
  const footerText = country === 'DE'
    ? 'Erstellt von Vasco · Für deine eigene Buchhaltung. Vasco reicht nicht selbst ein.'
    : 'Gegenereerd door Vasco · Voor jouw eigen administratie. Vasco dient niet zelf in.';
  const locale = country === 'DE' ? 'de-DE' : 'nl-NL';
  return `
<!doctype html>
<html lang="${country === 'DE' ? 'de' : 'nl'}">
<head>
<meta charset="utf-8">
<title>${s.returnTitle} ${escape(draft.period)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Inter, Helvetica, Arial, sans-serif; color: #111; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.3px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.8px; color: #666; margin: 28px 0 10px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  .banner { background: #FFF7F0; border: 1px solid #F97316; border-radius: 10px; padding: 10px 14px; color: #8A3400; font-size: 12px; margin-bottom: 24px; }
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
  <h1>${s.returnTitle} — ${escape(draft.period)}</h1>
  <div class="meta">${escape(businessName)} · ${escape(draft.periodStart)} → ${escape(draft.periodEnd)}</div>

  <div class="banner">${banner}</div>

  <h2>${s.rubriekenHeader}</h2>
  <table>
    <thead>
      <tr><th>${country === 'DE' ? 'KZ' : 'Rubriek'}</th><th class="num">${turnoverHeader}</th><th class="num">${vatHeader}</th></tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <h2>${s.totalsHeader}</h2>
  <table>
    <tbody>
      <tr><td class="label">${s.outputVatLabel}</td><td class="num">${fmtEur(draft.totalOutputVat, country)}</td></tr>
      <tr><td class="label">${s.inputVatLabel}</td><td class="num">${fmtEur(draft.totalInputVat, country)}</td></tr>
      <tr class="total-row"><td class="label">${s.netPayableLabel}</td><td class="num">${fmtEur(draft.netPayable, country)}</td></tr>
      ${draft.yoyVariancePct !== null ? `<tr><td class="label">${yoyLabel}</td><td class="num">${draft.yoyVariancePct.toFixed(1)}%</td></tr>` : ''}
    </tbody>
  </table>

  ${lowConfHtml}
  ${warningsHtml}

  <div class="footer">
    ${footerText} · ${new Date(draft.generatedAt).toLocaleString(locale)}
  </div>
</body>
</html>
`;
}

function renderLines(lines: VatLine[], country: 'NL' | 'DE' = 'NL'): string {
  const rows = lines
    .map(
      (l) => `
    <tr>
      <td class="label">${escape(l.description)}</td>
      <td class="num">${fmtEur(l.netAmount, country)}</td>
      <td class="num">${fmtEur(l.vatAmount, country)}</td>
      <td class="num">${Math.round(l.confidence * 100)}%</td>
    </tr>`,
    )
    .join('');
  const headers = country === 'DE'
    ? { desc: 'Beschreibung', net: 'Netto', vat: 'USt', conf: 'Sicherheit' }
    : { desc: 'Omschrijving', net: 'Netto', vat: 'BTW', conf: 'Zekerheid' };
  return `
    <table>
      <thead>
        <tr><th>${headers.desc}</th><th class="num">${headers.net}</th><th class="num">${headers.vat}</th><th class="num">${headers.conf}</th></tr>
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
