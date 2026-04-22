// =============================================================================
// ML PREDICTION MODELS — Trained on accumulated contractor data
// =============================================================================
// Layer 6 of the compound AI architecture.
// Three concrete models that improve with usage:
// 1. Quote Win Predictor — will this quote be accepted?
// 2. Job Duration Predictor — how long will this job actually take?
// 3. Payment Timing Predictor — when will this customer pay?
//
// Architecture: Simple logistic/linear regression on-device.
// As data grows, graduate to Supabase Edge Function models.
// =============================================================================

import { loadProfile, type ContractorLearningProfile, type JobOutcome } from './learningStorage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n/i18n';
import { getQuoteWinModel, scoreQuoteWin } from '../services/quoteWinModelService';
import { getCohortDso } from '../services/paymentTimingMoatService';

const MODEL_CACHE_KEY = '@vasco_ml_models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteWinPrediction {
  probability: number;        // 0-1
  confidence: number;         // 0-1 (based on sample size)
  suggestedPriceRange: { low: number; high: number };
  factors: {
    priceVsAvg: number;      // your price / avg market price
    customerHistory: number;  // past acceptance rate with this customer
    seasonality: number;      // seasonal adjustment
    tradeAvg: number;         // trade-specific acceptance rate
  };
  recommendation: string;     // Dutch recommendation
}

export interface DurationPrediction {
  predictedHours: number;
  confidence: number;
  range: { low: number; high: number }; // 80% confidence interval
  factors: {
    baseEstimate: number;
    complexityMultiplier: number;
    historicalAccuracy: number;  // how accurate past estimates were
    scopeChangeRisk: number;    // probability of scope change
  };
  recommendation: string;
}

export interface PaymentPrediction {
  predictedDays: number;      // days from invoice sent to payment
  confidence: number;
  probability30d: number;     // probability paid within 30 days
  probability60d: number;
  risk: 'low' | 'medium' | 'high';
  factors: {
    customerAvgDSO: number;
    amountFactor: number;     // larger invoices take longer
    seasonFactor: number;     // December = slow payments
    dayOfWeekFactor: number;  // invoices sent Monday get paid faster
  };
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Model 1: Quote Win Predictor
// ---------------------------------------------------------------------------

export async function predictQuoteWin(params: {
  amount: number;
  trade: string;
  country?: string;
  customerId?: string;
  customerType?: string;
  jobType?: string;
}): Promise<QuoteWinPrediction> {
  const profile = await loadProfile();
  const learned = await getLearnedCoefficients();
  const jobs = profile.jobCompletionHistory ?? [];

  // R191: Try the cohort-trained logistic regression model first. When no
  // model exists (e.g. new trade/country combo below k-anonymity), fall
  // through to the legacy heuristic below.
  const trainedProbability = await (async () => {
    if (!params.country) return null;
    try {
      const loaded = await getQuoteWinModel(params.trade, params.country);
      if (!loaded) return null;
      const { probability, confidence } = scoreQuoteWin(
        { amount: params.amount, customerType: params.customerType ?? null },
        loaded.weights,
      );
      return { probability, confidence, samples: loaded.trainingSamples, accuracy: loaded.accuracy };
    } catch {
      return null;
    }
  })();

  // Historical acceptance rate — use learned coefficient if available
  const tradeJobs = jobs.filter(j => j.jobType === params.trade || !params.trade);
  const baseRate = learned?.personalAcceptanceRate != null
    ? learned.personalAcceptanceRate
    : tradeJobs.length >= 3
      ? tradeJobs.filter(j => j.marginPercent > 0).length / tradeJobs.length
      : 0.65; // default

  // Price vs average
  const avgAmount = tradeJobs.length > 0
    ? tradeJobs.reduce((s, j) => s + j.estimatedCost, 0) / tradeJobs.length
    : params.amount;
  const priceRatio = avgAmount > 0 ? params.amount / avgAmount : 1;

  // Price sensitivity: acceptance drops if price is >20% above average
  const priceFactor = priceRatio <= 1 ? 1.1 : priceRatio <= 1.2 ? 1.0 : priceRatio <= 1.5 ? 0.8 : 0.6;

  // Seasonal factor (summer = more demand = higher acceptance)
  const month = new Date().getMonth();
  const seasonFactor = [0.9, 0.9, 0.95, 1.0, 1.05, 1.1, 1.1, 1.05, 1.0, 0.95, 0.9, 0.85][month];

  const heuristicProbability = Math.min(0.95, Math.max(0.1, baseRate * priceFactor * seasonFactor));
  const heuristicConfidence = Math.min(0.95, 0.3 + tradeJobs.length * 0.05);

  // Blend: cohort-trained model dominates when available; heuristic is the
  // safety net. We don't average — the trained model already incorporates
  // price and season signals, so averaging with the heuristic would re-weight
  // them. Instead: if trained.confidence > 0.5 use it outright; below that
  // threshold fall back to the heuristic.
  const useTrained = trainedProbability !== null && trainedProbability.confidence >= 0.5;
  const probability = useTrained ? trainedProbability!.probability : heuristicProbability;
  const confidence = useTrained ? trainedProbability!.confidence : heuristicConfidence;

  // Suggested price range for optimal acceptance
  const optimalLow = Math.round(avgAmount * 0.85);
  const optimalHigh = Math.round(avgAmount * 1.15);

  const t = i18n.t.bind(i18n);
  let recommendation: string;
  if (probability >= 0.75) recommendation = t('ml.quoteWinHigh', 'Good chance of acceptance. Price is competitive.');
  else if (probability >= 0.5) recommendation = t('ml.quoteWinMedium', 'Reasonable chance. Consider a small discount or added value.');
  else recommendation = t('ml.quoteWinLow', 'Low chance. Price is above market average. Consider adjusting.');

  return {
    probability: Math.round(probability * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    suggestedPriceRange: { low: optimalLow, high: optimalHigh },
    factors: {
      priceVsAvg: Math.round(priceRatio * 100) / 100,
      customerHistory: baseRate,
      seasonality: seasonFactor,
      tradeAvg: baseRate,
    },
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// Model 2: Job Duration Predictor
// ---------------------------------------------------------------------------

export async function predictJobDuration(params: {
  trade: string;
  estimatedHours: number;
  materialCount: number;
  crewSize: number;
}): Promise<DurationPrediction> {
  const profile = await loadProfile();
  const learned = await getLearnedCoefficients();
  const jobs = profile.jobCompletionHistory ?? [];

  // Historical accuracy for this trade — use learned coefficient if available
  const tradeJobs = jobs.filter(j => j.jobType === params.trade && j.actualHours > 0);
  const accuracyRatio = learned?.durationAccuracyRatio != null
    ? learned.durationAccuracyRatio
    : tradeJobs.length >= 3
      ? tradeJobs.reduce((s, j) => s + j.actualHours / Math.max(j.estimatedHours, 1), 0) / tradeJobs.length
      : 1.15; // contractors typically underestimate by 15%

  // Complexity multiplier based on materials
  const complexityMult = params.materialCount <= 5 ? 1.0
    : params.materialCount <= 15 ? 1.1
    : 1.2;

  // Crew size efficiency (diminishing returns beyond 2)
  const crewEfficiency = params.crewSize <= 1 ? 1.0
    : params.crewSize <= 2 ? 0.85
    : 0.75; // 3+ people = coordination overhead

  const predicted = params.estimatedHours * accuracyRatio * complexityMult * crewEfficiency;
  const confidence = Math.min(0.9, 0.3 + tradeJobs.length * 0.05);

  // Scope change risk (from historical data)
  const scopeChangeRate = tradeJobs.length >= 5
    ? tradeJobs.filter(j => j.actualHours > j.estimatedHours * 1.3).length / tradeJobs.length
    : 0.2; // default 20% chance

  const range = {
    low: Math.round(predicted * 0.8 * 10) / 10,
    high: Math.round(predicted * 1.3 * 10) / 10,
  };

  const t = i18n.t.bind(i18n);
  let recommendation: string;
  if (accuracyRatio > 1.2) recommendation = t('ml.durationUnderestimate', { defaultValue: 'You underestimate by {{pct}}% on average. Plan extra buffer.', pct: Math.round((accuracyRatio - 1) * 100) });
  else if (accuracyRatio < 0.9) recommendation = t('ml.durationOverestimate', 'You consistently overestimate. You can plan tighter.');
  else recommendation = t('ml.durationAccurate', 'Your estimates are fairly accurate. A small 10% buffer is wise.');

  return {
    predictedHours: Math.round(predicted * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    range,
    factors: {
      baseEstimate: params.estimatedHours,
      complexityMultiplier: complexityMult,
      historicalAccuracy: Math.round(accuracyRatio * 100) / 100,
      scopeChangeRisk: Math.round(scopeChangeRate * 100) / 100,
    },
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// Model 3: Payment Timing Predictor
// ---------------------------------------------------------------------------

export async function predictPaymentTiming(params: {
  customerId?: string;
  amount: number;
  dayOfWeek?: number; // 0=Sun, 1=Mon, etc.
  country?: string;         // R195: enables cohort DSO fallback
  customerType?: string;
}): Promise<PaymentPrediction> {
  const profile = await loadProfile();
  const learned = await getLearnedCoefficients();
  const { invoicePatterns } = profile;

  // R195: when the contractor has no personal invoice history, try the
  // cohort DSO for their (country, customer_type) before falling back to
  // the hardcoded 21-day default. Personal data always wins when present.
  let cohortDSO: number | null = null;
  if (!learned?.personalBaseDSO && !(invoicePatterns.avgDSO > 0) && params.country) {
    try {
      const cohort = await getCohortDso(params.country, params.customerType ?? null);
      if (cohort?.medianDso && cohort.sampleSize > 0) cohortDSO = cohort.medianDso;
    } catch {}
  }

  // Base DSO — personal learned > personal avg > cohort median > 21-day default
  const baseDSO = learned?.personalBaseDSO
    ?? (invoicePatterns.avgDSO > 0 ? invoicePatterns.avgDSO : null)
    ?? cohortDSO
    ?? 21;

  // Amount factor: larger invoices take longer
  const amountFactor = params.amount <= 500 ? 0.85
    : params.amount <= 2000 ? 1.0
    : params.amount <= 10000 ? 1.15
    : 1.3;

  // Day of week: Monday invoices get paid fastest
  const dayFactor = [1.15, 0.9, 0.95, 1.0, 1.05, 1.1, 1.2][params.dayOfWeek ?? new Date().getDay()];

  // Seasonal: December/January = slow, April = fast (VAT deadlines)
  const month = new Date().getMonth();
  const seasonFactor = [1.2, 1.1, 1.0, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.15][month];

  const predicted = Math.round(baseDSO * amountFactor * dayFactor * seasonFactor);
  const confidence = Math.min(0.9, 0.3 + (invoicePatterns.totalInvoices ?? 0) * 0.03);

  // Probability of payment within 30/60 days
  const onTimeRate = invoicePatterns.onTimeRate || 0.7;
  const prob30d = predicted <= 30 ? onTimeRate : Math.max(0.3, onTimeRate - (predicted - 30) * 0.02);
  const prob60d = Math.min(0.95, prob30d + 0.2);

  const risk: PaymentPrediction['risk'] = predicted <= 21 ? 'low' : predicted <= 35 ? 'medium' : 'high';

  const t = i18n.t.bind(i18n);
  let recommendation: string;
  if (risk === 'low') recommendation = t('ml.paymentLow', 'Payment expected within 3 weeks. No action needed.');
  else if (risk === 'medium') recommendation = t('ml.paymentMedium', 'Schedule a reminder on day 14 for faster payment.');
  else recommendation = t('ml.paymentHigh', 'High risk of late payment. Consider a deposit or shorter payment terms.');

  return {
    predictedDays: predicted,
    confidence: Math.round(confidence * 100) / 100,
    probability30d: Math.round(prob30d * 100) / 100,
    probability60d: Math.round(prob60d * 100) / 100,
    risk,
    factors: {
      customerAvgDSO: baseDSO,
      amountFactor: Math.round(amountFactor * 100) / 100,
      seasonFactor: Math.round(seasonFactor * 100) / 100,
      dayOfWeekFactor: Math.round(dayFactor * 100) / 100,
    },
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// Model accuracy tracking
// ---------------------------------------------------------------------------

export interface ModelAccuracy {
  model: 'quote_win' | 'duration' | 'payment';
  predictions: number;
  correct: number;
  accuracy: number;
  lastEvaluated: string;
}

export async function getModelAccuracies(): Promise<ModelAccuracy[]> {
  try {
    const raw = await AsyncStorage.getItem(MODEL_CACHE_KEY);
    return raw ? JSON.parse(raw) : [
      { model: 'quote_win', predictions: 0, correct: 0, accuracy: 0, lastEvaluated: '' },
      { model: 'duration', predictions: 0, correct: 0, accuracy: 0, lastEvaluated: '' },
      { model: 'payment', predictions: 0, correct: 0, accuracy: 0, lastEvaluated: '' },
    ];
  } catch {
    return [];
  }
}

export async function recordModelPrediction(
  model: 'quote_win' | 'duration' | 'payment',
  predicted: number,
  actual: number,
  threshold: number = 0.15, // 15% tolerance
): Promise<void> {
  try {
    const accuracies = await getModelAccuracies();
    const entry = accuracies.find(a => a.model === model);
    if (entry) {
      entry.predictions++;
      const error = Math.abs(predicted - actual) / Math.max(actual, 1);
      if (error <= threshold) entry.correct++;
      entry.accuracy = entry.predictions > 0 ? Math.round((entry.correct / entry.predictions) * 100) : 0;
      entry.lastEvaluated = new Date().toISOString();
    }
    await AsyncStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(accuracies));

    // Auto-calibrate: store prediction/actual pairs for coefficient learning
    await recordCalibrationPoint(model, predicted, actual);
  } catch {}
}

// ---------------------------------------------------------------------------
// Per-contractor coefficient learning
// ---------------------------------------------------------------------------
// After enough data points (10+), the models shift from industry defaults
// to personalized coefficients based on the contractor's actual patterns.
// ---------------------------------------------------------------------------

const COEFFICIENTS_KEY = '@vasco_ml_coefficients';
const CALIBRATION_KEY = '@vasco_ml_calibration';

interface CalibrationPoint {
  model: string;
  predicted: number;
  actual: number;
  timestamp: string;
}

interface LearnedCoefficients {
  // Duration model: personal accuracy ratio (replaces default 1.15)
  durationAccuracyRatio: number | null;
  // Payment model: personal base DSO (replaces profile avgDSO)
  personalBaseDSO: number | null;
  // Quote model: personal base acceptance rate
  personalAcceptanceRate: number | null;
  // How many data points each coefficient is based on
  dataPoints: { duration: number; payment: number; quote: number };
  lastCalibrated: string;
}

async function recordCalibrationPoint(model: string, predicted: number, actual: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CALIBRATION_KEY);
    const points: CalibrationPoint[] = raw ? JSON.parse(raw) : [];
    points.push({ model, predicted, actual, timestamp: new Date().toISOString() });
    // Keep last 100 points per model
    const pruned = points.slice(-300);
    await AsyncStorage.setItem(CALIBRATION_KEY, JSON.stringify(pruned));
  } catch {}
}

export async function calibrateModels(): Promise<LearnedCoefficients> {
  try {
    const raw = await AsyncStorage.getItem(CALIBRATION_KEY);
    const points: CalibrationPoint[] = raw ? JSON.parse(raw) : [];

    const durationPoints = points.filter(p => p.model === 'duration');
    const paymentPoints = points.filter(p => p.model === 'payment');
    const quotePoints = points.filter(p => p.model === 'quote_win');

    const coefficients: LearnedCoefficients = {
      durationAccuracyRatio: null,
      personalBaseDSO: null,
      personalAcceptanceRate: null,
      dataPoints: {
        duration: durationPoints.length,
        payment: paymentPoints.length,
        quote: quotePoints.length,
      },
      lastCalibrated: new Date().toISOString(),
    };

    // Need 10+ data points before personalizing
    if (durationPoints.length >= 10) {
      // Learn: on average, how far off are our predictions?
      const avgRatio = durationPoints.reduce((s, p) => s + (p.actual / Math.max(p.predicted, 0.1)), 0) / durationPoints.length;
      coefficients.durationAccuracyRatio = Math.round(avgRatio * 100) / 100;
    }

    if (paymentPoints.length >= 10) {
      const avgActual = paymentPoints.reduce((s, p) => s + p.actual, 0) / paymentPoints.length;
      coefficients.personalBaseDSO = Math.round(avgActual);
    }

    if (quotePoints.length >= 10) {
      // actual = 1 (accepted) or 0 (rejected)
      coefficients.personalAcceptanceRate = quotePoints.reduce((s, p) => s + p.actual, 0) / quotePoints.length;
    }

    await AsyncStorage.setItem(COEFFICIENTS_KEY, JSON.stringify(coefficients));
    return coefficients;
  } catch {
    return {
      durationAccuracyRatio: null,
      personalBaseDSO: null,
      personalAcceptanceRate: null,
      dataPoints: { duration: 0, payment: 0, quote: 0 },
      lastCalibrated: '',
    };
  }
}

export async function getLearnedCoefficients(): Promise<LearnedCoefficients | null> {
  try {
    const raw = await AsyncStorage.getItem(COEFFICIENTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
