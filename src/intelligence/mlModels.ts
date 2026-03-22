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
  customerId?: string;
  jobType?: string;
}): Promise<QuoteWinPrediction> {
  const profile = await loadProfile();
  const jobs = profile.jobCompletionHistory ?? [];

  // Historical acceptance rate
  const tradeJobs = jobs.filter(j => j.jobType === params.trade || !params.trade);
  const baseRate = tradeJobs.length >= 3
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

  const probability = Math.min(0.95, Math.max(0.1, baseRate * priceFactor * seasonFactor));
  const confidence = Math.min(0.95, 0.3 + tradeJobs.length * 0.05);

  // Suggested price range for optimal acceptance
  const optimalLow = Math.round(avgAmount * 0.85);
  const optimalHigh = Math.round(avgAmount * 1.15);

  let recommendation: string;
  if (probability >= 0.75) recommendation = 'Goede kans op acceptatie. Prijs ligt in de markt.';
  else if (probability >= 0.5) recommendation = 'Redelijke kans. Overweeg een kleine korting of extra waarde.';
  else recommendation = 'Lage kans. De prijs ligt boven marktgemiddelde. Overweeg aanpassing.';

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
  const jobs = profile.jobCompletionHistory ?? [];

  // Historical accuracy for this trade
  const tradeJobs = jobs.filter(j => j.jobType === params.trade && j.actualHours > 0);
  const accuracyRatio = tradeJobs.length >= 3
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

  let recommendation: string;
  if (accuracyRatio > 1.2) recommendation = `Je schat gemiddeld ${Math.round((accuracyRatio - 1) * 100)}% te laag. Plan extra buffer in.`;
  else if (accuracyRatio < 0.9) recommendation = 'Je overschat consistent. Je kunt strakker plannen.';
  else recommendation = 'Je schattingen zijn redelijk accuraat. Kleine buffer van 10% is verstandig.';

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
}): Promise<PaymentPrediction> {
  const profile = await loadProfile();
  const { invoicePatterns } = profile;

  // Base DSO
  const baseDSO = invoicePatterns.avgDSO || 21;

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

  let recommendation: string;
  if (risk === 'low') recommendation = 'Betaling verwacht binnen 3 weken. Geen actie nodig.';
  else if (risk === 'medium') recommendation = 'Plan een herinnering op dag 14 voor snellere betaling.';
  else recommendation = 'Hoog risico op late betaling. Overweeg aanbetaling of kortere betalingstermijn.';

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
  } catch {}
}
