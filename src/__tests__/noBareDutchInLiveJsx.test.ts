// Bare Dutch typed into JSX between expressions ships Dutch to all six
// locales — "{amount} verlopen · {n} facturen" on the Facturen banner and
// "{rate}% van vergelijkbare offertes · {n} aannemers" in the quote builder
// (aannemer walk, 2026-09-29). Only files a live screen RENDERS are checked:
// six components (ComplianceCenter, CustomerInsights, DocumentVault,
// LeadGeneration, MarketIntelligence, RouteOptimizer) carry the shape but are
// mounted nowhere — fix them when one is mounted.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const WORDS = /\b(verlopen|facturen|factuur|klussen|offertes|offerte|dagen|klanten|openstaand|betaald|toevoegen|opslaan|annuleren|vandaag|aannemers|vakmensen)\b/i;

import manifest from '../config/dormant.files.json';

const dormant = new Set((manifest as any).files as string[]);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
  return /\.tsx$/.test(e.name) ? [p] : [];
});
// Every live route (a route is rendered by definition; app/hub is the
// out-of-scope portfolio surface) + the rendered components known to carry
// the shape.
const FILES = [
  ...walk(path.join(ROOT, 'app')).map((f) => path.relative(ROOT, f))
    .filter((f) => !dormant.has(f) && !f.startsWith('app/hub/')),
  'src/components/contractor/TieredQuoteBuilder.tsx',
];

it('covers the live routes', () => { expect(FILES.length).toBeGreaterThan(60); });

it.each(FILES)('%s has no bare Dutch JSX text', (f) => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const hits = [...src.matchAll(/[}>]([^<>{}`'"=;()]{2,80})[<{]/g)]
    .map((m) => m[1])
    .filter((txt) => /[A-Za-z]{3}/.test(txt) && WORDS.test(txt) && !/[&|?:]|=>/.test(txt));
  expect(hits).toEqual([]);
});
