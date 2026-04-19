// Hub: AI Besparingen — Full breakdown of Vasco AI savings
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useSavingsAggregation, useSavingsTimeline } from '../../src/services/savingsAggregatorService';

type IconName = keyof typeof Ionicons.glyphMap;

export default function SavingsHubScreen() {
  const router = useRouter();
  const savings = useSavingsAggregation();
  const timeline = useSavingsTimeline();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>AI Besparingen</Text>
          <Text style={styles.headerSubtitle}>Vasco bespaart automatisch</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero KPIs */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroKPI}>
              <Text style={styles.heroValue}>
                {'\u20AC'}{savings.totalSavedThisMonth.toLocaleString(undefined)}
              </Text>
              <Text style={styles.heroLabel}>deze maand</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroKPI}>
              <Text style={styles.heroValue}>
                {'\u20AC'}{savings.totalSavedThisYear.toLocaleString(undefined)}
              </Text>
              <Text style={styles.heroLabel}>dit jaar</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroKPI}>
              <Text style={styles.heroValue}>
                {'\u20AC'}{(savings.projectedAnnual / 1000).toFixed(1)}K
              </Text>
              <Text style={styles.heroLabel}>geprojecteerd</Text>
            </View>
          </View>
          <View style={styles.heroTrendRow}>
            <Ionicons name="trending-up" size={16} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.heroTrendText}>
              +{savings.trendPercent}% trend · {'\u20AC'}{savings.savingsPerJob}/klus · {savings.savingsVsBenchmark}% boven branche
            </Text>
          </View>
        </View>

        {/* Breakdown — full detail */}
        <Text style={styles.sectionTitle}>Uitsplitsing per categorie</Text>
        <View style={styles.breakdownList}>
          {savings.breakdown.map((cat) => (
            <View key={cat.id} style={styles.breakdownCard}>
              <View style={styles.breakdownHeader}>
                <View style={[styles.breakdownIcon, {
                  backgroundColor: Palette.hermesOrange + '10',
                }]}>
                  <Ionicons name={cat.icon as IconName} size={18} color={Palette.hermesOrange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakdownLabel}>{cat.label}</Text>
                  <Text style={styles.breakdownDesc}>{cat.description}</Text>
                </View>
                <View style={styles.breakdownAmountCol}>
                  <Text style={styles.breakdownAmount}>{'\u20AC'}{cat.amount}</Text>
                  <View style={[styles.breakdownTrendBadge, {
                    backgroundColor: cat.trend === 'up' ? '#16A34A14' : cat.trend === 'down' ? '#DC262614' : '#F5F5F5',
                  }]}>
                    <Ionicons
                      name={cat.trend === 'up' ? 'trending-up' : cat.trend === 'down' ? 'trending-down' : 'remove'}
                      size={12}
                      color={cat.trend === 'up' ? '#16A34A' : cat.trend === 'down' ? '#DC2626' : '#999'}
                    />
                    <Text style={[styles.breakdownTrendText, {
                      color: cat.trend === 'up' ? '#16A34A' : cat.trend === 'down' ? '#DC2626' : '#999',
                    }]}>
                      {cat.trendPercent > 0 ? '+' : ''}{cat.trendPercent}%
                    </Text>
                  </View>
                </View>
              </View>
              {/* Proportion bar */}
              <View style={styles.breakdownBarTrack}>
                <View style={[styles.breakdownBarFill, {
                  width: `${Math.min((cat.amount / savings.totalSavedThisMonth) * 100, 100)}%`,
                }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Besparingsverloop</Text>
        <View style={styles.timelineCard}>
          {/* Simple bar chart */}
          <View style={styles.timelineBars}>
            {timeline.map((point, idx) => {
              const maxAmount = Math.max(...timeline.map(t => t.amount));
              const height = (point.amount / maxAmount) * 80;
              return (
                <View key={idx} style={styles.timelineBarCol}>
                  <Text style={styles.timelineBarValue}>{'\u20AC'}{(point.amount / 1000).toFixed(1)}K</Text>
                  <View style={[styles.timelineBar, { height }]} />
                  <Text style={styles.timelineBarLabel}>{point.month}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.timelineCumulativeRow}>
            <Text style={styles.timelineCumulativeLabel}>Cumulatief</Text>
            <Text style={styles.timelineCumulativeValue}>
              {'\u20AC'}{timeline[timeline.length - 1]?.cumulative.toLocaleString(undefined)}
            </Text>
          </View>
        </View>

        {/* Top Opportunity */}
        <View style={styles.opportunityCard}>
          <Ionicons name="bulb" size={20} color={Palette.hermesOrange} />
          <View style={{ flex: 1 }}>
            <Text style={styles.opportunityTitle}>{savings.topOpportunity.label}</Text>
            <Text style={styles.opportunityDesc}>{savings.topOpportunity.action}</Text>
          </View>
          <Text style={styles.opportunityAmount}>
            +{'\u20AC'}{savings.topOpportunity.potentialAmount}/mo
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
    backgroundColor: '#FAFAF8',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#14181F",
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: "#FFFFFF", textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Hero KPIs
  heroCard: {
    backgroundColor: "#14181F",
    borderRadius: 16,
    padding: Spacing.md,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroKPI: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  heroValue: {
    fontSize: 20,
    fontWeight: '800',
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  heroLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E8E4DF',
  },
  heroTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A0A',
    borderRadius: 8,
    padding: 8,
  },
  heroTrendText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
  },

  // Section title
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.hermesOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.xs,
  },

  // Breakdown
  breakdownList: {
    gap: 8,
  },
  breakdownCard: {
    backgroundColor: "#14181F",
    borderRadius: 14,
    padding: Spacing.md,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: "#FFFFFF",
  },
  breakdownDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  breakdownAmountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  breakdownAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: "#FFFFFF",
  },
  breakdownTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  breakdownTrendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  breakdownBarTrack: {
    height: 4,
    backgroundColor: '#F0EDE8',
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 2,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },

  // Timeline
  timelineCard: {
    backgroundColor: "#14181F",
    borderRadius: 16,
    padding: Spacing.md,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  timelineBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 110,
  },
  timelineBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  timelineBarValue: {
    fontSize: 9,
    fontWeight: '600',
    color: '#999',
  },
  timelineBar: {
    width: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 4,
    minHeight: 4,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  timelineBarLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: '500',
  },
  timelineCumulativeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0EDE8',
    paddingTop: 8,
  },
  timelineCumulativeLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  timelineCumulativeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: "#FFFFFF",
  },

  // Opportunity
  opportunityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Palette.hermesOrange + '10',
    borderRadius: 12,
    padding: Spacing.md,
  },
  opportunityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: "#FFFFFF",
  },
  opportunityDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  opportunityAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },
});
