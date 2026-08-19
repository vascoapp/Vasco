// =============================================================================
// CapacityOverrunCard (R298)
// =============================================================================
// Surfaces the ML capacity-overrun prediction written by `train-extra-models`
// daily cron into `ml_capacity_overrun_predictions`. Pre-R298 the table was
// being populated but `getCapacityOverrunPrediction` had zero call sites —
// same dormancy pattern as R292 / R285. Sister card to MaterialPriceForecastCard
// but on Vandaag (scheduling concern, not purchasing).
//
// Hidden when probability < 0.5 OR overrun < 1 day. Mounts on Vandaag below
// the KPI row so contractors see "Capacity overrun likely (~3d)" before they
// commit more work.
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { DK } from '../../theme/draftkings';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { getCapacityOverrunPrediction, type CapacityOverrunPrediction } from '../../services/intelligenceCaptureService';

const MIN_PROBABILITY = 0.5;
const MIN_OVERRUN_DAYS = 1;

export function CapacityOverrunCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [pred, setPred] = useState<CapacityOverrunPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCapacityOverrunPrediction()
      .then((p) => { if (!cancelled) setPred(p); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading || !pred) return null;
  if (pred.overrunProbability < MIN_PROBABILITY) return null;
  if (pred.predictedOverrunDays < MIN_OVERRUN_DAYS) return null;

  const tone = pred.overrunProbability >= 0.75 ? DK.colors.danger : DK.colors.highlight;
  const probPct = Math.round(pred.overrunProbability * 100);

  return (
    <Pressable
      style={[styles.card, { borderLeftColor: tone }]}
      onPress={() => router.push('/contractor/schedule' as any)}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="warning" size={16} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <DKLabel style={styles.title}>{t('vandaag.capacityOverrunTitle', 'Capacity overrun likely')}</DKLabel>
        <Text style={styles.sub}>
          {t('vandaag.capacityOverrunSub', '{{prob}}% chance · ~{{days}}d overrun in next {{horizon}}d', {
            prob: probPct,
            days: pred.predictedOverrunDays,
            horizon: pred.horizonDays,
          })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={DK.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.md,
    padding: GRID.md,
    borderLeftWidth: 3,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: DK.colors.panel2,
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
});
