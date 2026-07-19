// AIRecommendations.tsx - Surface AI intelligence as actionable recommendations
// This is where the data moat becomes visible value to users

import { useState, useEffect } from 'react';
import { DEMO_MODE } from '../../config/demo';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { intelligence, type Recommendation } from '../../intelligence/intelligenceEngine';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MOCK RECOMMENDATIONS (Demo)
// ============================================

const DEMO_DEMO_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec_price_1',
    type: 'buy_now',
    title: 'Dulux Trade 18% Off',
    description: 'Price dropped at Bouwmaat. You need this for 2 upcoming jobs.',
    confidence: 0.92,
    impact: 'high',
    actionLabel: 'Buy Now',
    actionRoute: '/contractor/purchasing',
    reasoning: [
      'Price is €23.40 vs your avg €28.50',
      'You have jobs scheduled using this paint',
      'Supplier stock is high',
    ],
    dataPoints: 156,
    urgency: 'immediate',
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rec_quote_1',
    type: 'price_adjustment',
    title: 'Raise Your Prices',
    description: 'Your 83% acceptance rate suggests you can charge 10-15% more.',
    confidence: 0.78,
    impact: 'high',
    actionLabel: 'Update Pricebook',
    actionRoute: '/contractor/pricebook',
    reasoning: [
      'Acceptance rate 83% vs market 65%',
      'Competitors charge €52/hr (you: €45)',
      'Customer satisfaction stable at 4.8★',
    ],
    dataPoints: 89,
    urgency: 'this-week',
  },
  {
    id: 'rec_follow_1',
    type: 'follow_up',
    title: 'Call Familie Bakker',
    description: 'Quote viewed 4 times. Best convert window: 10am-12pm.',
    confidence: 0.71,
    impact: 'medium',
    actionLabel: 'View Quote',
    reasoning: [
      'Customer viewed quote 4x this week',
      'Similar leads convert 52% with call',
      'Optimal call time based on history',
    ],
    dataPoints: 34,
    urgency: 'today',
  },
  {
    id: 'rec_schedule_1',
    type: 'schedule_optimization',
    title: 'Combine Jobs',
    description: '2 jobs within 500m next Tuesday. Save 45min travel.',
    confidence: 0.85,
    impact: 'medium',
    actionLabel: 'Optimize',
    actionRoute: '/(contractor)',
    reasoning: [
      'Prinsengracht 123 & 145 are nearby',
      'Both scheduled for Tuesday afternoon',
      'Reschedule one to morning slot',
    ],
    dataPoints: 12,
    urgency: 'when-convenient',
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const DEMO_RECOMMENDATIONS: Recommendation[] = DEMO_MODE ? DEMO_DEMO_RECOMMENDATIONS : [];

// ============================================
// CONFIGURATION
// ============================================

const RECOMMENDATION_CONFIG: Record<Recommendation['type'], { icon: IconName; color: string }> = {
  price_adjustment: { icon: 'trending-up', color: Palette.hermesOrange },
  tier_recommendation: { icon: 'layers', color: Palette.terracotta },
  discount_opportunity: { icon: 'pricetag', color: SemanticColors.feedbackSuccess },
  buy_now: { icon: 'cart', color: SemanticColors.feedbackSuccess },
  wait_to_buy: { icon: 'time', color: SemanticColors.feedbackInfo },
  bulk_opportunity: { icon: 'cube', color: Palette.terracotta },
  switch_supplier: { icon: 'swap-horizontal', color: SemanticColors.feedbackWarning },
  follow_up: { icon: 'call', color: SemanticColors.feedbackInfo },
  send_reminder: { icon: 'notifications', color: SemanticColors.feedbackWarning },
  upsell_opportunity: { icon: 'arrow-up-circle', color: Palette.hermesOrange },
  churn_risk: { icon: 'warning', color: SemanticColors.feedbackError },
  schedule_optimization: { icon: 'calendar', color: Palette.terracotta },
  resource_alert: { icon: 'alert-circle', color: SemanticColors.feedbackWarning },
  efficiency_tip: { icon: 'flash', color: SemanticColors.feedbackSuccess },
  revenue_opportunity: { icon: 'cash', color: SemanticColors.feedbackSuccess },
  cost_saving: { icon: 'trending-down', color: SemanticColors.feedbackSuccess },
  market_insight: { icon: 'analytics', color: SemanticColors.feedbackInfo },
};

const URGENCY_LABELS: Record<Recommendation['urgency'], { label: string; color: string }> = {
  immediate: { label: 'Now', color: SemanticColors.feedbackError },
  today: { label: 'Today', color: SemanticColors.feedbackWarning },
  'this-week': { label: 'This Week', color: SemanticColors.feedbackInfo },
  'when-convenient': { label: 'Anytime', color: SemanticColors.textTertiary },
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface RecommendationCardProps {
  recommendation: Recommendation;
  onAction: () => void;
  onDismiss: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}

function RecommendationCard({
  recommendation,
  onAction,
  onDismiss,
  onExpand,
  isExpanded,
}: RecommendationCardProps) {
  const config = RECOMMENDATION_CONFIG[recommendation.type];
  const urgencyConfig = URGENCY_LABELS[recommendation.urgency];

  return (
    <Pressable style={styles.card} onPress={onExpand}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: config.color + '15' }]}>
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>{recommendation.title}</Text>
            <View style={[styles.urgencyBadge, { backgroundColor: urgencyConfig.color + '15' }]}>
              <Text style={[styles.urgencyText, { color: urgencyConfig.color }]}>
                {urgencyConfig.label}
              </Text>
            </View>
          </View>
          <Text style={styles.cardDescription}>{recommendation.description}</Text>
        </View>
      </View>

      {isExpanded && (
        <View style={styles.expandedContent}>
          {/* Confidence */}
          <View style={styles.confidenceRow}>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${recommendation.confidence * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.confidenceText}>
              {Math.round(recommendation.confidence * 100)}% confidence
            </Text>
          </View>

          {/* Reasoning */}
          <View style={styles.reasoningSection}>
            <Text style={styles.reasoningTitle}>Why we recommend this:</Text>
            {recommendation.reasoning.map((reason, index) => (
              <View key={index} style={styles.reasoningItem}>
                <View style={styles.reasoningBullet} />
                <Text style={styles.reasoningText}>{reason}</Text>
              </View>
            ))}
          </View>

          {/* Data Points */}
          <Text style={styles.dataPoints}>
            Based on {recommendation.dataPoints.toLocaleString()} data points
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.cardActions}>
        <Pressable style={styles.dismissButton} onPress={onDismiss}>
          <Ionicons name="close" size={18} color={SemanticColors.textTertiary} />
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: config.color }]}
          onPress={onAction}
        >
          <Text style={styles.actionButtonText}>{recommendation.actionLabel}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface AIRecommendationsProps {
  userId: string;
  maxItems?: number;
  showHeader?: boolean;
  compact?: boolean;
}

export function AIRecommendations({
  userId,
  maxItems = 5,
  showHeader = true,
  compact = false,
}: AIRecommendationsProps) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<Recommendation[]>(DEMO_RECOMMENDATIONS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleRecommendations = recommendations
    .filter((r) => !dismissedIds.has(r.id))
    .slice(0, maxItems);

  const handleAction = (recommendation: Recommendation) => {
    // Track that user acted on recommendation
    intelligence.trackEvent({
      eventType: 'ai_recommendation_accepted',
      userId,
      sessionId: 'current',
      context: {
        platform: 'ios',
        appVersion: '1.0.0',
        dayOfWeek: new Date().getDay(),
        hourOfDay: new Date().getHours(),
        isWeekend: false,
        season: 'winter',
      },
      payload: { recommendationId: recommendation.id, type: recommendation.type },
      entities: [],
    });

    // Navigate if route provided
    if (recommendation.actionRoute) {
      router.push(recommendation.actionRoute as any);
    }
  };

  const handleDismiss = (recommendation: Recommendation) => {
    // Track dismissal for learning
    intelligence.trackEvent({
      eventType: 'ai_recommendation_rejected',
      userId,
      sessionId: 'current',
      context: {
        platform: 'ios',
        appVersion: '1.0.0',
        dayOfWeek: new Date().getDay(),
        hourOfDay: new Date().getHours(),
        isWeekend: false,
        season: 'winter',
      },
      payload: { recommendationId: recommendation.id, type: recommendation.type },
      entities: [],
    });

    setDismissedIds(new Set([...dismissedIds, recommendation.id]));
  };

  if (visibleRecommendations.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="sparkles" size={20} color={Palette.hermesOrange} />
            <Text style={styles.headerTitle}>AI Insights</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{visibleRecommendations.length}</Text>
          </View>
        </View>
      )}

      <View style={styles.cardList}>
        {visibleRecommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.id}
            recommendation={recommendation}
            isExpanded={expandedId === recommendation.id}
            onExpand={() =>
              setExpandedId(expandedId === recommendation.id ? null : recommendation.id)
            }
            onAction={() => handleAction(recommendation)}
            onDismiss={() => handleDismiss(recommendation)}
          />
        ))}
      </View>

      {/* Learning indicator */}
      <View style={styles.learningIndicator}>
        <Ionicons name="sync" size={12} color={SemanticColors.textTertiary} />
        <Text style={styles.learningText}>
          Learning from your actions to improve recommendations
        </Text>
      </View>
    </View>
  );
}

// Compact version for dashboard widgets
export function AIRecommendationsWidget({ userId }: { userId: string }) {
  return (
    <AIRecommendations userId={userId} maxItems={2} showHeader={false} compact />
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: TYPE.titleSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  headerBadge: {
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  headerBadgeText: {
    fontSize: TYPE.labelSize,
    fontWeight: '700',
    color: Palette.white,
  },

  cardList: {
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    marginLeft: 8,
  },
  urgencyText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },

  // Expanded content
  expandedContent: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 2,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },
  reasoningSection: {
    marginBottom: Spacing.sm,
  },
  reasoningTitle: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.xs,
  },
  reasoningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  reasoningBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.hermesOrange,
    marginTop: 6,
    marginRight: 8,
  },
  reasoningText: {
    flex: 1,
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  dataPoints: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    fontStyle: 'italic',
  },

  // Actions
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  dismissButton: {
    padding: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.sm,
  },
  actionButtonText: {
    fontSize: TYPE.captionSize,
    fontWeight: '600',
    color: Palette.white,
  },

  // Learning indicator
  learningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  learningText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },
});

export default AIRecommendations;
