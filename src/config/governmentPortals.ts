// =============================================================================
// GOVERNMENT PORTALS BY COUNTRY
// =============================================================================
// The certificates screen rendered DUTCH_GOVERNMENT_PORTALS with no country
// check, so a German contractor's compliance screen linked to KVK and the
// Belastingdienst with Dutch descriptions ("Handelsregister en
// bedrijfsgegevens") — and so did the French, Spanish, Italian, UK and US
// ones. Caught by the German walk; invisible from inside NL.
//
// My first fix gated the block to NL, on the reasoning that foreign registry
// links are regulatory claims I should not invent. That was wrong in a
// specific and familiar way: all six sets ALREADY EXISTED in src/types/
// *-compliance.ts, written alongside each country's VAT and invoice rules.
// Nothing needed inventing — it needed looking for. Same shape as the
// hardcoded TRADE_LABELS map that had a complete sibling in onboarding.trades.
//
// Typed against Country so adding a market cannot silently fall back to
// someone else's tax office (learnings #163).
// =============================================================================

import type { Country } from '../i18n/formatting';
import { DUTCH_GOVERNMENT_PORTALS } from '../services/dutchComplianceService';
import { GERMAN_GOVERNMENT_PORTALS } from '../types/german-compliance';
import { FRENCH_GOVERNMENT_PORTALS } from '../types/french-compliance';
import { SPANISH_GOVERNMENT_PORTALS } from '../types/spanish-compliance';
import { ITALIAN_GOVERNMENT_PORTALS } from '../types/italian-compliance';
import { UK_GOVERNMENT_PORTALS } from '../types/uk-compliance';

export interface GovernmentPortal {
  name: string;
  url: string;
  description: string;
}

const BY_COUNTRY: Record<Country, readonly GovernmentPortal[]> = {
  NL: Object.values(DUTCH_GOVERNMENT_PORTALS),
  DE: Object.values(GERMAN_GOVERNMENT_PORTALS),
  FR: Object.values(FRENCH_GOVERNMENT_PORTALS),
  ES: Object.values(SPANISH_GOVERNMENT_PORTALS),
  IT: Object.values(ITALIAN_GOVERNMENT_PORTALS),
  UK: Object.values(UK_GOVERNMENT_PORTALS),
  // No US set exists. An empty list hides the section, which is correct —
  // showing a US contractor the Dutch KVK is worse than showing nothing.
  US: [],
};

export function governmentPortalsFor(country: Country | undefined): readonly GovernmentPortal[] {
  return BY_COUNTRY[(country ?? 'NL') as Country] ?? [];
}
