// =============================================================================
// VAT SCHEME ADVISOR (R263) — onboarding-driven auto-suggest
// =============================================================================
// Reads what we already know from onboarding (country + businessType + teamSize)
// and recommends the most-likely-applicable VAT scheme:
//   - NL eenmanszaak + solo → KOR (Kleineondernemersregeling, turnover ≤ €20k)
//   - DE Einzelunternehmen + solo → Kleinunternehmer (§19 UStG, ≤ €22k prior /
//     ≤ €50k current)
//   - Anything else → standard
//
// The suggestion is non-binding — contractor confirms or overrides on the VAT
// settings screen. We err toward "standard" when ambiguous since wrongly
// claiming a small-business exemption is the more harmful failure mode
// (back-VAT owed if turnover crosses the threshold mid-year).
// =============================================================================

import type { VatScheme } from '../domain/business';

export interface VatSchemeSuggestion {
  suggested: VatScheme;
  reason: string;
  i18nKey: string;
  // True when the heuristic is high-confidence (solo + sole proprietor in
  // NL/DE). When false the suggestion is 'standard' as a safe default and
  // the caller should not nudge the user to switch off whatever they picked.
  confident: boolean;
}

const NL_SOLO_TYPES = ['eenmanszaak'];
const DE_SOLO_TYPES = ['einzelunternehmen'];

export function suggestVatScheme(input: {
  country?: string | null;
  businessType?: string | null;
  teamSize?: string | null;
}): VatSchemeSuggestion {
  const country = input.country ?? null;
  const businessType = input.businessType ?? null;
  const teamSize = input.teamSize ?? null;

  // Only solo contractors get a non-standard suggestion. Small/medium/large
  // teams are very likely to exceed the small-business turnover threshold.
  if (teamSize !== 'solo') {
    return {
      suggested: 'standard',
      reason: 'Standard VAT — small-business schemes only apply to solo contractors.',
      i18nKey: 'vatScheme.advisor.standardTeam',
      confident: false,
    };
  }

  if (country === 'NL' && businessType && NL_SOLO_TYPES.includes(businessType)) {
    return {
      suggested: 'small_business_NL_KOR',
      reason: 'Solo eenmanszaak — KOR fits if your annual turnover stays under €20.000.',
      i18nKey: 'vatScheme.advisor.korNl',
      confident: true,
    };
  }

  if (country === 'DE' && businessType && DE_SOLO_TYPES.includes(businessType)) {
    return {
      suggested: 'small_business_DE_kleinunternehmer',
      reason: 'Solo Einzelunternehmen — Kleinunternehmer fits if previous-year turnover ≤ €22.000 and current-year ≤ €50.000.',
      i18nKey: 'vatScheme.advisor.kleinDe',
      confident: true,
    };
  }

  return {
    suggested: 'standard',
    reason: 'Standard VAT — no small-business exemption available for your country/business type.',
    i18nKey: 'vatScheme.advisor.standardCountry',
    confident: false,
  };
}
