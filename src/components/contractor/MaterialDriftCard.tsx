// =============================================================================
// MaterialDriftCard (R192) — surface supplier + market-wide price drift
// =============================================================================
// Renders the top N drift alerts so a contractor can re-quote open work
// before margin evaporates. Hidden when no drift signal is available
// (no data, k-anonymity not yet satisfied, or nothing moved >=5%).
// =============================================================================

import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { DK } from '../../theme/draftkings';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import {
  useMaterialDrift,
  severityFor,
  directionFor,
  matchQuotesToDrift,
  type MaterialDriftRow,
} from '../../services/materialDriftService';
import {
  useMaterialSeasonal,
  materialPriceVsCheapestSeason,
} from '../../services/seasonalityMoatService';
import { useAppState } from '../../state/AppState';

const TOP_N = 3;

interface Props {
  trade: string;
  country: string;
  onPress?: () => void;
}

export function MaterialDriftCard({ trade, country, onPress }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { drift, loading } = useMaterialDrift(trade, country);
  const { quotes } = useAppState();
  // R199: fetch material seasonal bundle once; per-row matching happens in
  // DriftRow via materialPriceVsCheapestSeason.
  const { bundle: seasonalBundle } = useMaterialSeasonal(trade, country, null);

  // R193: match each drift row to the contractor's open quotes so we can
  // show "affects N open quotes" beside the drift chip. Recompute only
  // when drift rows or quotes change.
  const affectedMap = useMemo(
    () => matchQuotesToDrift(drift?.rows ?? [], quotes as any),
    [drift, quotes],
  );

  // Hide while loading OR when there's no actionable drift. Rendering an
  // empty state would just be noise on the geld tab.
  if (loading || !drift || drift.rows.length === 0) return null;

  const top = drift.rows.slice(0, TOP_N);
  const anyHigh = top.some(r => severityFor(r.driftPct) === 'high');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }]}
    >
      <View style={s.header}>
        <View
          style={[
            s.iconWrap,
            { backgroundColor: (anyHigh ? DK.colors.danger : DK.colors.accent) + '22' },
          ]}
        >
          <Ionicons
            name="trending-up"
            size={18}
            color={anyHigh ? DK.colors.danger : DK.colors.accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DKLabel style={s.title}>
            {t('dk.money.materialDriftTitle', 'Material price drift').toUpperCase()}
          </DKLabel>
          <Text style={s.sub}>
            {t('dk.money.materialDriftSub', '{{count}} alerts from the cohort', {
              count: drift.rows.length,
            })}
          </Text>
        </View>
        {onPress && (
          <Ionicons name="chevron-forward" size={18} color={DK.colors.textMuted} />
        )}
      </View>

      <View style={s.list}>
        {top.map(row => {
          const affectedIds = affectedMap[row.materialName] ?? [];
          const seasonal = materialPriceVsCheapestSeason(seasonalBundle, row.materialName);
          return (
            <DriftRow
              key={`${row.materialName}|${row.supplierId}`}
              row={row}
              affectedCount={affectedIds.length}
              seasonalPeakPct={seasonal && seasonal.pctAboveCheapest >= 8 ? seasonal.pctAboveCheapest : null}
              onRowPress={
                affectedIds.length > 0
                  ? () => router.push(`/quotes/${affectedIds[0]}` as any)
                  : undefined
              }
            />
          );
        })}
      </View>
    </Pressable>
  );
}

function DriftRow({
  row,
  affectedCount,
  seasonalPeakPct,
  onRowPress,
}: {
  row: MaterialDriftRow;
  affectedCount: number;
  seasonalPeakPct: number | null;
  onRowPress?: () => void;
}) {
  const { t } = useTranslation();
  const severity = severityFor(row.driftPct);
  const direction = directionFor(row.driftPct);
  const tone =
    direction === 'up'
      ? severity === 'high'
        ? DK.colors.danger
        : DK.colors.accent
      : DK.colors.success;

  const Container: any = onRowPress ? Pressable : View;
  const containerProps: any = onRowPress
    ? {
        onPress: (e: any) => { e.stopPropagation?.(); onRowPress(); },
        hitSlop: 6,
        style: ({ pressed }: { pressed: boolean }) => [s.row, pressed && { opacity: 0.85 }],
      }
    : { style: s.row };

  return (
    <Container {...containerProps}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {row.materialName}
        </Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {row.supplierName}
          {row.isMarketWide
            ? ` · ${t('dk.money.marketWide', 'market-wide')}`
            : ''}
          {affectedCount > 0
            ? ` · ${t('dk.money.affectedQuotes', '{{count}} open quotes', { count: affectedCount })}`
            : ''}
          {seasonalPeakPct !== null
            ? ` · ${t('dk.money.seasonalPeak', 'peak season +{{pct}}%', { pct: Math.round(seasonalPeakPct) })}`
            : ''}
        </Text>
      </View>
      <View style={s.deltaBlock}>
        <Text style={[s.deltaPct, { color: tone }]}>
          {row.driftPct >= 0 ? '+' : ''}
          {row.driftPct.toFixed(0)}%
        </Text>
        <Ionicons
          name={direction === 'up' ? 'arrow-up' : 'arrow-down'}
          size={12}
          color={tone}
        />
        {onRowPress && (
          <Ionicons name="chevron-forward" size={12} color={DK.colors.textMuted} />
        )}
      </View>
    </Container>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DK.colors.border,
    padding: GRID.md,
    gap: GRID.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: TYPE.titleSize, color: DK.colors.text },
  sub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginTop: 2 },
  list: { gap: GRID.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: GRID.xs,
    gap: GRID.sm,
  },
  rowTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.text,
  },
  rowSub: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.textMuted,
    marginTop: 1,
  },
  deltaBlock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deltaPct: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily },
});
