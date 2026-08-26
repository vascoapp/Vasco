// =============================================================================
// CASH-FLOW FORECAST CARD
// =============================================================================
// Sits on Vandaag / Geld. Shows the 30-day net cash change + the worst day
// so the contractor knows if they should chase payment or delay a PO.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { buildForecast, type ForecastSummary } from '../../services/cashFlowForecastService';
import { formatCurrency0, type Country } from '../../i18n/formatting';
import type { Invoice, Quote } from '../../domain/documents';
import type { Job } from '../../types/contractor';

interface Props {
  invoices: Invoice[];
  quotes: Quote[];
  jobs: Job[];
  startingBalance?: number;
  /** Drives currency symbol + grouping. Defaults to NL (EUR). UK→£, US→$. */
  country?: Country;
  onPress?: () => void;
}

// Was a LOCAL re-implementation of `formatCurrency0` — same Intl options, same
// narrowSymbol fallback, one file over. That is how this card kept trailing the
// euro sign after the shared formatter was changed to lead it: "17.848 €" sat
// directly under "€ 3,2 Tsd." on the same screen. One formatter.
const formatMoney0 = formatCurrency0;


export function CashFlowForecastCard({ invoices, quotes, jobs, startingBalance, country = 'NL', onPress }: Props) {
  const { t } = useTranslation();
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
    return `${sign}${formatMoney0(Math.abs(Math.round(net)), country)}`;
  }, [forecast, country]);

  if (!forecast) return null;
  const isNegative = forecast.minCashDay.cumulative < 0;

  return (
    <Pressable
      onPress={onPress}
      style={s.card}
      accessibilityRole="button"
      accessibilityLabel={t('cashflow.forecastTitle', 'Cash flow — next 30 days')}
    >
      <View style={s.header}>
        <Ionicons name="trending-up" size={18} color={Palette.hermesOrange} />
        <Text style={s.title}>{t('cashflow.forecastTitle', 'Cash flow — next 30 days')}</Text>
      </View>

      <Text style={[s.amount, { color: forecast.netChange >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
        {headline}
      </Text>

      <View style={s.row}>
        <Meta label={t('cashflow.inflow', 'Inflow')} value={formatMoney0(Math.round(forecast.totalInflow), country)} color={SemanticColors.feedbackSuccess} />
        <Meta label={t('cashflow.outflow', 'Outflow')} value={formatMoney0(Math.round(forecast.totalOutflow), country)} color={SemanticColors.feedbackError} />
      </View>

      {isNegative ? (
        <View style={s.warning}>
          <Ionicons name="warning" size={14} color={SemanticColors.feedbackWarning} />
          <Text style={s.warningText}>
            {t('cashflow.lowCashWarning', 'Low cash on {{date}} ({{amount}}) — chase open invoices.', {
              date: forecast.minCashDay.date,
              amount: formatMoney0(Math.round(forecast.minCashDay.cumulative), country),
            })}
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
