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
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { useClockIn } from '../../src/services/clockInService';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { emitBusinessEvent } from '../../src/intelligence/dataCollector';
import { recordMetricSnapshot } from '../../src/intelligence/learningStorage';

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

const now = new Date();
const todayStr = now.toISOString().split('T')[0];

// =============================================================================
// SCREEN
// =============================================================================

export default function TimesheetScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { jobs, updateJob } = useAppState();
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

  // Computed
  const todayEntries = entries.filter(e => e.date === todayStr);
  const todayHours = todayEntries.reduce((sum, e) => sum + e.totalHours, 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEntries = entries.filter(e => new Date(e.date) >= weekStart);
  const weekHours = weekEntries.reduce((sum, e) => sum + e.totalHours, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEntries = entries.filter(e => new Date(e.date) >= monthStart);
  const monthHours = monthEntries.reduce((sum, e) => sum + e.totalHours, 0);

  const handleClockIn = () => {
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (activeJobs.length === 0) {
      timer.clockIn();
      return;
    }

    Alert.alert(t('timesheet.chooseJob', 'Klus kiezen'), t('timesheet.whichJob', 'Voor welke klus ga je werken?'), [
      ...activeJobs.slice(0, 5).map(job => ({
        text: job.title,
        onPress: () => { timer.clockIn(job.id, job.title); },
      })),
      { text: t('timesheet.withoutJob', 'Zonder klus'), onPress: () => { timer.clockIn(); } },
      { text: t('common.cancel', 'Annuleren'), style: 'cancel' as const },
    ]);
  };

  const handleClockOut = async () => {
    const outTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
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
          const existingEntries = (job as any).timeEntries ?? [];
          updateJob(prevState.jobId, {
            timeEntries: [...existingEntries, {
              id: newEntry.id,
              date: todayStr,
              hours: newEntry.totalHours,
              clockIn: prevState.startTimeFormatted,
              clockOut: outTime,
            }] as any,
          });
        }
      }

      // AI data collector — timesheet clock-out
      emitBusinessEvent('current-user', {
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
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="arrow-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('timesheet.title', 'Urenregistratie')}</Text>
          <Text style={styles.headerSubtitle}>
            {todayHours.toFixed(1)}u {t('timesheet.today', 'vandaag')} · {weekHours.toFixed(1)}u {t('timesheet.thisWeek', 'deze week')}
          </Text>
        </View>
      </View>

      {/* Clock In/Out */}
      <FadeIn delay={0} duration={400}>
      <View style={styles.clockSection}>
        <Pressable
          style={[styles.clockButton, clockedIn && styles.clockButtonActive]}
          onPress={clockedIn ? handleClockOut : handleClockIn}
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
              {tab === 'vandaag' ? t('timesheet.today', 'Vandaag') : tab === 'week' ? t('timesheet.week', 'Week') : t('timesheet.month', 'Maand')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{displayHours.toFixed(1)}u</Text>
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
            €{(displayHours * 55).toLocaleString()}
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
                  <Text style={styles.entryHours}>{entry.totalHours.toFixed(1)}u</Text>
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
        {/* Payroll export link */}
        <Pressable
          style={styles.payrollLink}
          onPress={() => router.push('/contractor/payroll' as any)}
        >
          <Text style={styles.payrollLinkText}>{t('timesheet.exportPayroll', 'Exporteer voor verloning')}</Text>
          <Ionicons name="arrow-forward" size={16} color={Palette.hermesOrange} />
        </Pressable>
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
