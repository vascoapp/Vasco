// =============================================================================
// VASCO INTELLIGENCE ENGINE
// =============================================================================
// The brain that processes data events, updates knowledge graph, and generates
// AI-powered recommendations. This creates the agentic moat through learning.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  DataEvent,
  DataEventType,
  EventContext,
  Entity,
  EntityRef,
  EntityType,
  TrainingExample,
  AIModelType,
  ModelPrediction,
  ContractorProfile,
  MarketIntelligence,
} from './dataSchema';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  insertEvent as dbInsertEvent,
  updateEventOutcome as dbUpdateEventOutcome,
  upsertEntity as dbUpsertEntity,
  findEntitiesByType as dbFindEntitiesByType,
  getEntityById as dbGetEntityById,
  saveFeedbackObservations,
  loadAllFeedbackWeights,
  insertPrediction as dbInsertPrediction,
  insertTrainingExample as dbInsertTrainingExample,
} from '../lib/intelligenceDataProvider';
import { logWarn, logInfo } from '../utils/errorHandler';
import { getCurrentUserId as _resolveUserId } from '../lib/currentUser';
import { MS_PER_DAY } from '../utils/timeConstants';
import { formatMoney } from '../i18n/formatting';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Types (FeedbackObservation, FeedbackWeights, IntelligenceAPI)
// ═══════════════════════════════════════════════════════════════════════════════

export interface FeedbackObservation {
  timestamp: string;   // ISO date
  value: number;       // 1 = accepted/positive, 0 = rejected/negative, or ratio value
}

// Feedback weights — persisted learned data (v2: observation arrays)

export interface FeedbackWeights {
  version: number;  // 2 = observation-based
  quoteAcceptance: {
    byBracket: Record<string, FeedbackObservation[]>;
    byCustomerType: Record<string, FeedbackObservation[]>;
  };
  jobDuration: {
    byCategory: Record<string, FeedbackObservation[]>;  // value = actual/estimated ratio
  };
  paymentTiming: {
    bySegment: Record<string, FeedbackObservation[]>;   // value = payment days
  };
  lastUpdated: string;
}

// Legacy format for migration
interface LegacyFeedbackWeights {
  version?: undefined;
  quoteAcceptance: {
    byBracket: Record<string, { accepted: number; total: number }>;
    byCustomerType: Record<string, { accepted: number; total: number }>;
  };
  jobDuration: {
    byCategory: Record<string, { totalRatio: number; count: number }>;
  };
  paymentTiming: {
    bySegment: Record<string, { totalDays: number; count: number }>;
  };
  lastUpdated: string;
}

const FEEDBACK_WEIGHTS_KEY = '@vasco_feedback_weights';
const MAX_OBSERVATIONS_PER_KEY = 100;
const FEEDBACK_DECAY_HALF_LIFE_DAYS = 60;
const FEEDBACK_DECAY = Math.LN2 / FEEDBACK_DECAY_HALF_LIFE_DAYS;

function createDefaultWeights(): FeedbackWeights {
  return {
    version: 2,
    quoteAcceptance: { byBracket: {}, byCustomerType: {} },
    jobDuration: { byCategory: {} },
    paymentTiming: { bySegment: {} },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Migrate v1 counter-based weights to v2 observation arrays.
 * Spreads old observations uniformly over the past 90 days.
 */
function migrateFeedbackWeightsV1ToV2(legacy: LegacyFeedbackWeights): FeedbackWeights {
  const now = Date.now();
  const SPREAD_DAYS = 90;

  function spreadCounters(accepted: number, total: number): FeedbackObservation[] {
    const observations: FeedbackObservation[] = [];
    for (let i = 0; i < total && i < MAX_OBSERVATIONS_PER_KEY; i++) {
      const ageMs = ((total - i) / total) * SPREAD_DAYS * MS_PER_DAY;
      observations.push({
        timestamp: new Date(now - ageMs).toISOString(),
        value: i < accepted ? 1 : 0,
      });
    }
    return observations;
  }

  function spreadRatios(totalRatio: number, count: number): FeedbackObservation[] {
    if (count === 0) return [];
    const avgRatio = totalRatio / count;
    const observations: FeedbackObservation[] = [];
    for (let i = 0; i < count && i < MAX_OBSERVATIONS_PER_KEY; i++) {
      const ageMs = ((count - i) / count) * SPREAD_DAYS * MS_PER_DAY;
      observations.push({
        timestamp: new Date(now - ageMs).toISOString(),
        value: avgRatio,
      });
    }
    return observations;
  }

  function spreadDays(totalDays: number, count: number): FeedbackObservation[] {
    if (count === 0) return [];
    const avgDays = totalDays / count;
    const observations: FeedbackObservation[] = [];
    for (let i = 0; i < count && i < MAX_OBSERVATIONS_PER_KEY; i++) {
      const ageMs = ((count - i) / count) * SPREAD_DAYS * MS_PER_DAY;
      observations.push({
        timestamp: new Date(now - ageMs).toISOString(),
        value: avgDays,
      });
    }
    return observations;
  }

  const weights: FeedbackWeights = {
    version: 2,
    quoteAcceptance: { byBracket: {}, byCustomerType: {} },
    jobDuration: { byCategory: {} },
    paymentTiming: { bySegment: {} },
    lastUpdated: new Date().toISOString(),
  };

  for (const [key, data] of Object.entries(legacy.quoteAcceptance.byBracket)) {
    weights.quoteAcceptance.byBracket[key] = spreadCounters(data.accepted, data.total);
  }
  for (const [key, data] of Object.entries(legacy.quoteAcceptance.byCustomerType)) {
    weights.quoteAcceptance.byCustomerType[key] = spreadCounters(data.accepted, data.total);
  }
  for (const [key, data] of Object.entries(legacy.jobDuration.byCategory)) {
    weights.jobDuration.byCategory[key] = spreadRatios(data.totalRatio, data.count);
  }
  for (const [key, data] of Object.entries(legacy.paymentTiming.bySegment)) {
    weights.paymentTiming.bySegment[key] = spreadDays(data.totalDays, data.count);
  }

  return weights;
}

/**
 * Compute time-decayed rate from observation array.
 * Returns { rate, effectiveN } where effectiveN is the sum of decay weights.
 */
export function getDecayedRate(
  observations: FeedbackObservation[],
  now: number = Date.now(),
): { rate: number; effectiveN: number } {
  if (observations.length === 0) return { rate: 0, effectiveN: 0 };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const obs of observations) {
    const ageMs = now - new Date(obs.timestamp).getTime();
    const ageDays = Math.max(0, ageMs / MS_PER_DAY);
    const weight = Math.exp(-FEEDBACK_DECAY * ageDays);
    weightedSum += obs.value * weight;
    totalWeight += weight;
  }

  if (totalWeight < 0.01) return { rate: 0, effectiveN: 0 };
  return { rate: weightedSum / totalWeight, effectiveN: totalWeight };
}

/**
 * Confidence interval that narrows with more data (classic statistical shrinkage).
 * Width = max(minWidth, baseWidth / sqrt(effectiveN))
 * Asymmetric upper bound (1.3x) since construction jobs overrun more than underrun.
 */
export function confidenceInterval(
  estimate: number,
  effectiveN: number,
  baseWidth: number = 0.4,
  minWidth: number = 0.08,
): { lower: number; upper: number; width: number; certaintyLevel: string } {
  const width = Math.max(minWidth, baseWidth / Math.sqrt(Math.max(1, effectiveN)));
  const lower = estimate * (1 - width);
  const upper = estimate * (1 + width * 1.3); // asymmetric: overruns more likely

  // Dutch certainty description based on width
  const certaintyLevel = width <= 0.1
    ? 'Hoge zekerheid — voldoende data'
    : width <= 0.2
      ? 'Redelijke zekerheid — meer data verbetert voorspelling'
      : 'Lage zekerheid — voorspelling wordt beter met meer klussen';

  return { lower, upper, width, certaintyLevel };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Feature Analysis (decayed rates, confidence intervals, migration)
// ═══════════════════════════════════════════════════════════════════════════════

/** Push observation and trim to max cap */
function pushObservation(arr: FeedbackObservation[], obs: FeedbackObservation): FeedbackObservation[] {
  arr.push(obs);
  if (arr.length > MAX_OBSERVATIONS_PER_KEY) {
    // Trim oldest
    arr.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return arr.slice(-MAX_OBSERVATIONS_PER_KEY);
  }
  return arr;
}

async function loadFeedbackWeights(): Promise<FeedbackWeights> {
  try {
    const raw = await AsyncStorage.getItem(FEEDBACK_WEIGHTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate v1 → v2 if needed
      if (!parsed.version || parsed.version < 2) {
        const migrated = migrateFeedbackWeightsV1ToV2(parsed as LegacyFeedbackWeights);
        await saveFeedbackWeights(migrated);
        return migrated;
      }
      return parsed as FeedbackWeights;
    }
  } catch {
    // Silent
  }
  return createDefaultWeights();
}

async function saveFeedbackWeights(weights: FeedbackWeights): Promise<void> {
  try {
    weights.lastUpdated = new Date().toISOString();
    await AsyncStorage.setItem(FEEDBACK_WEIGHTS_KEY, JSON.stringify(weights));

    // Sync to Supabase (fire-and-forget)
    if (isSupabaseConfigured) {
      const syncTasks: Promise<void>[] = [];
      for (const [key, obs] of Object.entries(weights.quoteAcceptance.byBracket)) {
        syncTasks.push(saveFeedbackObservations('quote_acceptance_bracket', key, obs));
      }
      for (const [key, obs] of Object.entries(weights.quoteAcceptance.byCustomerType)) {
        syncTasks.push(saveFeedbackObservations('quote_acceptance_customer', key, obs));
      }
      for (const [key, obs] of Object.entries(weights.jobDuration.byCategory)) {
        syncTasks.push(saveFeedbackObservations('job_duration_category', key, obs));
      }
      for (const [key, obs] of Object.entries(weights.paymentTiming.bySegment)) {
        syncTasks.push(saveFeedbackObservations('payment_timing_segment', key, obs));
      }
      Promise.all(syncTasks).catch((err) =>
        logWarn('Intelligence', `Feedback sync failed: ${err}`)
      );
    }
  } catch {
    // Silent
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Intelligence API Interface & Recommendation Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceAPI {
  // Data capture
  trackEvent(event: Omit<DataEvent, 'id' | 'timestamp' | 'embeddingId'>): Promise<string>;

  // Entity resolution
  resolveEntity(name: string, type: EntityType, context?: Record<string, unknown>): Promise<EntityRef>;
  getEntity(id: string): Promise<Entity | null>;
  findSimilarEntities(entityId: string, limit?: number): Promise<EntityRef[]>;

  // Predictions
  predict(modelType: AIModelType, input: Record<string, unknown>): Promise<ModelPrediction>;

  // Recommendations
  getRecommendations(userId: string, context: string): Promise<Recommendation[]>;

  // Market intelligence
  getMarketIntelligence(region: string, trade: string): Promise<MarketIntelligence>;

  // Learning
  recordOutcome(eventId: string, outcome: DataEvent['outcome']): Promise<void>;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';

  // Action
  actionLabel: string;
  actionRoute?: string;
  actionPayload?: Record<string, unknown>;

  // Evidence
  reasoning: string[];
  dataPoints: number;

  // Timing
  urgency: 'immediate' | 'today' | 'this-week' | 'when-convenient';
  expiresAt?: string;
}

export type RecommendationType =
  // Pricing
  | 'price_adjustment'
  | 'tier_recommendation'
  | 'discount_opportunity'

  // Materials
  | 'buy_now'
  | 'wait_to_buy'
  | 'bulk_opportunity'
  | 'switch_supplier'

  // Customers
  | 'follow_up'
  | 'send_reminder'
  | 'upsell_opportunity'
  | 'churn_risk'

  // Operations
  | 'schedule_optimization'
  | 'resource_alert'
  | 'efficiency_tip'

  // Business
  | 'revenue_opportunity'
  | 'cost_saving'
  | 'market_insight';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Event Processing (trackEvent, resolveEntity, entity cache)
// ═══════════════════════════════════════════════════════════════════════════════

class VascoIntelligenceEngine implements IntelligenceAPI {
  private eventQueue: DataEvent[] = [];
  private entityCache: Map<string, Entity> = new Map();

  // Track event and return ID
  async trackEvent(event: Omit<DataEvent, 'id' | 'timestamp' | 'embeddingId'>): Promise<string> {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullEvent: DataEvent = {
      ...event,
      id,
      timestamp: new Date().toISOString(),
    };

    // Queue for batch processing
    this.eventQueue.push(fullEvent);

    // Persist to Supabase (fire-and-forget)
    if (isSupabaseConfigured) {
      dbInsertEvent({
        event_type: fullEvent.eventType,
        session_id: fullEvent.sessionId,
        context: fullEvent.context as unknown as Record<string, unknown>,
        payload: fullEvent.payload,
        entities: fullEvent.entities,
      }).catch((err) => logWarn('Intelligence', `Event persist failed: ${err}`));
    }

    logInfo('Intelligence', `Event tracked: ${fullEvent.eventType}`);

    // Process feedback loops
    await this.processFeedbackLoops(fullEvent);

    return id;
  }

  // Resolve entity from name/context using Levenshtein similarity
  async resolveEntity(
    name: string,
    type: EntityType,
    context?: Record<string, unknown>
  ): Promise<EntityRef> {
    // Search existing entities for a close match
    const candidates = Array.from(this.entityCache.values())
      .filter(e => e.type === type);

    let bestMatch: Entity | null = null;
    let bestSimilarity = 0;

    for (const candidate of candidates) {
      const similarity = this.stringSimilarity(name.toLowerCase(), candidate.name.toLowerCase());
      if (similarity > bestSimilarity && similarity > 0.7) {
        bestMatch = candidate;
        bestSimilarity = similarity;
      }
    }

    if (bestMatch) {
      return {
        id: bestMatch.id,
        type,
        name: bestMatch.name,
        confidence: bestSimilarity,
      };
    }

    // No match — create new entity
    const id = `${type}_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const now = new Date().toISOString();
    const newEntity: Entity = {
      id,
      type,
      name,
      aliases: [],
      attributes: context || {},
      relationships: [],
      history: [],
      stats: { totalInteractions: 0, lastInteraction: now },
      confidence: 1.0,
      sources: ['entity-resolution'],
      createdAt: now,
      updatedAt: now,
    };
    this.entityCache.set(id, newEntity);

    // Persist to Supabase
    if (isSupabaseConfigured) {
      dbUpsertEntity({
        entity_type: type,
        name,
        aliases: [],
        attributes: context || {},
        stats: { totalInteractions: 0, lastInteraction: now },
        confidence: 1.0,
        sources: ['entity-resolution'],
      }).catch((err) => logWarn('Intelligence', `Entity persist failed: ${err}`));
    }

    return {
      id,
      type,
      name,
      confidence: 1.0,
    };
  }

  async getEntity(id: string): Promise<Entity | null> {
    return this.entityCache.get(id) || null;
  }

  async findSimilarEntities(entityId: string, limit = 5): Promise<EntityRef[]> {
    const entity = this.entityCache.get(entityId);
    if (!entity) return [];

    const candidates = Array.from(this.entityCache.values())
      .filter(e => e.id !== entityId && e.type === entity.type)
      .map(e => ({
        entity: e,
        similarity: this.stringSimilarity(entity.name.toLowerCase(), e.name.toLowerCase()),
      }))
      .filter(c => c.similarity > 0.4)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return candidates.map(c => ({
      id: c.entity.id,
      type: c.entity.type,
      name: c.entity.name,
      confidence: c.similarity,
    }));
  }

  // Levenshtein distance-based string similarity (0-1, 1 = identical)
  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[a.length][b.length];
    return 1 - distance / Math.max(a.length, b.length);
  }

  // Make prediction using trained model
  async predict(modelType: AIModelType, input: Record<string, unknown>): Promise<ModelPrediction> {
    const prediction = await this.runModel(modelType, input);

    // Track prediction for accuracy measurement
    await this.trackEvent({
      eventType: 'ai_prediction_made',
      userId: (input.userId as string) || 'system',
      sessionId: (input.sessionId as string) || 'system',
      context: this.createContext(),
      payload: { modelType, input, prediction },
      entities: [],
    });

    return prediction;
  }

  private async runModel(modelType: AIModelType, input: Record<string, unknown>): Promise<ModelPrediction> {
    // Learned models load FeedbackWeights from AsyncStorage
    switch (modelType) {
      case 'quote_acceptance':
        return this.predictQuoteAcceptance(input);
      case 'quote_pricing':
        return this.predictQuotePricing(input);
      case 'tier_selection':
        return this.predictTierSelection(input);
      case 'job_duration':
        return this.predictJobDuration(input);
      case 'material_demand':
        return this.predictMaterialDemand(input);
      case 'payment_timing':
        return this.predictPaymentTiming(input);
      default:
        return {
          id: `pred_${Date.now()}`,
          modelType,
          modelVersion: '2.0.0',
          timestamp: new Date().toISOString(),
          input,
          prediction: null,
          confidence: 0,
        };
    }
  }

  // Get AI recommendations for user
  async getRecommendations(userId: string, context: string): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Analyze user's data patterns and generate recommendations
    // In real implementation: Run multiple models and rank results

    // Example: Material purchase timing
    recommendations.push({
      id: 'rec_1',
      type: 'buy_now',
      title: 'Dulux Trade on Sale',
      description: 'Dulux Trade Eggshell is 18% below your average purchase price at Bouwmaat.',
      confidence: 0.87,
      impact: 'medium',
      actionLabel: 'View Deal',
      actionRoute: '/contractor/purchasing',
      reasoning: [
        'Price is 18% below your 90-day average',
        'You have 2 jobs scheduled that need this paint',
        'Stock levels at supplier are high',
      ],
      dataPoints: 47,
      urgency: 'today',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    // Example: Quote pricing
    recommendations.push({
      id: 'rec_2',
      type: 'price_adjustment',
      title: 'Increase Quote Prices',
      description: 'Your acceptance rate suggests room to increase prices by 8-12%.',
      confidence: 0.72,
      impact: 'high',
      actionLabel: 'Update Pricebook',
      actionRoute: '/contractor/pricebook',
      reasoning: [
        'Your quote acceptance rate is 83% (market avg: 65%)',
        'Competitors in your area charge 15% more',
        'Your customer satisfaction remains high at 4.8/5',
      ],
      dataPoints: 156,
      urgency: 'this-week',
    });

    // Example: Customer follow-up
    recommendations.push({
      id: 'rec_3',
      type: 'follow_up',
      title: 'Follow Up: Familie Bakker',
      description: 'Quote Q-2024-015 viewed 3 times but no response. Good time to call.',
      confidence: 0.68,
      impact: 'medium',
      actionLabel: 'View Quote',
      actionPayload: { quoteId: 'Q-2024-015' },
      reasoning: [
        'Customer viewed quote 3 times in past week',
        'Similar customers convert 45% after follow-up',
        'Best contact time: 10am-12pm based on history',
      ],
      dataPoints: 23,
      urgency: 'today',
    });

    return recommendations.filter((r) => r.confidence > 0.5);
  }

  // Get market intelligence
  async getMarketIntelligence(region: string, trade: string): Promise<MarketIntelligence> {
    // In real implementation: Aggregate anonymized data across users
    return {
      region,
      trade,
      period: new Date().toISOString().slice(0, 7),
      pricing: {
        avgHourlyRate: 48,
        avgHourlyRateP25: 38,
        avgHourlyRateP75: 58,
        avgMarkup: 1.35,
        avgMaterialMarkup: 1.25,
      },
      trends: {
        demandIndex: 72,
        priceIndex: 105,
        competitionIndex: 65,
      },
      materialPrices: [],
      bestPractices: [
        {
          practice: 'Good-Better-Best quoting',
          adoptionRate: 0.34,
          successMetric: 'avgQuoteValue',
          successValue: 1.42,
        },
        {
          practice: 'iDEAL payment links',
          adoptionRate: 0.56,
          successMetric: 'avgPaymentDays',
          successValue: 0.65,
        },
      ],
      seasonalPatterns: [
        { month: 1, demandMultiplier: 0.7, priceMultiplier: 0.95 },
        { month: 2, demandMultiplier: 0.75, priceMultiplier: 0.97 },
        { month: 3, demandMultiplier: 0.9, priceMultiplier: 1.0 },
        { month: 4, demandMultiplier: 1.1, priceMultiplier: 1.05 },
        { month: 5, demandMultiplier: 1.2, priceMultiplier: 1.08 },
        { month: 6, demandMultiplier: 1.15, priceMultiplier: 1.05 },
        { month: 7, demandMultiplier: 0.95, priceMultiplier: 1.0 },
        { month: 8, demandMultiplier: 0.85, priceMultiplier: 0.98 },
        { month: 9, demandMultiplier: 1.05, priceMultiplier: 1.02 },
        { month: 10, demandMultiplier: 1.1, priceMultiplier: 1.05 },
        { month: 11, demandMultiplier: 0.9, priceMultiplier: 1.0 },
        { month: 12, demandMultiplier: 0.6, priceMultiplier: 0.92 },
      ],
    };
  }

  // Record outcome for learning
  async recordOutcome(eventId: string, outcome: DataEvent['outcome']): Promise<void> {
    // Persist to Supabase
    if (isSupabaseConfigured && outcome) {
      await dbUpdateEventOutcome(eventId, outcome as unknown as Record<string, unknown>);
    }
    logInfo('Intelligence', `Outcome recorded for event: ${eventId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Recommendations Engine (getRecommendations, getMarketIntelligence)
  // ... continues into Prediction Models below
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Prediction Models (quote acceptance, pricing, duration, payment)
  // ═══════════════════════════════════════════════════════════════════════════

  private async predictQuoteAcceptance(input: Record<string, unknown>): Promise<ModelPrediction> {
    const quoteValue = (input.quoteValue as number) || 0;
    const customerHistory = (input.customerHistory as number) || 0;
    const tier = (input.tier as string) || 'good';

    // Heuristic base model
    let heuristicProb = 0.5;
    if (quoteValue < 1000) heuristicProb += 0.15;
    else if (quoteValue > 5000) heuristicProb -= 0.1;
    if (customerHistory > 0) heuristicProb += 0.2;
    if (tier === 'better') heuristicProb += 0.1;
    else if (tier === 'best') heuristicProb -= 0.05;

    // Load learned weights and blend using time-decayed observations
    const weights = await loadFeedbackWeights();
    const bracket = quoteValue < 1000 ? '0-1000'
      : quoteValue < 5000 ? '1000-5000'
      : quoteValue < 15000 ? '5000-15000'
      : '15000+';
    const custType = customerHistory > 0 ? 'repeat' : 'new';

    const bracketObs = weights.quoteAcceptance.byBracket[bracket] || [];
    const custObs = weights.quoteAcceptance.byCustomerType[custType] || [];

    const bracketDecayed = getDecayedRate(bracketObs);
    const custDecayed = getDecayedRate(custObs);

    let learnedProb: number | null = null;
    let totalEffectiveN = 0;

    if (bracketDecayed.effectiveN >= 2 && custDecayed.effectiveN >= 2) {
      learnedProb = bracketDecayed.rate * 0.6 + custDecayed.rate * 0.4;
      totalEffectiveN = bracketDecayed.effectiveN + custDecayed.effectiveN;
    } else if (bracketDecayed.effectiveN >= 2) {
      learnedProb = bracketDecayed.rate;
      totalEffectiveN = bracketDecayed.effectiveN;
    } else if (custDecayed.effectiveN >= 2) {
      learnedProb = custDecayed.rate;
      totalEffectiveN = custDecayed.effectiveN;
    }

    // Blend learned + heuristic: 60/40 when data exists, 100% heuristic otherwise
    let probability: number;
    let confidence: number;
    const explanation: string[] = [];

    if (learnedProb !== null) {
      probability = learnedProb * 0.6 + heuristicProb * 0.4;
      confidence = Math.min(0.95, 0.5 + totalEffectiveN * 0.03);
      const ci = confidenceInterval(probability, totalEffectiveN, 0.3, 0.08);
      explanation.push(
        `Geleerd uit ${bracketObs.length + custObs.length} offertes (${bracket}, ${custType}), effectief N=${totalEffectiveN.toFixed(1)}`,
        `${ci.certaintyLevel} (bereik: ${(ci.lower * 100).toFixed(0)}%–${(ci.upper * 100).toFixed(0)}%)`,
      );
    } else {
      probability = heuristicProb;
      confidence = Math.abs(heuristicProb - 0.5) * 2;
      explanation.push('Gebaseerd op heuristiek — meer data verbetert voorspellingen');
    }

    explanation.push(
      probability > 0.5 ? 'Offerte wordt waarschijnlijk geaccepteerd' : 'Offerte vereist mogelijk aanpassing',
      customerHistory > 0 ? 'Terugkerende klant verhoogt kans' : 'Nieuwe klant — overweeg opvolging',
    );

    return {
      id: `pred_${Date.now()}`,
      modelType: 'quote_acceptance',
      modelVersion: '3.0.0',
      timestamp: new Date().toISOString(),
      input,
      prediction: probability > 0.5,
      confidence,
      explanation,
    };
  }

  private predictQuotePricing(input: Record<string, unknown>): ModelPrediction {
    const category = (input.category as string) || 'general';
    const sqm = (input.sqm as number) || 0;
    const marketRate = (input.marketRate as number) || 45;

    // Calculate recommended price
    const basePrice = sqm * marketRate;
    const recommendedPrice = basePrice * 1.1; // 10% above to leave negotiation room

    return {
      id: `pred_${Date.now()}`,
      modelType: 'quote_pricing',
      modelVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      input,
      prediction: {
        recommendedPrice,
        minPrice: basePrice * 0.95,
        maxPrice: basePrice * 1.25,
      },
      confidence: 0.75,
      explanation: [
        `Based on ${sqm}m² at market rate of ${formatMoney(marketRate)}/m²`,
        'Recommended 10% buffer for negotiation',
      ],
    };
  }

  private predictTierSelection(input: Record<string, unknown>): ModelPrediction {
    const customerSegment = (input.customerSegment as string) || 'residential';
    const projectValue = (input.projectValue as number) || 0;

    let tierProbabilities = { good: 0.17, better: 0.54, best: 0.29 };

    // Adjust based on segment
    if (customerSegment === 'commercial') {
      tierProbabilities = { good: 0.1, better: 0.4, best: 0.5 };
    } else if (customerSegment === 'property-manager') {
      tierProbabilities = { good: 0.3, better: 0.5, best: 0.2 };
    }

    const mostLikely = Object.entries(tierProbabilities)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      id: `pred_${Date.now()}`,
      modelType: 'tier_selection',
      modelVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      input,
      prediction: {
        mostLikelyTier: mostLikely[0],
        probabilities: tierProbabilities,
      },
      confidence: mostLikely[1],
      explanation: [
        `${customerSegment} customers typically choose "${mostLikely[0]}" tier`,
        '83% of customers choose Better or Best when presented with options',
      ],
    };
  }

  private async predictJobDuration(input: Record<string, unknown>): Promise<ModelPrediction> {
    const category = (input.category as string) || 'general';
    const sqm = (input.sqm as number) || 0;
    const complexity = (input.complexity as string) || 'medium';

    // Base hours per sqm by category (heuristic)
    const baseRates: Record<string, number> = {
      painting: 0.5,
      repairs: 1.0,
      preparation: 0.3,
      finishing: 0.4,
    };

    const baseRate = baseRates[category] || 0.5;
    const complexityMultiplier = complexity === 'high' ? 1.5 : complexity === 'low' ? 0.8 : 1.0;
    const heuristicHours = sqm * baseRate * complexityMultiplier;

    // Load learned actual/estimated ratios using time-decayed observations
    const weights = await loadFeedbackWeights();
    const categoryObs = weights.jobDuration.byCategory[category] || [];
    const decayed = getDecayedRate(categoryObs);

    let estimatedHours: number;
    let confidence: number;
    const explanation: string[] = [];

    if (decayed.effectiveN >= 2) {
      // Apply learned correction factor (decayed.rate = weighted avg ratio)
      const avgRatio = decayed.rate;
      estimatedHours = heuristicHours * avgRatio;
      confidence = Math.min(0.95, 0.6 + decayed.effectiveN * 0.03);

      // Apply narrowing confidence interval
      const ci = confidenceInterval(estimatedHours, decayed.effectiveN);

      explanation.push(
        `Gecorrigeerd met factor ${avgRatio.toFixed(2)}x op basis van ${categoryObs.length} eerdere ${category}-klussen (effectief N=${decayed.effectiveN.toFixed(1)})`,
        `Basis: ${sqm}m² × ${baseRate} uur/m² × ${complexityMultiplier}x complexiteit`,
        `${ci.certaintyLevel} (bereik: ${ci.lower.toFixed(1)}–${ci.upper.toFixed(1)} uur)`,
      );

      return {
        id: `pred_${Date.now()}`,
        modelType: 'job_duration',
        modelVersion: '3.0.0',
        timestamp: new Date().toISOString(),
        input,
        prediction: {
          estimatedHours,
          rangeMin: ci.lower,
          rangeMax: ci.upper,
        },
        confidence,
        explanation,
      };
    } else {
      estimatedHours = heuristicHours;
      confidence = 0.7;
      explanation.push(
        `Gebaseerd op ${sqm}m² ${category}-werk`,
        `${complexity} complexiteit — meer klussen verbeteren de voorspelling`,
      );
    }

    return {
      id: `pred_${Date.now()}`,
      modelType: 'job_duration',
      modelVersion: '3.0.0',
      timestamp: new Date().toISOString(),
      input,
      prediction: {
        estimatedHours,
        rangeMin: estimatedHours * 0.8,
        rangeMax: estimatedHours * 1.3,
      },
      confidence,
      explanation,
    };
  }

  private predictMaterialDemand(input: Record<string, unknown>): ModelPrediction {
    const materialId = input.materialId as string;
    const currentPrice = (input.currentPrice as number) || 0;
    const avgPrice = (input.avgPrice as number) || currentPrice;
    const priceTrend = (input.priceTrend as string) || 'stable';

    const priceVsAvg = currentPrice / avgPrice;
    const shouldBuyNow = priceVsAvg < 0.95 || (priceTrend === 'rising' && priceVsAvg < 1.05);

    return {
      id: `pred_${Date.now()}`,
      modelType: 'material_demand',
      modelVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      input,
      prediction: {
        recommendation: shouldBuyNow ? 'buy_now' : 'wait',
        optimalPrice: avgPrice * 0.9,
        potentialSavings: shouldBuyNow ? (avgPrice - currentPrice) : 0,
      },
      confidence: 0.8,
      explanation: shouldBuyNow
        ? ['Price is below average', 'Trend suggests prices will rise']
        : ['Price is at or above average', 'Wait for better pricing'],
    };
  }

  private async predictPaymentTiming(input: Record<string, unknown>): Promise<ModelPrediction> {
    const customerHistory = (input.customerPaymentHistory as number[]) || [];
    const invoiceAmount = (input.invoiceAmount as number) || 0;
    const segment = (input.customerSegment as string) || 'unknown';

    // Heuristic baseline from direct customer history
    const heuristicDays = customerHistory.length > 0
      ? customerHistory.reduce((a, b) => a + b, 0) / customerHistory.length
      : 14;

    // Load learned payment timing from FeedbackWeights
    const weights = await loadFeedbackWeights();
    const segmentObs = weights.paymentTiming.bySegment[segment] || [];
    const decayed = getDecayedRate(segmentObs);

    let expectedDays: number;
    let confidence: number;
    const explanation: string[] = [];

    if (decayed.effectiveN >= 2) {
      // Blend learned segment data (60%) + direct customer history (40%)
      const learnedDays = decayed.rate; // value = payment days
      expectedDays = customerHistory.length > 0
        ? learnedDays * 0.6 + heuristicDays * 0.4
        : learnedDays;
      confidence = Math.min(0.95, 0.6 + decayed.effectiveN * 0.03);

      const ci = confidenceInterval(expectedDays, decayed.effectiveN, 0.4, 0.08);
      explanation.push(
        `Geleerd uit ${segmentObs.length} betalingen in segment "${segment}" (effectief N=${decayed.effectiveN.toFixed(1)})`,
        `${ci.certaintyLevel} (bereik: ${Math.round(ci.lower)}–${Math.round(ci.upper)} dagen)`,
      );
    } else {
      expectedDays = heuristicDays;
      confidence = customerHistory.length > 3 ? 0.85 : 0.6;
      explanation.push(
        `Gebaseerd op ${customerHistory.length} eerdere betalingen van deze klant`,
        'Meer data per segment verbetert voorspellingen',
      );
    }

    explanation.push(
      `Verwachte betaaltermijn: ${Math.round(expectedDays)} dagen`,
      expectedDays > 21 ? 'Hoog risico — overweeg proactief contact' : 'Betaling binnen normale termijn verwacht',
    );

    return {
      id: `pred_${Date.now()}`,
      modelType: 'payment_timing',
      modelVersion: '3.0.0',
      timestamp: new Date().toISOString(),
      input,
      prediction: {
        expectedDays: Math.round(expectedDays),
        probability80: Math.round(expectedDays * 1.3),
        riskLevel: expectedDays > 21 ? 'high' : expectedDays > 14 ? 'medium' : 'low',
      },
      confidence,
      explanation,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Tracking & Metrics (feedback loops, learning from outcomes)
  // ═══════════════════════════════════════════════════════════════════════════

  private async processFeedbackLoops(event: DataEvent): Promise<void> {
    const weights = await loadFeedbackWeights();
    let updated = false;
    const now = new Date().toISOString();

    switch (event.eventType) {
      case 'quote_accepted':
      case 'quote_rejected': {
        const accepted = event.eventType === 'quote_accepted';
        const value = (event.payload.quoteValue as number) || 0;
        const isRepeat = (event.payload.customerHistory as number) > 0;

        const bracket = value < 1000 ? '0-1000'
          : value < 5000 ? '1000-5000'
          : value < 15000 ? '5000-15000'
          : '15000+';
        if (!weights.quoteAcceptance.byBracket[bracket]) {
          weights.quoteAcceptance.byBracket[bracket] = [];
        }
        weights.quoteAcceptance.byBracket[bracket] = pushObservation(
          weights.quoteAcceptance.byBracket[bracket],
          { timestamp: now, value: accepted ? 1 : 0 },
        );

        const custType = isRepeat ? 'repeat' : 'new';
        if (!weights.quoteAcceptance.byCustomerType[custType]) {
          weights.quoteAcceptance.byCustomerType[custType] = [];
        }
        weights.quoteAcceptance.byCustomerType[custType] = pushObservation(
          weights.quoteAcceptance.byCustomerType[custType],
          { timestamp: now, value: accepted ? 1 : 0 },
        );

        updated = true;
        break;
      }

      case 'job_completed': {
        const category = (event.payload.category as string) || 'general';
        const estimatedHours = (event.payload.estimatedHours as number) || 0;
        const actualHours = (event.payload.actualHours as number) || 0;

        if (estimatedHours > 0 && actualHours > 0) {
          const ratio = actualHours / estimatedHours;
          if (!weights.jobDuration.byCategory[category]) {
            weights.jobDuration.byCategory[category] = [];
          }
          weights.jobDuration.byCategory[category] = pushObservation(
            weights.jobDuration.byCategory[category],
            { timestamp: now, value: ratio },
          );
          updated = true;
        }
        break;
      }

      case 'payment_received': {
        const segment = (event.payload.customerSegment as string) || 'unknown';
        const paymentDays = (event.payload.paymentDays as number) || 0;

        if (paymentDays > 0) {
          if (!weights.paymentTiming.bySegment[segment]) {
            weights.paymentTiming.bySegment[segment] = [];
          }
          weights.paymentTiming.bySegment[segment] = pushObservation(
            weights.paymentTiming.bySegment[segment],
            { timestamp: now, value: paymentDays },
          );
          updated = true;
        }
        break;
      }

      case 'quote_viewed': {
        // Track quote view as weak positive signal (0.3) — they looked but haven't decided
        const viewValue = (event.payload.quoteValue as number) || 0;
        const viewBracket = viewValue < 1000 ? '0-1000'
          : viewValue < 5000 ? '1000-5000'
          : viewValue < 15000 ? '5000-15000'
          : '15000+';
        if (!weights.quoteAcceptance.byBracket[viewBracket]) {
          weights.quoteAcceptance.byBracket[viewBracket] = [];
        }
        weights.quoteAcceptance.byBracket[viewBracket] = pushObservation(
          weights.quoteAcceptance.byBracket[viewBracket],
          { timestamp: now, value: 0.3 },  // weak positive: viewed but not yet accepted
        );
        updated = true;
        break;
      }

      case 'quote_expired': {
        // Expired quote = negative signal (0) for that bracket
        const expValue = (event.payload.quoteValue as number) || 0;
        const expBracket = expValue < 1000 ? '0-1000'
          : expValue < 5000 ? '1000-5000'
          : expValue < 15000 ? '5000-15000'
          : '15000+';
        if (!weights.quoteAcceptance.byBracket[expBracket]) {
          weights.quoteAcceptance.byBracket[expBracket] = [];
        }
        weights.quoteAcceptance.byBracket[expBracket] = pushObservation(
          weights.quoteAcceptance.byBracket[expBracket],
          { timestamp: now, value: 0 },
        );
        updated = true;
        break;
      }

      case 'payment_overdue': {
        // Overdue payment: record high payment days as negative signal
        const overdueSegment = (event.payload.customerSegment as string) || 'unknown';
        const daysOverdue = (event.payload.daysOverdue as number) || 30;
        if (!weights.paymentTiming.bySegment[overdueSegment]) {
          weights.paymentTiming.bySegment[overdueSegment] = [];
        }
        weights.paymentTiming.bySegment[overdueSegment] = pushObservation(
          weights.paymentTiming.bySegment[overdueSegment],
          { timestamp: now, value: daysOverdue + 30 },  // base 30 + overdue days = total payment time
        );
        updated = true;
        break;
      }

      case 'job_cancelled': {
        // Cancelled job: record 0 ratio for that category (no work completed)
        const cancelCategory = (event.payload.category as string) || 'general';
        if (!weights.jobDuration.byCategory[cancelCategory]) {
          weights.jobDuration.byCategory[cancelCategory] = [];
        }
        weights.jobDuration.byCategory[cancelCategory] = pushObservation(
          weights.jobDuration.byCategory[cancelCategory],
          { timestamp: now, value: 0 },  // 0 = cancelled before completion
        );
        updated = true;
        break;
      }
    }

    if (updated) {
      await saveFeedbackWeights(weights);
      logInfo('Intelligence', `Feedback weights updated for: ${event.eventType}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Utilities (context creation, season detection)
  // ═══════════════════════════════════════════════════════════════════════════

  private createContext(): EventContext {
    const now = new Date();
    return {
      platform: 'ios',
      appVersion: '1.0.0',
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      season: this.getSeason(now.getMonth()),
    };
  }

  private getSeason(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }
}

// Export singleton
export const intelligence = new VascoIntelligenceEngine();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: React Hooks (useIntelligence, useRecommendations, useMarketIntelligence)
// ═══════════════════════════════════════════════════════════════════════════════

export function useIntelligence() {
  return {
    trackEvent: intelligence.trackEvent.bind(intelligence),
    predict: intelligence.predict.bind(intelligence),
    getRecommendations: intelligence.getRecommendations.bind(intelligence),
    recordOutcome: intelligence.recordOutcome.bind(intelligence),
  };
}

export function useRecommendations(userId: string, context: string) {
  // In real implementation: Use React Query or SWR
  return {
    recommendations: [] as Recommendation[],
    isLoading: false,
    refresh: () => intelligence.getRecommendations(userId, context),
  };
}

export function useMarketIntelligence(region: string, trade: string) {
  return {
    data: null as MarketIntelligence | null,
    isLoading: false,
    refresh: () => intelligence.getMarketIntelligence(region, trade),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Convenience Tracking (trackUserAction helper)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quick tracking function with auto-generated context
 * Use this throughout the app for easy event tracking
 */
export function trackUserAction(
  eventType: DataEventType,
  payload: Record<string, unknown>,
  entities: EntityRef[] = [],
  userId?: string,
): Promise<string> {
  const resolvedUserId = userId ?? _resolveUserId();
  const now = new Date();

  return intelligence.trackEvent({
    eventType,
    userId: resolvedUserId,
    sessionId: 'current',
    context: {
      platform: 'ios',
      appVersion: '1.0.0',
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      season: getSeason(now.getMonth()),
    },
    payload,
    entities,
  });
}

function getSeason(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}
