// R250: VAT scheme. 'standard' = normal trade VAT (21/19/etc).
// 'small_business_NL_KOR' = Dutch Kleineondernemersregeling, no VAT charged
// (turnover ≤ €20k/yr). 'small_business_DE_kleinunternehmer' = §19 UStG,
// no VAT charged (turnover ≤ €25k prior year, ≤ €100k current year — the
// 2025 limits under the Jahressteuergesetz 2024).
// When small_business is set, every invoice must show 0% VAT and a legal
// note ("BTW niet van toepassing — KOR" / "Kein Ausweis der USt gem. §19 UStG").
export type VatScheme =
  | 'standard'
  | 'small_business_NL_KOR'
  | 'small_business_DE_kleinunternehmer';

// R79 US Phase 2: per-state contractor license. Each entry stored as a row
// in `BusinessProfile.licenses[]` and persisted to
// `business_settings.licenses jsonb`.
export type ContractorLicenseType =
  | 'master_plumber'
  | 'master_electrician'
  | 'general_contractor'
  | 'hvac'
  | 'roofing'
  | 'gas_fitter'
  | 'epa_608'
  | 'state_contractor'
  | 'other';

export interface ContractorLicense {
  type: ContractorLicenseType;
  state: string;            // 'TX', 'CA', etc.
  number: string;           // license number as issued
  expiryDate: string;       // ISO date (YYYY-MM-DD)
  issueDate?: string;       // ISO date, optional
  issuingAuthority?: string; // e.g. "Texas Department of Licensing and Regulation"
}

export type BusinessProfile = {
  isComplete: boolean;
  completenessPercent: number;
  businessName?: string;
  kvkNumber?: string;
  vatNumber?: string;
  address?: string;
  email?: string;
  phone?: string;
  country?: 'UK' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'US';
  // R74 US foundation: state code (e.g. 'TX', 'CA') — required when
  // country === 'US' for sales-tax lookup + state contractor license
  // routing. Ignored for non-US countries.
  state?: string;
  registrationNumber?: string;
  trade?: string;
  businessType?: string;
  // R263: team size, captured in onboarding step 7. Used by the VAT scheme
  // advisor to suggest KOR / Kleinunternehmer (only solo contractors qualify).
  teamSize?: 'solo' | 'small' | 'medium' | 'large';
  certifications?: string[];
  serviceAreaRadius?: number;
  enabledPaymentMethods?: string[];
  // R250: VAT scheme — drives every invoice's VAT treatment.
  vatScheme?: VatScheme;
  /**
   * WHEN the VAT falls due (DE §13/§20 UStG).
   * `soll` = on invoice issue (Soll-Versteuerung, the German default);
   * `ist`  = on payment receipt (Ist-Versteuerung, available to small trades).
   * Undefined = not stated, treated as `soll`. Declared in
   * `GermanTaxSettings` since the German types were written and read by
   * NOTHING until 2026-09-17 — every return was prepared on invoice dates.
   */
  vatBasis?: 'soll' | 'ist';
  /** How often the VAT return is filed. Undefined = not stated (quarterly). */
  filingPeriod?: 'monthly' | 'quarterly' | 'yearly';
  /**
   * FR: the seller has opted to account for VAT on DEBITS rather than on
   * receipts. When true, every invoice must carry the mention "Option pour le
   * paiement de la TVA d'après les débits" (mandatory from 1 September 2026).
   */
  tvaSurLesDebits?: boolean;
  // R66 NL launch: payment + locale fields. Migration
  // `20260415000001_business_profiles.sql` declared these on
  // `business_settings` but the mapper + UI dropped them. Without `iban`,
  // every NL invoice PDF rendered with no bank details — customers had no
  // way to pay. Same shape covers DE Bezahldetails / FR coordonnées
  // bancaires for the EU6 expansion.
  iban?: string;
  bic?: string;
  // R74 US foundation: ACH bank details — used in place of IBAN/BIC when
  // country === 'US'. Routing # is 9 digits (ABA), account # is 4-17
  // digits. Both rendered on US invoice PDFs in lieu of SEPA fields.
  routingNumber?: string;
  bankAccountNumber?: string;
  // R79 US Phase 2: state-licensing array. Each entry tracks a per-state
  // license that the contractor holds. Stored as JSONB on
  // `business_settings.licenses` (migration 20260520000001). The
  // 30-day-before-expiry warning fires from
  // `complianceGatingService.checkLicenseExpiry()` (client-side).
  licenses?: ContractorLicense[];
  postcode?: string;
  city?: string;
  /** IT/ES provincia, 2 letters. Separate from the US `state` field, which has
   *  different values and validation. */
  province?: string;
  /** Country-interpreted. IT: RegimeFiscale RF01–RF19, mandatory in FatturaPA
   *  — there is no safe default, because RF01 on a forfettario is a fiscally
   *  wrong invoice that SDI ACCEPTS, so nobody ever finds out. ES: régimen. */
  fiscalRegime?: string;
  /** 'F' natural person / 'J' legal person. Facturae requires it explicitly;
   *  it also decides Nome+Cognome vs Denominazione in FatturaPA. */
  personType?: 'F' | 'J';
  /** The seller's own tax code, country-interpreted. IT: the CODICE FISCALE
   *  (a sole trader's personal 16-character code ≠ the Partita IVA) —
   *  FatturaPA CedentePrestatore/CodiceFiscale and IdTrasmittente. */
  taxCode?: string;
  website?: string;
  invoicePrefix?: string;
  quotePrefix?: string;
  defaultPaymentTerms?: number;
};

export function isSmallBusinessExempt(profile: { vatScheme?: VatScheme }): boolean {
  return profile.vatScheme === 'small_business_NL_KOR'
      || profile.vatScheme === 'small_business_DE_kleinunternehmer';
}

import { round2 } from '../utils/round2';
export { round2 };

// R66r50: country-aware standard VAT rates for EU6. Pre-R66r50 the codebase
// hardcoded 21 (NL) across quote builder, photo-quote, invoice import, cohort
// writes, and Moneybird export — DE/FR/ES/IT/UK contractors got NL rate.
// Source of truth lives in `src/constants/taxRates.ts` (decimal: 0.21 etc).
// We return percentages here (21 etc) to match existing call-site convention.
import { getVATRate as getVATRateDecimal } from '../constants/taxRates';

export function getStandardVatRate(country: BusinessProfile['country']): number {
  // No `?? 'NL'`. An unknown country is unknown: `getVATRate` returns 0 and
  // warns, and the customer's quote page (verify-quote-token) does the same.
  // This line was the last silent Dutch default, and it made the two sides
  // disagree — the app grossing a quote at 21% that the page showed net, which
  // is the €6.800-vs-€8.092 defect one step further out.
  return Math.round(getVATRateDecimal(country ?? '') * 100);
}

/**
 * The rate to STORE on a line that carries none. 0 only for a real exemption
 * (KOR / Kleinunternehmer); null while the country is unknown. getEffectiveVatRate
 * answers 0 for both, and the offline heal froze a first-day quote's lines at
 * 0 % before the profile had synced (review, 2026-09-30) — NULL keeps them
 * following the document's rate once it is known.
 */
export function storedLineVatRate(profile: { country?: BusinessProfile['country']; vatScheme?: VatScheme } | null | undefined): number | null {
  if (!profile) return null;
  if (isSmallBusinessExempt(profile)) return 0;
  const rate = getStandardVatRate(profile.country);
  return rate > 0 ? rate : null;
}

export function getEffectiveVatRate(profile: { country?: BusinessProfile['country']; vatScheme?: VatScheme }): number {
  if (isSmallBusinessExempt(profile)) return 0;
  return getStandardVatRate(profile.country);
}

// R66r59: country-specific reduced VAT rates for line-item-level overrides.
// Returns the percent value when a reduced rate is legally applicable in
// that country for trade-relevant categories, or null when the country
// has no relevant reduced bracket.
//
// NL 9% — a NARROW list of labour on homes older than 2 years: painting,
//   plastering, wallpapering and insulating, plus cleaning inside the home.
//   ⚠️ It does NOT cover plumbing, electrical work or tiling, which this
//   comment used to claim and which the VAT-return classifier used to match on
//   — the contractor would have charged 9% where 21% was due and owed the
//   difference at the year-end reconciliation (#339 L11, corrected
//   2026-09-17). Source: belastingdienst.nl/wps/wcm/connect/bldcontentnl/
//   belastingdienst/zakelijk/btw/tarieven_en_vrijstellingen/
//   diensten_9_btw/diensten_aan_woningen_ouder_dan_2_jaar.
// FR 10% — travaux d'amélioration, de transformation, d'aménagement et
//   d'entretien on dwellings completed more than 2 years ago (CGI art.
//   279-0 bis). This IS construction labour and it is the ordinary rate a
//   French artisan charges on residential renovation. `einvoice-fr.ts` has
//   said so in this repo the whole time: `INTERMEDIAIRE: 10, // Taux
//   intermédiaire (rénovation logement > 2 ans)`.
//   NOT covered here: the 5.5% taux réduit for energy-renovation work (CGI
//   art. 278-0 bis A). One function returning one number cannot express two
//   brackets; a French contractor doing energy work still has to correct the
//   rate by hand. Widening the return type is the follow-up.
// IT 10% — manutenzione ordinaria e straordinaria on residential buildings
//   (DPR 633/1972, Tabella A parte III n. 127-quaterdecies). Again
//   construction, and again already written down next door in
//   `einvoice-it.ts`: `RIDOTTA_10: 10, // Aliquota ridotta (ristrutturazione
//   edilizia)`. The 4% prima casa bracket is narrower and is not modelled.
// ES 10% — obras de renovación y reparación on dwellings (Ley 37/1992 art.
//   91.Uno.2.10º), subject to conditions the contractor asserts: the client
//   is not acting as a business, the building is over 2 years old, and
//   supplied materials do not exceed 40% of the taxable base.
//
// The previous version of this function returned null for all five non-NL
// markets, on the stated grounds that their reduced rates "apply to
// food/books/energy/transport — not construction labor". For FR, IT and ES
// that premise was simply wrong, and two files in this same repo contradicted
// it. The consequence was not cosmetic: the opt-in toggle in
// `TieredQuoteBuilder` renders only when this returns non-null, so a French
// artisan quoting a bathroom refit had no way to reach 10% and was billed out
// at 20% — roughly 9% too expensive, or the same amount out of his own margin
// at the year-end reconciliation. In Italy the gap was 22% vs 10%.
//
// Still null, deliberately:
// DE 7% — covers food, books, transport, cultural admission. German
//   construction labour has no reduced bracket; 19% is correct.
// UK 5% — exists for residential conversions and for dwellings empty at
//   least 2 years (VAT Notice 708), but it is conditional and much narrower
//   than a general renovation rate, so it needs its own product case rather
//   than a shared "renovation" toggle.
//
// This stays an explicit opt-in per quote: the contractor asserts the work
// qualifies, exactly as the NL 9% has always worked. Nothing applies a
// reduced rate on its own.
export function getReducedVatRate(country: BusinessProfile['country']): number | null {
  if (country === 'NL') return 9;
  if (country === 'FR' || country === 'IT' || country === 'ES') return 10;
  return null;
}

/**
 * France's SECOND reduced rate: 5.5% for energy-renovation work
 * (CGI art. 278-0 bis A) — insulation, heat pumps, and the rest of the
 * énergétique list, as against the 10% general renovation rate.
 *
 * Vasco does NOT judge eligibility. The contractor picks the rate, exactly as
 * they already pick 10% vs 20%; deciding whether a given job qualifies (and
 * holding the client's attestation) is their job, not ours. Stating otherwise
 * would make us a source of tax advice we cannot keep current.
 */
export function getEnergyRenovationVatRate(country: BusinessProfile['country']): number | null {
  return country === 'FR' ? 5.5 : null;
}

/** Every VAT rate a contractor in this country may legitimately pick, high to low. */
export function getSelectableVatRates(country: BusinessProfile['country']): number[] {
  const rates = [getStandardVatRate(country), getReducedVatRate(country), getEnergyRenovationVatRate(country)];
  return rates.filter((r): r is number => r !== null && r > 0);
}

/**
 * The rates a contractor in this market may charge, under the market's own tax
 * name — "20% / 10% / 5,5% / 0% (TVA)". The VAT settings screen read the
 * English "Standard rate per country" to every FR/ES/IT contractor (walk
 * 2026-09-29). An unknown country gets no line rather than a guess.
 */
const TAX_NAME: Record<string, string> = { FR: 'TVA', ES: 'IVA', IT: 'IVA', UK: 'VAT' };
export function standardRatesLine(country: string | undefined): string {
  if (!country || !TAX_NAME[country]) return '';
  const pct = (r: number) => `${String(r).replace('.', country === 'UK' ? '.' : ',')}%`;
  return `${[...getSelectableVatRates(country as BusinessProfile['country']), 0].map(pct).join(' / ')} (${TAX_NAME[country]})`;
}

export function getVatExemptionNote(country: string | undefined, vatScheme: VatScheme | undefined): string | null {
  if (vatScheme === 'small_business_NL_KOR') {
    return 'BTW niet van toepassing — kleineondernemersregeling (KOR).';
  }
  if (vatScheme === 'small_business_DE_kleinunternehmer') {
    return 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).';
  }
  return null;
}

/**
 * NET → GROSS, rounded to cents.
 *
 * `Invoice.amount` is GROSS everywhere in this app while `Quote.amount` is the
 * NET sum of its line items, so every path that turns one into the other has to
 * cross that boundary. Two of them did it with the same inline arithmetic and a
 * third (`addInvoice`, the most travelled) did not do it at all — it copied the
 * quote's net straight onto the invoice. The result was one field carrying two
 * units: an invoice whose own detail screen read "126,14 €" contributed
 * "106,00 €" to UMSATZ, and revenue summed quote-derived nets together with
 * job-derived grosses.
 *
 * One helper so the conversion cannot drift again. A 0% rate (KOR /
 * Kleinunternehmer) returns the net unchanged, which is correct: there is no
 * VAT to add.
 */
/**
 * NET → GROSS for a document that has its own agreed line rates.
 *
 * `addInvoice` grossed every quote at `getEffectiveVatRate(businessProfile)` —
 * the country's STANDARD rate — while copying the quote's line items, rates and
 * all, onto the invoice. So a quote agreed at a reduced rate produced an
 * invoice whose lines said 10% and whose `amount` had been grossed at 20%. The
 * customer is billed the wrong VAT, and the invoice disagrees with itself.
 *
 * Latent for NL's 9% since the toggle shipped; reachable in FR/IT/ES from the
 * moment `getReducedVatRate` started returning a rate for them.
 *
 * Precedence, most specific first:
 *   1. exempt (fallback 0) — KOR / Kleinunternehmer charge no VAT, full stop;
 *   2. every line has a rate AND the lines add up to the document's net —
 *      sum the lines, which is the only correct answer for a MIXED-rate quote
 *      (NL 9% labour + 21% materials is the ordinary case);
 *   3. every line has the SAME rate — use it, even if the line sum has drifted
 *      from `amount` (a discount, a rounding, a hand-edited total);
 *   4. otherwise the profile rate, as before.
 */
/**
 * The VAT breakdown a document should DISPLAY, from its own lines.
 *
 * Four places decided a quote's VAT independently — the quote screen, the PDF
 * the customer receives, the invoice the quote becomes, and the acceptance page
 * the customer confirms on — and every one of them reached for the country's
 * standard rate. Fixing one moved the disagreement instead of ending it.
 *
 * `ratePct` is null when the document genuinely has no single rate (labour at
 * one, materials at another). A caller must then omit the percentage rather
 * than print the blended average: "BTW (13,8%)" is a number that appears on no
 * invoice and in no tax table. The AMOUNT is exact either way.
 */
// round2 lives in src/utils/round2.ts — a leaf module, so taxRates.ts (which
// this file imports) can use it without an import cycle. Re-exported here.

/** One VAT rate on a document, with the net it applies to and the tax due. */
export interface VatRateGroup {
  ratePct: number;
  net: number;
  vat: number;
}

/**
 * The document's VAT, grouped by rate and rounded PER GROUP — which is both
 * what a tax authority asks for and what makes the printed rows add up.
 *
 * Rounding per LINE understates a ten-line invoice by cents (#345); rounding
 * only the document total lets the per-rate rows a PDF prints disagree with
 * the Total beneath them: 3 × € 8,83 at 21 % plus 1 × € 10,04 at 9 % printed
 * "Subtotaal 36,53 / BTW 21 % 5,56 / BTW 9 % 0,90" under a Total of € 43,00,
 * which is a cent more than those lines add to (#354).
 */
export function vatRateGroups(
  netAmount: number,
  lines: Array<{ quantity: number; unitPrice: number; vatRate?: number }> | undefined,
  fallbackVatRatePercent: number,
): VatRateGroup[] {
  if (fallbackVatRatePercent === 0) return [];
  const all = lines ?? [];
  // A line without a rate IS a line at the document's rate — exactly what
  // the database stores for it (`vat_rate ?? effective rate` at every line
  // write). Sending a partly-rated document to the whole-document path priced
  // it one way on the phone and another after a reload, and differently again
  // on the customer's page (review, 2026-09-30).
  const rated = all.map((l) =>
    typeof l.vatRate === 'number' && Number.isFinite(l.vatRate) ? l : { ...l, vatRate: fallbackVatRatePercent });
  // The same base `documentNet` prints: the lines in cents when they are the
  // amount. VAT on the unrounded amount here, beside a rounded net there, made
  // a document with unrated lines print a VAT row a cent off its own Total
  // (review, 2026-09-30).
  const wholeDocument = (ratePct: number): VatRateGroup[] => {
    if (ratePct === 0) return [];
    const base = documentNet(netAmount, lines);
    return [{ ratePct, net: base, vat: round2(base * (ratePct / 100)) }];
  };

  // No lines: the profile's rate on the whole amount.
  if (rated.length === 0) return wholeDocument(fallbackVatRatePercent);

  const lineNet = rated.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const rates = Array.from(new Set(rated.map((l) => l.vatRate as number)));

  // The lines no longer add up to the amount (a discount, a hand-edited
  // total). The agreed RATE still applies — to the amount, not the lines.
  if (Math.abs(lineNet - netAmount) > 0.01) {
    return wholeDocument(rates.length === 1 ? rates[0] : fallbackVatRatePercent);
  }

  // EN 16931: a line's net IS its amount in cents (BT-131), the rate's base
  // is the sum of those (BT-116), and its VAT is that base × rate (BT-117).
  // The e-invoice has always done this; the PDF, the screen and the stored
  // total took VAT on the UNROUNDED sum, so one invoice could state VAT
  // 48,62 on paper and 48,63 in its XRechnung (#360, closed 2026-09-30).
  return rates
    .map((ratePct) => {
      const net = round2(rated
        .filter((l) => l.vatRate === ratePct)
        .reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
      return { ratePct, net, vat: round2(net * (ratePct / 100)) };
    })
    .filter((g) => g.net !== 0 || g.vat !== 0)
    .sort((a, b) => b.ratePct - a.ratePct);
}

/**
 * The document's net as the lines print it: each line in cents, summed — when
 * the lines ARE the amount. Otherwise (a discount, a hand-edited total, no
 * lines) the amount itself. Rounding the unrounded sum instead let two lines
 * of € 0,125 print € 0,13 + € 0,13 above a subtotal of € 0,25.
 */
export function documentNet(
  netAmount: number,
  lines: Array<{ quantity: number; unitPrice: number; vatRate?: number }> | undefined,
): number {
  const all = lines ?? [];
  if (all.length === 0) return round2(netAmount);
  const raw = all.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  if (Math.abs(raw - netAmount) > 0.01) return round2(netAmount);
  return round2(all.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
}

/**
 * The rate a document falls back to when its lines are all rated anyway: the
 * HIGHEST line rate. `lineItems[0]?.vatRate` was the idiom at three call
 * sites, and a fallback of 0 means "no VAT at all" to `vatRateGroups` — so a
 * document whose FIRST line was 0 % printed no VAT rows under a Total that
 * included VAT, and the bookkeeping export sent VAT 0 (review, 2026-09-30).
 */
export function documentFallbackRate(lines: ReadonlyArray<{ vatRate?: number }> | undefined, otherwise = 0): number {
  const rates = (lines ?? []).map((l) => l.vatRate).filter((r): r is number => typeof r === 'number' && Number.isFinite(r));
  return rates.length > 0 ? Math.max(...rates) : otherwise;
}

export function documentVatBreakdown(
  netAmount: number,
  lines: Array<{ quantity: number; unitPrice: number; vatRate?: number }> | undefined,
  fallbackVatRatePercent: number,
): { net: number; vat: number; gross: number; ratePct: number | null; groups: VatRateGroup[] } {
  const net = documentNet(netAmount, lines);
  // ONE computation feeds all three figures AND the per-rate rows a document
  // prints, so `net + Σ rows === gross` by construction (#354).
  const groups = vatRateGroups(netAmount, lines, fallbackVatRatePercent);
  const vat = round2(groups.reduce((s, g) => s + g.vat, 0));
  const gross = round2(net + vat);
  if (fallbackVatRatePercent === 0) return { net, vat, gross, ratePct: 0, groups };
  // null on a genuinely mixed-rate document: the label omits the percentage
  // rather than printing a blended average that appears on no tax return.
  // No groups = no VAT. When every line is 0 % that is the document's rate
  // (an export, a reverse charge) — even if the lines do not add up to the
  // amount; it was labelled with the standard rate above a VAT of 0 (review
  // 2026-09-30). Same rule as quoteTotals in _shared/documentTotals.ts.
  const everyLineZero = (lines ?? []).length > 0
    && (lines ?? []).every((l) => typeof l.vatRate === 'number' && Number.isFinite(l.vatRate) && l.vatRate === 0);
  const ratePct = groups.length === 1 ? groups[0].ratePct
    : groups.length === 0 ? (everyLineZero ? 0 : fallbackVatRatePercent)
    : null;
  return { net, vat, gross, ratePct, groups };
}

/**
 * The document's gross — the SAME rule the printed VAT rows follow, because it
 * is derived from them. It used to sum each line's own gross and round once,
 * which can land a cent away from `net + Σ per-rate VAT` and leave an invoice
 * that does not add up (#354).
 */
export function grossFromDocumentLines(
  netAmount: number,
  lines: Array<{ quantity: number; unitPrice: number; vatRate?: number }> | undefined,
  fallbackVatRatePercent: number,
): number {
  const net = documentNet(netAmount, lines);
  if (fallbackVatRatePercent === 0) return net;
  const groups = vatRateGroups(netAmount, lines, fallbackVatRatePercent);
  return round2(net + groups.reduce((s, g) => s + g.vat, 0));
}

export function grossFromNet(netAmount: number, vatRatePercent: number): number {
  // `round2`, not `Math.round` — the two reasons that helper exists apply here
  // exactly as they do to VAT rows (#354), and this function sat two lines
  // above it still doing it the old way:
  //
  //   • float representation: 1,005 at 0 % is 100.49999999999999 cents, so
  //     Math.round gives € 1,00 where the decimal the arithmetic means is 1,01;
  //   • sign: Math.round rounds half toward +∞, so a −0,285 credit becomes
  //     −0,28 while +0,285 becomes +0,29 — the same amount rounded two
  //     different ways depending on which side of zero it falls.
  //
  // No caller passes a negative today (`addProgressInvoice` throws on
  // `netAmount <= 0`), so this was latent rather than live. But minderwerk is a
  // negative by definition and bills on a customer-facing document, and a money
  // helper that disagrees with its own sibling is a trap waiting for the first
  // caller that does.
  return round2(netAmount * (1 + vatRatePercent / 100));
}

/**
 * The inverse: a GROSS amount back to the turnover an accountant recognises.
 *
 * `Invoice.amount` is GROSS and `Quote.amount` is NET (#241/#242), so anything
 * reporting revenue from paid invoices has to divide — and three places were
 * each doing it their own way, or not at all. The Kunden tab summed
 * `inv.amount` raw while Finanzen divided, so the same customer read € 3.200 on
 * one screen and "€ 2,7 Tsd." on the other.
 *
 * A rate of 0 (Kleinunternehmer / KOR) charges no VAT, so nothing is divided.
 */
export function netFromGross(grossAmount: number, vatRatePercent: number): number {
  if (!(vatRatePercent > 0)) return grossAmount;
  return round2(grossAmount / (1 + vatRatePercent / 100));
}
