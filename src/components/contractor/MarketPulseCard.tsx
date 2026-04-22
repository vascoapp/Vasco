// =============================================================================
// MarketPulseCard (R205) — unified surface for margin drift + customer risk
//                         + quote-accept lag
// =============================================================================
// Consolidates the three deferred moat dimensions into a single compact
// card on the geld tab. Each section is gated by its own "is there a
// meaningful signal?" check so the card stays silent when the cohort
// hasn't moved — no empty states, no filler.
//
// The card renders nothing at all when every section is silent. That's
// intentional: better to disappear than to be noise.
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { getMarginDrift, type MarginDrift } from '../../services/marginDriftService';
import { getCohortOverdueRate, bandFor, type CohortCustomerRisk } from '../../services/customerRiskMoatService';
import { getCohortAcceptLag, type CohortAcceptLag } from '../../services/quoteResponseLagMoatService';

interface Props {
  trade: string;
  country: string;
}

export function MarketPulseCard({ trade, country }: Props) {
  const { t } = useTranslation();
  const [margin, setMargin] = useState<MarginDrift | null>(null);
  const [risk, setRisk] = useState<CohortCustomerRisk | null>(null);
  const [lag, setLag] = useState<CohortAcceptLag | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMarginDrift(trade, country),
      getCohortOverdueRate(country, null),
      getCohortAcceptLag(trade, country, null),
    ]).then(([m, r, l]) => {
      if (cancelled) return;
      setMargin(m);
      setRisk(r);
      setLag(l);
    });
    return () => { cancelled = true; };
  }, [trade, country]);

  // Gate: only consider each section "worth showing" when it has non-thin data.
  const showMargin = margin !== null; // RPC only returns when |drift| ≥ 2pp
  const showRisk = risk !== null && risk.overdueRate !== null && risk.contractorCount >= 5;
  const showLag = lag !== null && lag.medianHours !== null && lag.contractorCount >= 5;

  if (!showMargin && !showRisk && !showLag) return null;

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.iconWrap}>
          <Ionicons name="pulse" size={18} color={DK.colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <DKLabel style={s.title}>
            {t('dk.money.marketPulseTitle', 'Market pulse').toUpperCase()}
          </DKLabel>
          <Text style={s.sub}>
            {t('dk.money.marketPulseSub', 'Cohort signals for {{trade}} in {{country}}', { trade, country })}
          </Text>
        </View>
      </View>

      <View style={s.list}>
        {showMargin && <MarginRow drift={margin!} />}
        {showRisk && <RiskRow risk={risk!} />}
        {showLag && <LagRow lag={lag!} />}
      </View>
    </View>
  );
}

function MarginRow({ drift }: { drift: MarginDrift }) {
  const { t } = useTranslation();
  const up = drift.driftPp >= 0;
  const tone = up ? DK.colors.success : DK.colors.danger;
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {t('dk.money.pulseMargin', 'Trade margin')}
        </Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {Math.round(drift.baselineMedianMargin)}% → {Math.round(drift.recentMedianMargin)}%
        </Text>
      </View>
      <Text style={[s.rowDelta, { color: tone }]}>
        {up ? '+' : ''}{drift.driftPp.toFixed(1)}pp
      </Text>
    </View>
  );
}

function RiskRow({ risk }: { risk: CohortCustomerRisk }) {
  const { t } = useTranslation();
  const band = bandFor(risk.overdueRate);
  const tone = band === 'high'
    ? DK.colors.danger
    : band === 'medium'
      ? DK.colors.accent
      : DK.colors.success;
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {t('dk.money.pulseRisk', 'Overdue rate')}
        </Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {t('dk.money.pulseRiskSub', '~{{reminders}} reminders avg', {
            reminders: risk.avgRemindersSent !== null ? risk.avgRemindersSent.toFixed(1) : '–',
          })}
        </Text>
      </View>
      <Text style={[s.rowDelta, { color: tone }]}>
        {Math.round((risk.overdueRate ?? 0) * 100)}%
      </Text>
    </View>
  );
}

function LagRow({ lag }: { lag: CohortAcceptLag }) {
  const { t } = useTranslation();
  const medianHours = lag.medianHours ?? 0;
  const label = medianHours < 48
    ? `${Math.round(medianHours)}h`
    : `${Math.round(medianHours / 24)}d`;
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {t('dk.money.pulseLag', 'Typical accept lag')}
        </Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {t('dk.money.pulseLagSub', '{{contractors}} contractors, {{samples}} quotes', {
            contractors: lag.contractorCount,
            samples: lag.sampleSize,
          })}
        </Text>
      </View>
      <Text style={[s.rowDelta, { color: DK.colors.text }]}>
        {label}
      </Text>
    </View>
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
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: DK.colors.accent + '22',
  },
  title: { fontSize: TYPE.titleSize, color: DK.colors.text },
  sub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginTop: 2 },
  list: { gap: GRID.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingVertical: GRID.xs,
  },
  rowTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  rowSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginTop: 1 },
  rowDelta: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily },
});
