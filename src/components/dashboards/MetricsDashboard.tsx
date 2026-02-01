import { useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import {
  METRIC_DEFINITIONS,
  MOCK_METRIC_VALUES,
  generateMetricsSummary,
  generateValueProposition,
  calculateHoursSavedValue,
  type MetricCategory,
  type MetricValue,
} from '../../modules/successMetrics';

type TabType = 'overview' | 'financial' | 'efficiency' | 'compliance' | 'risk' | 'quality';

export function MetricsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const summary = useMemo(() => generateMetricsSummary(MOCK_METRIC_VALUES, 'GBP'), []);
  const valueProposition = useMemo(() => generateValueProposition(summary), [summary]);

  const hoursSavedValue = useMemo(
    () => calculateHoursSavedValue(summary.hoursSaved, 75, 'GBP'),
    [summary.hoursSaved]
  );

  const getMetricsByCategory = (category: MetricCategory): MetricValue[] => {
    return MOCK_METRIC_VALUES.filter((v) => {
      const def = METRIC_DEFINITIONS.find((d) => d.id === v.metricId);
      return def?.category === category;
    });
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '↑';
      case 'declining':
        return '↓';
      default:
        return '→';
    }
  };

  const getTrendColor = (trend: string, direction: string) => {
    if (trend === 'stable') return Colors.muted;
    if (trend === 'improving') return Colors.success;
    if (trend === 'declining') {
      return direction === 'lower-better' ? Colors.success : Colors.danger;
    }
    return Colors.muted;
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'currency') return `£${value.toLocaleString()}`;
    if (unit === '%') return `${value}%`;
    if (unit === 'days') return `${value}d`;
    if (unit === 'hours') return `${value}h`;
    if (unit === 'minutes') return `${value}m`;
    return `${value} ${unit}`;
  };

  const renderMetricCard = (metricValue: MetricValue) => {
    const def = METRIC_DEFINITIONS.find((d) => d.id === metricValue.metricId);
    if (!def) return null;

    const trendColor = getTrendColor(metricValue.trend, def.direction);
    const isOnTarget = def.target
      ? def.direction === 'higher-better'
        ? metricValue.value >= def.target
        : metricValue.value <= def.target
      : true;

    return (
      <View key={metricValue.metricId} style={styles.metricCard}>
        <View style={styles.metricHeader}>
          <Text style={styles.metricName}>{def.name}</Text>
          {def.target && (
            <View style={[styles.targetBadge, isOnTarget ? styles.targetMet : styles.targetMissed]}>
              <Text style={[styles.targetBadgeText, isOnTarget ? styles.targetMetText : styles.targetMissedText]}>
                {isOnTarget ? 'On Target' : 'Off Target'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metricValueRow}>
          <Text style={styles.metricValue}>{formatValue(metricValue.value, def.unit)}</Text>
          {metricValue.percentChange !== undefined && (
            <View style={[styles.trendBadge, { backgroundColor: trendColor + '20' }]}>
              <Text style={[styles.trendText, { color: trendColor }]}>
                {getTrendIcon(metricValue.trend)} {Math.abs(metricValue.percentChange)}%
              </Text>
            </View>
          )}
        </View>

        {metricValue.previousValue !== undefined && (
          <Text style={styles.metricPrevious}>
            Previous: {formatValue(metricValue.previousValue, def.unit)}
          </Text>
        )}

        {def.target && (
          <View style={styles.targetRow}>
            <Text style={styles.targetLabel}>Target: {formatValue(def.target, def.unit)}</Text>
            {def.industryBenchmark && (
              <Text style={styles.benchmarkLabel}>
                Industry: {formatValue(def.industryBenchmark, def.unit)}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.metricDescription}>{def.description}</Text>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={Typography.title}>Success Metrics</Text>

      {/* Value Proposition Header */}
      <View style={styles.valueCard}>
        <Text style={styles.valueHeadline}>{valueProposition.headline}</Text>
        <View style={styles.valueGrid}>
          {valueProposition.metrics.map((metric, index) => (
            <View key={index} style={styles.valueItem}>
              <Text style={styles.valueNumber}>{metric.value}</Text>
              <Text style={styles.valueLabel}>{metric.label}</Text>
              {metric.comparison && (
                <Text style={styles.valueComparison}>{metric.comparison}</Text>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Tab Navigation */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <View style={styles.tabRow}>
          {(['overview', 'financial', 'efficiency', 'compliance', 'risk', 'quality'] as TabType[]).map(
            (tab) => (
              <Pressable
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </ScrollView>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* ROI Summary */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>ROI Summary</Text>
            <View style={styles.roiGrid}>
              <View style={styles.roiCard}>
                <Text style={styles.roiValue}>£{hoursSavedValue.value.toLocaleString()}</Text>
                <Text style={styles.roiLabel}>Monthly Value</Text>
                <Text style={styles.roiSubtext}>{summary.hoursSaved} hours @ £75/hr</Text>
              </View>
              <View style={styles.roiCard}>
                <Text style={styles.roiValue}>£{hoursSavedValue.annualized.toLocaleString()}</Text>
                <Text style={styles.roiLabel}>Annual Projection</Text>
                <Text style={styles.roiSubtext}>Based on current run rate</Text>
              </View>
            </View>
          </View>

          {/* Category Performance */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Performance by Category</Text>
            {summary.byCategory.map((cat) => (
              <View key={cat.category} style={styles.categoryRow}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>
                    {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}
                  </Text>
                  <Text style={styles.categorySubtext}>
                    {cat.metricsOnTarget}/{cat.metricsTotal} on target
                  </Text>
                </View>
                <View style={styles.categoryProgress}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${cat.percentOnTarget}%` },
                        cat.percentOnTarget >= 80 && styles.progressGreen,
                        cat.percentOnTarget >= 50 && cat.percentOnTarget < 80 && styles.progressYellow,
                        cat.percentOnTarget < 50 && styles.progressRed,
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercent}>{cat.percentOnTarget.toFixed(0)}%</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Top Improvements */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Top Improvements</Text>
            {summary.topImprovements.map((improvement) => (
              <View key={improvement.metricId} style={styles.improvementRow}>
                <View style={styles.improvementInfo}>
                  <Text style={styles.improvementName}>{improvement.metricName}</Text>
                </View>
                <View style={[styles.improvementBadge, styles.improvementPositive]}>
                  <Text style={styles.improvementText}>
                    {improvement.improvement > 0 ? '+' : ''}
                    {improvement.improvement.toFixed(0)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Attention Required */}
          {summary.attentionRequired.length > 0 && (
            <View style={[styles.card, styles.cardWarning]}>
              <Text style={Typography.subtitle}>Attention Required</Text>
              {summary.attentionRequired.map((item) => (
                <View key={item.metricId} style={styles.attentionRow}>
                  <View style={styles.attentionInfo}>
                    <Text style={styles.attentionName}>{item.metricName}</Text>
                    <Text style={styles.attentionSubtext}>
                      Current: {item.currentValue} {item.unit} | Target: {item.targetValue}{' '}
                      {item.unit}
                    </Text>
                  </View>
                  <View style={styles.gapBadge}>
                    <Text style={styles.gapText}>Gap: {item.gap}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* Category Tabs */}
      {activeTab !== 'overview' && (
        <View style={styles.metricsGrid}>
          {getMetricsByCategory(activeTab as MetricCategory).map(renderMetricCard)}
          {getMetricsByCategory(activeTab as MetricCategory).length === 0 && (
            <Text style={Typography.muted}>No metrics data available for this category</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 100,
  },
  valueCard: {
    backgroundColor: Colors.accentDeep + '15',
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accentDeep + '30',
  },
  valueHeadline: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  valueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  valueItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  valueNumber: {
    color: Colors.accentDeep,
    fontSize: 20,
    fontWeight: '700',
  },
  valueLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  valueComparison: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  tabScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.surface,
  },
  tabText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  cardWarning: {
    backgroundColor: Colors.warning + '08',
    borderColor: Colors.warning + '30',
  },
  roiGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roiCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  roiValue: {
    color: Colors.success,
    fontSize: 22,
    fontWeight: '700',
  },
  roiLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  roiSubtext: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  categorySubtext: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  categoryProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    width: 80,
    height: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.muted,
  },
  progressGreen: {
    backgroundColor: Colors.success,
  },
  progressYellow: {
    backgroundColor: Colors.warning,
  },
  progressRed: {
    backgroundColor: Colors.danger,
  },
  progressPercent: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    width: 35,
    textAlign: 'right',
  },
  improvementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  improvementInfo: {
    flex: 1,
  },
  improvementName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  improvementBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  improvementPositive: {
    backgroundColor: Colors.success + '20',
  },
  improvementText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  attentionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + '30',
  },
  attentionInfo: {
    flex: 1,
  },
  attentionName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  attentionSubtext: {
    color: Colors.warning,
    fontSize: 11,
    marginTop: 2,
  },
  gapBadge: {
    backgroundColor: Colors.warning + '20',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  gapText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  metricsGrid: {
    gap: Spacing.md,
  },
  metricCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  targetBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  targetMet: {
    backgroundColor: Colors.success + '20',
  },
  targetMissed: {
    backgroundColor: Colors.danger + '20',
  },
  targetBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  targetMetText: {
    color: Colors.success,
  },
  targetMissedText: {
    color: Colors.danger,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricValue: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  trendBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricPrevious: {
    color: Colors.muted,
    fontSize: 11,
  },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  targetLabel: {
    color: Colors.muted,
    fontSize: 11,
  },
  benchmarkLabel: {
    color: Colors.muted,
    fontSize: 11,
  },
  metricDescription: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
});
