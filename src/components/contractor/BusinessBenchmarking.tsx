// =============================================================================
// BUSINESS BENCHMARKING COMPONENT
// =============================================================================
// Industry benchmarking, performance goals, and competitive analysis
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useBenchmarkCategories,
  usePerformanceGoals,
  useImprovementOpportunities,
  useCompetitivePosition,
  useBenchmarkStats,
  BenchmarkCategory,
  BenchmarkMetric,
  PerformanceGoal,
  ImprovementOpportunity,
} from '../../services/businessBenchmarkingService';

// =============================================================================
// TYPES
// =============================================================================

type TabType = 'benchmarks' | 'goals' | 'opportunities';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const StatusBadge: React.FC<{ status: BenchmarkMetric['status'] }> = ({ status }) => {
  const getConfig = () => {
    switch (status) {
      case 'excellent':
        return { label: 'Uitstekend', color: Palette.green500, bg: "rgba(34, 197, 94, 0.15)" };
      case 'good':
        return { label: 'Goed', color: Palette.blue500, bg: "rgba(59, 130, 246, 0.15)" };
      case 'average':
        return { label: 'Gemiddeld', color: Palette.yellow600, bg: "rgba(234, 179, 8, 0.15)" };
      case 'below_average':
        return { label: 'Onder gem.', color: Palette.orange500, bg: Palette.orange100 };
      case 'poor':
        return { label: 'Slecht', color: Palette.red500, bg: "rgba(239, 68, 68, 0.15)" };
      default:
        return { label: status, color: Palette.gray500, bg: Palette.gray100 };
    }
  };

  const config = getConfig();
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const TrendIndicator: React.FC<{ trend: BenchmarkMetric['trend']; percentage: number }> = ({
  trend,
  percentage,
}) => {
  const getConfig = () => {
    switch (trend) {
      case 'up':
        return { icon: 'trending-up', color: Palette.green500 };
      case 'down':
        return { icon: 'trending-down', color: Palette.red500 };
      case 'stable':
        return { icon: 'remove', color: Palette.gray500 };
      default:
        return { icon: 'remove', color: Palette.gray500 };
    }
  };

  const config = getConfig();
  return (
    <View style={styles.trendContainer}>
      <Ionicons name={config.icon as keyof typeof Ionicons.glyphMap} size={16} color={config.color} />
      {percentage !== 0 && (
        <Text style={[styles.trendText, { color: config.color }]}>
          {percentage > 0 ? '+' : ''}{percentage}%
        </Text>
      )}
    </View>
  );
};

const PercentileBar: React.FC<{ percentile: number }> = ({ percentile }) => {
  const getColor = () => {
    if (percentile >= 75) return Palette.green500;
    if (percentile >= 50) return Palette.blue500;
    if (percentile >= 25) return Palette.orange500;
    return Palette.red500;
  };

  return (
    <View style={styles.percentileContainer}>
      <View style={styles.percentileBar}>
        <View style={[styles.percentileFill, { width: `${percentile}%`, backgroundColor: getColor() }]} />
        <View style={[styles.percentileMarker, { left: '50%' }]} />
      </View>
      <Text style={styles.percentileText}>{percentile}e percentiel</Text>
    </View>
  );
};

const MetricCard: React.FC<{
  metric: BenchmarkMetric;
  onSetGoal: () => void;
}> = ({ metric, onSetGoal }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.metricCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.metricHeader}>
        <View style={styles.metricInfo}>
          <Text style={styles.metricName}>{metric.name}</Text>
          <Text style={styles.metricDescription}>{metric.description}</Text>
        </View>
        <StatusBadge status={metric.status} />
      </View>

      <View style={styles.metricValues}>
        <View style={styles.valueItem}>
          <Text style={styles.valueLabel}>Jouw waarde</Text>
          <Text style={styles.yourValue}>
            {metric.unit === '€' ? '€' : ''}{metric.yourValue}{metric.unit !== '€' ? ` ${metric.unit}` : ''}
          </Text>
          <TrendIndicator trend={metric.trend} percentage={metric.trendPercentage} />
        </View>
        <View style={styles.valueDivider} />
        <View style={styles.valueItem}>
          <Text style={styles.valueLabel}>Branche gem.</Text>
          <Text style={styles.industryValue}>
            {metric.unit === '€' ? '€' : ''}{metric.industryAvg}{metric.unit !== '€' ? ` ${metric.unit}` : ''}
          </Text>
        </View>
        <View style={styles.valueDivider} />
        <View style={styles.valueItem}>
          <Text style={styles.valueLabel}>Top 10%</Text>
          <Text style={styles.topValue}>
            {metric.unit === '€' ? '€' : ''}{metric.topPerformers}{metric.unit !== '€' ? ` ${metric.unit}` : ''}
          </Text>
        </View>
      </View>

      <PercentileBar percentile={metric.percentile} />

      {expanded && metric.recommendations && metric.recommendations.length > 0 && (
        <View style={styles.expandedContent}>
          <Text style={styles.recommendationsTitle}>Aanbevelingen</Text>
          {metric.recommendations.map((rec, index) => (
            <View key={index} style={styles.recommendationItem}>
              <Ionicons name="bulb-outline" size={14} color={Palette.yellow600} />
              <Text style={styles.recommendationText}>{rec}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.setGoalButton} onPress={onSetGoal}>
            <Ionicons name="flag-outline" size={16} color={Palette.white} />
            <Text style={styles.setGoalButtonText}>Doel Instellen</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const CategorySection: React.FC<{
  category: BenchmarkCategory;
  onSetGoal: (metricId: string) => void;
}> = ({ category, onSetGoal }) => (
  <View style={styles.categorySection}>
    <View style={styles.categoryHeader}>
      <Text style={styles.categoryName}>{category.name}</Text>
      <Text style={styles.categoryDescription}>{category.description}</Text>
    </View>
    {category.metrics.map(metric => (
      <MetricCard
        key={metric.id}
        metric={metric}
        onSetGoal={() => onSetGoal(metric.id)}
      />
    ))}
  </View>
);

const GoalCard: React.FC<{ goal: PerformanceGoal }> = ({ goal }) => {
  const daysUntilDeadline = Math.ceil(
    (goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const getStatusColor = () => {
    switch (goal.status) {
      case 'on_track':
        return Palette.green500;
      case 'at_risk':
        return Palette.orange500;
      case 'behind':
        return Palette.red500;
      default:
        return Palette.gray500;
    }
  };

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={styles.goalInfo}>
          <Text style={styles.goalMetric}>{goal.metricName}</Text>
          <Text style={styles.goalDeadline}>
            {daysUntilDeadline > 0 ? `${daysUntilDeadline} dagen` : 'Verlopen'}
          </Text>
        </View>
        <View style={[styles.goalStatusBadge, { backgroundColor: getStatusColor() + '20' }]}>
          <View style={[styles.goalStatusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.goalStatusText, { color: getStatusColor() }]}>
            {goal.status === 'on_track' ? 'Op koers' : goal.status === 'at_risk' ? 'Risico' : 'Achter'}
          </Text>
        </View>
      </View>

      <View style={styles.goalProgress}>
        <View style={styles.goalValues}>
          <Text style={styles.goalCurrentValue}>{goal.currentValue}</Text>
          <Ionicons name="arrow-forward" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.goalTargetValue}>{goal.targetValue}</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${goal.progress}%`, backgroundColor: getStatusColor() },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{goal.progress}% voltooid</Text>
      </View>
    </View>
  );
};

const OpportunityCard: React.FC<{
  opportunity: ImprovementOpportunity;
  onExplore: () => void;
}> = ({ opportunity, onExplore }) => {
  const [expanded, setExpanded] = useState(false);

  const getImpactColor = () => {
    switch (opportunity.potentialImpact) {
      case 'high':
        return Palette.green500;
      case 'medium':
        return Palette.orange500;
      case 'low':
        return Palette.gray500;
      default:
        return Palette.gray500;
    }
  };

  return (
    <TouchableOpacity
      style={styles.opportunityCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.opportunityHeader}>
        <View style={styles.priorityBadge}>
          <Text style={styles.priorityText}>#{opportunity.priority}</Text>
        </View>
        <View style={styles.opportunityInfo}>
          <Text style={styles.opportunityTitle}>{opportunity.title}</Text>
          <Text style={styles.opportunityCategory}>{opportunity.category}</Text>
        </View>
      </View>

      <Text style={styles.opportunityDescription}>{opportunity.description}</Text>

      <View style={styles.opportunityMeta}>
        <View style={styles.impactBadge}>
          <Ionicons name="flash" size={14} color={getImpactColor()} />
          <Text style={[styles.impactText, { color: getImpactColor() }]}>
            {opportunity.potentialImpact === 'high' ? 'Hoge' : opportunity.potentialImpact === 'medium' ? 'Gemiddelde' : 'Lage'} impact
          </Text>
        </View>
        {opportunity.estimatedRevenue && (
          <View style={styles.revenueBadge}>
            <Ionicons name="cash" size={14} color={Palette.green500} />
            <Text style={styles.revenueText}>+€{opportunity.estimatedRevenue.toLocaleString()}</Text>
          </View>
        )}
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.metricsSection}>
            <View style={styles.metricComparison}>
              <Text style={styles.comparisonLabel}>Huidige waarde</Text>
              <Text style={styles.comparisonValue}>{opportunity.currentValue}</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={SemanticColors.textSecondary} />
            <View style={styles.metricComparison}>
              <Text style={styles.comparisonLabel}>Doelwaarde</Text>
              <Text style={[styles.comparisonValue, { color: Palette.green500 }]}>
                {opportunity.targetValue}
              </Text>
            </View>
          </View>

          <View style={styles.actionsSection}>
            <Text style={styles.actionsTitle}>Actiepunten</Text>
            {opportunity.actions.map((action, index) => (
              <View key={index} style={styles.actionItem}>
                <View style={styles.actionNumber}>
                  <Text style={styles.actionNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.actionText}>{action}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.exploreButton} onPress={onExplore}>
            <Text style={styles.exploreButtonText}>Start Verbetering</Text>
            <Ionicons name="arrow-forward" size={18} color={Palette.white} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const OverallScoreCard: React.FC<{
  score: number;
  percentile: number;
  strength: string;
  opportunity: string;
}> = ({ score, percentile, strength, opportunity }) => (
  <View style={styles.overallScoreCard}>
    <View style={styles.scoreCircle}>
      <Text style={styles.scoreValue}>{score}</Text>
      <Text style={styles.scoreMax}>/10</Text>
    </View>
    <View style={styles.scoreInfo}>
      <Text style={styles.scoreTitle}>Totaalscore</Text>
      <Text style={styles.scorePercentile}>{percentile}e percentiel in de branche</Text>
    </View>
    <View style={styles.scoreHighlights}>
      <View style={styles.highlightItem}>
        <Ionicons name="arrow-up-circle" size={16} color={Palette.green500} />
        <Text style={styles.highlightLabel}>Sterkste:</Text>
        <Text style={styles.highlightValue}>{strength}</Text>
      </View>
      <View style={styles.highlightItem}>
        <Ionicons name="arrow-up-circle-outline" size={16} color={Palette.orange500} />
        <Text style={styles.highlightLabel}>Kans:</Text>
        <Text style={styles.highlightValue}>{opportunity}</Text>
      </View>
    </View>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const BusinessBenchmarking: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('benchmarks');
  const { benchmarks, loading } = useBenchmarkCategories();
  const { goals, setGoal } = usePerformanceGoals();
  const opportunities = useImprovementOpportunities();
  const stats = useBenchmarkStats();

  const handleSetGoal = (metricId: string) => {
    // Would open goal setting modal
    console.log('Set goal for metric:', metricId);
  };

  const handleExploreOpportunity = (opportunity: ImprovementOpportunity) => {
    console.log('Explore opportunity:', opportunity.id);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'benchmarks':
        return (
          <View style={styles.tabContent}>
            <OverallScoreCard
              score={stats.overallScore}
              percentile={stats.percentile}
              strength={stats.biggestStrength}
              opportunity={stats.biggestOpportunity}
            />

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Benchmarks laden...</Text>
              </View>
            ) : (
              benchmarks.map(category => (
                <CategorySection
                  key={category.id}
                  category={category}
                  onSetGoal={handleSetGoal}
                />
              ))
            )}
          </View>
        );

      case 'goals':
        return (
          <View style={styles.tabContent}>
            <View style={styles.goalsHeader}>
              <View style={styles.goalsStats}>
                <View style={styles.goalsStat}>
                  <Text style={styles.goalsStatValue}>{stats.goalsOnTrack}</Text>
                  <Text style={styles.goalsStatLabel}>Op koers</Text>
                </View>
                <View style={styles.goalsStatDivider} />
                <View style={styles.goalsStat}>
                  <Text style={styles.goalsStatValue}>{stats.totalGoals}</Text>
                  <Text style={styles.goalsStatLabel}>Totaal</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.addGoalButton}>
                <Ionicons name="add" size={18} color={Palette.white} />
                <Text style={styles.addGoalButtonText}>Nieuw Doel</Text>
              </TouchableOpacity>
            </View>

            {goals.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="flag-outline" size={48} color={SemanticColors.textSecondary} />
                <Text style={styles.emptyText}>Geen doelen ingesteld</Text>
                <Text style={styles.emptySubtext}>
                  Stel doelen in om je voortgang te volgen
                </Text>
              </View>
            ) : (
              goals.map(goal => <GoalCard key={goal.id} goal={goal} />)
            )}
          </View>
        );

      case 'opportunities':
        return (
          <View style={styles.tabContent}>
            <View style={styles.opportunitiesHeader}>
              <Text style={styles.opportunitiesTitle}>Verbeterkansen</Text>
              <Text style={styles.opportunitiesSubtitle}>
                Gesorteerd op prioriteit en potentiële impact
              </Text>
            </View>

            {opportunities.map(opportunity => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                onExplore={() => handleExploreOpportunity(opportunity)}
              />
            ))}
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Benchmarking</Text>
        <TouchableOpacity style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color={SemanticColors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'benchmarks', label: 'Prestaties', icon: 'analytics-outline' },
          { key: 'goals', label: 'Doelen', icon: 'flag-outline' },
          { key: 'opportunities', label: 'Kansen', icon: 'bulb-outline' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <Ionicons
              name={tab.icon as keyof typeof Ionicons.glyphMap}
              size={18}
              color={activeTab === tab.key ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.surfaceBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceBackground,
    gap: 6,
  },
  tabActive: {
    backgroundColor: SemanticColors.actionPrimary + '15',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: SemanticColors.actionPrimary,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: SemanticColors.textSecondary,
    fontSize: 16,
  },
  overallScoreCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: SemanticColors.actionPrimary,
  },
  scoreMax: {
    fontSize: 20,
    color: SemanticColors.textSecondary,
    marginLeft: 4,
  },
  scoreInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  scorePercentile: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  scoreHighlights: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  highlightLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  highlightValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  categoryDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  metricCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metricInfo: {
    flex: 1,
    marginRight: 12,
  },
  metricName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  metricDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricValues: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  valueItem: {
    flex: 1,
    alignItems: 'center',
  },
  valueLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  yourValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  industryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  topValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.green500,
  },
  valueDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  percentileContainer: {
    gap: 4,
  },
  percentileBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  percentileFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentileMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: SemanticColors.textSecondary,
  },
  percentileText: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    textAlign: 'right',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  setGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  setGoalButtonText: {
    color: Palette.white,
    fontWeight: '600',
    fontSize: 14,
  },
  goalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalsStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  goalsStat: {
    alignItems: 'center',
  },
  goalsStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  goalsStatLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  goalsStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
  },
  addGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addGoalButtonText: {
    color: Palette.white,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: SemanticColors.textPrimary,
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  goalCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalInfo: {
    flex: 1,
  },
  goalMetric: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  goalDeadline: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  goalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  goalStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  goalStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  goalProgress: {
    gap: 8,
  },
  goalValues: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  goalCurrentValue: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  goalTargetValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Palette.green500,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  opportunitiesHeader: {
    marginBottom: 16,
  },
  opportunitiesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  opportunitiesSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  opportunityCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  opportunityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  priorityBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  priorityText: {
    color: Palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
  opportunityInfo: {
    flex: 1,
  },
  opportunityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  opportunityCategory: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  opportunityDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  opportunityMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  impactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  impactText: {
    fontSize: 13,
    fontWeight: '500',
  },
  revenueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  revenueText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.green600,
  },
  metricsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 16,
  },
  metricComparison: {
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  actionsSection: {
    marginBottom: 16,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 10,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: SemanticColors.actionPrimary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actionNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.textPrimary,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  exploreButtonText: {
    color: Palette.white,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default BusinessBenchmarking;
