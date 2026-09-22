/**
 * Every starter service the quote builder can put on a quote LINE is resolved
 * by a stable id in all six locales — and no trade bypasses that table.
 *
 * Painting had no entry in TRADE_PRICEBOOK, so the builder read MOCK_PRICEBOOK
 * for it instead: "Wall Preparation - Standard", "Interior Wall Painting" and
 * English package bullets under a Dutch "Regels (Standaard)" header, priced at
 * ×1.4 / ×2 per package past the ×1 package decision (#346) — iOS sim,
 * 2026-09-22. CLAUDE.md said the catalogue was complete in six locales; nothing
 * checked it.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '../utils/stripComments';

const SRC = stripComments(readFileSync(join(__dirname, '../components/contractor/TieredQuoteBuilder.tsx'), 'utf8'));
const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'];
const catalog = (l: string) => require(`../i18n/locales/${l}.json`).quoteCatalog;

const table = SRC.slice(SRC.indexOf('const TRADE_PRICEBOOK'), SRC.indexOf('} : {};', SRC.indexOf('const TRADE_PRICEBOOK')));
const nameKeys = [...table.matchAll(/nameKey:\s*'([^']+)'/g)].map((m) => m[1]);
const unitKeys = [...new Set([...table.matchAll(/unitKey:\s*'([^']+)'/g)].map((m) => m[1]))];

describe('the quote builder starter catalogue', () => {
  it('is parsed at all', () => {
    expect(nameKeys.length).toBeGreaterThanOrEqual(25);
  });

  it('has painting — the trade that fell through to the English mock', () => {
    expect(table).toMatch(/\bpainting:\s*\[/);
  });

  it('never reads MOCK_PRICEBOOK', () => {
    expect(SRC).not.toMatch(/MOCK_PRICEBOOK/);
  });

  for (const l of LOCALES) {
    it(`${l}: every service name and unit resolves`, () => {
      const c = catalog(l);
      const missing = [
        ...nameKeys.filter((k) => !(typeof c?.service?.[k] === 'string' && c.service[k].trim())).map((k) => `service.${k}`),
        ...unitKeys.filter((k) => !(typeof c?.unit?.[k] === 'string' && c.unit[k].trim())).map((k) => `unit.${k}`),
      ];
      expect(missing).toEqual([]);
    });
  }

  it('the Dutch names are not the English ones', () => {
    const en = catalog('en').service;
    const nl = catalog('nl').service;
    expect(nameKeys.filter((k) => en[k] === nl[k])).toEqual([]);
  });
});
