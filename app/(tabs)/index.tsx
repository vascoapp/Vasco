import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import {
  CFODashboard,
  COODashboard,
  SiteLeadDashboard,
  ContractorDashboard,
} from '../../src/components/dashboards';
import { useAuth, ROLE_CONFIGS } from '../../src/context/AuthContext';
import { Colors } from '../../src/theme/colors';
import { Radius } from '../../src/theme/radius';
import { Spacing } from '../../src/theme/spacing';
import { Typography } from '../../src/theme/typography';

// Director gets a portfolio overview
function DirectorDashboard() {
  const { user, roleConfig } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning, {user?.name.split(' ')[0]}</Text>
          <Text style={Typography.title}>Portfolio Overview</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: roleConfig?.primaryColor + '20' }]}>
          <Text style={[styles.roleBadgeText, { color: roleConfig?.primaryColor }]}>
            {roleConfig?.label}
          </Text>
        </View>
      </View>

      {/* Portfolio Summary */}
      <View style={styles.portfolioCard}>
        <Text style={styles.cardTitle}>Active Projects</Text>
        <View style={styles.portfolioGrid}>
          <View style={styles.portfolioItem}>
            <Text style={styles.portfolioValue}>3</Text>
            <Text style={styles.portfolioLabel}>Projects</Text>
          </View>
          <View style={styles.portfolioDivider} />
          <View style={styles.portfolioItem}>
            <Text style={[styles.portfolioValue, { color: Colors.success }]}>£127M</Text>
            <Text style={styles.portfolioLabel}>GDV</Text>
          </View>
          <View style={styles.portfolioDivider} />
          <View style={styles.portfolioItem}>
            <Text style={styles.portfolioValue}>18.2%</Text>
            <Text style={styles.portfolioLabel}>Avg IRR</Text>
          </View>
        </View>
      </View>

      {/* Attention Required */}
      <View style={styles.attentionCard}>
        <Text style={styles.cardTitle}>Requires Your Attention</Text>
        <View style={styles.attentionList}>
          <View style={styles.attentionItem}>
            <View style={[styles.attentionDot, { backgroundColor: Colors.danger }]} />
            <View style={styles.attentionContent}>
              <Text style={styles.attentionText}>3 approvals pending your signature</Text>
              <Text style={styles.attentionMeta}>2 high-value, 1 critical deadline</Text>
            </View>
          </View>
          <View style={styles.attentionItem}>
            <View style={[styles.attentionDot, { backgroundColor: Colors.warning }]} />
            <View style={styles.attentionContent}>
              <Text style={styles.attentionText}>2 risks trending worsening</Text>
              <Text style={styles.attentionMeta}>Contractor insolvency, Material costs</Text>
            </View>
          </View>
          <View style={styles.attentionItem}>
            <View style={[styles.attentionDot, { backgroundColor: Colors.accentMuted }]} />
            <View style={styles.attentionContent}>
              <Text style={styles.attentionText}>Investor update ready for review</Text>
              <Text style={styles.attentionMeta}>Monthly report - Whitechapel</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsCard}>
        <Text style={styles.cardTitle}>Platform Performance</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>127</Text>
            <Text style={styles.metricLabel}>Hours Saved</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>£48K</Text>
            <Text style={styles.metricLabel}>Value Delivered</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>92%</Text>
            <Text style={styles.metricLabel}>Doc Accuracy</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>4.2d</Text>
            <Text style={styles.metricLabel}>Avg DSO Reduction</Text>
          </View>
        </View>
      </View>

      {/* Project Status */}
      <View style={styles.projectsCard}>
        <Text style={styles.cardTitle}>Project Health</Text>
        <View style={styles.projectList}>
          <View style={styles.projectItem}>
            <View style={styles.projectInfo}>
              <Text style={styles.projectName}>Whitechapel Mixed-Use</Text>
              <Text style={styles.projectMeta}>UK | Construction</Text>
            </View>
            <View style={[styles.projectStatus, { backgroundColor: Colors.success + '20' }]}>
              <Text style={[styles.projectStatusText, { color: Colors.success }]}>On Track</Text>
            </View>
          </View>
          <View style={styles.projectItem}>
            <View style={styles.projectInfo}>
              <Text style={styles.projectName}>Amsterdam Residential</Text>
              <Text style={styles.projectMeta}>NL | Pre-construction</Text>
            </View>
            <View style={[styles.projectStatus, { backgroundColor: Colors.warning + '20' }]}>
              <Text style={[styles.projectStatusText, { color: Colors.warning }]}>At Risk</Text>
            </View>
          </View>
          <View style={styles.projectItem}>
            <View style={styles.projectInfo}>
              <Text style={styles.projectName}>Munich Office</Text>
              <Text style={styles.projectMeta}>DE | Planning</Text>
            </View>
            <View style={[styles.projectStatus, { backgroundColor: Colors.success + '20' }]}>
              <Text style={[styles.projectStatusText, { color: Colors.success }]}>On Track</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

export default function HomeScreen() {
  const { user, roleConfig } = useAuth();

  if (!user) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  // Render role-specific dashboard
  const renderDashboard = () => {
    switch (user.role) {
      case 'cfo':
        return (
          <>
            <RoleHeader />
            <CFODashboard />
          </>
        );
      case 'coo':
        return (
          <COODashboard initialTab="overview" showTabBar={false} />
        );
      case 'site-lead':
        return (
          <>
            <RoleHeader />
            <SiteLeadDashboard />
          </>
        );
      case 'director':
        return <DirectorDashboard />;
      case 'contractor':
        return <ContractorDashboard />;
      default:
        return <DirectorDashboard />;
    }
  };

  return <Screen>{renderDashboard()}</Screen>;
}

function RoleHeader() {
  const { user, roleConfig } = useAuth();

  return (
    <View style={styles.roleHeader}>
      <View>
        <Text style={styles.greeting}>Good morning, {user?.name.split(' ')[0]}</Text>
        <Text style={styles.roleTitle}>{roleConfig?.title}</Text>
      </View>
      <View style={[styles.roleBadge, { backgroundColor: roleConfig?.primaryColor + '20' }]}>
        <Text style={[styles.roleBadgeText, { color: roleConfig?.primaryColor }]}>
          {roleConfig?.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.muted,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  greeting: {
    color: Colors.muted,
    fontSize: 14,
    marginBottom: 4,
  },
  roleTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  portfolioCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  portfolioGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  portfolioItem: {
    alignItems: 'center',
  },
  portfolioValue: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  portfolioLabel: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  portfolioDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  attentionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  attentionList: {
    gap: Spacing.sm,
  },
  attentionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  attentionDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
    marginTop: 5,
  },
  attentionContent: {
    flex: 1,
  },
  attentionText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  attentionMeta: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  metricsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  metricValue: {
    color: Colors.accentDeep,
    fontSize: 22,
    fontWeight: '700',
  },
  metricLabel: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  projectsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  projectList: {
    gap: Spacing.sm,
  },
  projectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  projectMeta: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  projectStatus: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  projectStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
