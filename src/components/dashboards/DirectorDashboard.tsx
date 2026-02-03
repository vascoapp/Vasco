import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import {
  DashboardHeader,
  AlertBanner,
  QuickActionsBar,
  MetricCard,
  HubNavigationGrid,
  HubNavigationCard,
} from '../shared';
import {
  mockProjects,
  mockAppraisals,
} from '../../data/mockProjects';
import { formatCurrency, formatPercent } from '../../modules/countryModules';

// Role color for Director
const DIRECTOR_COLOR = '#8B5CF6'; // Purple

export function DirectorDashboard() {
  const { user } = useAuth();

  // Calculate portfolio metrics
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

  // Platform performance metrics (simulated)
  const platformMetrics = useMemo(() => ({
    hoursSaved: 127,
    valueDelivered: 48000,
    docAccuracy: 0.92,
    avgDsoReduction: 4.2,
  }), []);

  // Alerts - items requiring attention
  const alerts = useMemo(() => {
    const items = [];

    // Pending approvals
    items.push({
      id: 'alert-1',
      title: '3 approvals pending your signature',
      subtitle: '2 high-value change orders, 1 critical deadline',
    });

    // Risk alerts
    const highRisks = mockProjects.flatMap(p =>
      p.risks.filter(r => r.score >= 12 && r.status !== 'closed')
    );
    if (highRisks.length > 0) {
      items.push({
        id: 'alert-2',
        title: `${highRisks.length} high-score risks require attention`,
        subtitle: highRisks.slice(0, 2).map(r => r.category).join(', '),
      });
    }

    // Reports ready
    items.push({
      id: 'alert-3',
      title: 'Investor update ready for review',
      subtitle: 'Monthly report - One Broadgate Place',
    });

    return items;
  }, []);

  // Counts for navigation stats
  const pendingApprovals = 3; // Simulated
  const highRiskCount = mockProjects.flatMap(p => p.risks.filter(r => r.score >= 12)).length;

  const quickActions = [
    {
      id: 'portfolio-report',
      label: 'Reports',
      icon: '📊',
      onPress: () => {},
      badge: 0,
    },
    {
      id: 'approve-all',
      label: 'Approvals',
      icon: '✓',
      onPress: () => {},
      badge: pendingApprovals,
    },
    {
      id: 'risk-review',
      label: 'Risks',
      icon: '⚠️',
      onPress: () => {},
      badge: highRiskCount,
    },
  ];

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <DashboardHeader
        greeting={`${greeting}, ${user?.name?.split(' ')[0] || 'Director'}`}
        title="Portfolio Overview"
        roleLabel="Director"
        roleColor={DIRECTOR_COLOR}
      />

      {/* Alerts */}
      {alerts.length > 0 && (
        <AlertBanner
          severity="warning"
          title="Requires Attention"
          items={alerts}
          maxItems={3}
        />
      )}

      {/* Quick Actions */}
      <QuickActionsBar actions={quickActions} roleColor={DIRECTOR_COLOR} />

      {/* Key Metrics */}
      <View style={styles.metricsGrid}>
        <MetricCard
          value={formatCurrency(portfolioMetrics.totalGdv, 'GBP')}
          label="Total GDV"
          color={Colors.success}
        />
        <MetricCard
          value={formatPercent(portfolioMetrics.avgIrr)}
          label="Avg IRR"
          color={DIRECTOR_COLOR}
        />
        <MetricCard
          value={platformMetrics.hoursSaved.toString()}
          label="Hours Saved"
          trend="up"
          trendValue="+12%"
        />
        <MetricCard
          value={formatCurrency(platformMetrics.valueDelivered, 'GBP')}
          label="Value Delivered"
          trend="up"
        />
      </View>

      {/* Hub Navigation */}
      <HubNavigationGrid>
        <HubNavigationCard
          icon="checkmark-done"
          title="Approvals"
          stat={`${pendingApprovals} pending`}
          route="/hub/approvals"
          color={DIRECTOR_COLOR}
        />
        <HubNavigationCard
          icon="warning"
          title="Risks"
          stat={`${highRiskCount} high`}
          route="/hub/risks"
          color={Colors.warning}
        />
        <HubNavigationCard
          icon="stats-chart"
          title="Appraisal"
          route="/hub/appraisal"
          color={Colors.success}
        />
        <HubNavigationCard
          icon="cash"
          title="Cost Control"
          route="/hub/costs"
          color={Colors.success}
        />
        <HubNavigationCard
          icon="calendar"
          title="Schedule"
          route="/hub/schedule"
          color="#3B82F6"
        />
        <HubNavigationCard
          icon="document-text"
          title="Reports"
          route="/hub/reports"
          color={DIRECTOR_COLOR}
        />
      </HubNavigationGrid>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.sm,
    gap: Spacing.sm,
    paddingBottom: 100,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
});
