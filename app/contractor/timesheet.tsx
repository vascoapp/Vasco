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
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
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
// MOCK DATA
// =============================================================================

const now = new Date();
const todayStr = now.toISOString().split('T')[0];

const dayMs = 86400000;
const mockEntries: SoloTimeEntry[] = [
  { id: 'te-1', date: todayStr, clockIn: '07:30', clockOut: '12:00', breakMinutes: 0, jobId: 'j-1', jobTitle: 'CV-ketel onderhoud — Fam. de Groot', totalHours: 4.5 },
  { id: 'te-2', date: todayStr, clockIn: '12:30', clockOut: '16:30', breakMinutes: 0, jobId: 'j-2', jobTitle: 'Warmtepomp installatie — Bakkerij Jansen', totalHours: 4.0 },
  { id: 'te-3', date: new Date(now.getTime() - dayMs).toISOString().split('T')[0], clockIn: '08:00', clockOut: '17:00', breakMinutes: 30, jobId: 'j-3', jobTitle: 'Airco service — Hotel Krasnapolsky', totalHours: 8.5 },
  { id: 'te-4', date: new Date(now.getTime() - dayMs * 2).toISOString().split('T')[0], clockIn: '07:00', clockOut: '15:30', breakMinutes: 30, jobTitle: 'CV-ketel onderhoud — Fam. Visser', totalHours: 8.0 },
  { id: 'te-5', date: new Date(now.getTime() - dayMs * 3).toISOString().split('T')[0], clockIn: '08:30', clockOut: '16:00', breakMinutes: 30, jobTitle: 'Leidingwerk — Kantoor Zuidas', totalHours: 7.0 },
];

// =============================================================================
// SCREEN
// =============================================================================

export default function TimesheetScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { jobs } = useAppState();
  const [activeTab, setActiveTab] = useState<TabType>('vandaag');
  const [entries, setEntries] = useState<SoloTimeEntry[]>(mockEntries);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockInJobTitle, setClockInJobTitle] = useState<string | null>(null);

  // Persist entries to AsyncStorage
  const TS_KEY = '@vasco_timesheet_entries';
  const TS_CLOCK_KEY = '@vasco_timesheet_clock';

  useEffect(() => {
    // Load persisted entries
    AsyncStorage.getItem(TS_KEY).then(saved => {
      if (saved) setEntries(JSON.parse(saved));
    }).catch(() => {});
    // Restore clock-in state
    AsyncStorage.getItem(TS_CLOCK_KEY).then(saved => {
      if (saved) {
        const data = JSON.parse(saved);
        setClockedIn(true);
        setClockInTime(data.time);
        setClockInJobTitle(data.jobTitle || null);
      }
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
      setClockedIn(true);
      setClockInTime(time);
      AsyncStorage.setItem(TS_CLOCK_KEY, JSON.stringify({ time })).catch(() => {});
      return;
    }

    Alert.alert(t('timesheet.chooseJob', 'Klus kiezen'), t('timesheet.whichJob', 'Voor welke klus ga je werken?'), [
      ...activeJobs.slice(0, 5).map(job => ({
        text: job.title,
        onPress: () => {
          setClockedIn(true);
          setClockInTime(time);
          setClockInJobTitle(job.title);
          AsyncStorage.setItem(TS_CLOCK_KEY, JSON.stringify({ time, jobTitle: job.title })).catch(() => {});
        },
      })),
      { text: t('timesheet.withoutJob', 'Zonder klus'), onPress: () => { setClockedIn(true); setClockInTime(time); AsyncStorage.setItem(TS_CLOCK_KEY, JSON.stringify({ time })).catch(() => {}); } },
      { text: t('common.cancel', 'Annuleren'), style: 'cancel' as const },
    ]);
  };

  const handleClockOut = () => {
    const outTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (clockInTime) {
      const [inH, inM] = clockInTime.split(':').map(Number);
      const [outH, outM] = outTime.split(':').map(Number);
      const hours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;

      const newEntry: SoloTimeEntry = {
        id: `te-${Date.now()}`,
        date: todayStr,
        clockIn: clockInTime,
        clockOut: outTime,
        breakMinutes: 0,
        jobTitle: clockInJobTitle ?? undefined,
        totalHours: Math.max(hours, 0),
      };
      setEntries(prev => [newEntry, ...prev]);
      // AI data collector — timesheet clock-out
      emitBusinessEvent('current-user', {
        eventType: 'clock_out',
        entityType: 'job',
        entityId: newEntry.jobId ?? newEntry.id,
        payload: { hours: newEntry.totalHours, jobTitle: newEntry.jobTitle, date: newEntry.date },
      }).catch(() => {});
      recordMetricSnapshot('capacityUtilization', Math.min(newEntry.totalHours / 8 * 100, 100)).catch(() => {});
    }
    setClockedIn(false);
    setClockInTime(null);
    setClockInJobTitle(null);
    AsyncStorage.removeItem(TS_CLOCK_KEY).catch(() => {});
  };

  const displayEntries = activeTab === 'vandaag' ? todayEntries
    : activeTab === 'week' ? weekEntries
    : monthEntries;

  const displayHours = activeTab === 'vandaag' ? todayHours
    : activeTab === 'week' ? weekHours
    : monthHours;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View>
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
            €{(displayHours * 55).toLocaleString('nl-NL')}
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
    gap: Spacing.sm,
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 30, fontFamily: 'Manrope_800ExtraBold', color: SemanticColors.textPrimary, letterSpacing: -1.0 },
  headerSubtitle: { fontSize: 15, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary, marginTop: 2 },
  clockSection: { paddingHorizontal: SafeArea.side, paddingBottom: Spacing.md },
  clockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 16,
    padding: Spacing.md,
    paddingVertical: 16,
  },
  clockButtonActive: { backgroundColor: SemanticColors.feedbackError },
  clockButtonTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Palette.white },
  clockButtonSub: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Palette.white + 'CC', marginTop: 2 },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: Spacing.sm },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center' },
  tabActive: { backgroundColor: Palette.hermesOrange },
  tabText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textTertiary },
  tabTextActive: { color: Palette.white },
  summaryBar: {
    flexDirection: 'row',
    marginHorizontal: SafeArea.side,
    backgroundColor: Palette.hermesOrange + '08',
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 26, fontFamily: 'Manrope_800ExtraBold', color: SemanticColors.textPrimary },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: SemanticColors.borderDefault, marginHorizontal: Spacing.xs },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary },
  entryCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 6,
  },
  entryAccent: { width: 3 },
  entryContent: { flex: 1, padding: Spacing.sm, gap: 4 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryTimeBlock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryTime: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  entryHours: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Palette.hermesOrange },
  entryJob: { fontSize: 15, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary },
  entryDate: { fontSize: 13, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary },
  payrollLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  payrollLinkText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Palette.hermesOrange,
  },
});
