// =============================================================================
// DIRECTOR DASHBOARD - Portfolio Overview & Strategic Decisions
// =============================================================================
// Executive portfolio dashboard for real estate development Directors
// Focus: Portfolio health, Approvals, Risk oversight, Platform ROI
// 4-tab navigation: Portfolio, Approvals, Risks, Performance
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import {
  mockProjects,
  mockAppraisals,
  mockDeliveryMetrics,
} from '../../data/mockProjects';
import { formatPercent } from '../../modules/countryModules';

/** Compact number formatting: 1.2M, 48K, 285K etc. */
function fmtCompact(amount: number, currency: 'GBP' | 'EUR' = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : '€';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const v = amount / 1_000_000;
    return `${symbol}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const v = amount / 1_000;
    return `${symbol}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(0)}K`;
  }
  return `${symbol}${amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}
import { useScheduleFragilityStats } from '../../services/scheduleFragilityService';
import { useSupplierReliabilityStats } from '../../services/supplierReliabilityService';

// Vasco Guidance
import { useVascoGuidance, useInlineInsight } from '../../services/vascoGuidanceService';
import { VascoInsightList, InlineInsight } from '../shared/VascoInsightCard';
import type { VascoInsight } from '../shared/VascoInsightCard';
import { recordScreenVisit } from '../../intelligence/learningStorage';
import { ContractorDashboardHeader } from '../contractor/ContractorDashboardHeader';

type IconName = keyof typeof Ionicons.glyphMap;
type TabView = 'portfolio' | 'approvals' | 'risks' | 'performance';

// Role color - matches theme roleDirector token (Hermes Orange)
const DIRECTOR_COLOR = '#E35205';

// =============================================================================
// TAB CONFIGURATION
// =============================================================================

interface TabConfig {
  id: TabView;
  label: string;
  icon: IconName;
}

const TABS: TabConfig[] = [
  { id: 'portfolio', label: 'Portfolio', icon: 'business' },
  { id: 'approvals', label: 'Approvals', icon: 'checkmark-done' },
  { id: 'risks', label: 'Risks', icon: 'warning' },
  { id: 'performance', label: 'Performance', icon: 'analytics' },
];

// =============================================================================
// MOCK DATA FOR APPROVALS
// =============================================================================

// =============================================================================
// MOCK EVIDENCE PACK / HANDOVER STATUS (Portfolio-level view)
// =============================================================================

interface PortfolioHandoverStatus {
  projectId: string;
  projectName: string;
  totalHandovers: number;
  completedHandovers: number;
  pendingSignoff: number;
  blockedPaymentValue: number;
  status: 'complete' | 'on-track' | 'at-risk' | 'blocked';
}

const MOCK_PORTFOLIO_HANDOVERS: PortfolioHandoverStatus[] = [
  {
    projectId: 'uk-001',
    projectName: 'Meridian Tower',
    totalHandovers: 12,
    completedHandovers: 9,
    pendingSignoff: 2,
    blockedPaymentValue: 285000,
    status: 'on-track',
  },
  {
    projectId: 'nl-001',
    projectName: 'Thames View',
    totalHandovers: 8,
    completedHandovers: 5,
    pendingSignoff: 1,
    blockedPaymentValue: 420000,
    status: 'at-risk',
  },
  {
    projectId: 'de-001',
    projectName: 'Green Quarter',
    totalHandovers: 15,
    completedHandovers: 15,
    pendingSignoff: 0,
    blockedPaymentValue: 0,
    status: 'complete',
  },
];

const MOCK_PENDING_APPROVALS = [
  {
    id: 'apr-001',
    type: 'payment',
    title: 'Progress Payment - Broadgate',
    description: 'Draw request #7 for structural works',
    amount: 285000,
    requestedBy: 'John Smith (PM)',
    requestedAt: '2024-02-01T10:30:00Z',
    priority: 'high' as const,
    daysWaiting: 2,
  },
  {
    id: 'apr-002',
    type: 'change-order',
    title: 'Change Order - Victoria Tower',
    description: 'MEP scope adjustment for floor 12-15',
    amount: 45000,
    requestedBy: 'Sarah Chen (COO)',
    requestedAt: '2024-01-30T14:00:00Z',
    priority: 'critical' as const,
    daysWaiting: 4,
  },
  {
    id: 'apr-003',
    type: 'contract',
    title: 'Subcontractor Contract - Thames Gate',
    description: 'Electrical installation package',
    amount: 890000,
    requestedBy: 'Mike Johnson (Procurement)',
    requestedAt: '2024-02-02T09:00:00Z',
    priority: 'medium' as const,
    daysWaiting: 1,
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

interface QuickActionProps {
  icon: IconName;
  label: string;
  badge?: number;
  onPress: () => void;
}

function QuickAction({ icon, label, badge, onPress }: QuickActionProps) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={22} color={DIRECTOR_COLOR} />
        {badge !== undefined && badge > 0 && (
          <View style={styles.quickActionBadge}>
            <Text style={styles.quickActionBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

interface MetricCardProps {
  value: string;
  label: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
}

function MetricCard({ value, label, trend, trendValue, color }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, color && { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {trend && trendValue && (
        <View style={styles.metricTrend}>
          <Ionicons
            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
            size={12}
            color={trend === 'up' ? SemanticColors.feedbackSuccess : trend === 'down' ? SemanticColors.feedbackError : SemanticColors.textTertiary}
          />
          <Text style={[
            styles.metricTrendText,
            { color: trend === 'up' ? SemanticColors.feedbackSuccess : trend === 'down' ? SemanticColors.feedbackError : SemanticColors.textTertiary }
          ]}>
            {trendValue}
          </Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

export type DirectorTabView = TabView;

interface DirectorDashboardProps {
  initialTab?: TabView;
  showTabBar?: boolean;
}

export function DirectorDashboard({ initialTab = 'portfolio', showTabBar = true }: DirectorDashboardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>(initialTab);

  // Track screen visits for learning profile
  useEffect(() => { recordScreenVisit(activeTab); }, [activeTab]);

  // Vasco AI Guidance
  const [dismissedGuidance, setDismissedGuidance] = useState<Set<string>>(new Set());
  const [snoozedGuidance, setSnoozedGuidance] = useState<Set<string>>(new Set());
  const allGuidance = useVascoGuidance('director', activeTab as any);
  const activeGuidance = useMemo(
    () => allGuidance.filter(g => !dismissedGuidance.has(g.id) && !snoozedGuidance.has(g.id)),
    [allGuidance, dismissedGuidance, snoozedGuidance]
  );
  const portfolioInsight = useInlineInsight('director', 'portfolio', 'overview');
  const approvalsInsight = useInlineInsight('director', 'approvals', 'overview');
  const risksInsight = useInlineInsight('director', 'risks', 'overview');
  const performanceInsight = useInlineInsight('director', 'performance', 'overview');

  const handleDismissGuidance = useCallback((id: string) => {
    setDismissedGuidance(prev => new Set(prev).add(id));
  }, []);
  const handleSnoozeGuidance = useCallback((id: string) => {
    setSnoozedGuidance(prev => new Set(prev).add(id));
  }, []);
  const handleGuidanceAction = useCallback((insight: VascoInsight) => {
    if (insight.actionRoute) router.push(insight.actionRoute as any);
  }, [router]);

  // Portfolio-level feature hooks
  const { data: fragilityStats } = useScheduleFragilityStats();
  const { data: supplierStats } = useSupplierReliabilityStats();


  // Portfolio metrics
  const portfolioMetrics = useMemo(() => {
    let totalGdv = 0;
    let totalBudget = 0;
    let totalSpent = 0;
    let irrSum = 0;
    let projectCount = 0;

    mockProjects.forEach((project) => {
      const appraisal = mockAppraisals[project.id];
      if (appraisal) {
        totalGdv += appraisal.gdv;
        irrSum += appraisal.irr;
        projectCount++;
      }
      totalBudget += project.totalBudget;
      totalSpent += project.actualSpent;
    });

    return {
      totalGdv,
      avgIrr: projectCount > 0 ? irrSum / projectCount : 0,
      totalBudget,
      totalSpent,
      projectCount: mockProjects.length,
    };
  }, []);

  // Project health summary
  const projectHealth = useMemo(() => {
    let onTrack = 0;
    let atRisk = 0;
    let behind = 0;

    mockProjects.forEach((project) => {
      const metrics = mockDeliveryMetrics[project.id];
      if (metrics) {
        if (metrics.spiSchedulePerformanceIndex >= 0.95 && metrics.cpiCostPerformanceIndex >= 0.95) {
          onTrack++;
        } else if (metrics.spiSchedulePerformanceIndex >= 0.85 || metrics.cpiCostPerformanceIndex >= 0.85) {
          atRisk++;
        } else {
          behind++;
        }
      }
    });

    return { onTrack, atRisk, behind };
  }, []);

  // Risk summary
  const riskSummary = useMemo(() => {
    const highRisks = mockProjects.flatMap(p =>
      p.risks.filter(r => r.score >= 12 && r.status !== 'closed')
    );
    const totalRisks = mockProjects.flatMap(p =>
      p.risks.filter(r => r.status !== 'closed')
    );

    return {
      highCount: highRisks.length,
      totalCount: totalRisks.length,
      topRisks: highRisks.slice(0, 5),
    };
  }, []);

  // Platform metrics
  const platformMetrics = useMemo(() => ({
    hoursSaved: 127,
    valueDelivered: 48000,
    docAccuracy: 0.92,
    avgDsoReduction: 4.2,
    aiActions: 156,
    approvalsSaved: 23,
  }), []);

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Pending counts for header status
  const pendingApprovals = MOCK_PENDING_APPROVALS.length;

  // =============================================================================
  // RENDER TAB CONTENT
  // =============================================================================

  const renderPortfolioTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* KPI Header */}
      <ContractorDashboardHeader
        kpis={[
          { icon: 'cash', value: fmtCompact(portfolioMetrics.totalGdv, 'GBP'), label: 'GDV', color: DIRECTOR_COLOR },
          { icon: 'trending-up', value: formatPercent(portfolioMetrics.avgIrr), label: 'Avg IRR', color: SemanticColors.feedbackSuccess },
          { icon: 'business', value: String(mockProjects.length), label: 'Projects' },
        ]}
      />
      <VascoInsightList
        insights={activeGuidance}
        title="Vasco AI Guidance"
        compact
        maxVisible={2}
        onDismiss={handleDismissGuidance}
        onAction={handleGuidanceAction}
        onSnooze={handleSnoozeGuidance}
      />
      {portfolioInsight && (
        <InlineInsight icon={portfolioInsight.icon as IconName} message={portfolioInsight.message} />
      )}

      {/* Portfolio Summary */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Ionicons name="business" size={18} color={DIRECTOR_COLOR} />
          </View>
          <Text style={styles.cardTitle}>Portfolio Summary</Text>
          <Text style={styles.cardSubtitle}>{portfolioMetrics.projectCount} projects</Text>
        </View>

        <View style={styles.portfolioMetrics}>
          <View style={styles.portfolioMetricMain}>
            <Text style={styles.portfolioMetricValue}>
              {fmtCompact(portfolioMetrics.totalGdv, 'GBP')}
            </Text>
            <Text style={styles.portfolioMetricLabel}>Total GDV</Text>
          </View>
          <View style={styles.portfolioMetricDivider} />
          <View style={styles.portfolioMetricMain}>
            <Text style={[styles.portfolioMetricValue, { color: DIRECTOR_COLOR }]}>
              {formatPercent(portfolioMetrics.avgIrr)}
            </Text>
            <Text style={styles.portfolioMetricLabel}>Avg IRR</Text>
          </View>
        </View>

        <View style={styles.healthRow}>
          <View style={[styles.healthCard, styles.healthCardGood]}>
            <Text style={styles.healthValue}>{projectHealth.onTrack}</Text>
            <Text style={styles.healthLabel}>On Track</Text>
          </View>
          <View style={[styles.healthCard, styles.healthCardWarning]}>
            <Text style={styles.healthValue}>{projectHealth.atRisk}</Text>
            <Text style={styles.healthLabel}>At Risk</Text>
          </View>
          <View style={[styles.healthCard, styles.healthCardDanger]}>
            <Text style={styles.healthValue}>{projectHealth.behind}</Text>
            <Text style={styles.healthLabel}>Behind</Text>
          </View>
        </View>
      </View>

      {/* Project List */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Ionicons name="list" size={18} color={DIRECTOR_COLOR} />
          </View>
          <Text style={styles.cardTitle}>Projects</Text>
        </View>

        {mockProjects.map((project) => {
          const metrics = mockDeliveryMetrics[project.id];
          const appraisal = mockAppraisals[project.id];
          const isHealthy = metrics && metrics.spiSchedulePerformanceIndex >= 0.95;
          const isAtRisk = metrics && metrics.spiSchedulePerformanceIndex >= 0.85 && metrics.spiSchedulePerformanceIndex < 0.95;

          return (
            <Pressable
              key={project.id}
              style={styles.projectItem}
              onPress={() => router.push('/hub/projects' as any)}
            >
              <View style={styles.projectInfo}>
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={styles.projectMeta}>
                  {project.country} • {project.phase}
                </Text>
              </View>
              <View style={styles.projectStats}>
                {appraisal && (
                  <Text style={styles.projectIrr}>{formatPercent(appraisal.irr)}</Text>
                )}
                <View style={[
                  styles.projectStatus,
                  isHealthy && styles.projectStatusGood,
                  isAtRisk && styles.projectStatusWarning,
                  !isHealthy && !isAtRisk && styles.projectStatusDanger,
                ]}>
                  <Text style={styles.projectStatusText}>
                    {isHealthy ? 'On Track' : isAtRisk ? 'At Risk' : 'Behind'}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderApprovalsTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* KPI Header */}
      <ContractorDashboardHeader
        kpis={[
          { icon: 'checkmark-done', value: String(pendingApprovals), label: 'Pending', color: DIRECTOR_COLOR },
          { icon: 'alert-circle', value: String(MOCK_PENDING_APPROVALS.filter(a => a.priority === 'critical').length), label: 'Critical', color: SemanticColors.feedbackError },
          { icon: 'timer', value: `${Math.max(...MOCK_PENDING_APPROVALS.map(a => a.daysWaiting))}d`, label: 'Max Wait' },
        ]}
      />
      {approvalsInsight && (
        <InlineInsight icon={approvalsInsight.icon as IconName} message={approvalsInsight.message} />
      )}

      {/* Approval Value Pipeline */}
      {(() => {
        const criticalValue = MOCK_PENDING_APPROVALS.filter(a => a.priority === 'critical').reduce((s, a) => s + a.amount, 0);
        const highValue = MOCK_PENDING_APPROVALS.filter(a => a.priority === 'high').reduce((s, a) => s + a.amount, 0);
        const mediumValue = MOCK_PENDING_APPROVALS.filter(a => a.priority === 'medium').reduce((s, a) => s + a.amount, 0);
        const totalValue = criticalValue + highValue + mediumValue;
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
                <Ionicons name="cash" size={18} color={DIRECTOR_COLOR} />
              </View>
              <Text style={styles.cardTitle}>Approval Pipeline</Text>
            </View>
            {/* Hero Total */}
            <View style={styles.pipelineHero}>
              <Text style={styles.pipelineHeroValue}>{fmtCompact(totalValue, 'GBP')}</Text>
              <Text style={styles.pipelineHeroLabel}>{pendingApprovals} items awaiting decision</Text>
            </View>
            {/* Stacked Bar */}
            <View style={styles.pipelineBarTrack}>
              {criticalValue > 0 && <View style={[styles.pipelineSegment, { flex: criticalValue, backgroundColor: SemanticColors.feedbackError }]} />}
              {highValue > 0 && <View style={[styles.pipelineSegment, { flex: highValue, backgroundColor: SemanticColors.feedbackWarning }]} />}
              {mediumValue > 0 && <View style={[styles.pipelineSegment, { flex: mediumValue, backgroundColor: SemanticColors.feedbackInfo }]} />}
            </View>
            {/* Legend */}
            <View style={styles.pipelineLegend}>
              <View style={styles.pipelineLegendItem}>
                <View style={[styles.pipelineLegendDot, { backgroundColor: SemanticColors.feedbackError }]} />
                <Text style={styles.pipelineLegendLabel}>Critical</Text>
                <Text style={styles.pipelineLegendValue}>{fmtCompact(criticalValue, 'GBP')}</Text>
              </View>
              <View style={styles.pipelineLegendItem}>
                <View style={[styles.pipelineLegendDot, { backgroundColor: SemanticColors.feedbackWarning }]} />
                <Text style={styles.pipelineLegendLabel}>High</Text>
                <Text style={styles.pipelineLegendValue}>{fmtCompact(highValue, 'GBP')}</Text>
              </View>
              <View style={styles.pipelineLegendItem}>
                <View style={[styles.pipelineLegendDot, { backgroundColor: SemanticColors.feedbackInfo }]} />
                <Text style={styles.pipelineLegendLabel}>Medium</Text>
                <Text style={styles.pipelineLegendValue}>{fmtCompact(mediumValue, 'GBP')}</Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Pending Approvals */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Ionicons name="hourglass" size={18} color={SemanticColors.feedbackWarning} />
          </View>
          <Text style={styles.cardTitle}>Pending Approvals</Text>
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{pendingApprovals}</Text>
          </View>
        </View>

        {MOCK_PENDING_APPROVALS.map((approval) => (
          <Pressable
            key={approval.id}
            style={styles.approvalItem}
            onPress={() => router.push('/hub/approvals' as any)}
          >
            <View style={[
              styles.approvalPriority,
              { backgroundColor: approval.priority === 'critical' ? SemanticColors.feedbackError : approval.priority === 'high' ? SemanticColors.feedbackWarning : SemanticColors.feedbackInfo }
            ]} />
            <View style={styles.approvalContent}>
              <View style={styles.approvalHeader}>
                <Text style={styles.approvalTitle}>{approval.title}</Text>
                <Text style={styles.approvalAmount}>{fmtCompact(approval.amount, 'GBP')}</Text>
              </View>
              <Text style={styles.approvalDescription}>{approval.description}</Text>
              <View style={styles.approvalMeta}>
                <Text style={styles.approvalMetaText}>
                  {approval.requestedBy} • {approval.daysWaiting}d waiting
                </Text>
                <View style={[
                  styles.priorityBadge,
                  { backgroundColor: approval.priority === 'critical' ? SemanticColors.feedbackErrorBg : approval.priority === 'high' ? SemanticColors.feedbackWarningBg : SemanticColors.feedbackInfoBg }
                ]}>
                  <Text style={[
                    styles.priorityBadgeText,
                    { color: approval.priority === 'critical' ? SemanticColors.feedbackError : approval.priority === 'high' ? SemanticColors.feedbackWarning : SemanticColors.feedbackInfo }
                  ]}>
                    {approval.priority}
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        ))}
      </View>

      {/* Approval Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Approval Actions</Text>
        <View style={styles.actionsList}>
          <Pressable style={styles.actionItem} onPress={() => router.push('/hub/approvals' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
              <Ionicons name="checkmark-done" size={20} color={DIRECTOR_COLOR} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Review All Pending</Text>
              <Text style={styles.actionSubtitle}>Process approval queue</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => router.push('/hub/reports' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
              <Ionicons name="document-text" size={20} color={SemanticColors.feedbackInfo} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Approval History</Text>
              <Text style={styles.actionSubtitle}>View past decisions</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        </View>
      </View>

      {/* Tools */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tools</Text>
        <View style={styles.actionsList}>
          <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/compliance' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
              <Ionicons name="shield-checkmark" size={20} color={DIRECTOR_COLOR} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Compliance</Text>
              <Text style={styles.actionSubtitle}>Regelgeving & nalevingscontext</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/cashflow' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
              <Ionicons name="cash" size={20} color={SemanticColors.feedbackSuccess} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Cash Flow</Text>
              <Text style={styles.actionSubtitle}>Financiële impact van goedkeuringen</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderRisksTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* KPI Header */}
      <ContractorDashboardHeader
        kpis={[
          { icon: 'warning', value: String(riskSummary.highCount), label: 'High Risk', color: riskSummary.highCount > 0 ? SemanticColors.feedbackError : undefined },
          { icon: 'shield', value: String(riskSummary.totalCount), label: 'Total Open' },
          { icon: 'analytics', value: String(fragilityStats?.averageFragilityScore || 0), label: 'Avg Fragility' },
        ]}
      />
      {risksInsight && (
        <InlineInsight icon={risksInsight.icon as IconName} message={risksInsight.message} />
      )}

      {/* Risk Distribution Gauge */}
      {(() => {
        const highRisks = riskSummary.highCount;
        const medRisks = riskSummary.totalCount - highRisks;
        const total = riskSummary.totalCount || 1;
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: SemanticColors.feedbackError + '15' }]}>
                <Ionicons name="shield" size={18} color={SemanticColors.feedbackError} />
              </View>
              <Text style={styles.cardTitle}>Risk Distribution</Text>
              <View style={[styles.cardBadge, { backgroundColor: SemanticColors.feedbackError }]}>
                <Text style={styles.cardBadgeText}>{riskSummary.totalCount} open</Text>
              </View>
            </View>

            {/* Severity Bars */}
            {[
              { label: 'High (12+)', count: highRisks, color: SemanticColors.feedbackError, pct: (highRisks / total) * 100 },
              { label: 'Medium (6-11)', count: medRisks, color: SemanticColors.feedbackWarning, pct: (medRisks / total) * 100 },
            ].map((row) => (
              <View key={row.label} style={styles.riskGaugeRow}>
                <View style={styles.riskGaugeLabel}>
                  <Text style={styles.riskGaugeLabelText}>{row.label}</Text>
                  <Text style={[styles.riskGaugeCount, { color: row.color }]}>{row.count}</Text>
                </View>
                <View style={styles.riskGaugeBarTrack}>
                  <View style={[styles.riskGaugeBarFill, { width: `${Math.max(row.pct, 4)}%`, backgroundColor: row.color }]} />
                </View>
              </View>
            ))}

            {/* Fragility + Supplier Row */}
            <View style={styles.riskExposureRow}>
              <View style={styles.riskExposureItem}>
                <Ionicons name="pulse" size={16} color={SemanticColors.feedbackWarning} />
                <View>
                  <Text style={styles.riskExposureValue}>{fragilityStats?.averageFragilityScore || '—'}</Text>
                  <Text style={styles.riskExposureLabel}>Avg Fragility</Text>
                </View>
              </View>
              <View style={styles.riskExposureDivider} />
              <View style={styles.riskExposureItem}>
                <Ionicons name="people" size={16} color={SemanticColors.feedbackInfo} />
                <View>
                  <Text style={styles.riskExposureValue}>{supplierStats?.totalSuppliers || '—'}</Text>
                  <Text style={styles.riskExposureLabel}>Suppliers</Text>
                </View>
              </View>
              <View style={styles.riskExposureDivider} />
              <View style={styles.riskExposureItem}>
                <Ionicons name="checkmark-circle" size={16} color={SemanticColors.feedbackSuccess} />
                <View>
                  <Text style={styles.riskExposureValue}>{supplierStats?.averageReliabilityScore || '—'}%</Text>
                  <Text style={styles.riskExposureLabel}>Reliability</Text>
                </View>
              </View>
            </View>
          </View>
        );
      })()}

      {/* High-Score Risks */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardHeaderIcon, { backgroundColor: SemanticColors.feedbackError + '15' }]}>
            <Ionicons name="alert-circle" size={18} color={SemanticColors.feedbackError} />
          </View>
          <Text style={styles.cardTitle}>High-Score Risks</Text>
          <View style={[styles.cardBadge, { backgroundColor: SemanticColors.feedbackError }]}>
            <Text style={styles.cardBadgeText}>{riskSummary.highCount}</Text>
          </View>
        </View>

        {riskSummary.topRisks.map((risk) => (
          <Pressable
            key={risk.id}
            style={styles.riskItem}
            onPress={() => router.push('/hub/risks' as any)}
          >
            <View style={[styles.riskScore, { backgroundColor: SemanticColors.feedbackError + '15' }]}>
              <Text style={[styles.riskScoreText, { color: SemanticColors.feedbackError }]}>
                {risk.score}
              </Text>
            </View>
            <View style={styles.riskContent}>
              <Text style={styles.riskTitle}>{risk.description}</Text>
              <Text style={styles.riskMeta}>{risk.category} • {risk.status}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        ))}

        <Pressable style={styles.viewAllButton} onPress={() => router.push('/hub/risks' as any)}>
          <Text style={styles.viewAllText}>View All Risks</Text>
          <Ionicons name="arrow-forward" size={16} color={DIRECTOR_COLOR} />
        </Pressable>
      </View>

      {/* Risk Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Risk Actions</Text>
        <View style={styles.actionsList}>
          <Pressable style={styles.actionItem} onPress={() => router.push('/hub/risks' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackError + '15' }]}>
              <Ionicons name="eye" size={20} color={SemanticColors.feedbackError} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Risk Register</Text>
              <Text style={styles.actionSubtitle}>Full portfolio view</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => router.push('/hub/reports' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
              <Ionicons name="git-branch" size={20} color={DIRECTOR_COLOR} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>What-If Analysis</Text>
              <Text style={styles.actionSubtitle}>Scenario planning</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        </View>
      </View>

      {/* Tools */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tools</Text>
        <View style={styles.actionsList}>
          <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/compliance' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
              <Ionicons name="shield-checkmark" size={20} color={DIRECTOR_COLOR} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Compliance</Text>
              <Text style={styles.actionSubtitle}>Regelgeving & risiconaleving</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/warranty' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
              <Ionicons name="ribbon" size={20} color={SemanticColors.feedbackWarning} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Garantie</Text>
              <Text style={styles.actionSubtitle}>Garantie- & verplichtingenrisico's</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderPerformanceTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* KPI Header */}
      <ContractorDashboardHeader
        kpis={[
          { icon: 'cash', value: fmtCompact(platformMetrics.valueDelivered, 'GBP'), label: 'ROI', color: DIRECTOR_COLOR },
          { icon: 'time', value: `${platformMetrics.avgDsoReduction}d`, label: 'DSO ↓', color: SemanticColors.feedbackSuccess },
          { icon: 'checkmark-circle', value: String(platformMetrics.approvalsSaved), label: 'Auto-Approved' },
        ]}
      />
      {performanceInsight && (
        <InlineInsight icon={performanceInsight.icon as IconName} message={performanceInsight.message} />
      )}

      {/* ROI Hero Card */}
      <View style={styles.roiHeroCard}>
        <View style={styles.roiHeroTop}>
          <View style={styles.roiHeroRing}>
            <Text style={styles.roiHeroRingValue}>{fmtCompact(platformMetrics.valueDelivered, 'GBP')}</Text>
            <Text style={styles.roiHeroRingLabel}>Quarterly ROI</Text>
          </View>
          <View style={styles.roiHeroSubMetrics}>
            <View style={styles.roiHeroSubItem}>
              <Text style={styles.roiHeroSubValue}>{platformMetrics.hoursSaved}h</Text>
              <Text style={styles.roiHeroSubLabel}>Hours Saved</Text>
            </View>
            <View style={styles.roiHeroSubItem}>
              <Text style={styles.roiHeroSubValue}>{platformMetrics.avgDsoReduction}d</Text>
              <Text style={styles.roiHeroSubLabel}>DSO Reduction</Text>
            </View>
            <View style={styles.roiHeroSubItem}>
              <Text style={styles.roiHeroSubValue}>{formatPercent(platformMetrics.docAccuracy)}</Text>
              <Text style={styles.roiHeroSubLabel}>Accuracy</Text>
            </View>
          </View>
        </View>
        <View style={styles.roiHeroTrend}>
          <Ionicons name="trending-up" size={14} color={SemanticColors.feedbackSuccess} />
          <Text style={[styles.roiHeroTrendText, { color: SemanticColors.feedbackSuccess }]}>+12% vs last quarter</Text>
        </View>
      </View>

      {/* Platform Activity Bars */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardHeaderIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
            <Ionicons name="flash" size={18} color={DIRECTOR_COLOR} />
          </View>
          <Text style={styles.cardTitle}>AI Activity</Text>
        </View>
        {[
          { icon: 'document-text' as IconName, label: 'Docs Processed', value: 342, max: 500, color: SemanticColors.feedbackInfo },
          { icon: 'flash' as IconName, label: 'AI Actions', value: platformMetrics.aiActions, max: 200, color: DIRECTOR_COLOR },
          { icon: 'checkmark-circle' as IconName, label: 'Auto-Approvals', value: platformMetrics.approvalsSaved, max: 50, color: SemanticColors.feedbackSuccess },
          { icon: 'bulb' as IconName, label: 'Insights Generated', value: 89, max: 120, color: Palette.hermesOrange },
        ].map((item) => (
          <View key={item.label} style={styles.actBarRow}>
            <View style={styles.actBarIcon}>
              <Ionicons name={item.icon} size={16} color={item.color} />
            </View>
            <View style={styles.actBarContent}>
              <View style={styles.actBarLabelRow}>
                <Text style={styles.actBarLabel}>{item.label}</Text>
                <Text style={[styles.actBarValue, { color: item.color }]}>{item.value}</Text>
              </View>
              <View style={styles.actBarTrack}>
                <View style={[styles.actBarFill, { width: `${Math.min((item.value / item.max) * 100, 100)}%`, backgroundColor: item.color }]} />
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* ROI Breakdown */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardHeaderIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
            <Ionicons name="trending-up" size={18} color={SemanticColors.feedbackSuccess} />
          </View>
          <Text style={styles.cardTitle}>ROI Breakdown</Text>
        </View>

        <View style={styles.roiList}>
          <View style={styles.roiItem}>
            <View style={styles.roiLabel}>
              <View style={[styles.roiDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
              <Text style={styles.roiLabelText}>Admin Time Saved</Text>
            </View>
            <Text style={styles.roiValue}>{fmtCompact(28500, 'GBP')}</Text>
          </View>
          <View style={styles.roiItem}>
            <View style={styles.roiLabel}>
              <View style={[styles.roiDot, { backgroundColor: SemanticColors.feedbackInfo }]} />
              <Text style={styles.roiLabelText}>Faster Collections</Text>
            </View>
            <Text style={styles.roiValue}>{fmtCompact(12400, 'GBP')}</Text>
          </View>
          <View style={styles.roiItem}>
            <View style={styles.roiLabel}>
              <View style={[styles.roiDot, { backgroundColor: DIRECTOR_COLOR }]} />
              <Text style={styles.roiLabelText}>Error Prevention</Text>
            </View>
            <Text style={styles.roiValue}>{fmtCompact(7100, 'GBP')}</Text>
          </View>
        </View>

        <View style={styles.roiTotal}>
          <Text style={styles.roiTotalLabel}>Total ROI This Quarter</Text>
          <Text style={styles.roiTotalValue}>{fmtCompact(48000, 'GBP')}</Text>
        </View>
      </View>

      {/* Performance Hub */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardHeaderIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
            <Ionicons name="rocket" size={18} color={DIRECTOR_COLOR} />
          </View>
          <Text style={styles.cardTitle}>Performance Hub</Text>
        </View>
        <View style={styles.actionsList}>
          <Pressable style={styles.actionItem} onPress={() => router.push('/hub/metrics' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
              <Ionicons name="analytics" size={20} color={Palette.hermesOrange} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Live Metrics</Text>
              <Text style={styles.actionSubtitle}>Real-time portfolio data</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => router.push('/hub/reports' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
              <Ionicons name="bar-chart" size={20} color={SemanticColors.feedbackInfo} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Reports</Text>
              <Text style={styles.actionSubtitle}>Exporteren & delen</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => router.push('/hub/appraisal' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
              <Ionicons name="calculator" size={20} color={SemanticColors.feedbackSuccess} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Appraisal</Text>
              <Text style={styles.actionSubtitle}>IRR tracking & waardering</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => router.push('/hub/budget-optimizer' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
              <Ionicons name="calculator-outline" size={20} color={DIRECTOR_COLOR} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Budget Optimalisatie</Text>
              <Text style={styles.actionSubtitle}>€125K potentieel</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              {greeting}, {user?.name?.split(' ')[0] || 'Director'}
            </Text>
            <Text style={styles.title}>Portfolio Overview</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Director</Text>
          </View>
        </View>

      </View>

      {/* Internal tab bar removed - using bottom navigation instead */}

      {/* Tab Content */}
      {activeTab === 'portfolio' && renderPortfolioTab()}
      {activeTab === 'approvals' && renderApprovalsTab()}
      {activeTab === 'risks' && renderRisksTab()}
      {activeTab === 'performance' && renderPerformanceTab()}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },

  // Header
  header: {
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: DIRECTOR_COLOR + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: DIRECTOR_COLOR,
  },

  // Status Pills
  statusPills: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusPillActive: {
    backgroundColor: DIRECTOR_COLOR + '15',
  },
  statusPillWarning: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  statusPillDanger: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  statusPillTextActive: {
    color: DIRECTOR_COLOR,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    paddingHorizontal: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: DIRECTOR_COLOR,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: SemanticColors.textTertiary,
  },
  tabLabelActive: {
    color: DIRECTOR_COLOR,
    fontWeight: '600',
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Stats Banner
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statsBannerItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsBannerValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statsBannerLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  statsBannerDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.sm,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickAction: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: DIRECTOR_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: SemanticColors.feedbackError,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },

  // Cards
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: DIRECTOR_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  cardBadge: {
    backgroundColor: SemanticColors.feedbackWarning,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Portfolio Metrics
  portfolioMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: Spacing.md,
  },
  portfolioMetricMain: {
    flex: 1,
    alignItems: 'center',
  },
  portfolioMetricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  portfolioMetricLabel: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },
  portfolioMetricDivider: {
    width: 1,
    height: 40,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.md,
  },

  // Health Row
  healthRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  healthCard: {
    flex: 1,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  healthCardGood: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  healthCardWarning: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  healthCardDanger: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  healthValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  healthLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Project List
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  projectMeta: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  projectStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  projectIrr: {
    fontSize: 14,
    fontWeight: '600',
    color: DIRECTOR_COLOR,
  },
  projectStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  projectStatusGood: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  projectStatusWarning: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  projectStatusDanger: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  projectStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Hub Grid
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  hubCard: {
    width: '48%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  hubIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  hubStat: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Approval Items
  approvalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
    gap: Spacing.sm,
  },
  approvalPriority: {
    width: 4,
    height: 48,
    borderRadius: 2,
  },
  approvalContent: {
    flex: 1,
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  approvalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  approvalAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: DIRECTOR_COLOR,
  },
  approvalDescription: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  approvalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  approvalMetaText: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Action Items
  actionsList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
    gap: Spacing.sm,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  actionSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Risk Items
  riskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
    gap: Spacing.sm,
  },
  riskScore: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskScoreText: {
    fontSize: 14,
    fontWeight: '700',
  },
  riskContent: {
    flex: 1,
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  riskMeta: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: DIRECTOR_COLOR,
  },

  // Risk Stats
  riskStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  riskStatItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  riskStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  riskStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  supplierStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  supplierStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  supplierStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  supplierStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // Platform Grid
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  metricTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  metricTrendText: {
    fontSize: 10,
    fontWeight: '500',
  },

  // Agent Stats
  agentStatsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  agentStatItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  agentStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  agentStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },

  // ROI List
  roiList: {
    gap: Spacing.sm,
  },
  roiItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  roiLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roiLabelText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  roiValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  roiTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  roiTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  roiTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },

  // Handover Status Styles
  handoverStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  handoverStatItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  handoverStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  handoverStatLabel: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
    marginTop: 2,
    textAlign: 'center',
  },
  handoverProjectItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    gap: 8,
  },
  handoverProjectTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  handoverProjectInfo: {
    flex: 1,
  },
  handoverProjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  handoverProjectMeta: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  handoverProjectStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  handoverProjectStatusComplete: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  handoverProjectStatusOnTrack: {
    backgroundColor: SemanticColors.feedbackInfoBg,
  },
  handoverProjectStatusAtRisk: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  handoverProjectStatusBlocked: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  handoverProjectStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  handoverProjectProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  handoverProjectProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: SemanticColors.surfaceTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  handoverProjectProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  handoverProgressComplete: {
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  handoverProgressOnTrack: {
    backgroundColor: SemanticColors.feedbackInfo,
  },
  handoverProgressAtRisk: {
    backgroundColor: SemanticColors.feedbackWarning,
  },
  handoverProjectProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    width: 32,
    textAlign: 'right',
  },
  handoverBlockedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.feedbackWarningBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  handoverBlockedText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.feedbackWarning,
  },
  handoverBlockedReason: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Approval Pipeline
  pipelineHero: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  pipelineHeroValue: {
    fontSize: 28,
    fontWeight: '700',
    color: DIRECTOR_COLOR,
  },
  pipelineHeroLabel: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },
  pipelineBarTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  pipelineSegment: {
    height: '100%',
  },
  pipelineLegend: {
    gap: Spacing.xs,
  },
  pipelineLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pipelineLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pipelineLegendLabel: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  pipelineLegendValue: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Risk Distribution Gauge
  riskGaugeRow: {
    gap: 6,
  },
  riskGaugeLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskGaugeLabelText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  riskGaugeCount: {
    fontSize: 14,
    fontWeight: '700',
  },
  riskGaugeBarTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'hidden',
  },
  riskGaugeBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  riskExposureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  riskExposureItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  riskExposureValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  riskExposureLabel: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
  },
  riskExposureDivider: {
    width: 1,
    height: 28,
    backgroundColor: SemanticColors.borderDefault,
  },

  // ROI Hero Card
  roiHeroCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  roiHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  roiHeroRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 6,
    borderColor: DIRECTOR_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DIRECTOR_COLOR + '10',
  },
  roiHeroRingValue: {
    fontSize: 18,
    fontWeight: '700',
    color: DIRECTOR_COLOR,
  },
  roiHeroRingLabel: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  roiHeroSubMetrics: {
    flex: 1,
    gap: Spacing.sm,
  },
  roiHeroSubItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roiHeroSubValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  roiHeroSubLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  roiHeroTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  roiHeroTrendText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Activity Bars
  actBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actBarIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actBarContent: {
    flex: 1,
    gap: 4,
  },
  actBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actBarLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  actBarValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  actBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'hidden',
  },
  actBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Cross-Role Workflow Oversight Styles
  wfOverviewStats: {
    flexDirection: 'row',
    gap: 6,
  },
  wfOverviewStatItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  wfOverviewStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  wfOverviewStatLabel: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  wfTypeBreakdown: {
    gap: 6,
  },
  wfTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: 10,
  },
  wfTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wfTypeLabel: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  wfTypeCount: {
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  wfTypeCountText: {
    fontSize: 14,
    fontWeight: '700',
  },
  wfEscalationAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackWarningBorder,
  },
  wfEscalationAlertTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.feedbackWarning,
  },
  wfEscalationAlertItem: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  wfPaymentSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: DIRECTOR_COLOR + '08',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: DIRECTOR_COLOR + '20',
  },
  wfPaymentSummaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  wfPaymentSummaryValue: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
});
