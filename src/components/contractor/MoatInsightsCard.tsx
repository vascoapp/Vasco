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

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import {
  queryMarginTrend,
  queryWinrateDistribution,
  getDailyMetrics,
  type DailyMetricPoint,
} from '../../services/intelligenceCaptureService';
import { useAuth } from '../../context/AuthContext';

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

export function MoatInsightsCard({ trade, country }: Props) {
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

  if (state.loading) return null;

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
    <View style={styles.card}>
      <DKLabel style={styles.title}>MARKT &amp; PRESTATIE</DKLabel>

      {recentMonth && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Cohort margin {effectiveTrade}/{effectiveCountry}</Text>
          <Text style={styles.rowValue}>
            {recentMonth.avgMargin.toFixed(1)}% <Text style={styles.rowMeta}>· {recentMonth.quotes} offertes</Text>
          </Text>
        </View>
      )}

      {state.winRates.length > 0 && (
        <>
          <Text style={styles.subtitle}>Win-rate per offerte-groep</Text>
          {state.winRates.map((wr) => (
            <View key={wr.amountBucket} style={styles.row}>
              <Text style={styles.rowLabel}>{labelBucket(wr.amountBucket)}</Text>
              <Text style={styles.rowValue}>
                {(wr.winRate * 100).toFixed(0)}% <Text style={styles.rowMeta}>· n={wr.quotes}</Text>
              </Text>
            </View>
          ))}
        </>
      )}

      {totals30d.quotes > 0 && (
        <>
          <Text style={styles.subtitle}>Laatste 30 dagen</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Verstuurd</Text>
            <Text style={styles.rowValue}>{totals30d.quotes}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Geaccepteerd</Text>
            <Text style={styles.rowValue}>
              {totals30d.accepted} <Text style={styles.rowMeta}>· {totals30d.quotes > 0 ? Math.round((totals30d.accepted / totals30d.quotes) * 100) : 0}%</Text>
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Ontvangen</Text>
            <Text style={styles.rowValue}>€{totals30d.paidEur.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</Text>
          </View>
        </>
      )}
    </View>
  );
}

function labelBucket(b: string): string {
  return ({
    under_1k: 'Onder €1k',
    '1k_5k': '€1k – €5k',
    '5k_10k': '€5k – €10k',
    '10k_25k': '€10k – €25k',
    over_25k: 'Boven €25k',
  } as Record<string, string>)[b] ?? b;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: GRID.lg,
    marginVertical: GRID.md,
    gap: GRID.xs,
  },
  title: {
    color: DK.colors.accent,
    marginBottom: GRID.sm,
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
