import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../../src/theme/colors';
import { Spacing } from '../../../src/theme/spacing';
import { AIRecommendations } from '../../../src/components/intelligence/AIRecommendations';

type IconName = keyof typeof Ionicons.glyphMap;
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.lg * 2 - Spacing.md) / 2;

// ============================================
// TYPES
// ============================================

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  route: string;
  color: string;
  badge?: string;
}

interface FeatureCard {
  id: string;
  title: string;
  icon: IconName;
  route: string;
  stat?: string;
  statLabel?: string;
}

type Category = 'contractor' | 'sitelead' | 'buildos';

// ============================================
// DATA
// ============================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'quote',
    title: 'New Quote',
    subtitle: 'Good-Better-Best',
    icon: 'layers',
    route: '/contractor/tiered-quote',
    color: Palette.hermesOrange,
    badge: '83% upsell',
  },
  {
    id: 'purchase',
    title: 'Smart Buy',
    subtitle: 'AI Material Savings',
    icon: 'trending-down',
    route: '/contractor/purchasing',
    color: Palette.terracotta,
    badge: 'Save 15%',
  },
];

const FEATURE_SECTIONS: Record<Category, { title: string; features: FeatureCard[] }> = {
  contractor: {
    title: 'Contractor Tools',
    features: [
      { id: 'pricebook', title: 'Pricebook', icon: 'book-outline', route: '/contractor/pricebook', stat: '12', statLabel: 'services' },
      { id: 'payments', title: 'Payments', icon: 'card-outline', route: '/contractor/payments', stat: '\u20AC450', statLabel: 'outstanding' },
      { id: 'materials', title: 'Materials', icon: 'cube-outline', route: '/hub/materials', stat: '6', statLabel: 'items' },
      { id: 'suppliers', title: 'Suppliers', icon: 'business-outline', route: '/hub/suppliers', stat: '5', statLabel: 'active' },
    ],
  },
  sitelead: {
    title: 'Site Lead',
    features: [
      { id: 'dispatch', title: 'Dispatch', icon: 'people-outline', route: '/sitelead/dispatch', stat: '4', statLabel: 'on-site' },
      { id: 'reports', title: 'Reports', icon: 'bar-chart-outline', route: '/sitelead/reports', stat: '86%', statLabel: 'utilization' },
      { id: 'safety', title: 'Safety', icon: 'shield-checkmark-outline', route: '/sitelead/reports', stat: '98', statLabel: 'score' },
      { id: 'schedule', title: 'Schedule', icon: 'calendar-outline', route: '/sitelead/dispatch', stat: '28', statLabel: 'this week' },
    ],
  },
  buildos: {
    title: 'BuildOS',
    features: [
      { id: 'projects', title: 'Projects', icon: 'business-outline', route: '/hub/projects', stat: '3', statLabel: 'active' },
      { id: 'documents', title: 'Documents', icon: 'document-text-outline', route: 'documents', stat: '2', statLabel: 'pending' },
      { id: 'approvals', title: 'Approvals', icon: 'checkmark-circle-outline', route: '/hub/approvals', stat: '3', statLabel: 'waiting' },
      { id: 'risks', title: 'Risks', icon: 'warning-outline', route: '/hub/risks', stat: '2', statLabel: 'high' },
    ],
  },
};

// ============================================
// COMPONENTS
// ============================================

function QuickActionCard({ action }: { action: QuickAction }) {
  const router = useRouter();

  return (
    <Pressable
      style={[styles.quickActionCard, { borderColor: action.color + '40' }]}
      onPress={() => router.push(action.route as any)}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
        <Ionicons name={action.icon} size={28} color={action.color} />
      </View>
      <View style={styles.quickActionContent}>
        <Text style={styles.quickActionTitle}>{action.title}</Text>
        <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
      </View>
      {action.badge && (
        <View style={[styles.quickActionBadge, { backgroundColor: action.color }]}>
          <Text style={styles.quickActionBadgeText}>{action.badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

function FeatureCardSmall({ feature }: { feature: FeatureCard }) {
  const router = useRouter();

  return (
    <Pressable
      style={styles.featureCard}
      onPress={() => router.push(feature.route as any)}
    >
      <View style={styles.featureIconContainer}>
        <Ionicons name={feature.icon} size={22} color={Palette.hermesOrange} />
      </View>
      <Text style={styles.featureTitle}>{feature.title}</Text>
      {feature.stat && (
        <View style={styles.featureStat}>
          <Text style={styles.featureStatValue}>{feature.stat}</Text>
          <Text style={styles.featureStatLabel}>{feature.statLabel}</Text>
        </View>
      )}
    </Pressable>
  );
}

function CategoryTab({
  category,
  label,
  isActive,
  onPress
}: {
  category: Category;
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.categoryTab, isActive && styles.categoryTabActive]}
      onPress={onPress}
    >
      <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function HubScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<Category>('contractor');

  const currentSection = FEATURE_SECTIONS[activeCategory];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Vasco</Text>
          <Text style={styles.headerTitle}>Hub</Text>
        </View>
        <Pressable style={styles.profileButton}>
          <Ionicons name="person-circle" size={36} color={Palette.charcoal} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsContainer}>
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCard key={action.id} action={action} />
            ))}
          </View>
        </View>

        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          <CategoryTab
            category="contractor"
            label="Contractor"
            isActive={activeCategory === 'contractor'}
            onPress={() => setActiveCategory('contractor')}
          />
          <CategoryTab
            category="sitelead"
            label="Site Lead"
            isActive={activeCategory === 'sitelead'}
            onPress={() => setActiveCategory('sitelead')}
          />
          <CategoryTab
            category="buildos"
            label="BuildOS"
            isActive={activeCategory === 'buildos'}
            onPress={() => setActiveCategory('buildos')}
          />
        </View>

        {/* Features Grid */}
        <View style={styles.section}>
          <View style={styles.featuresGrid}>
            {currentSection.features.map((feature) => (
              <FeatureCardSmall key={feature.id} feature={feature} />
            ))}
          </View>
        </View>

        {/* AI Insights */}
        <View style={styles.section}>
          <AIRecommendations userId="current-user" maxItems={3} showHeader />
        </View>

        {/* Today's Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="pulse" size={20} color={Palette.hermesOrange} />
            <Text style={styles.summaryTitle}>Today</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>3</Text>
              <Text style={styles.summaryLabel}>Jobs Active</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Palette.hermesOrange }]}>\u20AC2.4k</Text>
              <Text style={styles.summaryLabel}>Revenue</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>6.5h</Text>
              <Text style={styles.summaryLabel}>Tracked</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity - Compact */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
              <Text style={styles.activityText}>Quote Q-2024-018 accepted</Text>
              <Text style={styles.activityTime}>2m</Text>
            </View>
            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: Palette.hermesOrange }]} />
              <Text style={styles.activityText}>Payment received \u20AC1,240</Text>
              <Text style={styles.activityTime}>1h</Text>
            </View>
            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: SemanticColors.feedbackWarning }]} />
              <Text style={styles.activityText}>Material price alert - Dulux</Text>
              <Text style={styles.activityTime}>3h</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  headerLabel: {
    fontSize: 13,
    color: Palette.hermesOrange,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  profileButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.md,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Quick Actions
  quickActionsContainer: {
    gap: Spacing.sm,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  quickActionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quickActionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Category Tabs
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
  },
  categoryTabActive: {
    backgroundColor: Palette.hermesOrange,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  categoryTabTextActive: {
    color: '#fff',
  },

  // Features Grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  featureCard: {
    width: CARD_WIDTH,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Palette.pastelOrange + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  featureStat: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  featureStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  featureStatLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Summary Card
  summaryCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '20',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  summaryLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: SemanticColors.borderDefault,
  },

  // Activity
  activitySection: {
    paddingHorizontal: Spacing.lg,
  },
  activityList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  activityText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  activityTime: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
});
