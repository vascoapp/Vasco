// =============================================================================
// QUOTE OPTIMIZER — market data provenance
// =============================================================================
// The optimizer tells a contractor whether they are priced above or below the
// market. That claim is only meaningful against OTHER contractors' prices.
//
// Two ways it previously became circular:
//   1. `regionAvgPrice = currentPrice * 0.95` for unmatched materials, so "the
//      market" was defined as 95% of what they charge.
//   2. cohortBenchmarkService falls back to benchmarks computed from the
//      contractor's own scan history when the cloud has nothing. Those carry
//      `source: 'own'` and must never back a market comparison.
// =============================================================================

// jest.setup stubs this module; the point of these tests is the real
// canonical-matching in findBenchmark, so use the genuine implementation.
jest.unmock('../cohortBenchmarkService');

import { quoteOptimizerService } from '../quoteOptimizerService';
import type { MaterialBenchmark } from '../cohortBenchmarkService';

const LINE = {
  id: 'li_1',
  materialId: 'mat_unknown_xyz',
  materialName: 'Gipsplaat 12.5mm',
  category: 'Bouw',
  quantity: 10,
  unitPrice: 20,
  totalPrice: 200,
};

function benchmark(over: Partial<MaterialBenchmark> = {}): MaterialBenchmark {
  return {
    materialName: 'gipsplaat 12.5mm',
    category: 'Bouw',
    trade: 'general',
    country: 'NL',
    avgPrice: 10,
    medianPrice: 10,
    p25: 8,
    p75: 12,
    minPrice: 7,
    maxPrice: 15,
    priceChange30d: 0,
    priceChange90d: 0,
    trend: 'stable',
    volatility: 0,
    sampleSize: 8,
    lastUpdated: new Date().toISOString(),
    source: 'cohort',
    ...over,
  };
}

// Each case uses its own quoteId, so the service's analysis cache never
// collides between them and there is nothing to reset.
describe('quote optimizer market data provenance', () => {
  it('produces no market data without benchmarks', () => {
    const a = quoteOptimizerService.analyzeQuote('q1', [LINE], []);
    // No synthetic band derived from the contractor's own price.
    expect(a.marketData).toHaveLength(0);
    expect(a.competitorInsights).toHaveLength(0);
  });

  it('ignores benchmarks computed from the contractor\'s own history', () => {
    const a = quoteOptimizerService.analyzeQuote('q2', [LINE], [
      benchmark({ source: 'own', sampleSize: 40 }),
    ]);
    expect(a.marketData).toHaveLength(0);
    expect(a.competitorInsights).toHaveLength(0);
  });

  it('ignores cohort rows below the k-anonymity threshold', () => {
    const a = quoteOptimizerService.analyzeQuote('q3', [LINE], [
      benchmark({ sampleSize: 4 }),
    ]);
    expect(a.marketData).toHaveLength(0);
  });

  it('uses a real cohort band, and never reports the contractor at their own price', () => {
    const a = quoteOptimizerService.analyzeQuote('q4', [LINE], [benchmark()]);

    expect(a.marketData).toHaveLength(1);
    const md = a.marketData[0];
    // Band comes from the cohort (median/p25/p75), not from LINE.unitPrice.
    expect(md.regionAvgPrice).toBe(10);
    expect(md.regionLowPrice).toBe(8);
    expect(md.regionHighPrice).toBe(12);
    expect(md.regionAvgPrice).not.toBeCloseTo(LINE.unitPrice * 0.95);

    // 20 against a 8-12 band is above market, and must be reported as such --
    // the old fallback could only ever say "~5% above" regardless of the gap.
    expect(a.competitorInsights[0].yourPricePosition).toBe('above');
    expect(a.competitorInsights[0].priceDifferencePercent).toBe(100);
  });

  it('matches a benchmark stored under a different spelling', () => {
    const a = quoteOptimizerService.analyzeQuote('q5', [LINE], [
      benchmark({ materialName: 'gipsplaat 12,5 mm' }),
    ]);
    expect(a.marketData).toHaveLength(1);
  });
});
