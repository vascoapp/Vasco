// =============================================================================
// VAT PREP SERVICE — NL BTW first (prepare-only, NEVER submit)
// =============================================================================
// PM / a16z reasoning: EU contractors pay €150-350/mo to a boekhouder /
// Steuerberater for quarterly VAT returns. A Truewind-style AI that PREPARES
// the return — reads invoices + expenses, classifies each line by rate,
// flags anomalies — is a €60-80/mo Vasco upsell that replaces most of that
// spend. We NEVER submit to the tax authority; only the taxpayer (via
// DigiD/ELSTER) or a certified intermediary can legally do that.
//
// Scope: NL BTW Q1-Q4 prep. Expand to DE USt, FR TVA, ES IVA, IT IVA, UK VAT
// later — each adds ~1-2 weeks of per-country classification rules.
//
// Safety rails:
//   1. Per-line confidence (rate classification + category).
//   2. Year-over-year variance alerts ("this quarter's input VAT is 40% higher
//      than same quarter last year — check receipts").
//   3. Human review required — no auto-export to accountant until contractor
//      explicitly approves.
//   4. Audit trail: every approval logs contractor userId + timestamp.
// =============================================================================

import type { Invoice, Quote } from '../domain/documents';

export type VatRateNL = 21 | 9 | 0;
export type VatClassNL =
  | 'rubriek_1a'   // Standard 21% — construction services, materials
  | 'rubriek_1b'   // Reduced 9% — specific services (painting interior >2yr homes)
  | 'rubriek_1c'   // 0% — not common for trades
  | 'rubriek_2a'   // Reverse-charge supplies (B2B construction)
  | 'rubriek_3a'   // Exports inside EU
  | 'rubriek_3b'   // Exports outside EU
  | 'rubriek_4a'   // Intra-EU acquisitions
  | 'rubriek_5b';  // Input VAT (expenses)

// R221 — DE (Umsatzsteuer-Voranmeldung / UStVA). Kennziffern are the German
// tax form's line codes — these map 1:1 to the ELSTER XML fields.
export type VatRateDE = 19 | 7 | 0;
export type VatClassDE =
  | 'kz_81'   // Standard 19% — construction services, materials
  | 'kz_86'   // Reduced 7% — rarely applicable to trades (e.g. prints)
  | 'kz_35'   // Reverse charge §13b UStG (received)
  | 'kz_41'   // Intra-community supplies tax-free (§4 Nr. 1b)
  | 'kz_43'   // Exports outside EU
  | 'kz_66';  // Input VAT (Vorsteuer) from other businesses

export interface VatLine {
  id: string;
  sourceType: 'invoice_sent' | 'expense_paid';
  sourceId: string;
  description: string;
  date: string;
  netAmount: number;           // excl VAT
  vatAmount: number;
  vatRate: VatRateNL | VatRateDE;
  classification: VatClassNL | VatClassDE;
  confidence: number;           // 0-1
  warnings: string[];
}

// Common draft shape across countries; country-specific rollups are stored
// under the `rollups` map keyed by classification (`rubriek_*` for NL,
// `kz_*` for DE). Old code paths that read e.g. draft.rubriek_1a still work
// via the legacy NL-flat accessors below.
export interface VatReturnDraft {
  country: 'NL' | 'DE';
  period: string;               // e.g. "2026-Q1"
  periodStart: string;
  periodEnd: string;
  currency: 'EUR';
  lines: VatLine[];

  // Flat per-class rollups (NL legacy shape kept for backwards compat on NL;
  // on DE these are populated with 0/0 and the DE rollups live under `rollups`).
  rubriek_1a: { net: number; vat: number };
  rubriek_1b: { net: number; vat: number };
  rubriek_1c: { net: number; vat: number };
  rubriek_2a: { net: number; vat: number };
  rubriek_3a: { net: number; vat: number };
  rubriek_3b: { net: number; vat: number };
  rubriek_4a: { net: number; vat: number };
  rubriek_5b: { net: number; vat: number };

  // R221: country-agnostic rollup map. For NL this duplicates the flat fields;
  // for DE it holds the `kz_*` buckets.
  rollups: Record<string, { net: number; vat: number }>;

  totalOutputVat: number;       // what we owe
  totalInputVat: number;        // what we reclaim
  netPayable: number;           // owed - reclaim (positive = pay; negative = refund)

  // Safety metrics
  lowConfidenceLines: number;   // count of lines with confidence < 0.75
  yoyVariancePct: number | null; // % change vs same quarter last year (output VAT)
  warnings: string[];
  generatedAt: string;
}

export interface VatPrepInput {
  country: 'NL' | 'DE';
  periodStart: string;
  periodEnd: string;
  invoices: Invoice[];
  expenses: Array<{
    id: string;
    description: string;
    date: string;
    amount: number;             // gross
    vatRate?: number;
    category?: string;
  }>;
  /** Same quarter last year — used for YoY variance detection. */
  prevYearTotalOutputVat?: number;
}

// ─── Classification ─────────────────────────────────────────────────────────

/**
 * Very safe default: treat every sent invoice as rubriek_1a (21%). Reduced 9%
 * and reverse-charge cases are flagged as low-confidence so the contractor
 * reviews each. ML learning per-contractor kicks in later rounds.
 */
function classifyInvoice(invoice: Invoice): { classification: VatClassNL; rate: VatRateNL; confidence: number; warnings: string[] } {
  const warnings: string[] = [];
  // Default path: 21% standard rate on construction services.
  let classification: VatClassNL = 'rubriek_1a';
  let rate: VatRateNL = 21;
  let confidence = 0.9;

  const label = `${invoice.job ?? ''} ${invoice.customer ?? ''} ${(invoice as any).description ?? ''}`.toLowerCase();

  // Reduced 9% — painting/tiling work on homes >2yr, specific maintenance.
  // Flag as low-confidence — require review.
  if (/schilderen|tegel|stucwerk|isolatie|schilderwerk/.test(label)) {
    classification = 'rubriek_1b';
    rate = 9;
    confidence = 0.55;
    warnings.push('9%-regime alleen geldig als woning >2 jaar oud — bevestig of dit klopt');
  }
  // Reverse-charge — when customer is also registered for BTW (B2B construction subcontract).
  if (/verleggingsregeling|verlegd|reverse charge/i.test(label)) {
    classification = 'rubriek_2a';
    rate = 0;
    confidence = 0.7;
    warnings.push('Verleggingsregeling — verifieer BTW-nummer klant');
  }

  return { classification, rate, confidence, warnings };
}

/**
 * DE classifier (R221). Default 19% standard rate (KZ 81). Flags:
 *   - 7% reduced (KZ 86) — very rare for trade services, high review cost
 *   - §13b reverse charge (KZ 35) — common in B2B construction subcontract
 *   - Intra-community supplies tax-free (KZ 41)
 *   - Exports outside EU (KZ 43)
 */
function classifyInvoiceDE(invoice: Invoice): { classification: VatClassDE; rate: VatRateDE; confidence: number; warnings: string[] } {
  const warnings: string[] = [];
  let classification: VatClassDE = 'kz_81';
  let rate: VatRateDE = 19;
  let confidence = 0.9;

  const label = `${invoice.job ?? ''} ${invoice.customer ?? ''} ${(invoice as any).description ?? ''}`.toLowerCase();

  if (/§13b|reverse.?charge|reverse ?proxy|nettorechnung|steuerschuldn?erschaft/.test(label)) {
    classification = 'kz_35';
    rate = 0;
    confidence = 0.7;
    warnings.push('§13b UStG — USt-IdNr. des Kunden prüfen');
  } else if (/innergemein|intra.?EU|VAT reverse/.test(label)) {
    classification = 'kz_41';
    rate = 0;
    confidence = 0.65;
    warnings.push('Innergemeinschaftliche Lieferung — Umsatzsteuer-Nummer Empfänger prüfen');
  } else if (/export|drittland/.test(label)) {
    classification = 'kz_43';
    rate = 0;
    confidence = 0.7;
  } else if (/(druck|zeitschrift|buch|hotelübernachtung|ermäßigt)/.test(label)) {
    classification = 'kz_86';
    rate = 7;
    confidence = 0.55;
    warnings.push('7%-Satz ist für Bauleistungen selten — manuell prüfen');
  }

  return { classification, rate, confidence, warnings };
}

function classifyExpenseDE(exp: VatPrepInput['expenses'][number]): { classification: VatClassDE; rate: VatRateDE; confidence: number; warnings: string[] } {
  const warnings: string[] = [];
  const label = `${exp.description ?? ''} ${exp.category ?? ''}`.toLowerCase();
  let rate: VatRateDE = 19;
  let confidence = 0.9;
  if (exp.vatRate === 7 || exp.vatRate === 0) {
    rate = exp.vatRate as VatRateDE;
    confidence = 0.75;
  }
  if (rate === 7) warnings.push('7%-Vorsteuer ist selten bei Baubedarf — Beleg prüfen');
  if (/versicherung|bankgebühr|miete \(umsatzsteuerfrei\)|rentenversicherung/.test(label)) {
    rate = 0;
    confidence = 0.6;
    warnings.push('Wahrscheinlich umsatzsteuerfrei — kein Vorsteuerabzug');
  }
  return { classification: 'kz_66', rate, confidence, warnings };
}

function classifyExpense(exp: VatPrepInput['expenses'][number]): { classification: VatClassNL; rate: VatRateNL; confidence: number; warnings: string[] } {
  const warnings: string[] = [];
  const label = `${exp.description ?? ''} ${exp.category ?? ''}`.toLowerCase();
  // Most trade expenses are 21% (tools, materials from wholesalers).
  let rate: VatRateNL = 21;
  let confidence = 0.9;
  if (exp.vatRate === 9 || exp.vatRate === 0) {
    rate = exp.vatRate as VatRateNL;
    confidence = 0.75;
  }
  // 9% rarely applies to trade expenses — flag for review.
  if (rate === 9) warnings.push('9% op inkoop is zeldzaam — bevestig met de bon');
  // Exempt categories (insurance, bank fees, rent without VAT option).
  if (/verzekering|bankkosten|huur \(onbelast\)|pensioen/.test(label)) {
    rate = 0;
    confidence = 0.6;
    warnings.push('Mogelijk vrijgesteld — geen BTW-teruggave');
  }
  return { classification: 'rubriek_5b', rate, confidence, warnings };
}

// ─── Main prep function ─────────────────────────────────────────────────────

export function prepareVatReturn(input: VatPrepInput): VatReturnDraft {
  if (input.country !== 'NL' && input.country !== 'DE') {
    throw new Error(`VAT prep: country ${input.country} not yet supported`);
  }
  const isDE = input.country === 'DE';

  const lines: VatLine[] = [];
  const periodStartMs = new Date(input.periodStart).getTime();
  const periodEndMs = new Date(input.periodEnd).getTime();
  const inPeriod = (d: string) => {
    const t = new Date(d).getTime();
    return t >= periodStartMs && t <= periodEndMs;
  };

  // Sent invoices — only those paid OR invoiced within the period.
  for (const inv of input.invoices) {
    const invDate = (inv as any).issueDate ?? (inv as any).sentAt ?? (inv as any).createdAt;
    if (!invDate || !inPeriod(invDate)) continue;
    // Only count invoices that are sent/paid (not draft).
    if (inv.status === 'draft') continue;
    const gross = inv.amount ?? 0;
    if (gross <= 0) continue;
    const classified = isDE ? classifyInvoiceDE(inv) : classifyInvoice(inv);
    const { classification, rate, confidence, warnings } = classified;
    const net = rate > 0 ? gross / (1 + rate / 100) : gross;
    const vat = gross - net;
    lines.push({
      id: `inv:${inv.id}`,
      sourceType: 'invoice_sent',
      sourceId: inv.id,
      description: `${inv.customer ?? '(unknown)'} — ${inv.job ?? ''}`.trim(),
      date: invDate,
      netAmount: Math.round(net * 100) / 100,
      vatAmount: Math.round(vat * 100) / 100,
      vatRate: rate,
      classification,
      confidence,
      warnings,
    });
  }

  // Expenses
  for (const exp of input.expenses) {
    if (!inPeriod(exp.date)) continue;
    const gross = exp.amount ?? 0;
    if (gross <= 0) continue;
    const classifiedExp = isDE ? classifyExpenseDE(exp) : classifyExpense(exp);
    const { classification, rate, confidence, warnings } = classifiedExp;
    const net = rate > 0 ? gross / (1 + rate / 100) : gross;
    const vat = gross - net;
    lines.push({
      id: `exp:${exp.id}`,
      sourceType: 'expense_paid',
      sourceId: exp.id,
      description: exp.description,
      date: exp.date,
      netAmount: Math.round(net * 100) / 100,
      vatAmount: Math.round(vat * 100) / 100,
      vatRate: rate,
      classification,
      confidence,
      warnings,
    });
  }

  // Rollups — country-agnostic map, keyed by classification string.
  const rollups: Record<string, { net: number; vat: number }> = {
    // NL buckets always present (zero for DE drafts — makes JSON shape stable).
    rubriek_1a: { net: 0, vat: 0 },
    rubriek_1b: { net: 0, vat: 0 },
    rubriek_1c: { net: 0, vat: 0 },
    rubriek_2a: { net: 0, vat: 0 },
    rubriek_3a: { net: 0, vat: 0 },
    rubriek_3b: { net: 0, vat: 0 },
    rubriek_4a: { net: 0, vat: 0 },
    rubriek_5b: { net: 0, vat: 0 },
    // DE buckets
    kz_81: { net: 0, vat: 0 },
    kz_86: { net: 0, vat: 0 },
    kz_35: { net: 0, vat: 0 },
    kz_41: { net: 0, vat: 0 },
    kz_43: { net: 0, vat: 0 },
    kz_66: { net: 0, vat: 0 },
  };
  for (const l of lines) {
    const k = l.classification as string;
    if (!rollups[k]) rollups[k] = { net: 0, vat: 0 };
    rollups[k].net += l.netAmount;
    rollups[k].vat += l.vatAmount;
  }
  for (const k of Object.keys(rollups)) {
    rollups[k] = {
      net: Math.round(rollups[k].net * 100) / 100,
      vat: Math.round(rollups[k].vat * 100) / 100,
    };
  }

  const totalOutputVat = isDE
    ? (rollups.kz_81.vat + rollups.kz_86.vat + rollups.kz_41.vat + rollups.kz_43.vat)
    : (rollups.rubriek_1a.vat + rollups.rubriek_1b.vat + rollups.rubriek_1c.vat
       + rollups.rubriek_2a.vat + rollups.rubriek_3a.vat + rollups.rubriek_3b.vat
       + rollups.rubriek_4a.vat);
  const totalInputVat = isDE ? rollups.kz_66.vat : rollups.rubriek_5b.vat;
  const netPayable = Math.round((totalOutputVat - totalInputVat) * 100) / 100;

  // YoY variance alert
  let yoyVariancePct: number | null = null;
  const warnings: string[] = [];
  if (input.prevYearTotalOutputVat != null && input.prevYearTotalOutputVat > 0) {
    yoyVariancePct = ((totalOutputVat - input.prevYearTotalOutputVat) / input.prevYearTotalOutputVat) * 100;
    if (Math.abs(yoyVariancePct) >= 30) {
      warnings.push(
        `Uitgevoerde BTW wijkt ${Math.round(yoyVariancePct)}% af van dezelfde periode vorig jaar — controleer of je alle facturen hebt opgenomen`,
      );
    }
  }

  const lowConfidenceLines = lines.filter((l) => l.confidence < 0.75).length;
  if (lowConfidenceLines > 0) {
    warnings.push(`${lowConfidenceLines} regels met lage zekerheid — controleer handmatig voor indienen`);
  }

  return {
    country: input.country,
    period: periodLabel(input.periodStart),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    currency: 'EUR',
    lines,
    rubriek_1a: rollups.rubriek_1a,
    rubriek_1b: rollups.rubriek_1b,
    rubriek_1c: rollups.rubriek_1c,
    rubriek_2a: rollups.rubriek_2a,
    rubriek_3a: rollups.rubriek_3a,
    rubriek_3b: rollups.rubriek_3b,
    rubriek_4a: rollups.rubriek_4a,
    rubriek_5b: rollups.rubriek_5b,
    rollups,
    totalOutputVat: Math.round(totalOutputVat * 100) / 100,
    totalInputVat: Math.round(totalInputVat * 100) / 100,
    netPayable,
    lowConfidenceLines,
    yoyVariancePct,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

function periodLabel(periodStart: string): string {
  const d = new Date(periodStart);
  const year = d.getFullYear();
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

/** Helper: compute period bounds for the current / last NL BTW quarter. */
export function currentBtwPeriod(now: Date = new Date()): { periodStart: string; periodEnd: string } {
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3); // 0-3
  const startMonth = quarter * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export function previousBtwPeriod(now: Date = new Date()): { periodStart: string; periodEnd: string } {
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3);
  const prevQuarter = quarter === 0 ? 3 : quarter - 1;
  const prevYear = quarter === 0 ? year - 1 : year;
  const startMonth = prevQuarter * 3;
  const start = new Date(prevYear, startMonth, 1);
  const end = new Date(prevYear, startMonth + 3, 0, 23, 59, 59);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

// R221 — DE UStVA uses quarterly filing by default (monthly for high-revenue
// firms). Default cadence matches NL BTW; helpers are thin aliases so the
// screen code can pick the right pair by country.
export const currentUstvaPeriod = currentBtwPeriod;
export const previousUstvaPeriod = previousBtwPeriod;
