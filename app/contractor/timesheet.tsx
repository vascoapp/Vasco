// =============================================================================
// TIMESHEET — Solo Contractor Hour Logging Screen
// =============================================================================
// Full-page clock in/out, daily entries, job-linked time tracking
// =============================================================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { formatDecimal1, formatDayMonthAuto } from '../../src/i18n/formatting';
import { formatCurrency0, type Country } from '../../src/i18n/formatting';
import { hapticSuccess } from '../../src/utils/haptics';
import { useClockIn } from '../../src/services/clockInService';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { emitBusinessEvent } from '../../src/intelligence/dataCollector';
import { recordMetricSnapshot } from '../../src/intelligence/learningStorage';
import { getCurrentUserId } from '../../src/lib/currentUser';
import { localDateKey } from '../../src/utils/dateKey';
import { DKMenu } from '../../src/components/shared/DKMenu';

// =============================================================================
// TYPES
// =============================================================================

interface SoloTimeEntry {
  id: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  breakMinutes: number;
  jobId?: string;
  jobTitle?: string;
  totalHours: number;
}

type TabType = 'vandaag' | 'week' | 'maand';

// =============================================================================
// CONSTANTS
// =============================================================================

// These were `const now = new Date()` at MODULE scope — frozen when the JS
// bundle loaded (app launch). handleClockOut then stamped every entry with the
// launch time instead of the real clock-out time: launch 09:00, clock out
// 18:00 recorded "clockOut: 09:00", producing rows like "10:00 – 09:00 · 4.0u"
// where the hours (from the timer service) were right but the range was not.
// Month/week boundaries drifted for the same reason if the app stayed open.
const hhmm = (d: Date) =>
  `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
const todayKey = (d: Date) => localDateKey(d);

// =============================================================================
// SCREEN
// =============================================================================

export default function TimesheetScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { jobs, updateJob, customers, businessProfile } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  const [activeTab, setActiveTab] = useState<TabType>('vandaag');
  const [entries, setEntries] = useState<SoloTimeEntry[]>([]);

  // Unified clock-in — shared with Vandaag tab and Job Detail
  const timer = useClockIn();
  const clockedIn = timer.active;
  const clockInTime = timer.startTimeFormatted;
  const clockInJobTitle = timer.jobTitle;
  const clockInJobId = timer.jobId;

  // Persist entries to AsyncStorage
  const TS_KEY = '@vasco_timesheet_entries';

  useEffect(() => {
    // Load persisted entries
    AsyncStorage.getItem(TS_KEY).then(saved => {
      if (saved) setEntries(JSON.parse(saved));
    }).catch(() => {});
  }, []);

  // Save entries when they change (skip initial mock load)
  const entriesRef = React.useRef(false);
  useEffect(() => {
    if (!entriesRef.current) { entriesRef.current = true; return; }
    AsyncStorage.setItem(TS_KEY, JSON.stringify(entries)).catch(() => {});
  }, [entries]);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600); }, []);

  const activeJobs = jobs.filter(j => ['scheduled', 'in-progress'].includes(j.status));

  // Evaluated per render rather than once at bundle load, so week/month
  // framing and "today" stay correct in a long-running session.
  const renderNow = new Date();
  const todayStr = todayKey(renderNow);

  // Computed
  const todayEntries = entries.filter(e => e.date === todayStr);
  // The hours unit was a hardcoded "u" (Dutch *uren*) in three places, so an
  // English or German contractor read "0.0u". werk.tsx already hit and fixed
  // this exact class — the comment there notes the same `${h}u` shape — but the
  // fix never reached this screen. `common.durationH` is the existing localised
  // unit: "{{h}}h" (en) · "{{h}}u" (nl) · "{{h}} Std." (de).
  const hoursLabel = (h: number) =>
    // toFixed(1) always emits a POINT, so the unit was localised ("u") while
    // the number was not: "0.0u" on a Dutch screen.
    t('common.durationH', { defaultValue: '{{h}}h', h: formatDecimal1(h, country) });

  const todayHours = todayEntries.reduce((sum, e) => sum + e.totalHours, 0);

  const weekStart = new Date(renderNow);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEntries = entries.filter(e => new Date(e.date) >= weekStart);
  const weekHours = weekEntries.reduce((sum, e) => sum + e.totalHours, 0);

  const monthStart = new Date(renderNow.getFullYear(), renderNow.getMonth(), 1);
  const monthEntries = entries.filter(e => new Date(e.date) >= monthStart);
  const monthHours = monthEntries.reduce((sum, e) => sum + e.totalHours, 0);

  // Was an `Alert.alert` carrying up to SEVEN buttons — five jobs, "without
  // job", "cancel". Android's Alert supports at most THREE and silently drops
  // the rest, so an Android contractor with three or more active jobs could not
  // reach most of them, nor necessarily "cancel". The `.slice(0, 5)` truncated
  // on iOS too, with nothing on screen saying so. This is the same Alert-as-menu
  // shape already fixed in drag-schedule; DKMenu is the sanctioned one-of-N
  // picker (CLAUDE.md) — a JS popover that scrolls, shows every option, and
  // renders identically on Android.
  const clockInToJob = async (job: { id: string; title: string }) => {
    await timer.clockIn(job.id, job.title);
    // R25: queue on_my_way customer-facing notice (closes R3 deferral).
    const fullJob: any = jobs.find((j: any) => j.id === job.id);
    if (fullJob?.customerId) {
      const cust = customers.find((c: any) => c.id === fullJob.customerId);
      const { queueOnMyWay } = await import('../../src/services/aiActionQueueService');
      queueOnMyWay({
        jobId: job.id,
        jobTitle: job.title,
        customerId: fullJob.customerId,
        customerName: cust?.name,
        customerPhone: cust?.phone,
      }).catch(() => {});
    }
  };

  const handleClockOut = async () => {
    const outTime = hhmm(new Date()); // stamped NOW, not at bundle load
    const { hours, state: prevState } = await timer.clockOut();

    if (prevState.startTimeFormatted) {
      const newEntry: SoloTimeEntry = {
        id: `te-${Date.now()}`,
        date: todayStr,
        clockIn: prevState.startTimeFormatted,
        clockOut: outTime,
        breakMinutes: 0,
        jobId: prevState.jobId ?? undefined,
        jobTitle: prevState.jobTitle ?? undefined,
        totalHours: Math.max(hours, 0),
      };
      setEntries(prev => [newEntry, ...prev]);

      // PERSIST to job.timeEntries — links hours to the actual job object
      if (prevState.jobId) {
        const job = jobs.find((j: any) => j.id === prevState.jobId);
        if (job) {
          const existingEntries = job.timeEntries ?? [];
          // No workerId: this screen is the contractor clocking their OWN
          // time. Undefined reads as "me" in the payroll grouping, which is
          // what a solo install and an aannemer's own hours both need.
          const nextEntries = [...existingEntries, {
            id: newEntry.id,
            date: todayStr,
            hours: newEntry.totalHours,
            clockIn: prevState.startTimeFormatted,
            clockOut: outTime,
          }];
          updateJob(prevState.jobId, {
            timeEntries: nextEntries,
            actualHours: Math.round(nextEntries.reduce((s, e) => s + (e.hours ?? 0), 0) * 100) / 100,
          });
        }
      }

      // R47: was passing literal 'current-user' string — clock-out events
      // landed against the placeholder id instead of the real contractor.
      // Now uses getCurrentUserId() from the canonical user ref.
      emitBusinessEvent(getCurrentUserId(), {
        eventType: 'clock_out',
        entityType: 'job',
        entityId: prevState.jobId ?? newEntry.id,
        payload: { hours: newEntry.totalHours, jobTitle: newEntry.jobTitle, date: newEntry.date },
      }).catch(() => {});
      recordMetricSnapshot('capacityUtilization', Math.min(newEntry.totalHours / 8 * 100, 100)).catch(() => {});
    }
  };

  const displayEntries = activeTab === 'vandaag' ? todayEntries
    : activeTab === 'week' ? weekEntries
    : monthEntries;

  const displayHours = activeTab === 'vandaag' ? todayHours
    : activeTab === 'week' ? weekHours
    : monthHours;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return formatDayMonthAuto(d);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('timesheet.title', 'Urenregistratie')}</Text>
          <Text style={styles.headerSubtitle}>
            {hoursLabel(todayHours)} {t('timesheet.today', 'vandaag')} · {hoursLabel(weekHours)} {t('timesheet.thisWeek', 'deze week')}
          </Text>
        </View>
      </View>

      {/* Clock In/Out */}
      <FadeIn delay={0} duration={400}>
      <View style={styles.clockSection}>
        {(() => {
          const button = (onPress: () => void) => (
            <Pressable
              style={[styles.clockButton, clockedIn && styles.clockButtonActive]}
              onPress={onPress}
            >
              <Ionicons name={clockedIn ? 'stop-circle' : 'play-circle'} size={28} color={Palette.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.clockButtonTitle}>
                  {clockedIn ? t('timesheet.clockOut', 'Uitklokken') : t('timesheet.clockIn', 'Inklokken')}
                </Text>
                {clockedIn && clockInTime && (
                  <Text style={styles.clockButtonSub}>
                    {t('timesheet.startedAt', 'Gestart om')} {clockInTime}{clockInJobTitle ? ` · ${clockInJobTitle}` : ''}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={Palette.white} />
            </Pressable>
          );
          // Clocked in, or nothing to attribute to → the button just acts.
          if (clockedIn) return button(handleClockOut);
          if (activeJobs.length === 0) return button(() => { timer.clockIn(); });
          return (
            <DKMenu
              accessibilityLabel={t('timesheet.chooseJob', 'Choose job')}
              items={[
                ...activeJobs.map((job) => ({
                  key: job.id,
                  label: job.title,
                  onPress: () => { clockInToJob(job); },
                })),
                {
                  key: '__none__',
                  label: t('timesheet.withoutJob', 'Without job'),
                  emphasis: true,
                  onPress: () => { timer.clockIn(); },
                },
              ]}
              renderAnchor={(open) => button(open)}
            />
          );
        })()}
      </View>
      </FadeIn>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['vandaag', 'week', 'maand'] as TabType[]).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'vandaag' ? t('common.today', 'Today') : tab === 'week' ? t('timesheet.week', 'Week') : t('timesheet.month', 'Maand')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{hoursLabel(displayHours)}</Text>
          <Text style={styles.summaryLabel}>{t('timesheet.total', 'Totaal')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{displayEntries.length}</Text>
          <Text style={styles.summaryLabel}>{t('timesheet.entries', 'Registraties')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {formatCurrency0(displayHours * 55, country)}
          </Text>
          <Text style={styles.summaryLabel}>{t('timesheet.value', 'Waarde')}</Text>
        </View>
      </View>

      {/* Entries */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}>
        {displayEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={40} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyText}>{t('timesheet.noEntries', 'Geen registraties')}</Text>
          </View>
        ) : (
          displayEntries.map(entry => (
            <View key={entry.id} style={styles.entryCard}>
              <View style={[styles.entryAccent, { backgroundColor: entry.jobTitle ? Palette.hermesOrange : SemanticColors.textTertiary }]} />
              <View style={styles.entryContent}>
                <View style={styles.entryHeader}>
                  <View style={styles.entryTimeBlock}>
                    <Ionicons name="time-outline" size={16} color={SemanticColors.textSecondary} />
                    <Text style={styles.entryTime}>{entry.clockIn} – {entry.clockOut || '...'}</Text>
                  </View>
                  <Text style={styles.entryHours}>{hoursLabel(entry.totalHours)}</Text>
                </View>
                {entry.jobTitle && (
                  <Text style={styles.entryJob} numberOfLines={1}>{entry.jobTitle}</Text>
                )}
                {activeTab !== 'vandaag' && (
                  <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                )}
              </View>
            </View>
          ))
        )}
        {/* Payroll export link — aannemer / has-a-team only. A solo contractor
            has no payroll, and the screen behind this is backed by demo-only
            fixtures. Same R109 gate used elsewhere. */}
        {(user?.isAannemer || (businessProfile?.teamSize && businessProfile.teamSize !== 'solo')) ? (
        <Pressable
          style={styles.payrollLink}
          onPress={() => router.push('/contractor/payroll' as any)}
        >
          <Text style={styles.payrollLinkText}>{t('timesheet.exportPayroll', 'Exporteer voor verloning')}</Text>
          <Ionicons name="arrow-forward" size={16} color={Palette.hermesOrange} />
        </Pressable>
        ) : null}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
  },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, marginLeft: GRID.sm },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary,  textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  clockSection: { paddingHorizontal: SafeArea.side, paddingBottom: Spacing.md },
  clockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: RADIUS.lg,
    padding: Spacing.md,
    paddingVertical: GRID.md,
  },
  clockButtonActive: { backgroundColor: SemanticColors.feedbackError },
  clockButtonTitle: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_800ExtraBold', color: Palette.white },
  clockButtonSub: { fontSize: TYPE.captionSize + 1, fontFamily: 'Inter_500Medium', color: Palette.white + 'CC', marginTop: 2 },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: Spacing.sm },
  tab: { flex: 1, paddingVertical: GRID.sm, borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center' },
  tabActive: { backgroundColor: Palette.hermesOrange },
  tabText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textTertiary },
  tabTextActive: { color: Palette.white },
  summaryBar: {
    flexDirection: 'row',
    marginHorizontal: SafeArea.side,
    backgroundColor: Palette.hermesOrange + '08',
    borderRadius: RADIUS.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: TYPE.displaySize - 2, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary },
  summaryLabel: { fontSize: TYPE.captionSize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: SemanticColors.borderDefault, marginHorizontal: Spacing.xs },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: TYPE.bodySize, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary },
  entryCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: GRID.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  entryAccent: { width: 3 },
  entryContent: { flex: 1, padding: Spacing.sm, gap: 4 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryTimeBlock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryTime: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  entryHours: { fontSize: TYPE.bodySize, fontFamily: 'Inter_700Bold', color: Palette.hermesOrange },
  entryJob: { fontSize: TYPE.bodySize, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary },
  entryDate: { fontSize: TYPE.captionSize, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary },
  payrollLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  payrollLinkText: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: 'Inter_500Medium',
    color: Palette.hermesOrange,
  },
});
