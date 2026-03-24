// =============================================================================
// ROI DASHBOARD - Comprehensive Business Intelligence View
// =============================================================================
// Full ROI metrics dashboard with CFO-native language
// a16z pattern: ROI expressed in hard operational metrics
// =============================================================================

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import {
  useROIMetrics,
  useROIDashboard,
  useROIInsights,
  useROIGoals,
  useAutomationROI,
} from '../../services';
import { HoursSavedCard } from './HoursSavedCard';
import type { ROIInsight, ROIGoal } from '../../types/roi-metrics';

type IconName = keyof typeof Ionicons.glyphMap;

type TimePeriod = 'week' | 'month' | 'quarter';

interface ROIDashboardProps {
  onClose?: () => void;
}

export function ROIDashboard({ onClose }: ROIDashboardProps) {
  const [period, setPeriod] = useState<TimePeriod>('month');
  const metrics = useROIMetrics();
  const dashboard = useROIDashboard();
  const { insights } = useROIInsights() as any;
  const { goals } = useROIGoals();
  const automationROI = useAutomationROI();
  const isLoading = !metrics;

  if (isLoading || !dashboard) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading metrics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textSecondary} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>Business ROI</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['week', 'month', 'quarter'] as TimePeriod[]).map((p) => (
          <Pressable
            key={p}
            style={[styles.periodButton, period === p && styles.periodButtonActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero Metrics */}
        <View style={styles.heroSection}>
          <Text style={styles.sectionTitle}>Key Performance</Text>
          <View style={styles.heroGrid}>
            <HeroMetric
              icon="time"
              value={`${dashboard.quoteToCashDays}d`}
              label="Quote-to-Cash"
              trend={dashboard.quoteToCashTrend}
              benchmark={42}
              benchmarkLabel="Industry avg"
            />
            <HeroMetric
              icon="trophy"
              value={`${dashboard.quoteWinRate}%`}
              label="Quote Win Rate"
              trend={dashboard.quoteWinRateTrend}
              benchmark={45}
              benchmarkLabel="Industry avg"
            />
            <HeroMetric
              icon="cash"
              value={`€${dashboard.effectiveHourlyRate}`}
              label="Effective Rate"
              trend={dashboard.effectiveHourlyRateTrend}
              benchmark={55}
              benchmarkLabel="Industry avg"
            />
          </View>
        </View>

        {/* Hours Saved */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time Savings</Text>
          <HoursSavedCard />
        </View>

        {/* Automation ROI */}
        {automationROI && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Automation ROI</Text>
            <View style={styles.roiCard}>
              <View style={styles.roiHeader}>
                <View style={styles.roiIcon}>
                  <Ionicons name="trending-up" size={24} color={SemanticColors.feedbackSuccess} />
                </View>
                <View style={styles.roiContent}>
                  <Text style={styles.roiMultiple}>{automationROI.roiMultiple.toFixed(1)}x</Text>
                  <Text style={styles.roiLabel}>Return on Investment</Text>
                </View>
              </View>
              <View style={styles.roiBreakdown}>
                {automationROI.breakdown.map((item: any, index: number) => (
                  <View key={index} style={styles.roiBreakdownItem}>
                    <Text style={styles.roiBreakdownLabel}>{item.category}</Text>
                    <Text style={styles.roiBreakdownValue}>
                      €{item.value.toLocaleString(undefined)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.roiTotal}>
                <Text style={styles.roiTotalLabel}>Total Value Generated</Text>
                <Text style={styles.roiTotalValue}>
                  €{automationROI.totalValue.toLocaleString(undefined)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Benchmark Comparisons */}
        {dashboard.vsBenchmark && dashboard.vsBenchmark.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>vs. Industry Benchmark</Text>
            <View style={styles.benchmarkList}>
              {dashboard.vsBenchmark.map((item: any, index: number) => (
                <BenchmarkItem key={index} item={item} />
              ))}
            </View>
          </View>
        )}

        {/* Active Goals */}
        {goals && goals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Goals Progress</Text>
              <Pressable style={styles.addGoalButton}>
                <Ionicons name="add" size={16} color={SemanticColors.actionPrimary} />
                <Text style={styles.addGoalText}>Add Goal</Text>
              </Pressable>
            </View>
            <View style={styles.goalsList}>
              {goals.map((goal: any) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </View>
          </View>
        )}

        {/* Insights */}
        {insights && insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insights & Opportunities</Text>
            <View style={styles.insightsList}>
              {insights.slice(0, 5).map((insight: any) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </View>
          </View>
        )}

        {/* Detailed Metrics */}
        {metrics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detailed Metrics</Text>
            <View style={styles.metricsGrid}>
              <MetricTile
                label="Quote to Job"
                value={`${metrics.quoteToJobDays.value}d`}
                trend={metrics.quoteToJobDays.trend}
                isGood={metrics.quoteToJobDays.isGood}
              />
              <MetricTile
                label="Job to Cash"
                value={`${metrics.jobToCashDays.value}d`}
                trend={metrics.jobToCashDays.trend}
                isGood={metrics.jobToCashDays.isGood}
              />
              <MetricTile
                label="Avg Payment"
                value={`${metrics.avgInvoicePaymentDays.value}d`}
                trend={metrics.avgInvoicePaymentDays.trend}
                isGood={metrics.avgInvoicePaymentDays.isGood}
              />
              <MetricTile
                label="Utilization"
                value={`${metrics.utilizationRate.value}%`}
                trend={metrics.utilizationRate.trend}
                isGood={metrics.utilizationRate.isGood}
              />
              <MetricTile
                label="Material Margin"
                value={`${metrics.materialMargin.value}%`}
                trend={metrics.materialMargin.trend}
                isGood={metrics.materialMargin.isGood}
              />
              <MetricTile
                label="First-Time Fix"
                value={`${metrics.firstTimeFixRate.value}%`}
                trend={metrics.firstTimeFixRate.trend}
                isGood={metrics.firstTimeFixRate.isGood}
              />
            </View>
          </View>
        )}

        {/* Tier Win Rates */}
        {metrics?.winRateByTier && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quote Tier Performance</Text>
            <View style={styles.tierCard}>
              <View style={styles.tierGrid}>
                <TierItem
                  tier="Good"
                  rate={metrics.winRateByTier.good.rate}
                  count={metrics.winRateByTier.good.count}
                  revenue={metrics.winRateByTier.good.revenue}
                  color="#10B981"
                />
                <TierItem
                  tier="Better"
                  rate={metrics.winRateByTier.better.rate}
                  count={metrics.winRateByTier.better.count}
                  revenue={metrics.winRateByTier.better.revenue}
                  color="#3B82F6"
                />
                <TierItem
                  tier="Best"
                  rate={metrics.winRateByTier.best.rate}
                  count={metrics.winRateByTier.best.count}
                  revenue={metrics.winRateByTier.best.revenue}
                  color="#8B5CF6"
                />
              </View>
              <View style={styles.tierInsight}>
                <Ionicons name="bulb" size={14} color={Palette.hermesOrange} />
                <Text style={styles.tierInsightText}>
                  {metrics.winRateByTier.insight}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Hero Metric Component
function HeroMetric({
  icon,
  value,
  label,
  trend,
  benchmark,
  benchmarkLabel,
}: {
  icon: IconName;
  value: string;
  label: string;
  trend: 'improving' | 'stable' | 'declining';
  benchmark?: number;
  benchmarkLabel?: string;
}) {
  const trendIcon: IconName =
    trend === 'improving' ? 'trending-up' : trend === 'declining' ? 'trending-down' : 'remove';
  const trendColor =
    trend === 'improving'
      ? SemanticColors.feedbackSuccess
      : trend === 'declining'
        ? SemanticColors.feedbackError
        : SemanticColors.textSecondary;

  return (
    <View style={styles.heroMetric}>
      <View style={styles.heroMetricIcon}>
        <Ionicons name={icon} size={20} color={SemanticColors.actionPrimary} />
      </View>
      <Text style={styles.heroMetricValue}>{value}</Text>
      <Text style={styles.heroMetricLabel}>{label}</Text>
      <View style={styles.heroMetricTrend}>
        <Ionicons name={trendIcon} size={12} color={trendColor} />
        <Text style={[styles.heroMetricTrendText, { color: trendColor }]}>
          {trend.charAt(0).toUpperCase() + trend.slice(1)}
        </Text>
      </View>
      {benchmark && (
        <Text style={styles.heroMetricBenchmark}>
          {benchmarkLabel}: {benchmark}
        </Text>
      )}
    </View>
  );
}

// Benchmark Item Component
function BenchmarkItem({
  item,
}: {
  item: {
    metric: string;
    yourValue: number;
    benchmark: number;
    percentDiff: number;
    isAbove: boolean;
  };
}) {
  return (
    <View style={styles.benchmarkItem}>
      <View style={styles.benchmarkHeader}>
        <Text style={styles.benchmarkMetric}>{item.metric}</Text>
        <View
          style={[
            styles.benchmarkBadge,
            {
              backgroundColor: item.isAbove
                ? SemanticColors.feedbackSuccessBg
                : SemanticColors.feedbackWarningBg,
            },
          ]}
        >
          <Ionicons
            name={item.isAbove ? 'arrow-up' : 'arrow-down'}
            size={10}
            color={item.isAbove ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning}
          />
          <Text
            style={[
              styles.benchmarkBadgeText,
              {
                color: item.isAbove ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning,
              },
            ]}
          >
            {Math.abs(item.percentDiff)}%
          </Text>
        </View>
      </View>
      <View style={styles.benchmarkBar}>
        <View style={styles.benchmarkTrack}>
          <View
            style={[
              styles.benchmarkYours,
              {
                width: `${Math.min((item.yourValue / Math.max(item.yourValue, item.benchmark)) * 100, 100)}%`,
              },
            ]}
          />
          <View
            style={[
              styles.benchmarkMarker,
              {
                left: `${Math.min((item.benchmark / Math.max(item.yourValue, item.benchmark)) * 100, 100)}%`,
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.benchmarkValues}>
        <Text style={styles.benchmarkYourValue}>You: {item.yourValue}</Text>
        <Text style={styles.benchmarkAvgValue}>Avg: {item.benchmark}</Text>
      </View>
    </View>
  );
}

// Goal Card Component
function GoalCard({ goal }: { goal: ROIGoal }) {
  const statusColor =
    goal.status === 'achieved'
      ? SemanticColors.feedbackSuccess
      : goal.status === 'on-track'
        ? SemanticColors.actionPrimary
        : goal.status === 'at-risk'
          ? SemanticColors.feedbackWarning
          : SemanticColors.feedbackError;

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <Text style={styles.goalMetric}>{goal.metricName}</Text>
        <View style={[styles.goalStatus, { backgroundColor: statusColor + '15' }]}>
          <Text style={[styles.goalStatusText, { color: statusColor }]}>
            {goal.status.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
        </View>
      </View>
      <View style={styles.goalProgress}>
        <View style={styles.goalProgressBar}>
          <View
            style={[
              styles.goalProgressFill,
              { width: `${Math.min(goal.progress, 100)}%`, backgroundColor: statusColor },
            ]}
          />
        </View>
        <Text style={styles.goalProgressText}>{goal.progress}%</Text>
      </View>
      <View style={styles.goalValues}>
        <Text style={styles.goalCurrent}>
          Current: {goal.currentValue} {goal.unit}
        </Text>
        <Text style={styles.goalTarget}>
          Target: {goal.targetValue} {goal.unit}
        </Text>
      </View>
    </View>
  );
}

// Insight Card Component
function InsightCard({ insight }: { insight: ROIInsight }) {
  const typeConfig = {
    positive: { icon: 'trending-up' as IconName, color: SemanticColors.feedbackSuccess },
    negative: { icon: 'trending-down' as IconName, color: SemanticColors.feedbackError },
    neutral: { icon: 'information-circle' as IconName, color: SemanticColors.feedbackInfo },
    opportunity: { icon: 'bulb' as IconName, color: Palette.hermesOrange },
  };

  const config = typeConfig[insight.type];

  return (
    <View style={styles.insightCard}>
      <View style={[styles.insightIcon, { backgroundColor: config.color + '15' }]}>
        <Ionicons name={config.icon} size={16} color={config.color} />
      </View>
      <View style={styles.insightContent}>
        <Text style={styles.insightTitle}>{insight.title}</Text>
        <Text style={styles.insightDescription} numberOfLines={2}>
          {insight.description}
        </Text>
        {insight.impact && (
          <View style={styles.insightImpact}>
            <Text
              style={[
                styles.insightImpactValue,
                { color: insight.impact.isPositive ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError },
              ]}
            >
              {insight.impact.isPositive ? '+' : '-'}
              {insight.impact.value} {insight.impact.unit}
            </Text>
          </View>
        )}
      </View>
      {insight.actionable && (
        <Pressable style={styles.insightAction}>
          <Ionicons name="chevron-forward" size={16} color={SemanticColors.actionPrimary} />
        </Pressable>
      )}
    </View>
  );
}

// Metric Tile Component
function MetricTile({
  label,
  value,
  trend,
  isGood,
}: {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  isGood: boolean;
}) {
  const trendIcon: IconName =
    trend === 'up' ? 'arrow-up' : trend === 'down' ? 'arrow-down' : 'remove';

  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricTileValue}>{value}</Text>
      <Text style={styles.metricTileLabel}>{label}</Text>
      <View style={styles.metricTileTrend}>
        <Ionicons
          name={trendIcon}
          size={10}
          color={isGood ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning}
        />
      </View>
    </View>
  );
}

// Tier Item Component
function TierItem({
  tier,
  rate,
  count,
  revenue,
  color,
}: {
  tier: string;
  rate: number;
  count: number;
  revenue: number;
  color: string;
}) {
  return (
    <View style={styles.tierItem}>
      <View style={[styles.tierIndicator, { backgroundColor: color }]} />
      <Text style={styles.tierName}>{tier}</Text>
      <Text style={styles.tierRate}>{rate}%</Text>
      <Text style={styles.tierCount}>{count} quotes</Text>
      <Text style={styles.tierRevenue}>€{(revenue / 1000).toFixed(1)}k</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  headerRight: {
    width: 40,
  },
  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.xs,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  periodButtonActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  periodTextActive: {
    color: '#fff',
  },
  // Content
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 100,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  addGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addGoalText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  // Hero Section
  heroSection: {
    gap: Spacing.sm,
  },
  heroGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  heroMetric: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  heroMetricIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SemanticColors.actionPrimary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroMetricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  heroMetricLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  heroMetricTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  heroMetricTrendText: {
    fontSize: 10,
    fontWeight: '500',
  },
  heroMetricBenchmark: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  // ROI Card
  roiCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  roiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  roiIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roiContent: {
    flex: 1,
  },
  roiMultiple: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  roiLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  roiBreakdown: {
    gap: Spacing.xs,
  },
  roiBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roiBreakdownLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  roiBreakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  roiTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  roiTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  roiTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  // Benchmarks
  benchmarkList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  benchmarkItem: {
    gap: Spacing.xs,
  },
  benchmarkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  benchmarkMetric: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  benchmarkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  benchmarkBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  benchmarkBar: {
    height: 8,
    position: 'relative',
  },
  benchmarkTrack: {
    height: '100%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  benchmarkYours: {
    height: '100%',
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 4,
  },
  benchmarkMarker: {
    position: 'absolute',
    top: -2,
    width: 3,
    height: 12,
    backgroundColor: SemanticColors.textTertiary,
    borderRadius: 2,
    transform: [{ translateX: -1.5 }],
  },
  benchmarkValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  benchmarkYourValue: {
    fontSize: 11,
    color: SemanticColors.actionPrimary,
    fontWeight: '600',
  },
  benchmarkAvgValue: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  // Goals
  goalsList: {
    gap: Spacing.sm,
  },
  goalCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalMetric: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  goalStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  goalStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  goalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  goalProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    minWidth: 36,
    textAlign: 'right',
  },
  goalValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalCurrent: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  goalTarget: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  // Insights
  insightsList: {
    gap: Spacing.sm,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  insightDescription: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  insightImpact: {
    marginTop: 4,
  },
  insightImpactValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  insightAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricTile: {
    width: '31%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  metricTileValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  metricTileLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  metricTileTrend: {
    marginTop: 4,
  },
  // Tier Card
  tierCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  tierGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tierItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tierIndicator: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  tierName: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  tierRate: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  tierCount: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  tierRevenue: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  tierInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Palette.hermesOrange + '10',
    borderRadius: 8,
    padding: Spacing.sm,
  },
  tierInsightText: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
});
