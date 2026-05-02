// =============================================================================
// MaterialPriceForecastCard (R292)
// =============================================================================
// Renders the ML material-price forecasts written by `train-extra-models`
// cron into `ml_material_price_forecasts`. Pre-R292 the table was being
// populated weekly but no UI consumed it — `getMaterialPriceForecasts` had
// zero call sites. Same dormancy pattern as R285 / R288 / R291.
//
// Hidden when no forecast clears the confidence + magnitude bar (the cron
// returns rows for every category by default).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { getMaterialPriceForecasts, type MaterialPriceForecast } from '../../services/intelligenceCaptureService';

const MIN_CONFIDENCE = 0.5;
const MIN_ABS_PCT = 3;
const TOP_N = 3;

interface Props {
  trade: string;
  country: string;
}

export function MaterialPriceForecastCard({ trade, country }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<MaterialPriceForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMaterialPriceForecasts(trade, country)
      .then((r) => { if (!cancelled) setRows(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trade, country]);

  const top = useMemo(() => {
    return rows
      .filter(r => r.confidence >= MIN_CONFIDENCE && Math.abs(r.predictedPriceChangePct) >= MIN_ABS_PCT)
      .sort((a, b) => Math.abs(b.predictedPriceChangePct) - Math.abs(a.predictedPriceChangePct))
      .slice(0, TOP_N);
  }, [rows]);

  if (loading || top.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="trending-up" size={16} color={DK.colors.highlight} />
        </View>
        <View style={{ flex: 1 }}>
          <DKLabel style={styles.title}>{t('inkoop.priceForecastTitle', 'Price forecast')}</DKLabel>
          <Text style={styles.sub}>
            {t('inkoop.priceForecastSub', 'ML predictions for the next {{days}} days', {
              days: top[0]?.forecastHorizonDays ?? 30,
            })}
          </Text>
        </View>
      </View>
      <View style={styles.list}>
        {top.map((r) => {
          const sign = r.predictedPriceChangePct >= 0 ? '+' : '';
          const tone = r.predictedPriceChangePct >= 0
            ? DK.colors.danger
            : DK.colors.success;
          return (
            <View key={r.materialCategory} style={styles.row}>
              <Text style={styles.rowName} numberOfLines={1}>{r.materialCategory}</Text>
              <View style={[styles.deltaChip, { backgroundColor: tone + '20' }]}>
                <Text style={[styles.deltaChipText, { color: tone }]}>
                  {sign}{r.predictedPriceChangePct.toFixed(1)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: DK.colors.highlight + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPE.labelSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: DK.colors.text,
  },
  sub: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.textMuted,
    marginTop: 2,
  },
  list: {
    gap: GRID.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: GRID.xs,
    gap: GRID.sm,
  },
  rowName: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: 'Inter_600SemiBold',
    color: DK.colors.text,
    textTransform: 'capitalize',
  },
  deltaChip: {
    paddingHorizontal: GRID.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  deltaChipText: {
    fontSize: TYPE.captionSize,
    fontFamily: 'Archivo_800ExtraBold',
  },
});
