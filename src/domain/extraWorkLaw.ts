// =============================================================================
// Who may bill extra work, and under which law
// =============================================================================
// Every locale cited the DUTCH statute — "art. 7:755 BW" — to a German, French,
// Spanish and Italian contractor (#339). The RULE the app enforces (warn the
// customer before billing extra work) has an equivalent in each market, but the
// citation is what makes it credible, and a foreign one makes it wrong.
//
// The gate itself does not change: a positive change order / upgrade the
// CONTRACTOR recorded needs a recorded warning before it can be billed;
// minderwerk (a negative amount) never does.
// =============================================================================

import type { Country } from '../i18n/formatting';

/**
 * The statute to cite for charging extra work, per market.
 *  - NL art. 7:755 BW — warn in time that the extra work raises the price.
 *  - DE §650b/§650c BGB — ordered changes and how they are priced (VOB/B §2(6)
 *    additionally wants the announcement BEFORE starting, when VOB/B is agreed).
 *  - FR art. 1793 C. civ. — on a fixed-price building contract extra work needs
 *    written authorisation and an agreed price.
 *  - ES art. 1593 CC — same shape: the owner's written authorisation.
 *  - IT art. 1659 c.c. — the contractor may not vary the work without the
 *    client's authorisation (in writing where the price is a lump sum).
 *  - UK — no statute; a variation is a matter of the contract terms.
 */
export const EXTRA_WORK_STATUTE: Record<Country, string | null> = {
  NL: 'art. 7:755 BW',
  DE: '§ 650b/650c BGB',
  FR: 'art. 1793 C. civ.',
  ES: 'art. 1593 CC',
  IT: 'art. 1659 c.c.',
  UK: null,
  US: null,
};

/**
 * What to put in the copy. Markets with no statute get a plain description
 * rather than an invented citation — the duty to agree a variation is
 * contractual there, and naming a law that does not exist is worse than naming
 * none.
 */
export function extraWorkStatute(country: Country | string | null | undefined): string | null {
  if (!country) return null;
  return EXTRA_WORK_STATUTE[country as Country] ?? null;
}

/**
 * Ready to drop into copy: " (§ 650b/650c BGB)" or "" where no statute applies.
 * The sentence around it must read correctly either way — which is why the
 * space and brackets live here rather than in seven translations.
 */
export function statuteSuffix(country: Country | string | null | undefined): string {
  const s = extraWorkStatute(country);
  return s ? ` (${s})` : '';
}
