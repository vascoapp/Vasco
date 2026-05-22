// =============================================================================
// CASH-FLOW FORECAST CARD
// =============================================================================
// Sits on Vandaag / Geld. Shows the 30-day net cash change + the worst day
// so the contractor knows if they should chase payment or delay a PO.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { buildForecast, type ForecastSummary } from '../../services/cashFlowForecastService';
import type { Invoice, Quote } from '../../domain/documents';
import type { Job } from '../../types/contractor';

interface Props {
  invoices: Invoice[];
  quotes: Quote[];
  jobs: Job[];
  startingBalance?: number;
  onPress?: () => void;
}

export function CashFlowForecastCard({ invoices, quotes, jobs, startingBalance, onPress }: Props) {
  const [forecast, setForecast] = useState<ForecastSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildForecast({ invoices, quotes, jobs, startingBalance }).then((f) => {
      if (!cancelled) setForecast(f);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [invoices, quotes, jobs, startingBalance]);

  const headline = useMemo(() => {
    if (!forecast) return null;
    const net = forecast.netChange;
    const sign = net >= 0 ? '+' : '−';
    return `${sign}€${Math.abs(Math.round(net)).toLocaleString()}`;
  }, [forecast]);

  if (!forecast) return null;
  const isNegative = forecast.minCashDay.cumulative < 0;

  return (
    <Pressable
      onPress={onPress}
      style={s.card}
      accessibilityRole="button"
      accessibilityLabel="Cash flow forecast — 30 days"
    >
      <View style={s.header}>
        <Ionicons name="trending-up" size={18} color={Palette.hermesOrange} />
        <Text style={s.title}>Cash flow — next 30 days</Text>
      </View>

      <Text style={[s.amount, { color: forecast.netChange >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
        {headline}
      </Text>

      <View style={s.row}>
        <Meta label="Inflow" value={`€${Math.round(forecast.totalInflow).toLocaleString()}`} color={SemanticColors.feedbackSuccess} />
        <Meta label="Outflow" value={`€${Math.round(forecast.totalOutflow).toLocaleString()}`} color={SemanticColors.feedbackError} />
      </View>

      {isNegative ? (
        <View style={s.warning}>
          <Ionicons name="warning" size={14} color={SemanticColors.feedbackWarning} />
          <Text style={s.warningText}>
            Low cash on {forecast.minCashDay.date} (€{forecast.minCashDay.cumulative.toLocaleString()}) — chase open invoices.
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Meta({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={[s.metaValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: GRID.xs },
  title: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
  amount: { fontSize: 28, fontFamily: TYPE.sectionFamily },
  row: { flexDirection: 'row', gap: GRID.md },
  metaLabel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: TYPE.titleSize, fontFamily: TYPE.sectionFamily, marginTop: 2 },
  warning: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    padding: GRID.sm, backgroundColor: SemanticColors.feedbackWarning + '18', borderRadius: RADIUS.sm,
  },
  warningText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textPrimary },
});
