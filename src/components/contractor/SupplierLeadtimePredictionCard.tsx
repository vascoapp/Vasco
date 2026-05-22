// =============================================================================
// SupplierLeadtimePredictionCard (R300)
// =============================================================================
// Reads `ml_supplier_leadtime_predictions` written by daily train-extra-models
// cron. Pre-R300 zero callers — same dormancy fix as R292/R298. Lands on
// inkoop adjacent to MaterialPriceForecastCard. Hidden when no supplier
// clears the (probability ≥0.5, delay ≥2d) bar.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { getSupplierLeadtimePredictions, type SupplierLeadtimePrediction } from '../../services/intelligenceCaptureService';

const MIN_PROB = 0.5;
const MIN_DELAY_DAYS = 2;
const TOP_N = 3;

export function SupplierLeadtimePredictionCard() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SupplierLeadtimePrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSupplierLeadtimePredictions()
      .then((r) => { if (!cancelled) setRows(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const top = useMemo(() => {
    return rows
      .filter(r => r.delayProbability >= MIN_PROB && r.predictedDelayDays >= MIN_DELAY_DAYS && r.confidence >= 0.5)
      .sort((a, b) => b.predictedDelayDays - a.predictedDelayDays)
      .slice(0, TOP_N);
  }, [rows]);

  if (loading || top.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="time-outline" size={16} color={DK.colors.highlight} />
        </View>
        <View style={{ flex: 1 }}>
          <DKLabel style={styles.title}>{t('inkoop.leadtimeForecastTitle', 'Supplier delays predicted')}</DKLabel>
          <Text style={styles.sub}>
            {t('inkoop.leadtimeForecastSub', '{{n}} suppliers running slower than usual', { n: top.length })}
          </Text>
        </View>
      </View>
      <View style={styles.list}>
        {top.map((r) => {
          const probPct = Math.round(r.delayProbability * 100);
          const tone = r.predictedDelayDays >= 5 ? DK.colors.danger : DK.colors.highlight;
          return (
            <View key={r.supplierId} style={styles.row}>
              <Text style={styles.rowName} numberOfLines={1}>{r.supplierId}</Text>
              <Text style={styles.rowMeta}>
                {t('inkoop.leadtimeRow', '+{{days}}d · {{prob}}%', {
                  days: Math.round(r.predictedDelayDays),
                  prob: probPct,
                })}
              </Text>
              <View style={[styles.dot, { backgroundColor: tone }]} />
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
  list: { gap: GRID.xs },
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
  rowMeta: {
    fontSize: TYPE.captionSize,
    fontFamily: 'Archivo_700Bold',
    color: DK.colors.textMuted,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
