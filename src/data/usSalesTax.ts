// =============================================================================
// US SALES TAX — STATE-LEVEL BASE RATES (R74 US foundation)
// =============================================================================
// Per-state base sales tax rates as of 2026. These are the STATE component
// only — counties and cities add local rates on top, which routinely push
// the combined rate to 8-10% in major metros. For accurate at-checkout
// rates, integrate TaxJar or Avalara (Phase 5 of the US expansion plan).
//
// Source: Tax Foundation 2026 state rates summary + state DoR sites.
// Vasco's invoice flow should treat these as DEFAULTS and let contractors
// override per-customer when local rates differ.
//
// Five states ship with 0% state sales tax (NOMAD: New Hampshire, Oregon,
// Montana, Alaska, Delaware). Alaska + Montana still allow local sales
// taxes; contractors operating there will need the override path.
// =============================================================================

export type UsStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
  | 'DC';

export interface UsStateInfo {
  code: UsStateCode;
  name: string;
  baseRate: number; // state-level rate (percent)
  // Indicates whether localities can add additional sales tax. If true,
  // contractor should verify the customer's effective rate before invoice.
  allowsLocalTax: boolean;
  // Some states require a Contractor License for residential work above
  // certain thresholds. Surface in onboarding when this is true so we
  // prompt for the contractor's license #.
  requiresStateContractorLicense?: boolean;
}

export const US_STATES: Record<UsStateCode, UsStateInfo> = {
  AL: { code: 'AL', name: 'Alabama',           baseRate: 4.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  AK: { code: 'AK', name: 'Alaska',            baseRate: 0.0,   allowsLocalTax: true },
  AZ: { code: 'AZ', name: 'Arizona',           baseRate: 5.6,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  AR: { code: 'AR', name: 'Arkansas',          baseRate: 6.5,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  CA: { code: 'CA', name: 'California',        baseRate: 7.25,  allowsLocalTax: true,  requiresStateContractorLicense: true },
  CO: { code: 'CO', name: 'Colorado',          baseRate: 2.9,   allowsLocalTax: true },
  CT: { code: 'CT', name: 'Connecticut',       baseRate: 6.35,  allowsLocalTax: false, requiresStateContractorLicense: true },
  DE: { code: 'DE', name: 'Delaware',          baseRate: 0.0,   allowsLocalTax: false },
  FL: { code: 'FL', name: 'Florida',           baseRate: 6.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  GA: { code: 'GA', name: 'Georgia',           baseRate: 4.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  HI: { code: 'HI', name: 'Hawaii',            baseRate: 4.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  ID: { code: 'ID', name: 'Idaho',             baseRate: 6.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  IL: { code: 'IL', name: 'Illinois',          baseRate: 6.25,  allowsLocalTax: true },
  IN: { code: 'IN', name: 'Indiana',           baseRate: 7.0,   allowsLocalTax: false },
  IA: { code: 'IA', name: 'Iowa',              baseRate: 6.0,   allowsLocalTax: true },
  KS: { code: 'KS', name: 'Kansas',            baseRate: 6.5,   allowsLocalTax: true },
  KY: { code: 'KY', name: 'Kentucky',          baseRate: 6.0,   allowsLocalTax: false },
  LA: { code: 'LA', name: 'Louisiana',         baseRate: 4.45,  allowsLocalTax: true,  requiresStateContractorLicense: true },
  ME: { code: 'ME', name: 'Maine',             baseRate: 5.5,   allowsLocalTax: false },
  MD: { code: 'MD', name: 'Maryland',          baseRate: 6.0,   allowsLocalTax: false, requiresStateContractorLicense: true },
  MA: { code: 'MA', name: 'Massachusetts',     baseRate: 6.25,  allowsLocalTax: false, requiresStateContractorLicense: true },
  MI: { code: 'MI', name: 'Michigan',          baseRate: 6.0,   allowsLocalTax: false, requiresStateContractorLicense: true },
  MN: { code: 'MN', name: 'Minnesota',         baseRate: 6.875, allowsLocalTax: true,  requiresStateContractorLicense: true },
  MS: { code: 'MS', name: 'Mississippi',       baseRate: 7.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  MO: { code: 'MO', name: 'Missouri',          baseRate: 4.225, allowsLocalTax: true },
  MT: { code: 'MT', name: 'Montana',           baseRate: 0.0,   allowsLocalTax: true },
  NE: { code: 'NE', name: 'Nebraska',          baseRate: 5.5,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  NV: { code: 'NV', name: 'Nevada',            baseRate: 6.85,  allowsLocalTax: true,  requiresStateContractorLicense: true },
  NH: { code: 'NH', name: 'New Hampshire',     baseRate: 0.0,   allowsLocalTax: false },
  NJ: { code: 'NJ', name: 'New Jersey',        baseRate: 6.625, allowsLocalTax: false, requiresStateContractorLicense: true },
  NM: { code: 'NM', name: 'New Mexico',        baseRate: 5.125, allowsLocalTax: true,  requiresStateContractorLicense: true },
  NY: { code: 'NY', name: 'New York',          baseRate: 4.0,   allowsLocalTax: true },
  NC: { code: 'NC', name: 'North Carolina',    baseRate: 4.75,  allowsLocalTax: true,  requiresStateContractorLicense: true },
  ND: { code: 'ND', name: 'North Dakota',      baseRate: 5.0,   allowsLocalTax: true },
  OH: { code: 'OH', name: 'Ohio',              baseRate: 5.75,  allowsLocalTax: true,  requiresStateContractorLicense: true },
  OK: { code: 'OK', name: 'Oklahoma',          baseRate: 4.5,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  OR: { code: 'OR', name: 'Oregon',            baseRate: 0.0,   allowsLocalTax: false, requiresStateContractorLicense: true },
  PA: { code: 'PA', name: 'Pennsylvania',      baseRate: 6.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  RI: { code: 'RI', name: 'Rhode Island',      baseRate: 7.0,   allowsLocalTax: false, requiresStateContractorLicense: true },
  SC: { code: 'SC', name: 'South Carolina',    baseRate: 6.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  SD: { code: 'SD', name: 'South Dakota',      baseRate: 4.2,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  TN: { code: 'TN', name: 'Tennessee',         baseRate: 7.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  TX: { code: 'TX', name: 'Texas',             baseRate: 6.25,  allowsLocalTax: true,  requiresStateContractorLicense: true },
  UT: { code: 'UT', name: 'Utah',              baseRate: 6.1,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  VT: { code: 'VT', name: 'Vermont',           baseRate: 6.0,   allowsLocalTax: true },
  VA: { code: 'VA', name: 'Virginia',          baseRate: 5.3,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  WA: { code: 'WA', name: 'Washington',        baseRate: 6.5,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  WV: { code: 'WV', name: 'West Virginia',     baseRate: 6.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  WI: { code: 'WI', name: 'Wisconsin',         baseRate: 5.0,   allowsLocalTax: true,  requiresStateContractorLicense: true },
  WY: { code: 'WY', name: 'Wyoming',           baseRate: 4.0,   allowsLocalTax: true },
  DC: { code: 'DC', name: 'District of Columbia', baseRate: 6.0, allowsLocalTax: false, requiresStateContractorLicense: true },
};

export function getStateInfo(stateCode: string): UsStateInfo | null {
  const upper = stateCode.toUpperCase() as UsStateCode;
  return US_STATES[upper] ?? null;
}

export function getStateBaseRate(stateCode: string): number {
  return getStateInfo(stateCode)?.baseRate ?? 0;
}

export function listUsStates(): UsStateInfo[] {
  return Object.values(US_STATES).sort((a, b) => a.name.localeCompare(b.name));
}

// Convenience for the registry: the COUNTRIES.US row references this map.
export const US_STATE_RATES: Record<string, number> = Object.fromEntries(
  Object.entries(US_STATES).map(([code, info]) => [code, info.baseRate]),
);
