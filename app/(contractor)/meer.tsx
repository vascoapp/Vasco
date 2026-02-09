// =============================================================================
// MEER - Tools & Features Hub (5th contractor tab)
// =============================================================================
// Categorized grid of all contractor tools and features
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';
import { hapticSuccess } from '../../src/utils/haptics';
import { useExpiryCalendar, useInsurancePolicies } from '../../src/services/complianceService';
import { useFollowUps } from '../../src/services/followUpService';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';

type IconName = keyof typeof Ionicons.glyphMap;

interface ToolCard {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  color: string;
  route?: string;
}

interface ToolSection {
  title: string;
  cards: ToolCard[];
}

const TOOL_SECTIONS: ToolSection[] = [
  {
    title: 'AI Tools',
    cards: [
      { id: 'ai-assistant', icon: 'sparkles', title: 'AI Assistent', description: 'Chat met Vasco', color: Palette.hermesOrange, route: '/contractor/ai-assistant' },
      { id: 'smart-pricing', icon: 'trending-up', title: 'Smart Pricing', description: 'Optimale prijzen', color: SemanticColors.feedbackSuccess, route: '/contractor/smart-pricing' },
      { id: 'intelligence', icon: 'analytics', title: 'Intelligence', description: 'AI leergedrag', color: '#8B5CF6', route: '/contractor/intelligence' },
    ],
  },
  {
    title: 'Klanten',
    cards: [
      { id: 'customer-portal', icon: 'open-outline', title: 'Klantportaal', description: 'Demo klantervaring', color: Palette.hermesOrange, route: '/customer/VDB24A' },
      { id: 'follow-up', icon: 'chatbubble-ellipses', title: 'Opvolging', description: 'Klant opvolging', color: '#3B82F6', route: '/contractor/follow-up' },
      { id: 'insights', icon: 'people', title: 'Inzichten', description: 'Klantanalyse', color: '#6366F1', route: '/contractor/customer-insights' },
      { id: 'leads', icon: 'megaphone', title: 'Leads', description: 'Nieuwe klanten', color: SemanticColors.feedbackSuccess, route: '/contractor/leads' },
    ],
  },
  {
    title: 'Administratie',
    cards: [
      { id: 'certificates', icon: 'shield-checkmark', title: 'Certificaten', description: 'VCA, NEN, etc.', color: SemanticColors.feedbackSuccess, route: '/(contractor)/certificaten' },
      { id: 'insurance', icon: 'shield-half', title: 'Verzekering', description: 'Polissen & dekking', color: '#14B8A6', route: '/contractor/insurance' },
    ],
  },
];

function ToolCardItem({ card, onPress, badge }: { card: ToolCard; onPress: () => void; badge?: number }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={{ position: 'relative' }}>
        <View style={[styles.cardIcon, { backgroundColor: card.color + '15' }]}>
          <Ionicons name={card.icon} size={22} color={card.color} />
        </View>
        {badge !== undefined && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{card.title}</Text>
      <Text style={styles.cardDesc} numberOfLines={1}>{card.description}</Text>
    </Pressable>
  );
}

export default function MeerScreen() {
  const router = useRouter();
  const inlineInsight = useInlineInsight('contractor', 'meer', 'overview');
  const [refreshing, setRefreshing] = useState(false);

  // Screen visit tracking
  useEffect(() => { recordScreenVisit('meer'); }, []);

  // Badge data
  const expiryCalendar = useExpiryCalendar(1); // next 30 days
  const { policies } = useInsurancePolicies();
  const { dueCount: pendingFollowUpCount } = useFollowUps();

  const expiringCertCount = expiryCalendar.reduce((sum: number, entry: any) => sum + entry.items.length, 0);
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
  const expiringPolicyCount = policies.filter(p => p.endDate <= thirtyDaysFromNow).length;

  const BADGE_MAP: Record<string, number> = {
    certificates: expiringCertCount,
    insurance: expiringPolicyCount,
    'follow-up': pendingFollowUpCount,
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      hapticSuccess();
    }, 800);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meer</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />
        }
      >
        {inlineInsight && (
          <InlineInsight
            icon={inlineInsight.icon as IconName}
            message={inlineInsight.message}
            actionLabel={inlineInsight.actionLabel}
            actionRoute={inlineInsight.actionRoute}
          />
        )}

        {TOOL_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.grid}>
              {section.cards.map((card) => (
                <ToolCardItem
                  key={card.id}
                  card={card}
                  badge={BADGE_MAP[card.id]}
                  onPress={() => {
                    if (card.route) router.push(card.route as any);
                  }}
                />
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.salmonLight,
  },
  header: {
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SafeArea.content,
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: Spacing.md,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  cardDesc: {
    fontSize: 12,
    color: '#BBB',
  },
  badge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
    fontVariant: ['tabular-nums'] as any,
  },
});
