// =============================================================================
// DRAG SCHEDULE — Gesture-based job scheduling board
// =============================================================================
// Long-press to pick up a job, drag to a time slot, drop to assign
// =============================================================================

import { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Dimensions, PanResponder } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess, hapticWarning } from '../../src/utils/haptics';
import { scheduleJobReminder } from '../../src/services/pushNotificationService';
import { useTranslation } from 'react-i18next';
import { shareAllScheduledJobs } from '../../src/services/calendarExportService';
import type { Job } from '../../src/domain/jobs';

type IconName = keyof typeof Ionicons.glyphMap;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 07:00 - 18:00
const SLOT_HEIGHT = 60;
const TIME_COL_WIDTH = 50;

interface ScheduledJob {
  jobId: string;
  title: string;
  customerName: string;
  startHour: number;
  duration: number; // in hours
  color: string;
}

const COLORS = [Palette.hermesOrange, '#3B82F6', '#10B981', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

export default function DragScheduleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { jobs, customers, updateJobStatus, updateJob } = useAppState();

  const todayStr = new Date().toISOString().split('T')[0];

  // Build schedule from REAL AppState jobs (already scheduled for today)
  const initialSchedule: ScheduledJob[] = jobs
    .filter((j: any) => j.scheduledDate === todayStr && (j.status === 'scheduled' || j.status === 'in-progress' || j.status === 'ingepland' || j.status === 'bezig'))
    .map((j: any, idx: number) => {
      const startHour = j.scheduledStartTime ? parseInt(j.scheduledStartTime.split(':')[0], 10) : 9;
      const cust = customers.find((c: any) => c.id === j.customerId);
      return {
        jobId: j.id,
        title: j.title,
        customerName: cust?.name || j.customerId || '',
        startHour: isNaN(startHour) ? 9 : startHour,
        duration: j.estimatedDuration || 2,
        color: COLORS[idx % COLORS.length],
      };
    });

  // Unassigned = jobs that need scheduling (lead, quoted, accepted, or scheduled without a date)
  const initialUnassigned = jobs
    .filter((j: any) =>
      ['lead', 'quoted', 'accepted', 'scheduled'].includes(j.status) &&
      j.scheduledDate !== todayStr // not already on today's schedule
    )
    .slice(0, 10)
    .map((j: any) => {
      const cust = customers.find((c: any) => c.id === j.customerId);
      return {
        jobId: j.id,
        title: j.title,
        customerName: cust?.name || j.customerId || '',
        estimatedHours: j.estimatedDuration || 2,
      };
    });

  const [schedule, setSchedule] = useState<ScheduledJob[]>(initialSchedule);
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [draggedJob, setDraggedJob] = useState<string | null>(null);
  const [dropTargetHour, setDropTargetHour] = useState<number | null>(null);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const totalScheduledHours = schedule.reduce((sum, j) => sum + j.duration, 0);
  const utilizationPct = Math.round((totalScheduledHours / 10) * 100); // 10h workday

  const handleDropOnSlot = (hour: number, job: { jobId: string; title: string; customerName: string; estimatedHours: number }) => {
    // Check for conflicts
    const hasConflict = schedule.some(s =>
      (hour >= s.startHour && hour < s.startHour + s.duration) ||
      (hour + job.estimatedHours > s.startHour && hour < s.startHour + s.duration)
    );

    if (hasConflict) {
      hapticWarning();
      Alert.alert(t('schedule.conflict', 'Conflict'), t('schedule.conflictDesc', 'Er is al een klus ingepland op dit tijdstip. Kies een ander tijdslot.'));
      return;
    }

    const color = COLORS[schedule.length % COLORS.length];
    setSchedule(prev => [...prev, {
      jobId: job.jobId,
      title: job.title,
      customerName: job.customerName,
      startHour: hour,
      duration: job.estimatedHours,
      color,
    }]);
    setUnassigned(prev => prev.filter(u => u.jobId !== job.jobId));
    hapticSuccess();
    setDraggedJob(null);
    setDropTargetHour(null);

    // PERSIST to AppState — update job with scheduled date/time and status
    try {
      updateJob(job.jobId, {
        scheduledDate: todayStr,
        scheduledStartTime: `${hour.toString().padStart(2, '0')}:00`,
        scheduledEndTime: `${(hour + job.estimatedHours).toString().padStart(2, '0')}:00`,
        estimatedDuration: job.estimatedHours,
      });
      updateJobStatus(job.jobId, 'scheduled');
    } catch {}

    // Fire-and-forget push notification reminder (1h before scheduled time)
    const today = new Date();
    const scheduledTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, 0, 0);
    scheduleJobReminder({ jobId: job.jobId, jobTitle: job.title, scheduledTime }).catch(() => {});
  };

  const handleExportCalendar = async () => {
    // Build minimal Job objects from scheduled items for the calendar export
    const scheduledJobs: Job[] = schedule.map(s => ({
      id: s.jobId,
      title: s.title,
      description: '',
      status: 'scheduled' as const,
      customerId: '',
      customerName: s.customerName,
      trade: 'general',
      createdAt: new Date().toISOString(),
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledStartTime: `${s.startHour.toString().padStart(2, '0')}:00`,
      scheduledEndTime: `${(s.startHour + s.duration).toString().padStart(2, '0')}:00`,
    } as any));
    try {
      await shareAllScheduledJobs(scheduledJobs);
      hapticSuccess();
    } catch {
      // Share cancelled
    }
  };

  const handleRemoveFromSchedule = (jobId: string) => {
    const job = schedule.find(s => s.jobId === jobId);
    if (!job) return;

    Alert.alert(t('schedule.removeJob', 'Klus verwijderen'), `"${job.title}" ${t('schedule.removeFromSchedule', 'uit planning verwijderen')}?`, [
      { text: t('schedule.cancel', 'Annuleren'), style: 'cancel' },
      {
        text: t('schedule.remove', 'Verwijderen'),
        style: 'destructive',
        onPress: () => {
          setSchedule(prev => prev.filter(s => s.jobId !== jobId));
          setUnassigned(prev => [...prev, {
            jobId: job.jobId,
            title: job.title,
            customerName: job.customerName,
            estimatedHours: job.duration,
          }]);
          hapticSuccess();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('schedule.daySchedule', 'Dagplanning')}</Text>
          <Text style={styles.headerSubtitle}>{today}</Text>
        </View>
        <Pressable
          onPress={async () => {
            // R254: optimize today's job order via the new scheduler. Uses
            // postcode-prefix proximity for distance + priority weighting.
            if (schedule.length < 2) {
              Alert.alert(t('schedule.optimizeNeedTwo', 'Need at least 2 jobs to optimize'));
              return;
            }
            try {
              const { optimizeSchedule } = await import('../../src/services/optimalSchedulerService');
              const startCountry = ((jobs as any[]).find((j) => j?.address?.country)?.address?.country ?? 'NL');
              const startPostcode = (jobs as any[]).find((j) => j?.address?.postcode)?.address?.postcode ?? '';
              const optimized = optimizeSchedule(
                schedule.map((s) => {
                  const j = (jobs as any[]).find((x) => x.id === s.jobId);
                  return {
                    id: s.jobId,
                    title: s.title,
                    postcode: j?.address?.postcode,
                    country: (j?.address?.country ?? startCountry),
                    estimatedHours: s.duration,
                    priority: j?.priority,
                  };
                }),
                {
                  date: todayStr,
                  startPostcode: startPostcode || ((jobs as any[])[0]?.address?.postcode ?? ''),
                  startCountry,
                },
              );
              const newSchedule = optimized.stops.map((stop, idx) => ({
                jobId: stop.job.id,
                title: stop.job.title ?? '',
                customerName: schedule.find((s) => s.jobId === stop.job.id)?.customerName ?? '',
                startHour: parseInt(stop.arrivalAt.split(':')[0], 10),
                duration: stop.job.estimatedHours,
                color: COLORS[idx % COLORS.length],
              }));
              // R255: capture before/after for the savings widget
              const driveKmBefore = (jobs as any[])
                .filter((j) => schedule.some((s) => s.jobId === j.id))
                .reduce((sum, _, idx) => sum + (idx > 0 ? 5 : 0), 0); // crude prior estimate
              const driveMinBefore = Math.round((driveKmBefore / 50) * 60);

              setSchedule(newSchedule);
              hapticSuccess();
              const summary = `${optimized.totalDriveKm}km · ${Math.round(optimized.totalDriveMin)}min driving`
                + (optimized.warnings.length ? `\n⚠ ${optimized.warnings.join('; ')}` : '');

              // R255: write optimized order back to AppState — persist scheduledStartTime per job
              for (const stop of optimized.stops) {
                try {
                  updateJob(stop.job.id, {
                    scheduledStartTime: stop.arrivalAt,
                    scheduledEndTime: stop.departureAt,
                  } as any);
                } catch {
                  // continue with remaining stops
                }
              }

              // R255: record the optimization event for weekly stats
              try {
                const { recordOptimization } = await import('../../src/services/optimizationStatsService');
                await recordOptimization({
                  date: todayStr,
                  jobCount: optimized.stops.length,
                  driveKmBefore,
                  driveMinBefore,
                  driveKmAfter: optimized.totalDriveKm,
                  driveMinAfter: optimized.totalDriveMin,
                  warnings: optimized.warnings.length,
                  applied: true,
                });
              } catch {
                // best-effort
              }

              Alert.alert(t('schedule.optimizedTitle', 'Route optimized'), summary + '\n\n' + t('schedule.optimizedApplied', 'Applied to today\'s schedule.'));
            } catch (e) {
              hapticWarning();
              Alert.alert(t('schedule.optimizeFailed', 'Optimization failed'), String((e as Error).message ?? e));
            }
          }}
          style={styles.exportButton}
          accessibilityRole="button"
          accessibilityLabel={t('schedule.optimize', 'Optimize order')}
        >
          <Ionicons name="flash-outline" size={18} color={Palette.hermesOrange} />
          <Text style={styles.exportButtonText}>{t('schedule.optimize', 'Optimize')}</Text>
        </Pressable>
        <Pressable onPress={handleExportCalendar} style={styles.exportButton} accessibilityRole="button" accessibilityLabel={t('schedule.export', 'Export to calendar')}>
          <Ionicons name="calendar-outline" size={18} color={Palette.hermesOrange} />
          <Text style={styles.exportButtonText}>{t('schedule.export', 'Exporteer')}</Text>
        </Pressable>
      </View>

      {/* Utilization bar */}
      <View style={styles.utilBar}>
        <View style={styles.utilInfo}>
          <Text style={styles.utilLabel}>{t('schedule.utilization', 'Bezetting')}</Text>
          <Text style={styles.utilValue}>{totalScheduledHours}u / 10u ({utilizationPct}%)</Text>
        </View>
        <View style={styles.utilTrack}>
          <View style={[styles.utilFill, { width: `${Math.min(utilizationPct, 100)}%` }]} />
        </View>
      </View>

      {/* Unassigned pool */}
      {unassigned.length > 0 && (
        <View style={styles.poolSection}>
          <Text style={styles.poolTitle}>{t('schedule.unscheduled', 'Niet ingepland')} ({unassigned.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.poolContent}>
            {unassigned.map(job => (
              <View key={job.jobId} style={styles.poolCard}>
                <Text style={styles.poolJobTitle} numberOfLines={1}>{job.title}</Text>
                <Text style={styles.poolJobCustomer} numberOfLines={1}>{job.customerName}</Text>
                <Text style={styles.poolJobHours}>{job.estimatedHours}u</Text>
                {/* Tap to pick time slot */}
                <Pressable
                  style={styles.poolAssignBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('schedule.schedule', 'Schedule')} ${job.title}`}
                  onPress={() => {
                    const slots = HOURS.filter(h => h + job.estimatedHours <= 19).slice(0, 5);
                    Alert.alert(t('schedule.chooseSlot', 'Tijdslot kiezen'), `${t('schedule.whenSchedule', 'Wanneer wil je')} "${job.title}" ${t('schedule.schedule', 'inplannen')}?`, [
                      ...slots.map(h => ({ text: `${h}:00`, onPress: () => handleDropOnSlot(h, job) })),
                      { text: t('schedule.cancel', 'Annuleren'), style: 'cancel' as const },
                    ]);
                  }}
                >
                  <Ionicons name="add-circle" size={14} color={Palette.hermesOrange} />
                  <Text style={styles.poolAssignText}>{t('schedule.schedule', 'Inplannen')}</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Timeline */}
      <ScrollView style={styles.timeline} showsVerticalScrollIndicator={false}>
        <View style={styles.timeGrid}>
          {HOURS.map(hour => (
            <View key={hour} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{hour}:00</Text>
              <View style={styles.hourSlot}>
                {/* Render scheduled jobs that start at this hour */}
                {schedule.filter(j => j.startHour === hour).map(job => (
                  <Pressable
                    key={job.jobId}
                    style={[styles.scheduledBlock, {
                      backgroundColor: job.color + '15',
                      borderLeftColor: job.color,
                      height: job.duration * SLOT_HEIGHT - 4,
                    }]}
                    onLongPress={() => handleRemoveFromSchedule(job.jobId)}
                    onPress={() => Alert.alert(job.title, `${job.customerName}\n${job.startHour}:00 – ${job.startHour + job.duration}:00\n${t('schedule.longPressToRemove', 'Houd ingedrukt om te verwijderen')}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${job.title}, ${job.customerName}, ${job.startHour}:00 to ${job.startHour + job.duration}:00`}
                    accessibilityHint="Tap for details, long press to remove"
                  >
                    <View style={styles.blockHeader}>
                      <Text style={[styles.blockTitle, { color: job.color }]} numberOfLines={1}>{job.title}</Text>
                      <Text style={styles.blockDuration}>{job.duration}u</Text>
                    </View>
                    <Text style={styles.blockCustomer} numberOfLines={1}>{job.customerName}</Text>
                    <View style={styles.blockTime}>
                      <Ionicons name="time-outline" size={12} color={SemanticColors.textTertiary} />
                      <Text style={styles.blockTimeText}>{job.startHour}:00 – {job.startHour + job.duration}:00</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.xs },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  exportButton: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: Palette.hermesOrange + '10', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  exportButtonText: { fontSize: 12, fontFamily: 'Archivo_700Bold', color: Palette.hermesOrange },

  utilBar: { marginHorizontal: SafeArea.side, marginBottom: Spacing.sm },
  utilInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  utilLabel: { fontSize: 12, fontFamily: 'Archivo_700Bold', color: SemanticColors.textSecondary },
  utilValue: { fontSize: 12, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  utilTrack: { height: 6, backgroundColor: SemanticColors.borderDefault, borderRadius: 3, overflow: 'hidden' },
  utilFill: { height: '100%', backgroundColor: Palette.hermesOrange, borderRadius: 3,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },

  poolSection: { marginBottom: Spacing.sm },
  poolTitle: { fontSize: 13, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textSecondary, letterSpacing: 0.5, paddingHorizontal: SafeArea.side, marginBottom: 6 },
  poolContent: { paddingHorizontal: SafeArea.side, gap: 8 },
  poolCard: { width: 150, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm, borderWidth: 1, borderColor: SemanticColors.borderDefault },
  poolJobTitle: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  poolJobCustomer: { fontSize: 11, color: SemanticColors.textSecondary, marginTop: 2 },
  poolJobHours: { fontSize: 12, fontFamily: 'Archivo_800ExtraBold', color: Palette.hermesOrange, marginTop: 4 },
  poolAssignBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, backgroundColor: Palette.hermesOrange + '10', borderRadius: 8, paddingVertical: 6 },
  poolAssignText: { fontSize: 12, fontFamily: 'Archivo_700Bold', color: Palette.hermesOrange },

  timeline: { flex: 1, paddingHorizontal: SafeArea.side },
  timeGrid: {},
  hourRow: { flexDirection: 'row', height: SLOT_HEIGHT, borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault },
  hourLabel: { width: TIME_COL_WIDTH, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textTertiary, paddingTop: 4 },
  hourSlot: { flex: 1, position: 'relative' },

  scheduledBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 2,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 8,
    zIndex: 1,
  },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockTitle: { fontSize: 13, fontFamily: 'Archivo_800ExtraBold', flex: 1 },
  blockDuration: { fontSize: 11, fontFamily: 'Archivo_700Bold', color: SemanticColors.textTertiary },
  blockCustomer: { fontSize: 11, color: SemanticColors.textSecondary, marginTop: 2 },
  blockTime: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  blockTimeText: { fontSize: 11, color: SemanticColors.textTertiary },
});
