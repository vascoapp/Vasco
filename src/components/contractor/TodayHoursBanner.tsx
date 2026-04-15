// =============================================================================
// TODAY HOURS BANNER — quick read of today's logged + live time
// =============================================================================

import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppState } from '../../state/AppState';
import { useClockIn } from '../../services/clockInService';
import { todaySummary } from '../../services/dailyHoursService';
import { SemanticColors, Palette } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';

export function TodayHoursBanner() {
  const { jobs } = useAppState();
  const timer = useClockIn();
  const router = useRouter();

  const summary = useMemo(() => {
    const active = (timer as any).active && (timer as any).jobId && (timer as any).startTime
      ? { jobId: (timer as any).jobId, jobTitle: (timer as any).jobTitle ?? 'Current job', startTimeMs: (timer as any).startTime }
      : undefined;
    return todaySummary(jobs as any, active);
  }, [jobs, timer]);

  if (summary.totalHours === 0 && !summary.active) return null;

  const hoursText = `${summary.totalHours.toFixed(1)}h`;
  const liveLabel = summary.active ? ` · live on ${summary.active.jobTitle.slice(0, 22)}` : '';

  return (
    <Pressable
      onPress={() => router.push('/contractor/timesheet' as any)}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Today: ${hoursText} across ${summary.jobsTouched} jobs`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="time" size={16} color={Palette.hermesOrange} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.headline}>
          Today: <Text style={styles.hours}>{hoursText}</Text> · {summary.jobsTouched} job{summary.jobsTouched === 1 ? '' : 's'}
          {liveLabel}
        </Text>
        {summary.perJob.slice(0, 2).map((j) => (
          <Text key={j.jobId} style={styles.perJob} numberOfLines={1}>
            · {j.hours.toFixed(1)}h — {j.jobTitle}
          </Text>
        ))}
      </View>
      <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: Palette.white,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.hermesOrange + '14',
  },
  headline: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  hours: { fontFamily: TYPE.sectionFamily, color: Palette.hermesOrange },
  perJob: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, marginTop: 1 },
});
