// =============================================================================
// VASCO INSIGHT CARD - Reusable AI guidance component for all views
// =============================================================================
// Actionable AI advice cards that can be used across any screen and role.
// Supports expand/collapse, primary action, dismiss, and snooze.
// =============================================================================

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type IconName = keyof typeof Ionicons.glyphMap;

export type InsightPriority = 'critical' | 'high' | 'medium' | 'low';
export type InsightCategory = 'alert' | 'opportunity' | 'compliance' | 'financial' | 'schedule' | 'tip' | 'weather';

export interface VascoInsight {
  id: string;
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  message: string;
  detail?: string;
  icon: IconName;
  actionLabel?: string;
  actionRoute?: string;
  secondaryActionLabel?: string;
  secondaryActionRoute?: string;
  timestamp?: string;
  source?: string; // e.g., "Financieel Auditor", "Compliance Check"
  metric?: { label: string; value: string; trend?: 'up' | 'down' | 'neutral' };
}

interface VascoInsightCardProps {
  insight: VascoInsight;
  onDismiss?: (id: string) => void;
  onAction?: (insight: VascoInsight) => void;
  onSnooze?: (id: string) => void;
  compact?: boolean;
  showSource?: boolean;
}

function getPriorityColor(priority: InsightPriority): string {
  switch (priority) {
    case 'critical': return SemanticColors.feedbackError;
    case 'high': return SemanticColors.feedbackWarning;
    case 'medium': return Palette.hermesOrange;
    case 'low': return SemanticColors.textTertiary;
  }
}

function getPriorityBg(priority: InsightPriority): string {
  switch (priority) {
    case 'critical': return SemanticColors.feedbackErrorBg;
    case 'high': return SemanticColors.feedbackWarningBg;
    case 'medium': return Palette.hermesOrange + '15';
    case 'low': return SemanticColors.surfaceSecondary;
  }
}

function getCategoryLabel(category: InsightCategory): string {
  switch (category) {
    case 'alert': return 'Waarschuwing';
    case 'opportunity': return 'Kans';
    case 'compliance': return 'Compliance';
    case 'financial': return 'Financieel';
    case 'schedule': return 'Planning';
    case 'tip': return 'Tip';
    case 'weather': return 'Weer';
  }
}

export function VascoInsightCard({
  insight,
  onDismiss,
  onAction,
  onSnooze,
  compact = false,
  showSource = true,
}: VascoInsightCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [actedOn, setActedOn] = useState(false);

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  const handlePrimaryAction = useCallback(() => {
    if (onAction) {
      onAction(insight);
    }
    if (insight.actionRoute) {
      router.push(insight.actionRoute as any);
    }
    setActedOn(true);
  }, [insight, onAction, router]);

  const handleDismiss = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onDismiss?.(insight.id);
  }, [insight.id, onDismiss]);

  const handleSnooze = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSnooze?.(insight.id);
  }, [insight.id, onSnooze]);

  const priorityColor = getPriorityColor(insight.priority);
  const priorityBg = getPriorityBg(insight.priority);

  if (actedOn) {
    return (
      <View style={[styles.card, styles.cardActedOn]}>
        <View style={styles.actedOnContent}>
          <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.actedOnText}>
            {insight.actionLabel ? `${insight.actionLabel} — klaar` : 'Afgehandeld'}
          </Text>
        </View>
        <Pressable onPress={handleDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>
    );
  }

  if (compact) {
    return (
      <Pressable
        style={[styles.compactCard, { borderLeftColor: priorityColor }]}
        onPress={insight.actionRoute ? handlePrimaryAction : toggleExpand}
      >
        <View style={[styles.compactIcon, { backgroundColor: priorityBg }]}>
          <Ionicons name={insight.icon} size={14} color={priorityColor} />
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={1}>{insight.title}</Text>
          <Text style={styles.compactMessage} numberOfLines={1}>{insight.message}</Text>
        </View>
        {onDismiss && (
          <Pressable onPress={handleDismiss} hitSlop={8} style={styles.compactDismiss}>
            <Ionicons name="close" size={14} color={SemanticColors.textTertiary} />
          </Pressable>
        )}
        <Ionicons
          name={insight.actionRoute ? 'chevron-forward' : 'chevron-down'}
          size={14}
          color={SemanticColors.textTertiary}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.card, { borderLeftColor: priorityColor }]}
      onPress={toggleExpand}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: priorityBg }]}>
          <Ionicons name={insight.icon} size={18} color={priorityColor} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{insight.title}</Text>
            {insight.priority === 'critical' && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalBadgeText}>URGENT</Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            {showSource && insight.source && (
              <Text style={styles.source}>{insight.source}</Text>
            )}
            {insight.timestamp && (
              <Text style={styles.timestamp}>{insight.timestamp}</Text>
            )}
          </View>
        </View>
        {onDismiss && (
          <Pressable onPress={handleDismiss} hitSlop={8}>
            <Ionicons name="close" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Message */}
      <Text style={styles.message} numberOfLines={expanded ? undefined : 2}>
        {insight.message}
      </Text>

      {/* Metric (if provided) */}
      {insight.metric && (
        <View style={styles.metricContainer}>
          <Text style={styles.metricLabel}>{insight.metric.label}</Text>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricValue}>{insight.metric.value}</Text>
            {insight.metric.trend && (
              <Ionicons
                name={insight.metric.trend === 'up' ? 'trending-up' : insight.metric.trend === 'down' ? 'trending-down' : 'remove'}
                size={14}
                color={
                  insight.metric.trend === 'up' ? SemanticColors.feedbackSuccess :
                  insight.metric.trend === 'down' ? SemanticColors.feedbackError :
                  SemanticColors.textTertiary
                }
              />
            )}
          </View>
        </View>
      )}

      {/* Expanded detail */}
      {expanded && insight.detail && (
        <View style={styles.detailContainer}>
          <View style={styles.detailDivider} />
          <Text style={styles.detailText}>{insight.detail}</Text>
        </View>
      )}

      {/* Actions */}
      {(insight.actionLabel || expanded) && (
        <View style={styles.actions}>
          {onSnooze && expanded && (
            <Pressable style={styles.snoozeButton} onPress={handleSnooze}>
              <Ionicons name="time-outline" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.snoozeText}>Later</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {insight.secondaryActionLabel && (
            <Pressable style={styles.secondaryAction} onPress={() => {
              if (insight.secondaryActionRoute) router.push(insight.secondaryActionRoute as any);
            }}>
              <Text style={styles.secondaryActionText}>{insight.secondaryActionLabel}</Text>
            </Pressable>
          )}
          {insight.actionLabel && (
            <Pressable style={styles.primaryAction} onPress={handlePrimaryAction}>
              <Text style={styles.primaryActionText}>{insight.actionLabel}</Text>
              <Ionicons name="chevron-forward" size={14} color={Palette.hermesOrange} />
            </Pressable>
          )}
        </View>
      )}

      {/* Expand indicator */}
      {!expanded && (insight.detail || insight.actionLabel) && (
        <View style={styles.expandHint}>
          <Ionicons name="chevron-down" size={14} color={SemanticColors.textTertiary} />
        </View>
      )}
    </Pressable>
  );
}

// =============================================================================
// INSIGHT LIST - Renders a list of insight cards with a header
// =============================================================================

interface VascoInsightListProps {
  insights: VascoInsight[];
  title?: string;
  maxVisible?: number;
  compact?: boolean;
  showSource?: boolean;
  onDismiss?: (id: string) => void;
  onAction?: (insight: VascoInsight) => void;
  onSnooze?: (id: string) => void;
}

export function VascoInsightList({
  insights,
  title = 'Vasco voor jou',
  maxVisible = 3,
  compact = false,
  showSource = true,
  onDismiss,
  onAction,
  onSnooze,
}: VascoInsightListProps) {
  const [showAll, setShowAll] = useState(false);

  const visibleInsights = showAll ? insights : insights.slice(0, maxVisible);
  const hasMore = insights.length > maxVisible;

  if (insights.length === 0) return null;

  return (
    <View style={styles.listContainer}>
      <View style={styles.listHeader}>
        <View style={styles.listTitleRow}>
          <Ionicons name="sparkles" size={16} color={Palette.hermesOrange} />
          <Text style={styles.listTitle}>{title}</Text>
        </View>
        <Text style={styles.listCount}>
          {insights.length} {insights.length === 1 ? 'inzicht' : 'inzichten'}
        </Text>
      </View>

      <View style={styles.listCards}>
        {visibleInsights.map(insight => (
          <VascoInsightCard
            key={insight.id}
            insight={insight}
            compact={compact}
            showSource={showSource}
            onDismiss={onDismiss}
            onAction={onAction}
            onSnooze={onSnooze}
          />
        ))}
      </View>

      {hasMore && !showAll && (
        <Pressable
          style={styles.showMoreButton}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowAll(true);
          }}
        >
          <Text style={styles.showMoreText}>
            Toon alle {insights.length} inzichten
          </Text>
          <Ionicons name="chevron-down" size={14} color={Palette.hermesOrange} />
        </Pressable>
      )}
    </View>
  );
}

// =============================================================================
// INLINE INSIGHT - Minimal single-line advice for embedding in any view
// =============================================================================

interface InlineInsightProps {
  icon?: IconName;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  onDismiss?: () => void;
}

export function InlineInsight({
  icon = 'bulb',
  message,
  actionLabel,
  actionRoute,
  onDismiss,
}: InlineInsightProps) {
  const router = useRouter();

  return (
    <View style={styles.inlineContainer}>
      <View style={styles.inlineIconContainer}>
        <Ionicons name={icon} size={14} color={Palette.hermesOrange} />
      </View>
      <Text style={styles.inlineMessage} numberOfLines={2}>{message}</Text>
      {actionLabel && actionRoute && (
        <Pressable
          style={styles.inlineAction}
          onPress={() => router.push(actionRoute as any)}
        >
          <Text style={styles.inlineActionText}>{actionLabel}</Text>
        </Pressable>
      )}
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={14} color={SemanticColors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // Card
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  cardActedOn: {
    borderLeftWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderColor: SemanticColors.feedbackSuccessBorder,
    padding: Spacing.sm,
  },
  actedOnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actedOnText: {
    fontSize: 13,
    color: SemanticColors.feedbackSuccess,
    fontWeight: '500',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  criticalBadge: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  criticalBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: SemanticColors.feedbackError,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  source: {
    fontSize: 11,
    color: Palette.hermesOrange,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Message
  message: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },

  // Metric
  metricContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.surfaceSecondary,
    padding: Spacing.sm,
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // Detail
  detailContainer: {
    gap: 8,
  },
  detailDivider: {
    height: 1,
    backgroundColor: SemanticColors.borderMuted,
  },
  detailText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  snoozeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  snoozeText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  secondaryAction: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  secondaryActionText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // Expand hint
  expandHint: {
    alignItems: 'center',
    marginTop: -4,
  },

  // Compact card
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  compactIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContent: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  compactMessage: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  compactDismiss: {
    padding: 4,
  },

  // List
  listContainer: {
    gap: Spacing.sm,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  listCount: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  listCards: {
    gap: Spacing.sm,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '500',
    color: Palette.hermesOrange,
  },

  // Inline
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange + '10',
    borderRadius: 8,
    padding: 10,
    paddingHorizontal: 12,
  },
  inlineIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineMessage: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  inlineAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
});
