// =============================================================================
// REGIONAL MARKET INTELLIGENCE VIEW
// =============================================================================
// Shows regional trends, popular products, and customer preference patterns
// Demonstrates the unique value of aggregated data
// =============================================================================

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

type IconName = keyof typeof Ionicons.glyphMap;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// TYPES
// ============================================

interface RegionData {
  id: string;
  name: string;
  contractorCount: number;
  projectCount: number;
}

interface TrendingProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  selectionRate: number;
  trend: 'up' | 'down' | 'stable';
  trendChange: number;
  avgPrice: number;
  customerSatisfaction: number;
}

interface PriceTrend {
  category: string;
  currentAvg: number;
  previousAvg: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface CustomerPreference {
  category: string;
  options: {
    name: string;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }[];
}

interface MarketOpportunity {
  id: string;
  title: string;
  description: string;
  potentialValue: number;
  confidence: number;
  type: 'product' | 'pricing' | 'timing' | 'service';
}

// ============================================
// MOCK DATA
// ============================================

const REGIONS: RegionData[] = [
  { id: 'noord-holland', name: 'Noord-Holland', contractorCount: 234, projectCount: 1847 },
  { id: 'zuid-holland', name: 'Zuid-Holland', contractorCount: 312, projectCount: 2341 },
  { id: 'utrecht', name: 'Utrecht', contractorCount: 156, projectCount: 1123 },
  { id: 'noord-brabant', name: 'Noord-Brabant', contractorCount: 198, projectCount: 1456 },
];

const TRENDING_PRODUCTS: TrendingProduct[] = [
  {
    id: 'prod_1',
    name: 'Geberit Duofix',
    brand: 'Geberit',
    category: 'Sanitair',
    selectionRate: 67,
    trend: 'up',
    trendChange: 12,
    avgPrice: 189,
    customerSatisfaction: 4.7,
  },
  {
    id: 'prod_2',
    name: 'Grohe Eurosmart',
    brand: 'Grohe',
    category: 'Kranen',
    selectionRate: 54,
    trend: 'up',
    trendChange: 8,
    avgPrice: 92,
    customerSatisfaction: 4.5,
  },
  {
    id: 'prod_3',
    name: 'Flexa Creations',
    brand: 'Flexa',
    category: 'Verf',
    selectionRate: 48,
    trend: 'stable',
    trendChange: 2,
    avgPrice: 42,
    customerSatisfaction: 4.3,
  },
  {
    id: 'prod_4',
    name: 'Villeroy & Boch O.novo',
    brand: 'V&B',
    category: 'Sanitair',
    selectionRate: 41,
    trend: 'down',
    trendChange: -5,
    avgPrice: 245,
    customerSatisfaction: 4.6,
  },
  {
    id: 'prod_5',
    name: 'Sigma S2U Allure',
    brand: 'Sigma',
    category: 'Verf',
    selectionRate: 38,
    trend: 'up',
    trendChange: 15,
    avgPrice: 48,
    customerSatisfaction: 4.4,
  },
];

const PRICE_TRENDS: PriceTrend[] = [
  { category: 'Verf & Coatings', currentAvg: 28.50, previousAvg: 31.20, changePercent: -8.7, trend: 'down' },
  { category: 'Sanitair', currentAvg: 185, previousAvg: 178, changePercent: 3.9, trend: 'up' },
  { category: 'Kranen', currentAvg: 95, previousAvg: 98, changePercent: -3.1, trend: 'down' },
  { category: 'Tegels', currentAvg: 35, previousAvg: 35, changePercent: 0, trend: 'stable' },
  { category: 'Gereedschap', currentAvg: 67, previousAvg: 62, changePercent: 8.1, trend: 'up' },
];

const CUSTOMER_PREFERENCES: CustomerPreference[] = [
  {
    category: 'Toilet Type',
    options: [
      { name: 'Wandhangend', percentage: 72, trend: 'up' },
      { name: 'Staand', percentage: 23, trend: 'down' },
      { name: 'Smart toilet', percentage: 5, trend: 'up' },
    ],
  },
  {
    category: 'Kraan Afwerking',
    options: [
      { name: 'Chroom', percentage: 58, trend: 'stable' },
      { name: 'Mat zwart', percentage: 28, trend: 'up' },
      { name: 'Geborsteld goud', percentage: 14, trend: 'up' },
    ],
  },
  {
    category: 'Verf Afwerking',
    options: [
      { name: 'Mat', percentage: 45, trend: 'down' },
      { name: 'Zijdeglans', percentage: 38, trend: 'up' },
      { name: 'Eierschaal', percentage: 17, trend: 'stable' },
    ],
  },
];

const MARKET_OPPORTUNITIES: MarketOpportunity[] = [
  {
    id: 'opp_1',
    title: 'Mat zwarte kranen populair',
    description: 'Vraag naar mat zwarte kranen steeg 28% in jouw regio. Overweeg dit actief aan te bieden.',
    potentialValue: 450,
    confidence: 87,
    type: 'product',
  },
  {
    id: 'opp_2',
    title: 'Verfprijzen op laagste punt',
    description: 'Verf is nu 8% goedkoper dan 3 maanden geleden. Goed moment voor inkoop.',
    potentialValue: 320,
    confidence: 92,
    type: 'pricing',
  },
  {
    id: 'opp_3',
    title: 'Badkamer renovaties piek in maart',
    description: 'Historisch gezien stijgt vraag naar badkamer renovaties 40% in maart.',
    potentialValue: 2500,
    confidence: 78,
    type: 'timing',
  },
];

// ============================================
// COMPONENTS
// ============================================

interface MarketIntelligenceProps {
  onClose?: () => void;
}

export function MarketIntelligence({ onClose }: MarketIntelligenceProps) {
  const [selectedRegion, setSelectedRegion] = useState<RegionData>(REGIONS[0]);
  const [activeTab, setActiveTab] = useState<'trends' | 'preferences' | 'opportunities'>('trends');

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
          <Text style={styles.headerTitle}>Markt Intelligence</Text>
          <Text style={styles.headerSubtitle}>Inzichten uit jouw regio</Text>
        </View>
      </View>

      {/* Region Selector */}
      <Pressable style={styles.regionSelector}>
        <Ionicons name="location" size={18} color={Palette.hermesOrange} />
        <Text style={styles.regionName}>{selectedRegion.name}</Text>
        <View style={styles.regionStats}>
          <Text style={styles.regionStatText}>
            {selectedRegion.contractorCount} aannemers · {selectedRegion.projectCount} projecten
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={SemanticColors.textTertiary} />
      </Pressable>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { id: 'trends', label: 'Trends', icon: 'trending-up' as IconName },
          { id: 'preferences', label: 'Voorkeuren', icon: 'heart' as IconName },
          { id: 'opportunities', label: 'Kansen', icon: 'bulb' as IconName },
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
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeTab === 'trends' && <TrendsTab />}
        {activeTab === 'preferences' && <PreferencesTab />}
        {activeTab === 'opportunities' && <OpportunitiesTab />}
        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

// ============================================
// TRENDS TAB
// ============================================

function TrendsTab() {
  return (
    <View style={styles.tabContent}>
      {/* Trending Products */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Populaire Producten</Text>
          <Text style={styles.sectionSubtitle}>Wat klanten kiezen</Text>
        </View>
        <View style={styles.trendingList}>
          {TRENDING_PRODUCTS.map((product, index) => (
            <TrendingProductCard key={product.id} product={product} rank={index + 1} />
          ))}
        </View>
      </View>

      {/* Price Trends */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Prijsontwikkelingen</Text>
          <Text style={styles.sectionSubtitle}>Laatste 30 dagen</Text>
        </View>
        <View style={styles.priceTrendsList}>
          {PRICE_TRENDS.map((trend, index) => (
            <PriceTrendCard key={index} trend={trend} />
          ))}
        </View>
      </View>

      {/* Data Source */}
      <View style={styles.dataSource}>
        <Ionicons name="shield-checkmark" size={14} color={SemanticColors.textTertiary} />
        <Text style={styles.dataSourceText}>
          Gebaseerd op 1.847 projecten en 234 aannemers in Noord-Holland
        </Text>
      </View>
    </View>
  );
}

function TrendingProductCard({ product, rank }: { product: TrendingProduct; rank: number }) {
  const getTrendColor = () => {
    if (product.trend === 'up') return SemanticColors.feedbackSuccess;
    if (product.trend === 'down') return SemanticColors.feedbackError;
    return SemanticColors.textTertiary;
  };

  const getTrendIcon = (): IconName => {
    if (product.trend === 'up') return 'arrow-up';
    if (product.trend === 'down') return 'arrow-down';
    return 'remove';
  };

  return (
    <View style={styles.trendingCard}>
      <View style={styles.trendingRank}>
        <Text style={styles.trendingRankText}>{rank}</Text>
      </View>
      <View style={styles.trendingInfo}>
        <Text style={styles.trendingName}>{product.name}</Text>
        <Text style={styles.trendingBrand}>{product.brand} · {product.category}</Text>
        <View style={styles.trendingStats}>
          <View style={styles.trendingStat}>
            <Text style={styles.trendingStatValue}>{product.selectionRate}%</Text>
            <Text style={styles.trendingStatLabel}>kiest dit</Text>
          </View>
          <View style={styles.trendingStat}>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#F59E0B" />
              <Text style={styles.ratingText}>{product.customerSatisfaction}</Text>
            </View>
            <Text style={styles.trendingStatLabel}>score</Text>
          </View>
          <View style={styles.trendingStat}>
            <Text style={styles.trendingStatValue}>€{product.avgPrice}</Text>
            <Text style={styles.trendingStatLabel}>gem. prijs</Text>
          </View>
        </View>
      </View>
      <View style={styles.trendingTrend}>
        <Ionicons name={getTrendIcon()} size={16} color={getTrendColor()} />
        <Text style={[styles.trendingTrendText, { color: getTrendColor() }]}>
          {product.trendChange > 0 ? '+' : ''}{product.trendChange}%
        </Text>
      </View>
    </View>
  );
}

function PriceTrendCard({ trend }: { trend: PriceTrend }) {
  const getTrendColor = () => {
    if (trend.trend === 'down') return SemanticColors.feedbackSuccess;
    if (trend.trend === 'up') return SemanticColors.feedbackError;
    return SemanticColors.textTertiary;
  };

  const getTrendIcon = (): IconName => {
    if (trend.trend === 'down') return 'trending-down';
    if (trend.trend === 'up') return 'trending-up';
    return 'remove';
  };

  return (
    <View style={styles.priceTrendCard}>
      <View style={styles.priceTrendInfo}>
        <Text style={styles.priceTrendCategory}>{trend.category}</Text>
        <Text style={styles.priceTrendPrice}>€{trend.currentAvg.toFixed(2)}</Text>
      </View>
      <View style={[styles.priceTrendBadge, { backgroundColor: getTrendColor() + '15' }]}>
        <Ionicons name={getTrendIcon()} size={14} color={getTrendColor()} />
        <Text style={[styles.priceTrendChange, { color: getTrendColor() }]}>
          {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

// ============================================
// PREFERENCES TAB
// ============================================

function PreferencesTab() {
  return (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Klant Voorkeuren</Text>
          <Text style={styles.sectionSubtitle}>Wat klanten kiezen in jouw regio</Text>
        </View>

        {CUSTOMER_PREFERENCES.map((pref, index) => (
          <PreferenceCard key={index} preference={pref} />
        ))}
      </View>

      {/* Insight Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inzichten</Text>
        <View style={styles.insightCard}>
          <Ionicons name="bulb" size={20} color={Palette.hermesOrange} />
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Mat zwart is trending</Text>
            <Text style={styles.insightDescription}>
              Vraag naar mat zwarte afwerking is 45% gestegen in 6 maanden.
              Vooral bij jonge huiseigenaren (25-40 jaar).
            </Text>
          </View>
        </View>
        <View style={styles.insightCard}>
          <Ionicons name="bulb" size={20} color={Palette.hermesOrange} />
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Wandhangend toilet dominant</Text>
            <Text style={styles.insightDescription}>
              72% kiest wandhangend. Bij renovaties met budget €10K+ zelfs 85%.
              Bied dit als standaard optie aan.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function PreferenceCard({ preference }: { preference: CustomerPreference }) {
  return (
    <View style={styles.preferenceCard}>
      <Text style={styles.preferenceCategory}>{preference.category}</Text>
      <View style={styles.preferenceOptions}>
        {preference.options.map((option, index) => {
          const getTrendIcon = (): IconName => {
            if (option.trend === 'up') return 'arrow-up';
            if (option.trend === 'down') return 'arrow-down';
            return 'remove';
          };

          const getTrendColor = () => {
            if (option.trend === 'up') return SemanticColors.feedbackSuccess;
            if (option.trend === 'down') return SemanticColors.feedbackError;
            return SemanticColors.textTertiary;
          };

          return (
            <View key={index} style={styles.preferenceOption}>
              <View style={styles.preferenceOptionInfo}>
                <Text style={styles.preferenceOptionName}>{option.name}</Text>
                <View style={styles.preferenceBar}>
                  <View
                    style={[
                      styles.preferenceBarFill,
                      {
                        width: `${option.percentage}%`,
                        backgroundColor: index === 0 ? Palette.hermesOrange : SemanticColors.textTertiary + '40',
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.preferenceOptionRight}>
                <Text style={styles.preferencePercentage}>{option.percentage}%</Text>
                <Ionicons name={getTrendIcon()} size={12} color={getTrendColor()} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ============================================
// OPPORTUNITIES TAB
// ============================================

function OpportunitiesTab() {
  return (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Marktkansen</Text>
          <Text style={styles.sectionSubtitle}>Gepersonaliseerd voor jou</Text>
        </View>

        {MARKET_OPPORTUNITIES.map((opportunity) => (
          <OpportunityCard key={opportunity.id} opportunity={opportunity} />
        ))}
      </View>

      {/* AI Note */}
      <View style={styles.aiNote}>
        <Ionicons name="sparkles" size={16} color={Palette.hermesOrange} />
        <Text style={styles.aiNoteText}>
          Deze kansen zijn gebaseerd op jouw vakgebied, regio en klantprofiel
        </Text>
      </View>
    </View>
  );
}

function OpportunityCard({ opportunity }: { opportunity: MarketOpportunity }) {
  const getTypeConfig = (type: MarketOpportunity['type']) => {
    switch (type) {
      case 'product':
        return { icon: 'cube' as IconName, color: Palette.dustyBlue };
      case 'pricing':
        return { icon: 'cash' as IconName, color: SemanticColors.feedbackSuccess };
      case 'timing':
        return { icon: 'time' as IconName, color: Palette.hermesOrange };
      case 'service':
        return { icon: 'construct' as IconName, color: '#8B5CF6' };
    }
  };

  const config = getTypeConfig(opportunity.type);

  return (
    <View style={styles.opportunityCard}>
      <View style={[styles.opportunityIcon, { backgroundColor: config.color + '15' }]}>
        <Ionicons name={config.icon} size={22} color={config.color} />
      </View>
      <View style={styles.opportunityContent}>
        <Text style={styles.opportunityTitle}>{opportunity.title}</Text>
        <Text style={styles.opportunityDescription}>{opportunity.description}</Text>
        <View style={styles.opportunityMeta}>
          <View style={styles.opportunityValue}>
            <Ionicons name="trending-up" size={12} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.opportunityValueText}>
              ~€{opportunity.potentialValue} potentieel
            </Text>
          </View>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>{opportunity.confidence}% zeker</Text>
          </View>
        </View>
      </View>
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
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  regionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Palette.pastelOrange + '20',
    borderRadius: 12,
  },
  regionName: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  regionStats: {
    flex: 1,
  },
  regionStatText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Palette.pastelOrange + '30',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.textTertiary,
  },
  tabTextActive: {
    color: Palette.hermesOrange,
    fontWeight: '600',
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
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Trending Products
  trendingList: {
    gap: Spacing.sm,
  },
  trendingCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  trendingRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingRankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  trendingInfo: {
    flex: 1,
  },
  trendingName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  trendingBrand: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  trendingStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  trendingStat: {
    alignItems: 'center',
  },
  trendingStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  trendingStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  trendingTrend: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingTrendText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  // Price Trends
  priceTrendsList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  priceTrendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  priceTrendInfo: {
    gap: 2,
  },
  priceTrendCategory: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  priceTrendPrice: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  priceTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priceTrendChange: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Preferences
  preferenceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: Spacing.sm,
  },
  preferenceCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.md,
  },
  preferenceOptions: {
    gap: Spacing.md,
  },
  preferenceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  preferenceOptionInfo: {
    flex: 1,
    gap: 4,
  },
  preferenceOptionName: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  preferenceBar: {
    height: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  preferenceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  preferenceOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  preferencePercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    minWidth: 36,
    textAlign: 'right',
  },

  // Insights
  insightCard: {
    flexDirection: 'row',
    backgroundColor: Palette.pastelOrange + '20',
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },

  // Opportunities
  opportunityCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  opportunityIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opportunityContent: {
    flex: 1,
    gap: 4,
  },
  opportunityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  opportunityDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  opportunityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 4,
  },
  opportunityValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  opportunityValueText: {
    fontSize: 12,
    fontWeight: '500',
    color: SemanticColors.feedbackSuccess,
  },
  confidenceBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Notes
  dataSource: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  dataSourceText: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  aiNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Palette.pastelOrange + '15',
    borderRadius: 10,
  },
  aiNoteText: {
    fontSize: 12,
    color: Palette.hermesOrange,
    flex: 1,
  },
});
