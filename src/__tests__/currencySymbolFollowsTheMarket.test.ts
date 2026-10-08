// A currency symbol on screen follows the contractor's market.
//
// UK walk, 2026-10-08: the quote builder printed "€ 185.50" on a UK quote — a
// literal <Text>€</Text> beside the price field, while the same line's total
// read £. Reachable code renders the symbol through currencySymbol(country) /
// formatCurrency; dormant files (src/config/dormant.files.json) are skipped
// until they are un-gated.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set<string>(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/dormant.files.json'), 'utf8')).files);
// Reached only through a dormant file (its sole importer, IntelligenceDashboard,
// is in the manifest) — the manifest lists files nothing imports, not files
// only dormant code imports. Remove the entry when it is wired back in.
const ONLY_DORMANT_IMPORTERS = new Set(['src/components/contractor/RecommendationFeedback.tsx']);
const walk = (d: string): string[] => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => {
  const rel = path.join(d, e.name);
  if (e.isDirectory()) return ['__tests__', 'node_modules'].includes(e.name) ? [] : walk(rel);
  return /\.tsx$/.test(e.name) ? [rel] : [];
});

it('no reachable screen hard-codes a currency symbol in a Text', () => {
  const offenders = [...walk('app'), ...walk('src/components')]
    .filter((f) => !dormant.has(f) && !ONLY_DORMANT_IMPORTERS.has(f))
    .filter((f) => />\s*[€£$]\s*<\/Text>/.test(stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
  expect(offenders).toEqual([]);
});
