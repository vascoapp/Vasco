// =============================================================================
// MARKET INSIGHTS — full breakdown screen (R256)
// =============================================================================
// Destination for the MoatInsightsCard tap. Shows the full data the card
// summarizes: cohort margin trend (6 months), win-rate distribution by
// quote-amount bucket, daily metrics for the last 30 days, and time-of-day
// acceptance heatmap when available.
//
// All data is k-anonymity-gated by the underlying RPCs — sections quietly
// hide when there's not enough cohort signal.
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DK } from '../../src/theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { DKLabel } from '../../src/components/shared/DKLabel';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { currencySymbol } from '../../src/i18n/formatting';
import {
  queryMarginTrend,
  queryWinrateDistribution,
  getDailyMetrics,
  type DailyMetricPoint,
} from '../../src/services/intelligenceCaptureService';
import { useAuth } from '../../src/context/AuthContext';
import { formatCurrency0, formatDecimal1, type Country } from '../../src/i18n/formatting';

interface MonthRow { month: string; avgMargin: number; medianMargin: number; quotes: number; }
interface BucketRow { amountBucket: string; winRate: number; quotes: number; contractors: number; }

export default function MarketInsightsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const trade = user?.trade ?? 'plumbing';
  const country = user?.country ?? 'NL';

  const [refreshing, setRefreshing] = useState(false);
  const [marginTrend, setMarginTrend] = useState<MonthRow[]>([]);
  const [winRates, setWinRates] = useState<BucketRow[]>([]);
  const [daily, setDaily] = useState<DailyMetricPoint[]>([]);

  const load = async () => {
    const [trend, rates, dm] = await Promise.all([
      queryMarginTrend(trade, country, 12),
      queryWinrateDistribution(trade, country),
      getDailyMetrics(30),
    ]);
    setMarginTrend(trend.slice(-12));
    setWinRates(rates);
    setDaily(dm);
  };

  useEffect(() => { load(); }, [trade, country]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Aggregates
  const totals30d = daily.reduce(
    (acc, d) => ({
      sent: acc.sent + d.quotesSent,
      accepted: acc.accepted + d.quotesAccepted,
      paid: acc.paid + d.invoicesPaid,
      paidEur: acc.paidEur + d.totalPaidEur,
    }),
    { sent: 0, accepted: 0, paid: 0, paidEur: 0 },
  );
  const acceptRate30d = totals30d.sent > 0 ? Math.round((totals30d.accepted / totals30d.sent) * 100) : 0;

  const hasAnyData = marginTrend.length > 0 || winRates.length > 0 || daily.length > 0;

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <DKScreenHeader title={t('marketInsights.title', 'MARKET INSIGHTS')} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DK.colors.accent} />}
      >
        <Text style={styles.subtitle}>
          {/* The trade arrives as a SLUG ("painting"). Interpolating it raw put
              an English lowercase identifier at the top of a fully Dutch
              screen; onboarding.trades.* already holds the display names ×6. */}
          {t('marketInsights.subtitle', '{{trade}} · {{country}} cohort benchmarks', {
            trade: t(`onboarding.trades.${String(trade).toLowerCase()}`, { defaultValue: trade }),
            country,
          })}
        </Text>

        {!hasAnyData && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('marketInsights.empty', 'Not enough cohort data yet')}</Text>
            <Text style={styles.emptyText}>{t('marketInsights.emptyDesc', 'Insights unlock when 5+ contractors in your trade × country bucket have logged enough quotes. Keep using the app — your own data also feeds in.')}</Text>
          </View>
        )}

        {marginTrend.length > 0 && (
          <View style={styles.section}>
            <DKLabel style={styles.sectionLabel}>{t('marketInsights.marginTrend', 'COHORT MARGIN — 12 MONTHS')}</DKLabel>
            <View style={styles.card}>
              {marginTrend.map((m, idx) => {
                const monthLabel = new Date(m.month).toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' });
                const barPct = Math.max(2, Math.min(100, m.avgMargin * 2));
                return (
                  <View key={m.month} style={[styles.row, idx > 0 && styles.rowBorder]}>
                    <Text style={styles.rowLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{monthLabel}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${barPct}%` }]} />
                    </View>
                    <Text style={styles.rowValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{formatDecimal1(m.avgMargin, country)}%</Text>
                    <Text style={styles.rowMeta}>n={m.quotes}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {winRates.length > 0 && (
          <View style={styles.section}>
            <DKLabel style={styles.sectionLabel}>{t('marketInsights.winRate', 'WIN-RATE BY QUOTE AMOUNT')}</DKLabel>
            <View style={styles.card}>
              {winRates.map((wr, idx) => {
                const barPct = Math.max(2, Math.min(100, wr.winRate * 100));
                return (
                  <View key={wr.amountBucket} style={[styles.row, idx > 0 && styles.rowBorder]}>
                    <Text style={styles.rowLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{labelBucket(wr.amountBucket, currencySymbol(country as never)) ?? '—'}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${barPct}%`, backgroundColor: DK.colors.success }]} />
                    </View>
                    <Text style={styles.rowValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{Math.round(wr.winRate * 100)}%</Text>
                    <Text style={styles.rowMeta}>n={wr.quotes}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {daily.length > 0 && (
          <View style={styles.section}>
            <DKLabel style={styles.sectionLabel}>{t('marketInsights.last30Days', 'LAST 30 DAYS — YOUR ACTIVITY')}</DKLabel>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('marketInsights.quotesSent', 'Quotes sent')}</Text>
                <Text style={styles.rowValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{totals30d.sent}</Text>
              </View>
              <View style={[styles.row, styles.rowBorder]}>
                <Text style={styles.rowLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('marketInsights.accepted', 'Accepted')}</Text>
                <Text style={styles.rowValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{totals30d.accepted} <Text style={styles.rowMeta}>· {acceptRate30d}%</Text></Text>
              </View>
              <View style={[styles.row, styles.rowBorder]}>
                <Text style={styles.rowLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('marketInsights.invoicesPaid', 'Invoices paid')}</Text>
                <Text style={styles.rowValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{totals30d.paid}</Text>
              </View>
              <View style={[styles.row, styles.rowBorder]}>
                <Text style={styles.rowLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('marketInsights.received', 'Received')}</Text>
                <Text style={styles.rowValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{formatCurrency0(totals30d.paidEur, country as Country)}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.footnote}>
          {t('marketInsights.footnote', 'Cohort data uses k-anonymity (≥5 contractors per cell). Your individual numbers are never exposed to others.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Quote-amount buckets. The symbol comes from the contractor's country — these
 * were hardcoded €, so a UK contractor read their own turnover in euros.
 * An unknown bucket returns null rather than leaking the raw enum ("under_1k").
 */
function labelBucket(b: string, sym: string): string | null {
  return ({
    under_1k: `< ${sym}1k`,
    '1k_5k': `${sym}1k–${sym}5k`,
    '5k_10k': `${sym}5k–${sym}10k`,
    '10k_25k': `${sym}10k–${sym}25k`,
    over_25k: `> ${sym}25k`,
  } as Record<string, string>)[b] ?? null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  content: { padding: GRID.lg, paddingBottom: GRID.xl * 2, gap: GRID.md },
  subtitle: { fontSize: 13, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: GRID.xl, gap: GRID.sm },
  emptyTitle: { fontSize: 18, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  emptyText: { fontSize: 14, fontFamily: TYPE.bodyFamily, color: DK.colors.textMuted, textAlign: 'center', maxWidth: 320 },
  section: { gap: GRID.xs },
  sectionLabel: { color: DK.colors.textMuted },
  card: { backgroundColor: DK.colors.panel, borderRadius: RADIUS.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: DK.colors.border },
  rowLabel: { width: 90, fontSize: 13, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  barTrack: {
    flex: 1, height: 6, backgroundColor: DK.colors.bg,
    borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: DK.colors.accent },
  // Fixed width + localised content: guarded at the call sites with
  // adjustsFontSizeToFit rather than plain numberOfLines. NEVER ellipsize a
  // monetary value — "EUR 1.234" clipped to "EUR 1.2..." reads as a different
  // number. Shrinking is safe; truncating money is not.
  rowValue: { width: 60, textAlign: 'right', fontSize: 13, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  rowMeta: { fontSize: 11, fontFamily: TYPE.tinyFamily, color: DK.colors.textMuted, minWidth: 36, textAlign: 'right' },
  footnote: {
    fontSize: 11, fontFamily: TYPE.tinyFamily, color: DK.colors.textMuted,
    paddingHorizontal: GRID.sm, marginTop: GRID.md,
  },
});
