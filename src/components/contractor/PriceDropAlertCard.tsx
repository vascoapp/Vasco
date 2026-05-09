// =============================================================================
// PriceDropAlertCard (R285, rewritten R66 round 46)
// =============================================================================
// Surfaces "you're paying X% above the cohort median" alerts on the inkoop
// screen. Pre-R46 the underlying checkPriceDrops used Math.random ±15% to
// fabricate "drop" prices — every alert was statistical noise. Now reads
// from the real material_price_history cohort via get_material_cohort_stats
// (k-anon ≥5 enforced server-side).
//
// Semantic shift: the "drop" used to mean "price fell" (impossible to
// observe without real-time feeds). Now it means "you're paying above the
// cohort median for this material" — actionable, verifiable, honest.
//
// Tier-gated to hasPriceDropAlerts (Pro+). 6h client cache to avoid
// re-running the cohort fetch on every screen mount.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { DKLabel } from '../shared/DKLabel';
import { checkPriceDrops, type PriceDropAlert } from '../../services/purchasingAgentService';
import type { Country } from '../../context/AuthContext';

const CACHE_KEY = '@vasco_price_drops_card';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const TOP_N = 3;

interface CachedDrops {
  alerts: PriceDropAlert[];
  fetchedAt: number;
  trade: string;
  country: string;
}

interface Props {
  trade: string;
  country: string;
  postcode?: string;
}

export function PriceDropAlertCard({ trade, country, postcode }: Props) {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<PriceDropAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cache hit?
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CachedDrops;
          const fresh = Date.now() - parsed.fetchedAt < CACHE_TTL_MS;
          const sameContext = parsed.trade === trade && parsed.country === country;
          if (fresh && sameContext) {
            if (!cancelled) {
              setAlerts(parsed.alerts);
              setLoading(false);
            }
            return;
          }
        }
      } catch {}

      try {
        const fresh = await checkPriceDrops(trade, country as Country, postcode || '1012');
        if (!cancelled) {
          setAlerts(fresh);
          setLoading(false);
        }
        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ alerts: fresh, fetchedAt: Date.now(), trade, country }),
        );
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [trade, country, postcode]);

  const top = useMemo(() => alerts.slice(0, TOP_N), [alerts]);

  // Hide while loading OR when there's nothing actionable. Empty inkoop
  // screen is preferable to a "loading shimmer that resolves to nothing".
  if (loading || top.length === 0) return null;

  const totalSavings = top.reduce(
    (s, a) => s + (a.previousPrice - a.currentPrice),
    0,
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="analytics-outline" size={16} color={DK.colors.highlight} />
        </View>
        <View style={{ flex: 1 }}>
          <DKLabel style={styles.title}>{t('inkoop.cohortGapTitle', 'Boven cohort-mediaan')}</DKLabel>
          <Text style={styles.sub}>
            {t('inkoop.cohortGapSub', '{{n}} materialen waar je boven de mediaan zit · €{{saved}} potentiële besparing per eenheid', {
              n: top.length,
              saved: totalSavings.toFixed(2),
            })}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {top.map((a, idx) => (
          <Pressable
            key={`${a.materialName}-${a.supplier.id}-${idx}`}
            style={styles.row}
            onPress={() => a.affiliateUrl && Linking.openURL(a.affiliateUrl).catch(() => {})}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName} numberOfLines={1}>{a.materialName}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {t('inkoop.cohortGapRow', 'Jij €{{user}} · {{cohort}} €{{median}}', {
                  user: a.previousPrice.toFixed(2),
                  cohort: a.supplier.name,
                  median: a.currentPrice.toFixed(2),
                })}
              </Text>
            </View>
            <View style={styles.dropChip}>
              <Text style={styles.dropChipText}>+{a.dropPercent}%</Text>
            </View>
          </Pressable>
        ))}
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
    fontSize: TYPE.bodySize,
    color: DK.colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  rowSub: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.textMuted,
    marginTop: 2,
  },
  dropChip: {
    backgroundColor: DK.colors.highlight + '20',
    paddingHorizontal: GRID.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  dropChipText: {
    fontSize: TYPE.captionSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: DK.colors.highlight,
  },
});
