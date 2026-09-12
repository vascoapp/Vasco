/**
 * Legal business forms, per market.
 *
 * These are proper nouns — GmbH, SARL, BV, Ltd — not translated copy: they are
 * the legal form in that country's own register, and they do not change with
 * the reader's language. Keyed by country, labelled for display.
 *
 * Lived inside `app/onboarding.tsx` as a module-local const, so onboarding
 * showed "GmbH" while the Profil screen rendered the stored KEY and a German
 * contractor read **"gmbh"** on their own business profile. Every market was
 * affected — "sarl", "bv", "soleTrader". Shared so the label has one home.
 */
import type { Country } from '../context/AuthContext';

export const BUSINESS_TYPES: Record<Country, { key: string; label: string }[]> = {
  NL: [
    { key: 'eenmanszaak', label: 'Eenmanszaak' },
    { key: 'vof', label: 'VOF' },
    { key: 'bv', label: 'BV' },
  ],
  UK: [
    { key: 'soleTrader', label: 'Sole Trader' },
    { key: 'partnership', label: 'Partnership' },
    { key: 'limited', label: 'Ltd' },
  ],
  DE: [
    { key: 'einzelunternehmen', label: 'Einzelunternehmen' },
    { key: 'gbr', label: 'GbR' },
    { key: 'gmbh', label: 'GmbH' },
  ],
  FR: [
    { key: 'autoEntrepreneur', label: 'Auto-entrepreneur' },
    { key: 'eirl', label: 'EIRL' },
    { key: 'sarl', label: 'SARL' },
  ],
  ES: [
    { key: 'autonomo', label: 'Autónomo' },
    { key: 'sl', label: 'S.L.' },
    { key: 'sa', label: 'S.A.' },
  ],
  IT: [
    { key: 'dittaIndividuale', label: 'Ditta individuale' },
    { key: 'srl', label: 'S.r.l.' },
    { key: 'snc', label: 'S.n.c.' },
  ],
  // R74 US foundation: most US trades operate as sole proprietorships
  // (no incorporation) or LLCs. S-corps are common for >$60k operators.
  US: [
    { key: 'soleProprietor', label: 'Sole Proprietor' },
    { key: 'llc', label: 'LLC' },
    { key: 'sCorp', label: 'S-Corp' },
  ],
};

/** Display label for a stored business-type key, falling back to the key. */
export function businessTypeLabel(country: Country | undefined, key: string | undefined | null): string | undefined {
  if (!key) return undefined;
  const found = (country ? BUSINESS_TYPES[country] : undefined)?.find((b) => b.key === key);
  if (found) return found.label;
  // Country unknown or mismatched: look across all markets before giving up, so
  // a profile whose country was set later still reads correctly.
  for (const list of Object.values(BUSINESS_TYPES)) {
    const hit = list.find((b) => b.key === key);
    if (hit) return hit.label;
  }
  return key;
}
