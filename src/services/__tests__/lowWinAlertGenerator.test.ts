/**
 * @jest-environment node
 */

let mockPrediction: {
  probability: number;
  confidence: number;
  suggestedPriceRange: { low: number; high: number };
  recommendation: string;
} | null = null;

jest.mock('../../intelligence/mlModels', () => ({
  predictQuoteWin: jest.fn(async () => mockPrediction),
}));

jest.mock('../../i18n/i18n', () => ({
  t: (key: string, fallback?: any, _params?: any) => (typeof fallback === 'string' ? fallback : key),
}), { virtual: false });

import { generateLowWinAlert, __internal } from '../lowWinAlertGenerator';

const baseInput = {
  quoteId: 'q-123',
  customerName: 'Fam. de Vries',
  trade: 'plumbing',
  country: 'NL',
  amount: 2500,
  customerType: 'residential' as const,
};

beforeEach(() => {
  mockPrediction = null;
});

describe('generateLowWinAlert', () => {
  test('returns null when no prediction is available', async () => {
    mockPrediction = null;
    expect(await generateLowWinAlert(baseInput)).toBeNull();
  });

  test('returns null when probability is above threshold', async () => {
    mockPrediction = {
      probability: 0.7, confidence: 0.8,
      suggestedPriceRange: { low: 2000, high: 3000 },
      recommendation: 'ok',
    };
    expect(await generateLowWinAlert(baseInput)).toBeNull();
  });

  test('returns null when confidence is below threshold', async () => {
    mockPrediction = {
      probability: 0.2, confidence: 0.4,
      suggestedPriceRange: { low: 2000, high: 3000 },
      recommendation: 'low',
    };
    expect(await generateLowWinAlert(baseInput)).toBeNull();
  });

  test('emits a draft when prob is low AND confidence is high', async () => {
    mockPrediction = {
      probability: 0.25, confidence: 0.7,
      suggestedPriceRange: { low: 2000, high: 3000 },
      recommendation: 'consider discount',
    };
    const draft = await generateLowWinAlert(baseInput);
    expect(draft).not.toBeNull();
    expect(draft!.type).toBe('low_win_alert');
    expect(draft!.entityKey).toBe('low_win:q-123');
    expect(draft!.preparedData.probability).toBeCloseTo(0.25, 5);
    expect(draft!.preparedData.quoteId).toBe('q-123');
    expect(draft!.sourceGeneratorId).toBe('lowWinAlertGenerator');
  });

  test('threshold constants are coherent', () => {
    expect(__internal.WIN_PROB_THRESHOLD).toBeGreaterThan(0);
    expect(__internal.WIN_PROB_THRESHOLD).toBeLessThan(0.5);
    expect(__internal.MIN_CONFIDENCE).toBeGreaterThanOrEqual(0.5);
  });
});
