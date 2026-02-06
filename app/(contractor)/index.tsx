// =============================================================================
// VANDAAG - Contractor Command Center
// =============================================================================
// Clean, focused daily dashboard:
// - KPI header strip
// - Vasco AI insights (critical/high only, max 2)
// - Audit findings banners
// - Today's schedule
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
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
import { Spacing } from '../../src/theme/spacing';
// Core services
import { useDaySchedule } from '../../src/services/smartSchedulerService';
import { useCashFlow } from '../../src/services/cashFlowService';

// AI services
import { useAuditFindings } from '../../src/services/auditorService';
import { useSavingsAggregation } from '../../src/services/savingsAggregatorService';
import { useLaborCosts } from '../../src/services/laborCostService';

// Vasco Guidance
import { useVascoGuidance } from '../../src/services/vascoGuidanceService';
import { VascoInsightList } from '../../src/components/shared/VascoInsightCard';
import type { VascoInsight } from '../../src/components/shared/VascoInsightCard';

// Dashboard Header
import { ContractorDashboardHeader } from '../../src/components/contractor/ContractorDashboardHeader';

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
}

// ============================================
// COMPONENTS
// ============================================

function JobCard({ job, onPress }: { job: JobItem; onPress: () => void }) {
  return (
    <Pressable style={styles.jobCard} onPress={onPress}>
      <View style={styles.jobCardHeader}>
        <View style={styles.jobTimeContainer}>
          <Text style={[
            styles.jobTime,
            job.status === 'active' && styles.jobTimeActive
          ]}>
            {job.time}
          </Text>
          <Text style={styles.jobDuration}>{job.duration}</Text>
        </View>
        {job.status === 'active' && (
          <View style={styles.jobActiveTag}>
            <View style={styles.jobActiveDot} />
            <Text style={styles.jobActiveText}>ACTIEF</Text>
          </View>
        )}
        {job.status === 'completed' && (
          <View style={styles.jobCompletedTag}>
            <Ionicons name="checkmark" size={12} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.jobCompletedText}>KLAAR</Text>
          </View>
        )}
      </View>
      <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
      <Text style={styles.jobCustomer} numberOfLines={1}>{job.customer}</Text>
      <View style={styles.jobAddress}>
        <Ionicons name="location-outline" size={12} color={SemanticColors.textTertiary} />
        <Text style={styles.jobAddressText} numberOfLines={1}>{job.address}</Text>
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
      <View style={styles.auditBannerIcon}>
        <Ionicons name="shield-checkmark" size={16} color={getSeverityColor()} />
      </View>
      <View style={styles.auditBannerContent}>
        <Text style={styles.auditBannerTitle} numberOfLines={1}>{finding.title}</Text>
        <Text style={styles.auditBannerText} numberOfLines={1}>{finding.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
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

  // Get today's date
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Core services
  const daySchedule = useDaySchedule(today);
  const { summary: cashFlowSummary } = useCashFlow();

  // AI services
  const { findings: auditFindings } = useAuditFindings('contractor');
  const savings = useSavingsAggregation();
  const labor = useLaborCosts();

  // Vasco AI Guidance (critical/high only)
  const allGuidance = useVascoGuidance('contractor', 'today');
  const activeGuidance = useMemo(
    () => allGuidance
      .filter(g => !dismissedGuidance.has(g.id) && !snoozedGuidance.has(g.id))
      .filter(g => g.priority === 'critical' || g.priority === 'high'),
    [allGuidance, dismissedGuidance, snoozedGuidance]
  );

  // Build today's jobs list
  const todayJobs = useMemo((): JobItem[] => {
    return daySchedule.jobs.map(job => ({
      id: job.id,
      title: job.projectName,
      customer: job.customerName,
      address: job.address || 'Adres niet beschikbaar',
      time: new Date(job.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
      duration: `${Math.round((new Date(job.endTime).getTime() - new Date(job.startTime).getTime()) / 3600000)}u`,
      status: job.status === 'in_progress' ? 'active' : job.status === 'completed' ? 'completed' : 'upcoming',
    }));
  }, [daySchedule.jobs]);

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

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        <Pressable style={styles.profileButton} onPress={() => router.push('/profile' as any)}>
          <Ionicons name="person-circle-outline" size={32} color={SemanticColors.textPrimary} />
        </Pressable>
      </View>

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
            { icon: 'receipt', value: `€${outstanding.toLocaleString('nl-NL')}`, label: 'Openstaand', onPress: () => router.push('/(contractor)/facturen') },
            { icon: 'trending-up', value: `€${savings.totalSavedThisMonth.toLocaleString('nl-NL')}`, label: 'Bespaard', color: SemanticColors.feedbackSuccess, onPress: () => router.push('/(contractor)/besparen') },
          ]}
        />

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

        {/* Today's Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vandaag</Text>
            <Text style={styles.sectionCount}>{todayJobs.length} afspraken</Text>
          </View>
          {todayJobs.length === 0 ? (
            <View style={styles.emptyJobs}>
              <Ionicons name="calendar-outline" size={32} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyJobsText}>Geen afspraken vandaag</Text>
              <Text style={styles.emptyJobsSubtext}>Geniet van je vrije dag!</Text>
            </View>
          ) : (
            <View style={styles.jobsList}>
              {todayJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onPress={() => router.push(`/contractor/job/${job.id}` as any)}
                />
              ))}
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
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.sm,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  date: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Audit Banner
  findingsSection: {
    gap: Spacing.xs,
  },
  auditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderLeftWidth: 3,
    gap: Spacing.sm,
  },
  auditBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: SemanticColors.feedbackWarningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditBannerContent: {
    flex: 1,
  },
  auditBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  auditBannerText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Jobs List
  jobsList: {
    gap: Spacing.sm,
  },
  jobCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 4,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  jobTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jobTime: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
  },
  jobTimeActive: {
    color: SemanticColors.feedbackSuccess,
  },
  jobDuration: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  jobActiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  jobActiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
    letterSpacing: 0.5,
  },
  jobCompletedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobCompletedText: {
    fontSize: 10,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
    letterSpacing: 0.5,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  jobCustomer: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  jobAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  jobAddressText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    flex: 1,
  },
  emptyJobs: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.xs,
  },
  emptyJobsText: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  emptyJobsSubtext: {
    fontSize: 13,
    color: SemanticColors.textTertiary,
  },
});
