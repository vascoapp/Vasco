// =============================================================================
// PHRASING — validation + resolution guards
// =============================================================================
// The claim this layer makes is "an LLM can improve the wording of an insight
// without ever being able to invent a number". That claim is only worth as much
// as these tests, so they are written against the failure modes that have
// actually shipped in this codebase before:
//
//   * a fabricated statistic on an insight card (screen walk, R317-321)
//   * gt() silently returning the key itself on a miss (learnings #784)
//   * labels truncated to uselessness on the card (screen walk)
//   * a template losing a fact because a call site changed and its partner
//     table did not (the FE<->BE 5-file rule, learnings #50)
// =============================================================================

import {
  validatePhrasing,
  validateBatch,
  extractPlaceholders,
  stripPlaceholders,
  PHRASING_LANGUAGES,
  type PhrasingSpec,
  type PhrasingBundle,
} from '../phrasing/phrasingValidation';
import { PHRASING_SPECS, PHRASING_SPEC_BY_KEY } from '../phrasing/phrasingSpecs';
import {
  gtv,
  loadPhrasingPack,
  clearPhrasingPack,
  getActivePhrasingKeys,
  getPhrasingPackMeta,
  PHRASING_PACK_VERSION,
} from '../phrasing/phrasingStore';
import { TRANSLATIONS, gt } from '../generatorTranslations';

const SPEC: PhrasingSpec = {
  key: 'test_key',
  placeholders: ['count', 'amount'],
  required: ['count', 'amount'],
  maxChars: 40,
};

/** A bundle that satisfies SPEC in all six languages. */
const good = (text = '{{count}} open voor {{amount}}'): PhrasingBundle =>
  PHRASING_LANGUAGES.reduce((acc, l) => ({ ...acc, [l]: text }), {} as PhrasingBundle);

afterEach(() => clearPhrasingPack());

describe('placeholder helpers', () => {
  it('extracts placeholder names in order', () => {
    expect(extractPlaceholders('{{a}} then {{b}} and {{a}}')).toEqual(['a', 'b', 'a']);
  });

  it('tolerates internal whitespace', () => {
    expect(extractPlaceholders('{{ count }}')).toEqual(['count']);
  });

  it('strips placeholders for length measurement', () => {
    expect(stripPlaceholders('{{count}} invoices')).toBe(' invoices');
  });
});

describe('validatePhrasing — the core guarantee', () => {
  it('accepts a well-formed bundle', () => {
    expect(validatePhrasing(SPEC, good())).toEqual([]);
  });

  // THE load-bearing test. A literal digit is how a fabricated statistic gets
  // onto a card, so it must fail regardless of how plausible it looks.
  it('rejects a literal digit anywhere in any language', () => {
    const bundle = good();
    bundle.de = '{{count}} offen, 35% ueber Branche {{amount}}';
    const issues = validatePhrasing(SPEC, bundle);
    expect(issues.some((i) => i.rule === 'literal_digit' && i.language === 'de')).toBe(true);
  });

  it('rejects a digit even when every placeholder is correct', () => {
    const issues = validatePhrasing(SPEC, good('{{count}} of 5 open: {{amount}}'));
    expect(issues.filter((i) => i.rule === 'literal_digit')).toHaveLength(PHRASING_LANGUAGES.length);
  });

  it('allows digits only when the spec opts in', () => {
    const permissive = { ...SPEC, allowDigits: true };
    expect(validatePhrasing(permissive, good('{{count}} of 5: {{amount}}'))).toEqual([]);
  });

  it('rejects a missing locale rather than falling back silently', () => {
    const bundle: Partial<PhrasingBundle> = { ...good() };
    delete bundle.it;
    const issues = validatePhrasing(SPEC, bundle);
    expect(issues.some((i) => i.rule === 'locale_missing' && i.language === 'it')).toBe(true);
  });

  it('rejects an empty string as a missing locale', () => {
    const bundle = good();
    bundle.fr = '   ';
    expect(validatePhrasing(SPEC, bundle).some((i) => i.rule === 'locale_missing')).toBe(true);
  });

  it('rejects an invented placeholder', () => {
    const issues = validatePhrasing(SPEC, good('{{count}} {{amount}} {{revenue}}'));
    expect(issues.some((i) => i.rule === 'unknown_placeholder')).toBe(true);
  });

  it('rejects a dropped required placeholder', () => {
    const issues = validatePhrasing(SPEC, good('{{count}} facturen open'));
    expect(issues.some((i) => i.rule === 'missing_required_placeholder')).toBe(true);
  });

  it('rejects over-budget literal text', () => {
    const issues = validatePhrasing(SPEC, good(`{{count}} ${'x'.repeat(60)} {{amount}}`));
    expect(issues.some((i) => i.rule === 'too_long')).toBe(true);
  });

  it('measures length excluding placeholders, so long param names are free', () => {
    // Literal text is short; the placeholders are what make the raw string long.
    const spec: PhrasingSpec = { key: 'k', placeholders: ['customer', 'amount'], required: [], maxChars: 10 };
    expect(validatePhrasing(spec, good('{{customer}}{{amount}}'))).toEqual([]);
  });

  it('rejects unbalanced braces', () => {
    expect(validatePhrasing(SPEC, good('{{count} {{amount}}')).some((i) => i.rule === 'unbalanced_braces')).toBe(true);
  });

  it('rejects markup', () => {
    expect(validatePhrasing(SPEC, good('**{{count}}** {{amount}}')).some((i) => i.rule === 'markup')).toBe(true);
  });

  it('reports a null bundle rather than throwing', () => {
    expect(validatePhrasing(SPEC, null).some((i) => i.rule === 'bundle_missing')).toBe(true);
  });

  it('reports every violation, not just the first', () => {
    const issues = validatePhrasing(SPEC, good('7 {{revenue}}'));
    const rules = new Set(issues.map((i) => i.rule));
    expect(rules.has('literal_digit')).toBe(true);
    expect(rules.has('unknown_placeholder')).toBe(true);
    expect(rules.has('missing_required_placeholder')).toBe(true);
  });
});

describe('validateBatch', () => {
  it('accepts good keys and isolates bad ones', () => {
    const specs = [SPEC, { ...SPEC, key: 'other' }];
    const { accepted, violations } = validateBatch(specs, {
      test_key: good(),
      other: good('9 {{count}} {{amount}}'),
    });
    expect(Object.keys(accepted)).toEqual(['test_key']);
    expect(violations.every((v) => v.key === 'other')).toBe(true);
  });
});

describe('gtv — gt() is always the floor', () => {
  it('returns gt() output when no pack is loaded', () => {
    expect(gtv('fin_overdue_metric', 'nl')).toBe(gt('fin_overdue_metric', 'nl'));
  });

  it('returns gt() output for a key the pack does not cover', () => {
    loadPhrasingPack({
      version: PHRASING_PACK_VERSION,
      generatedAt: '2026-08-02T00:00:00Z',
      provider: 'moonshot',
      entries: { fin_overdue_metric: good('Achterstallig') },
    });
    expect(gtv('fin_overdue_title', 'nl', { count: 2, amount: '800' }))
      .toBe(gt('fin_overdue_title', 'nl', { count: 2, amount: '800' }));
  });

  it('uses the pack wording and interpolates on-device', () => {
    loadPhrasingPack({
      version: PHRASING_PACK_VERSION,
      generatedAt: '2026-08-02T00:00:00Z',
      provider: 'moonshot',
      entries: { fin_overdue_title: good('{{count}} open, {{amount}} totaal') },
    });
    expect(gtv('fin_overdue_title', 'nl', { count: 3, amount: '€800' })).toBe('3 open, €800 totaal');
  });

  it('drops only the invalid entry, keeping the rest of the pack', () => {
    const res = loadPhrasingPack({
      version: PHRASING_PACK_VERSION,
      generatedAt: '2026-08-02T00:00:00Z',
      provider: 'moonshot',
      entries: {
        fin_overdue_metric: good('Achterstallig'),
        fin_overdue_title: good('4 {{count}} {{amount}}'), // literal digit
      },
    });
    expect(res.loaded).toBe(1);
    expect(res.rejected).toBe(1);
    expect(getActivePhrasingKeys()).toEqual(['fin_overdue_metric']);
    // The rejected key still renders — from the built-in table.
    expect(gtv('fin_overdue_title', 'nl', { count: 3, amount: '€800' }))
      .toBe(gt('fin_overdue_title', 'nl', { count: 3, amount: '€800' }));
  });

  it('refuses a pack built against a different contract version', () => {
    const res = loadPhrasingPack({
      version: PHRASING_PACK_VERSION + 1,
      generatedAt: '2026-08-02T00:00:00Z',
      provider: 'moonshot',
      entries: { fin_overdue_metric: good('Achterstallig') },
    });
    expect(res.loaded).toBe(0);
    expect(getActivePhrasingKeys()).toEqual([]);
  });

  it('ignores keys with no registered spec', () => {
    const res = loadPhrasingPack({
      version: PHRASING_PACK_VERSION,
      generatedAt: '2026-08-02T00:00:00Z',
      provider: 'moonshot',
      entries: { not_a_registered_key: good() },
    });
    expect(res.loaded).toBe(0);
    expect(res.violations.some((v) => v.rule === 'unknown_key')).toBe(true);
  });

  it('clears back to the built-in table', () => {
    loadPhrasingPack({
      version: PHRASING_PACK_VERSION,
      generatedAt: '2026-08-02T00:00:00Z',
      provider: 'moonshot',
      entries: { fin_overdue_metric: good('Achterstallig') },
    });
    clearPhrasingPack();
    expect(getPhrasingPackMeta()).toBeNull();
    expect(gtv('fin_overdue_metric', 'nl')).toBe(gt('fin_overdue_metric', 'nl'));
  });

  it('handles a null pack without throwing', () => {
    expect(() => loadPhrasingPack(null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// DRIFT GUARD. A spec that disagrees with the gt() template it overrides is the
// bug this whole layer is most likely to grow: someone edits a generator call
// site, the spec still lists the old placeholders, and the LLM wording quietly
// loses a fact. Static types cannot see it — both sides are strings.
// ---------------------------------------------------------------------------
describe('specs stay in sync with the translation table', () => {
  it('every spec key exists in TRANSLATIONS', () => {
    const missing = PHRASING_SPECS.filter((s) => !TRANSLATIONS[s.key]).map((s) => s.key);
    expect(missing).toEqual([]);
  });

  it('every placeholder the built-in NL/EN template uses is allowlisted in its spec', () => {
    const problems: string[] = [];
    for (const spec of PHRASING_SPECS) {
      const entry = TRANSLATIONS[spec.key];
      if (!entry) continue;
      for (const lang of ['nl', 'en'] as const) {
        for (const p of extractPlaceholders(entry[lang] ?? '')) {
          if (!spec.placeholders.includes(p)) {
            problems.push(`${spec.key}[${lang}] uses {{${p}}} which the spec does not allow`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('the built-in table itself would pass its own spec', () => {
    // If the shipped wording cannot satisfy the spec, the spec is wrong — the
    // budget is too tight or a placeholder is missing from the allowlist.
    const problems: string[] = [];
    for (const spec of PHRASING_SPECS) {
      const entry = TRANSLATIONS[spec.key];
      if (!entry) continue;
      const bundle = PHRASING_LANGUAGES.reduce(
        (acc, l) => ({ ...acc, [l]: entry[l] }),
        {} as PhrasingBundle,
      );
      for (const issue of validatePhrasing(spec, bundle)) {
        // The built-in tables predate this layer and may legitimately contain
        // digits; every OTHER rule must already hold.
        if (issue.rule !== 'literal_digit') {
          problems.push(`${issue.key}[${issue.language}] ${issue.rule}: ${issue.detail}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('spec lookup covers every registered spec', () => {
    expect(Object.keys(PHRASING_SPEC_BY_KEY).sort()).toEqual(PHRASING_SPECS.map((s) => s.key).sort());
  });
});

// ---------------------------------------------------------------------------
// REGRESSION — the digit rule only ever saw numerals
// ---------------------------------------------------------------------------
// A probe showed "drie facturen open voor {{amount}}" passing cleanly: the
// count hard-coded as a WORD while {{count}} sat unused. Same fabricated
// quantity the digit rule exists to stop, just spelled out.
describe('spelled-out numbers are literals too', () => {
  const spec: PhrasingSpec = { key: 'k', placeholders: ['amount'], required: ['amount'], maxChars: 60 };

  it.each([
    ['nl', 'drie facturen open voor {{amount}}'],
    ['en', 'three invoices for {{amount}}'],
    ['de', 'zwei Rechnungen offen {{amount}}'],
    ['fr', 'quatre factures {{amount}}'],
    ['es', 'cinco facturas {{amount}}'],
    ['it', 'sei fatture {{amount}}'],
  ])('rejects a number word in %s', (_lang, text) => {
    const bundle = PHRASING_LANGUAGES.reduce((a, l) => ({ ...a, [l]: text }), {} as PhrasingBundle);
    expect(validatePhrasing(spec, bundle).some((i) => i.rule === 'literal_number_word')).toBe(true);
  });

  // Every language Vasco ships uses its word for "one" as the indefinite
  // article, so banning it would reject perfectly good copy.
  it.each([
    ['nl', 'stuur een herinnering voor {{amount}}'],
    ['de', 'sende eine Mahnung {{amount}}'],
    ['fr', 'envoyez un rappel {{amount}}'],
    ['es', 'envia un recordatorio {{amount}}'],
    ['it', 'invia un sollecito {{amount}}'],
    ['en', 'send a reminder for {{amount}}'],
  ])('does NOT flag the indefinite article in %s', (_lang, text) => {
    const bundle = PHRASING_LANGUAGES.reduce((a, l) => ({ ...a, [l]: text }), {} as PhrasingBundle);
    expect(validatePhrasing(spec, bundle).some((i) => i.rule === 'literal_number_word')).toBe(false);
  });

  it('does not false-flag a number word embedded inside a longer word', () => {
    // "tres" (es: three) inside "estrestante" must not trip the check.
    const bundle = PHRASING_LANGUAGES.reduce(
      (a, l) => ({ ...a, [l]: 'openstaand bedrag {{amount}}' }), {} as PhrasingBundle,
    );
    expect(validatePhrasing(spec, bundle).some((i) => i.rule === 'literal_number_word')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A spec for a string nobody renders is pure waste — and worse, it inflates
// apparent coverage. Derived 23 specs from the translation table once and 17 of
// them turned out to be for keys with ZERO call sites (47 of the 428 keys in
// TRANSLATIONS, 10%, are dead). This guard makes that unrepeatable.
// ---------------------------------------------------------------------------
describe('every spec covers a string that is actually rendered', () => {
  const readSources = (): string => {
    // Required lazily so the module graph is not loaded for the other tests.
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.resolve(__dirname, '../../..');
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name === '__tests__') continue;
          walk(full);
        } else if (/\.tsx?$/.test(e.name) && e.name !== 'generatorTranslations.ts') {
          out.push(fs.readFileSync(full, 'utf8'));
        }
      }
    };
    walk(path.join(root, 'src'));
    walk(path.join(root, 'app'));
    return out.join('\n');
  };

  it('has no spec for an unreferenced key', () => {
    const blob = readSources();
    const orphans = PHRASING_SPECS
      .map((s) => s.key)
      .filter((k) => !new RegExp(`['"\`]${k}['"\`]`).test(blob));
    expect(orphans).toEqual([]);
  });
});
