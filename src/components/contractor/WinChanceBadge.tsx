// =============================================================================
// WIN CHANCE BADGE — ML-predicted probability the quote is accepted
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { prefillFromQuote } from '../../services/mlPrefillService';
import { SemanticColors, Palette } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';

interface Props {
  trade: string;
  amount: number;
  estimatedHours: number;
  materialCount: number;
  customerId?: string;
  priceVsMarketPct?: number;
}

export function WinChanceBadge(props: Props) {
  const [pct, setPct] = useState<number | null>(null);
  const [note, setNote] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    prefillFromQuote(props).then((r) => {
      if (cancelled) return;
      setPct(r.winChancePct);
      setNote(r.recommendation);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [props.trade, props.amount, props.estimatedHours, props.materialCount, props.customerId, props.priceVsMarketPct]);

  if (pct == null) return null;
  const color = pct >= 70 ? SemanticColors.feedbackSuccess
    : pct >= 45 ? Palette.hermesOrange
    : SemanticColors.feedbackError;

  return (
    <View style={[styles.pill, { backgroundColor: color + '18', borderColor: color + '44' }]}>
      <Text style={[styles.pct, { color }]}>Win chance {pct}%</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: GRID.sm, paddingVertical: GRID.xs, borderRadius: RADIUS.sm, borderWidth: 1, alignSelf: 'flex-start' },
  pct: { fontSize: TYPE.captionSize, fontFamily: TYPE.sectionFamily },
  note: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary, marginTop: 2 },
});
