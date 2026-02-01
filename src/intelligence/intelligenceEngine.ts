// =============================================================================
// VASCO INTELLIGENCE ENGINE
// =============================================================================
// The brain that processes data events, updates knowledge graph, and generates
// AI-powered recommendations. This creates the agentic moat through learning.
// =============================================================================

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

// ============================================
// INTELLIGENCE API
// ============================================

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

// ============================================
// INTELLIGENCE ENGINE IMPLEMENTATION
// ============================================

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

    // In real implementation: send to backend
    console.log('[Intelligence] Event tracked:', fullEvent.eventType);

    // Process feedback loops
    await this.processFeedbackLoops(fullEvent);

    return id;
  }

  // Resolve entity from name/context
  async resolveEntity(
    name: string,
    type: EntityType,
    context?: Record<string, unknown>
  ): Promise<EntityRef> {
    // In real implementation: Use ML model for entity resolution
    // Check for existing entities with similar names
    // Consider context for disambiguation

    const id = `${type}_${name.toLowerCase().replace(/\s+/g, '_')}`;

    return {
      id,
      type,
      name,
      confidence: 0.9,
    };
  }

  async getEntity(id: string): Promise<Entity | null> {
    return this.entityCache.get(id) || null;
  }

  async findSimilarEntities(entityId: string, limit = 5): Promise<EntityRef[]> {
    // In real implementation: Vector similarity search
    return [];
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
    // In real implementation: Call ML model API
    // For now, return heuristic-based predictions

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
          modelVersion: '1.0.0',
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
    // Find original event and update with outcome
    // This creates training data for our models
    console.log('[Intelligence] Outcome recorded for event:', eventId, outcome);
  }

  // ============================================
  // PREDICTION MODELS (Heuristic implementations)
  // ============================================

  private predictQuoteAcceptance(input: Record<string, unknown>): ModelPrediction {
    const quoteValue = (input.quoteValue as number) || 0;
    const customerHistory = (input.customerHistory as number) || 0;
    const tier = (input.tier as string) || 'good';

    // Simple heuristic model
    let probability = 0.5;

    // Lower quotes more likely to be accepted
    if (quoteValue < 1000) probability += 0.15;
    else if (quoteValue > 5000) probability -= 0.1;

    // Repeat customers more likely
    if (customerHistory > 0) probability += 0.2;

    // Better tier has higher acceptance in our data
    if (tier === 'better') probability += 0.1;
    else if (tier === 'best') probability -= 0.05;

    return {
      id: `pred_${Date.now()}`,
      modelType: 'quote_acceptance',
      modelVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      input,
      prediction: probability > 0.5,
      confidence: Math.abs(probability - 0.5) * 2,
      explanation: [
        probability > 0.5 ? 'Quote likely to be accepted' : 'Quote may need adjustment',
        customerHistory > 0 ? 'Repeat customer increases likelihood' : 'New customer - consider follow-up',
      ],
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
        `Based on ${sqm}m² at market rate of €${marketRate}/m²`,
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

  private predictJobDuration(input: Record<string, unknown>): ModelPrediction {
    const category = (input.category as string) || 'general';
    const sqm = (input.sqm as number) || 0;
    const complexity = (input.complexity as string) || 'medium';

    // Base hours per sqm by category
    const baseRates: Record<string, number> = {
      painting: 0.5,
      repairs: 1.0,
      preparation: 0.3,
      finishing: 0.4,
    };

    const baseRate = baseRates[category] || 0.5;
    const complexityMultiplier = complexity === 'high' ? 1.5 : complexity === 'low' ? 0.8 : 1.0;

    const estimatedHours = sqm * baseRate * complexityMultiplier;

    return {
      id: `pred_${Date.now()}`,
      modelType: 'job_duration',
      modelVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      input,
      prediction: {
        estimatedHours,
        rangeMin: estimatedHours * 0.8,
        rangeMax: estimatedHours * 1.3,
      },
      confidence: 0.7,
      explanation: [
        `Based on ${sqm}m² of ${category} work`,
        `${complexity} complexity applied`,
      ],
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

  private predictPaymentTiming(input: Record<string, unknown>): ModelPrediction {
    const customerHistory = (input.customerPaymentHistory as number[]) || [];
    const invoiceAmount = (input.invoiceAmount as number) || 0;

    const avgDays = customerHistory.length > 0
      ? customerHistory.reduce((a, b) => a + b, 0) / customerHistory.length
      : 14;

    return {
      id: `pred_${Date.now()}`,
      modelType: 'payment_timing',
      modelVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      input,
      prediction: {
        expectedDays: Math.round(avgDays),
        probability80: Math.round(avgDays * 1.3),
        riskLevel: avgDays > 21 ? 'high' : avgDays > 14 ? 'medium' : 'low',
      },
      confidence: customerHistory.length > 3 ? 0.85 : 0.6,
      explanation: [
        `Based on ${customerHistory.length} previous payments`,
        `Average payment time: ${Math.round(avgDays)} days`,
      ],
    };
  }

  // ============================================
  // FEEDBACK LOOP PROCESSING
  // ============================================

  private async processFeedbackLoops(event: DataEvent): Promise<void> {
    // Check if this event completes any feedback loops
    // Update models with new training data
    console.log('[Intelligence] Processing feedback for:', event.eventType);
  }

  // ============================================
  // UTILITIES
  // ============================================

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

// ============================================
// REACT HOOKS FOR INTELLIGENCE
// ============================================

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

// ============================================
// CONVENIENCE TRACKING FUNCTION
// ============================================

/**
 * Quick tracking function with auto-generated context
 * Use this throughout the app for easy event tracking
 */
export function trackUserAction(
  eventType: DataEventType,
  payload: Record<string, unknown>,
  entities: EntityRef[] = [],
  userId: string = 'current-user'
): Promise<string> {
  const now = new Date();

  return intelligence.trackEvent({
    eventType,
    userId,
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
