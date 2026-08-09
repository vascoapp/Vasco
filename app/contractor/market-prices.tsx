// =============================================================================
// MARKET PRICES — Pricing intelligence dashboard
// =============================================================================
// Shows the contractor how their prices compare to the market.
// Data from: cohort benchmarks, price indexes, scan history, supplier catalogs.
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { Sparkline } from '../../src/components/shared/Sparkline';
import { useCohortBenchmarks, compareToMarket } from '../../src/services/cohortBenchmarkService';
import { usePriceIndex } from '../../src/services/priceIndexService';
import { getPriceRecommendations, type PriceRecommendation } from '../../src/services/invoiceScanService';
import { useAuth } from '../../src/context/AuthContext';
import { formatCurrency } from '../../src/i18n/formatting';

type IconName = keyof typeof Ionicons.glyphMap;

// Action labels resolved via t() inside component — keys stored here
const ACTION_ICONS_BASE: Record<string, { icon: IconName; color: string; key: string; fallback: string }> = {
  buy_now: { icon: 'cart', color: SemanticColors.feedbackSuccess, key: 'market.buyNow', fallback: 'Nu kopen' },
  wait: { icon: 'time', color: Palette.hermesOrange, key: 'market.wait', fallback: 'Wachten' },
  switch_supplier: { icon: 'swap-horizontal', color: Palette.hermesOrange, key: 'market.switchSupplier', fallback: 'Wissel leverancier' },
};

const TREND_ICONS: Record<string, { icon: IconName; color: string }> = {
  rising: { icon: 'trending-up', color: SemanticColors.feedbackError },
  stable: { icon: 'remove', color: SemanticColors.textTertiary },
  falling: { icon: 'trending-down', color: SemanticColors.feedbackSuccess },
};

export default function MarketPricesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const trade = user?.trade ?? 'general';
  const country = user?.country ?? 'NL';

  // priceIndexService/cohortBenchmarkService emit snake_case DB enums
  // ('concrete_cement', 'copper_pipes', 'general'). They were rendered raw as
  // category chips. Falls back to a de-underscored form so a NEW enum value
  // degrades to "Some Category" rather than leaking the key.
  // Supplier IDs are internal slugs ('gamma', 'bouwmaat'); show a readable
  // name rather than the raw key.
  const supplierLabel = (id: string) =>
    id ? id.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

  const categoryLabel = (key: string) =>
    t(`market.categories.${key}`, {
      defaultValue: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    });

  // Resolve action labels with i18n
  const ACTION_ICONS = useMemo(() => {
    const resolved: Record<string, { icon: IconName; color: string; label: string }> = {};
    for (const [k, v] of Object.entries(ACTION_ICONS_BASE)) {
      resolved[k] = { icon: v.icon, color: v.color, label: t(v.key, v.fallback) };
    }
    return resolved;
  }, [t]);

  const { benchmarks, loading: benchLoading } = useCohortBenchmarks(trade, country);
  const { data: index, loading: indexLoading } = usePriceIndex(country);
  const [recommendations, setRecommendations] = useState<PriceRecommendation[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getPriceRecommendations().then(setRecommendations).catch(() => {});
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([
      getPriceRecommendations().then(setRecommendations),
    ]).finally(() => { setRefreshing(false); hapticSuccess(); });
  };

  const topBenchmarks = useMemo(() =>
    (benchmarks?.materialBenchmarks ?? []).slice(0, 8),
    [benchmarks]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{t('market.title', 'Marktprijzen')}</Text>
          <Text style={styles.headerSub}>{t('market.contractorsInRegion', { defaultValue: '{{count}} aannemers in jouw regio', count: benchmarks?.contractorsInCohort ?? 0 })}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* Construction Cost Index */}
        {index?.overallIndex && (
          <FadeIn delay={0}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{t('market.constructionCostIndex', 'Bouwkostenindex')}</Text>
                <View style={[styles.trendBadge, { backgroundColor: TREND_ICONS[index.overallIndex.trend].color + '15' }]}>
                  <Ionicons name={TREND_ICONS[index.overallIndex.trend].icon} size={14} color={TREND_ICONS[index.overallIndex.trend].color} />
                  <Text style={[styles.trendText, { color: TREND_ICONS[index.overallIndex.trend].color }]}>
                    {index.overallIndex.changePercent12m > 0 ? '+' : ''}{index.overallIndex.changePercent12m.toFixed(1)}% /{t('market.year', 'jaar')}
                  </Text>
                </View>
              </View>
              <Text style={styles.indexValue}>{index.overallIndex.currentIndex.toFixed(1)}</Text>
              <Text style={styles.indexLabel}>{t('market.indexBasis', { country })}</Text>
              {index.materials && index.materials.length > 0 && (
                <View style={styles.trendsGrid}>
                  {index.materials.slice(0, 4).map((mt: any) => (
                    <View key={mt.category} style={styles.trendItem}>
                      <Text style={styles.trendCategory}>{categoryLabel(mt.category)}</Text>
                      <Ionicons
                        name={TREND_ICONS[mt.trend].icon}
                        size={14}
                        color={TREND_ICONS[mt.trend].color}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </FadeIn>
        )}

        {/* Price Recommendations */}
        <FadeIn delay={100}>
          <Text style={styles.sectionTitle}>{t('market.purchaseAdvice', 'Inkoopadvies')}</Text>
          {recommendations.length > 0 ? (
            recommendations.slice(0, 5).map((rec, i) => {
              const action = ACTION_ICONS[rec.action];
              const trend = TREND_ICONS[rec.trend];
              return (
                <View key={i} style={styles.recCard}>
                  <View style={styles.recHeader}>
                    <View style={[styles.recIcon, { backgroundColor: action.color + '15' }]}>
                      <Ionicons name={action.icon} size={16} color={action.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recMaterial} numberOfLines={1}>{rec.materialName}</Text>
                      <Text style={styles.recReason} numberOfLines={2}>{rec.reason}</Text>
                    </View>
                    <View style={styles.recPrices}>
                      <Text style={styles.recCurrentPrice}>{formatCurrency(rec.currentPrice, country)}</Text>
                      {rec.savingsPotential > 0 && (
                        <Text style={styles.recSavings}>-{formatCurrency(rec.savingsPotential, country)}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.recFooter}>
                    <View style={[styles.actionBadge, { backgroundColor: action.color + '15' }]}>
                      <Text style={[styles.actionBadgeText, { color: action.color }]}>{action.label}</Text>
                    </View>
                    <Ionicons name={trend.icon} size={14} color={trend.color} />
                    <Text style={styles.recAvg}>{t('market.avg', 'Gem')}: {formatCurrency(rec.avgPrice, country)}</Text>
                    <Text style={styles.recLowest}>{t('market.lowest', 'Laagst')}: {formatCurrency(rec.lowestPrice, country)} ({supplierLabel(rec.lowestSupplier)})</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.sectionEmpty}>
              <Ionicons name="receipt-outline" size={48} color={SemanticColors.textTertiary} />
              <Text style={styles.sectionEmptyTitle}>{t('market.noRecommendations', 'Geen aanbevelingen')}</Text>
              <Text style={styles.sectionEmptyDesc}>{t('market.noRecommendationsDesc', 'Scan leveranciersfacturen om gepersonaliseerde prijsaanbevelingen te krijgen')}</Text>
            </View>
          )}
        </FadeIn>

        {/* Material Benchmarks */}
        <FadeIn delay={200}>
          <Text style={styles.sectionTitle}>{t('market.materialPrices', 'Materiaalprijzen')}{topBenchmarks.length > 0 ? ` (${topBenchmarks.length})` : ''}</Text>
          {topBenchmarks.length > 0 ? (
            topBenchmarks.map((bm, i) => {
              // R11.4: hide the trend icon when there's no real signal.
              // The cloud RPC currently doesn't populate priceChange30d/
              // priceChange90d/volatility — they default to 0/'stable'.
              // Showing a "stable" icon on every material falsely implied
              // an actual trend reading of "flat". Until the RPC returns
              // real trend deltas, we suppress the indicator.
              const hasTrendSignal = bm.priceChange30d !== 0 || bm.priceChange90d !== 0 || bm.volatility > 0;
              return (
              <View key={i} style={styles.bmCard}>
                <View style={styles.bmHeader}>
                  <Text style={styles.bmName} numberOfLines={1}>{bm.materialName}</Text>
                  {hasTrendSignal && (
                    <Ionicons name={TREND_ICONS[bm.trend].icon} size={14} color={TREND_ICONS[bm.trend].color} />
                  )}
                </View>
                <View style={styles.bmPrices}>
                  <View style={styles.bmPrice}>
                    <Text style={styles.bmPriceValue}>{formatCurrency(bm.p25, country)}</Text>
                    <Text style={styles.bmPriceLabel}>P25</Text>
                  </View>
                  <View style={[styles.bmPrice, styles.bmPriceHighlight]}>
                    <Text style={[styles.bmPriceValue, { color: Palette.hermesOrange }]}>{formatCurrency(bm.medianPrice, country)}</Text>
                    <Text style={styles.bmPriceLabel}>{t('market.median', 'Mediaan')}</Text>
                  </View>
                  <View style={styles.bmPrice}>
                    <Text style={styles.bmPriceValue}>{formatCurrency(bm.p75, country)}</Text>
                    <Text style={styles.bmPriceLabel}>P75</Text>
                  </View>
                </View>
                <Text style={styles.bmMeta}>{bm.sampleSize} {t('market.dataPoints', 'datapunten')} · {categoryLabel(bm.category)}</Text>
              </View>
              );
            })
          ) : (
            <View style={styles.sectionEmpty}>
              <Ionicons name="analytics-outline" size={48} color={SemanticColors.textTertiary} />
              <Text style={styles.sectionEmptyTitle}>{t('market.noBenchmarks', 'Meer data nodig')}</Text>
              <Text style={styles.sectionEmptyDesc}>{t('market.noBenchmarksDesc', 'Meer data nodig voor benchmarks')}</Text>
            </View>
          )}
        </FadeIn>

        {/* Trade Benchmarks */}
        {benchmarks?.tradeBenchmarks && benchmarks.tradeBenchmarks.length > 0 && (
          <FadeIn delay={300}>
            <Text style={styles.sectionTitle}>{t('market.marketAverages', 'Marktgemiddelden')}</Text>
            {/* Below the k-anonymity threshold getCohortBenchmarks falls back to
                TRADE_BASELINES — published industry figures, not this region's
                cohort. Unlabelled, the screen read "0 aannemers in jouw regio"
                and "Meer data nodig voor benchmarks" directly above four precise
                market averages, with no way to tell which was which. */}
            {(benchmarks?.contractorsInCohort ?? 0) < 5 && (
              <Text style={styles.sectionEmptyDesc}>{t('market.baselineNote')}</Text>
            )}
            {benchmarks.tradeBenchmarks.map((tb, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.tradeRow}>
                  <View style={styles.tradeStat}>
                    <Text style={styles.tradeValue}>{formatCurrency(tb.avgHourlyRate, country)}</Text>
                    <Text style={styles.tradeLabel}>{t('market.hourlyRate', 'Uurtarief')}</Text>
                  </View>
                  <View style={styles.tradeDivider} />
                  <View style={styles.tradeStat}>
                    <Text style={styles.tradeValue}>{tb.avgJobMargin}%</Text>
                    <Text style={styles.tradeLabel}>{t('market.margin', 'Marge')}</Text>
                  </View>
                  <View style={styles.tradeDivider} />
                  <View style={styles.tradeStat}>
                    <Text style={styles.tradeValue}>{Math.round(tb.avgQuoteAcceptanceRate * 100)}%</Text>
                    <Text style={styles.tradeLabel}>{t('market.acceptance', 'Acceptatie')}</Text>
                  </View>
                  <View style={styles.tradeDivider} />
                  <View style={styles.tradeStat}>
                    <Text style={styles.tradeValue}>{tb.avgDSO}d</Text>
                    <Text style={styles.tradeLabel}>DSO</Text>
                  </View>
                </View>
              </View>
            ))}
          </FadeIn>
        )}

        {/* Empty state */}
        {!benchLoading && !indexLoading && topBenchmarks.length === 0 && recommendations.length === 0 && (
          <FadeIn delay={0}>
            <View style={styles.empty}>
              <Ionicons name="analytics-outline" size={48} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyTitle}>{t('market.noDataYet', 'Nog geen marktdata')}</Text>
              <Text style={styles.emptyDesc}>{t('market.noDataDesc', 'Scan leveranciersfacturen of maak offertes aan om prijsinzichten te krijgen')}</Text>
            </View>
          </FadeIn>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12 },
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary,  textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.md },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking, marginTop: GRID.sm },
  card: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  indexValue: { fontSize: 32, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary },
  indexLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  trendText: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily },
  trendsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  trendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SemanticColors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  trendCategory: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary },
  // Recommendations
  recCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 14, gap: 8 },
  recHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  recIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  recMaterial: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  recReason: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  recPrices: { alignItems: 'flex-end' },
  recCurrentPrice: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  recSavings: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.feedbackSuccess },
  recFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  actionBadgeText: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily },
  recAvg: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary },
  recLowest: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary, flex: 1, textAlign: 'right' },
  // Material Benchmarks
  bmCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 14, gap: 6 },
  bmHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bmName: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary, flex: 1 },
  bmPrices: { flexDirection: 'row', gap: 0 },
  bmPrice: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  bmPriceHighlight: { backgroundColor: Palette.hermesOrange + '08', borderRadius: RADIUS.sm },
  bmPriceValue: { fontSize: TYPE.bodySize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  bmPriceLabel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textTertiary },
  bmMeta: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textTertiary },
  // Trade Benchmarks
  tradeRow: { flexDirection: 'row', alignItems: 'center' },
  tradeStat: { flex: 1, alignItems: 'center' },
  tradeValue: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  tradeLabel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  tradeDivider: { width: 1, height: 28, backgroundColor: SemanticColors.borderDefault },
  // Section empty states
  sectionEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  sectionEmptyTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
  sectionEmptyDesc: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textTertiary, textAlign: 'center', paddingHorizontal: 20 },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  emptyDesc: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
});
