// =============================================================================
// WERK — Jobs Hub (Airbnb-style vertical layout)
// =============================================================================
// Clean vertical structure: Header → Action strip → Today's schedule → Jobs list
// =============================================================================

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { SafeArea } from '../../src/theme/spacing';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { useAppState } from '../../src/state/AppState';
import { useDaySchedule } from '../../src/services/smartSchedulerService';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { SkeletonList } from '../../src/components/shared/SkeletonList';
import { useAuth } from '../../src/context/AuthContext';

type IconName = keyof typeof Ionicons.glyphMap;

/** Parse a time value that may be an ISO string, HH:MM, or invalid. Returns null on failure. */
function parseTime(value: string | undefined | null): Date | null {
  if (!value) return null;
  // Try ISO / full date string first
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d;
  // Try HH:MM or HH:MM:SS
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const today = new Date();
    today.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
    return today;
  }
  return null;
}

export default function WerkScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { jobs, addJob, removeJob, customers, projects, isLoading } = useAppState();
  const [showNewJob, setShowNewJob] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
  const today = new Date().toISOString().split('T')[0];
  const todaySchedule = useDaySchedule(today);

  useEffect(() => { recordScreenVisit('werk'); }, []);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const handleCreateJob = async () => {
    if (!newJobTitle.trim()) return;
    await addJob(newJobTitle.trim());
    hapticSuccess();
    setNewJobTitle('');
    setShowNewJob(false);
  };

  const suggestions = useMemo(() => {
    if (newJobTitle.length < 3) return [];
    const q = newJobTitle.toLowerCase();
    const seen = new Set<string>();
    return jobs
      .filter((j: any) => j.title?.toLowerCase().includes(q))
      .slice(0, 3)
      .map((j: any) => j.title || '')
      .filter((t: string) => { if (!t || seen.has(t.toLowerCase())) return false; seen.add(t.toLowerCase()); return true; });
  }, [newJobTitle, jobs]);

  const handleDeleteJob = useCallback((jobId: string, jobTitle: string) => {
    Alert.alert(
      t('jobs.deleteJob', 'Delete job?'),
      jobTitle,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('common.delete', 'Delete'), style: 'destructive', onPress: () => { removeJob(jobId); hapticSuccess(); } },
      ],
    );
  }, [removeJob, t]);

  const activeJobs = jobs.filter((j: any) => ['scheduled', 'in-progress', 'ingepland', 'bezig'].includes(j.status));
  const completedJobs = jobs.filter((j: any) => ['completed', 'invoiced', 'paid', 'gereed', 'gefactureerd', 'betaald'].includes(j.status));
  const leadJobs = jobs.filter((j: any) => ['lead', 'quoted', 'accepted'].includes(j.status));
  const todayJobs = todaySchedule.jobs;

  // KPI counts
  const activeCount = activeJobs.length;
  const scheduledToday = jobs.filter((j: any) => j.scheduledDate === today || j.date === today).length;
  const leadCount = leadJobs.length;

  if (isLoading) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('tabs.jobs', 'Werk')}</Text>
        </View>
        <SkeletonList count={4} lines={2} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('tabs.jobs', 'Werk')}</Text>
        <Pressable style={s.searchBtn} onPress={() => router.push('/contractor/search' as any)} accessibilityRole="button" accessibilityLabel={t('a11y.search', 'Search')}>
          <Ionicons name="search" size={20} color={SemanticColors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* KPI strip */}
        <View style={s.kpiStrip}>
          <View style={s.kpi}><Text style={s.kpiValue}>{activeCount}</Text><Text style={s.kpiLabel}>{t('dashboard.active', 'Active')}</Text></View>
          <View style={s.kpiDivider} />
          <View style={s.kpi}><Text style={s.kpiValue}>{scheduledToday}</Text><Text style={s.kpiLabel}>{t('dashboard.today', 'Today')}</Text></View>
          <View style={s.kpiDivider} />
          <View style={s.kpi}><Text style={s.kpiValue}>{leadCount}</Text><Text style={s.kpiLabel}>{t('dashboard.leads', 'Leads')}</Text></View>
        </View>

        {/* Action strip — horizontal scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actionStrip}>
          {([
            { icon: 'calendar-outline' as IconName, label: t('jobs.calendar', 'Kalender'), route: '/contractor/drag-schedule' },
            { icon: 'time-outline' as IconName, label: t('jobs.hours', 'Uren'), route: '/contractor/timesheet' },
            ...(user?.isAannemer ? [{ icon: 'folder-open-outline' as IconName, label: t('jobs.projects', 'Projecten'), route: '/contractor/projects' }] : []),
            { icon: 'people-outline' as IconName, label: t('jobs.customers', 'Klanten'), route: '/(contractor)/bedrijf' },
          ]).map(btn => (
            <Pressable
              key={btn.route}
              style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(btn.route as any)}
              accessibilityRole="button"
              accessibilityLabel={btn.label}
            >
              <Ionicons name={btn.icon} size={20} color={Palette.hermesOrange} />
              <Text style={s.actionBtnText}>{btn.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Active Projects (aannemer only) */}
        {user?.isAannemer && projects.length > 0 && (
          <FadeIn delay={0}>
            <Text style={s.sectionTitle}>{t('jobs.projects', 'Projecten')}</Text>
            {projects.filter(p => p.status === 'active' || p.status === 'planning').slice(0, 3).map(project => (
              <Pressable
                key={project.id}
                style={({ pressed }) => [s.jobCard, pressed && { opacity: 0.85 }]}
                onPress={() => router.push(`/contractor/projects/${project.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`${t('jobs.projects', 'Project')}: ${project.title}`}
                accessibilityHint="View project details"
              >
                <View style={[s.jobAccent, { backgroundColor: project.status === 'active' ? Palette.hermesOrange : SemanticColors.textTertiary }]} />
                <View style={s.jobContent}>
                  <Text style={s.jobTitle} numberOfLines={1} ellipsizeMode="tail">{project.title}</Text>
                  <Text style={s.jobMeta}>{project.jobIds.length} {t('jobs.jobsCount', 'klussen')} · €{project.totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </FadeIn>
        )}

        {/* Today's Schedule */}
        <FadeIn delay={0}>
          <Text style={s.sectionTitle}>
            {t('dashboard.today', 'Vandaag')} · {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          {todayJobs.length > 0 ? (
            <View style={s.todayList}>
              {todayJobs.map((entry: any, i: number) => {
                const startDate = parseTime(entry.startTime);
                const endDate = parseTime(entry.endTime);
                const timeStr = startDate
                  ? startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                  : '09:00';
                const endStr = endDate
                  ? endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                  : '';
                const durationMins = entry.duration
                  || (endDate && startDate
                    ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
                    : 0);
                const durationStr = durationMins > 0
                  ? `${Math.floor(durationMins / 60)}u${durationMins % 60 > 0 ? durationMins % 60 : ''}`
                  : '';
                return (
                  <Pressable
                    key={entry.id || i}
                    style={({ pressed }) => [s.todayCard, pressed && { opacity: 0.85 }]}
                    onPress={() => router.push(`/contractor/job/${entry.id}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={`${timeStr} ${entry.title || entry.jobTitle || t('jobs.job', 'Job')}`}
                    accessibilityHint={t('a11y.opensJobDetails', 'Opens job details')}
                  >
                    <View style={s.todayLeft}>
                      <Text style={s.todayTime}>{timeStr}</Text>
                      {endStr ? <Text style={s.todayEnd}>{endStr}</Text> : null}
                    </View>
                    <View style={s.todayDivider} />
                    <View style={s.todayContent}>
                      <Text style={s.todayTitle} numberOfLines={1} ellipsizeMode="tail">
                        {entry.title || entry.jobTitle || entry.projectName || t('jobs.job', 'Job')}
                      </Text>
                      {(entry.customerName || entry.address) && (
                        <Text style={s.todayMeta} numberOfLines={1} ellipsizeMode="tail">
                          {[entry.customerName, entry.address].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                    {durationStr ? (
                      <View style={s.durationPill}>
                        <Text style={s.durationText}>{durationStr}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Ionicons name="calendar-outline" size={24} color={SemanticColors.textTertiary} />
              <Text style={s.emptyText}>{t('dashboard.noJobsToday', 'Geen klussen vandaag')}</Text>
            </View>
          )}
        </FadeIn>

        {/* Pipeline card removed — job counts visible in grouped list below */}

        {/* Active Jobs */}
        {activeJobs.length > 0 && (
          <FadeIn delay={100}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.sectionTitle}>{t('jobs.active', 'Actief')}</Text>
              <Pressable onPress={() => setSortBy(prev => prev === 'date' ? 'status' : 'date')} hitSlop={8} accessibilityRole="button" accessibilityLabel={sortBy === 'date' ? t('jobs.byDate', 'Sort by date') : t('jobs.byStatus', 'Sort by status')}>
                <Text style={{ fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: Palette.hermesOrange }}>
                  {sortBy === 'date' ? t('jobs.byDate', 'Op datum') : t('jobs.byStatus', 'Op status')}
                </Text>
              </Pressable>
            </View>
            {activeJobs.map((job: any) => (
              <Pressable
                key={job.id}
                style={({ pressed }) => [s.jobCard, pressed && { opacity: 0.85 }]}
                onPress={() => router.push(`/contractor/job/${job.id}` as any)}
                onLongPress={() => handleDeleteJob(job.id, job.title || job.description || '')}
                accessibilityRole="button"
                accessibilityLabel={`${t('a11y.jobCard', 'Job')}: ${job.title || job.description || ''}`}
                accessibilityHint={t('a11y.opensJobDetails', 'Opens job details')}
              >
                <View style={[s.jobAccent, { backgroundColor: Palette.hermesOrange }]} />
                <View style={s.jobContent}>
                  <Text style={s.jobTitle} numberOfLines={1} ellipsizeMode="tail">{job.title || job.description}</Text>
                  <Text style={s.jobMeta} numberOfLines={1} ellipsizeMode="tail">
                    {[job.trade, job.customerId, job.status].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </FadeIn>
        )}

        {/* Leads / Quotes */}
        {leadJobs.length > 0 && (
          <FadeIn delay={150}>
            <Text style={s.sectionTitle}>{t('jobs.leadsAndQuotes', 'Leads & Offertes')}</Text>
            {leadJobs.slice(0, 5).map((job: any) => (
              <Pressable
                key={job.id}
                style={({ pressed }) => [s.jobCard, pressed && { opacity: 0.85 }]}
                onPress={() => router.push(`/contractor/job/${job.id}` as any)}
                onLongPress={() => handleDeleteJob(job.id, job.title || job.description || '')}
                accessibilityRole="button"
                accessibilityLabel={`${t('a11y.jobCard', 'Job')}: ${job.title || job.description || ''}`}
                accessibilityHint={t('a11y.opensJobDetails', 'Opens job details')}
              >
                <View style={[s.jobAccent, { backgroundColor: SemanticColors.textTertiary }]} />
                <View style={s.jobContent}>
                  <Text style={s.jobTitle} numberOfLines={1} ellipsizeMode="tail">{job.title || job.description}</Text>
                  <Text style={s.jobMeta} numberOfLines={1} ellipsizeMode="tail">
                    {job.quotedAmount ? `€${job.quotedAmount.toLocaleString(undefined)}` : ''} · {job.status}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </FadeIn>
        )}

        {/* Customers — accessible via action strip "Klanten" button */}

        {/* Empty state */}
        {jobs.length === 0 && (
          <FadeIn delay={0}>
            <View style={s.emptyFull}>
              <Ionicons name="briefcase-outline" size={48} color={SemanticColors.textTertiary} />
              <Text style={s.emptyFullTitle}>{t('jobs.noJobs', 'Nog geen klussen')}</Text>
              <Text style={s.emptyFullDesc}>{t('jobs.noJobsDesc', 'Maak je eerste klus aan')}</Text>
              <Pressable style={s.emptyBtn} onPress={() => router.push('/contractor/tiered-quote' as any)} accessibilityRole="button" accessibilityLabel={t('jobs.newJob', 'Create new job')}>
                <Text style={s.emptyBtnText}>{t('jobs.newJob', 'Nieuwe klus')}</Text>
              </Pressable>
            </View>
          </FadeIn>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* New Job Modal */}
      <Modal visible={showNewJob} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={s.modalOverlay} onPress={() => setShowNewJob(false)}>
            <Pressable style={s.modalSheet} onPress={() => {}}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>{t('pipeline.newJob', 'Nieuwe klus')}</Text>
              <TextInput
                style={s.modalInput}
                placeholder={t('pipeline.jobDescription', 'Omschrijving klus')}
                placeholderTextColor={SemanticColors.textTertiary}
                value={newJobTitle}
                onChangeText={setNewJobTitle}
                maxLength={120}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateJob}
              />
              {suggestions.length > 0 && (
                <View style={s.suggestionsRow}>
                  <Ionicons name="flash-outline" size={13} color={SemanticColors.textTertiary} />
                  {suggestions.map((sg: string, i: number) => (
                    <Pressable key={i} style={s.suggestionChip} onPress={() => setNewJobTitle(sg)} accessibilityRole="button" accessibilityLabel={`Use suggestion: ${sg}`}>
                      <Text style={s.suggestionText} numberOfLines={1}>{sg}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable
                style={[s.modalSubmit, !newJobTitle.trim() && { opacity: 0.5 }]}
                onPress={handleCreateJob}
                disabled={!newJobTitle.trim()}
                accessibilityRole="button"
                accessibilityLabel={t('pipeline.create', 'Create job')}
              >
                <Text style={s.modalSubmitText}>{t('pipeline.create', 'Aanmaken')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [s.fab, pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }]}
        onPress={() => { hapticSuccess(); router.push('/contractor/tiered-quote' as any); }}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.newQuote', 'New quote')}
      >
        <Ionicons name="add" size={28} color={Palette.white} />
      </Pressable>
    </View>
  );
}

// getDuration removed — time parsing now done inline with proper ISO handling

// =============================================================================
// STYLES — Airbnb vertical layout, TYPE constants throughout
// =============================================================================

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: GRID.sm,
    backgroundColor: PAGE_BG,
  },
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.displayTracking },
  searchBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center', justifyContent: 'center' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.lg },

  // KPI strip
  kpiStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.md,
  },
  kpi: { flex: 1, alignItems: 'center' },
  kpiValue: {
    fontSize: 22, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary,
    marginTop: GRID.xs,
  },
  kpiLabel: {
    fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textSecondary,
  },
  kpiDivider: {
    width: StyleSheet.hairlineWidth, height: 32, backgroundColor: SemanticColors.borderDefault,
  },

  // Action strip
  actionStrip: { gap: GRID.sm, paddingRight: GRID.lg },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    backgroundColor: Palette.hermesOrange + '10', borderRadius: RADIUS.lg,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  actionBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },

  // Section headers
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking },

  // Today's schedule — vertical list (not horizontal scroll)
  todayList: { gap: GRID.sm },
  todayCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.md,
  },
  todayLeft: { width: 44, alignItems: 'center' },
  todayTime: { fontSize: TYPE.bodySize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  todayEnd: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textTertiary },
  todayDivider: { width: 1, height: 28, backgroundColor: SemanticColors.borderDefault, marginHorizontal: GRID.sm },
  todayContent: { flex: 1 },
  todayTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  todayMeta: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  durationPill: { backgroundColor: SemanticColors.surfaceSecondary, borderRadius: RADIUS.sm, paddingHorizontal: GRID.sm, paddingVertical: 2 },
  durationText: { fontSize: TYPE.tinySize, fontFamily: TYPE.labelFamily, color: SemanticColors.textSecondary },

  // Pipeline card
  pipelineCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.md, gap: GRID.md - 4 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center' },
  pipelineStat: { flex: 1, alignItems: 'center' },
  pipelineValue: { fontSize: 22, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  pipelineLabel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  pipelineDivider: { width: 1, height: 28, backgroundColor: SemanticColors.borderDefault },

  // Job cards — clean vertical list
  jobCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  jobAccent: { width: 4, alignSelf: 'stretch' },
  jobContent: { flex: 1, paddingVertical: GRID.md, paddingHorizontal: GRID.md },
  jobTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  jobMeta: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },

  // Empty states
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: GRID.md - 4, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.md },
  emptyText: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textTertiary },
  emptyFull: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyFullTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  emptyFullDesc: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  emptyBtn: { backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },

  // FAB
  fab: {
    position: 'absolute', right: SafeArea.side, bottom: 110,
    width: 56, height: 56, borderRadius: RADIUS.full,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: SemanticColors.surfacePrimary, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 20, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: SemanticColors.borderDefault, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary },
  modalInput: { backgroundColor: PAGE_BG, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  modalSubmit: { backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  modalSubmitText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  suggestionChip: { backgroundColor: SemanticColors.surfaceSecondary, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6 },
  suggestionText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textPrimary, maxWidth: 180 },
});
