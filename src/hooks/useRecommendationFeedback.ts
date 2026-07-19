// =============================================================================
// RECOMMENDATION FEEDBACK HOOK
// =============================================================================
// Manages recommendation state and feedback submission
// Connects UI interactions to the intelligence learning loop
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { DEMO_MODE } from '../config/demo';
import { pricingAgent } from '../intelligence/pricingAgent';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import { logWarn } from '../utils/errorHandler';
import type { Recommendation } from '../components/contractor/RecommendationFeedback';

// ============================================
// TYPES
// ============================================

interface FeedbackStats {
  totalReviewed: number;
  accepted: number;
  rejected: number;
  dismissed: number;
  acceptanceRate: number;
}

interface UseRecommendationFeedbackOptions {
  source: 'pricing' | 'general' | 'decision' | 'all';
  autoRefresh?: boolean;
  maxRecommendations?: number;
}

// ============================================
// MOCK RECOMMENDATIONS (until backend integration)
// ============================================

const DEMO_MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec_001',
    type: 'pricing',
    title: 'Dulux Trade bij Bouwmaat goedkoper',
    description: 'Je koopt meestal bij Praxis, maar Bouwmaat heeft 15% korting deze week.',
    confidence: 0.87,
    potentialSavings: 23.50,
    urgency: 'today',
  },
  {
    id: 'rec_002',
    type: 'timing',
    title: 'Bestel verf vóór 14:00',
    description: 'Voor levering morgen moet je voor 14:00 bestellen bij Verfwinkel.',
    confidence: 0.92,
    urgency: 'immediate',
  },
  {
    id: 'rec_003',
    type: 'supplier',
    title: 'Nieuwe leverancier ontdekt',
    description: 'Sanitairwinkel.nl heeft betere prijzen voor Grohe kranen dan je huidige leverancier.',
    confidence: 0.74,
    potentialSavings: 45.00,
    urgency: 'this_week',
  },
  {
    id: 'rec_004',
    type: 'product',
    title: 'Klanten kiezen vaker voor Geberit',
    description: 'In jouw regio kiezen 67% van de klanten voor Geberit inbouwreservoirs.',
    confidence: 0.81,
    metadata: { trend: 'increasing', region: 'noord-holland' },
  },
  {
    id: 'rec_005',
    type: 'material',
    title: 'Bulk korting mogelijk',
    description: 'Je gebruikt regelmatig Sigma verf. Bij 10+ blikken krijg je 12% korting.',
    confidence: 0.78,
    potentialSavings: 67.80,
    urgency: 'this_week',
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_RECOMMENDATIONS: Recommendation[] = DEMO_MODE ? DEMO_MOCK_RECOMMENDATIONS : [];

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useRecommendationFeedback(options: UseRecommendationFeedbackOptions = { source: 'all' }) {
  const { source, autoRefresh = true, maxRecommendations = 10 } = options;

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<FeedbackStats>({
    totalReviewed: 0,
    accepted: 0,
    rejected: 0,
    dismissed: 0,
    acceptanceRate: 0,
  });

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // In production, this would call the pricing agent or a recommendations API
      // For now, use mock data filtered by source
      let recs = [...MOCK_RECOMMENDATIONS];

      if (source !== 'all') {
        recs = recs.filter((r) => {
          if (source === 'pricing') return r.type === 'pricing' || r.type === 'supplier';
          if (source === 'decision') return r.type === 'product';
          return r.type === source;
        });
      }

      // Limit results
      recs = recs.slice(0, maxRecommendations);

      setRecommendations(recs);
    } catch (err) {
      logWarn('useRecommendationFeedback', `Fetch failed: ${err}`);
      setError('Kon aanbevelingen niet laden');
    } finally {
      setLoading(false);
    }
  }, [source, maxRecommendations]);

  // Initial fetch
  useEffect(() => {
    if (autoRefresh) {
      fetchRecommendations();
    }
  }, [autoRefresh, fetchRecommendations]);

  // Accept recommendation
  const acceptRecommendation = useCallback(
    async (id: string, context?: string, actualPrice?: number) => {
      try {
        // Record in pricing agent if it's a pricing recommendation
        const rec = recommendations.find((r) => r.id === id);
        if (rec?.type === 'pricing' || rec?.type === 'supplier') {
          await pricingAgent.recordRecommendationAction(id, 'accepted', {
            actualPrice,
            feedback: context,
          });
        }

        // Update local state
        setRecommendations((prev) => prev.filter((r) => r.id !== id));
        setStats((prev) => ({
          ...prev,
          totalReviewed: prev.totalReviewed + 1,
          accepted: prev.accepted + 1,
          acceptanceRate: (prev.accepted + 1) / (prev.totalReviewed + 1),
        }));

        // Track for analytics
        trackUserAction('recommendation_feedback_submitted', {
          recommendationId: id,
          action: 'accepted',
          context,
          actualPrice,
          type: rec?.type,
        });
      } catch (err) {
        logWarn('useRecommendationFeedback', `Accept failed: ${err}`);
      }
    },
    [recommendations]
  );

  // Reject recommendation
  const rejectRecommendation = useCallback(
    async (id: string, reason?: string, feedback?: string) => {
      try {
        // Record in pricing agent if it's a pricing recommendation
        const rec = recommendations.find((r) => r.id === id);
        if (rec?.type === 'pricing' || rec?.type === 'supplier') {
          await pricingAgent.recordRecommendationAction(id, 'rejected', {
            feedback: `${reason || ''} ${feedback || ''}`.trim() || undefined,
          });
        }

        // Update local state
        setRecommendations((prev) => prev.filter((r) => r.id !== id));
        setStats((prev) => ({
          ...prev,
          totalReviewed: prev.totalReviewed + 1,
          rejected: prev.rejected + 1,
          acceptanceRate: prev.accepted / (prev.totalReviewed + 1),
        }));

        // Track for analytics
        trackUserAction('recommendation_feedback_submitted', {
          recommendationId: id,
          action: 'rejected',
          reason,
          feedback,
          type: rec?.type,
        });
      } catch (err) {
        logWarn('useRecommendationFeedback', `Reject failed: ${err}`);
      }
    },
    [recommendations]
  );

  // Dismiss recommendation (not useful but not negative)
  const dismissRecommendation = useCallback(
    async (id: string) => {
      try {
        // Update local state
        setRecommendations((prev) => prev.filter((r) => r.id !== id));
        setStats((prev) => ({
          ...prev,
          dismissed: prev.dismissed + 1,
        }));

        // Track for analytics
        trackUserAction('recommendation_dismissed', {
          recommendationId: id,
        });
      } catch (err) {
        logWarn('useRecommendationFeedback', `Dismiss failed: ${err}`);
      }
    },
    []
  );

  // Refresh recommendations
  const refresh = useCallback(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    loading,
    error,
    stats,
    acceptRecommendation,
    rejectRecommendation,
    dismissRecommendation,
    refresh,
  };
}

// ============================================
// SPECIALIZED HOOKS
// ============================================

/**
 * Hook for pricing recommendations only
 */
export function usePricingRecommendationFeedback() {
  return useRecommendationFeedback({ source: 'pricing' });
}

/**
 * Hook for product/decision recommendations
 */
export function useProductRecommendationFeedback() {
  return useRecommendationFeedback({ source: 'decision' });
}

/**
 * Hook for all recommendations
 */
export function useAllRecommendations() {
  return useRecommendationFeedback({ source: 'all', maxRecommendations: 20 });
}
