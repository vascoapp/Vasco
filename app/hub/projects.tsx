// Hub: Projects - Portfolio overview with project cards and status tracking
import { useState } from 'react';
import { DEMO_MODE } from '../../src/config/demo';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { InlineInsight, VascoInsightCard } from '../../src/components/shared/VascoInsightCard';
import { useVascoGuidance, useInlineInsight } from '../../src/services/vascoGuidanceService';

type IconName = keyof typeof Ionicons.glyphMap;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ProjectStatus = 'On Track' | 'At Risk' | 'Behind';

interface ProjectHandover {
  completed: number;
  total: number;
}

interface Project {
  id: string;
  name: string;
  country: 'UK' | 'NL' | 'DE';
  flag: string;
  phase: string;
  completionPct: number;
  irr: number;
  status: ProjectStatus;
  handover: ProjectHandover;
}

// -----------------------------------------------------------------------------
// Mock data
// -----------------------------------------------------------------------------

const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Riverside Quarter',
    country: 'UK',
    flag: '🇬🇧',
    phase: 'Phase 3 - MEP',
    completionPct: 72,
    irr: 22.1,
    status: 'On Track',
    handover: { completed: 5, total: 8 },
  },
  {
    id: 'proj-2',
    name: 'Oak Gardens',
    country: 'UK',
    flag: '🇬🇧',
    phase: 'Phase 2 - Structure',
    completionPct: 45,
    irr: 19.8,
    status: 'At Risk',
    handover: { completed: 2, total: 6 },
  },
  {
    id: 'proj-3',
    name: 'Harbour View',
    country: 'NL',
    flag: '🇳🇱',
    phase: 'Phase 1 - Foundation',
    completionPct: 18,
    irr: 24.5,
    status: 'On Track',
    handover: { completed: 1, total: 4 },
  },
  {
    id: 'proj-4',
    name: 'Stadtmitte Residenz',
    country: 'DE',
    flag: '🇩🇪',
    phase: 'Pre-Construction',
    completionPct: 5,
    irr: 21.2,
    status: 'On Track',
    handover: { completed: 0, total: 3 },
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getStatusColor(status: ProjectStatus): string {
  switch (status) {
    case 'On Track':
      return SemanticColors.statusOnTrack;
    case 'At Risk':
      return SemanticColors.statusAtRisk;
    case 'Behind':
      return SemanticColors.statusCritical;
  }
}

function getStatusBg(status: ProjectStatus): string {
  switch (status) {
    case 'On Track':
      return SemanticColors.feedbackSuccessBg;
    case 'At Risk':
      return SemanticColors.feedbackWarningBg;
    case 'Behind':
      return SemanticColors.feedbackErrorBg;
  }
}

function getStatusIcon(status: ProjectStatus): IconName {
  switch (status) {
    case 'On Track':
      return 'checkmark-circle';
    case 'At Risk':
      return 'warning';
    case 'Behind':
      return 'alert-circle';
  }
}

// -----------------------------------------------------------------------------
// Portfolio stats
// -----------------------------------------------------------------------------

const PORTFOLIO_STATS = [
  { label: 'Active', value: '6', icon: 'business' as IconName },
  { label: 'At Risk', value: '2', icon: 'warning' as IconName, color: SemanticColors.statusAtRisk },
  { label: 'Total GDV', value: '£45.2M', icon: 'cash' as IconName },
  { label: 'Avg IRR', value: '18.5%', icon: 'trending-up' as IconName, color: SemanticColors.feedbackSuccess },
];

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ProjectsScreen() {
  const [projects] = useState(DEMO_MODE ? MOCK_PROJECTS : []);
  const insights = useVascoGuidance('cfo', 'cfo-projects');
  const inlineTip = useInlineInsight('cfo', 'cfo-projects', 'overview');
  const topInsight = insights[0] ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Portfolio Overview Stats */}
      <View style={styles.statsGrid}>
        {PORTFOLIO_STATS.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Ionicons
                name={stat.icon}
                size={16}
                color={stat.color || Palette.hermesOrange}
              />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* AI Insight */}
      {inlineTip && <InlineInsight icon={inlineTip.icon as IconName} message={inlineTip.message} />}
      {topInsight && <VascoInsightCard insight={topInsight} compact />}

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Projecten</Text>
        <Text style={styles.sectionCount}>{projects.length} projecten</Text>
      </View>

      {/* Project cards */}
      {projects.map((project) => (
        <Pressable key={project.id} style={styles.projectCard}>
          {/* Card header: name, flag, status badge */}
          <View style={styles.projectHeader}>
            <View style={styles.projectNameRow}>
              <Text style={styles.projectFlag}>{project.flag}</Text>
              <View style={styles.projectNameBlock}>
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={styles.projectPhase}>{project.phase}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusBg(project.status) }]}>
              <Ionicons
                name={getStatusIcon(project.status)}
                size={12}
                color={getStatusColor(project.status)}
              />
              <Text style={[styles.statusText, { color: getStatusColor(project.status) }]}>
                {project.status}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Completion</Text>
              <Text style={styles.progressValue}>{project.completionPct}%</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${project.completionPct}%`,
                    backgroundColor: getStatusColor(project.status),
                  },
                ]}
              />
            </View>
          </View>

          {/* Metrics row: IRR + Handover */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Ionicons name="trending-up" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.metricValue}>{project.irr}%</Text>
              <Text style={styles.metricLabel}>IRR</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Ionicons name="swap-horizontal" size={14} color={Palette.hermesOrange} />
              <Text style={styles.metricValue}>
                {project.handover.completed} of {project.handover.total}
              </Text>
              <Text style={styles.metricLabel}>Handover</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.countryCode}>{project.country}</Text>
            </View>
          </View>
        </Pressable>
      ))}

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

  // Stats grid (2x2)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 4,
  },
  statIconRow: {
    marginBottom: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  sectionCount: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Project card
  projectCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  projectNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  projectFlag: {
    fontSize: 24,
  },
  projectNameBlock: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  projectPhase: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Status badge
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

  // Progress
  progressSection: {
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Metrics row
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: Spacing.sm,
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  metricLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: SemanticColors.borderDefault,
  },
  countryCode: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    letterSpacing: 0.5,
  },
});
