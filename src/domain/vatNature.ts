// =============================================================================
// VAT "nature" of a 0 % line — Italy's Natura (FatturaPA DettaglioLinee/Natura)
// =============================================================================
// A 0 % line on an Italian invoice must say WHY it carries no IVA, and SDI
// rejects the file without it (00400 / 00429). The mapper used to write N2.2
// ("non soggette – altri casi") on every such line. That is right for a
// forfettario (RF19) or a contribuente minimo (RF02), and wrong for the most
// common 0 % line an ordinary-regime tradesperson writes: a subcontract for a
// building firm, which is REVERSE CHARGE (inversione contabile, N6.3) — SDI
// accepts the N2.2 and the invoice states the wrong legal basis.
//
// So the nature is a per-line FACT the contractor states (line_items.vat_nature,
// migration 20261003000003), and this module is the one place that knows:
//   · the codes FatturaPA accepts (VAT_NATURES),
//   · which of them the line menu offers, per regime (offeredVatNatures),
//   · the legal reference each one carries (RiferimentoNormativo + the
//     printed annotation) — and returns null rather than guess one.
//
// SOURCES (fetched 2026-10-03):
//  · Codes: Schema VFPR12 v1.2.3 (fatturapa.gov.it/export/documenti/fatturapa/
//    v1.4/Schema_VFPR12_v1.2.3.xsd), NaturaType; Allegato A – Specifiche
//    tecniche fatture elettroniche v1.9.1 (31/03/2026, agenziaentrate.gov.it),
//    §2.2.1.14 Natura. The generic N2 / N3 / N6 are not valid since 01/01/2021
//    (SDI 00445) and are NOT on the list.
//  · RiferimentoNormativo: Allegato A 1.9.1, DatiRiepilogo — "normativa di
//    riferimento (obbligatorio nei casi di operazioni di cui all'elemento
//    Natura)". Not an SDI scarto, but required: written for EVERY nature.
//  · Printed annotation: DPR 633/1972 art. 21 c. 6 (non soggetta / non
//    imponibile / esente, "con l'eventuale indicazione della relativa norma"),
//    art. 17 c. 5–6 (reverse charge: invoice "senza addebito d'imposta" with
//    "inversione contabile" and the norm; c. 6 lett. a = subappalto edile,
//    lett. a-ter = pulizia, demolizione, installazione impianti, completamento
//    di edifici).
//  · Forfettario: L. 190/2014 art. 1 cc. 54–89 (franchigia, no IVA charged;
//    a forfettario does NOT apply reverse charge as the supplier). Minimi:
//    DL 98/2011 art. 27 cc. 1–2.
// =============================================================================

/** Every Natura FatturaPA 1.2.x accepts today (Allegato A 1.9.1). */
export const VAT_NATURES = [
  'N1', 'N2.1', 'N2.2',
  'N3.1', 'N3.2', 'N3.3', 'N3.4', 'N3.5', 'N3.6',
  'N4', 'N5',
  'N6.1', 'N6.2', 'N6.3', 'N6.4', 'N6.5', 'N6.6', 'N6.7', 'N6.8', 'N6.9',
  'N7',
] as const;
export type VatNature = typeof VAT_NATURES[number];

export const isVatNature = (v: unknown): v is VatNature =>
  typeof v === 'string' && (VAT_NATURES as readonly string[]).includes(v);

/** Inversione contabile: the CUSTOMER accounts for the IVA. */
export const isReverseChargeNature = (n: string | null | undefined): boolean => !!n && /^N6\.\d$/.test(n);

/** The two regimes under which a 0 % line is the franchise, not a choice. */
export const isFlatRateRegime = (regime: string | null | undefined): boolean => regime === 'RF19' || regime === 'RF02';

/**
 * What the line menu offers an Italian contractor. Only natures whose legal
 * basis Vasco can state without a fact it does not hold:
 *  · RF19 / RF02 — N2.2 (the franchise) and N1 (art. 15 expenses paid in the
 *    customer's name, which are outside IVA for everyone). Reverse charge is
 *    not offered: a forfettario does not apply it as the supplier.
 *  · any other regime — the two construction reverse charges, N2.1 (place of
 *    supply abroad), N1 and N4. N2.2 is not offered: outside the flat-rate
 *    regimes it is "other cases", which needs a norm only the contractor's
 *    commercialista can name.
 * Not offered anywhere (yet): N3.x (export / intra-EU GOODS; N3.5 also needs
 * the dichiarazione d'intento's protocol number), N5, the other N6.x, N7.
 */
export function offeredVatNatures(regime: string | null | undefined): VatNature[] {
  return isFlatRateRegime(regime)
    ? ['N2.2', 'N1']
    : ['N6.3', 'N6.7', 'N2.1', 'N1', 'N4'];
}

/**
 * The nature a 0 % line WITHOUT one takes, or null when it must be chosen.
 * Under RF19 / RF02 a 0 % line IS the franchise. Under any other regime a 0 %
 * line could be reverse charge, exempt or outside the territory — different
 * invoices in law — so nothing is assumed.
 */
export function defaultVatNature(regime: string | null | undefined): VatNature | null {
  return isFlatRateRegime(regime) ? 'N2.2' : null;
}

/**
 * RiferimentoNormativo (String100LatinType: ≤ 100 Latin-1 characters) — also
 * the annotation printed on the invoice. null = Vasco cannot state the legal
 * basis for this nature under this regime, and the mapper refuses the line.
 */
export function vatNatureLegalReference(nature: string | null | undefined, regime: string | null | undefined): string | null {
  switch (nature) {
    case 'N1': return 'Operazione esclusa ex art. 15 DPR 633/72';
    case 'N2.1': return 'Operazione non soggetta ex artt. da 7 a 7-septies DPR 633/72';
    case 'N2.2':
      if (regime === 'RF19') return 'Operazione in franchigia da IVA ex art. 1, cc. 54-89, L. 190/2014';
      if (regime === 'RF02') return 'Operazione senza IVA ex art. 27, cc. 1 e 2, DL 98/2011';
      return null;
    case 'N4': return 'Operazione esente ex art. 10 DPR 633/72';
    case 'N6.3': return 'Inversione contabile ex art. 17, c. 6, lett. a), DPR 633/72';
    case 'N6.7': return 'Inversione contabile ex art. 17, c. 6, lett. a-ter), DPR 633/72';
    default: return null;
  }
}

/** i18n key of a nature's short label (dots are i18next's path separator). */
export const vatNatureLabelKey = (nature: VatNature): string => `vatNature.${nature.replace('.', '_')}`;

/**
 * The annotations an Italian invoice must PRINT for its 0 % lines (DPR 633/72
 * art. 21 c. 6; art. 17 c. 5 — "inversione contabile" with the norm), one per
 * distinct nature, in the order the lines first use them. The same text as the
 * FatturaPA's RiferimentoNormativo, so the paper and the XML cannot disagree.
 * A 0 % line without a nature takes the regime's default (N2.2 under RF19 /
 * RF02); one that has neither prints nothing — the export refuses it.
 */
export function vatNatureMentions(
  lines: ReadonlyArray<{ vatRate?: number | null; vatNature?: string | null }>,
  regime: string | null | undefined,
): string[] {
  const out: string[] = [];
  for (const l of lines) {
    if (l.vatRate !== 0) continue;
    const ref = vatNatureLegalReference(l.vatNature ?? defaultVatNature(regime), regime);
    if (ref && !out.includes(ref)) out.push(ref);
  }
  return out;
}
