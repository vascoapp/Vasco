// =============================================================================
// ANALYTICS DASHBOARD COMPONENT
// =============================================================================
// Comprehensive business analytics and performance insights UI
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useAnalytics,
  useBenchmarks,
  useInsights,
  useDashboardSummary,
  BenchmarkData,
  PerformanceInsight,
} from '../../services/analyticsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'overview' | 'revenue' | 'benchmarks' | 'insights';

export function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const summary = useDashboardSummary();
  const { revenue, profitability, customers, projects } = useAnalytics();
  const benchmarks = useBenchmarks();
  const { insights, highImpactInsights, dismissInsight, actOnInsight } = useInsights();

  const tabs: Array<{ key: TabType; label: string; icon: string }> = [
    { key: 'overview', label: 'Overzicht', icon: 'grid-outline' },
    { key: 'revenue', label: 'Omzet', icon: 'trending-up-outline' },
    { key: 'benchmarks', label: 'Benchmark', icon: 'podium-outline' },
    { key: 'insights', label: 'Inzichten', icon: 'bulb-outline' },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="cash-outline" size={20} color={Palette.emerald} />
            <Text style={styles.kpiLabel}>Omzet deze maand</Text>
          </View>
          <Text style={styles.kpiValue}>{formatCurrency(summary.revenue.value)}</Text>
          <View style={[styles.kpiChange, { backgroundColor: summary.revenue.change >= 0 ? Palette.emerald + '20' : Palette.red + '20' }]}>
            <Ionicons
              name={summary.revenue.change >= 0 ? 'arrow-up' : 'arrow-down'}
              size={12}
              color={summary.revenue.change >= 0 ? Palette.emerald : Palette.red}
            />
            <Text style={[styles.kpiChangeText, { color: summary.revenue.change >= 0 ? Palette.emerald : Palette.red }]}>
              {formatPercent(summary.revenue.change)}
            </Text>
          </View>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="wallet-outline" size={20} color={Palette.blue} />
            <Text style={styles.kpiLabel}>Nettowinst</Text>
          </View>
          <Text style={styles.kpiValue}>{formatCurrency(summary.profit.value)}</Text>
          <Text style={styles.kpiSubtext}>Marge: {summary.profit.margin}%</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="people-outline" size={20} color={Palette.purple} />
            <Text style={styles.kpiLabel}>Klanten</Text>
          </View>
          <Text style={styles.kpiValue}>{summary.customers.total}</Text>
          <Text style={styles.kpiSubtext}>+{summary.customers.new} deze maand</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="construct-outline" size={20} color={Palette.orange} />
            <Text style={styles.kpiLabel}>Projecten</Text>
          </View>
          <Text style={styles.kpiValue}>{summary.projects.active}</Text>
          <Text style={styles.kpiSubtext}>{summary.projects.completed} afgerond</Text>
        </View>
      </View>

      {/* Satisfaction Score */}
      <View style={styles.satisfactionCard}>
        <Text style={styles.sectionTitle}>Klanttevredenheid</Text>
        <View style={styles.satisfactionRow}>
          <View style={styles.satisfactionItem}>
            <View style={styles.satisfactionCircle}>
              <Text style={styles.satisfactionScore}>{summary.satisfaction.score}</Text>
              <Text style={styles.satisfactionMax}>/5</Text>
            </View>
            <Text style={styles.satisfactionLabel}>Gemiddeld</Text>
          </View>
          <View style={styles.satisfactionDivider} />
          <View style={styles.satisfactionItem}>
            <View style={[styles.satisfactionCircle, { backgroundColor: Palette.purple + '20' }]}>
              <Text style={[styles.satisfactionScore, { color: Palette.purple }]}>{summary.satisfaction.nps}</Text>
            </View>
            <Text style={styles.satisfactionLabel}>NPS Score</Text>
          </View>
        </View>
      </View>

      {/* High Impact Insights */}
      {highImpactInsights.length > 0 && (
        <View style={styles.insightsPreview}>
          <Text style={styles.sectionTitle}>Belangrijke inzichten</Text>
          {highImpactInsights.slice(0, 2).map((insight) => (
            <View key={insight.id} style={styles.insightPreviewCard}>
              <Ionicons
                name={insight.type === 'opportunity' ? 'bulb' : insight.type === 'achievement' ? 'trophy' : 'warning'}
                size={20}
                color={insight.type === 'opportunity' ? Palette.blue : insight.type === 'achievement' ? Palette.emerald : Palette.orange}
              />
              <View style={styles.insightPreviewContent}>
                <Text style={styles.insightPreviewTitle}>{insight.title}</Text>
                <Text style={styles.insightPreviewDesc} numberOfLines={1}>{insight.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={SemanticColors.textSecondary} />
            </View>
          ))}
        </View>
      )}

      {/* Projects by Category */}
      <View style={styles.categorySection}>
        <Text style={styles.sectionTitle}>Projecten per categorie</Text>
        {projects.projectsByCategory.map((cat, index) => (
          <View key={index} style={styles.categoryRow}>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{cat.category}</Text>
              <Text style={styles.categoryCount}>{cat.count} projecten</Text>
            </View>
            <Text style={styles.categoryRevenue}>{formatCurrency(cat.revenue)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderRevenueTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Revenue Summary */}
      <View style={styles.revenueSummary}>
        <View style={styles.revenueMain}>
          <Text style={styles.revenueLabel}>Totale omzet</Text>
          <Text style={styles.revenueTotal}>{formatCurrency(revenue.totalRevenue)}</Text>
        </View>
        <View style={styles.revenueStats}>
          <View style={styles.revenueStat}>
            <Text style={styles.revenueStatValue}>{formatCurrency(revenue.avgProjectValue)}</Text>
            <Text style={styles.revenueStatLabel}>Gem. project</Text>
          </View>
          <View style={styles.revenueStat}>
            <Text style={[styles.revenueStatValue, { color: Palette.emerald }]}>
              {formatPercent(revenue.revenueGrowth)}
            </Text>
            <Text style={styles.revenueStatLabel}>Groei</Text>
          </View>
        </View>
      </View>

      {/* Monthly Trend */}
      <View style={styles.trendSection}>
        <Text style={styles.sectionTitle}>Maandelijkse omzet</Text>
        <View style={styles.trendChart}>
          {revenue.monthlyTrend.map((month, index) => {
            const maxRevenue = Math.max(...revenue.monthlyTrend.map(m => m.revenue));
            const height = (month.revenue / maxRevenue) * 100;
            return (
              <View key={index} style={styles.trendBar}>
                <View style={[styles.trendBarFill, { height: `${height}%` }]} />
                <Text style={styles.trendBarLabel}>{month.month}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Profitability */}
      <View style={styles.profitSection}>
        <Text style={styles.sectionTitle}>Winstgevendheid</Text>
        <View style={styles.profitGrid}>
          <View style={styles.profitCard}>
            <Text style={styles.profitLabel}>Brutowinst</Text>
            <Text style={styles.profitValue}>{formatCurrency(profitability.grossProfit)}</Text>
            <Text style={styles.profitMargin}>{profitability.grossMargin}% marge</Text>
          </View>
          <View style={styles.profitCard}>
            <Text style={styles.profitLabel}>Nettowinst</Text>
            <Text style={styles.profitValue}>{formatCurrency(profitability.netProfit)}</Text>
            <Text style={styles.profitMargin}>{profitability.netMargin}% marge</Text>
          </View>
        </View>

        {/* Cost Breakdown */}
        <View style={styles.costBreakdown}>
          <Text style={styles.costTitle}>Kostenverdeling</Text>
          <View style={styles.costBar}>
            <View style={[styles.costSegment, { width: `${profitability.materialCostRatio}%`, backgroundColor: Palette.orange }]} />
            <View style={[styles.costSegment, { width: `${profitability.laborCostRatio}%`, backgroundColor: Palette.blue }]} />
            <View style={[styles.costSegment, { width: `${100 - profitability.materialCostRatio - profitability.laborCostRatio}%`, backgroundColor: Palette.emerald }]} />
          </View>
          <View style={styles.costLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Palette.orange }]} />
              <Text style={styles.legendText}>Materiaal {profitability.materialCostRatio}%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Palette.blue }]} />
              <Text style={styles.legendText}>Arbeid {profitability.laborCostRatio}%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Palette.emerald }]} />
              <Text style={styles.legendText}>Winst {(100 - profitability.materialCostRatio - profitability.laborCostRatio).toFixed(1)}%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Customer Revenue */}
      <View style={styles.customerRevenueSection}>
        <Text style={styles.sectionTitle}>Omzet per klanttype</Text>
        {customers.customersByType.map((type, index) => (
          <View key={index} style={styles.customerTypeRow}>
            <View style={styles.customerTypeInfo}>
              <Ionicons
                name={type.type === 'Particulier' ? 'person-outline' : 'business-outline'}
                size={20}
                color={SemanticColors.textSecondary}
              />
              <Text style={styles.customerTypeName}>{type.type}</Text>
              <Text style={styles.customerTypeCount}>({type.count} klanten)</Text>
            </View>
            <Text style={styles.customerTypeRevenue}>{formatCurrency(type.revenue)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderBenchmarkCard = (benchmark: BenchmarkData) => {
    const getPercentileColor = (percentile: number) => {
      if (percentile >= 75) return Palette.emerald;
      if (percentile >= 50) return Palette.blue;
      if (percentile >= 25) return Palette.orange;
      return Palette.red;
    };

    return (
      <View key={benchmark.metric} style={styles.benchmarkCard}>
        <View style={styles.benchmarkHeader}>
          <Text style={styles.benchmarkMetric}>{benchmark.metric}</Text>
          <View style={[styles.trendBadge, { backgroundColor: benchmark.trend === 'up' ? Palette.emerald + '20' : benchmark.trend === 'down' ? Palette.red + '20' : Palette.gray + '20' }]}>
            <Ionicons
              name={benchmark.trend === 'up' ? 'arrow-up' : benchmark.trend === 'down' ? 'arrow-down' : 'remove'}
              size={12}
              color={benchmark.trend === 'up' ? Palette.emerald : benchmark.trend === 'down' ? Palette.red : Palette.gray}
            />
          </View>
        </View>

        <View style={styles.benchmarkValues}>
          <View style={styles.benchmarkValue}>
            <Text style={styles.benchmarkValueLabel}>Jouw score</Text>
            <Text style={[styles.benchmarkValueNumber, { color: getPercentileColor(benchmark.percentile) }]}>
              {benchmark.yourValue}{benchmark.metric.includes('%') || benchmark.metric.includes('rate') ? '%' : ''}
            </Text>
          </View>
          <View style={styles.benchmarkValue}>
            <Text style={styles.benchmarkValueLabel}>Gemiddeld</Text>
            <Text style={styles.benchmarkValueNumber}>{benchmark.industryAvg}</Text>
          </View>
          <View style={styles.benchmarkValue}>
            <Text style={styles.benchmarkValueLabel}>Top 10%</Text>
            <Text style={styles.benchmarkValueNumber}>{benchmark.topPerformers}</Text>
          </View>
        </View>

        <View style={styles.percentileBar}>
          <View style={[styles.percentileFill, { width: `${benchmark.percentile}%`, backgroundColor: getPercentileColor(benchmark.percentile) }]} />
          <View style={[styles.percentileMarker, { left: `${benchmark.percentile}%` }]} />
        </View>
        <Text style={styles.percentileText}>Top {100 - benchmark.percentile}% van vergelijkbare bedrijven</Text>
      </View>
    );
  };

  const renderBenchmarksTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.benchmarkIntro}>
        <Ionicons name="analytics-outline" size={24} color={Palette.blue} />
        <Text style={styles.benchmarkIntroText}>
          Vergelijk je prestaties met andere aannemers in jouw regio en vakgebied.
        </Text>
      </View>

      {benchmarks.map(renderBenchmarkCard)}
    </ScrollView>
  );

  const renderInsightCard = (insight: PerformanceInsight) => {
    const getInsightStyle = (type: PerformanceInsight['type']) => {
      switch (type) {
        case 'opportunity': return { color: Palette.blue, icon: 'bulb' as const, bg: Palette.blue + '15' };
        case 'achievement': return { color: Palette.emerald, icon: 'trophy' as const, bg: Palette.emerald + '15' };
        case 'warning': return { color: Palette.orange, icon: 'warning' as const, bg: Palette.orange + '15' };
      }
    };

    const style = getInsightStyle(insight.type);

    return (
      <View key={insight.id} style={[styles.insightCard, { borderLeftColor: style.color }]}>
        <View style={[styles.insightIconBg, { backgroundColor: style.bg }]}>
          <Ionicons name={style.icon} size={20} color={style.color} />
        </View>
        <View style={styles.insightContent}>
          <View style={styles.insightHeader}>
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <View style={[styles.impactBadge, { backgroundColor: insight.impact === 'high' ? Palette.red + '20' : insight.impact === 'medium' ? Palette.orange + '20' : Palette.gray + '20' }]}>
              <Text style={[styles.impactText, { color: insight.impact === 'high' ? Palette.red : insight.impact === 'medium' ? Palette.orange : Palette.gray }]}>
                {insight.impact === 'high' ? 'Hoog' : insight.impact === 'medium' ? 'Middel' : 'Laag'}
              </Text>
            </View>
          </View>
          <Text style={styles.insightDescription}>{insight.description}</Text>

          {insight.actionable && insight.suggestedAction && (
            <View style={styles.suggestedAction}>
              <Ionicons name="arrow-forward-circle-outline" size={16} color={Palette.blue} />
              <Text style={styles.suggestedActionText}>{insight.suggestedAction}</Text>
            </View>
          )}

          <View style={styles.insightActions}>
            {insight.actionable && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => actOnInsight(insight.id)}
              >
                <Text style={styles.actionButtonText}>Actie ondernemen</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => dismissInsight(insight.id)}
            >
              <Text style={styles.dismissButtonText}>Verbergen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderInsightsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.insightsHeader}>
        <Text style={styles.insightsCount}>{insights.length} inzichten</Text>
        <Text style={styles.insightsHighImpact}>{highImpactInsights.length} belangrijk</Text>
      </View>

      {insights.map(renderInsightCard)}

      {insights.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={48} color={Palette.emerald} />
          <Text style={styles.emptyTitle}>Alles op orde!</Text>
          <Text style={styles.emptyText}>Er zijn momenteel geen nieuwe inzichten.</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? Palette.blue : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'revenue' && renderRevenueTab()}
      {activeTab === 'benchmarks' && renderBenchmarksTab()}
      {activeTab === 'insights' && renderInsightsTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  activeTab: {
    backgroundColor: Palette.blue + '15',
  },
  tabText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Palette.blue,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.text,
    marginBottom: 4,
  },
  kpiChange: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  kpiChangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  kpiSubtext: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Satisfaction
  satisfactionCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 12,
  },
  satisfactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  satisfactionItem: {
    alignItems: 'center',
  },
  satisfactionCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Palette.emerald + '20',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  satisfactionScore: {
    fontSize: 28,
    fontWeight: '700',
    color: Palette.emerald,
  },
  satisfactionMax: {
    fontSize: 14,
    color: Palette.emerald,
    marginTop: 8,
  },
  satisfactionLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  satisfactionDivider: {
    width: 1,
    height: 60,
    backgroundColor: SemanticColors.border,
  },

  // Insights Preview
  insightsPreview: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  insightPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
    gap: 12,
  },
  insightPreviewContent: {
    flex: 1,
  },
  insightPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 2,
  },
  insightPreviewDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Category Section
  categorySection: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.text,
  },
  categoryCount: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  categoryRevenue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
  },

  // Revenue Tab
  revenueSummary: {
    backgroundColor: Palette.blue,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  revenueMain: {
    marginBottom: 16,
  },
  revenueLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  revenueTotal: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  revenueStats: {
    flexDirection: 'row',
    gap: 24,
  },
  revenueStat: {},
  revenueStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  revenueStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },

  // Trend Chart
  trendSection: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 8,
  },
  trendBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  trendBarFill: {
    width: '60%',
    backgroundColor: Palette.blue,
    borderRadius: 4,
    minHeight: 4,
  },
  trendBarLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    marginTop: 6,
  },

  // Profit Section
  profitSection: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  profitGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  profitCard: {
    flex: 1,
    backgroundColor: SemanticColors.background,
    borderRadius: 8,
    padding: 12,
  },
  profitLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  profitValue: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  profitMargin: {
    fontSize: 12,
    color: Palette.emerald,
  },
  costBreakdown: {
    marginTop: 8,
  },
  costTitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginBottom: 8,
  },
  costBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  costSegment: {
    height: '100%',
  },
  costLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },

  // Customer Revenue
  customerRevenueSection: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  customerTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  customerTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerTypeName: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.text,
  },
  customerTypeCount: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  customerTypeRevenue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
  },

  // Benchmarks Tab
  benchmarkIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.blue + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  benchmarkIntroText: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.text,
    lineHeight: 20,
  },
  benchmarkCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  benchmarkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  benchmarkMetric: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  trendBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benchmarkValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  benchmarkValue: {
    alignItems: 'center',
  },
  benchmarkValueLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginBottom: 2,
  },
  benchmarkValueNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  percentileBar: {
    height: 6,
    backgroundColor: SemanticColors.border,
    borderRadius: 3,
    marginBottom: 6,
    position: 'relative',
  },
  percentileFill: {
    height: '100%',
    borderRadius: 3,
  },
  percentileMarker: {
    position: 'absolute',
    top: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: SemanticColors.text,
    marginLeft: -5,
  },
  percentileText: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },

  // Insights Tab
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  insightsCount: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  insightsHighImpact: {
    fontSize: 13,
    color: Palette.red,
    fontWeight: '600',
  },
  insightCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    borderLeftWidth: 4,
    flexDirection: 'row',
    gap: 12,
  },
  insightIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
    flex: 1,
  },
  impactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  impactText: {
    fontSize: 10,
    fontWeight: '600',
  },
  insightDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  suggestedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.blue + '10',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  suggestedActionText: {
    flex: 1,
    fontSize: 13,
    color: Palette.blue,
  },
  insightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Palette.blue,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  dismissButtonText: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
});
