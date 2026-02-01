// Vasco Intelligence Module
// The agentic moat - data that learns and improves over time
// Every touchpoint becomes training data for smarter recommendations

export * from './dataSchema';
export * from './intelligenceEngine';
export * from './pricingAgent';
export * from './decisionIntelligence';

// Quick access to commonly used functions
export {
  intelligence,
  trackUserAction,
  useIntelligence,
  useRecommendations,
  useMarketIntelligence,
} from './intelligenceEngine';

// Pricing intelligence
export {
  pricingAgent,
  usePricingAgent,
  usePricingRecommendations,
  useMaterialPriceComparison,
  usePricingAnalytics,
} from './pricingAgent';

// Decision intelligence (customer portal → pricing moat)
export {
  decisionIntelligence,
  useRegionalPreferences,
  useDecisionTiming,
  useDecisionSubmission,
} from './decisionIntelligence';
