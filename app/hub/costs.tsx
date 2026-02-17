// Hub: Costs - Portfolio cost overview with project breakdowns and contingency tracking
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { InlineInsight, VascoInsightCard } from '../../src/components/shared/VascoInsightCard';
import { useVascoGuidance, useInlineInsight } from '../../src/services/vascoGuidanceService';

type IconName = keyof typeof Ionicons.glyphMap;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type CostStatus = 'On Budget' | 'Over Budget' | 'Under Budget';

interface ProjectCost {
  id: string;
  name: string;
  budget: number;
  spent: number;
  cpi: number;
  status: CostStatus;
}

// -----------------------------------------------------------------------------
// Mock data
// -----------------------------------------------------------------------------

const PROJECTS: ProjectCost[] = [
  { id: 'p1', name: 'Riverside Quarter', budget: 18500000, spent: 12800000, cpi: 0.97, status: 'Over Budget' },
  { id: 'p2', name: 'Oak Gardens', budget: 14200000, spent: 8400000, cpi: 1.04, status: 'Under Budget' },
  { id: 'p3', name: 'Harbour View', budget: 12500000, spent: 7500000, cpi: 1.00, status: 'On Budget' },
];

const CONTINGENCY = {
  total: 4500000,
  used: 1800000,
  remaining: 2700000,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `£${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `£${(value / 1_000).toFixed(0)}K`;
  }
  return `£${value.toLocaleString()}`;
}

function getStatusColor(status: CostStatus): string {
  switch (status) {
    case 'On Budget': return SemanticColors.feedbackSuccess;
    case 'Over Budget': return SemanticColors.feedbackError;
    case 'Under Budget': return SemanticColors.statusPending;
  }
}

function getStatusIcon(status: CostStatus): IconName {
  switch (status) {
    case 'On Budget': return 'checkmark-circle';
    case 'Over Budget': return 'alert-circle';
    case 'Under Budget': return 'trending-down';
  }
}

function getCPIColor(cpi: number): string {
  if (cpi >= 1.02) return SemanticColors.feedbackSuccess;
  if (cpi >= 0.98) return SemanticColors.feedbackWarning;
  return SemanticColors.feedbackError;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CostsScreen() {
  const insights = useVascoGuidance('cfo', 'cfo-costs');
  const inlineTip = useInlineInsight('cfo', 'cfo-costs', 'budget');
  const contingencyTip = useInlineInsight('cfo', 'cfo-costs', 'contingency');
  const topInsight = insights[0] ?? null;

  const totalBudget = 45200000;
  const totalSpent = 28700000;
  const spentPercent = Math.round((totalSpent / totalBudget) * 100);
  const variance = -1300000;

  const contingencyPercent = Math.round((CONTINGENCY.used / CONTINGENCY.total) * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Portfolio Cost Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Ionicons name="wallet-outline" size={20} color={Palette.hermesOrange} />
          <Text style={styles.summaryTitle}>Portfolio Kostenanalyse</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Totaal Budget</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalBudget)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Totaal Besteed</Text>
            <View style={styles.summaryValueRow}>
              <Text style={styles.summaryValue}>{formatCurrency(totalSpent)}</Text>
              <Text style={styles.summaryPercent}>{spentPercent}%</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Afwijking</Text>
            <Text style={[styles.summaryValue, { color: SemanticColors.feedbackError }]}>
              -£1.3M
            </Text>
          </View>
        </View>

        {/* Overall progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${spentPercent}%` }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabelLeft}>Besteed</Text>
          <Text style={styles.progressLabelRight}>{100 - spentPercent}% resterend</Text>
        </View>
      </View>

      {/* Vasco AI Guidance */}
      {inlineTip && <InlineInsight icon={inlineTip.icon as IconName} message={inlineTip.message} />}
      {topInsight && <VascoInsightCard insight={topInsight} compact />}

      {/* Section Header - Project Costs */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Projectkosten</Text>
        <Text style={styles.sectionSubtitle}>{PROJECTS.length} projecten</Text>
      </View>

      {/* Project Cost Cards */}
      {PROJECTS.map((project) => {
        const projectPercent = Math.round((project.spent / project.budget) * 100);
        const statusColor = getStatusColor(project.status);
        const statusIcon = getStatusIcon(project.status);
        const cpiColor = getCPIColor(project.cpi);

        return (
          <View key={project.id} style={styles.projectCard}>
            <View style={styles.projectHeader}>
              <Text style={styles.projectName}>{project.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                <Ionicons name={statusIcon} size={12} color={statusColor} />
                <Text style={[styles.statusText, { color: statusColor }]}>{project.status}</Text>
              </View>
            </View>

            <View style={styles.projectMetrics}>
              <View style={styles.projectMetric}>
                <Text style={styles.metricLabel}>Budget</Text>
                <Text style={styles.metricValue}>{formatCurrency(project.budget)}</Text>
              </View>
              <View style={styles.projectMetric}>
                <Text style={styles.metricLabel}>Besteed</Text>
                <Text style={styles.metricValue}>{formatCurrency(project.spent)}</Text>
              </View>
              <View style={styles.projectMetric}>
                <Text style={styles.metricLabel}>CPI</Text>
                <Text style={[styles.metricValue, { color: cpiColor }]}>
                  {project.cpi.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Project progress bar */}
            <View style={styles.projectProgressTrack}>
              <View
                style={[
                  styles.projectProgressFill,
                  {
                    width: `${Math.min(projectPercent, 100)}%`,
                    backgroundColor: statusColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.projectPercent}>{projectPercent}% van budget besteed</Text>
          </View>
        );
      })}

      {/* Section Header - Contingency */}
      {contingencyTip && <InlineInsight icon={contingencyTip.icon as IconName} message={contingencyTip.message} />}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Contingency Tracker</Text>
      </View>

      {/* Contingency Card */}
      <View style={styles.contingencyCard}>
        <View style={styles.contingencyHeader}>
          <Ionicons name="umbrella-outline" size={18} color={Palette.hermesOrange} />
          <Text style={styles.contingencyTitle}>Reservefonds</Text>
        </View>

        <View style={styles.contingencyMetrics}>
          <View style={styles.contingencyMetric}>
            <Text style={styles.contingencyMetricLabel}>Totaal Contingency</Text>
            <Text style={styles.contingencyMetricValue}>{formatCurrency(CONTINGENCY.total)}</Text>
          </View>
          <View style={styles.contingencyMetric}>
            <Text style={styles.contingencyMetricLabel}>Gebruikt</Text>
            <Text style={[styles.contingencyMetricValue, { color: SemanticColors.feedbackWarning }]}>
              {formatCurrency(CONTINGENCY.used)}
            </Text>
          </View>
          <View style={styles.contingencyMetric}>
            <Text style={styles.contingencyMetricLabel}>Resterend</Text>
            <Text style={[styles.contingencyMetricValue, { color: SemanticColors.feedbackSuccess }]}>
              {formatCurrency(CONTINGENCY.remaining)}
            </Text>
          </View>
        </View>

        {/* Contingency progress bar */}
        <View style={styles.contingencyProgressTrack}>
          <View
            style={[
              styles.contingencyProgressFill,
              { width: `${contingencyPercent}%` },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabelLeft}>{contingencyPercent}% gebruikt</Text>
          <Text style={styles.progressLabelRight}>{100 - contingencyPercent}% beschikbaar</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Portfolio Summary
  summaryCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    gap: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  summaryPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textTertiary,
  },

  // Progress Bar (shared)
  progressTrack: {
    height: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabelLeft: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  progressLabelRight: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Section Header
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
  sectionSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Project Cards
  projectCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 10,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  projectMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  projectMetric: {
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  projectProgressTrack: {
    height: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  projectProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  projectPercent: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Contingency
  contingencyCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  contingencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contingencyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  contingencyMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contingencyMetric: {
    gap: 2,
  },
  contingencyMetricLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  contingencyMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  contingencyProgressTrack: {
    height: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  contingencyProgressFill: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackWarning,
    borderRadius: 3,
  },
});
