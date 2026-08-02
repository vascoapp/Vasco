// =============================================================================
// QUOTE OPTIMIZER SERVICE — DORMANT — DO NOT EXTEND (R19 audit)
// =============================================================================
// Status as of R19: 647-LoC mock-driven optimizer, surfaced via the
// `<QuoteOptimizer />` component (1,534 LoC) which is exported but **never
// mounted** in any actual screen. Only `QuoteOptimizerDemo` mounts it,
// itself an unrouted demo function with no entry point.
//
//  - `MOCK_MARKET_DATA` (lines ~96-135): hardcoded material prices, trends.
//  - `MOCK_UPSELL_SUGGESTIONS`: 11 canned upsell objects.
//  - `analyzeQuote` returns deterministic mock data — no Supabase RPC,
//    no `cohortBenchmarkService` integration, no actual win-rate model.
//  - **The learning loop is broken**: when a contractor accepts/rejects an
//    optimization suggestion, no signal flows to a BE table, no
//    `recordPricingOutcome` call, no retrain feedback.
//  - The TieredQuoteBuilder flow (canonical quote-building UX since R148)
//    uses `cohortBenchmarkService` + `quoteWinModelService` directly —
//    it does NOT use QuoteOptimizer. So the mock here is contained but
//    the infrastructure is dead weight.
//
// To make this real:
//  1. Replace MOCK_MARKET_DATA with `cohortBenchmarkService.getMaterialBaselines`
//     (already cohort-backed, k-anonymity ≥5)
//  2. Replace MOCK_UPSELL_SUGGESTIONS with `crossSellGenerator` lookups
//     (already wired into the AI tab via R290)
//  3. Wire `recordPricingOutcome` on suggestion accept/reject to feed the
//     quote_win training pair generator
//  4. Either mount `<QuoteOptimizer />` somewhere meaningful, or delete the
//     1,534-LoC component and 647-LoC service and route quote-builder users
//     to the canonical TieredQuoteBuilder (which already has the cohort
//     benchmarks + ML-prefill via R148-R152 + R300).
//
// Recommendation: delete on next dead-code sweep — TieredQuoteBuilder is the
// canonical surface and has all of this functionality wired to real data.
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import { DEMO_MODE } from '../config/demo';

// ============================================
// TYPES
// ============================================

export interface QuoteLineItem {
  id: string;
  materialId: string;
  materialName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  laborHours?: number;
  laborRate?: number;
}

export interface QuoteOptimization {
  lineItemId: string;
  type: 'price_adjustment' | 'competitive_positioning' | 'upsell' | 'bundle' | 'margin_warning';
  title: string;
  description: string;
  impact: {
    currentValue: number;
    suggestedValue: number;
    difference: number;
    differencePercent: number;
  };
  confidence: number; // 0-1
  source: 'market_data' | 'customer_history' | 'regional_trends' | 'competitor_analysis';
  accepted?: boolean;
}

export interface MarketPriceData {
  materialId: string;
  materialName: string;
  category: string;
  regionAvgPrice: number;
  regionLowPrice: number;
  regionHighPrice: number;
  percentile: number; // Where this quote's price falls (0-100)
  trend: 'rising' | 'stable' | 'falling';
  trendPercent: number;
}

export interface CompetitorInsight {
  materialId: string;
  competitorCount: number;
  avgCompetitorPrice: number;
  yourPricePosition: 'below' | 'average' | 'above';
  priceDifferencePercent: number;
  winRate: number; // Historical win rate at this price point
}

export interface UpsellSuggestion {
  id: string;
  originalItemId: string;
  type: 'upgrade' | 'add_on' | 'bundle' | 'premium_alternative';
  productId: string;
  productName: string;
  description: string;
  priceIncrease: number;
  marginIncrease: number;
  customerAcceptanceRate: number; // Based on similar customers
  reason: string;
}

export interface QuoteAnalysis {
  quoteId: string;
  totalValue: number;
  /** null when there is no cost basis to compute a margin from. QuoteLineItem
   *  carries only sale-side fields (unitPrice/totalPrice), no cost, so this is
   *  currently always null rather than a guess. */
  estimatedMargin: number | null;
  marginPercent: number | null;
  competitiveScore: number; // 0-100, how competitive this quote is
  winProbability: number; // 0-1
  optimizations: QuoteOptimization[];
  marketData: MarketPriceData[];
  competitorInsights: CompetitorInsight[];
  upsellSuggestions: UpsellSuggestion[];
  summary: {
    potentialSavings: number;
    potentialMarginGain: number;
    suggestedAdjustments: number;
    highPriorityItems: number;
  };
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_MARKET_DATA: Record<string, MarketPriceData> = {
  'mat_dulux_white_5l': {
    materialId: 'mat_dulux_white_5l',
    materialName: 'Dulux Trade Eggshell White 5L',
    category: 'Verf',
    regionAvgPrice: 26.50,
    regionLowPrice: 23.40,
    regionHighPrice: 31.00,
    percentile: 65,
    trend: 'stable',
    trendPercent: 0,
  },
  'mat_sigma_satin': {
    materialId: 'mat_sigma_satin',
    materialName: 'Sigma S2U Allure 2.5L',
    category: 'Verf',
    regionAvgPrice: 44.00,
    regionLowPrice: 40.00,
    regionHighPrice: 52.00,
    percentile: 45,
    trend: 'rising',
    trendPercent: 5,
  },
  'mat_grohe_kraan': {
    materialId: 'mat_grohe_kraan',
    materialName: 'Grohe Eurosmart Keukenkraan',
    category: 'Sanitair',
    regionAvgPrice: 95.00,
    regionLowPrice: 85.00,
    regionHighPrice: 115.00,
    percentile: 55,
    trend: 'falling',
    trendPercent: -3,
  },
};

const DEMO_MOCK_UPSELL_SUGGESTIONS: UpsellSuggestion[] = [
  {
    id: 'upsell_1',
    originalItemId: 'item_1',
    type: 'premium_alternative',
    productId: 'mat_sikkens_rubbol',
    productName: 'Sikkens Rubbol BL Satin',
    description: 'Langere levensduur, betere dekking',
    priceIncrease: 8.50,
    marginIncrease: 4.20,
    customerAcceptanceRate: 0.35,
    reason: 'Klanten met vergelijkbare projecten kiezen vaak voor premium verf',
  },
  {
    id: 'upsell_2',
    originalItemId: 'item_2',
    type: 'add_on',
    productId: 'mat_primer_universal',
    productName: 'Universele Primer 2.5L',
    description: 'Verbetert hechting en duurzaamheid',
    priceIncrease: 18.50,
    marginIncrease: 7.40,
    customerAcceptanceRate: 0.48,
    reason: 'Gebaseerd op projecttype: nieuwbouw badkamer',
  },
  {
    id: 'upsell_3',
    originalItemId: 'item_3',
    type: 'bundle',
    productId: 'bundle_grohe_complete',
    productName: 'Grohe Complete Set (kraan + accessoires)',
    description: 'Inclusief zeeppomp en spoelbak-set',
    priceIncrease: 45.00,
    marginIncrease: 18.00,
    customerAcceptanceRate: 0.28,
    reason: 'Bundelkorting maakt dit aantrekkelijk voor de klant',
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_UPSELL_SUGGESTIONS: UpsellSuggestion[] = DEMO_MODE ? DEMO_MOCK_UPSELL_SUGGESTIONS : [];

// ============================================
// SERVICE CLASS
// ============================================

class QuoteOptimizerService {
  private analysisCache: Map<string, QuoteAnalysis> = new Map();

  // -----------------------------------------
  // Quote Analysis
  // -----------------------------------------

  /**
   * Analyze a quote and generate optimizations
   */
  analyzeQuote(quoteId: string, lineItems: QuoteLineItem[]): QuoteAnalysis {
    const optimizations: QuoteOptimization[] = [];
    const marketData: MarketPriceData[] = [];
    const competitorInsights: CompetitorInsight[] = [];

    // Analyze each line item
    lineItems.forEach((item) => {
      // Get market data
      const market = this.getMarketData(item.materialId, item.unitPrice);
      if (market) {
        marketData.push(market);

        // Generate price optimization if needed
        const priceOpt = this.generatePriceOptimization(item, market);
        if (priceOpt) optimizations.push(priceOpt);
      }

      // Get competitor insights
      const competitor = this.getCompetitorInsight(item.materialId, item.unitPrice);
      if (competitor) {
        competitorInsights.push(competitor);

        // Generate competitive positioning suggestion
        const compOpt = this.generateCompetitiveOptimization(item, competitor);
        if (compOpt) optimizations.push(compOpt);
      }

      // Margin warnings removed: checkMarginWarning derived cost as
      // `unitPrice * 0.7`, so every item scored exactly 30% and the
      // `margin < 15` branch could never be reached. It looked like a
      // safeguard while checking nothing. Restore it when line items carry
      // real cost.
    });

    // Calculate totals
    const totalValue = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    // Was `totalValue * 0.25` with a literal `marginPercent = 25`, so the
    // optimizer reported the identical "25%" margin on every quote for every
    // contractor and rendered it as fact on the summary card. QuoteLineItem has
    // no cost field -- only unitPrice/totalPrice -- so margin is not derivable
    // here at all. Report "unknown" and let the UI omit it, rather than print a
    // number that is the same for a EUR 200 repair and a EUR 40,000 renovation.
    const estimatedMargin: number | null = null;
    const marginPercent: number | null = null;

    // Calculate competitive score
    const competitiveScore = this.calculateCompetitiveScore(competitorInsights);
    const winProbability = this.calculateWinProbability(competitiveScore, marginPercent);

    // Get upsell suggestions
    const upsellSuggestions = this.getUpsellSuggestions(lineItems);

    const analysis: QuoteAnalysis = {
      quoteId,
      totalValue,
      estimatedMargin,
      marginPercent,
      competitiveScore,
      winProbability,
      optimizations,
      marketData,
      competitorInsights,
      upsellSuggestions,
      summary: {
        potentialSavings: optimizations
          .filter((o) => o.type === 'price_adjustment')
          .reduce((sum, o) => sum + Math.abs(o.impact.difference), 0),
        potentialMarginGain: upsellSuggestions.reduce((sum, u) => sum + u.marginIncrease, 0),
        suggestedAdjustments: optimizations.length,
        highPriorityItems: optimizations.filter((o) => o.confidence > 0.7).length,
      },
    };

    // Cache the analysis
    this.analysisCache.set(quoteId, analysis);

    trackUserAction('quote_analyzed', {
      quoteId,
      totalValue,
      optimizationCount: optimizations.length,
      upsellCount: upsellSuggestions.length,
    });

    return analysis;
  }

  /**
   * Get cached analysis
   */
  getCachedAnalysis(quoteId: string): QuoteAnalysis | undefined {
    return this.analysisCache.get(quoteId);
  }

  /**
   * Apply an optimization to a quote
   */
  applyOptimization(quoteId: string, optimizationId: string): void {
    const analysis = this.analysisCache.get(quoteId);
    if (!analysis) return;

    const optimization = analysis.optimizations.find(
      (o) => `${o.lineItemId}_${o.type}` === optimizationId
    );
    if (optimization) {
      optimization.accepted = true;

      trackUserAction('optimization_applied', {
        quoteId,
        optimizationType: optimization.type,
        impact: optimization.impact.difference,
      });
    }
  }

  /**
   * Reject an optimization
   */
  rejectOptimization(quoteId: string, optimizationId: string, reason?: string): void {
    const analysis = this.analysisCache.get(quoteId);
    if (!analysis) return;

    const optimization = analysis.optimizations.find(
      (o) => `${o.lineItemId}_${o.type}` === optimizationId
    );
    if (optimization) {
      optimization.accepted = false;

      trackUserAction('optimization_rejected', {
        quoteId,
        optimizationType: optimization.type,
        reason,
      });
    }
  }

  /**
   * Apply an upsell suggestion
   */
  applyUpsell(quoteId: string, upsellId: string): void {
    trackUserAction('upsell_applied', {
      quoteId,
      upsellId,
    });
  }

  // -----------------------------------------
  // Market Intelligence
  // -----------------------------------------

  /**
   * Get market data for a material
   */
  private getMarketData(materialId: string, currentPrice: number): MarketPriceData | null {
    const baseData = MOCK_MARKET_DATA[materialId];
    if (!baseData) {
      // Generate synthetic market data for unknown materials
      return {
        materialId,
        materialName: 'Onbekend materiaal',
        category: 'Overig',
        regionAvgPrice: currentPrice * 0.95,
        regionLowPrice: currentPrice * 0.85,
        regionHighPrice: currentPrice * 1.15,
        percentile: 55,
        trend: 'stable',
        trendPercent: 0,
      };
    }

    // Calculate percentile based on current price
    const range = baseData.regionHighPrice - baseData.regionLowPrice;
    const percentile = Math.round(
      ((currentPrice - baseData.regionLowPrice) / range) * 100
    );

    return {
      ...baseData,
      percentile: Math.max(0, Math.min(100, percentile)),
    };
  }

  /**
   * Get competitor insights for a material
   */
  private getCompetitorInsight(materialId: string, currentPrice: number): CompetitorInsight {
    const marketData = MOCK_MARKET_DATA[materialId];
    const avgPrice = marketData?.regionAvgPrice || currentPrice;

    const priceDiff = ((currentPrice - avgPrice) / avgPrice) * 100;
    let position: 'below' | 'average' | 'above' = 'average';
    if (priceDiff < -5) position = 'below';
    if (priceDiff > 5) position = 'above';

    // Win rate based on price position
    let winRate = 0.5;
    if (position === 'below') winRate = 0.65;
    if (position === 'above') winRate = 0.35;

    return {
      materialId,
      competitorCount: Math.floor(Math.random() * 8) + 3,
      avgCompetitorPrice: avgPrice,
      yourPricePosition: position,
      priceDifferencePercent: Math.round(priceDiff),
      winRate,
    };
  }

  // -----------------------------------------
  // Optimization Generation
  // -----------------------------------------

  private generatePriceOptimization(
    item: QuoteLineItem,
    market: MarketPriceData
  ): QuoteOptimization | null {
    // Only suggest if price is significantly different from market
    const priceDiff = item.unitPrice - market.regionAvgPrice;
    const priceDiffPercent = (priceDiff / market.regionAvgPrice) * 100;

    if (Math.abs(priceDiffPercent) < 10) return null;

    if (priceDiffPercent > 10) {
      // Price is above market
      return {
        lineItemId: item.id,
        type: 'price_adjustment',
        title: 'Prijs boven marktgemiddelde',
        description: `Je prijs ligt ${Math.round(priceDiffPercent)}% boven het regionale gemiddelde. Overweeg aanpassing voor betere kansen.`,
        impact: {
          currentValue: item.unitPrice,
          suggestedValue: market.regionAvgPrice * 1.05,
          difference: item.unitPrice - market.regionAvgPrice * 1.05,
          differencePercent: priceDiffPercent - 5,
        },
        confidence: 0.75,
        source: 'market_data',
      };
    }

    return null;
  }

  private generateCompetitiveOptimization(
    item: QuoteLineItem,
    competitor: CompetitorInsight
  ): QuoteOptimization | null {
    if (competitor.yourPricePosition === 'above' && competitor.winRate < 0.4) {
      return {
        lineItemId: item.id,
        type: 'competitive_positioning',
        title: 'Concurrentiepositie verbeteren',
        description: `Je winstpercentage op dit product is ${Math.round(competitor.winRate * 100)}%. ${competitor.competitorCount} concurrenten bieden vergelijkbare prijzen.`,
        impact: {
          currentValue: item.unitPrice,
          suggestedValue: competitor.avgCompetitorPrice,
          difference: item.unitPrice - competitor.avgCompetitorPrice,
          differencePercent: competitor.priceDifferencePercent,
        },
        confidence: 0.68,
        source: 'competitor_analysis',
      };
    }

    return null;
  }

  // -----------------------------------------
  // Upsell Suggestions
  // -----------------------------------------

  private getUpsellSuggestions(lineItems: QuoteLineItem[]): UpsellSuggestion[] {
    // In production, this would be based on ML analysis of customer data
    // For now, return filtered mock suggestions
    return MOCK_UPSELL_SUGGESTIONS.filter((suggestion) =>
      lineItems.some((item) => item.id === suggestion.originalItemId)
    ).slice(0, 3);
  }

  // -----------------------------------------
  // Scoring
  // -----------------------------------------

  private calculateCompetitiveScore(insights: CompetitorInsight[]): number {
    if (insights.length === 0) return 50;

    const avgWinRate = insights.reduce((sum, i) => sum + i.winRate, 0) / insights.length;
    return Math.round(avgWinRate * 100);
  }

  private calculateWinProbability(
    competitiveScore: number,
    marginPercent: number | null
  ): number {
    // Simple model: balance competitiveness with margin. With margin unknown
    // the factor is neutral -- previously it was fed a constant 25, which
    // always landed in the middle band and made this term a no-op anyway.
    const competitiveFactor = competitiveScore / 100;
    const marginFactor = marginPercent === null
      ? 1
      : marginPercent < 20 ? 0.8 : marginPercent > 30 ? 0.6 : 1;

    return Math.round(competitiveFactor * marginFactor * 100) / 100;
  }

  // -----------------------------------------
  // Regional Benchmarks
  // -----------------------------------------

  /**
   * Get regional pricing benchmarks for a category
   */
  getRegionalBenchmarks(category: string): {
    avgMarkup: number;
    topPerformerMarkup: number;
    marketTrend: 'rising' | 'stable' | 'falling';
    seasonalFactor: number;
  } {
    // Mock regional data
    const benchmarks: Record<string, { avgMarkup: number; trend: 'rising' | 'stable' | 'falling' }> = {
      Verf: { avgMarkup: 28, trend: 'stable' },
      Sanitair: { avgMarkup: 32, trend: 'rising' },
      Hout: { avgMarkup: 25, trend: 'falling' },
      Elektra: { avgMarkup: 35, trend: 'stable' },
    };

    const data = benchmarks[category] || { avgMarkup: 30, trend: 'stable' };

    return {
      avgMarkup: data.avgMarkup,
      topPerformerMarkup: data.avgMarkup + 8,
      marketTrend: data.trend,
      seasonalFactor: 1.0, // No seasonal adjustment in mock
    };
  }

  /**
   * Get quote performance statistics
   */
  getQuoteStatistics(): {
    quotesAnalyzed: number;
    optimizationsApplied: number;
    totalSavingsGenerated: number;
    avgWinRateImprovement: number;
  } {
    return {
      quotesAnalyzed: 47,
      optimizationsApplied: 124,
      totalSavingsGenerated: 2840,
      avgWinRateImprovement: 12,
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const quoteOptimizerService = new QuoteOptimizerService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useQuoteOptimizer(quoteId: string, lineItems: QuoteLineItem[]) {
  const [analysis, setAnalysis] = useState<QuoteAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!quoteId || lineItems.length === 0) {
      setAnalysis(null);
      return;
    }

    // Check cache first
    const cached = quoteOptimizerService.getCachedAnalysis(quoteId);
    if (cached) {
      setAnalysis(cached);
      return;
    }

    // Analyze quote
    setIsAnalyzing(true);
    // Simulate async analysis
    setTimeout(() => {
      const result = quoteOptimizerService.analyzeQuote(quoteId, lineItems);
      setAnalysis(result);
      setIsAnalyzing(false);
    }, 500);
  }, [quoteId, lineItems]);

  const applyOptimization = useCallback(
    (optimizationId: string) => {
      if (quoteId) {
        quoteOptimizerService.applyOptimization(quoteId, optimizationId);
        // Re-fetch analysis
        const updated = quoteOptimizerService.getCachedAnalysis(quoteId);
        if (updated) setAnalysis({ ...updated });
      }
    },
    [quoteId]
  );

  const rejectOptimization = useCallback(
    (optimizationId: string, reason?: string) => {
      if (quoteId) {
        quoteOptimizerService.rejectOptimization(quoteId, optimizationId, reason);
        const updated = quoteOptimizerService.getCachedAnalysis(quoteId);
        if (updated) setAnalysis({ ...updated });
      }
    },
    [quoteId]
  );

  const applyUpsell = useCallback(
    (upsellId: string) => {
      if (quoteId) {
        quoteOptimizerService.applyUpsell(quoteId, upsellId);
      }
    },
    [quoteId]
  );

  const pendingOptimizations = useMemo(
    () => analysis?.optimizations.filter((o) => o.accepted === undefined) || [],
    [analysis]
  );

  return {
    analysis,
    isAnalyzing,
    applyOptimization,
    rejectOptimization,
    applyUpsell,
    pendingOptimizations,
    statistics: quoteOptimizerService.getQuoteStatistics(),
  };
}

export function useRegionalBenchmarks(category: string) {
  return useMemo(
    () => quoteOptimizerService.getRegionalBenchmarks(category),
    [category]
  );
}
