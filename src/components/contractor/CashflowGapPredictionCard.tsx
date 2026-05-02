// =============================================================================
// CashflowGapPredictionCard (R300)
// =============================================================================
// Reads `ml_cashflow_gap_predictions` written by the daily train-extra-models
// cron. Pre-R300 the table was being populated but `getCashflowGapPrediction`
// had zero call sites. Same dormancy fix pattern as R292/R298.
//
// Lands on geld tab as a banner above CashFlowForecastCard. Hidden when
// the predicted gap is below €500 OR confidence < 0.5.
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { DK } from '../../theme/draftkings';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { getCashflowGapPrediction, type CashflowGapPrediction } from '../../services/intelligenceCaptureService';

const MIN_GAP_EUR = 500;
const MIN_CONFIDENCE = 0.5;

export function CashflowGapPredictionCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [pred, setPred] = useState<CashflowGapPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCashflowGapPrediction()
      .then((p) => { if (!cancelled) setPred(p); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading || !pred) return null;
  if (pred.confidence < MIN_CONFIDENCE) return null;
  if (Math.abs(pred.predictedGapEur) < MIN_GAP_EUR) return null;

  const isShortfall = pred.predictedGapEur < 0;
  const tone = isShortfall ? DK.colors.danger : DK.colors.success;
  const absEur = Math.round(Math.abs(pred.predictedGapEur));

  return (
    <Pressable
      style={[styles.card, { borderLeftColor: tone }]}
      onPress={() => router.push('/contractor/cashflow' as any)}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={isShortfall ? 'trending-down' : 'trending-up'} size={16} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <DKLabel style={styles.title}>
          {isShortfall
            ? t('geld.cashflowShortfallTitle', 'Cashflow shortfall predicted')
            : t('geld.cashflowSurplusTitle', 'Cashflow surplus predicted')}
        </DKLabel>
        <Text style={styles.sub}>
          {t('geld.cashflowGapSub', '€{{amount}} {{direction}} in next {{days}}d', {
            amount: absEur.toLocaleString(),
            direction: isShortfall ? t('geld.short', 'short') : t('geld.surplus', 'surplus'),
            days: pred.horizonDays,
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
