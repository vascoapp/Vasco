// =============================================================================
// INTELLIGENCE DASHBOARD
// =============================================================================
// Shows the value of the data moat to contractors
// Aggregated insights, savings, market position, and personalized recommendations
// =============================================================================

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import { RecommendationFeedbackList } from '../contractor/RecommendationFeedback';
import { useRecommendationFeedback } from '../../hooks/useRecommendationFeedback';

type IconName = keyof typeof Ionicons.glyphMap;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// MOCK DATA
// ============================================

interface IntelligenceStats {
  totalSavingsAllTime: number;
  savingsThisMonth: number;
  priceAlertsActedOn: number;
  dataContributions: number;
  marketPositionPercentile: number;
  recommendationsAccepted: number;
  recommendationsTotal: number;
}

interface MarketInsight {
  id: string;
  title: string;
  description: string;
  trend: 'up' | 'down' | 'stable';
  value: string;
  change: string;
  category: 'pricing' | 'demand' | 'preference';
}

interface PeerComparison {
  metric: string;
  yourValue: number;
  peerAverage: number;
  unit: string;
  isHigherBetter: boolean;
}

const MOCK_STATS: IntelligenceStats = {
  totalSavingsAllTime: 4280,
  savingsThisMonth: 385,
  priceAlertsActedOn: 47,
  dataContributions: 156,
  marketPositionPercentile: 78,
  recommendationsAccepted: 34,
  recommendationsTotal: 52,
};

const MOCK_MARKET_INSIGHTS: MarketInsight[] = [
  {
    id: 'insight_1',
    title: 'Verf prijzen dalen',
    description: 'Gemiddelde verfprijs in Noord-Holland is 8% gedaald t.o.v. vorige maand',
    trend: 'down',
    value: '€24.50/L',
    change: '-8%',
    category: 'pricing',
  },
  {
    id: 'insight_2',
    title: 'Grohe vraag stijgt',
    description: 'Klanten in jouw regio kiezen 23% vaker voor Grohe kranen',
    trend: 'up',
    value: '67%',
    change: '+23%',
    category: 'preference',
  },
  {
    id: 'insight_3',
    title: 'Badkamer renovaties populair',
    description: 'Vraag naar badkamer projecten is 15% gestegen deze maand',
    trend: 'up',
    value: '+15%',
    change: 'vs vorige maand',
    category: 'demand',
  },
  {
    id: 'insight_4',
    title: 'Tegelprijzen stabiel',
    description: 'Keramische tegels blijven stabiel rond €35/m²',
    trend: 'stable',
    value: '€35/m²',
    change: '0%',
    category: 'pricing',
  },
];

const MOCK_PEER_COMPARISONS: PeerComparison[] = [
  { metric: 'Gemiddelde marge', yourValue: 32, peerAverage: 28, unit: '%', isHigherBetter: true },
  { metric: 'Offerte conversie', yourValue: 45, peerAverage: 38, unit: '%', isHigherBetter: true },
  { metric: 'Inkoop per project', yourValue: 1250, peerAverage: 1480, unit: '€', isHigherBetter: false },
  { metric: 'Klant tevredenheid', yourValue: 4.7, peerAverage: 4.2, unit: '★', isHigherBetter: true },
];

// ============================================
// COMPONENTS
// ============================================

interface IntelligenceDashboardProps {
  onClose?: () => void;
}

export function IntelligenceDashboard({ onClose }: IntelligenceDashboardProps) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'market' | 'savings' | 'tips'>('overview');

  const {
    recommendations,
    acceptRecommendation,
    rejectRecommendation,
    dismissRecommendation,
    refresh: refreshRecommendations,
  } = useRecommendationFeedback({ source: 'all' });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshRecommendations();
    setRefreshing(false);
  }, [refreshRecommendations]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Intelligence</Text>
          <Text style={styles.headerSubtitle}>Inzichten uit jouw data</Text>
        </View>
        <View style={styles.dataScore}>
          <Ionicons name="sparkles" size={14} color={Palette.hermesOrange} />
          <Text style={styles.dataScoreText}>{MOCK_STATS.dataContributions}</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { id: 'overview', label: 'Overzicht', icon: 'grid' as IconName },
          { id: 'market', label: 'Markt', icon: 'trending-up' as IconName },
          { id: 'savings', label: 'Besparingen', icon: 'wallet' as IconName },
          { id: 'tips', label: 'Tips', icon: 'bulb' as IconName, badge: recommendations.length },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={activeTab === tab.id ? Palette.hermesOrange : SemanticColors.textTertiary}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge && tab.badge > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'overview' && <OverviewTab stats={MOCK_STATS} peerComparisons={MOCK_PEER_COMPARISONS} />}
        {activeTab === 'market' && <MarketTab insights={MOCK_MARKET_INSIGHTS} />}
        {activeTab === 'savings' && <SavingsTab stats={MOCK_STATS} />}
        {activeTab === 'tips' && (
          <TipsTab
            recommendations={recommendations}
            onAccept={acceptRecommendation}
            onReject={rejectRecommendation}
            onDismiss={dismissRecommendation}
          />
        )}

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

function OverviewTab({ stats, peerComparisons }: { stats: IntelligenceStats; peerComparisons: PeerComparison[] }) {
  return (
    <View style={styles.tabContent}>
      {/* Hero Stats */}
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Ionicons name="trending-down" size={32} color={SemanticColors.feedbackSuccess} />
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>Totaal Bespaard</Text>
          <Text style={styles.heroValue}>{formatCurrency(stats.totalSavingsAllTime)}</Text>
          <Text style={styles.heroSubtext}>
            {formatCurrency(stats.savingsThisMonth)} deze maand · {stats.priceAlertsActedOn} deals gepakt
          </Text>
        </View>
      </View>

      {/* Data Contribution Score */}
      <View style={styles.contributionCard}>
        <View style={styles.contributionHeader}>
          <Ionicons name="sparkles" size={20} color={Palette.hermesOrange} />
          <Text style={styles.contributionTitle}>Jouw Data Bijdrage</Text>
        </View>
        <View style={styles.contributionScore}>
          <Text style={styles.contributionValue}>{stats.dataContributions}</Text>
          <Text style={styles.contributionLabel}>datapunten</Text>
        </View>
        <View style={styles.contributionBreakdown}>
          <View style={styles.contributionItem}>
            <Ionicons name="receipt-outline" size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.contributionItemText}>Bonnen gescand</Text>
            <Text style={styles.contributionItemValue}>23</Text>
          </View>
          <View style={styles.contributionItem}>
            <Ionicons name="checkbox-outline" size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.contributionItemText}>Klant beslissingen</Text>
            <Text style={styles.contributionItemValue}>87</Text>
          </View>
          <View style={styles.contributionItem}>
            <Ionicons name="thumbs-up-outline" size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.contributionItemText}>Feedback gegeven</Text>
            <Text style={styles.contributionItemValue}>46</Text>
          </View>
        </View>
        <View style={styles.contributionNote}>
          <Ionicons name="information-circle" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.contributionNoteText}>
            Meer data = betere aanbevelingen voor jou
          </Text>
        </View>
      </View>

      {/* Market Position */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Jouw Marktpositie</Text>
        <View style={styles.marketPositionCard}>
          <View style={styles.positionHeader}>
            <Text style={styles.positionLabel}>Je scoort beter dan</Text>
            <Text style={styles.positionValue}>{stats.marketPositionPercentile}%</Text>
            <Text style={styles.positionSuffix}>van vergelijkbare aannemers</Text>
          </View>
          <View style={styles.positionBar}>
            <View style={[styles.positionFill, { width: `${stats.marketPositionPercentile}%` }]} />
            <View style={[styles.positionMarker, { left: `${stats.marketPositionPercentile}%` }]} />
          </View>
        </View>
      </View>

      {/* Peer Comparison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vergelijking met Collega's</Text>
        <View style={styles.peerGrid}>
          {peerComparisons.map((comparison, index) => {
            const isWinning = comparison.isHigherBetter
              ? comparison.yourValue > comparison.peerAverage
              : comparison.yourValue < comparison.peerAverage;

            return (
              <View key={index} style={styles.peerCard}>
                <Text style={styles.peerMetric}>{comparison.metric}</Text>
                <View style={styles.peerComparison}>
                  <View style={styles.peerYou}>
                    <Text style={[styles.peerValue, isWinning && styles.peerValueWinning]}>
                      {comparison.unit === '€' ? formatCurrency(comparison.yourValue) : `${comparison.yourValue}${comparison.unit}`}
                    </Text>
                    <Text style={styles.peerLabel}>Jij</Text>
                  </View>
                  <View style={styles.peerVs}>
                    <Ionicons
                      name={isWinning ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={isWinning ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning}
                    />
                  </View>
                  <View style={styles.peerAvg}>
                    <Text style={styles.peerAvgValue}>
                      {comparison.unit === '€' ? formatCurrency(comparison.peerAverage) : `${comparison.peerAverage}${comparison.unit}`}
                    </Text>
                    <Text style={styles.peerLabel}>Gem.</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Recommendation Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Aanbevelingen</Text>
        <View style={styles.recStatsCard}>
          <View style={styles.recStatItem}>
            <Text style={styles.recStatValue}>{stats.recommendationsAccepted}</Text>
            <Text style={styles.recStatLabel}>Opgevolgd</Text>
          </View>
          <View style={styles.recStatDivider} />
          <View style={styles.recStatItem}>
            <Text style={styles.recStatValue}>
              {Math.round((stats.recommendationsAccepted / stats.recommendationsTotal) * 100)}%
            </Text>
            <Text style={styles.recStatLabel}>Hit rate</Text>
          </View>
          <View style={styles.recStatDivider} />
          <View style={styles.recStatItem}>
            <Text style={styles.recStatValue}>{formatCurrency(Math.round(stats.totalSavingsAllTime / stats.recommendationsAccepted))}</Text>
            <Text style={styles.recStatLabel}>Per tip</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function MarketTab({ insights }: { insights: MarketInsight[] }) {
  const getCategoryConfig = (category: MarketInsight['category']) => {
    switch (category) {
      case 'pricing':
        return { label: 'Prijzen', color: SemanticColors.feedbackSuccess, icon: 'cash' as IconName };
      case 'demand':
        return { label: 'Vraag', color: Palette.hermesOrange, icon: 'trending-up' as IconName };
      case 'preference':
        return { label: 'Voorkeur', color: Palette.blue500, icon: 'heart' as IconName };
    }
  };

  const getTrendIcon = (trend: MarketInsight['trend']): IconName => {
    switch (trend) {
      case 'up': return 'arrow-up';
      case 'down': return 'arrow-down';
      case 'stable': return 'remove';
    }
  };

  const getTrendColor = (trend: MarketInsight['trend']) => {
    switch (trend) {
      case 'up': return SemanticColors.feedbackSuccess;
      case 'down': return SemanticColors.feedbackError;
      case 'stable': return SemanticColors.textTertiary;
    }
  };

  return (
    <View style={styles.tabContent}>
      {/* Region Header */}
      <View style={styles.regionHeader}>
        <Ionicons name="location" size={18} color={Palette.hermesOrange} />
        <Text style={styles.regionText}>Noord-Holland</Text>
        <Pressable style={styles.regionChange}>
          <Text style={styles.regionChangeText}>Wijzigen</Text>
        </Pressable>
      </View>

      {/* Insights List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Markt Inzichten</Text>
        {insights.map((insight) => {
          const categoryConfig = getCategoryConfig(insight.category);
          return (
            <View key={insight.id} style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '15' }]}>
                  <Ionicons name={categoryConfig.icon} size={12} color={categoryConfig.color} />
                  <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
                    {categoryConfig.label}
                  </Text>
                </View>
                <View style={styles.trendBadge}>
                  <Ionicons
                    name={getTrendIcon(insight.trend)}
                    size={14}
                    color={getTrendColor(insight.trend)}
                  />
                  <Text style={[styles.trendText, { color: getTrendColor(insight.trend) }]}>
                    {insight.change}
                  </Text>
                </View>
              </View>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightDescription}>{insight.description}</Text>
              <View style={styles.insightValue}>
                <Text style={styles.insightValueText}>{insight.value}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Data Source Note */}
      <View style={styles.dataSourceNote}>
        <Ionicons name="shield-checkmark" size={14} color={SemanticColors.textTertiary} />
        <Text style={styles.dataSourceText}>
          Gebaseerd op {MOCK_STATS.dataContributions}+ datapunten van aannemers in jouw regio
        </Text>
      </View>
    </View>
  );
}

function SavingsTab({ stats }: { stats: IntelligenceStats }) {
  const savingsHistory = [
    { month: 'Jan', amount: 312 },
    { month: 'Feb', amount: 385 },
    { month: 'Dec', amount: 428 },
    { month: 'Nov', amount: 256 },
    { month: 'Okt', amount: 389 },
    { month: 'Sep', amount: 467 },
  ];

  const maxAmount = Math.max(...savingsHistory.map(h => h.amount));

  return (
    <View style={styles.tabContent}>
      {/* Total Savings Hero */}
      <View style={styles.savingsHero}>
        <Text style={styles.savingsHeroLabel}>Totaal Bespaard</Text>
        <Text style={styles.savingsHeroValue}>{formatCurrency(stats.totalSavingsAllTime)}</Text>
        <View style={styles.savingsHeroStats}>
          <View style={styles.savingsHeroStat}>
            <Text style={styles.savingsHeroStatValue}>{stats.priceAlertsActedOn}</Text>
            <Text style={styles.savingsHeroStatLabel}>Deals gepakt</Text>
          </View>
          <View style={styles.savingsHeroStatDivider} />
          <View style={styles.savingsHeroStat}>
            <Text style={styles.savingsHeroStatValue}>{formatCurrency(Math.round(stats.totalSavingsAllTime / stats.priceAlertsActedOn))}</Text>
            <Text style={styles.savingsHeroStatLabel}>Per deal</Text>
          </View>
        </View>
      </View>

      {/* Monthly Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Besparingen per Maand</Text>
        <View style={styles.chartContainer}>
          {savingsHistory.map((item, index) => (
            <View key={index} style={styles.chartBar}>
              <View
                style={[
                  styles.chartBarFill,
                  {
                    height: `${(item.amount / maxAmount) * 100}%`,
                    backgroundColor: index === 1 ? Palette.hermesOrange : SemanticColors.feedbackSuccess,
                  },
                ]}
              />
              <Text style={styles.chartBarLabel}>{item.month}</Text>
              <Text style={styles.chartBarValue}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Top Savings Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meeste Besparingen</Text>
        <View style={styles.categoryList}>
          {[
            { name: 'Verf & Coatings', amount: 1840, icon: 'color-palette' as IconName },
            { name: 'Sanitair', amount: 1250, icon: 'water' as IconName },
            { name: 'Gereedschap', amount: 680, icon: 'hammer' as IconName },
            { name: 'Overig', amount: 510, icon: 'cube' as IconName },
          ].map((cat, index) => (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryIcon}>
                <Ionicons name={cat.icon} size={18} color={Palette.hermesOrange} />
              </View>
              <View style={styles.categoryContent}>
                <Text style={styles.categoryName}>{cat.name}</Text>
                <View style={styles.categoryProgress}>
                  <View
                    style={[
                      styles.categoryProgressFill,
                      { width: `${(cat.amount / stats.totalSavingsAllTime) * 100}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.categoryAmount}>{formatCurrency(cat.amount)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function TipsTab({
  recommendations,
  onAccept,
  onReject,
  onDismiss,
}: {
  recommendations: any[];
  onAccept: (id: string, context?: string, actualPrice?: number) => void;
  onReject: (id: string, reason?: string, feedback?: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.tabContent}>
      <RecommendationFeedbackList
        recommendations={recommendations}
        onAccept={onAccept}
        onReject={onReject}
        onDismiss={onDismiss}
        emptyMessage={t('intelligence.noNewTips', 'No new tips')}
      />
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  dataScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.pastelOrange + '30',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  dataScoreText: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: RADIUS.sm,
  },
  tabActive: {
    backgroundColor: Palette.pastelOrange + '30',
  },
  tabText: {
    fontSize: TYPE.labelSize,
    fontWeight: '500',
    color: SemanticColors.textTertiary,
  },
  tabTextActive: {
    color: Palette.hermesOrange,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '700',
    color: Palette.white,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.lg,
  },
  tabContent: {
    gap: Spacing.lg,
  },

  // Hero Card
  heroCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccessBorder,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flex: 1,
  },
  heroLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  heroValue: {
    fontSize: TYPE.displaySize + 4,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  heroSubtext: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },

  // Contribution Card
  contributionCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  contributionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contributionTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  contributionScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  contributionValue: {
    fontSize: 36,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },
  contributionLabel: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  contributionBreakdown: {
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  contributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contributionItemText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  contributionItemValue: {
    fontSize: TYPE.captionSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  contributionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
  },
  contributionNoteText: {
    flex: 1,
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },

  // Section
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Market Position
  marketPositionCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  positionHeader: {
    alignItems: 'center',
  },
  positionLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  positionValue: {
    fontSize: 48,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },
  positionSuffix: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
  },
  positionBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    position: 'relative',
  },
  positionFill: {
    height: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 4,
  },
  positionMarker: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange,
    marginLeft: -8,
    borderWidth: 3,
    borderColor: '#fff',
  },

  // Peer Comparison
  peerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  peerCard: {
    width: '48%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  peerMetric: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  peerComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  peerYou: {
    alignItems: 'center',
  },
  peerValue: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  peerValueWinning: {
    color: SemanticColors.feedbackSuccess,
  },
  peerLabel: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
  },
  peerVs: {
    padding: 4,
  },
  peerAvg: {
    alignItems: 'center',
  },
  peerAvgValue: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },

  // Recommendation Stats
  recStatsCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  recStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  recStatValue: {
    fontSize: TYPE.displaySize - 4,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  recStatLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  recStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
  },

  // Market Tab
  regionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Palette.pastelOrange + '20',
    borderRadius: RADIUS.sm,
  },
  regionText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  regionChange: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 6,
  },
  regionChangeText: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: Palette.white,
  },
  insightCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.xs,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
  },
  insightTitle: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  insightDescription: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  insightValue: {
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  insightValueText: {
    fontSize: TYPE.titleSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  dataSourceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.md,
  },
  dataSourceText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },

  // Savings Tab
  savingsHero: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccessBorder,
  },
  savingsHeroLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  savingsHeroValue: {
    fontSize: 48,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  savingsHeroStats: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.feedbackSuccessBorder,
  },
  savingsHeroStat: {
    flex: 1,
    alignItems: 'center',
  },
  savingsHeroStatValue: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  savingsHeroStatLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  savingsHeroStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.feedbackSuccessBorder,
  },

  // Chart
  chartContainer: {
    flexDirection: 'row',
    height: 160,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  chartBarFill: {
    width: '80%',
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
  },
  chartBarValue: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },

  // Category List
  categoryList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.pastelOrange + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContent: {
    flex: 1,
    gap: 4,
  },
  categoryName: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  categoryProgress: {
    height: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 2,
  },
  categoryProgressFill: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 2,
  },
  categoryAmount: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
});
