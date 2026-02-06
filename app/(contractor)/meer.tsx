// =============================================================================
// MEER - Tools & Features Hub (5th contractor tab)
// =============================================================================
// Categorized grid of all contractor tools and features
// =============================================================================

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';

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
    ],
  },
  {
    title: 'Klanten',
    cards: [
      { id: 'follow-up', icon: 'chatbubble-ellipses', title: 'Opvolging', description: 'Klant opvolging', color: '#3B82F6', route: '/contractor/follow-up' },
      { id: 'insights', icon: 'people', title: 'Inzichten', description: 'Klantanalyse', color: '#6366F1', route: '/contractor/customer-insights' },
      { id: 'reputation', icon: 'star', title: 'Reputatie', description: 'Reviews beheren', color: '#EAB308', route: '/contractor/reputation' },
      { id: 'leads', icon: 'megaphone', title: 'Leads', description: 'Nieuwe klanten', color: SemanticColors.feedbackSuccess, route: '/contractor/leads' },
    ],
  },
  {
    title: 'Materiaal & Inkoop',
    cards: [
      { id: 'suppliers', icon: 'storefront', title: 'Leveranciers', description: 'Leveranciersbeheer', color: '#8B5CF6', route: '/contractor/purchasing' },
      { id: 'receipt-scan', icon: 'scan', title: 'Bon Scanner', description: 'Scan bonnen', color: '#14B8A6', route: '/contractor/receipts' },
      { id: 'reorder', icon: 'refresh-circle', title: 'Herbestellen', description: 'Slim herbestellen', color: '#3B82F6', route: '/contractor/reorder' },
    ],
  },
  {
    title: 'Planning & Logistiek',
    cards: [
      { id: 'planning', icon: 'calendar', title: 'Planning', description: 'Weekplanning', color: '#3B82F6', route: '/contractor/planning' },
      { id: 'route', icon: 'navigate', title: 'Route Optimizer', description: 'Snelste routes', color: SemanticColors.feedbackSuccess, route: '/contractor/route' },
      { id: 'team', icon: 'people', title: 'Teambeheer', description: 'Team & monteurs', color: '#6366F1', route: '/contractor/team' },
      { id: 'capacity', icon: 'bar-chart', title: 'Capaciteit', description: 'Bezetting & planning', color: '#14B8A6', route: '/contractor/capacity' },
    ],
  },
  {
    title: 'Administratie',
    cards: [
      { id: 'certificates', icon: 'shield-checkmark', title: 'Certificaten', description: 'VCA, NEN, etc.', color: SemanticColors.feedbackSuccess, route: '/(contractor)/certificaten' },
      { id: 'documents', icon: 'folder', title: 'Documenten', description: 'Documentkluis', color: '#6366F1', route: '/contractor/documents' },
      { id: 'compliance', icon: 'checkmark-done', title: 'Compliance', description: 'Nalevingsstatus', color: '#3B82F6', route: '/contractor/compliance' },
      { id: 'cashflow', icon: 'wallet', title: 'Cash Flow', description: 'Geldstromen', color: Palette.hermesOrange, route: '/contractor/cashflow' },
      { id: 'warranty', icon: 'ribbon', title: 'Garantie', description: 'Garantiebeheer', color: '#EAB308', route: '/contractor/warranty' },
      { id: 'benchmark', icon: 'analytics', title: 'Benchmarking', description: 'Vergelijk prestaties', color: '#8B5CF6', route: '/contractor/benchmark' },
    ],
  },
];

function ToolCardItem({ card, onPress }: { card: ToolCard; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.cardIcon, { backgroundColor: card.color + '15' }]}>
        <Ionicons name={card.icon} size={22} color={card.color} />
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{card.title}</Text>
      <Text style={styles.cardDesc} numberOfLines={1}>{card.description}</Text>
    </Pressable>
  );
}

export default function MeerScreen() {
  const router = useRouter();
  const inlineInsight = useInlineInsight('contractor', 'meer', 'overview');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meer</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  card: {
    width: '47%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 4,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  cardDesc: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
});
