// =============================================================================
// VASCO INSIGHT CARD - Reusable AI guidance component for all views
// =============================================================================
// Actionable AI advice cards that can be used across any screen and role.
// Supports expand/collapse, primary action, dismiss, and snooze.
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { recordInteraction, recordInsightOutcome } from '../../intelligence/learningStorage';
import type { ScoredInsight, ReasoningChain } from '../../intelligence/generators/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type IconName = keyof typeof Ionicons.glyphMap;

export type InsightPriority = 'critical' | 'high' | 'medium' | 'low';
export type InsightCategory = 'alert' | 'opportunity' | 'compliance' | 'financial' | 'schedule' | 'tip' | 'weather' | 'operational' | 'operations' | 'safety' | 'quality';

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

function isScoredInsight(insight: VascoInsight): insight is ScoredInsight {
  return 'reasoning' in insight && 'confidence' in insight && 'generatorId' in insight;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#16A34A';
  if (confidence >= 0.5) return Palette.hermesOrange;
  return SemanticColors.textTertiary;
}

// Category labels are now resolved via i18n in the component

export function VascoInsightCard({
  insight,
  onDismiss,
  onAction,
  onSnooze,
  compact = false,
  showSource = true,
}: VascoInsightCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [actedOn, setActedOn] = useState(false);
  const [outcomeRecorded, setOutcomeRecorded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const viewedRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  const expandedAtRef = useRef<number | null>(null);

  const scored = isScoredInsight(insight);
  const generatorId = scored ? (insight as ScoredInsight).generatorId : 'unknown';
  const screenCtx = scored ? ((insight as ScoredInsight).shownOnScreen || '') : '';

  // Track 'viewed' on mount
  useEffect(() => {
    if (!viewedRef.current) {
      viewedRef.current = true;
      recordInteraction({
        insightId: insight.id,
        generatorId,
        action: 'viewed',
        timestamp: new Date().toISOString(),
        screenContext: screenCtx,
        category: insight.category,
      });
    }
  }, [insight.id, generatorId, insight.category]);

  // Track 'ignored' — visible 5s+ without interaction
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!expanded && !actedOn) {
        recordInteraction({
          insightId: insight.id,
          generatorId,
          action: 'ignored',
          timestamp: new Date().toISOString(),
          screenContext: screenCtx,
          category: insight.category,
          dwellTimeMs: 5000,
        });
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [insight.id, generatorId, expanded, actedOn, insight.category]);

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => {
      if (!prev) {
        // Opening: record expand and save timestamp
        expandedAtRef.current = Date.now();
        recordInteraction({
          insightId: insight.id,
          generatorId,
          action: 'expanded',
          timestamp: new Date().toISOString(),
          screenContext: screenCtx,
          category: insight.category,
        });
      } else if (expandedAtRef.current) {
        // Closing: record dwell time as a second expanded interaction
        const dwellMs = Date.now() - expandedAtRef.current;
        recordInteraction({
          insightId: insight.id,
          generatorId,
          action: 'expanded',
          timestamp: new Date().toISOString(),
          screenContext: screenCtx,
          category: insight.category,
          dwellTimeMs: dwellMs,
        });
        expandedAtRef.current = null;
      }
      return !prev;
    });
  }, [insight.id, generatorId]);

  const toggleReasoning = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowReasoning(prev => !prev);
  }, []);

  const handlePrimaryAction = useCallback(() => {
    recordInteraction({
      insightId: insight.id,
      generatorId,
      action: 'acted',
      timestamp: new Date().toISOString(),
      screenContext: screenCtx,
      category: insight.category,
      dwellTimeMs: Date.now() - mountTimeRef.current,
    });

    // Layer 5: Execute AI action if available
    const insightAction = (insight as any).action;
    if (insightAction && insightAction.type) {
      import('../../intelligence/actionExecutor').then(({ executeActionWithConfirmation }) => {
        executeActionWithConfirmation(insightAction, insight.id, generatorId, (result) => {
          if (result.success && result.data?.route) {
            router.push(result.data.route as any);
          }
        });
      }).catch(() => {});
      setActedOn(true);
      return;
    }

    if (onAction) {
      onAction(insight);
    }
    if (insight.actionRoute) {
      router.push(insight.actionRoute as any);
    }
    setActedOn(true);
  }, [insight, onAction, router, generatorId]);

  const handleDismiss = useCallback(() => {
    recordInteraction({
      insightId: insight.id,
      generatorId,
      action: 'dismissed',
      timestamp: new Date().toISOString(),
      screenContext: screenCtx,
      category: insight.category,
      dwellTimeMs: Date.now() - mountTimeRef.current,
    });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onDismiss?.(insight.id);
  }, [insight.id, onDismiss, generatorId]);

  const handleSnooze = useCallback(() => {
    recordInteraction({
      insightId: insight.id,
      generatorId,
      action: 'snoozed',
      timestamp: new Date().toISOString(),
      screenContext: screenCtx,
      category: insight.category,
    });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSnooze?.(insight.id);
  }, [insight.id, onSnooze, generatorId]);

  const priorityColor = getPriorityColor(insight.priority);
  const priorityBg = getPriorityBg(insight.priority);

  const handleOutcome = useCallback((outcome: 'positive' | 'negative') => {
    recordInsightOutcome(insight.id, generatorId, outcome);
    setOutcomeRecorded(true);
  }, [insight.id, generatorId]);

  if (actedOn) {
    return (
      <View style={[styles.card, styles.cardActedOn]}>
        <View style={styles.actedOnContent}>
          <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.actedOnText}>
            {outcomeRecorded ? t('insights.thanksFeedback', 'Bedankt voor je feedback') : insight.actionLabel ? `${insight.actionLabel} — ${t('common.done', 'klaar')}` : t('insights.handled', 'Afgehandeld')}
          </Text>
        </View>
        {!outcomeRecorded ? (
          <View style={styles.outcomeFeedback}>
            <Text style={styles.outcomeLabel}>{t('insights.helpful', 'Nuttig?')}</Text>
            <Pressable onPress={() => handleOutcome('positive')} hitSlop={8} style={styles.outcomeButton}>
              <Ionicons name="thumbs-up-outline" size={14} color={SemanticColors.feedbackSuccess} />
            </Pressable>
            <Pressable onPress={() => handleOutcome('negative')} hitSlop={8} style={styles.outcomeButton}>
              <Ionicons name="thumbs-down-outline" size={14} color={SemanticColors.textTertiary} />
            </Pressable>
            <Pressable onPress={handleDismiss} hitSlop={8}>
              <Ionicons name="close" size={14} color={SemanticColors.textTertiary} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={handleDismiss} hitSlop={8}>
            <Ionicons name="close" size={16} color={SemanticColors.textTertiary} />
          </Pressable>
        )}
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
            <Text style={styles.title} numberOfLines={1}>{insight.title}</Text>
            {insight.priority === 'critical' && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalBadgeText}>{t('insights.urgent', 'URGENT')}</Text>
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

      {/* Reasoning toggle — only for ScoredInsight */}
      {scored && expanded && (
        <View style={styles.reasoningSection}>
          <Pressable style={styles.reasoningToggle} onPress={toggleReasoning}>
            <Ionicons name="help-circle-outline" size={14} color={SemanticColors.textTertiary} />
            <Text style={styles.reasoningToggleText}>{t('insights.why', 'Waarom?')}</Text>
            <Ionicons
              name={showReasoning ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={SemanticColors.textTertiary}
            />
          </Pressable>

          {showReasoning && (
            <View style={styles.reasoningCard}>
              <View style={styles.reasoningHeader}>
                <Text style={styles.reasoningEvidence}>
                  {(insight as ScoredInsight).reasoning.evidence}
                </Text>
                <View style={styles.confidenceRow}>
                  <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor((insight as ScoredInsight).confidence) + '18' }]}>
                    <Text style={[styles.confidenceText, { color: getConfidenceColor((insight as ScoredInsight).confidence) }]}>
                      {Math.round((insight as ScoredInsight).confidence * 100)}% {t('insights.confident', 'zeker')}
                    </Text>
                    <Ionicons name="bar-chart" size={10} color={getConfidenceColor((insight as ScoredInsight).confidence)} />
                  </View>
                  {(insight as ScoredInsight).confidenceWarning && (
                    <View style={[styles.confidenceBadge, { backgroundColor: Palette.hermesOrange + '15', marginLeft: 6 }]}>
                      <Ionicons name="flask-outline" size={10} color={Palette.hermesOrange} />
                      <Text style={[styles.confidenceText, { color: Palette.hermesOrange }]}>
                        {(insight as ScoredInsight).confidenceWarning}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.reasoningRow}>
                <Text style={styles.reasoningLabel}>{t('insights.observation', 'Observatie')}</Text>
                <Text style={styles.reasoningValue}>{(insight as ScoredInsight).reasoning.observation}</Text>
              </View>
              <View style={styles.reasoningRow}>
                <Text style={styles.reasoningLabel}>{t('insights.impact', 'Impact')}</Text>
                <Text style={styles.reasoningValue}>{(insight as ScoredInsight).reasoning.implication}</Text>
              </View>
              <View style={styles.reasoningRow}>
                <Text style={styles.reasoningLabel}>{t('insights.advice', 'Advies')}</Text>
                <Text style={styles.reasoningValue}>{(insight as ScoredInsight).reasoning.suggestion}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      {(insight.actionLabel || expanded) && (
        <View style={styles.actions}>
          {onSnooze && expanded && (
            <Pressable style={styles.snoozeButton} onPress={handleSnooze}>
              <Ionicons name="time-outline" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.snoozeText}>{t('common.later', 'Later')}</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {insight.secondaryActionLabel && (
            <Pressable style={styles.secondaryAction} onPress={() => {
              if (insight.secondaryActionRoute) router.push(insight.secondaryActionRoute as any);
            }}>
              <Text style={styles.secondaryActionText} numberOfLines={1}>{insight.secondaryActionLabel}</Text>
            </Pressable>
          )}
          {(insight.actionLabel || (insight as any).action?.label) && (
            <Pressable style={styles.primaryAction} onPress={handlePrimaryAction}>
              <Ionicons name={(insight as any).action ? 'flash' : 'chevron-forward'} size={14} color={Palette.hermesOrange} />
              <Text style={styles.primaryActionText} numberOfLines={1}>{(insight as any).action?.label ?? insight.actionLabel}</Text>
              {(insight as any).action?.estimatedImpact && (
                <Text style={{ fontSize: TYPE.tinySize - 1, color: SemanticColors.feedbackSuccess, fontFamily: 'Inter_400Regular' }} numberOfLines={1}>
                  {(insight as any).action.estimatedImpact}
                </Text>
              )}
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
  title,
  maxVisible = 3,
  compact = false,
  showSource = true,
  onDismiss,
  onAction,
  onSnooze,
}: VascoInsightListProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('insights.vascoForYou', 'Vasco voor jou');
  const [showAll, setShowAll] = useState(false);

  const visibleInsights = showAll ? insights : insights.slice(0, maxVisible);
  const hasMore = insights.length > maxVisible;

  if (insights.length === 0) return null;

  return (
    <View style={styles.listContainer}>
      <View style={styles.listHeader}>
        <View style={styles.listTitleRow}>
          <Ionicons name="sparkles" size={16} color={Palette.hermesOrange} />
          <Text style={styles.listTitle}>{resolvedTitle}</Text>
        </View>
        <Text style={styles.listCount}>
          {t('insights.insightCount', { defaultValue: '{{count}} insights', count: insights.length })}
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
            {t('insights.showAll', { defaultValue: 'Toon alle {{count}} inzichten', count: insights.length })}
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
    borderRadius: RADIUS.md,
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
    fontSize: TYPE.captionSize,
    color: SemanticColors.feedbackSuccess,
    fontFamily: TYPE.labelFamily,
    flex: 1,
  },
  outcomeFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  outcomeLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },
  outcomeButton: {
    padding: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
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
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
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
    fontSize: TYPE.tinySize - 2,
    fontFamily: TYPE.sectionFamily,
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
    fontSize: TYPE.tinySize,
    color: Palette.hermesOrange,
    fontFamily: TYPE.labelFamily,
  },
  timestamp: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },

  // Message
  message: {
    fontSize: TYPE.captionSize,
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
    borderRadius: RADIUS.sm,
  },
  metricLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.sectionFamily,
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
    fontSize: TYPE.captionSize,
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
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    fontFamily: TYPE.labelFamily,
  },
  secondaryAction: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  secondaryActionText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    fontFamily: TYPE.labelFamily,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  primaryActionText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
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
    borderRadius: RADIUS.sm,
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
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  compactMessage: {
    fontSize: TYPE.tinySize,
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
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  listCount: {
    fontSize: TYPE.labelSize,
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
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
  },

  // Reasoning
  reasoningSection: {
    gap: 6,
  },
  reasoningToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  reasoningToggleText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
  },
  reasoningCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
  },
  reasoningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reasoningEvidence: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    flex: 1,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  reasoningRow: {
    gap: 2,
  },
  reasoningLabel: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  reasoningValue: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },

  // Inline
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange + '10',
    borderRadius: RADIUS.sm,
    padding: 10,
    paddingHorizontal: 12,
  },
  inlineIconContainer: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineMessage: {
    flex: 1,
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  inlineAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineActionText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
});
