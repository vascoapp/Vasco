// =============================================================================
// MOAT INSIGHTS CARD (R243)
// =============================================================================
// Surfaces three previously-dormant data structures on the contractor's Geld
// tab — closes the consumer-side loop on:
//   - mv_winrate_by_amount         (queryWinrateDistribution)
//   - mv_margin_by_trade_month     (queryMarginTrend)
//   - ts_daily_business_metrics    (getDailyMetrics)
//
// Single component, three sections, lazy-loaded. K-anonymity gated by the
// underlying RPCs — when there's not enough cohort data, sections quietly
// hide rather than show empty placeholders.
// =============================================================================

import { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { Skeleton } from '../shared/Skeleton';
import {
  queryMarginTrend,
  queryWinrateDistribution,
  getDailyMetrics,
  type DailyMetricPoint,
} from '../../services/intelligenceCaptureService';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency0, type Country } from '../../i18n/formatting';
import { useTranslation } from 'react-i18next';

interface Props {
  trade?: string;
  country?: string;
}

interface State {
  loading: boolean;
  marginTrend: Array<{ month: string; avgMargin: number; quotes: number }>;
  winRates: Array<{ amountBucket: string; winRate: number; quotes: number }>;
  dailyMetrics: DailyMetricPoint[];
}

function MoatInsightsCardImpl({ trade, country }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const effectiveTrade = trade ?? user?.trade ?? 'plumbing';
  const effectiveCountry = country ?? user?.country ?? 'NL';

  const [state, setState] = useState<State>({
    loading: true,
    marginTrend: [],
    winRates: [],
    dailyMetrics: [],
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      queryMarginTrend(effectiveTrade, effectiveCountry, 6),
      queryWinrateDistribution(effectiveTrade, effectiveCountry),
      getDailyMetrics(30),
    ]).then(([trend, winRates, dailyMetrics]) => {
      if (cancelled) return;
      setState({
        loading: false,
        marginTrend: trend.slice(-6),
        winRates,
        dailyMetrics,
      });
    });
    return () => { cancelled = true; };
  }, [effectiveTrade, effectiveCountry]);

  if (state.loading) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Skeleton width={140} height={12} />
          <Skeleton width={14} height={14} borderRadius={7} />
        </View>
        <View style={[styles.row, { gap: 12 }]}>
          <Skeleton width={'70%'} height={14} />
          <Skeleton width={'20%'} height={14} />
        </View>
        <View style={[styles.row, { gap: 12 }]}>
          <Skeleton width={'55%'} height={14} />
          <Skeleton width={'20%'} height={14} />
        </View>
      </View>
    );
  }

  const hasAny = state.marginTrend.length > 0 || state.winRates.length > 0 || state.dailyMetrics.length > 0;
  if (!hasAny) return null;

  const recentMonth = state.marginTrend[state.marginTrend.length - 1];
  const totals30d = state.dailyMetrics.reduce(
    (acc, d) => ({
      quotes: acc.quotes + d.quotesSent,
      accepted: acc.accepted + d.quotesAccepted,
      paidEur: acc.paidEur + d.totalPaidEur,
    }),
    { quotes: 0, accepted: 0, paidEur: 0 },
  );

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push('/contractor/market-insights' as any)}
      accessibilityRole="link"
      accessibilityLabel={`Market insights for ${effectiveTrade} in ${effectiveCountry}. Tap for full breakdown.`}
    >
      <View style={styles.headerRow}>
        <DKLabel style={styles.title}>MARKT &amp; PRESTATIE</DKLabel>
        <Ionicons name="chevron-forward" size={14} color={DK.colors.textMuted} />
      </View>

      {recentMonth && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('moat.cohortMargin', { trade: effectiveTrade, country: effectiveCountry })}</Text>
          <Text style={styles.rowValue}>
            {recentMonth.avgMargin.toFixed(1)}% <Text style={styles.rowMeta}>· {t('moat.quoteCount', { count: recentMonth.quotes })}</Text>
          </Text>
        </View>
      )}

      {state.winRates.length > 0 && (
        <>
          <Text style={styles.subtitle}>{t('moat.winRateByGroup', 'Win rate by quote size')}</Text>
          {state.winRates.map((wr) => (
            <View key={wr.amountBucket} style={styles.row}>
              <Text style={styles.rowLabel}>{labelBucket(wr.amountBucket, effectiveCountry as Country, t)}</Text>
              <Text style={styles.rowValue}>
                {(wr.winRate * 100).toFixed(0)}% <Text style={styles.rowMeta}>· n={wr.quotes}</Text>
              </Text>
            </View>
          ))}
        </>
      )}

      {totals30d.quotes > 0 && (
        <>
          <Text style={styles.subtitle}>{t('moat.last30Days', 'Last 30 days')}</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('moat.sent', 'Sent')}</Text>
            <Text style={styles.rowValue}>{totals30d.quotes}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('moat.accepted', 'Accepted')}</Text>
            <Text style={styles.rowValue}>
              {totals30d.accepted} <Text style={styles.rowMeta}>· {totals30d.quotes > 0 ? Math.round((totals30d.accepted / totals30d.quotes) * 100) : 0}%</Text>
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('moat.received', 'Received')}</Text>
            <Text style={styles.rowValue}>{formatCurrency0(totals30d.paidEur, effectiveCountry as Country)}</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

// Boundaries were hardcoded with a euro sign ("Onder €1k", "Boven €25k"), so a
// UK or US contractor read their own buckets in the wrong currency. The bucket
// edges are thresholds in the contractor's own currency context -- the cohort
// is keyed by (trade, country) -- so format them for that country rather than
// translating the symbol away.
function labelBucket(
  b: string,
  country: Country,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const money = (n: number) => formatCurrency0(n, country);
  switch (b) {
    case 'under_1k':
      return t('moat.bucketUnder', { amount: money(1000) });
    case '1k_5k':
      return t('moat.bucketRange', { low: money(1000), high: money(5000) });
    case '5k_10k':
      return t('moat.bucketRange', { low: money(5000), high: money(10000) });
    case '10k_25k':
      return t('moat.bucketRange', { low: money(10000), high: money(25000) });
    case 'over_25k':
      return t('moat.bucketOver', { amount: money(25000) });
    default:
      return b;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: GRID.lg,
    marginVertical: GRID.md,
    gap: GRID.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: GRID.sm,
  },
  title: {
    color: DK.colors.accent,
  },
  subtitle: {
    color: DK.colors.textMuted,
    fontFamily: TYPE.captionFamily,
    fontSize: 12,
    marginTop: GRID.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: GRID.xs,
  },
  rowLabel: {
    color: DK.colors.text,
    fontFamily: TYPE.bodyFamily,
    fontSize: 14,
  },
  rowValue: {
    color: DK.colors.text,
    fontFamily: TYPE.titleFamily,
    fontSize: 14,
  },
  rowMeta: {
    color: DK.colors.textMuted,
    fontFamily: TYPE.captionFamily,
    fontSize: 12,
  },
});

export const MoatInsightsCard = memo(MoatInsightsCardImpl);
