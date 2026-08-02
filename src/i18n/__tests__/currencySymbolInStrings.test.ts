// =============================================================================
// CURRENCY SYMBOLS MUST NOT LIVE IN TRANSLATION STRINGS
// =============================================================================
// Found by walking the app on Android: the insight card read "$€ 350 outstanding"
// — a DOUBLED currency symbol. `en-US.json` carried "${{amount}}" while every
// other locale carried a bare "{{amount}}", and `formatMoney()` already supplies
// the symbol from the contractor's COUNTRY (not their locale). So en-US locale +
// NL country produced "$" + "€ 350". For a real US contractor it is worse:
// country=US makes formatMoney emit "$350", giving "$$350".
//
// Root cause was a stale generated file, not a typo. `scripts/generate-en-us.mjs`
// derives en-US from en and rewrites € -> $. The 2026-07-26 currency sweep
// (learnings #85/#86, commit 927c831) removed the symbols from en.json but never
// re-ran the generator, so en-US stayed frozen on 2026-07-18 with a `$` derived
// from the old `€`. Eight days of drift that no check could see.
//
// These tests close that gap for every locale at once. The symptom test is the
// cheap one; the en-US/en consistency test is what actually stops the drift.
// =============================================================================

import en from '../locales/en.json';
import enUS from '../locales/en-US.json';
import nl from '../locales/nl.json';
import de from '../locales/de.json';
import fr from '../locales/fr.json';
import es from '../locales/es.json';
// NB: aliased — a bare `import it` shadows jest's global `it()` and the whole
// suite fails to run with a confusing "_it.default is not a function".
import itLocale from '../locales/it.json';

type Tree = Record<string, unknown>;

function flatten(obj: Tree, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[path] = v;
    else if (v && typeof v === 'object') flatten(v as Tree, path, out);
  }
  return out;
}

const LOCALES: Array<[string, Tree]> = [
  ['en', en as Tree], ['en-US', enUS as Tree], ['nl', nl as Tree],
  ['de', de as Tree], ['fr', fr as Tree], ['es', es as Tree], ['it', itLocale as Tree],
];

/**
 * A symbol immediately before an interpolation is the tell. `formatMoney` /
 * `formatCurrency` / `gtMoney` all emit the symbol themselves, so any symbol in
 * the sentence is either a duplicate or a hard-coded currency that will be wrong
 * in five of the seven markets.
 */
const SYMBOL_BEFORE_PLACEHOLDER = /[$€£]\s*\{\{/;

describe('no locale hard-codes a currency symbol before a placeholder', () => {
  for (const [name, tree] of LOCALES) {
    it(`${name} is clean`, () => {
      const offenders = Object.entries(flatten(tree))
        .filter(([, v]) => SYMBOL_BEFORE_PLACEHOLDER.test(v))
        .map(([k, v]) => `${k} = ${v.slice(0, 70)}`);
      expect(offenders).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// The test that actually prevents recurrence.
// ---------------------------------------------------------------------------
describe('en-US is a consistent override layer over en', () => {
  const flatEn = flatten(en as Tree);
  // `_meta` is generator provenance (note / regime / currency), written by
  // scripts/generate-en-us.mjs and deliberately absent from en. Excluded so the
  // orphan check measures real translation drift, not bookkeeping.
  const flatUs = Object.fromEntries(
    Object.entries(flatten(enUS as Tree)).filter(([k]) => !k.startsWith('_meta.')),
  );

  it('carries generator provenance so staleness is diagnosable', () => {
    const meta = (enUS as Tree)._meta as Record<string, string>;
    expect(meta?.note).toMatch(/generate-en-us/);
    expect(meta?.currency).toBe('USD');
  });

  it('has no orphan keys — every override targets a key that exists in en', () => {
    // An orphan means en-US was generated against a different en than the one
    // shipping now, i.e. the two files have drifted. That drift is exactly what
    // let "$€ 350" survive for eight days.
    const orphans = Object.keys(flatUs).filter((k) => !(k in flatEn));
    expect(orphans).toEqual([]);
  });

  it('only overrides keys whose text actually differs from en', () => {
    // A redundant override is dead weight that silently goes stale when en
    // changes — which is precisely how the currency fix was missed here.
    const redundant = Object.keys(flatUs).filter((k) => flatUs[k] === flatEn[k]);
    expect(redundant).toEqual([]);
  });

  it('relies on a real fallback: en-US is much smaller than en', () => {
    // Sanity that en-US is an override layer and not a full copy — a full copy
    // is how it drifts. i18n.ts configures fallbackLng { 'en-US': ['en'] }.
    expect(Object.keys(flatUs).length).toBeLessThan(Object.keys(flatEn).length / 2);
  });
});
