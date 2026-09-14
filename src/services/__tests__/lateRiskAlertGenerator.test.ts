/**
 * @jest-environment node
 */

let mockPrediction: {
  predictedDays: number;
  confidence: number;
  probability30d: number;
  probability60d: number;
  risk: 'low' | 'medium' | 'high';
} | null = null;

jest.mock('../../intelligence/mlModels', () => ({
  predictPaymentTiming: jest.fn(async () => mockPrediction),
  // Mocked wholesale: an export missing here reads as undefined (learnings #312).
  PREDICTION_MIN_DISPLAY_CONFIDENCE: 0.6,
}));

jest.mock('../../i18n/i18n', () => ({
  t: (key: string, fallback?: any, _params?: any) => (typeof fallback === 'string' ? fallback : key),
}), { virtual: false });

import { generateLateRiskAlert, __internal } from '../lateRiskAlertGenerator';

const baseInput = {
  invoiceId: 'inv-789',
  customerName: 'Van der Berg Vastgoed',
  customerId: 'cust-5',
  country: 'NL',
  amount: 4200,
  customerType: 'commercial' as const,
};

beforeEach(() => {
  mockPrediction = null;
});

describe('generateLateRiskAlert', () => {
  test('returns null when prediction is absent', async () => {
    mockPrediction = null;
    expect(await generateLateRiskAlert(baseInput)).toBeNull();
  });

  test('returns null when predicted days is below threshold', async () => {
    mockPrediction = {
      predictedDays: 25, confidence: 0.8,
      probability30d: 0.6, probability60d: 0.9, risk: 'high',
    };
    expect(await generateLateRiskAlert(baseInput)).toBeNull();
  });

  test('returns null when risk is not high (even if days exceed threshold)', async () => {
    mockPrediction = {
      predictedDays: 40, confidence: 0.8,
      probability30d: 0.3, probability60d: 0.7, risk: 'medium',
    };
    expect(await generateLateRiskAlert(baseInput)).toBeNull();
  });

  test('emits a draft when both predictedDays > 30 AND risk === high', async () => {
    mockPrediction = {
      predictedDays: 42, confidence: 0.82,
      probability30d: 0.25, probability60d: 0.7, risk: 'high',
    };
    const draft = await generateLateRiskAlert(baseInput);
    expect(draft).not.toBeNull();
    expect(draft!.type).toBe('late_payment_risk_alert');
    expect(draft!.entityKey).toBe('late_risk:inv-789');
    expect(draft!.preparedData.predictedDays).toBe(42);
    expect(draft!.preparedData.risk).toBe('high');
    expect(draft!.sourceGeneratorId).toBe('lateRiskAlertGenerator');
  });

  test('days threshold is 30', () => {
    expect(__internal.DAYS_THRESHOLD).toBe(30);
  });
});

describe('generateLateRiskAlert — cold start', () => {
  // With no payment history predictPaymentTiming is a 21-day default × factors
  // at confidence 0.3. A large invoice could clear the 30-day bar on that alone
  // and be flagged "high risk" with nothing measured behind it.
  test('a high-risk prediction at cold-start confidence raises no alert', async () => {
    mockPrediction = { predictedDays: 40, confidence: 0.3, probability30d: 0.4, probability60d: 0.7, risk: 'high' };
    expect(await generateLateRiskAlert(baseInput)).toBeNull();
  });
});
