// =============================================================================
// BUDGET ENRICHMENT — DEMO GATE
// =============================================================================
// The market-rate table is invented data whose `sources` name real Dutch
// organisations (Cobouw, NVTB, Bouwkosten Kompas) with made-up prices and
// reliability scores, and the budget optimizer renders those names as the
// basis for a savings recommendation. It must never reach a production build.
//
// jest.setup leaves __DEV__ true, so the default posture here is the demo one.
// Each posture is loaded in its own isolated module registry because the gate
// is applied to a module-level constant and evaluated once at import.
// =============================================================================

const LINE = {
  description: 'Sloopwerk begane grond',
  unitRate: 55,
  quantity: 100,
  unit: 'm²',
  total: 5500,
  confidence: 0.9,
} as any;

function cohortBenchmark(over: Record<string, unknown> = {}) {
  return {
    materialName: 'sloopwerk',
    category: 'Bouw',
    trade: 'general',
    country: 'NL',
    avgPrice: 40,
    medianPrice: 40,
    p25: 34,
    p75: 46,
    minPrice: 30,
    maxPrice: 50,
    priceChange30d: 0,
    priceChange90d: 0,
    trend: 'stable',
    volatility: 0,
    sampleSize: 12,
    lastUpdated: '2026-07-01T00:00:00.000Z',
    source: 'cohort',
    ...over,
  } as any;
}

function loadWith(demoMode: boolean) {
  let mod: typeof import('../budgetEnrichmentService');
  jest.isolateModules(() => {
    jest.doMock('../../config/demo', () => ({ DEMO_MODE: demoMode }));
    mod = require('../budgetEnrichmentService');
  });
  return mod!;
}

afterEach(() => {
  jest.dontMock('../../config/demo');
});

describe('budgetEnrichmentService market-rate demo gate', () => {
  it('serves no market rates in a production build', () => {
    const { fuzzyMatchMaterial, enrichBudgetLine } = loadWith(false);

    // Nothing to match against, so no line can be enriched.
    expect(fuzzyMatchMaterial('Sloopwerk begane grond')).toBeNull();

    const enriched = enrichBudgetLine(LINE);
    expect(enriched.marketData).toBeNull();
    expect(enriched.savingsPotential).toBeNull();
    // The "no market data available" path zeroes confidence, which is what
    // makes the dashboard hide the market column rather than render blanks.
    expect(enriched.confidence).toBe(0);
  });

  it('never leaks a named third-party source into a production build', () => {
    const { enrichBudgetLines } = loadWith(false);
    const enriched = enrichBudgetLines([
      LINE,
      { ...LINE, description: 'Asbestverwijdering dak' },
      { ...LINE, description: 'CV-ketel vervangen' },
    ]);
    for (const line of enriched) {
      expect(line.marketData?.sources ?? []).toHaveLength(0);
    }
  });

  it('still enriches in a demo build, so the demo keeps working', () => {
    const { fuzzyMatchMaterial, enrichBudgetLine } = loadWith(true);

    expect(fuzzyMatchMaterial('Sloopwerk begane grond')).toBe('sloopwerk');

    const enriched = enrichBudgetLine(LINE);
    expect(enriched.marketData).not.toBeNull();
    expect(enriched.marketData!.sources.length).toBeGreaterThan(0);
  });

  // ── Real cohort data ──────────────────────────────────────────────────────
  // Gating the demo table left production with nothing to enrich against. The
  // cross-contractor cohort is the real source; these pin which rows qualify.
  describe('cohort enrichment', () => {
    it('enriches from a real cohort benchmark in production', () => {
      const { enrichBudgetLine } = loadWith(false);
      const enriched = enrichBudgetLine(LINE, [cohortBenchmark()]);

      expect(enriched.marketData).not.toBeNull();
      expect(enriched.marketData!.marketAvg).toBe(40);
      expect(enriched.marketData!.marketLow).toBe(34);
      expect(enriched.marketData!.marketHigh).toBe(46);
      // One honest provenance, not three invented providers.
      expect(enriched.marketData!.sources).toHaveLength(1);
      expect(enriched.marketData!.sources[0].name).toBe('Vasco cohort');
      // 12 observations -> 0.6 reliability, and the demo-only source-count
      // divisor must not scale a cohort rate down to a third of that.
      expect(enriched.marketData!.confidence).toBeCloseTo(0.6, 2);
    });

    it('refuses benchmarks derived from the contractor\'s own history', () => {
      const { enrichBudgetLine } = loadWith(false);
      const enriched = enrichBudgetLine(LINE, [
        cohortBenchmark({ source: 'own', sampleSize: 50 }),
      ]);
      // Comparing a budget line to the contractor's own past prices and calling
      // the gap a market saving is circular.
      expect(enriched.marketData).toBeNull();
      expect(enriched.confidence).toBe(0);
    });

    it('matches a benchmark name embedded in a free-text budget line', () => {
      const { enrichBudgetLine } = loadWith(false);
      // "sloopwerk" is a whole token inside "Sloopwerk begane grond".
      const enriched = enrichBudgetLine(LINE, [cohortBenchmark()]);
      expect(enriched.marketData).not.toBeNull();
    });

    it('does not match on a substring of a different material', () => {
      const { enrichBudgetLine } = loadWith(false);
      // "verf" is a substring of "verfafbijt" but not one of its tokens --
      // a different product at a different price.
      const enriched = enrichBudgetLine(
        { ...LINE, description: 'Verfafbijt gevel' },
        [cohortBenchmark({ materialName: 'verf' })],
      );
      expect(enriched.marketData).toBeNull();
    });

    it('does not match on a short generic token alone', () => {
      const { enrichBudgetLine } = loadWith(false);
      const enriched = enrichBudgetLine(
        { ...LINE, description: 'Sloopwerk 40 uur' },
        [cohortBenchmark({ materialName: 'uur' })],
      );
      expect(enriched.marketData).toBeNull();
    });

    it('prefers the more specific benchmark when both match', () => {
      const { enrichBudgetLine } = loadWith(false);
      const enriched = enrichBudgetLine(
        { ...LINE, description: 'Vervangen cv ketel woonkamer' },
        [
          cohortBenchmark({ materialName: 'ketel', medianPrice: 900, p25: 800, p75: 1000 }),
          cohortBenchmark({ materialName: 'cv ketel', medianPrice: 1400, p25: 1200, p75: 1600 }),
        ],
      );
      expect(enriched.marketData!.marketAvg).toBe(1400);
    });

    it('refuses cohort rows below the k-anonymity threshold', () => {
      const { enrichBudgetLine } = loadWith(false);
      const enriched = enrichBudgetLine(LINE, [cohortBenchmark({ sampleSize: 4 })]);
      expect(enriched.marketData).toBeNull();
    });
  });
});
