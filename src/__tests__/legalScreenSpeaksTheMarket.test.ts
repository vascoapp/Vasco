/**
 * @jest-environment node
 */
// The privacy and terms PROSE on this screen is deliberately English, and the
// screen says so in the contractor's own language ("translations are for
// information only; the English version prevails") — the standard arrangement,
// and safer than a machine translation of a GDPR rights section, which would
// read as a promise.
//
// What must NOT be English is the per-country COMPLIANCE block: those are
// facts about the reader's own market — their registration, their retention
// period, their e-invoice standard, the law that governs the terms — and every
// other line of that block is already in the market's language. The Dutch
// governing-law sentence was the one left in English, under a Dutch body
// (2026-09-18).
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve(__dirname, '../../app/contractor/legal.tsx'), 'utf8');

/** The per-country block, parsed out of the source table. */
function countryBlock(code: string): string {
  const at = SRC.indexOf(`  ${code}: {`);
  if (at === -1) return '';
  return SRC.slice(at, SRC.indexOf('\n  },', at));
}

describe('the compliance block speaks the market language', () => {
  // UK and US read English legitimately.
  const MARKETS: Array<[string, RegExp]> = [
    ['NL', /Nederlands recht|Nederland/],
    ['DE', /deutsches Recht|Deutschland/],
    ['FR', /droit français|France/],
    ['ES', /legislación española|España/],
    ['IT', /diritto italiano|Italia/],
  ];

  it.each(MARKETS)('%s states its governing law in its own language', (code, pattern) => {
    const block = countryBlock(code);
    expect(block).not.toBe('');
    const law = /governingLaw: '([^']+)'/.exec(block)?.[1] ?? '';
    expect(`${code}: ${law}`).toMatch(pattern);
    expect(`${code}: ${law}`).not.toMatch(/These terms are governed by/);
  });

  it('UK keeps English, which is its own language', () => {
    expect(countryBlock('UK')).toMatch(/England and Wales/);
  });
});

describe('the English prose is disclosed, not accidental', () => {
  it('the screen renders the language notice', () => {
    expect(SRC).toMatch(/legal\.languageNoticeHeading/);
    expect(SRC).toMatch(/legal\.languageNotice/);
  });

  it('and the notice itself is translated in every market', () => {
    for (const loc of ['de', 'nl', 'fr', 'es', 'it']) {
      const dict = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../i18n/locales/${loc}.json`), 'utf8'));
      const notice = dict.legal?.languageNotice ?? '';
      expect(`${loc}: ${notice}`).not.toBe(`${loc}: `);
      // It must say which version prevails — that is the whole point of it.
      expect(`${loc}: ${notice}`).toMatch(/englisch|Engelse|anglais|inglés|inglese/i);
    }
  });
});
