// =============================================================================
// VANDAAG - Contractor Command Center
// =============================================================================
// Clean white canvas. Orange used only as thin section dividers and small
// accent touches to create visual rhythm between content blocks.
// =============================================================================

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
// Core services
import { useDaySchedule, useJobLifecyclePipeline, LIFECYCLE_COLORS, LIFECYCLE_LABELS } from '../../src/services/smartSchedulerService';
import type { JobLifecycleStatus } from '../../src/services/smartSchedulerService';
import { useCashFlow } from '../../src/services/cashFlowService';

// AI services
import { useAuditFindings } from '../../src/services/auditorService';
import { useSavingsAggregation } from '../../src/services/savingsAggregatorService';
import { useLaborCosts } from '../../src/services/laborCostService';
import { useJobCostSummary } from '../../src/services/jobCostTrackingService';

// Vasco Guidance + Learning
import { useVascoGuidance } from '../../src/services/vascoGuidanceService';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { VascoInsightList } from '../../src/components/shared/VascoInsightCard';
import type { VascoInsight } from '../../src/components/shared/VascoInsightCard';

// Dashboard Header
import { ContractorDashboardHeader } from '../../src/components/contractor/ContractorDashboardHeader';
import { hapticSuccess, hapticWarning } from '../../src/utils/haptics';

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

function JobCard({ job, onPress }: { job: JobItem; onPress: () => void }) {
  return (
    <Pressable style={styles.jobCard} onPress={onPress}>
      <View style={[styles.jobAccent, {
        backgroundColor: job.status === 'active' ? Palette.hermesOrange
          : job.status === 'completed' ? '#16A34A'
          : '#E8E4DF',
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
        <View style={styles.jobAddress}>
          <Ionicons name="location-outline" size={12} color="#C4C0BB" />
          <Text style={styles.jobAddressText} numberOfLines={1}>{job.address}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function AuditFindingBanner({ finding, onPress }: { finding: any; onPress: () => void }) {
  const getSeverityColor = () => {
    switch (finding.severity) {
      case 'critical': return SemanticColors.feedbackError;
      case 'high': return SemanticColors.feedbackWarning;
      default: return Palette.hermesOrange;
    }
  };

  return (
    <Pressable style={[styles.auditBanner, { borderLeftColor: getSeverityColor() }]} onPress={onPress}>
      <View style={[styles.auditBannerIcon, { backgroundColor: getSeverityColor() + '10' }]}>
        <Ionicons name="shield-checkmark" size={16} color={getSeverityColor()} />
      </View>
      <View style={styles.auditBannerContent}>
        <Text style={styles.auditBannerTitle} numberOfLines={1}>{finding.title}</Text>
        <Text style={styles.auditBannerText} numberOfLines={1}>{finding.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#C4C0BB" />
    </Pressable>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function TodayScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedGuidance, setDismissedGuidance] = useState<Set<string>>(new Set());
  const [snoozedGuidance, setSnoozedGuidance] = useState<Set<string>>(new Set());

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
  const { summary: cashFlowSummary } = useCashFlow();

  // AI services
  const { findings: auditFindings } = useAuditFindings('contractor');
  const savings = useSavingsAggregation();
  const labor = useLaborCosts();

  // Job Lifecycle Pipeline (P1)
  const { counts: lifecycleCounts } = useJobLifecyclePipeline();
  const pipelineCount = lifecycleCounts.lead + lifecycleCounts.offerte + lifecycleCounts.geaccepteerd;

  // Cost tracking (P2)
  const costSummary = useJobCostSummary();

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
  const morningJobs = useMemo(() => todayJobs.filter(j => j.startHour < 12), [todayJobs]);
  const afternoonJobs = useMemo(() => todayJobs.filter(j => j.startHour >= 12), [todayJobs]);

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

  // Critical findings
  const criticalFindings = useMemo(() => {
    return auditFindings.filter(f =>
      (f.severity === 'critical' || f.severity === 'high') &&
      f.status === 'new'
    ).slice(0, 2);
  }, [auditFindings]);

  // KPI data
  const outstanding = cashFlowSummary.pendingIncome;

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Goedemorgen';
    if (hour < 18) return 'Goedemiddag';
    return 'Goedenavond';
  }, []);

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, Mark</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        <Pressable style={styles.profileButton} onPress={() => router.push('/contractor/profile' as any)}>
          <Ionicons name="person" size={22} color={Palette.hermesOrange} />
        </Pressable>
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
            <Ionicons name="stop" size={14} color="#fff" />
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
        <ContractorDashboardHeader
          kpis={[
            { icon: 'calendar', value: String(todayJobs.length), label: 'Afspraken', color: Palette.hermesOrange },
            { icon: 'wallet', value: `\u20AC${dailyEarnings.toLocaleString('nl-NL')}`, label: 'Verdiend', color: '#16A34A' },
            { icon: 'git-branch', value: String(pipelineCount), label: 'Pipeline', color: '#8B5CF6', onPress: () => router.push('/(contractor)/facturen') },
          ]}
        />

        {/* — dark orange divider — */}
        <View style={styles.dividerDark} />

        {/* Vasco AI Guidance (critical/high, max 2) */}
        <VascoInsightList
          insights={activeGuidance}
          title="Vasco voor jou"
          maxVisible={2}
          compact
          onDismiss={handleDismissGuidance}
          onAction={handleGuidanceAction}
          onSnooze={handleSnoozeGuidance}
        />

        {/* Marge vandaag (P2) */}
        {costSummary.totalMarginLeakage !== 0 && (
          <Pressable
            style={styles.marginBanner}
            onPress={() => router.push('/(contractor)/besparen')}
          >
            <View style={[styles.marginBannerIcon, {
              backgroundColor: costSummary.totalMarginLeakage > 0 ? '#DC262614' : '#16A34A14',
            }]}>
              <Ionicons
                name={costSummary.totalMarginLeakage > 0 ? 'trending-down' : 'trending-up'}
                size={16}
                color={costSummary.totalMarginLeakage > 0 ? '#DC2626' : '#16A34A'}
              />
            </View>
            <Text style={styles.marginBannerText}>
              Marge: {costSummary.totalMarginLeakage > 0 ? '-' : '+'}
              {'\u20AC'}{Math.abs(costSummary.totalMarginLeakage).toLocaleString('nl-NL')} deze maand
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#C4C0BB" />
          </Pressable>
        )}

        {/* Audit Findings */}
        {criticalFindings.length > 0 && (
          <View style={styles.findingsSection}>
            {criticalFindings.map(finding => (
              <AuditFindingBanner
                key={finding.id}
                finding={finding}
                onPress={() => router.push('/(contractor)/facturen')}
              />
            ))}
          </View>
        )}

        {/* — light orange divider — */}
        <View style={styles.dividerLight} />

        {/* Today's Schedule - Time Grouped */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>Planning</Text>
            </View>
            <Text style={styles.sectionCount}>{todayJobs.length} afspraken</Text>
          </View>
          {todayJobs.length === 0 ? (
            <View style={styles.emptyJobs}>
              <Ionicons name="calendar-outline" size={32} color="#C4C0BB" />
              <Text style={styles.emptyJobsText}>Geen afspraken vandaag</Text>
              <Text style={styles.emptyJobsSubtext}>Geniet van je vrije dag!</Text>
            </View>
          ) : (
            <View style={styles.jobsList}>
              {/* Ochtend section */}
              <View style={styles.timeGroupHeader}>
                <Ionicons name="sunny-outline" size={14} color={Palette.hermesOrange} />
                <Text style={styles.timeGroupTitle}>Ochtend</Text>
                <View style={styles.timeGroupChip}>
                  <Text style={styles.timeGroupCount}>{morningJobs.length}</Text>
                </View>
              </View>
              {morningJobs.length === 0 ? (
                <Text style={styles.noJobsText}>Geen afspraken</Text>
              ) : (
                morningJobs.map((job) => (
                  <View key={job.id}>
                    <JobCard
                      job={job}
                      onPress={() => {
                        hapticSuccess();
                        router.push(`/contractor/job/${job.id}` as any);
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
              )}

              {/* Middag section */}
              <View style={[styles.timeGroupHeader, { marginTop: 16 }]}>
                <Ionicons name="partly-sunny-outline" size={14} color={Palette.hermesOrange} />
                <Text style={styles.timeGroupTitle}>Middag</Text>
                <View style={styles.timeGroupChip}>
                  <Text style={styles.timeGroupCount}>{afternoonJobs.length}</Text>
                </View>
              </View>
              {afternoonJobs.length === 0 ? (
                <Text style={styles.noJobsText}>Geen afspraken</Text>
              ) : (
                afternoonJobs.map((job) => (
                  <View key={job.id}>
                    <JobCard
                      job={job}
                      onPress={() => {
                        hapticSuccess();
                        router.push(`/contractor/job/${job.id}` as any);
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
              )}
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
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
    backgroundColor: '#FAFAF8',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  date: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
    fontWeight: '500',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange + '0A',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SafeArea.content,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },

  // Section dividers — the only place orange appears as a surface
  dividerDark: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Palette.hermesOrange,
    marginHorizontal: Spacing.sm,
  },
  dividerLight: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Palette.pastelOrange,
    marginHorizontal: Spacing.sm,
  },

  // Section
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
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
    fontSize: 13,
    fontWeight: '700',
    color: Palette.hermesOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.hermesOrange,
    fontVariant: ['tabular-nums'] as any,
  },

  // Audit Banner
  findingsSection: {
    gap: Spacing.xs,
  },
  auditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderLeftWidth: 3,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  auditBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditBannerContent: {
    flex: 1,
  },
  auditBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  auditBannerText: {
    fontSize: 12,
    color: '#999',
  },

  // Jobs List
  jobsList: {
    gap: 10,
  },
  jobCard: {
    flexDirection: 'row' as const,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  jobAccent: {
    width: 4,
  },
  jobCardContent: {
    flex: 1,
    padding: 14,
    gap: 4,
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
    color: '#555',
    fontVariant: ['tabular-nums'] as any,
  },
  jobTimeActive: {
    color: Palette.hermesOrange,
  },
  jobDurationChip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  jobDuration: {
    fontSize: 12,
    color: '#999',
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
  jobActiveTag: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Palette.hermesOrange + '10',
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
  jobCompletedTag: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: '#16A34A14',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobCompletedText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1A1A1A',
  },
  jobCustomer: {
    fontSize: 13,
    color: '#777',
  },
  jobAddress: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 4,
  },
  jobAddressText: {
    fontSize: 12,
    color: '#BBB',
    flex: 1,
  },
  emptyJobs: {
    alignItems: 'center' as const,
    padding: Spacing.xl,
    backgroundColor: '#fff',
    borderRadius: 14,
    gap: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyJobsText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#777',
  },
  emptyJobsSubtext: {
    fontSize: 13,
    color: '#BBB',
  },

  // Margin Banner (P2)
  marginBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  marginBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  marginBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1A1A1A',
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
    backgroundColor: '#fff',
  },
  timerJobName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  timerClock: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#fff',
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
    color: '#fff',
  },

  // Time Group Headers
  timeGroupHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  timeGroupTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
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
    color: '#CCC',
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

});
