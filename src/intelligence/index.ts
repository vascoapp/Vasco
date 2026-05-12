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
// R66r63: dropped useRegionalPreferences/useDecisionTiming/useDecisionSubmission
// re-exports — all three were @deprecated R304 with zero callers + are still
// callable directly from `./decisionIntelligence` for future surfaces, but
// removing them from the barrel lets tree-shaking drop them from prod
// bundles. Restore here once R6 aggregation pipeline ships and UI consumers
// land.
export { decisionIntelligence } from './decisionIntelligence';
