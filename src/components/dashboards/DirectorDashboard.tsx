// =============================================================================
// DIRECTOR DASHBOARD - Portfolio Overview & Strategic Decisions
// =============================================================================
// Executive portfolio dashboard for real estate development Directors
// Focus: Portfolio health, Approvals, Risk oversight, Platform ROI
// 4-tab navigation: Portfolio, Approvals, Risks, Performance
// =============================================================================

import { useState, useMemo } from 'react';
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
import { formatCurrency, formatPercent } from '../../modules/countryModules';
import { useScheduleFragilityStats } from '../../services/scheduleFragilityService';
import { useSupplierReliabilityStats } from '../../services/supplierReliabilityService';

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
      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          <QuickAction
            icon="checkmark-done"
            label="Approvals"
            badge={pendingApprovals}
            onPress={() => setActiveTab('approvals')}
          />
          <QuickAction
            icon="warning"
            label="Risks"
            badge={riskSummary.highCount}
            onPress={() => setActiveTab('risks')}
          />
          <QuickAction
            icon="bar-chart"
            label="Reports"
            badge={1}
            onPress={() => router.push('/hub/reports' as any)}
          />
          <QuickAction
            icon="analytics"
            label="Analytics"
            onPress={() => setActiveTab('performance')}
          />
        </View>
      </View>

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
              {formatCurrency(portfolioMetrics.totalGdv, 'GBP')}
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

      {/* Portfolio Handover Status */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardHeaderIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
            <Ionicons name="document-attach" size={18} color={SemanticColors.feedbackInfo} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Handover Status</Text>
            <Text style={styles.cardSubtitle}>Evidence packs across portfolio</Text>
          </View>
          {MOCK_PORTFOLIO_HANDOVERS.some(h => h.blockedPaymentValue > 0) && (
            <View style={[styles.cardBadge, { backgroundColor: SemanticColors.feedbackWarning }]}>
              <Text style={styles.cardBadgeText}>
                {MOCK_PORTFOLIO_HANDOVERS.filter(h => h.blockedPaymentValue > 0).length}
              </Text>
            </View>
          )}
        </View>

        {/* Summary Stats */}
        <View style={styles.handoverStatsRow}>
          <View style={styles.handoverStatItem}>
            <Text style={[styles.handoverStatValue, { color: SemanticColors.feedbackSuccess }]}>
              {MOCK_PORTFOLIO_HANDOVERS.reduce((s, h) => s + h.completedHandovers, 0)}
            </Text>
            <Text style={styles.handoverStatLabel}>Completed</Text>
          </View>
          <View style={styles.handoverStatItem}>
            <Text style={[styles.handoverStatValue, { color: SemanticColors.feedbackInfo }]}>
              {MOCK_PORTFOLIO_HANDOVERS.reduce((s, h) => s + h.pendingSignoff, 0)}
            </Text>
            <Text style={styles.handoverStatLabel}>Pending Sign-off</Text>
          </View>
          <View style={styles.handoverStatItem}>
            <Text style={[styles.handoverStatValue, { color: SemanticColors.feedbackWarning }]}>
              {formatCurrency(MOCK_PORTFOLIO_HANDOVERS.reduce((s, h) => s + h.blockedPaymentValue, 0), 'GBP')}
            </Text>
            <Text style={styles.handoverStatLabel}>Blocked Payments</Text>
          </View>
        </View>

        {/* Project Handover List */}
        {MOCK_PORTFOLIO_HANDOVERS.map((handover) => {
          const completionPercent = Math.round((handover.completedHandovers / handover.totalHandovers) * 100);
          return (
            <View key={handover.projectId} style={styles.handoverProjectItem}>
              <View style={styles.handoverProjectTop}>
                <View style={styles.handoverProjectInfo}>
                  <Text style={styles.handoverProjectName}>{handover.projectName}</Text>
                  <Text style={styles.handoverProjectMeta}>
                    {handover.completedHandovers}/{handover.totalHandovers} handovers
                  </Text>
                </View>
                <View style={[
                  styles.handoverProjectStatus,
                  handover.status === 'complete' && styles.handoverProjectStatusComplete,
                  handover.status === 'on-track' && styles.handoverProjectStatusOnTrack,
                  handover.status === 'at-risk' && styles.handoverProjectStatusAtRisk,
                  handover.status === 'blocked' && styles.handoverProjectStatusBlocked,
                ]}>
                  <Text style={styles.handoverProjectStatusText}>
                    {handover.status === 'complete' ? 'Complete' :
                     handover.status === 'on-track' ? 'On Track' :
                     handover.status === 'at-risk' ? 'At Risk' : 'Blocked'}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.handoverProjectProgress}>
                <View style={styles.handoverProjectProgressBar}>
                  <View style={[
                    styles.handoverProjectProgressFill,
                    { width: `${completionPercent}%` },
                    completionPercent === 100 && styles.handoverProgressComplete,
                    completionPercent >= 70 && completionPercent < 100 && styles.handoverProgressOnTrack,
                    completionPercent < 70 && styles.handoverProgressAtRisk,
                  ]} />
                </View>
                <Text style={styles.handoverProjectProgressText}>{completionPercent}%</Text>
              </View>

              {/* Blocked Payment Warning */}
              {handover.blockedPaymentValue > 0 && (
                <View style={styles.handoverBlockedWarning}>
                  <Ionicons name="lock-closed" size={12} color={SemanticColors.feedbackWarning} />
                  <Text style={styles.handoverBlockedText}>
                    {formatCurrency(handover.blockedPaymentValue, 'GBP')} blocked
                  </Text>
                  {handover.pendingSignoff > 0 && (
                    <Text style={styles.handoverBlockedReason}>
                      • {handover.pendingSignoff} awaiting sign-off
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <Pressable style={styles.viewAllButton} onPress={() => router.push('/hub/projects' as any)}>
          <Text style={styles.viewAllText}>View All Handovers</Text>
          <Ionicons name="arrow-forward" size={16} color={DIRECTOR_COLOR} />
        </Pressable>
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

      {/* Hub Navigation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Strategic Hub</Text>
        <View style={styles.hubGrid}>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/appraisal' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
              <Ionicons name="stats-chart" size={22} color={SemanticColors.feedbackSuccess} />
            </View>
            <Text style={styles.hubTitle}>Appraisal</Text>
            <Text style={styles.hubStat}>Portfolio IRR</Text>
          </Pressable>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/reports' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
              <Ionicons name="document-text" size={22} color={SemanticColors.feedbackInfo} />
            </View>
            <Text style={styles.hubTitle}>Reports</Text>
            <Text style={styles.hubStat}>1 ready</Text>
          </Pressable>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/projects' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
              <Ionicons name="folder-open" size={22} color={DIRECTOR_COLOR} />
            </View>
            <Text style={styles.hubTitle}>Projects</Text>
            <Text style={styles.hubStat}>{portfolioMetrics.projectCount} active</Text>
          </Pressable>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/metrics' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
              <Ionicons name="pie-chart" size={22} color={Palette.hermesOrange} />
            </View>
            <Text style={styles.hubTitle}>Metrics</Text>
            <Text style={styles.hubStat}>Live data</Text>
          </Pressable>
        </View>
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
      {/* Approval Stats Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statsBannerItem}>
          <Text style={styles.statsBannerValue}>{pendingApprovals}</Text>
          <Text style={styles.statsBannerLabel}>Pending</Text>
        </View>
        <View style={styles.statsBannerDivider} />
        <View style={styles.statsBannerItem}>
          <Text style={[styles.statsBannerValue, { color: SemanticColors.feedbackError }]}>
            {MOCK_PENDING_APPROVALS.filter(a => a.priority === 'critical').length}
          </Text>
          <Text style={styles.statsBannerLabel}>Critical</Text>
        </View>
        <View style={styles.statsBannerDivider} />
        <View style={styles.statsBannerItem}>
          <Text style={styles.statsBannerValue}>
            {Math.round(MOCK_PENDING_APPROVALS.reduce((s, a) => s + a.daysWaiting, 0) / pendingApprovals)}d
          </Text>
          <Text style={styles.statsBannerLabel}>Avg Wait</Text>
        </View>
      </View>

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
                <Text style={styles.approvalAmount}>{formatCurrency(approval.amount, 'GBP')}</Text>
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
          <Pressable style={styles.actionItem} onPress={() => router.push('/hub/approvals' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
              <Ionicons name="settings" size={20} color={SemanticColors.feedbackWarning} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Delegation Rules</Text>
              <Text style={styles.actionSubtitle}>Configure thresholds</Text>
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
      {/* Risk Stats Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statsBannerItem}>
          <Text style={[styles.statsBannerValue, { color: SemanticColors.feedbackError }]}>
            {riskSummary.highCount}
          </Text>
          <Text style={styles.statsBannerLabel}>High Risks</Text>
        </View>
        <View style={styles.statsBannerDivider} />
        <View style={styles.statsBannerItem}>
          <Text style={styles.statsBannerValue}>{riskSummary.totalCount}</Text>
          <Text style={styles.statsBannerLabel}>Total Open</Text>
        </View>
        <View style={styles.statsBannerDivider} />
        <View style={styles.statsBannerItem}>
          <Text style={styles.statsBannerValue}>
            {fragilityStats?.averageFragility || 0}
          </Text>
          <Text style={styles.statsBannerLabel}>Avg Fragility</Text>
        </View>
      </View>

      {/* Portfolio Risk Exposure */}
      {(fragilityStats || supplierStats) && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderIcon}>
              <Ionicons name="shield" size={18} color={SemanticColors.feedbackWarning} />
            </View>
            <Text style={styles.cardTitle}>Portfolio Risk Exposure</Text>
          </View>

          {/* Fragility Stats */}
          {fragilityStats && (
            <View style={styles.riskStatsRow}>
              <View style={styles.riskStatItem}>
                <Text style={styles.riskStatValue}>{fragilityStats.averageFragility}</Text>
                <Text style={styles.riskStatLabel}>Avg Fragility</Text>
              </View>
              <View style={styles.riskStatItem}>
                <Text style={[styles.riskStatValue, { color: SemanticColors.feedbackError }]}>
                  {fragilityStats.criticalCount}
                </Text>
                <Text style={styles.riskStatLabel}>Critical</Text>
              </View>
              <View style={styles.riskStatItem}>
                <Text style={[styles.riskStatValue, { color: SemanticColors.feedbackWarning }]}>
                  {fragilityStats.highCount}
                </Text>
                <Text style={styles.riskStatLabel}>High Risk</Text>
              </View>
              <View style={styles.riskStatItem}>
                <Text style={styles.riskStatValue}>{fragilityStats.totalAlerts}</Text>
                <Text style={styles.riskStatLabel}>Alerts</Text>
              </View>
            </View>
          )}

          {/* Supplier Stats */}
          {supplierStats && (
            <View style={styles.supplierStatsRow}>
              <View style={styles.supplierStatItem}>
                <Text style={styles.supplierStatLabel}>Suppliers Tracked</Text>
                <Text style={styles.supplierStatValue}>{supplierStats.totalSuppliers}</Text>
              </View>
              <View style={styles.supplierStatItem}>
                <Text style={styles.supplierStatLabel}>Avg Reliability</Text>
                <Text style={[
                  styles.supplierStatValue,
                  { color: supplierStats.averageReliability >= 80 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning }
                ]}>
                  {supplierStats.averageReliability}%
                </Text>
              </View>
              <View style={styles.supplierStatItem}>
                <Text style={styles.supplierStatLabel}>Active Alerts</Text>
                <Text style={[
                  styles.supplierStatValue,
                  supplierStats.activeAlerts > 0 && { color: SemanticColors.feedbackError }
                ]}>
                  {supplierStats.activeAlerts}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

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
          <Pressable style={styles.actionItem} onPress={() => router.push('/hub/reports' as any)}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
              <Ionicons name="document-text" size={20} color={SemanticColors.feedbackInfo} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Risk Report</Text>
              <Text style={styles.actionSubtitle}>Generate for investors</Text>
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
      {/* Platform Performance Banner */}
      <View style={[styles.statsBanner, { backgroundColor: Palette.hermesOrange + '15' }]}>
        <View style={styles.statsBannerItem}>
          <Text style={[styles.statsBannerValue, { color: Palette.hermesOrange }]}>
            {platformMetrics.hoursSaved}h
          </Text>
          <Text style={styles.statsBannerLabel}>Hours Saved</Text>
        </View>
        <View style={styles.statsBannerDivider} />
        <View style={styles.statsBannerItem}>
          <Text style={[styles.statsBannerValue, { color: SemanticColors.feedbackSuccess }]}>
            {formatCurrency(platformMetrics.valueDelivered, 'GBP')}
          </Text>
          <Text style={styles.statsBannerLabel}>Value</Text>
        </View>
        <View style={styles.statsBannerDivider} />
        <View style={styles.statsBannerItem}>
          <Text style={[styles.statsBannerValue, { color: DIRECTOR_COLOR }]}>
            {platformMetrics.aiActions}
          </Text>
          <Text style={styles.statsBannerLabel}>AI Actions</Text>
        </View>
      </View>

      {/* Platform Metrics */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardHeaderIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
            <Ionicons name="sparkles" size={18} color={Palette.hermesOrange} />
          </View>
          <Text style={styles.cardTitle}>Platform Performance</Text>
        </View>

        <View style={styles.platformGrid}>
          <MetricCard
            value={`${platformMetrics.hoursSaved}h`}
            label="Hours Saved"
            trend="up"
            trendValue="+12%"
            color={SemanticColors.feedbackSuccess}
          />
          <MetricCard
            value={formatCurrency(platformMetrics.valueDelivered, 'GBP')}
            label="Value Delivered"
            trend="up"
            trendValue="+8%"
            color={SemanticColors.feedbackSuccess}
          />
          <MetricCard
            value={formatPercent(platformMetrics.docAccuracy)}
            label="Doc Accuracy"
            trend="neutral"
            trendValue="stable"
            color={DIRECTOR_COLOR}
          />
          <MetricCard
            value={`${platformMetrics.avgDsoReduction}d`}
            label="DSO Reduction"
            trend="up"
            trendValue="+0.5d"
            color={SemanticColors.feedbackInfo}
          />
        </View>
      </View>

      {/* AI Agent Stats */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardHeaderIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
            <Ionicons name="flash" size={18} color={DIRECTOR_COLOR} />
          </View>
          <Text style={styles.cardTitle}>AI Agent Activity</Text>
        </View>

        <View style={styles.agentStatsRow}>
          <View style={styles.agentStatItem}>
            <Ionicons name="document-text" size={24} color={SemanticColors.feedbackInfo} />
            <Text style={styles.agentStatValue}>342</Text>
            <Text style={styles.agentStatLabel}>Docs Processed</Text>
          </View>
          <View style={styles.agentStatItem}>
            <Ionicons name="checkmark-circle" size={24} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.agentStatValue}>{platformMetrics.approvalsSaved}</Text>
            <Text style={styles.agentStatLabel}>Auto-Approvals</Text>
          </View>
          <View style={styles.agentStatItem}>
            <Ionicons name="bulb" size={24} color={Palette.hermesOrange} />
            <Text style={styles.agentStatValue}>89</Text>
            <Text style={styles.agentStatLabel}>Insights</Text>
          </View>
        </View>
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
            <Text style={styles.roiValue}>{formatCurrency(28500, 'GBP')}</Text>
          </View>
          <View style={styles.roiItem}>
            <View style={styles.roiLabel}>
              <View style={[styles.roiDot, { backgroundColor: SemanticColors.feedbackInfo }]} />
              <Text style={styles.roiLabelText}>Faster Collections</Text>
            </View>
            <Text style={styles.roiValue}>{formatCurrency(12400, 'GBP')}</Text>
          </View>
          <View style={styles.roiItem}>
            <View style={styles.roiLabel}>
              <View style={[styles.roiDot, { backgroundColor: DIRECTOR_COLOR }]} />
              <Text style={styles.roiLabelText}>Error Prevention</Text>
            </View>
            <Text style={styles.roiValue}>{formatCurrency(7100, 'GBP')}</Text>
          </View>
        </View>

        <View style={styles.roiTotal}>
          <Text style={styles.roiTotalLabel}>Total ROI This Quarter</Text>
          <Text style={styles.roiTotalValue}>{formatCurrency(48000, 'GBP')}</Text>
        </View>
      </View>

      {/* Performance Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance Hub</Text>
        <View style={styles.hubGrid}>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/metrics' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
              <Ionicons name="analytics" size={22} color={Palette.hermesOrange} />
            </View>
            <Text style={styles.hubTitle}>Live Metrics</Text>
            <Text style={styles.hubStat}>Real-time data</Text>
          </Pressable>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/reports' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
              <Ionicons name="bar-chart" size={22} color={SemanticColors.feedbackInfo} />
            </View>
            <Text style={styles.hubTitle}>Reports</Text>
            <Text style={styles.hubStat}>Export & share</Text>
          </Pressable>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/appraisal' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
              <Ionicons name="calculator" size={22} color={SemanticColors.feedbackSuccess} />
            </View>
            <Text style={styles.hubTitle}>Appraisal</Text>
            <Text style={styles.hubStat}>IRR tracking</Text>
          </Pressable>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/metrics' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
              <Ionicons name="settings" size={22} color={DIRECTOR_COLOR} />
            </View>
            <Text style={styles.hubTitle}>Configure</Text>
            <Text style={styles.hubStat}>AI settings</Text>
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

        {/* Status Pills */}
        <View style={styles.statusPills}>
          <Pressable
            style={[styles.statusPill, activeTab === 'portfolio' && styles.statusPillActive]}
            onPress={() => setActiveTab('portfolio')}
          >
            <Ionicons name="business" size={14} color={activeTab === 'portfolio' ? DIRECTOR_COLOR : SemanticColors.textSecondary} />
            <Text style={[styles.statusPillText, activeTab === 'portfolio' && styles.statusPillTextActive]}>
              {portfolioMetrics.projectCount} Projects
            </Text>
          </Pressable>
          <Pressable
            style={[styles.statusPill, pendingApprovals > 0 && styles.statusPillWarning]}
            onPress={() => setActiveTab('approvals')}
          >
            <Ionicons name="checkmark-done" size={14} color={pendingApprovals > 0 ? SemanticColors.feedbackWarning : SemanticColors.textSecondary} />
            <Text style={[styles.statusPillText, pendingApprovals > 0 && { color: SemanticColors.feedbackWarning }]}>
              {pendingApprovals} Pending
            </Text>
          </Pressable>
          <Pressable
            style={[styles.statusPill, riskSummary.highCount > 0 && styles.statusPillDanger]}
            onPress={() => setActiveTab('risks')}
          >
            <Ionicons name="warning" size={14} color={riskSummary.highCount > 0 ? SemanticColors.feedbackError : SemanticColors.textSecondary} />
            <Text style={[styles.statusPillText, riskSummary.highCount > 0 && { color: SemanticColors.feedbackError }]}>
              {riskSummary.highCount} Risks
            </Text>
          </Pressable>
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
});
