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
});
