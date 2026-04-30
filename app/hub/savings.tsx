// =============================================================================
// AI BESPARINGEN — Full breakdown (R267 — DK Sunset Slate run-through)
// =============================================================================
// Dark theme, all categories tappable to drill into the source surface,
// hero KPIs route to relevant tabs, top opportunity routes to its action.
// =============================================================================

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../src/theme/draftkings';
import { TYPE, GRID, RADIUS, PAGE_BG } from '../../src/theme/tabStyles';
import { DKLabel } from '../../src/components/shared/DKLabel';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { useSavingsAggregation, useSavingsTimeline } from '../../src/services/savingsAggregatorService';
import { formatAmount } from '../../src/utils/formatAmount';

type IconName = keyof typeof Ionicons.glyphMap;

// Each savings category routes to the contractor surface that produces it.
const CATEGORY_ROUTES: Record<string, Href> = {
  time: '/contractor/drag-schedule' as Href,
  purchasing: '/contractor/purchase-orders' as Href,
  'faster-payments': '/(contractor)/geld' as Href,
  conversion: '/contractor/quote-list' as Href,
  audit: '/contractor/vat-and-audit' as Href,
  materials: '/contractor/purchase-orders' as Href,
};

export default function SavingsHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const savings = useSavingsAggregation();
  const timeline = useSavingsTimeline();

  const goToCategory = (catId: string) => {
    const route = CATEGORY_ROUTES[catId];
    if (route) router.push(route);
  };

  return (
    <View style={styles.container}>
      <DKScreenHeader title={t('savings.title', 'AI BESPARINGEN').toUpperCase()} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero KPIs — tappable per metric */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <Pressable
              style={({ pressed }) => [styles.heroKPI, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(contractor)/geld' as Href)}
              accessibilityRole="button"
              accessibilityLabel={t('savings.thisMonthA11y', 'View this month savings')}
            >
              <Text style={styles.heroValue}>{formatAmount(savings.totalSavedThisMonth)}</Text>
              <DKLabel style={styles.heroLabel}>{t('savings.thisMonth', 'This month')}</DKLabel>
            </Pressable>
            <View style={styles.heroDivider} />
            <View style={styles.heroKPI}>
              <Text style={styles.heroValue}>{formatAmount(savings.totalSavedThisYear)}</Text>
              <DKLabel style={styles.heroLabel}>{t('savings.thisYear', 'This year')}</DKLabel>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroKPI}>
              <Text style={styles.heroValue}>
                {`€${(savings.projectedAnnual / 1000).toFixed(1)}K`}
              </Text>
              <DKLabel style={styles.heroLabel}>{t('savings.projected', 'Projected')}</DKLabel>
            </View>
          </View>
          <View style={styles.heroTrendRow}>
            <Ionicons name="trending-up" size={16} color={DK.colors.success} />
            <Text style={styles.heroTrendText}>
              {t('savings.trendLine', '+{{trend}}% trend · {{perJob}}/job · {{benchmark}}% above industry', {
                trend: savings.trendPercent,
                perJob: formatAmount(savings.savingsPerJob),
                benchmark: savings.savingsVsBenchmark,
              })}
            </Text>
          </View>
        </View>

        {/* Breakdown — full detail, each card tappable */}
        <DKLabel style={styles.sectionTitle}>{t('savings.breakdownTitle', 'BREAKDOWN BY CATEGORY')}</DKLabel>
        <View style={styles.breakdownList}>
          {savings.breakdown.map((cat) => {
            const tappable = !!CATEGORY_ROUTES[cat.id];
            return (
              <Pressable
                key={cat.id}
                style={({ pressed }) => [
                  styles.breakdownCard,
                  tappable && pressed && { opacity: 0.88 },
                ]}
                onPress={tappable ? () => goToCategory(cat.id) : undefined}
                accessibilityRole={tappable ? 'button' : undefined}
                accessibilityLabel={`${cat.label}, ${formatAmount(cat.amount)}, ${cat.description}`}
              >
                <View style={styles.breakdownHeader}>
                  <View style={styles.breakdownIcon}>
                    <Ionicons name={cat.icon as IconName} size={18} color={DK.colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.breakdownLabel} numberOfLines={1}>{cat.label}</Text>
                    <Text style={styles.breakdownDesc} numberOfLines={2}>{cat.description}</Text>
                  </View>
                  <View style={styles.breakdownAmountCol}>
                    <Text style={styles.breakdownAmount}>{formatAmount(cat.amount)}</Text>
                    <View style={[styles.breakdownTrendBadge, {
                      backgroundColor: cat.trend === 'up'
                        ? DK.colors.success + '22'
                        : cat.trend === 'down'
                          ? (DK.colors.danger ?? '#EF4444') + '22'
                          : DK.colors.panel2,
                    }]}>
                      <Ionicons
                        name={cat.trend === 'up' ? 'trending-up' : cat.trend === 'down' ? 'trending-down' : 'remove'}
                        size={12}
                        color={cat.trend === 'up' ? DK.colors.success : cat.trend === 'down' ? (DK.colors.danger ?? '#EF4444') : DK.colors.textMuted}
                      />
                      <Text style={[styles.breakdownTrendText, {
                        color: cat.trend === 'up' ? DK.colors.success : cat.trend === 'down' ? (DK.colors.danger ?? '#EF4444') : DK.colors.textMuted,
                      }]}>
                        {cat.trendPercent > 0 ? '+' : ''}{cat.trendPercent}%
                      </Text>
                    </View>
                  </View>
                  {tappable && (
                    <Ionicons name="chevron-forward" size={16} color={DK.colors.textMuted} style={{ marginLeft: 4 }} />
                  )}
                </View>
                {/* Proportion bar */}
                <View style={styles.breakdownBarTrack}>
                  <View style={[styles.breakdownBarFill, {
                    width: `${Math.min((cat.amount / Math.max(savings.totalSavedThisMonth, 1)) * 100, 100)}%`,
                  }]} />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Timeline */}
        <DKLabel style={styles.sectionTitle}>{t('savings.timelineTitle', 'SAVINGS OVER TIME')}</DKLabel>
        <View style={styles.timelineCard}>
          <View style={styles.timelineBars}>
            {timeline.map((point, idx) => {
              const maxAmount = Math.max(...timeline.map(t => t.amount), 1);
              const height = (point.amount / maxAmount) * 80;
              return (
                <View key={idx} style={styles.timelineBarCol}>
                  <Text style={styles.timelineBarValue}>{`€${(point.amount / 1000).toFixed(1)}K`}</Text>
                  <View style={[styles.timelineBar, { height }]} />
                  <Text style={styles.timelineBarLabel}>{point.month}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.timelineCumulativeRow}>
            <DKLabel style={styles.timelineCumulativeLabel}>{t('savings.cumulative', 'Cumulative')}</DKLabel>
            <Text style={styles.timelineCumulativeValue}>
              {formatAmount(timeline[timeline.length - 1]?.cumulative ?? 0)}
            </Text>
          </View>
        </View>

        {/* Top Opportunity — tap to act */}
        <Pressable
          style={({ pressed }) => [styles.opportunityCard, pressed && { opacity: 0.9 }]}
          onPress={() => router.push('/contractor/purchase-orders' as Href)}
          accessibilityRole="button"
          accessibilityLabel={`${savings.topOpportunity.label}. ${savings.topOpportunity.action}`}
        >
          <View style={styles.opportunityIcon}>
            <Ionicons name="bulb" size={20} color={DK.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.opportunityTitle}>{savings.topOpportunity.label}</Text>
            <Text style={styles.opportunityDesc}>{savings.topOpportunity.action}</Text>
          </View>
          <View style={styles.opportunityAmountWrap}>
            <Text style={styles.opportunityAmount}>+{formatAmount(savings.topOpportunity.potentialAmount)}</Text>
            <Text style={styles.opportunitySuffix}>/mo</Text>
          </View>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  scrollView: { flex: 1 },
  scrollContent: { padding: GRID.md, gap: GRID.md, paddingBottom: 120 },

  // Hero
  heroCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroKPI: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: GRID.xs },
  heroValue: {
    fontSize: 22,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.text,
    letterSpacing: -0.5,
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: TYPE.labelFamily,
    color: DK.colors.textMuted,
    letterSpacing: 1.0,
  },
  heroDivider: { width: 1, height: 28, backgroundColor: DK.colors.border },
  heroTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DK.colors.success + '14',
    borderRadius: RADIUS.md,
    padding: GRID.sm,
  },
  heroTrendText: {
    flex: 1,
    fontSize: 12,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.success,
  },

  // Section title
  sectionTitle: {
    fontSize: 12,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.accent,
    letterSpacing: 1.4,
    paddingHorizontal: GRID.xs,
    marginTop: GRID.sm,
  },

  // Breakdown
  breakdownList: { gap: GRID.sm },
  breakdownCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  breakdownIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: DK.colors.accent + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.text,
  },
  breakdownDesc: {
    fontSize: 12,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.textMuted,
    marginTop: 2,
  },
  breakdownAmountCol: { alignItems: 'flex-end', gap: 4 },
  breakdownAmount: {
    fontSize: 16,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.text,
  },
  breakdownTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  breakdownTrendText: { fontSize: 10, fontFamily: TYPE.labelFamily },
  breakdownBarTrack: {
    height: 4,
    backgroundColor: DK.colors.panel2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    backgroundColor: DK.colors.accent,
    borderRadius: 2,
  },

  // Timeline
  timelineCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  timelineBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 110,
  },
  timelineBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  timelineBarValue: { fontSize: 9, fontFamily: TYPE.labelFamily, color: DK.colors.textMuted },
  timelineBar: {
    width: '100%',
    backgroundColor: DK.colors.accent,
    borderRadius: 4,
    minHeight: 4,
  },
  timelineBarLabel: { fontSize: 10, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted },
  timelineCumulativeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: DK.colors.border,
    paddingTop: GRID.sm,
  },
  timelineCumulativeLabel: { fontSize: 11, color: DK.colors.textMuted, letterSpacing: 1.2 },
  timelineCumulativeValue: { fontSize: 16, fontFamily: TYPE.titleFamily, color: DK.colors.text },

  // Opportunity
  opportunityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: DK.colors.accent + '14',
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: DK.colors.accent + '40',
  },
  opportunityIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: DK.colors.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opportunityTitle: { fontSize: 14, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  opportunityDesc: { fontSize: 12, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginTop: 2 },
  opportunityAmountWrap: { flexDirection: 'row', alignItems: 'baseline' },
  opportunityAmount: { fontSize: 16, fontFamily: TYPE.titleFamily, color: DK.colors.accent },
  opportunitySuffix: { fontSize: 11, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginLeft: 2 },
});
