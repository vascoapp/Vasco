// =============================================================================
// SeasonalityBanner (R285)
// =============================================================================
// Inline banner on inkoop: when the cohort's median price for a tracked
// material is ≥8% above its cheapest season, show "{material} is X% above
// {cheapest-season} prices — bulk now if you can". One row, no chrome.
// Hidden when the cohort bundle is empty or no material clears the gate.
// =============================================================================

import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { useMaterialSeasonal, currentSeason } from '../../services/seasonalityMoatService';

const PEAK_THRESHOLD_PCT = 8;

interface Props {
  trade: string;
  country: string;
}

export function SeasonalityBanner({ trade, country }: Props) {
  const { t } = useTranslation();
  const { bundle, loading } = useMaterialSeasonal(trade, country, null);

  // Pick the worst-currently-in-peak material: highest pctAboveCheapest in
  // the current season among materials that have ≥2 seasons of data.
  const worst = useMemo(() => {
    if (!bundle || bundle.rows.length === 0) return null;
    const season = currentSeason();
    const byMaterial = new Map<string, typeof bundle.rows>();
    for (const r of bundle.rows) {
      const arr = byMaterial.get(r.materialName) ?? [];
      arr.push(r);
      byMaterial.set(r.materialName, arr);
    }
    let best: { name: string; pct: number; cheapest: string } | null = null;
    for (const [name, rows] of byMaterial) {
      if (rows.length < 2) continue;
      const current = rows.find(r => r.season === season);
      if (!current || !(current.medianPrice > 0)) continue;
      const cheapest = rows.reduce((acc, r) =>
        r.medianPrice > 0 && r.medianPrice < acc.medianPrice ? r : acc, rows[0]);
      if (!(cheapest.medianPrice > 0)) continue;
      const pct = ((current.medianPrice - cheapest.medianPrice) / cheapest.medianPrice) * 100;
      if (pct >= PEAK_THRESHOLD_PCT && (!best || pct > best.pct)) {
        best = { name, pct, cheapest: cheapest.season };
      }
    }
    return best;
  }, [bundle]);

  if (loading || !worst) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="leaf" size={14} color={DK.colors.highlight} />
      <Text style={styles.text}>
        {t(
          'inkoop.seasonalPeak',
          '{{material}} is now {{pct}}% above {{cheapest}} prices — bulk now if you can.',
          {
            material: worst.name,
            pct: Math.round(worst.pct),
            cheapest: t(`inkoop.season.${worst.cheapest}`, worst.cheapest),
          },
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: DK.colors.highlight + '14',
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    borderLeftWidth: 3,
    borderLeftColor: DK.colors.highlight,
  },
  text: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.text,
    lineHeight: 18,
  },
});
