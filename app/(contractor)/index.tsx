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
  Share,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { useNotifications } from '../../src/services/notificationService';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { SkeletonList } from '../../src/components/shared/SkeletonList';
import { getActionStats } from '../../src/intelligence/actionExecutor';
import { useAIQueue, populateQueue } from '../../src/services/aiActionQueueService';
import { evaluateTriggers } from '../../src/services/workflowPackService';
import { generatePeriodEndPackage, formatPeriodEndForExport } from '../../src/services/periodEndFinanceService';
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
import { useAutomations, runAllAutomations, getAutomationConfig } from '../../src/services/automationService';
import { shouldSync, syncAccountingData } from '../../src/services/accountingSyncService';
import { getAccountingConfig, exportInvoice as exportInvoiceToAccounting } from '../../src/integrations/accounting';
import type { UnifiedInvoice } from '../../src/integrations/accounting';
import { generateXRechnungXML } from '../../src/integrations/einvoice';
import { generateFacturXXml } from '../../src/integrations/einvoice-fr';
import { generateFacturaeXml } from '../../src/integrations/einvoice-es';
import { generateFatturaPAXml } from '../../src/integrations/einvoice-it';
import type { AutomationContext } from '../../src/services/automationService';

// Vasco Guidance + Learning
import { useVascoGuidance } from '../../src/services/vascoGuidanceService';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { VascoInsightList } from '../../src/components/shared/VascoInsightCard';
import type { VascoInsight } from '../../src/components/shared/VascoInsightCard';

// Dashboard Header
import { ContractorDashboardHeader } from '../../src/components/contractor/ContractorDashboardHeader';
import { hapticSuccess, hapticWarning } from '../../src/utils/haptics';
import { useClockIn } from '../../src/services/clockInService';
import { MS_PER_DAY, MS_PER_HOUR } from '../../src/utils/timeConstants';
import { getCohortBenchmark } from '../../src/intelligence/cloudSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import { useAppState } from '../../src/state/AppState';
import { getAcceptanceStatus } from '../../src/services/customerQuoteAcceptanceService';
import { getProgress, getNextStep, isFullyOnboarded } from '../../src/services/onboardingTrackerService';
import { getTemplateForAction, resolveTemplate, type TemplateContext } from '../../src/services/messageTemplateService';
import { formatAmount } from '../../src/utils/formatAmount';
import { getWeatherForecast } from '../../src/services/weatherService';

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
    <Pressable style={({ pressed }) => [styles.jobCard, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${job.title}, ${job.customer}, ${job.time}`} accessibilityHint="Opens job details">
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
              accessibilityRole="button"
              accessibilityLabel="Start clock for this job"
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
  const { jobs, invoices, quotes, customers, isLoading, addInvoiceFromJob, convertQuoteToJob, updateInvoice, updateJob } = useAppState();
  const [actionStats, setActionStats] = useState<{ total: number; successful: number; positiveOutcomes: number } | null>(null);
  useEffect(() => { getActionStats().then(setActionStats).catch(() => {}); }, []);
  // Fetch weather on app open (populates module-level cache for weatherScheduleGenerator)
  useEffect(() => { getWeatherForecast(user?.country || 'NL').catch(() => {}); }, []);
  const aiQueue = useAIQueue();
  const [briefing, setBriefing] = useState<MorningBriefing | null>(null);
  // Generate morning briefing + populate AI queue
  useEffect(() => {
    getMorningBriefing().then(b => {
      if (b) setBriefing(b);
      else generateMorningBriefing({ invoices, quotes, jobs }).then(setBriefing).catch(() => {});
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length, invoices.length, quotes.length]); // Re-generate when data count changes
  useEffect(() => {
    try {
      const completedJobs = jobs.filter((j: any) => j.status === 'completed');
      const overdueInvoices = invoices.filter((i: any) => i.status === 'overdue');
      const sentQuotes = quotes.filter((q: any) => q.status === 'sent');
      populateQueue({
        completedJobs, overdueInvoices, sentQuotes, expiringCerts: [],
        allJobs: jobs, allInvoices: invoices, allQuotes: quotes, customers,
        country: user?.country || 'NL',
      })
        .then(() => evaluateTriggers({ invoices, quotes, jobs, customers }))
        .then(() => aiQueue.refresh())
        .catch(() => {});
    } catch {}
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

  // Run automations on mount (invoice reminders, quote follow-ups, etc.)
  useEffect(() => {
    getAutomationConfig().then((config) => {
      runAllAutomations(automationCtx, config);
    }).catch(() => {});
  }, []);

  // Sync accounting data if connected and due (>1 hour since last sync)
  useEffect(() => {
    shouldSync().then(due => {
      if (due) syncAccountingData(invoices).catch(() => {});
    }).catch(() => {});
  }, []);

  // Unified clock-in timer — shared with Timesheet + Job Detail
  const timer = useClockIn();
  const clockedInJobId = timer.jobId;
  const timerDisplay = timer.timerDisplay;

  // Screen visit tracking
  useEffect(() => { recordScreenVisit('today'); }, []);

  // Check for accepted approval links → auto-convert to jobs
  useEffect(() => {
    (async () => {
      for (const quote of quotes) {
        if (quote.status === 'sent') {
          const acceptance = await getAcceptanceStatus(quote.id);
          if (acceptance?.status === 'accepted') {
            try {
              await convertQuoteToJob(quote.id);
            } catch {}
          }
        }
      }
    })().catch(() => {});
  }, [quotes.length]);

  // Get today's date
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Core services
  const daySchedule = useDaySchedule(today);
  const { summary: cashFlowSummary, invoices: cfInvoices } = useCashFlow();
  const overdueCount = useMemo(() => cfInvoices.filter(inv => inv.status === 'overdue').length, [cfInvoices]);

  // AI services
  const savings = useSavingsAggregation();
  const { user } = useAuth();

  // Onboarding progress
  const [onboardingDone, setOnboardingDone] = useState(true);
  const [nextStep, setNextStep] = useState<{ step: string; action: string; route: string } | null>(null);
  const [onboardingProgress, setOnboardingProgress] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    isFullyOnboarded().then(done => {
      setOnboardingDone(done);
      if (!done) {
        getProgress().then(p => setOnboardingProgress(p.percentage));
        getNextStep().then(s => setNextStep(s));
      }
    });
    // Show welcome card for fresh users (just completed onboarding, few jobs)
    AsyncStorage.getItem('@vasco_welcome_dismissed').then(val => {
      if (!val && jobs.length <= 1) {
        setShowWelcome(true);
      }
    }).catch(() => {});
  }, []);

  // Cohort benchmark (async, non-blocking)
  const [dsoBenchmark, setDsoBenchmark] = useState<{ median: number } | null>(null);
  useEffect(() => {
    getCohortBenchmark(user?.trade ?? 'general', user?.country ?? 'NL', 'dso')
      .then(setDsoBenchmark)
      .catch(() => {});
  }, [user?.trade, user?.country]);

  // Job Lifecycle Pipeline (P1)
  const { counts: lifecycleCounts } = useJobLifecyclePipeline();

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
        address: job.address || t('jobs.noAddress', 'Address not available'),
        time: start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        duration: `${Math.round((new Date(job.endTime).getTime() - start.getTime()) / MS_PER_HOUR)}u`,
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
    const fourHoursMs = 4 * MS_PER_HOUR;
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

  // Dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greeting.morning', 'Good morning');
    if (hour < 18) return t('greeting.afternoon', 'Good afternoon');
    return t('greeting.evening', 'Good evening');
  }, [t]);

  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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
        <View style={{ paddingTop: SafeArea.top + GRID.lg }}>
          <SkeletonList count={4} showAvatar lines={2} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header — flex constrained so greeting doesn't bleed into buttons */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/contractor/search' as any)} accessibilityRole="button" accessibilityLabel={t('a11y.search', 'Search')}>
            <Ionicons name="search" size={16} color={SemanticColors.textSecondary} />
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/contractor/notifications' as any)} accessibilityRole="button" accessibilityLabel={t('a11y.notifications', 'Notifications')}>
            <Ionicons name="notifications-outline" size={16} color={SemanticColors.textSecondary} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={() => router.push('/contractor/profile' as any)} accessibilityRole="button" accessibilityLabel={t('a11y.profile', 'Profile')}>
            <Ionicons name="person-circle-outline" size={16} color={SemanticColors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Clock-in Timer Strip */}
      {clockedInJob && timer.active && (
        <Pressable
          style={styles.timerStrip}
          onPress={() => router.push(`/contractor/job/${clockedInJobId}` as any)}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.clockInTimer', 'Clock-in timer, tap to view job')}
        >
          <View style={styles.timerPulse} />
          <Text style={styles.timerJobName} numberOfLines={1}>{clockedInJob.title}</Text>
          <Text style={styles.timerClock}>{timerDisplay}</Text>
          <Pressable
            style={styles.timerStopBtn}
            onPress={async (e) => {
              e.stopPropagation?.();
              hapticSuccess();
              const { hours, state: prevState } = await timer.clockOut();
              // Persist time entry to the job so hours aren't lost
              if (prevState.jobId && hours > 0) {
                const job = jobs.find((j: any) => j.id === prevState.jobId);
                if (job) {
                  const existingEntries = (job as any).timeEntries ?? [];
                  const now = new Date();
                  const outTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                  updateJob(prevState.jobId, {
                    timeEntries: [...existingEntries, {
                      id: `te-${Date.now()}`,
                      date: now.toISOString().slice(0, 10),
                      hours: Math.round(hours * 10) / 10,
                      clockIn: prevState.startTimeFormatted,
                      clockOut: outTime,
                    }] as any,
                  });
                }
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.stopTimer', 'Stop timer')}
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
              if (!item) { aiQueue.approve(id); return; }

              try {
              switch (item.type) {
                // Invoice creation
                case 'draft_invoice':
                  if (item.preparedData?.jobId) {
                    await addInvoiceFromJob(item.preparedData.jobId);
                    Alert.alert(t('vasco.invoiceCreated', 'Invoice created'), t('vasco.invoiceCreatedDesc', 'Review it in the Money tab.'));
                  }
                  break;

                // Batch invoices — create all at once
                case 'batch_invoices':
                  if (item.preparedData?.jobIds) {
                    let created = 0;
                    const errors: string[] = [];
                    for (const jobId of item.preparedData.jobIds) {
                      try {
                        await addInvoiceFromJob(jobId);
                        created++;
                      } catch (e: any) {
                        errors.push(e.message || jobId);
                      }
                    }
                    if (errors.length > 0) {
                      Alert.alert(
                        t('vasco.batchPartial', 'Batch partially completed'),
                        `${created} ${t('vasco.created', 'created')}, ${errors.length} ${t('vasco.failed', 'failed')}:\n${errors.join('\n')}`,
                      );
                    } else {
                      Alert.alert(t('vasco.batchComplete', 'All invoices created'), `${created} ${t('vasco.invoicesCreated', 'invoices created')}`);
                    }
                  }
                  break;

                // Invoice regeneration — create updated invoice with late fee
                case 'invoice_regenerate':
                  if (item.preparedData?.jobId) {
                    await addInvoiceFromJob(item.preparedData.jobId);
                  }
                  router.push('/(contractor)/facturen' as any);
                  break;

                // Permit check — show inline checklist
                case 'permit_check': {
                  const permits = item.preparedData?.permits ?? [];
                  const permitList = permits.map((p: any) => `• ${p.name || p.type || 'Permit'} — ${p.authority || 'Authority'}`).join('\n');
                  Alert.alert(
                    item.title || t('vasco.permitCheck', 'Permit requirements'),
                    permitList || t('vasco.noPermits', 'No specific permits identified.'),
                    [
                      { text: t('vasco.viewDetails', 'View details'), onPress: () => router.push('/(contractor)/certificaten' as any) },
                      { text: t('vasco.markChecked', 'Mark checked'), style: 'default', onPress: () => { aiQueue.approve(id); hapticSuccess(); } },
                    ],
                  );
                  return; // Don't auto-approve — user picks action
                }

                // Cert renewal — show cert info inline
                case 'cert_renewal': {
                  const certName = item.preparedData?.name || t('vasco.certificate', 'Certificate');
                  const expiryDate = item.preparedData?.expiryDate;
                  const daysLeft = expiryDate ? Math.ceil((new Date(expiryDate).getTime() - Date.now()) / MS_PER_DAY) : 0;
                  const renewalUrl = item.preparedData?.renewalUrl;
                  const certMsg = `${certName}\n${t('vasco.expiresIn', 'Expires in')} ${daysLeft} ${t('vasco.days', 'days')}${renewalUrl ? `\n\n${renewalUrl}` : ''}`;
                  Alert.alert(
                    item.title || t('vasco.certRenewal', 'Certificate renewal'),
                    certMsg,
                    [
                      ...(renewalUrl ? [{ text: t('vasco.openRenewal', 'Open renewal'), onPress: () => { Linking.openURL(renewalUrl).catch(() => {}); } }] : []),
                      { text: t('vasco.remindLater', 'Remind later'), style: 'cancel' as const },
                    ],
                  );
                  return; // Don't auto-approve — user picks action
                }

                case 'permit_renewal':
                case 'safety_checklist':
                  router.push('/(contractor)/certificaten' as any);
                  break;

                // Navigate to handover package
                case 'job_handover':
                  if (item.preparedData?.jobId) {
                    router.push(`/contractor/handover/${item.preparedData.jobId}` as any);
                  }
                  break;

                // Material ordering — create PO + share with supplier
                case 'reorder_materials': {
                  const materials = item.preparedData?.materials || [];
                  const jobTitle = item.preparedData?.jobTitle || item.title || '';
                  const supplierName = item.preparedData?.supplierName || t('vasco.supplier', 'Supplier');
                  const supplierId = item.preparedData?.supplierId || 'custom';

                  // Build line items from preparedData
                  const lineItems: Array<{ name: string; quantity: number; unitPrice: number; unit: string }> = [];
                  let totalCost = 0;

                  if (materials.length > 0) {
                    for (const mat of materials) {
                      const qty = mat.quantity ?? 1;
                      const price = mat.unitPrice ?? mat.price ?? 0;
                      lineItems.push({
                        name: mat.name || mat.description || 'Material',
                        quantity: qty,
                        unitPrice: price,
                        unit: mat.unit || 'stuk',
                      });
                      totalCost += qty * price;
                    }
                  } else {
                    // Fallback: parse from materialList string
                    totalCost = item.preparedData?.totalCost ?? 0;
                  }

                  // Build shareable order message
                  const materialLines = lineItems.length > 0
                    ? lineItems.map(li => `- ${li.quantity}x ${li.name} (€${li.unitPrice.toFixed(2)}/${li.unit})`).join('\n')
                    : (item.preparedData?.materialList || '');
                  const orderMsg = `${t('vasco.materialOrder', 'Material Order')}${jobTitle ? ` — ${jobTitle}` : ''}\n\n${materialLines}\n\n${t('vasco.total', 'Total')}: €${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n\n${t('vasco.confirmAvailability', 'Please confirm availability.')}`;

                  Alert.alert(
                    item.title || t('vasco.orderMaterials', 'Order materials'),
                    orderMsg,
                    [
                      {
                        text: t('vasco.createPOAndSend', 'Create PO & send'),
                        onPress: async () => {
                          try {
                            // Create PO via purchaseOrderService
                            const { purchaseOrderService } = await import('../../src/services/purchaseOrderService');
                            const poItems = lineItems.map(li => ({
                              description: li.name,
                              quantity: li.quantity,
                              unit: li.unit,
                              unitPrice: li.unitPrice,
                              jobId: item.preparedData?.jobId,
                            }));
                            const po = purchaseOrderService.createOrder(
                              supplierId,
                              supplierName,
                              poItems,
                              item.preparedData?.jobId,
                              jobTitle,
                              `Auto-created from EVE queue item ${item.id}`,
                            );

                            // Share with supplier via WhatsApp/email
                            await Share.share({
                              message: orderMsg,
                              title: `${t('vasco.materialOrder', 'Material Order')} ${po.poNumber}`,
                            });

                            // Mark queue item as approved
                            aiQueue.approve(id);
                            hapticSuccess();

                            Alert.alert(
                              t('vasco.poCreated', 'PO created'),
                              t('vasco.poCreatedDesc', {
                                defaultValue: '{{poNumber}} (€{{total}}) created and shared with {{supplier}}.',
                                poNumber: po.poNumber,
                                total: po.total.toFixed(2),
                                supplier: supplierName,
                              }),
                            );
                          } catch (e: any) {
                            Alert.alert(t('common.error', 'Error'), e?.message || t('vasco.actionFailed', 'Action failed'));
                          }
                        },
                      },
                      { text: t('vasco.viewPO', 'View PO screen'), onPress: () => router.push('/contractor/purchase-orders' as any) },
                      {
                        text: t('vasco.browseCatalog', 'Browse catalog'),
                        onPress: () => {
                          const firstMat = materials[0]?.name || materials[0]?.description || '';
                          router.push(firstMat
                            ? `/contractor/material-search?q=${encodeURIComponent(firstMat)}` as any
                            : '/contractor/material-search' as any);
                        },
                      },
                      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    ],
                  );
                  return; // Don't auto-approve — user picks action
                }

                // Navigate to supplier comparison / market prices
                case 'price_alert':
                case 'supplier_comparison':
                case 'bulk_purchase':
                  router.push('/contractor/market-prices' as any);
                  break;

                // Tax prep — generate period-end summary + CSV export
                case 'tax_prep': {
                  const pkg = generatePeriodEndPackage({
                    invoices, jobs, quotes,
                    country: user?.country || 'NL',
                    quarter: item.preparedData?.quarter,
                  });
                  // Determine quarter month names for display
                  const quarterNum = parseInt((pkg.quarter || '').replace(/Q(\d).*/, '$1'), 10) || 1;
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const startMonthIdx = (quarterNum - 1) * 3;
                  const periodLabel = `${pkg.quarter}: ${monthNames[startMonthIdx]}-${monthNames[startMonthIdx + 2]}`;
                  // Export CSV data via dataExportService
                  const { exportAllData: doExport } = await import('../../src/services/dataExportService');
                  const result = await doExport('csv', { userId: user?.id, email: user?.email });
                  if (result.success) {
                    Alert.alert(
                      t('automation.taxExportSuccess', { defaultValue: '{{period}} export complete', period: periodLabel }),
                      t('automation.taxExportDetail', {
                        defaultValue: '{{count}} invoices · €{{total}} total revenue exported for your accountant.',
                        count: pkg.revenue.invoiceCount,
                        total: pkg.revenue.totalInvoiced.toLocaleString(undefined, { maximumFractionDigits: 0 }),
                      }),
                    );
                  } else {
                    Alert.alert(t('common.error', 'Error'), result.error || t('vasco.actionFailed', 'Export failed'));
                    return; // Don't approve on failure
                  }
                  break;
                }

                // Navigate to schedule for suggestions
                case 'schedule_suggestion':
                  router.push('/contractor/drag-schedule' as any);
                  break;

                // Navigate to tiered quote builder
                case 'draft_quote':
                  router.push('/contractor/tiered-quote' as any);
                  break;

                // Maintenance — navigate to job creation for repeat work
                case 'maintenance_due':
                  router.push('/contractor/tiered-quote' as any);
                  break;

                // Accounting export — try accounting provider API, fallback to CSV share
                case 'accounting_export': {
                  const exportIds = item.preparedData?.invoiceIds || [];
                  const exportInvoices = invoices.filter((inv: any) => exportIds.includes(inv.id));
                  if (exportInvoices.length === 0) break;

                  const acctConfig = await getAccountingConfig();
                  if (acctConfig.connected && acctConfig.provider !== 'none') {
                    // Connected — export via accounting provider API
                    let exported = 0;
                    const errors: string[] = [];
                    for (const inv of exportInvoices) {
                      const unified: UnifiedInvoice = {
                        reference: inv.reference || inv.id,
                        invoiceDate: inv.createdAt || new Date().toISOString(),
                        dueDate: inv.dueDate || new Date(Date.now() + 14 * 86400000).toISOString(),
                        lineItems: [{ description: inv.job || 'Services', quantity: 1, unitPrice: inv.amount || 0, vatRate: 21, totalExclVat: inv.amount || 0 }],
                        currency: 'EUR',
                        status: inv.status as any,
                        totalExclVat: inv.amount || 0,
                        totalInclVat: (inv.amount || 0) * 1.21,
                      };
                      const result = await exportInvoiceToAccounting(unified);
                      if (result.success) {
                        exported++;
                        updateInvoice(inv.id, { exportedAt: new Date().toISOString() });
                      } else {
                        errors.push(`${inv.customer || inv.id}: ${result.error || 'failed'}`);
                      }
                    }
                    if (errors.length > 0) {
                      Alert.alert(
                        t('vasco.exportPartial', 'Export partially completed'),
                        `${exported} ${t('vasco.exported', 'exported')}, ${errors.length} ${t('vasco.failed', 'failed')}:\n${errors.join('\n')}`,
                      );
                    } else {
                      Alert.alert(
                        t('vasco.exportComplete', 'Export complete'),
                        t('vasco.exportedCount', { defaultValue: '{{count}} invoices exported to {{provider}}', count: exported, provider: acctConfig.provider }),
                      );
                    }
                  } else {
                    // Not connected — fallback to CSV share
                    const csvLines = ['Invoice ID,Customer,Amount,Status,Date'];
                    for (const inv of exportInvoices) {
                      csvLines.push(`${inv.id},${inv.customer || ''},${inv.amount || 0},${inv.status},${inv.createdAt || ''}`);
                    }
                    const csvText = csvLines.join('\n');
                    try {
                      await Share.share({ message: csvText, title: t('automation.accountingExport', { defaultValue: 'Accounting Export' }) });
                    } catch {}
                    // Mark as exported even for CSV share
                    for (const inv of exportInvoices) {
                      updateInvoice(inv.id, { exportedAt: new Date().toISOString() });
                    }
                  }
                  break;
                }

                // E-invoice submission — generate XML per country format and share
                case 'einvoice_submit': {
                  const einvFormat = item.preparedData?.format as string;
                  const einvInvoiceId = item.preparedData?.invoiceId as string;
                  const einvCountry = item.preparedData?.country as string;
                  const einvInvoice = invoices.find((inv: any) => inv.id === einvInvoiceId);
                  if (!einvInvoice) {
                    Alert.alert(t('common.error', 'Error'), t('vasco.invoiceNotFound', 'Invoice not found'));
                    return;
                  }

                  let xmlContent = '';
                  let xmlTitle = '';

                  try {
                    if (einvFormat === 'XRechnung' || einvCountry === 'DE') {
                      xmlContent = generateXRechnungXML({
                        sellerName: user?.name || 'Contractor',
                        sellerAddress: '',
                        sellerVatId: '',
                        buyerName: einvInvoice.customer || '',
                        buyerAddress: '',
                        invoiceNumber: einvInvoice.reference || einvInvoice.id,
                        invoiceDate: einvInvoice.createdAt || new Date().toISOString().split('T')[0],
                        dueDate: einvInvoice.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
                        currency: 'EUR',
                        lineItems: [{ description: einvInvoice.job || 'Services', quantity: 1, unitCode: 'C62', unitPrice: einvInvoice.amount || 0, vatRate: 19, vatAmount: (einvInvoice.amount || 0) * 0.19, lineTotal: einvInvoice.amount || 0 }],
                        totalNet: einvInvoice.amount || 0,
                        totalVat: (einvInvoice.amount || 0) * 0.19,
                        totalGross: (einvInvoice.amount || 0) * 1.19,
                      });
                      xmlTitle = `XRechnung_${einvInvoice.reference || einvInvoice.id}.xml`;
                    } else if (einvFormat === 'Factur-X' || einvFormat === 'FacturX' || einvCountry === 'FR') {
                      xmlContent = generateFacturXXml({
                        sellerName: user?.name || 'Contractor',
                        sellerAddress: '',
                        sellerCity: '',
                        sellerPostalCode: '',
                        sellerCountry: 'FR',
                        sellerVatId: '',
                        sellerSiret: '',
                        buyerName: einvInvoice.customer || '',
                        buyerAddress: '',
                        buyerCity: '',
                        buyerPostalCode: '',
                        buyerCountry: 'FR',
                        invoiceNumber: einvInvoice.reference || einvInvoice.id,
                        invoiceDate: einvInvoice.createdAt || new Date().toISOString().split('T')[0],
                        dueDate: einvInvoice.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
                        currency: 'EUR',
                        lineItems: [{ description: einvInvoice.job || 'Services', quantity: 1, unitCode: 'C62', unitPrice: einvInvoice.amount || 0, vatRate: 20, vatCategoryCode: 'S', vatAmount: (einvInvoice.amount || 0) * 0.20, lineTotal: einvInvoice.amount || 0 }],
                        totalNet: einvInvoice.amount || 0,
                        totalVat: (einvInvoice.amount || 0) * 0.20,
                        totalGross: (einvInvoice.amount || 0) * 1.20,
                      });
                      xmlTitle = `FacturX_${einvInvoice.reference || einvInvoice.id}.xml`;
                    } else if (einvFormat === 'Facturae' || einvCountry === 'ES') {
                      xmlContent = generateFacturaeXml({
                        sellerName: user?.name || 'Contractor',
                        sellerNif: '',
                        sellerAddress: '',
                        sellerCity: '',
                        sellerPostalCode: '',
                        sellerProvince: '',
                        sellerCountry: 'ESP',
                        sellerPersonType: 'F',
                        sellerRegimeFiscal: '01',
                        buyerName: einvInvoice.customer || '',
                        buyerNif: '',
                        buyerAddress: '',
                        buyerCity: '',
                        buyerPostalCode: '',
                        buyerProvince: '',
                        buyerCountry: 'ESP',
                        buyerPersonType: 'F',
                        invoiceNumber: einvInvoice.reference || einvInvoice.id,
                        invoiceDate: einvInvoice.createdAt || new Date().toISOString().split('T')[0],
                        dueDate: einvInvoice.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
                        currency: 'EUR',
                        lineItems: [{ description: einvInvoice.job || 'Services', quantity: 1, unitPrice: einvInvoice.amount || 0, lineTotal: einvInvoice.amount || 0, ivaRate: 21, ivaAmount: (einvInvoice.amount || 0) * 0.21 }],
                        totalNet: einvInvoice.amount || 0,
                        totalVat: (einvInvoice.amount || 0) * 0.21,
                        totalIrpf: 0,
                        totalGross: (einvInvoice.amount || 0) * 1.21,
                      });
                      xmlTitle = `Facturae_${einvInvoice.reference || einvInvoice.id}.xml`;
                    } else if (einvFormat === 'FatturaPA' || einvCountry === 'IT') {
                      // Italy: navigate to FatturaInCloud (SDI submission handled by provider)
                      Alert.alert(
                        t('vasco.fatturaPa', 'FatturaPA (SDI)'),
                        t('vasco.fatturaPaDesc', 'Italian e-invoices must be submitted via SDI. Open your Fatture in Cloud account to submit.'),
                        [
                          { text: t('vasco.openProvider', 'Open provider'), onPress: () => Linking.openURL('https://secure.fattureincloud.it/').catch(() => {}) },
                          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                        ],
                      );
                      return; // Don't auto-approve
                    }

                    if (xmlContent) {
                      await Share.share({ message: xmlContent, title: xmlTitle });
                      updateInvoice(einvInvoiceId, { einvoiceSubmitted: new Date().toISOString() });
                    }
                  } catch (xmlErr: any) {
                    Alert.alert(t('common.error', 'Error'), xmlErr.message || t('vasco.einvoiceFailed', 'Could not generate e-invoice'));
                    return; // Don't approve on error
                  }
                  break;
                }

                // draft_reminder / draft_followup — resolve message via template system
                case 'draft_reminder':
                case 'draft_followup': {
                  const tpl = await getTemplateForAction(item.type as 'draft_reminder' | 'draft_followup');
                  if (tpl) {
                    const tplCtx: TemplateContext = {
                      customer: item.preparedData?.customerName || item.title,
                      amount: item.preparedData?.amount ? `\u20AC${Number(item.preparedData.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '',
                      jobTitle: item.preparedData?.jobTitle || '',
                      invoiceId: item.preparedData?.invoiceId || '',
                      daysOverdue: item.preparedData?.daysOverdue,
                      contractorName: user?.name || 'Contractor',
                      date: new Date().toLocaleDateString(),
                    };
                    const resolved = resolveTemplate(tpl, tplCtx);
                    await Share.share({ message: resolved, title: tpl.title });
                  }
                  break;
                }

                // Other shareable types (progress_note, quote_expiry,
                // satisfaction_survey, decision_reminder) are handled
                // by VascoCard's EmbeddedApproval Share flow — no extra handler needed
              }
              } catch (err: any) {
                Alert.alert(
                  t('common.error', 'Error'),
                  err.message || t('vasco.actionFailed', 'Action could not be completed. Please try again.'),
                );
                return; // Don't approve if action failed
              }

              aiQueue.approve(id);
            }}
            onRejectQueueItem={(id) => aiQueue.reject(id)}
            onInsightAction={handleGuidanceAction}
          />
        </FadeIn>

        {/* Action Required — now inside VascoCard above */}

        {/* Today's Schedule + Active Jobs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>{t('dashboard.schedule', 'Planning')}</Text>
            </View>
            <Text style={styles.sectionCount}>{todayJobs.length > 0 ? t('dashboard.appointmentCount', { count: todayJobs.length, defaultValue: `${todayJobs.length} afspraken` }) : `${jobs.length} ${t('tabs.jobs', 'jobs')}`}</Text>
          </View>
          {todayJobs.length === 0 && jobs.length === 0 ? (
            <View style={styles.emptyJobs}>
              <Ionicons name="calendar-outline" size={32} color={SemanticColors.textDisabled} />
              <Text style={styles.emptyJobsText}>{t('dashboard.noJobsToday', 'No jobs today')}</Text>
              <Text style={styles.emptyJobsSubtext}>{t('dashboard.enjoyFreeDay', 'Enjoy your free day!')}</Text>
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
                        timer.clockIn(job.id, job.title);
                      }}
                    />
                    {nextJobCountdown && nextJobCountdown.jobId === job.id && (
                      <View style={styles.countdownChip}>
                        <Ionicons name="time-outline" size={12} color={Palette.hermesOrange} />
                        <Text style={styles.countdownText}>
                          {t('dashboard.inTime', {
                            defaultValue: 'Over {{time}}',
                            time: nextJobCountdown.minutes < 60
                              ? `${nextJobCountdown.minutes} min`
                              : `${Math.floor(nextJobCountdown.minutes / 60)}h ${nextJobCountdown.minutes % 60}m`,
                          })}
                        </Text>
                      </View>
                    )}
                  </View>
                ))
              }
            </View>
          )}

          {/* Fallback: show active jobs when scheduler returns empty */}
          {todayJobs.length === 0 && jobs.length > 0 && (
            <View style={styles.activeJobsList}>
              <Text style={styles.activeJobsLabel}>{t('dashboard.activeJobs', 'Active jobs')}</Text>
              {jobs.filter(j => !['completed', 'gereed', 'invoiced', 'paid', 'cancelled'].includes(j.status)).slice(0, 5).map(job => {
                const cust = customers.find(c => c.id === job.customerId);
                return (
                  <Pressable
                    key={job.id}
                    style={({ pressed }) => [styles.activeJobRow, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push(`/contractor/job/${job.id}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={`${job.title}, ${cust?.name || ''}, ${job.status}`}
                    accessibilityHint="Opens job details"
                  >
                    <View style={[styles.activeJobDot, job.status === 'in-progress' && { backgroundColor: SemanticColors.feedbackSuccess }, job.status === 'scheduled' && { backgroundColor: Palette.hermesOrange }, job.status === 'lead' && { backgroundColor: SemanticColors.textTertiary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeJobTitle} numberOfLines={1}>{job.title}</Text>
                      <Text style={styles.activeJobMeta}>{cust?.name || ''} · {job.status}{job.scheduledDate ? ` · ${job.scheduledDate}` : ''}</Text>
                    </View>
                    {job.quotedAmount ? <Text style={styles.activeJobAmount}>{formatAmount(job.quotedAmount)}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 140 }} />
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
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    paddingBottom: 100,
    gap: GRID.lg,
  },

  // Invoice CTA — core flow: complete → invoice → paid
  invoiceCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
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
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: GRID.lg,
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
    borderRadius: RADIUS.lg,
    marginTop: 4,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
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
    gap: GRID.sm,
    marginBottom: GRID.lg,
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

  // Onboarding progress reminder
  onboardingCard: {
    backgroundColor: Palette.hermesOrange + '08',
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: GRID.sm,
  },
  onboardingCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  onboardingPercent: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  onboardingTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  onboardingDesc: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
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

  // Active jobs fallback (when scheduler is empty but jobs exist)
  activeJobsList: { gap: GRID.xs, marginTop: GRID.sm },
  activeJobsLabel: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: GRID.xs },
  activeJobRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: GRID.md,
  },
  activeJobDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SemanticColors.textTertiary },
  activeJobTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  activeJobMeta: { fontSize: TYPE.tinySize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, marginTop: 1 },
  activeJobAmount: { fontSize: TYPE.captionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },

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

  // Welcome card
  welcomeCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
  },
  welcomeIconRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  welcomeIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '12',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  welcomeTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  welcomeDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    lineHeight: TYPE.captionSize * 1.5,
  },
  welcomeSteps: {
    gap: GRID.xs,
    marginTop: GRID.xs,
  },
  welcomeStep: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: GRID.sm,
    paddingVertical: GRID.sm,
    paddingHorizontal: GRID.sm,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: RADIUS.md,
  },
  welcomeStepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  welcomeStepText: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },

});
