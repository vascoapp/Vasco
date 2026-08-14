// =============================================================================
// EU country walk — one posture per FILE
// =============================================================================
// Posture state (the signed-in user) lives in module scope, and clearing
// AsyncStorage + setCurrentUser(null) is NOT enough to dislodge it: walking FR
// then ES in one file left the FR user in place, so the Spanish screens
// rendered Spanish chrome over FRENCH country logic and listed URSSAF and
// Chorus Pro on the compliance screen.
//
// That looked exactly like a real bug — Spain shown France's tax office — and
// was not; run alone, ES passes. A harness that leaks posture MANUFACTURES
// findings, which is worse than missing them. Jest gives each test FILE a fresh
// module registry, so one country per file is the isolation that actually
// holds.
// =============================================================================

import fs from 'fs';
import path from 'path';
import { walkScreen } from './screenWalk';
export { findDefectShapes } from './defectShapes';

const APP = path.join(__dirname, '..', '..', 'app');

// Weighted toward surfaces whose CONTENT is country-specific — VAT, permits,
// licences, statutory interest, price indexes, payroll exports. Four tabs was
// too narrow: the German posture found four defects across seven screens, so
// the yield is in the drill-downs, not the tab bar.
export const EU_SCREENS = [
  { id: 'vandaag', file: '(contractor)/index.tsx' },
  { id: 'geld', file: '(contractor)/geld.tsx' },
  { id: 'certificaten', file: '(contractor)/certificaten.tsx' },
  { id: 'facturen', file: '(contractor)/facturen.tsx' },
  { id: 'bedrijf', file: '(contractor)/bedrijf.tsx' },
  { id: 'vat-prep', file: 'contractor/vat-prep.tsx' },
  { id: 'vat-and-audit', file: 'contractor/vat-and-audit.tsx' },
  { id: 'reports', file: 'contractor/reports.tsx' },
  { id: 'payroll', file: 'contractor/payroll.tsx' },
  { id: 'expenses', file: 'contractor/expenses.tsx' },
  { id: 'permits', file: 'contractor/permits.tsx' },
  { id: 'licenses', file: 'contractor/licenses.tsx' },
  { id: 'market-prices', file: 'contractor/market-prices.tsx' },
  { id: 'pricebook', file: 'contractor/pricebook.tsx' },
];

/** Dutch registry terms that must never appear outside NL. */
export const DUTCH_REGISTRY = ['KVK', 'Belastingdienst', 'Handelsregister en bedrijfsgegevens'];

export type EuPosture = 'plombier' | 'fontanero' | 'idraulico';

export async function walkCountry(as: EuPosture, country: string) {
  const out: any[] = [];
  for (const s of EU_SCREENS) {
    const entry: any = { screen: s.id, mounted: false, error: null, texts: [] };
    try {
      const Screen = require(path.join(APP, s.file)).default;
      const r = await walkScreen(Screen, { as, settlePasses: 10 });
      entry.mounted = !r.error;
      entry.error = r.error ? String(r.error.message) : null;
      entry.texts = r.texts;
    } catch (e) {
      entry.error = String((e as Error)?.message ?? e);
    }
    out.push(entry);
  }
  fs.writeFileSync(
    path.join(__dirname, '..', '..', '__screenwalk__', `eu-report.${country}.json`),
    JSON.stringify(out, null, 2),
  );
  return out;
}
