// =============================================================================
// MATERIAL NORMALISATION — does it actually collapse the cohort?
// =============================================================================
// The claim is that normalising the key raises cohort density past the k>=5
// gate without recruiting contractors. The only test that really matters is
// therefore the fragmentation one at the bottom: real-world spellings of ONE
// product must land in ONE bucket.
// =============================================================================

import {
  canonicalMaterialKey,
  canonicaliseDescription,
  mergesWith,
  proposalIsAcceptable,
} from '../materialNormalization';

describe('identity beats similarity', () => {
  it('uses the EAN when present, regardless of description', () => {
    const a = canonicalMaterialKey({ description: 'YMvK 3x2,5', ean: '8712345678901' });
    const b = canonicalMaterialKey({ description: 'totally different words', ean: '871 2345 678 901' });
    expect(a.method).toBe('ean');
    expect(a.confidence).toBe(1);
    expect(a.key).toBe(b.key);
  });

  it('ignores a malformed EAN and falls back to text', () => {
    expect(canonicalMaterialKey({ description: 'kabel', ean: '123' }).method).toBe('text');
  });

  it('namespaces an article number by supplier', () => {
    const a = canonicalMaterialKey({ description: 'kabel', articleNumber: 'AB-123', supplierId: 'tu' });
    const b = canonicalMaterialKey({ description: 'kabel', articleNumber: 'AB-123', supplierId: 'rexel' });
    expect(a.method).toBe('article');
    expect(a.key).not.toBe(b.key); // same code, different catalogues
  });

  it('ignores an article number with no supplier — it is not an identity', () => {
    expect(canonicalMaterialKey({ description: 'kabel ymvk', articleNumber: 'AB-123' }).method).toBe('text');
  });
});

describe('deterministic text canonicalisation', () => {
  it('folds case and diacritics', () => {
    expect(canonicaliseDescription('Kabel Ýmvk').key).toBe(canonicaliseDescription('kabel ymvk').key);
  });

  it('treats decimal comma and decimal point as the same number', () => {
    expect(canonicaliseDescription('2,5mm2').key).toBe(canonicaliseDescription('2.5mm2').key);
  });

  it('normalises mm2 spellings', () => {
    const forms = ['2.5mm²', '2.5mm2', '2.5 mm2', '2,5 mm²'];
    const keys = new Set(forms.map((f) => canonicaliseDescription(f).key));
    expect(keys.size).toBe(1);
  });

  it('normalises dimension separators', () => {
    const forms = ['3x2.5', '3 x 2,5', '3X2.5', '3*2,5'];
    const keys = new Set(forms.map((f) => canonicaliseDescription(f).key));
    expect(keys.size).toBe(1);
  });

  it('keeps a dimension group atomic so sorting cannot scramble it', () => {
    expect(canonicaliseDescription('3x2.5').tokens).toEqual(['3x2.5']);
    // and so two genuinely different dimensions stay apart
    expect(canonicaliseDescription('3x2.5').key).not.toBe(canonicaliseDescription('5x4').key);
  });

  it('merges word-order variants', () => {
    expect(canonicaliseDescription('YMvK kabel').key).toBe(canonicaliseDescription('kabel YMvK').key);
  });

  it('drops packaging and commercial noise', () => {
    expect(canonicaliseDescription('YMvK kabel per meter').key)
      .toBe(canonicaliseDescription('YMvK kabel').key);
    expect(canonicaliseDescription('kabel ymvk AANBIEDING').key)
      .toBe(canonicaliseDescription('kabel ymvk').key);
  });

  it('maps unit aliases across languages', () => {
    const perStuk = canonicaliseDescription('wartel stuks').key;
    for (const u of ['stuk', 'stk', 'pcs', 'Stück', 'pezzi', 'uds']) {
      expect(canonicaliseDescription(`wartel ${u}`).key).toBe(perStuk);
    }
  });

  it('strips a thousands separator without corrupting the number', () => {
    expect(canonicaliseDescription('1.234,50').tokens).toEqual(['1234.50']);
  });

  it('returns empty for junk input without throwing', () => {
    expect(canonicaliseDescription('').key).toBe('');
    expect(canonicaliseDescription(null as unknown as string).key).toBe('');
    expect(canonicaliseDescription('   ---   ').key).toBe('');
  });

  it('scores confidence by how much identity the description carries', () => {
    expect(canonicalMaterialKey({ description: 'YMvK kabel 3x2.5mm2' }).confidence).toBeGreaterThanOrEqual(0.8);
    expect(canonicalMaterialKey({ description: 'kabel' }).confidence).toBeLessThan(0.6);
  });
});

// ---------------------------------------------------------------------------
// THE test that justifies the module.
// ---------------------------------------------------------------------------
describe('cohort fragmentation collapses', () => {
  it('merges real-world spellings of one product into a single bucket', () => {
    const variants = [
      'kabel ymvk 3 x 2.5 mm2',
      'YMVK-kabel 3X2,5',          // unit omitted entirely
      'ymvk kabel 3x2.5mm² per meter',
      'Kabel YMvK 3*2,5 mm2',
      'YMvK  3x2.5MM2  kabel',
    ];
    const keys = new Set(variants.map((v) => canonicalMaterialKey({ description: v }).key));

    // Before normalisation these are 5 distinct LOWER(material_name) groups,
    // each with 1 observer — all below the k>=5 gate, so the benchmark shows
    // nothing at all. After, they are one group with 5 observers, which is
    // exactly the threshold. That is the whole argument for this module:
    // density bought without recruiting a contractor.
    expect(keys.size).toBe(1);
  });

  it('leaves the missing-noun case to the LLM tier, and says so honestly', () => {
    // "YMvK 3x2,5mm²" never says "kabel". It genuinely carries less
    // information than "kabel ymvk 3x2.5mm2", and no deterministic rule can
    // recover a word that is not there.
    //
    // It cannot be solved by subset matching either: the cohort key is a single
    // stored string that Postgres GROUP BYs on, so matching must be an
    // equivalence relation. Subset matching is not transitive (A~B, B~C, A!~C),
    // which would make the grouping ill-defined.
    //
    // So this is precisely the residual the LLM tier exists for — and whatever
    // it proposes still has to clear proposalIsAcceptable below.
    expect(mergesWith({ description: 'YMvK 3x2,5mm²' }, { description: 'kabel ymvk 3x2.5mm2' })).toBe(false);
  });

  it('drops the unit, because the benchmark view already groups by unit', () => {
    expect(canonicaliseDescription('YMvK 3x2,5mm²').key).toBe(canonicaliseDescription('YMvK 3x2,5').key);
  });

  it('does not mistake a thread size for a unit', () => {
    // "M20" is a thread spec, not 20 metres — it must survive intact.
    expect(canonicaliseDescription('wartel M20').tokens).toContain('m20');
    expect(canonicaliseDescription('wartel M20').key).not.toBe(canonicaliseDescription('wartel M25').key);
  });

  it('does NOT merge genuinely different products', () => {
    expect(mergesWith({ description: 'YMvK 3x2.5mm2' }, { description: 'YMvK 5x4mm2' })).toBe(false);
    expect(mergesWith({ description: 'YMvK kabel' }, { description: 'XMvK kabel' })).toBe(false);
    expect(mergesWith({ description: 'koperen buis 15mm' }, { description: 'koperen buis 22mm' })).toBe(false);
  });

  it('does not merge everything into the empty key', () => {
    // A pathological normaliser that strips too much would collapse unrelated
    // products together. Guard against it explicitly.
    expect(mergesWith({ description: 'per stuk' }, { description: 'aanbieding' })).toBe(false);
  });
});

describe('LLM proposals are gated, not trusted', () => {
  const sources = ['YMvK 3x2,5mm²', 'kabel ymvk 3 x 2.5 mm2'];

  it('accepts a proposal that only merges and drops', () => {
    expect(proposalIsAcceptable('ymvk kabel 3x2.5mm2', sources).ok).toBe(true);
  });

  it('rejects a proposal that invents an attribute', () => {
    // The model "helpfully" decides the cable is 4mm2 — the material-side
    // analogue of a fabricated statistic.
    const r = proposalIsAcceptable('ymvk kabel 3x4mm2', sources);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/absent from every source/);
  });

  it('rejects a proposal that invents a brand', () => {
    expect(proposalIsAcceptable('draka ymvk kabel 3x2.5mm2', sources).ok).toBe(false);
  });

  it('rejects an empty or meaningless proposal', () => {
    expect(proposalIsAcceptable('', sources).ok).toBe(false);
    expect(proposalIsAcceptable('per de het', sources).ok).toBe(false);
  });

  it('accepts a display-cased proposal because canonicalisation is idempotent', () => {
    // "YMvK Kabel 3 x 2,5 mm²" normalises to the same key as its own
    // normalisation, so it is acceptable — the caller stores the canonical form.
    expect(proposalIsAcceptable('YMvK Kabel 3 x 2,5 mm²', sources).ok).toBe(true);
  });
});
