// =============================================================================
// OPTIMIZATION STATS WIDGET (R255) — Vandaag
// =============================================================================
// Shows "Vasco saved you Xkm · Ymin this week" when route-optimization
// has been applied at least once. Hidden when zero applied optimizations.
// =============================================================================

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { getWeeklyStats, type WeeklyOptimizationStats } from '../../services/optimizationStatsService';

export function OptimizationStatsWidget() {
  const { t } = useTranslation();
  const router = useRouter();
  const [stats, setStats] = useState<WeeklyOptimizationStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWeeklyStats().then((s) => { if (!cancelled) setStats(s); });
    return () => { cancelled = true; };
  }, []);

  if (!stats || stats.weekOptimizationCount === 0) return null;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push('/contractor/weekly-overview' as any)}
      hitSlop={6}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="flash" size={16} color={DK.colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {t('optStats.weekly', 'Vasco optimized {{count}} routes this week', { count: stats.weekOptimizationCount })}
        </Text>
        <Text style={styles.subtitle}>
          {t('optStats.savedKmMin', 'Saved {{km}}km · {{min}}min', { km: stats.weekKmSaved, min: stats.weekMinSaved })}
          {stats.totalLifetime > stats.weekOptimizationCount
            ? ` · ${t('optStats.lifetime', '{{count}} all-time', { count: stats.totalLifetime })}`
            : ''}
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
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    marginVertical: GRID.sm,
    borderWidth: 1,
    borderColor: DK.colors.accent + '33',
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: DK.colors.accent + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  subtitle: { fontSize: 12, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginTop: 2 },
});
