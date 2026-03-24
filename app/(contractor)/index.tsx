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
import { PAGE_BG } from '../../src/theme/tabStyles';
import { useNotifications } from '../../src/services/notificationService';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { LoadingSkeleton } from '../../src/components/shared/LoadingSkeleton';
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
import { useAuth } from '../../src/context/AuthContext';
import { useAppState } from '../../src/state/AppState';
import { getAcceptanceStatus } from '../../src/services/customerQuoteAcceptanceService';

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
  const { jobs, invoices, quotes, customers, isLoading, addInvoiceFromJob, convertQuoteToJob } = useAppState();
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

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.goodMorning', 'Goedemorgen');
    if (hour < 18) return t('dashboard.goodAfternoon', 'Goedemiddag');
    return t('dashboard.goodEvening', 'Goedenavond');
  }, [t]);

  const formattedDate = new Date().toLocaleDateString(undefined, {
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
          <Text style={styles.greeting} numberOfLines={1}>{greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>
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
      {clockedInJob && timer.active && (
        <Pressable
          style={styles.timerStrip}
          onPress={() => router.push(`/contractor/job/${clockedInJobId}` as any)}
          accessibilityLabel={t('a11y.clockInTimer', 'Clock-in timer, tap to view job')}
        >
          <View style={styles.timerPulse} />
          <Text style={styles.timerJobName} numberOfLines={1}>{clockedInJob.title}</Text>
          <Text style={styles.timerClock}>{timerDisplay}</Text>
          <Pressable
            style={styles.timerStopBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              hapticSuccess();
              timer.clockOut();
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

                // Material ordering — shareable order message
                case 'reorder_materials': {
                  const materialList = item.preparedData?.materialList || '';
                  const totalCost = item.preparedData?.totalCost ?? 0;
                  const orderMsg = `${t('vasco.materialOrder', 'Material Order')}\n\n${materialList}\n\n${t('vasco.total', 'Total')}: €${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                  Alert.alert(
                    item.title || t('vasco.orderMaterials', 'Order materials'),
                    orderMsg,
                    [
                      {
                        text: t('vasco.sendToSupplier', 'Send to supplier'),
                        onPress: async () => {
                          try {
                            await Share.share({ message: orderMsg, title: t('vasco.materialOrder', 'Material Order') });
                            aiQueue.approve(id);
                            hapticSuccess();
                          } catch {}
                        },
                      },
                      { text: t('vasco.viewPO', 'View PO screen'), onPress: () => router.push('/contractor/purchase-orders' as any) },
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

                // Tax prep — generate and share period-end summary
                case 'tax_prep': {
                  const pkg = generatePeriodEndPackage({
                    invoices, jobs, quotes,
                    country: user?.country || 'NL',
                    quarter: item.preparedData?.quarter,
                  });
                  const exportText = formatPeriodEndForExport(pkg);
                  try {
                    await Share.share({ message: exportText, title: `${pkg.quarter} Finance Summary` });
                  } catch {}
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

                // Accounting export — generate CSV summary and share
                case 'accounting_export': {
                  const exportIds = item.preparedData?.invoiceIds || [];
                  const exportInvoices = invoices.filter((inv: any) => exportIds.includes(inv.id));
                  const csvLines = ['Invoice ID,Customer,Amount,Status,Date'];
                  for (const inv of exportInvoices) {
                    csvLines.push(`${inv.id},${inv.customer || ''},${inv.amount || 0},${inv.status},${inv.createdAt || ''}`);
                  }
                  const csvText = csvLines.join('\n');
                  try {
                    await Share.share({ message: csvText, title: t('automation.accountingExport', { defaultValue: 'Accounting Export' }) });
                  } catch {}
                  break;
                }

                // E-invoice submission — navigate to invoices with format context
                case 'einvoice_submit':
                  router.push('/(contractor)/facturen' as any);
                  break;

                // Shareable types (progress_note, draft_reminder, draft_followup,
                // quote_expiry, satisfaction_survey, decision_reminder) are handled
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
