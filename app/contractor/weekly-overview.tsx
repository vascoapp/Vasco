// =============================================================================
// WEEKLY OVERVIEW (R254) — 7-day schedule grid with per-day Optimize
// =============================================================================
// Surfaces a Monday-Sunday view of every scheduled job, with totals (jobs +
// hours) per day and an "Optimize" button per day that has 2+ jobs.
//
// Optimize uses optimalSchedulerService — EU postcode-aware distance, no
// external API. Result alerted with route summary; tap "Open day" to
// drag-edit applies the optimized order.
// =============================================================================

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../src/theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { DKLabel } from '../../src/components/shared/DKLabel';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { useAppState } from '../../src/state/AppState';

interface DayBucket {
  date: string;                  // YYYY-MM-DD
  weekday: string;
  dayNum: number;
  jobs: any[];
  totalHours: number;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;     // Monday-start (EU)
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

export default function WeeklyOverviewScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { jobs } = useAppState();

  const [weekOffset, setWeekOffset] = useState(0);

  const buckets = useMemo<DayBucket[]>(() => {
    const base = startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    const all: DayBucket[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayJobs = (jobs as any[]).filter((j) => j.scheduledDate === dateStr);
      const totalHours = dayJobs.reduce((s, j) => s + (Number(j.estimatedDuration) || 2), 0);
      all.push({
        date: dateStr,
        weekday: d.toLocaleDateString(i18n.language, { weekday: 'short' }),
        dayNum: d.getDate(),
        jobs: dayJobs,
        totalHours,
      });
    }
    return all;
  }, [jobs, weekOffset, i18n.language]);

  const weekLabel = useMemo(() => {
    const start = buckets[0]?.date;
    const end = buckets[6]?.date;
    if (!start || !end) return '';
    const s = new Date(start).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
    const e = new Date(end).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
    return `${s} – ${e}`;
  }, [buckets, i18n.language]);

  const handleOptimize = async (bucket: DayBucket) => {
    if (bucket.jobs.length < 2) {
      Alert.alert(t('schedule.optimizeNeedTwo', 'Need at least 2 jobs to optimize'));
      return;
    }
    try {
      const { optimizeSchedule } = await import('../../src/services/optimalSchedulerService');
      const allJobs = jobs as any[];
      const startCountry = (allJobs.find((j) => j?.address?.country)?.address?.country ?? 'NL') as any;
      const startPostcode = allJobs.find((j) => j?.address?.postcode)?.address?.postcode ?? '';
      const optimized = optimizeSchedule(
        bucket.jobs.map((j: any) => ({
          id: j.id,
          title: j.title,
          postcode: j?.address?.postcode,
          country: j?.address?.country ?? startCountry,
          estimatedHours: j.estimatedDuration ?? 2,
          priority: j?.priority,
        })),
        {
          date: bucket.date,
          startPostcode: startPostcode || (allJobs[0]?.address?.postcode ?? ''),
          startCountry,
        },
      );
      const lines = [
        `${optimized.totalDriveKm}km · ${Math.round(optimized.totalDriveMin)}min driving`,
        `Ends ${optimized.endsAt}`,
        '',
        ...optimized.stops.map((s, idx) => `${idx + 1}. ${s.arrivalAt} ${s.job.title}`),
      ];
      if (optimized.warnings.length > 0) lines.push('', '⚠ ' + optimized.warnings.join('; '));
      Alert.alert(t('schedule.optimizedTitle', 'Optimized route'), lines.join('\n'));
    } catch (e) {
      Alert.alert(t('schedule.optimizeFailed', 'Optimization failed'), String((e as Error).message ?? e));
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <DKScreenHeader title={t('weekly.title', 'WEEK OVERVIEW')} />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Week navigator */}
        <View style={styles.weekNav}>
          <Pressable onPress={() => setWeekOffset((w) => w - 1)} style={styles.navBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={DK.colors.text} />
          </Pressable>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
          <Pressable onPress={() => setWeekOffset((w) => w + 1)} style={styles.navBtn} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={DK.colors.text} />
          </Pressable>
          {weekOffset !== 0 && (
            <Pressable onPress={() => setWeekOffset(0)} style={styles.todayBtn} hitSlop={8}>
              <Text style={styles.todayBtnText}>{t('weekly.today', 'Today')}</Text>
            </Pressable>
          )}
        </View>

        {/* 7 day rows */}
        {buckets.map((b) => (
          <View key={b.date} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <View style={styles.dayDate}>
                <Text style={styles.dayWeekday}>{b.weekday.toUpperCase()}</Text>
                <Text style={styles.dayNum}>{b.dayNum}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayCount}>{b.jobs.length} {b.jobs.length === 1 ? t('weekly.job', 'job') : t('weekly.jobs', 'jobs')}</Text>
                <Text style={styles.dayHours}>{b.totalHours}h</Text>
              </View>
              {b.jobs.length >= 2 && (
                <Pressable style={styles.optimizeBtn} onPress={() => handleOptimize(b)}>
                  <Ionicons name="flash" size={12} color={DK.colors.accent} />
                  <Text style={styles.optimizeText}>{t('weekly.optimize', 'OPTIMIZE')}</Text>
                </Pressable>
              )}
            </View>

            {b.jobs.length === 0 ? (
              <Text style={styles.emptyDay}>{t('weekly.empty', '— no jobs scheduled —')}</Text>
            ) : (
              <View style={styles.jobList}>
                {b.jobs.slice(0, 4).map((j: any) => (
                  <Pressable
                    key={j.id}
                    style={styles.jobRow}
                    onPress={() => router.push(`/contractor/job/${j.id}` as any)}
                  >
                    <View style={[styles.jobDot, j.priority === 'urgent' || j.priority === 'high' ? styles.jobDotHi : null]} />
                    <Text style={styles.jobTitle} numberOfLines={1}>
                      {j.scheduledStartTime ?? '—'} · {j.title}
                    </Text>
                  </Pressable>
                ))}
                {b.jobs.length > 4 && (
                  <Text style={styles.moreLabel}>+{b.jobs.length - 4} more</Text>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  content: { padding: GRID.lg, paddingBottom: GRID.xl * 2, gap: GRID.sm },
  weekNav: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingVertical: GRID.sm,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DK.colors.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 14, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  todayBtn: {
    paddingHorizontal: GRID.md, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: DK.colors.accent + '22',
  },
  todayBtnText: { fontSize: 11, fontFamily: TYPE.titleFamily, color: DK.colors.accent, letterSpacing: 1 },
  dayCard: {
    backgroundColor: DK.colors.panel, borderRadius: RADIUS.lg,
    padding: GRID.md, gap: GRID.sm,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: GRID.md },
  dayDate: { alignItems: 'center', minWidth: 36 },
  dayWeekday: { fontSize: 10, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, letterSpacing: 1 },
  dayNum: { fontSize: 22, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  dayCount: { fontSize: 14, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  dayHours: { fontSize: 12, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, marginTop: 2 },
  optimizeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: GRID.sm, paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: DK.colors.bg, borderWidth: 1, borderColor: DK.colors.accent,
  },
  optimizeText: { fontSize: 10, fontFamily: TYPE.titleFamily, color: DK.colors.accent, letterSpacing: 1 },
  emptyDay: { fontSize: 12, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, textAlign: 'center', paddingVertical: GRID.xs },
  jobList: { gap: 6 },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  jobDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DK.colors.textMuted },
  jobDotHi: { backgroundColor: DK.colors.highlight },
  jobTitle: { flex: 1, fontSize: 13, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  moreLabel: { fontSize: 11, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, paddingLeft: 14 },
});
