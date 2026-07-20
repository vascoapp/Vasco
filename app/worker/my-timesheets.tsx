// =============================================================================
// MY TIMESHEETS — Worker weekly hours view with daily breakdown
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { localDateKey, todayKey } from '../../src/utils/dateKey';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimesheetDay {
  date: string;
  dayName: string;
  entries: { jobTitle: string; hours: number }[];
  totalHours: number;
}

interface TimesheetWeek {
  weekLabel: string;
  startDate: string;
  endDate: string;
  days: TimesheetDay[];
  totalHours: number;
  submitted: boolean;
}

// R17.4: removed unused TS_KEY constant. The screen reconstructs weekly
// timesheets from AppState job timeEntries on every render — there's no
// separate "@vasco_worker_timesheets" persistence path. Only SUBMITTED_KEY
// (which weeks the worker submitted to their boss) is actually persisted.
const SUBMITTED_KEY = '@vasco_worker_ts_submitted';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekDates(weekOffset: number = 0): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday-based
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function formatDate(d: Date): string {
  return localDateKey(d);
}

function getDayName(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MyTimesheetsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [submittedWeeks, setSubmittedWeeks] = useState<Set<string>>(new Set());

  // Load submitted state
  useEffect(() => {
    AsyncStorage.getItem(SUBMITTED_KEY).then(raw => {
      if (raw) setSubmittedWeeks(new Set(JSON.parse(raw)));
    }).catch(() => {});
  }, []);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // Build week data (demo seed data)
  const week: TimesheetWeek = useMemo(() => {
    const weekKey = formatDate(weekDates.start);
    const days: TimesheetDay[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekDates.start);
      d.setDate(weekDates.start.getDate() + i);
      const dateStr = formatDate(d);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isPast = d < new Date();

      // R34: was generating fake "Kitchen renovation / Bathroom plumbing /
      // Office repaint" entries with random hours for every past weekday.
      // Real timesheets flow from the AppState clock-in/clock-out path
      // (jobs[].timeEntries). Worker portal has no real consumers today
      // (R17.4 — no path sets user.role === 'worker'); empty entries here
      // is the honest representation until that ships.
      const entries: { jobTitle: string; hours: number }[] = [];
      void isPast; void isWeekend; void weekOffset;

      const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
      days.push({
        date: dateStr,
        dayName: getDayName(d),
        entries,
        totalHours: Math.round(totalHours * 10) / 10,
      });
    }

    const totalHours = Math.round(days.reduce((sum, d) => sum + d.totalHours, 0) * 10) / 10;

    return {
      weekLabel: `${weekDates.start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} - ${weekDates.end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
      startDate: formatDate(weekDates.start),
      endDate: formatDate(weekDates.end),
      days,
      totalHours,
      submitted: submittedWeeks.has(weekKey),
    };
  }, [weekDates, weekOffset, submittedWeeks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const handleSubmit = useCallback(() => {
    Alert.alert(
      t('worker.submitTimesheet', 'Submit Timesheet'),
      t('worker.submitTimesheetDesc', { defaultValue: 'Submit {{hours}}h for {{week}}?', hours: week.totalHours, week: week.weekLabel }),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('worker.submit', 'Submit'),
          onPress: async () => {
            hapticSuccess();
            const weekKey = formatDate(weekDates.start);
            const updated = new Set(submittedWeeks);
            updated.add(weekKey);
            setSubmittedWeeks(updated);
            await AsyncStorage.setItem(SUBMITTED_KEY, JSON.stringify([...updated])).catch(() => {});
            Alert.alert(
              t('worker.submitted', 'Submitted'),
              t('worker.submittedDesc', 'Your timesheet has been submitted for approval.')
            );
          },
        },
      ]
    );
  }, [week, weekDates, submittedWeeks, t]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('worker.timesheets', 'Timesheets')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Week navigator */}
      <View style={styles.weekNav}>
        <Pressable onPress={() => setWeekOffset(prev => prev - 1)} style={styles.weekNavBtn} accessibilityRole="button" accessibilityLabel="Previous week">
          <Ionicons name="chevron-back" size={20} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.weekNavCenter}>
          <Text style={styles.weekNavLabel}>{week.weekLabel}</Text>
          {weekOffset === 0 && (
            <View style={styles.currentWeekBadge}>
              <Text style={styles.currentWeekText}>{t('worker.thisWeek', 'This week')}</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => weekOffset < 0 && setWeekOffset(prev => prev + 1)}
          style={[styles.weekNavBtn, weekOffset >= 0 && { opacity: 0.3 }]}
          disabled={weekOffset >= 0}
          accessibilityRole="button"
          accessibilityLabel="Next week"
        >
          <Ionicons name="chevron-forward" size={20} color={SemanticColors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* Weekly total */}
        <FadeIn>
          <View style={styles.totalCard}>
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>{t('worker.weeklyTotal', 'Weekly Total')}</Text>
                <Text style={styles.totalValue}>{week.totalHours}h</Text>
              </View>
              {week.submitted ? (
                <View style={styles.submittedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={SemanticColors.feedbackSuccess} />
                  <Text style={styles.submittedText}>{t('worker.submitted', 'Submitted')}</Text>
                </View>
              ) : week.totalHours > 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleSubmit}
                  accessibilityRole="button"
                  accessibilityLabel={t('worker.submitForApproval', 'Submit for approval')}
                >
                  <Ionicons name="send" size={14} color="#fff" />
                  <Text style={styles.submitBtnText}>{t('worker.submitForApproval', 'Submit for approval')}</Text>
                </Pressable>
              ) : null}
            </View>
            {/* Progress bar */}
            <View style={styles.weekProgressContainer}>
              <View style={styles.weekProgressBg}>
                <View style={[styles.weekProgressFill, { width: `${Math.min(100, (week.totalHours / 40) * 100)}%` }]} />
              </View>
              <Text style={styles.weekProgressLabel}>
                {week.totalHours} / 40h
              </Text>
            </View>
          </View>
        </FadeIn>

        {/* Daily breakdown */}
        {week.days.map((day, idx) => {
          const isToday = day.date === todayKey();
          const hasEntries = day.entries.length > 0;
          return (
            <FadeIn key={day.date} delay={idx * 50}>
              <View style={[styles.dayCard, isToday && styles.dayCardToday]}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayHeaderLeft}>
                    <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{day.dayName}</Text>
                    <Text style={styles.dayDate}>
                      {new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={[
                    styles.dayTotal,
                    day.totalHours > 0 && { color: SemanticColors.textPrimary },
                  ]}>
                    {day.totalHours > 0 ? `${day.totalHours}h` : '-'}
                  </Text>
                </View>
                {hasEntries && (
                  <View style={styles.dayEntries}>
                    {day.entries.map((entry, eIdx) => (
                      <View key={eIdx} style={styles.entryRow}>
                        <View style={styles.entryDot} />
                        <Text style={styles.entryJob} numberOfLines={1}>{entry.jobTitle}</Text>
                        <Text style={styles.entryHours}>{entry.hours}h</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </FadeIn>
          );
        })}
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
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: GRID.md,
    paddingTop: GRID.sm,
    gap: GRID.sm,
  },

  // Week navigator
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavCenter: {
    alignItems: 'center',
    gap: GRID.xs,
  },
  weekNavLabel: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  currentWeekBadge: {
    paddingHorizontal: GRID.sm,
    paddingVertical: 2,
    borderRadius: GRID.xs,
    backgroundColor: Palette.hermesOrange + '14',
  },
  currentWeekText: {
    fontSize: 10,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },

  // Total card
  totalCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.md - 4,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  totalValue: {
    fontSize: 28,
    fontFamily: 'Archivo_900Black',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.8,
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingHorizontal: GRID.md - 4,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.feedbackSuccess + '14',
  },
  submittedText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackSuccess,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingHorizontal: GRID.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange,
  },
  submitBtnText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: '#fff',
  },
  weekProgressContainer: {
    gap: GRID.xs,
  },
  weekProgressBg: {
    height: 6,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 3,
    overflow: 'hidden',
  },
  weekProgressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
  },
  weekProgressLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'right',
  },

  // Day card
  dayCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm,
  },
  dayCardToday: {
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: GRID.sm,
  },
  dayName: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  dayNameToday: {
    color: Palette.hermesOrange,
  },
  dayDate: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  dayTotal: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textDisabled,
    fontVariant: ['tabular-nums'],
  },

  // Day entries
  dayEntries: {
    gap: GRID.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: GRID.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  entryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
  },
  entryJob: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  entryHours: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
