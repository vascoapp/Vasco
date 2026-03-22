// =============================================================================
// VANDAAG - Contractor Command Center
// =============================================================================
// Clean white canvas. Orange used only as thin section dividers and small
// accent touches to create visual rhythm between content blocks.
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { useNotifications } from '../../src/services/notificationService';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { LoadingSkeleton } from '../../src/components/shared/LoadingSkeleton';
import { getActionStats } from '../../src/intelligence/actionExecutor';
import { useAIQueue, populateQueue } from '../../src/services/aiActionQueueService';
import { getMorningBriefing, generateMorningBriefing, type MorningBriefing } from '../../src/intelligence/backgroundJobScheduler';
import { VascoCard } from '../../src/components/shared/VascoCard';
import { GradientButton } from '../../src/components/shared/GradientButton';
import { CountUp } from '../../src/components/shared/CountUp';
// Core services
import { useDaySchedule, useJobLifecyclePipeline, LIFECYCLE_COLORS, LIFECYCLE_LABELS } from '../../src/services/smartSchedulerService';
import type { JobLifecycleStatus } from '../../src/services/smartSchedulerService';
import { useCashFlow } from '../../src/services/cashFlowService';

// AI services
import { useSavingsAggregation } from '../../src/services/savingsAggregatorService';
import { useAutomations } from '../../src/services/automationService';
import type { AutomationContext } from '../../src/services/automationService';

// Vasco Guidance + Learning
import { useVascoGuidance } from '../../src/services/vascoGuidanceService';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { VascoInsightList } from '../../src/components/shared/VascoInsightCard';
import type { VascoInsight } from '../../src/components/shared/VascoInsightCard';

// Dashboard Header
import { ContractorDashboardHeader } from '../../src/components/contractor/ContractorDashboardHeader';
import { hapticSuccess, hapticWarning } from '../../src/utils/haptics';
import { getCohortBenchmark } from '../../src/intelligence/cloudSync';
import { useAuth } from '../../src/context/AuthContext';
import { useAppState } from '../../src/state/AppState';

// ============================================
// TYPES
// ============================================

interface JobItem {
  id: string;
  title: string;
  customer: string;
  address: string;
  time: string;
  duration: string;
  status: 'active' | 'upcoming' | 'completed';
  lifecycleStatus?: JobLifecycleStatus;
}

// ============================================
// COMPONENTS
// ============================================

function JobCard({ job, onPress, onClockIn }: { job: JobItem; onPress: () => void; onClockIn?: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.jobCard, pressed && { opacity: 0.95 }]} onPress={onPress}>
      <View style={[styles.jobAccent, {
        backgroundColor: job.status === 'active' ? Palette.hermesOrange
          : job.status === 'completed' ? SemanticColors.feedbackSuccess
          : SemanticColors.borderDefault,
      }]} />
      <View style={styles.jobCardContent}>
        <View style={styles.jobCardHeader}>
          <View style={styles.jobTimeContainer}>
            <Text style={[
              styles.jobTime,
              job.status === 'active' && styles.jobTimeActive
            ]}>
              {job.time}
            </Text>
            <View style={[styles.jobDurationChip, job.status === 'active' && { backgroundColor: Palette.hermesOrange + '10' }]}>
              <Text style={[styles.jobDuration, job.status === 'active' && { color: Palette.hermesOrange }]}>{job.duration}</Text>
            </View>
          </View>
          {job.lifecycleStatus && (
            <View style={[styles.jobLifecycleTag, { backgroundColor: LIFECYCLE_COLORS[job.lifecycleStatus] + '14' }]}>
              <View style={[styles.jobActiveDot, { backgroundColor: LIFECYCLE_COLORS[job.lifecycleStatus] }]} />
              <Text style={[styles.jobActiveText, { color: LIFECYCLE_COLORS[job.lifecycleStatus] }]}>
                {LIFECYCLE_LABELS[job.lifecycleStatus].toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
        <Text style={styles.jobCustomer} numberOfLines={1}>{job.customer}</Text>
        <View style={styles.jobCardFooter}>
          <View style={styles.jobAddress}>
            <Ionicons name="location-outline" size={12} color={SemanticColors.textDisabled} />
            <Text style={styles.jobAddressText} numberOfLines={1}>{job.address}</Text>
          </View>
          {job.status === 'upcoming' && onClockIn && (
            <Pressable
              style={({ pressed }) => [styles.clockInBtn, pressed && { opacity: 0.85 }]}
              onPress={(e) => { e.stopPropagation?.(); onClockIn(); }}
              hitSlop={4}
            >
              <Ionicons name="play" size={12} color={Palette.white} />
              <Text style={styles.clockInBtnText}>Start</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}


// ============================================
// MAIN SCREEN
// ============================================

export default function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedGuidance, setDismissedGuidance] = useState<Set<string>>(new Set());
  const [snoozedGuidance, setSnoozedGuidance] = useState<Set<string>>(new Set());
  const [showAutomations, setShowAutomations] = useState(false);
  const { notifications } = useNotifications();
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const { jobs, invoices, quotes, customers, isLoading, addInvoiceFromJob } = useAppState();
  const [actionStats, setActionStats] = useState<{ total: number; successful: number; positiveOutcomes: number } | null>(null);
  useEffect(() => { getActionStats().then(setActionStats).catch(() => {}); }, []);
  const aiQueue = useAIQueue();
  const [briefing, setBriefing] = useState<MorningBriefing | null>(null);
  // Generate morning briefing + populate AI queue
  useEffect(() => {
    getMorningBriefing().then(b => {
      if (b) setBriefing(b);
      else generateMorningBriefing({ invoices, quotes, jobs }).then(setBriefing).catch(() => {});
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const completedJobs = jobs.filter((j: any) => j.status === 'completed');
    const overdueInvoices = invoices.filter((i: any) => i.status === 'overdue');
    const sentQuotes = quotes.filter((q: any) => q.status === 'sent');
    populateQueue({ completedJobs, overdueInvoices, sentQuotes, expiringCerts: [] }).then(() => aiQueue.refresh());
  }, [jobs.length, invoices.length, quotes.length]);

  // Build automation context from app state
  const automationCtx = useMemo<AutomationContext>(() => ({
    jobs: jobs.map(j => ({ id: j.id, title: j.title, status: j.status, customerId: j.customerId ?? '', agreedAmount: j.agreedAmount, completedAt: j.completedAt })),
    invoices: invoices.map(i => ({ id: i.id, customer: i.customer ?? '', amount: i.amount ?? 0, status: i.status, dueInDays: i.dueInDays ?? 0 })),
    quotes: quotes.map(q => ({ id: q.id, customer: q.customer ?? '', amount: q.amount ?? 0, status: q.status, lastUpdated: q.lastUpdated })),
    customers: customers.map(c => ({ id: c.id, name: c.name })),
  }), [jobs, invoices, quotes, customers]);

  const { results: automationResults, timeSaved } = useAutomations(automationCtx);
  const pendingAutomations = useMemo(() => automationResults.filter(r => !r.actionTaken).length, [automationResults]);

  // Clock-in timer state
  const [clockedInJobId, setClockedInJobId] = useState<string | null>(null);
  const [clockInStartTime, setClockInStartTime] = useState<number | null>(null);
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');

  // Screen visit tracking
  useEffect(() => { recordScreenVisit('today'); }, []);

  // Timer update effect
  useEffect(() => {
    if (!clockInStartTime) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - clockInStartTime) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      setTimerDisplay(`${h}:${m}:${s}`);
      // Haptic warning if exceeds ~2 hours (estimated job duration)
      if (elapsed === 7200) hapticWarning();
    }, 1000);
    return () => clearInterval(interval);
  }, [clockInStartTime]);

  // Get today's date
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Core services
  const daySchedule = useDaySchedule(today);
  const { summary: cashFlowSummary, invoices: cfInvoices } = useCashFlow();
  const overdueCount = useMemo(() => cfInvoices.filter(inv => inv.status === 'overdue').length, [cfInvoices]);

  // AI services
  const savings = useSavingsAggregation();
  const { user } = useAuth();

  // Cohort benchmark (async, non-blocking)
  const [dsoBenchmark, setDsoBenchmark] = useState<{ median: number } | null>(null);
  useEffect(() => {
    getCohortBenchmark(user?.trade ?? 'general', user?.country ?? 'NL', 'dso')
      .then(setDsoBenchmark)
      .catch(() => {});
  }, [user?.trade, user?.country]);

  // Job Lifecycle Pipeline (P1)
  const { counts: lifecycleCounts } = useJobLifecyclePipeline();
  const pipelineCount = lifecycleCounts.lead + lifecycleCounts.offerte + lifecycleCounts.geaccepteerd;

  // Vasco AI Guidance (critical/high only)
  const allGuidance = useVascoGuidance('contractor', 'today');
  const activeGuidance = useMemo(
    () => allGuidance
      .filter(g => !dismissedGuidance.has(g.id) && !snoozedGuidance.has(g.id))
      .filter(g => g.priority === 'critical' || g.priority === 'high'),
    [allGuidance, dismissedGuidance, snoozedGuidance]
  );

  // Build today's jobs list with raw startTime for grouping
  const todayJobs = useMemo((): (JobItem & { startHour: number; rawStartTime: number; quotedAmount: number })[] => {
    return daySchedule.jobs.map(job => {
      const start = new Date(job.startTime);
      return {
        id: job.id,
        title: job.projectName,
        customer: job.customerName,
        address: job.address || 'Adres niet beschikbaar',
        time: start.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        duration: `${Math.round((new Date(job.endTime).getTime() - start.getTime()) / 3600000)}u`,
        status: job.status === 'in_progress' ? 'active' as const : job.status === 'completed' ? 'completed' as const : 'upcoming' as const,
        lifecycleStatus: job.lifecycleStatus,
        startHour: start.getHours(),
        rawStartTime: start.getTime(),
        quotedAmount: job.quotedAmount || 0,
      };
    });
  }, [daySchedule.jobs]);

  // Time-grouped sections
  // morningJobs/afternoonJobs removed — single flat schedule list

  // Daily earnings (completed jobs)
  const dailyEarnings = useMemo(() =>
    todayJobs
      .filter(j => j.status === 'completed')
      .reduce((sum, j) => sum + j.quotedAmount, 0),
    [todayJobs]
  );

  // Next job countdown
  const nextJobCountdown = useMemo(() => {
    const now = Date.now();
    const fourHoursMs = 4 * 3600000;
    const upcoming = todayJobs
      .filter(j => j.status === 'upcoming' && j.rawStartTime > now && (j.rawStartTime - now) <= fourHoursMs)
      .sort((a, b) => a.rawStartTime - b.rawStartTime);
    if (upcoming.length === 0) return null;
    const next = upcoming[0];
    const diffMin = Math.round((next.rawStartTime - now) / 60000);
    return { jobId: next.id, minutes: diffMin };
  }, [todayJobs]);

  // Active clocked-in job info
  const clockedInJob = useMemo(
    () => clockedInJobId ? todayJobs.find(j => j.id === clockedInJobId) : null,
    [clockedInJobId, todayJobs]
  );

  // KPI data
  const outstanding = cashFlowSummary.pendingIncome;

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.goodMorning', 'Goedemorgen');
    if (hour < 18) return t('dashboard.goodAfternoon', 'Goedemiddag');
    return t('dashboard.goodEvening', 'Goedenavond');
  }, [t]);

  const formattedDate = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const handleDismissGuidance = useCallback((id: string) => {
    setDismissedGuidance(prev => new Set(prev).add(id));
  }, []);

  const handleSnoozeGuidance = useCallback((id: string) => {
    setSnoozedGuidance(prev => new Set(prev).add(id));
  }, []);

  const handleGuidanceAction = useCallback((insight: VascoInsight) => {
    if (insight.actionRoute) {
      router.push(insight.actionRoute as any);
    }
  }, [router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      hapticSuccess();
    }, 800);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: 80, paddingHorizontal: 20 }}>
          <LoadingSkeleton variant="full-screen" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header — flex constrained so greeting doesn't bleed into buttons */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.greeting} numberOfLines={1}>{greeting}, Mark</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
          <Pressable style={styles.profileButton} onPress={() => router.push('/contractor/search' as any)} accessibilityLabel="Zoeken">
            <Ionicons name="search" size={20} color={SemanticColors.textPrimary} />
          </Pressable>
          <Pressable style={styles.profileButton} onPress={() => router.push('/contractor/notifications' as any)} accessibilityLabel="Meldingen">
            <Ionicons name="notifications-outline" size={20} color={SemanticColors.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.profileButton} onPress={() => router.push('/contractor/profile' as any)} accessibilityLabel="Profiel">
            <Ionicons name="person" size={22} color={Palette.hermesOrange} />
          </Pressable>
        </View>
      </View>

      {/* Clock-in Timer Strip */}
      {clockedInJob && clockInStartTime && (
        <Pressable
          style={styles.timerStrip}
          onPress={() => router.push(`/contractor/job/${clockedInJobId}` as any)}
        >
          <View style={styles.timerPulse} />
          <Text style={styles.timerJobName} numberOfLines={1}>{clockedInJob.title}</Text>
          <Text style={styles.timerClock}>{timerDisplay}</Text>
          <Pressable
            style={styles.timerStopBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              hapticSuccess();
              setClockedInJobId(null);
              setClockInStartTime(null);
              setTimerDisplay('00:00:00');
            }}
          >
            <Ionicons name="stop" size={14} color={Palette.white} />
            <Text style={styles.timerStopText}>Stop</Text>
          </Pressable>
        </Pressable>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />
        }
      >
        {/* KPI Header */}
        <FadeIn delay={0} duration={400}>
        <ContractorDashboardHeader
          kpis={[
            { icon: 'calendar', value: String(todayJobs.length), label: t('dashboard.appointments', 'Afspraken'), color: Palette.hermesOrange, onPress: () => router.push('/contractor/drag-schedule' as any) },
            { icon: 'wallet', value: <CountUp to={dailyEarnings} prefix={'\u20AC'} duration={800} style={{ fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: SemanticColors.feedbackSuccess }} />, label: t('dashboard.earned', 'Verdiend'), color: SemanticColors.feedbackSuccess, onPress: () => router.push('/(contractor)/geld' as any) },
            { icon: 'briefcase', value: String(lifecycleCounts.ingepland + lifecycleCounts.bezig), label: t('dashboard.activeJobs', 'Actief'), color: Palette.hermesOrange, onPress: () => router.push('/(contractor)/werk' as any) },
          ]}
        />
        </FadeIn>

        {/* Vasco Card — ONE unified AI section */}
        <FadeIn delay={60}>
          <VascoCard
            briefing={briefing}
            queueItems={aiQueue.items}
            topInsight={activeGuidance.length > 0 ? activeGuidance[0] : null}
            automationsCount={pendingAutomations}
            onApproveQueueItem={async (id) => {
              hapticSuccess();
              const item = aiQueue.items.find(i => i.id === id);
              if (item?.type === 'draft_invoice' && item.preparedData?.jobId) {
                try { await addInvoiceFromJob(item.preparedData.jobId); } catch {}
              }
              aiQueue.approve(id);
            }}
            onRejectQueueItem={(id) => aiQueue.reject(id)}
            onInsightAction={handleGuidanceAction}
            overdueInvoices={overdueCount}
            onOverduePress={async () => {
              hapticSuccess();
              const msg = `Beste klant,\n\nHierbij een vriendelijke herinnering voor ${overdueCount} openstaande factuur${overdueCount > 1 ? 'en' : ''}.\n\nMet vriendelijke groet`;
              try {
                const { Share, Platform } = require('react-native');
                if (Platform.OS === 'web') {
                  await navigator.clipboard.writeText(msg);
                  alert('Herinnering gekopieerd naar klembord');
                } else {
                  await Share.share({ message: msg, title: 'Betaalherinnering' });
                }
              } catch {}
            }}
          />
        </FadeIn>

        {/* First job banner for new users */}
        {pipelineCount === 0 && todayJobs.length === 0 && (
          <FadeIn delay={200} duration={500}>
            <Pressable
              style={({ pressed }) => [styles.firstJobBanner, pressed && { transform: [{ scale: 0.98 }] }]}
              onPress={() => router.push('/contractor/pipeline' as any)}
            >
              <View style={styles.firstJobIcon}>
                <Ionicons name="rocket" size={24} color={Palette.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.firstJobTitle}>{t('jobs.newJob', 'Eerste klus aanmaken')}</Text>
                <Text style={styles.firstJobDesc}>{t('dashboard.startPlanning', 'Begin met het plannen van je werk')}</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={Palette.hermesOrange} />
            </Pressable>
          </FadeIn>
        )}

        {/* Action Required — now inside VascoCard above */}

        {/* Today's Schedule - Time Grouped */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>{t('dashboard.schedule', 'Planning')}</Text>
            </View>
            <Text style={styles.sectionCount}>{t('dashboard.appointmentCount', { count: todayJobs.length, defaultValue: `${todayJobs.length} afspraken` })}</Text>
          </View>
          {todayJobs.length === 0 ? (
            <View style={styles.emptyJobs}>
              <Ionicons name="calendar-outline" size={32} color={SemanticColors.textDisabled} />
              <Text style={styles.emptyJobsText}>{t('dashboard.noJobsToday', 'Geen afspraken vandaag')}</Text>
              <Text style={styles.emptyJobsSubtext}>{t('dashboard.enjoyFreeDay', 'Geniet van je vrije dag!')}</Text>
            </View>
          ) : (
            <View style={styles.jobsList}>
              {/* All jobs — no morning/afternoon split */}
              {todayJobs.map((job) => (
                  <View key={job.id}>
                    <JobCard
                      job={job}
                      onPress={() => {
                        hapticSuccess();
                        router.push(`/contractor/job/${job.id}` as any);
                      }}
                      onClockIn={() => {
                        hapticSuccess();
                        setClockedInJobId(job.id);
                        setClockInStartTime(Date.now());
                      }}
                    />
                    {nextJobCountdown && nextJobCountdown.jobId === job.id && (
                      <View style={styles.countdownChip}>
                        <Ionicons name="time-outline" size={12} color={Palette.hermesOrange} />
                        <Text style={styles.countdownText}>
                          Over {nextJobCountdown.minutes < 60
                            ? `${nextJobCountdown.minutes} min`
                            : `${Math.floor(nextJobCountdown.minutes / 60)}u ${nextJobCountdown.minutes % 60}m`}
                        </Text>
                      </View>
                    )}
                  </View>
                ))
              }
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
    backgroundColor: PAGE_BG,
  },
  greeting: {
    fontSize: 28,
    fontFamily: 'Manrope_800ExtraBold',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.8,
  },
  date: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    position: 'relative' as const,
  },
  notifBadge: {
    position: 'absolute' as const,
    top: 2,
    right: 2,
    backgroundColor: SemanticColors.feedbackError,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Palette.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SafeArea.content,
    paddingVertical: Spacing.lg,
    gap: 0,
  },

  // Invoice CTA — core flow: complete → invoice → paid
  invoiceCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  invoiceCtaIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center', justifyContent: 'center',
  },
  invoiceCtaTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  invoiceCtaDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },

  // Time Saved Card
  timeSavedCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
    marginBottom: 24,
  },
  timeSavedIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Palette.hermesOrange + '10',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  timeSavedTitle: { fontSize: 15, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary },
  timeSavedDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary, marginTop: 2 },
  automationBadge: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 6,
  },
  automationBadgeText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: '#FFF',
  },
  automationList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    marginTop: 4,
    overflow: 'hidden' as const,
  },
  automationItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderDefault,
  },
  automationItemTitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary,
  },
  automationItemDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },

  // Section
  section: {
    gap: Spacing.sm,
    marginBottom: 20,
  },
  sectionBlock: {
    backgroundColor: SemanticColors.surfacePrimary,
    marginBottom: 8,
    paddingHorizontal: SafeArea.content || 20,
    paddingVertical: 16,
    borderRadius: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    marginTop: 12,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sectionCount: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textTertiary,
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden' as const,
  },

  // First Job Banner — Wolt-style clean card
  firstJobBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
  },
  firstJobIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.hermesOrange + '10',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  firstJobTitle: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.textPrimary,
  },
  firstJobDesc: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Action Required
  actionSection: {
    gap: 10,
    marginTop: 8,
  },
  actionSectionTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.feedbackError,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  actionCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: SemanticColors.textPrimary,
  },
  actionCardDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Jobs List — Wolt-style flat cards
  jobsList: {
    gap: 12,
  },
  jobCard: {
    flexDirection: 'row' as const,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  jobAccent: {
    width: 3,
  },
  jobCardContent: {
    flex: 1,
    padding: 16,
    gap: 6,
  },
  jobCardHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  jobTimeContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  jobTime: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: SemanticColors.textSecondary,
    fontVariant: ['tabular-nums'] as any,
  },
  jobTimeActive: {
    color: Palette.hermesOrange,
  },
  jobDurationChip: {
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  jobDuration: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    fontWeight: '600' as const,
  },
  jobLifecycleTag: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
  },
  jobActiveText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Palette.hermesOrange,
    letterSpacing: 0.5,
  },
  jobTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  jobCustomer: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textSecondary,
  },
  jobCardFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 4,
  },
  jobAddress: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    flex: 1,
  },
  clockInBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 8,
  },
  clockInBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Palette.white,
  },
  jobAddressText: {
    fontSize: 12,
    color: SemanticColors.textDisabled,
    flex: 1,
  },
  emptyJobs: {
    alignItems: 'center' as const,
    padding: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    gap: Spacing.sm,
  },
  emptyJobsText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textSecondary,
  },
  emptyJobsSubtext: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textTertiary,
  },

  // Timer Strip
  timerStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Palette.hermesOrange,
    marginHorizontal: SafeArea.side,
    marginBottom: 4,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  timerPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  timerJobName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Palette.white,
  },
  timerClock: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Palette.white,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: 0.5,
  },
  timerStopBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  timerStopText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Palette.white,
  },

  // Time Group Headers
  timeGroupHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  timeGroupTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textSecondary,
    flex: 1,
  },
  timeGroupChip: {
    backgroundColor: Palette.hermesOrange + '12',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  timeGroupCount: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Palette.hermesOrange,
    fontVariant: ['tabular-nums'] as any,
  },
  noJobsText: {
    fontSize: 13,
    color: SemanticColors.textDisabled,
    fontStyle: 'italic' as const,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },

  // Countdown Chip
  countdownChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    alignSelf: 'flex-start' as const,
    backgroundColor: Palette.hermesOrange + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Palette.hermesOrange,
    fontVariant: ['tabular-nums'] as any,
  },

  // Accounting Loop Pipeline
  loopPipeline: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: 12,
    marginBottom: 4,
  },
  loopStage: {
    alignItems: 'center' as const,
    gap: 2,
  },
  loopStageCount: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
  },
  loopStageLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textTertiary,
    textAlign: 'center' as const,
  },

});
