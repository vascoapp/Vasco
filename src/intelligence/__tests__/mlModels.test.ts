// =============================================================================
// ML MODELS — Unit Tests
// =============================================================================
// Tests the three prediction models: quote win, duration, payment timing.
// Also tests model accuracy recording and calibration.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock learningStorage before importing mlModels
jest.mock('../learningStorage', () => ({
  loadProfile: jest.fn(() =>
    Promise.resolve({
      schemaVersion: 2,
      contractorId: 'test-contractor',
      insightInteractions: [],
      serviceUsageStats: {},
      dismissedPatterns: [],
      actionedPatterns: [],
      jobCompletionHistory: [],
      invoicePatterns: {
        avgDSO: 21,
        onTimeRate: 0.7,
        totalInvoices: 10,
        overdueCount: 2,
      },
      savingsProfile: {},
      metricHistory: [],
      insightsShownToday: 0,
      insightsShownDate: '',
      lastUpdated: '',
    }),
  ),
}));

import {
  predictQuoteWin,
  predictJobDuration,
  predictPaymentTiming,
  recordModelPrediction,
  getModelAccuracies,
  calibrateModels,
} from '../mlModels';

import { loadProfile } from '../learningStorage';

function clearStorage() {
  const store = (globalThis as any).__asyncStorageMock;
  if (store) Object.keys(store).forEach((k) => delete store[k]);
}

describe('mlModels', () => {
  beforeEach(() => {
    clearStorage();
    jest.clearAllMocks();
  });

  // ─── Quote Win Predictor ──────────────────────────────────────────────────

  describe('predictQuoteWin', () => {
    it('should return probability between 0 and 1', async () => {
      const result = await predictQuoteWin({ amount: 1000, trade: 'plumbing' });

      expect(result.probability).toBeGreaterThanOrEqual(0.1);
      expect(result.probability).toBeLessThanOrEqual(0.95);
    });

    it('should return confidence starting at base level with no history', async () => {
      const result = await predictQuoteWin({ amount: 1000, trade: 'plumbing' });

      // With 0 trade jobs, confidence = min(0.95, 0.3 + 0 * 0.05) = 0.3
      expect(result.confidence).toBe(0.3);
    });

    it('should include suggested price range', async () => {
      const result = await predictQuoteWin({ amount: 1000, trade: 'plumbing' });

      expect(result.suggestedPriceRange).toBeDefined();
      expect(result.suggestedPriceRange.low).toBeLessThan(result.suggestedPriceRange.high);
    });

    it('should include all factor fields', async () => {
      const result = await predictQuoteWin({ amount: 1000, trade: 'plumbing' });

      expect(result.factors).toBeDefined();
      expect(typeof result.factors.priceVsAvg).toBe('number');
      expect(typeof result.factors.customerHistory).toBe('number');
      expect(typeof result.factors.seasonality).toBe('number');
      expect(typeof result.factors.tradeAvg).toBe('number');
    });

    it('should use personalized rate when history exists', async () => {
      // Provide job history with known acceptance pattern
      (loadProfile as jest.Mock).mockResolvedValueOnce({
        jobCompletionHistory: [
          { jobType: 'plumbing', estimatedCost: 1000, marginPercent: 20, actualHours: 8, estimatedHours: 8 },
          { jobType: 'plumbing', estimatedCost: 1200, marginPercent: 15, actualHours: 10, estimatedHours: 10 },
          { jobType: 'plumbing', estimatedCost: 800, marginPercent: -5, actualHours: 6, estimatedHours: 6 },
        ],
        invoicePatterns: { avgDSO: 21, onTimeRate: 0.7, totalInvoices: 5, overdueCount: 1 },
      });

      const result = await predictQuoteWin({ amount: 1000, trade: 'plumbing' });

      // With 3 jobs, confidence = 0.3 + 3 * 0.05 = 0.45
      expect(result.confidence).toBe(0.45);
    });

    it('should provide a recommendation string', async () => {
      const result = await predictQuoteWin({ amount: 1000, trade: 'plumbing' });

      expect(typeof result.recommendation).toBe('string');
      expect(result.recommendation.length).toBeGreaterThan(0);
    });
  });

  // ─── Duration Predictor ───────────────────────────────────────────────────

  describe('predictJobDuration', () => {
    it('should return predicted hours based on estimate * default accuracy ratio', async () => {
      const result = await predictJobDuration({
        trade: 'electrical',
        estimatedHours: 10,
        materialCount: 3,
        crewSize: 1,
      });

      // Default accuracy ratio = 1.15, complexity for 3 materials = 1.0, crew 1 = 1.0
      // predicted = 10 * 1.15 * 1.0 * 1.0 = 11.5
      expect(result.predictedHours).toBe(11.5);
    });

    it('should increase estimate for high material count', async () => {
      const low = await predictJobDuration({
        trade: 'painting',
        estimatedHours: 10,
        materialCount: 3,
        crewSize: 1,
      });

      const high = await predictJobDuration({
        trade: 'painting',
        estimatedHours: 10,
        materialCount: 20,
        crewSize: 1,
      });

      expect(high.predictedHours).toBeGreaterThan(low.predictedHours);
      expect(high.factors.complexityMultiplier).toBe(1.2);
    });

    it('should apply crew efficiency for larger crews', async () => {
      const solo = await predictJobDuration({
        trade: 'plumbing',
        estimatedHours: 20,
        materialCount: 5,
        crewSize: 1,
      });

      const duo = await predictJobDuration({
        trade: 'plumbing',
        estimatedHours: 20,
        materialCount: 5,
        crewSize: 2,
      });

      // Crew of 2 has 0.85 efficiency, so total hours should be less
      expect(duo.predictedHours).toBeLessThan(solo.predictedHours);
    });

    it('should return confidence interval range', async () => {
      const result = await predictJobDuration({
        trade: 'carpentry',
        estimatedHours: 16,
        materialCount: 8,
        crewSize: 1,
      });

      expect(result.range.low).toBeLessThan(result.predictedHours);
      expect(result.range.high).toBeGreaterThan(result.predictedHours);
    });

    it('should return an accurate recommendation at the default 1.15 ratio', async () => {
      // Default accuracyRatio is 1.15 (no personal tradeJobs, no cohort).
      // Code thresholds: >1.2 = underestimate, <0.9 = overestimate, else accurate.
      // 1.15 lands in the 'accurate' band.
      const result = await predictJobDuration({
        trade: 'gas',
        estimatedHours: 8,
        materialCount: 2,
        crewSize: 1,
      });
      expect(result.recommendation).toContain('accurate');
    });
  });

  // ─── Payment Timing Predictor ─────────────────────────────────────────────

  describe('predictPaymentTiming', () => {
    it('should return predicted days based on base DSO and factors', async () => {
      const result = await predictPaymentTiming({
        amount: 1000,
        dayOfWeek: 1, // Monday
      });

      expect(result.predictedDays).toBeGreaterThan(0);
      expect(typeof result.predictedDays).toBe('number');
    });

    it('should predict faster payment for small amounts', async () => {
      const small = await predictPaymentTiming({ amount: 200, dayOfWeek: 1 });
      const large = await predictPaymentTiming({ amount: 15000, dayOfWeek: 1 });

      expect(small.predictedDays).toBeLessThan(large.predictedDays);
    });

    it('should predict faster payment for Monday invoices', async () => {
      const monday = await predictPaymentTiming({ amount: 1000, dayOfWeek: 1 });
      const sunday = await predictPaymentTiming({ amount: 1000, dayOfWeek: 0 });

      expect(monday.factors.dayOfWeekFactor).toBeLessThan(sunday.factors.dayOfWeekFactor);
    });

    it('should classify risk as low/medium/high', async () => {
      const result = await predictPaymentTiming({ amount: 1000, dayOfWeek: 1 });

      expect(['low', 'medium', 'high']).toContain(result.risk);
    });

    it('should return probability of payment within 30 and 60 days', async () => {
      const result = await predictPaymentTiming({ amount: 1000, dayOfWeek: 1 });

      expect(result.probability30d).toBeGreaterThanOrEqual(0);
      expect(result.probability30d).toBeLessThanOrEqual(1);
      expect(result.probability60d).toBeGreaterThanOrEqual(result.probability30d);
    });

    it('should include amount factor in factors', async () => {
      const small = await predictPaymentTiming({ amount: 300, dayOfWeek: 3 });
      const large = await predictPaymentTiming({ amount: 5000, dayOfWeek: 3 });

      expect(small.factors.amountFactor).toBe(0.85);
      expect(large.factors.amountFactor).toBe(1.15);
    });
  });

  // ─── Model Accuracy Tracking ──────────────────────────────────────────────

  describe('recordModelPrediction and getModelAccuracies', () => {
    it('should return default accuracies when no data', async () => {
      const accuracies = await getModelAccuracies();

      expect(accuracies).toHaveLength(3);
      expect(accuracies.map((a) => a.model)).toEqual(['quote_win', 'duration', 'payment']);
      expect(accuracies.every((a) => a.predictions === 0)).toBe(true);
    });

    it('should record a correct prediction (within threshold)', async () => {
      await recordModelPrediction('duration', 10, 10.5, 0.15);

      const accuracies = await getModelAccuracies();
      const duration = accuracies.find((a) => a.model === 'duration')!;

      expect(duration.predictions).toBe(1);
      expect(duration.correct).toBe(1);
      expect(duration.accuracy).toBe(100);
    });

    it('should record an incorrect prediction (outside threshold)', async () => {
      await recordModelPrediction('duration', 10, 15, 0.15); // 50% off

      const accuracies = await getModelAccuracies();
      const duration = accuracies.find((a) => a.model === 'duration')!;

      expect(duration.predictions).toBe(1);
      expect(duration.correct).toBe(0);
      expect(duration.accuracy).toBe(0);
    });

    it('should accumulate predictions correctly', async () => {
      await recordModelPrediction('quote_win', 0.7, 0.75, 0.15); // correct
      await recordModelPrediction('quote_win', 0.7, 0.3, 0.15);  // incorrect
      await recordModelPrediction('quote_win', 0.5, 0.55, 0.15); // correct

      const accuracies = await getModelAccuracies();
      const quoteWin = accuracies.find((a) => a.model === 'quote_win')!;

      expect(quoteWin.predictions).toBe(3);
      expect(quoteWin.correct).toBe(2);
      expect(quoteWin.accuracy).toBe(67); // Math.round(2/3 * 100)
    });
  });

  // ─── Calibration ──────────────────────────────────────────────────────────

  describe('calibrateModels', () => {
    it('should return null coefficients when insufficient data (<10 points)', async () => {
      const result = await calibrateModels();

      expect(result.durationAccuracyRatio).toBeNull();
      expect(result.personalBaseDSO).toBeNull();
      expect(result.personalAcceptanceRate).toBeNull();
    });

    it('should learn duration coefficient after 10+ predictions', async () => {
      // Record 12 duration predictions where actual is consistently 1.3x predicted
      for (let i = 0; i < 12; i++) {
        await recordModelPrediction('duration', 10, 13, 0.15);
      }

      const result = await calibrateModels();

      expect(result.durationAccuracyRatio).not.toBeNull();
      expect(result.durationAccuracyRatio).toBeCloseTo(1.3, 1);
      expect(result.dataPoints.duration).toBe(12);
    });

    it('should learn payment DSO after 10+ predictions', async () => {
      // Record 10 payment predictions with avg actual = 25 days
      for (let i = 0; i < 10; i++) {
        await recordModelPrediction('payment', 21, 25, 0.15);
      }

      const result = await calibrateModels();

      expect(result.personalBaseDSO).toBe(25);
      expect(result.dataPoints.payment).toBe(10);
    });
  });
});
