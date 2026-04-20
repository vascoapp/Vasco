// =============================================================================
// WERK — DraftKings-structured jobs hub
// =============================================================================
// DK pattern applied: sticky top bar · hero feature card · horizontal quick-link
// chips · SEGMENTED TAB STRIP (Vandaag/Actief/Leads/Projecten) · tab-driven list
// content · sticky gradient FAB. Functions preserved from legacy screen.
// =============================================================================

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DK } from '../../src/theme/draftkings';
import { useAppState } from '../../src/state/AppState';
import { useDaySchedule } from '../../src/services/smartSchedulerService';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { SkeletonList } from '../../src/components/shared/SkeletonList';
import { useAuth } from '../../src/context/AuthContext';
import { DKLabel } from '../../src/components/shared/DKLabel';

type IconName = keyof typeof Ionicons.glyphMap;

type TabKey = 'today' | 'active' | 'leads' | 'projects';

function parseTime(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d;
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
  const { jobs, addJob, removeJob, projects, isLoading } = useAppState();
  const [showNewJob, setShowNewJob] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
  const [tab, setTab] = useState<TabKey>('today');
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
    try {
      const { loadSubscription, canCreateJob } = await import('../../src/services/subscriptionService');
      const sub = await loadSubscription();
      const gate = canCreateJob(sub);
      if (!gate.allowed) {
        Alert.alert(
          t('billing.upgradeRequired', 'Upgrade required'),
          gate.reason,
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            { text: t('billing.viewPlans', 'View plans'), onPress: () => router.push('/contractor/profile' as any) },
          ],
        );
        return;
      }
    } catch {}
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
      .filter((title: string) => { if (!title || seen.has(title.toLowerCase())) return false; seen.add(title.toLowerCase()); return true; });
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

  const activeJobs = useMemo(() => {
    const filtered = jobs.filter((j: any) => ['scheduled', 'in-progress', 'ingepland', 'bezig'].includes(j.status));
    if (sortBy === 'status') return [...filtered].sort((a, b) => String(a.status).localeCompare(String(b.status)));
    return [...filtered].sort((a, b) => String(b.scheduledDate || b.createdAt || '').localeCompare(String(a.scheduledDate || a.createdAt || '')));
  }, [jobs, sortBy]);
  const leadJobs = jobs.filter((j: any) => ['lead', 'quoted', 'accepted'].includes(j.status));
  const todayJobs = todaySchedule?.jobs ?? [];
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active' || p.status === 'planning'),
    [projects]
  );

  const activeCount = activeJobs.length;
  const scheduledToday = todayJobs.length;
  const leadCount = leadJobs.length;

  // Hero: top priority job (first active with in-progress status, or first today)
  const heroJob = useMemo(() => {
    const inProgress = todayJobs.find((j: any) => j.status === 'in_progress');
    if (inProgress) return { type: 'live' as const, job: inProgress };
    const next = todayJobs[0];
    if (next) return { type: 'next' as const, job: next };
    const firstActive = activeJobs[0];
    if (firstActive) return { type: 'active' as const, job: firstActive };
    return null;
  }, [todayJobs, activeJobs]);

  const quickLinks: { icon: IconName; label: string; route: string }[] = [
    { icon: 'calendar-outline', label: t('jobs.calendar', 'Kalender'), route: '/contractor/drag-schedule' },
    { icon: 'time-outline', label: t('jobs.hours', 'Uren'), route: '/contractor/timesheet' },
    ...(user?.isAannemer ? [{ icon: 'folder-open-outline' as IconName, label: t('jobs.projects', 'Projecten'), route: '/contractor/projects' }] : []),
    { icon: 'people-outline', label: t('jobs.customers', 'Klanten'), route: '/(contractor)/bedrijf' },
  ];

  const tabs: { key: TabKey; label: string; count: number }[] = ([
    { key: 'today' as TabKey, label: t('dk.tabs.today', 'Today').toUpperCase(), count: scheduledToday, visible: true },
    { key: 'active' as TabKey, label: t('dk.tabs.active', 'Active').toUpperCase(), count: activeCount, visible: true },
    { key: 'leads' as TabKey, label: t('dk.tabs.leads', 'Leads').toUpperCase(), count: leadCount, visible: true },
    { key: 'projects' as TabKey, label: t('dk.tabs.projects', 'Projects').toUpperCase(), count: activeProjects.length, visible: !!user?.isAannemer },
  ] as const).filter((t) => t.visible).map(({ key, label, count }) => ({ key, label, count }));

  if (isLoading) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
          <View style={styles.topBar}><DKLabel style={styles.title}>{t('tabs.jobs', 'Werk')}</DKLabel></View>
        </SafeAreaView>
        <SkeletonList count={4} lines={2} />
      </View>
    );
  }

  // Full-empty overrides everything
  if (jobs.length === 0) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
          <View style={styles.topBar}><Text style={styles.title}>WERK</Text></View>
        </SafeAreaView>
        <View style={styles.fullEmpty}>
          <Ionicons name="briefcase-outline" size={48} color={DK.colors.textMuted} />
          <DKLabel style={styles.fullEmptyTitle}>{t('dk.empty.noJobs', 'No jobs yet')}</DKLabel>
          <Text style={styles.fullEmptyDesc}>{t('dk.empty.noJobsDesc', 'Create your first job')}</Text>
          <Pressable style={styles.fullEmptyBtn} onPress={() => router.push('/contractor/tiered-quote' as any)}>
            <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <DKLabel style={styles.fullEmptyBtnText}>{t('dk.actions.newJob', 'New job')}</DKLabel>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ─── TOP BAR ─── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
        <View style={styles.topBar}>
          <Text style={styles.title}>WERK</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {tab === 'active' && (
              <Pressable onPress={() => setSortBy(prev => prev === 'date' ? 'status' : 'date')} hitSlop={8} style={styles.sortChip}>
                <Text style={styles.sortChipText}>{sortBy === 'date' ? `${t('dk.actions.byDate','Date').toUpperCase()} ↓` : `${t('dk.actions.byStatus','Status').toUpperCase()} ↓`}</Text>
              </Pressable>
            )}
            <Pressable style={styles.iconBtn} onPress={() => router.push('/contractor/search' as any)} hitSlop={8}>
              <Ionicons name="search" size={20} color={DK.colors.text} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DK.colors.accent} />}
      >
        {/* ─── HERO FEATURE CARD (if a job to spotlight) ─── */}
        {heroJob ? <HeroJobCard heroJob={heroJob} onPress={() => router.push(`/contractor/job/${heroJob.job.id}` as any)} /> : null}

        {/* ─── QUICK LINK CHIPS ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {quickLinks.map((q) => (
            <Pressable
              key={q.route}
              style={({ pressed }) => [styles.chip, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(q.route as any)}
            >
              <Ionicons name={q.icon} size={14} color={DK.colors.accent} />
              <DKLabel style={styles.chipText}>{q.label}</DKLabel>
            </Pressable>
          ))}
        </ScrollView>

        {/* ─── SEGMENTED TAB STRIP ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStrip}>
          {tabs.map((tb) => {
            const active = tb.key === tab;
            return (
              <Pressable
                key={tb.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(tb.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tb.label}</Text>
                <View style={[styles.tabCount, active && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{tb.count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── TAB CONTENT ─── */}
        {tab === 'today' && (
          <TodayContent
            todayJobs={todayJobs}
            onOpenJob={(id) => router.push(`/contractor/job/${id}` as any)}
            onPlanCta={() => router.push('/contractor/drag-schedule' as any)}
            t={t}
          />
        )}

        {tab === 'active' && (
          activeJobs.length > 0 ? (
            <View style={styles.listGroup}>
              {activeJobs.map((job: any) => (
                <JobRow
                  key={job.id}
                  title={job.title || job.description || ''}
                  meta={[job.trade, job.status].filter(Boolean).join(' · ')}
                  accent={DK.colors.accent}
                  onPress={() => router.push(`/contractor/job/${job.id}` as any)}
                  onLongPress={() => handleDeleteJob(job.id, job.title || job.description || '')}
                />
              ))}
            </View>
          ) : (
            <EmptyBlock icon="briefcase-outline" title={t('dk.empty.noActive', 'No active jobs').toUpperCase()} desc={t('dk.empty.noActiveDesc', 'Start a job from Leads or schedule one.')} ctaLabel={t('dk.actions.newJob', 'New job').toUpperCase()} ctaIcon="add-outline" onCta={() => setShowNewJob(true)} />
          )
        )}

        {tab === 'leads' && (
          leadJobs.length > 0 ? (
            <View style={styles.listGroup}>
              {leadJobs.slice(0, 20).map((job: any) => (
                <JobRow
                  key={job.id}
                  title={job.title || job.description || ''}
                  meta={[job.quotedAmount ? `€${job.quotedAmount.toLocaleString()}` : null, job.status].filter(Boolean).join(' · ')}
                  accent={DK.colors.highlight}
                  onPress={() => router.push(`/contractor/job/${job.id}` as any)}
                  onLongPress={() => handleDeleteJob(job.id, job.title || job.description || '')}
                />
              ))}
            </View>
          ) : (
            <EmptyBlock icon="people-outline" title={t('dk.empty.noLeads', 'No leads').toUpperCase()} desc={t('dk.empty.noLeadsDesc', 'Request a quote from customers or create one.')} ctaLabel={t('dk.actions.newQuote', 'New quote').toUpperCase()} ctaIcon="document-text-outline" onCta={() => router.push('/contractor/tiered-quote' as any)} />
          )
        )}

        {tab === 'projects' && user?.isAannemer && (
          activeProjects.length > 0 ? (
            <View style={styles.listGroup}>
              {activeProjects.slice(0, 10).map((project) => (
                <JobRow
                  key={project.id}
                  title={project.title}
                  meta={`${project.jobIds.length} klussen · €${project.totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  accent={project.status === 'active' ? DK.colors.accent : DK.colors.textMuted}
                  onPress={() => router.push(`/contractor/projects/${project.id}` as any)}
                />
              ))}
            </View>
          ) : (
            <EmptyBlock icon="folder-open-outline" title={t('dk.empty.noProjects', 'No projects').toUpperCase()} desc={t('dk.empty.noProjectsDesc', 'Create a project to bundle jobs.')} ctaLabel={t('dk.empty.noProjects', 'Create project').toUpperCase()} ctaIcon="add-outline" onCta={() => router.push('/contractor/projects' as any)} />
          )
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ─── NEW JOB MODAL ─── */}
      <Modal visible={showNewJob} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowNewJob(false)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <DKLabel style={styles.modalTitle}>{t('dk.actions.newJob', 'New job')}</DKLabel>
              <TextInput
                style={styles.modalInput}
                placeholder={t('pipeline.jobDescription', 'Omschrijving klus')}
                placeholderTextColor={DK.colors.textMuted}
                value={newJobTitle}
                onChangeText={setNewJobTitle}
                maxLength={120}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateJob}
              />
              {suggestions.length > 0 && (
                <View style={styles.suggestionsRow}>
                  <Ionicons name="flash-outline" size={13} color={DK.colors.textMuted} />
                  {suggestions.map((sg: string, i: number) => (
                    <Pressable key={i} style={styles.suggestionChip} onPress={() => setNewJobTitle(sg)}>
                      <Text style={styles.suggestionText} numberOfLines={1}>{sg}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable
                style={[styles.modalSubmit, !newJobTitle.trim() && { opacity: 0.5 }]}
                onPress={handleCreateJob}
                disabled={!newJobTitle.trim()}
              >
                <LinearGradient
                  colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <DKLabel style={styles.modalSubmitText}>{t('dk.actions.createJob', 'Create')}</DKLabel>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── FAB ─── */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }]}
        onPress={() => { hapticSuccess(); router.push('/contractor/tiered-quote' as any); }}
      >
        <LinearGradient
          colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────
function HeroJobCard({ heroJob, onPress }: { heroJob: { type: 'live' | 'next' | 'active'; job: any }; onPress: () => void }) {
  const { t } = useTranslation();
  const { type, job } = heroJob;
  const label = (type === 'live' ? t('dk.hero.liveBezig', 'Live · in progress') : type === 'next' ? t('dk.hero.next', 'Up next') : t('dk.hero.activeNow', 'Active now')).toUpperCase();
  const tone = type === 'live' ? DK.colors.danger : DK.colors.highlight;
  const startStr = job.startTime
    ? new Date(job.startTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : (parseTime(job.scheduledStartTime)?.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) ?? '09:00');
  return (
    <Pressable style={({ pressed }) => [heroStyles.wrap, pressed && { opacity: 0.95 }]} onPress={onPress}>
      <LinearGradient
        colors={[DK.colors.primaryDark, DK.colors.primary, '#7C2D12']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={heroStyles.card}
      >
        <View style={[heroStyles.glow, { backgroundColor: tone }]} />
        <View style={[heroStyles.chip, { backgroundColor: tone + '22', borderColor: tone + '55' }]}>
          {type === 'live' ? <View style={[heroStyles.pulse, { backgroundColor: tone }]} /> : null}
          <Text style={[heroStyles.chipText, { color: tone }]}>{label}</Text>
        </View>
        <Text style={heroStyles.title} numberOfLines={2}>{job.projectName || job.title}</Text>
        <Text style={heroStyles.customer} numberOfLines={1}>{job.customerName || job.customer || ''}</Text>
        <View style={heroStyles.metaRow}>
          <View style={heroStyles.metaChip}>
            <DKLabel style={heroStyles.metaLabel}>{t('dk.pill.time', 'Time')}</DKLabel>
            <Text style={heroStyles.metaValue}>{startStr}</Text>
          </View>
          {(job.address || job.customerName) ? (
            <View style={heroStyles.metaChip}>
              <DKLabel style={heroStyles.metaLabel}>{t('dk.pill.location', 'Location')}</DKLabel>
              <Text style={heroStyles.metaValue} numberOfLines={1}>{job.address || job.customerName}</Text>
            </View>
          ) : null}
        </View>
        <View style={heroStyles.ctaRow}>
          <DKLabel style={heroStyles.ctaText}>{t('dk.actions.openJob', 'Open job')}</DKLabel>
          <Ionicons name="arrow-forward" size={14} color={DK.colors.bg} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function TodayContent({ todayJobs, onOpenJob, onPlanCta, t }: { todayJobs: any[]; onOpenJob: (id: string) => void; onPlanCta: () => void; t: any }) {
  if (todayJobs.length === 0) {
    return (
      <EmptyBlock
        icon="sunny-outline"
        title={t('dk.empty.noJobsToday', 'No jobs today').toUpperCase()}
        desc={t('dashboard.noJobsTodayDesc', 'Jouw dag is vrij — plan volgende week.')}
        ctaLabel={t('dk.fab.planSchedule', 'Plan your week').toUpperCase()}
        ctaIcon="calendar-outline"
        onCta={onPlanCta}
      />
    );
  }
  return (
    <View style={styles.listGroup}>
      {todayJobs.map((entry: any, i: number) => {
        const startDate = parseTime(entry.startTime);
        const endDate = parseTime(entry.endTime);
        const timeStr = startDate ? startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '09:00';
        const endStr = endDate ? endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
        const durationMins = entry.duration
          || (endDate && startDate ? Math.round((endDate.getTime() - startDate.getTime()) / 60000) : 0);
        const durationStr = durationMins > 0
          ? `${Math.floor(durationMins / 60)}u${durationMins % 60 > 0 ? durationMins % 60 : ''}`
          : '';
        return (
          <Pressable
            key={entry.id || i}
            style={({ pressed }) => [styles.todayRow, pressed && { opacity: 0.9 }]}
            onPress={() => onOpenJob(entry.id)}
          >
            <Text style={styles.todayTime}>{timeStr}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayTitle} numberOfLines={1}>
                {entry.title || entry.jobTitle || entry.projectName || 'Job'}
              </Text>
              {(entry.customerName || entry.address) && (
                <Text style={styles.todayMeta} numberOfLines={1}>
                  {[entry.customerName, entry.address].filter(Boolean).join(' · ')}
                </Text>
              )}
              {endStr ? <Text style={styles.todayRange}>{timeStr} – {endStr}</Text> : null}
            </View>
            {durationStr ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{durationStr}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function JobRow({ title, meta, accent, onPress, onLongPress }: { title: string; meta?: string; accent: string; onPress: () => void; onLongPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.jobRow, pressed && { opacity: 0.9 }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={[styles.jobAccent, { backgroundColor: accent }]} />
      <View style={{ flex: 1, paddingVertical: 14, paddingRight: 12 }}>
        <Text style={styles.jobTitle} numberOfLines={1}>{title}</Text>
        {meta ? <Text style={styles.jobMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={DK.colors.textMuted} style={{ marginRight: 12 }} />
    </Pressable>
  );
}

function EmptyBlock({ icon, title, desc, ctaLabel, ctaIcon, onCta }: { icon: IconName; title: string; desc: string; ctaLabel: string; ctaIcon: IconName; onCta: () => void }) {
  return (
    <View style={styles.emptyBlock}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={DK.colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
      <Pressable style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.85 }]} onPress={onCta}>
        <Ionicons name={ctaIcon} size={14} color={DK.colors.accent} />
        <Text style={styles.emptyCtaText}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontFamily: DK.type.display900,
    fontSize: 28,
    color: DK.colors.text,
    letterSpacing: -0.8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DK.colors.panel,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: DK.colors.border,
  },
  sortChip: {
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.panel2,
    borderWidth: 1, borderColor: DK.colors.border,
    justifyContent: 'center',
  },
  sortChipText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.accent, letterSpacing: 1.1 },

  // Quick chip row
  chipRow: { gap: 8, paddingRight: 20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.accent + '14',
    borderWidth: 1, borderColor: DK.colors.accent + '44',
  },
  chipText: {
    fontFamily: DK.type.display800,
    fontSize: 11,
    color: DK.colors.accent,
    letterSpacing: 1.2,
  },

  // Tab strip
  tabStrip: { gap: 6, paddingRight: 20 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: DK.radius.button,
    backgroundColor: DK.colors.panel,
    borderWidth: 1, borderColor: DK.colors.border,
  },
  tabActive: {
    backgroundColor: DK.colors.accent,
    borderColor: DK.colors.accent,
  },
  tabText: { fontFamily: DK.type.display900, fontSize: 11, color: DK.colors.textMuted, letterSpacing: 1.4 },
  tabTextActive: { color: DK.colors.bg },
  tabCount: {
    minWidth: 20, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.panel2,
    alignItems: 'center',
  },
  tabCountActive: { backgroundColor: '#0B0E1144' },
  tabCountText: { fontFamily: DK.type.display900, fontSize: 10, color: DK.colors.textMuted },
  tabCountTextActive: { color: DK.colors.bg },

  listGroup: { gap: 8 },

  // Today row
  todayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 14,
  },
  todayTime: {
    fontFamily: DK.type.display900,
    fontSize: 16,
    color: DK.colors.accent,
    letterSpacing: -0.3,
    width: 52,
  },
  todayTitle: { fontFamily: DK.type.display800, fontSize: 14, color: DK.colors.text },
  todayMeta: { fontFamily: DK.type.body400, fontSize: 12, color: DK.colors.textMuted, marginTop: 2 },
  todayRange: { fontFamily: DK.type.body600, fontSize: 11, color: DK.colors.accent, marginTop: 2, letterSpacing: 0.3 },
  pill: {
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.panel2,
    borderWidth: 1, borderColor: DK.colors.border,
  },
  pillText: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.textMuted, letterSpacing: 0.8 },

  // Job row
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    overflow: 'hidden',
  },
  jobAccent: { width: 4, alignSelf: 'stretch' },
  jobTitle: { fontFamily: DK.type.display800, fontSize: 14, color: DK.colors.text, paddingLeft: 12 },
  jobMeta: { fontFamily: DK.type.body400, fontSize: 12, color: DK.colors.textMuted, marginTop: 2, paddingLeft: 12 },

  // Empty
  emptyBlock: {
    alignItems: 'center',
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingVertical: 32, paddingHorizontal: 24,
    gap: 8,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: DK.colors.accent + '1A', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: DK.type.display900, fontSize: 14, color: DK.colors.text, letterSpacing: 1.4 },
  emptyDesc: { fontFamily: DK.type.body400, fontSize: 12, color: DK.colors.textMuted, textAlign: 'center', lineHeight: 17 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.accent + '14',
    borderWidth: 1, borderColor: DK.colors.accent + '44',
  },
  emptyCtaText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.accent, letterSpacing: 1.2 },

  // Full empty
  fullEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  fullEmptyTitle: { fontFamily: DK.type.display900, fontSize: 16, color: DK.colors.text, letterSpacing: 1.8, marginTop: 10 },
  fullEmptyDesc: { fontFamily: DK.type.body400, fontSize: 13, color: DK.colors.textMuted },
  fullEmptyBtn: {
    marginTop: 14,
    paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: DK.radius.button,
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: DK.colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 10,
  },
  fullEmptyBtnText: { fontFamily: DK.type.display900, fontSize: 13, color: '#FFFFFF', letterSpacing: 1.4 },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 110,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: DK.colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 10,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: DK.colors.panel,
    borderTopLeftRadius: DK.radius.card, borderTopRightRadius: DK.radius.card,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: DK.colors.border,
    padding: 20, paddingBottom: 40, gap: 12,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: DK.colors.border, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontFamily: DK.type.display900, fontSize: 16, color: DK.colors.text, letterSpacing: 1.8 },
  modalInput: {
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, fontFamily: DK.type.body500,
    color: DK.colors.text,
  },
  modalSubmit: {
    borderRadius: DK.radius.button, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  modalSubmitText: { fontFamily: DK.type.display900, fontSize: 13, color: '#FFFFFF', letterSpacing: 1.4 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  suggestionChip: {
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.chip,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  suggestionText: { fontFamily: DK.type.body500, fontSize: 12, color: DK.colors.text, maxWidth: 180 },
});

const heroStyles = StyleSheet.create({
  wrap: {
    borderRadius: DK.radius.card,
    shadowColor: DK.colors.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 12,
  },
  card: {
    borderRadius: DK.radius.card,
    padding: 18,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -60, right: -60,
    width: 180, height: 180,
    borderRadius: 90,
    opacity: 0.18,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: DK.radius.chip,
    borderWidth: 1,
    marginBottom: 12,
  },
  pulse: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: DK.type.display900, fontSize: 10, letterSpacing: 1.5 },
  title: {
    fontFamily: DK.type.display900,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  customer: {
    fontFamily: DK.type.body500,
    fontSize: 13,
    color: '#FFFFFFCC',
    marginTop: 4,
  },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 16, flexWrap: 'wrap' },
  metaChip: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: DK.radius.chip,
    backgroundColor: '#0B0E1177',
    borderWidth: 1, borderColor: '#FFFFFF22',
  },
  metaLabel: {
    fontFamily: DK.type.display800,
    fontSize: 9,
    color: '#FFFFFFAA',
    letterSpacing: 1.5,
  },
  metaValue: {
    fontFamily: DK.type.display900,
    fontSize: 14,
    color: DK.colors.highlight,
    marginTop: 1,
  },
  ctaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: DK.radius.button,
    backgroundColor: '#FFFFFF',
  },
  ctaText: { fontFamily: DK.type.display900, fontSize: 13, color: DK.colors.bg, letterSpacing: 1.2 },
});
