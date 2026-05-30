// Hub: Schedule - Project timelines and fragility analysis
import { useState } from 'react';
import { DEMO_MODE } from '../../src/config/demo';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { InlineInsight, VascoInsightCard } from '../../src/components/shared/VascoInsightCard';
import { useVascoGuidance, useInlineInsight } from '../../src/services/vascoGuidanceService';

type IconName = keyof typeof Ionicons.glyphMap;

type ProjectStatus = 'on-track' | 'at-risk' | 'critical';

interface ProjectTimeline {
  id: string;
  name: string;
  phase: string;
  progress: number;
  spi: number;
  status: ProjectStatus;
  criticalItems: number;
  startDate: string;
  endDate: string;
  fragilityScore: number;
}

const MOCK_PROJECTS: ProjectTimeline[] = [
  {
    id: 'proj-1',
    name: 'Riverside Quarter',
    phase: 'Fase 3 — Afbouw',
    progress: 0.72,
    spi: 0.96,
    status: 'on-track',
    criticalItems: 1,
    startDate: 'Mar 2024',
    endDate: 'Nov 2025',
    fragilityScore: 28,
  },
  {
    id: 'proj-2',
    name: 'Oak Gardens',
    phase: 'Fase 2 — Ruwbouw',
    progress: 0.45,
    spi: 0.88,
    status: 'at-risk',
    criticalItems: 2,
    startDate: 'Jun 2024',
    endDate: 'Apr 2026',
    fragilityScore: 54,
  },
  {
    id: 'proj-3',
    name: 'Harbour View',
    phase: 'Fase 1 — Fundering',
    progress: 0.18,
    spi: 0.97,
    status: 'on-track',
    criticalItems: 0,
    startDate: 'Dec 2024',
    endDate: 'Aug 2026',
    fragilityScore: 15,
  },
];

function getStatusColor(status: ProjectStatus): string {
  switch (status) {
    case 'on-track': return SemanticColors.statusOnTrack;
    case 'at-risk': return SemanticColors.statusAtRisk;
    case 'critical': return SemanticColors.statusCritical;
  }
}

function getStatusLabel(status: ProjectStatus): string {
  switch (status) {
    case 'on-track': return 'Op schema';
    case 'at-risk': return 'Risico';
    case 'critical': return 'Kritiek';
  }
}

function getStatusIcon(status: ProjectStatus): IconName {
  switch (status) {
    case 'on-track': return 'checkmark-circle';
    case 'at-risk': return 'warning';
    case 'critical': return 'alert-circle';
  }
}

function getSpiColor(spi: number): string {
  if (spi >= 0.95) return SemanticColors.statusOnTrack;
  if (spi >= 0.90) return SemanticColors.statusAtRisk;
  return SemanticColors.statusCritical;
}

function getFragilityColor(score: number): string {
  if (score <= 30) return SemanticColors.statusOnTrack;
  if (score <= 50) return SemanticColors.statusAtRisk;
  return SemanticColors.statusCritical;
}

export default function ScheduleScreen() {
  const [projects] = useState(DEMO_MODE ? MOCK_PROJECTS : []);
  const insights = useVascoGuidance('coo', 'coo-schedule');
  const inlineTip = useInlineInsight('coo', 'coo-schedule', 'overview');
  const topInsight = insights[0] ?? null;

  const avgSpi = projects.reduce((sum, p) => sum + p.spi, 0) / projects.length;
  const totalCriticalItems = projects.reduce((sum, p) => sum + p.criticalItems, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: getSpiColor(avgSpi) }]}>
            {avgSpi.toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>SPI</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{projects.length}</Text>
          <Text style={styles.statLabel}>Actieve projecten</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: totalCriticalItems > 0 ? SemanticColors.statusCritical : SemanticColors.textPrimary }]}>
            {totalCriticalItems}
          </Text>
          <Text style={styles.statLabel}>Kritiek pad</Text>
        </View>
      </View>

      {inlineTip && <InlineInsight icon={inlineTip.icon as IconName} message={inlineTip.message} />}
      {topInsight && <VascoInsightCard insight={topInsight} compact />}

      {/* Project timeline cards */}
      {projects.map(project => (
        <Pressable key={project.id} style={styles.projectCard}>
          {/* Card header */}
          <View style={styles.projectHeader}>
            <View style={styles.projectNameRow}>
              <Text style={styles.projectName}>{project.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) + '18' }]}>
                <Ionicons
                  name={getStatusIcon(project.status)}
                  size={12}
                  color={getStatusColor(project.status)}
                />
                <Text style={[styles.statusText, { color: getStatusColor(project.status) }]}>
                  {getStatusLabel(project.status)}
                </Text>
              </View>
            </View>
            <Text style={styles.projectPhase}>{project.phase}</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Voortgang</Text>
              <Text style={styles.progressValue}>{Math.round(project.progress * 100)}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.round(project.progress * 100)}%`,
                    backgroundColor: getStatusColor(project.status),
                  },
                ]}
              />
            </View>
          </View>

          {/* Metrics row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>SPI</Text>
              <Text style={[styles.metricValue, { color: getSpiColor(project.spi) }]}>
                {project.spi.toFixed(2)}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Fragiliteit</Text>
              <Text style={[styles.metricValue, { color: getFragilityColor(project.fragilityScore) }]}>
                {project.fragilityScore}/100
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Kritieke items</Text>
              <Text style={[styles.metricValue, { color: project.criticalItems > 0 ? SemanticColors.statusCritical : SemanticColors.textPrimary }]}>
                {project.criticalItems}
              </Text>
            </View>
          </View>

          {/* Timeline footer */}
          <View style={styles.timelineRow}>
            <Ionicons name="calendar-outline" size={13} color={SemanticColors.textTertiary} />
            <Text style={styles.timelineText}>{project.startDate} — {project.endDate}</Text>
          </View>
        </Pressable>
      ))}

      {/* Empty state */}
      {projects.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={SemanticColors.textTertiary} />
          <Text style={styles.emptyTitle}>Geen projecten</Text>
          <Text style={styles.emptySubtext}>Er zijn momenteel geen actieve projectplanningen</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  content: { padding: Spacing.md, gap: Spacing.md },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: SemanticColors.textPrimary },
  statLabel: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 2 },

  // Project card
  projectCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  projectHeader: { gap: 4 },
  projectNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectName: { fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary, flex: 1 },
  projectPhase: { fontSize: 13, color: SemanticColors.textTertiary },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: '600' },

  // Progress
  progressSection: { gap: 6 },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: { fontSize: 12, color: SemanticColors.textTertiary },
  progressValue: { fontSize: 13, fontWeight: '600', color: SemanticColors.textPrimary },
  progressBarBg: {
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
  metricItem: { flex: 1, alignItems: 'center', gap: 2 },
  metricLabel: { fontSize: 11, color: SemanticColors.textTertiary },
  metricValue: { fontSize: 14, fontWeight: '700', color: SemanticColors.textPrimary },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: SemanticColors.borderDefault,
  },

  // Timeline
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineText: { fontSize: 12, color: SemanticColors.textTertiary },

  // Empty state
  emptyState: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: SemanticColors.textPrimary },
  emptySubtext: { fontSize: 14, color: SemanticColors.textTertiary },
});
