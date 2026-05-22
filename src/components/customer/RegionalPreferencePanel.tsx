// =============================================================================
// RegionalPreferencePanel (R303)
// =============================================================================
// Surfaces "67% of {region} customers chose X" hints on the customer-decision
// portal. Reads `decisionIntelligence.getRegionalPreferences()` which is now
// backed by the R301 aggregation pipeline (k-anonymity ≥20 enforced
// server-side; returns null below threshold). Hidden when no signal.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { decisionIntelligence } from '../../intelligence/decisionIntelligence';
import { DK } from '../../theme/draftkings';

interface RegionalPreference {
  region: string;
  trade: string;
  decisionType: string;
  choices: { value: string; label: string; count: number; percentage: number }[];
  totalDecisions: number;
}

interface Props {
  region?: string;
  trade?: string;
  decisionType?: string;
  accentColor: string;
}

export function RegionalPreferencePanel({ region, trade, decisionType, accentColor }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<RegionalPreference | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!region || !trade || !decisionType) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (decisionIntelligence as any).getRegionalPreferences(region, trade, decisionType)
      .then((r: RegionalPreference | null) => { if (!cancelled) setData(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [region, trade, decisionType]);

  const top = useMemo(() => data?.choices.slice(0, 3) ?? [], [data]);
  if (loading || !data || top.length === 0) return null;

  // Don't surface when the top choice has <40% — too noisy
  if (top[0].percentage < 40) return null;

  return (
    <View style={[styles.panel, { borderLeftColor: accentColor }]}>
      <View style={styles.header}>
        <Ionicons name="people" size={14} color={accentColor} />
        <Text style={styles.headerText}>
          {t('customerPortal.regional.title', 'What others in your area chose')}
        </Text>
      </View>
      <View style={styles.list}>
        {top.map((c, idx) => (
          <View key={c.value} style={styles.row}>
            <Text style={styles.rank}>{idx + 1}.</Text>
            <Text style={styles.label} numberOfLines={1}>{c.label}</Text>
            <View style={[styles.pctChip, idx === 0 && { backgroundColor: accentColor + '22' }]}>
              <Text style={[styles.pctText, idx === 0 && { color: accentColor }]}>
                {Math.round(c.percentage)}%
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.footnote}>
        {t('customerPortal.regional.basedOn', 'Based on {{count}} similar decisions', { count: data.totalDecisions })}
      </Text>
    </View>
  );
}

// R10.4: theme tokens. Customer portal is dark DK; the previous light-gray
// panel #F9FAFB stuck out as a white card on a dark background.
const styles = StyleSheet.create({
  panel: {
    backgroundColor: DK.colors.panel2,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: DK.colors.text,
  },
  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rank: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: DK.colors.textMuted,
    minWidth: 16,
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: DK.colors.text,
  },
  pctChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: DK.colors.panel,
  },
  pctText: {
    fontSize: 12,
    fontFamily: 'Archivo_700Bold',
    color: DK.colors.textMuted,
  },
  footnote: {
    fontSize: 10,
    color: DK.colors.textMuted,
    fontStyle: 'italic',
  },
});
