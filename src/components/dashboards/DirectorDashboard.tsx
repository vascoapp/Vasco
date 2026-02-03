// =============================================================================
// DIRECTOR DASHBOARD - Portfolio Overview & Strategic Decisions
// =============================================================================
// Executive portfolio dashboard for real estate development Directors
// Focus: Portfolio health, Approvals, Risk oversight, Platform ROI
// =============================================================================

import { useMemo } from 'react';
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

type IconName = keyof typeof Ionicons.glyphMap;

// Role color
const DIRECTOR_COLOR = '#8B5CF6'; // Purple for strategic

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

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

export function DirectorDashboard() {
  const router = useRouter();
  const { user } = useAuth();

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
      topRisks: highRisks.slice(0, 3),
    };
  }, []);

  // Platform metrics
  const platformMetrics = useMemo(() => ({
    hoursSaved: 127,
    valueDelivered: 48000,
    docAccuracy: 0.92,
    avgDsoReduction: 4.2,
  }), []);

  // Pending approvals
  const pendingApprovals = 3;

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
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

      {/* Attention Required */}
      <View style={styles.alertCard}>
        <View style={styles.alertHeader}>
          <Ionicons name="alert-circle" size={20} color={SemanticColors.feedbackWarning} />
          <Text style={styles.alertTitle}>Requires Attention</Text>
          <View style={styles.alertCount}>
            <Text style={styles.alertCountText}>{pendingApprovals + riskSummary.highCount}</Text>
          </View>
        </View>
        <View style={styles.alertList}>
          <Pressable style={styles.alertItem} onPress={() => router.push('/hub/approvals' as any)}>
            <View style={[styles.alertDot, { backgroundColor: SemanticColors.feedbackError }]} />
            <View style={styles.alertContent}>
              <Text style={styles.alertText}>{pendingApprovals} approvals pending your signature</Text>
              <Text style={styles.alertMeta}>2 high-value, 1 critical deadline</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.alertItem} onPress={() => router.push('/hub/risks' as any)}>
            <View style={[styles.alertDot, { backgroundColor: SemanticColors.feedbackWarning }]} />
            <View style={styles.alertContent}>
              <Text style={styles.alertText}>{riskSummary.highCount} high-score risks</Text>
              <Text style={styles.alertMeta}>Require attention across portfolio</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.alertItem} onPress={() => router.push('/hub/reports' as any)}>
            <View style={[styles.alertDot, { backgroundColor: DIRECTOR_COLOR }]} />
            <View style={styles.alertContent}>
              <Text style={styles.alertText}>Investor update ready for review</Text>
              <Text style={styles.alertMeta}>Monthly report - One Broadgate Place</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
          </Pressable>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          <QuickAction
            icon="checkmark-done"
            label="Approvals"
            badge={pendingApprovals}
            onPress={() => router.push('/hub/approvals' as any)}
          />
          <QuickAction
            icon="warning"
            label="Risks"
            badge={riskSummary.highCount}
            onPress={() => router.push('/hub/risks' as any)}
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
            onPress={() => router.push('/hub/metrics' as any)}
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

      {/* Platform Performance */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Ionicons name="sparkles" size={18} color={Palette.hermesOrange} />
          </View>
          <Text style={styles.cardTitle}>Platform Performance</Text>
        </View>

        <View style={styles.platformGrid}>
          <View style={styles.platformItem}>
            <Text style={styles.platformValue}>{platformMetrics.hoursSaved}</Text>
            <Text style={styles.platformLabel}>Hours Saved</Text>
          </View>
          <View style={styles.platformItem}>
            <Text style={styles.platformValue}>
              {formatCurrency(platformMetrics.valueDelivered, 'GBP')}
            </Text>
            <Text style={styles.platformLabel}>Value Delivered</Text>
          </View>
          <View style={styles.platformItem}>
            <Text style={styles.platformValue}>{formatPercent(platformMetrics.docAccuracy)}</Text>
            <Text style={styles.platformLabel}>Doc Accuracy</Text>
          </View>
          <View style={styles.platformItem}>
            <Text style={styles.platformValue}>{platformMetrics.avgDsoReduction}d</Text>
            <Text style={styles.platformLabel}>DSO Reduction</Text>
          </View>
        </View>
      </View>

      {/* Hub Navigation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Strategic Hub</Text>
        <View style={styles.hubGrid}>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/approvals' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: DIRECTOR_COLOR + '15' }]}>
              <Ionicons name="checkmark-done" size={22} color={DIRECTOR_COLOR} />
            </View>
            <Text style={styles.hubTitle}>Approvals</Text>
            <Text style={styles.hubStat}>{pendingApprovals} pending</Text>
          </Pressable>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/risks' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
              <Ionicons name="warning" size={22} color={SemanticColors.feedbackWarning} />
            </View>
            <Text style={styles.hubTitle}>Risks</Text>
            <Text style={styles.hubStat}>{riskSummary.highCount} high</Text>
          </Pressable>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/appraisal' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
              <Ionicons name="stats-chart" size={22} color={SemanticColors.feedbackSuccess} />
            </View>
            <Text style={styles.hubTitle}>Appraisal</Text>
            <Text style={styles.hubStat}>Portfolio</Text>
          </Pressable>
          <Pressable style={styles.hubCard} onPress={() => router.push('/hub/reports' as any)}>
            <View style={[styles.hubIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
              <Ionicons name="document-text" size={22} color={SemanticColors.feedbackInfo} />
            </View>
            <Text style={styles.hubTitle}>Reports</Text>
            <Text style={styles.hubStat}>1 ready</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
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
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },

  // Header
  header: {
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
    fontSize: 28,
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

  // Alert Card
  alertCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackWarningBorder,
    gap: Spacing.md,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  alertTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  alertCount: {
    backgroundColor: SemanticColors.feedbackWarning,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  alertList: {
    gap: 4,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  alertMeta: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
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

  // Platform Grid
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  platformItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  platformValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },
  platformLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 2,
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
});
