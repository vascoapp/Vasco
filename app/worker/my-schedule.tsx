// =============================================================================
// MY SCHEDULE — Worker's daily assigned jobs with clock in/out
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { useClockIn } from '../../src/services/clockInService';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { useAppState } from '../../src/state/AppState';

type IconName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkerJob {
  id: string;
  title: string;
  customer: string;
  address: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'active' | 'completed';
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MyScheduleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const timer = useClockIn();
  const { jobs, customers } = useAppState();

  const todayStr = new Date().toISOString().split('T')[0];

  // Build today's assigned jobs from AppState
  const todayJobs: WorkerJob[] = useMemo(() => {
    return jobs
      .filter((j: any) => {
        const jobDate = j.scheduledDate || '';
        return jobDate === todayStr && j.status !== 'cancelled';
      })
      .map((j: any) => {
        const cust = customers.find((c: any) => c.id === j.customerId);
        const status: WorkerJob['status'] =
          j.status === 'completed' ? 'completed' :
          j.status === 'in-progress' ? 'active' : 'upcoming';
        return {
          id: j.id,
          title: j.title,
          customer: cust?.name || '',
          address: j.address?.street || j.address || '',
          startTime: j.scheduledStartTime || '09:00',
          endTime: j.scheduledEndTime || '17:00',
          status,
        };
      })
      .sort((a: WorkerJob, b: WorkerJob) => a.startTime.localeCompare(b.startTime));
  }, [jobs, customers, todayStr]);

  // Calculate hours worked today
  const hoursToday = useMemo(() => {
    if (!timer.active || !timer.startTime) return 0;
    return Math.round(((Date.now() - timer.startTime) / (1000 * 60 * 60)) * 10) / 10;
  }, [timer.active, timer.startTime, timer.timerDisplay]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      hapticSuccess();
    }, 600);
  }, []);

  const handleClockIn = useCallback(async (job: WorkerJob) => {
    hapticSuccess();
    if (timer.active && timer.jobId === job.id) {
      // Clock out
      const { hours } = await timer.clockOut();
      Alert.alert(
        t('worker.clockedOut', 'Clocked Out'),
        t('worker.clockedOutDesc', { defaultValue: 'Logged {{hours}}h on "{{title}}"', hours: hours.toFixed(1), title: job.title })
      );
    } else if (timer.active) {
      Alert.alert(
        t('worker.alreadyClockedIn', 'Already Clocked In'),
        t('worker.alreadyClockedInDesc', 'You are already clocked in on another job. Clock out first.')
      );
    } else {
      await timer.clockIn(job.id, job.title);
      Alert.alert(
        t('worker.clockedIn', 'Clocked In'),
        t('worker.clockedInDesc', { defaultValue: 'Started work on "{{title}}"', title: job.title })
      );
    }
  }, [timer, t]);

  const getStatusIcon = (status: WorkerJob['status']): IconName => {
    switch (status) {
      case 'active': return 'play-circle';
      case 'completed': return 'checkmark-circle';
      default: return 'time-outline';
    }
  };

  const getStatusColor = (status: WorkerJob['status']) => {
    switch (status) {
      case 'active': return Palette.hermesOrange;
      case 'completed': return SemanticColors.feedbackSuccess;
      default: return SemanticColors.textTertiary;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('worker.mySchedule', 'My Schedule')}</Text>
        <Pressable
          onPress={() => router.push('/worker/my-timesheets' as any)}
          style={styles.headerRight}
          accessibilityRole="button"
          accessibilityLabel={t('worker.timesheets', 'Timesheets')}
        >
          <Ionicons name="timer-outline" size={22} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* Today summary */}
        <FadeIn>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{todayJobs.length}</Text>
                <Text style={styles.summaryLabel}>{t('worker.jobs', 'Jobs')}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, timer.active && { color: Palette.hermesOrange }]}>
                  {timer.active ? timer.timerDisplay : `${hoursToday}h`}
                </Text>
                <Text style={styles.summaryLabel}>{t('worker.hoursToday', 'Hours today')}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {todayJobs.filter(j => j.status === 'completed').length}
                </Text>
                <Text style={styles.summaryLabel}>{t('worker.done', 'Done')}</Text>
              </View>
            </View>
          </View>
        </FadeIn>

        {/* Date header */}
        <View style={styles.dateHeader}>
          <Ionicons name="calendar-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.dateHeaderText}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>

        {/* Job cards */}
        {todayJobs.length === 0 ? (
          <FadeIn delay={100}>
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={SemanticColors.textDisabled} />
              <Text style={styles.emptyTitle}>{t('worker.noJobs', 'No jobs today')}</Text>
              <Text style={styles.emptyDesc}>{t('worker.noJobsDesc', 'No jobs are scheduled for today')}</Text>
            </View>
          </FadeIn>
        ) : (
          todayJobs.map((job, idx) => {
            const isClockedIn = timer.active && timer.jobId === job.id;
            return (
              <FadeIn key={job.id} delay={100 + idx * 60}>
                <View style={[styles.jobCard, isClockedIn && styles.jobCardActive]}>
                  {/* Time accent */}
                  <View style={[styles.jobAccent, { backgroundColor: getStatusColor(job.status) }]} />

                  <View style={styles.jobCardContent}>
                    {/* Status + time row */}
                    <View style={styles.jobHeaderRow}>
                      <View style={styles.jobTimeRow}>
                        <Ionicons name={getStatusIcon(job.status)} size={14} color={getStatusColor(job.status)} />
                        <Text style={[styles.jobTime, { color: getStatusColor(job.status) }]}>
                          {job.startTime} - {job.endTime}
                        </Text>
                      </View>
                      {isClockedIn && (
                        <View style={styles.activeTimerBadge}>
                          <View style={styles.activeTimerDot} />
                          <Text style={styles.activeTimerText}>{timer.timerDisplay}</Text>
                        </View>
                      )}
                    </View>

                    {/* Job info */}
                    <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                    <Text style={styles.jobCustomer} numberOfLines={1}>{job.customer}</Text>
                    <View style={styles.jobAddressRow}>
                      <Ionicons name="location-outline" size={12} color={SemanticColors.textDisabled} />
                      <Text style={styles.jobAddress} numberOfLines={1}>{job.address}</Text>
                    </View>

                    {/* Clock in/out button */}
                    {job.status !== 'completed' && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.clockBtn,
                          isClockedIn && styles.clockBtnOut,
                          pressed && { opacity: 0.85 },
                        ]}
                        onPress={() => handleClockIn(job)}
                        accessibilityRole="button"
                        accessibilityLabel={isClockedIn ? t('worker.clockOut', 'Clock out') : t('worker.clockIn', 'Clock in')}
                      >
                        <Ionicons name={isClockedIn ? 'stop' : 'play'} size={16} color="#fff" />
                        <Text style={styles.clockBtnText}>
                          {isClockedIn ? t('worker.clockOut', 'Clock Out') : t('worker.clockIn', 'Clock In')}
                        </Text>
                      </Pressable>
                    )}

                    {job.status === 'completed' && (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-done" size={14} color={SemanticColors.feedbackSuccess} />
                        <Text style={styles.completedText}>{t('worker.completed', 'Completed')}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </FadeIn>
            );
          })
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: GRID.md,
    paddingTop: SafeArea.top,
    paddingBottom: GRID.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
     textTransform: 'uppercase', letterSpacing: 1.2 },
  headerRight: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.hermesOrange + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: GRID.md,
    paddingTop: GRID.sm,
    gap: GRID.sm,
  },

  // Summary card
  summaryCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    marginTop: GRID.xs,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: SemanticColors.borderDefault,
  },

  // Date header
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.xs,
  },
  dateHeaderText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textTertiary,
    letterSpacing: 0.3,
  },

  // Job card
  jobCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  jobCardActive: {
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '30',
  },
  jobAccent: {
    width: 4,
  },
  jobCardContent: {
    flex: 1,
    padding: GRID.md,
    gap: GRID.xs,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobTime: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  activeTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    backgroundColor: Palette.hermesOrange + '14',
    paddingHorizontal: GRID.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  activeTimerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
  },
  activeTimerText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
    fontVariant: ['tabular-nums'],
  },
  jobTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  jobCustomer: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },
  jobAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
  },
  jobAddress: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textDisabled,
    flex: 1,
  },

  // Clock button
  clockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange,
    marginTop: GRID.sm,
  },
  clockBtnOut: {
    backgroundColor: SemanticColors.feedbackError,
  },
  clockBtnText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: '#fff',
  },

  // Completed badge
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs,
    paddingVertical: 8,
    backgroundColor: SemanticColors.feedbackSuccess + '14',
    borderRadius: RADIUS.md,
    marginTop: GRID.sm,
  },
  completedText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackSuccess,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: GRID.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    gap: GRID.sm,
  },
  emptyTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  emptyDesc: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
});
