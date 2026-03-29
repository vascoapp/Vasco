import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import {
  mockProjects,
  mockSiteMetrics,
  getProjectById,
} from '../../data/mockProjects';

const SITE_LEAD_COLOR = '#D2691E'; // Terracotta for Site Lead (per theme)

export function ProgressDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const siteMetrics = useMemo(() => mockSiteMetrics[selectedProjectId], [selectedProjectId]);

  const progressHealth = useMemo(() => {
    if (!siteMetrics) return null;
    return {
      overallProgress: siteMetrics.overallPercentComplete,
      plannedProgress: siteMetrics.plannedPercentComplete,
      variance: siteMetrics.progressVariance,
      status:
        siteMetrics.progressVariance >= -2
          ? 'on-track'
          : siteMetrics.progressVariance >= -5
          ? 'at-risk'
          : 'behind',
    };
  }, [siteMetrics]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track':
        return SemanticColors.feedbackSuccess;
      case 'at-risk':
        return SemanticColors.feedbackWarning;
      case 'behind':
        return SemanticColors.feedbackError;
      default:
        return SemanticColors.textSecondary;
    }
  };

  if (!selectedProject || !siteMetrics || !progressHealth) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const activeActivities = selectedProject.scheduleActivities.filter(
    (a) => a.status === 'in-progress'
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Project Selector */}
      <View style={styles.projectSelector}>
        {mockProjects
          .filter((p) => mockSiteMetrics[p.id])
          .map((project) => (
            <Pressable
              key={project.id}
              style={[
                styles.projectPill,
                selectedProjectId === project.id && styles.projectPillActive,
              ]}
              onPress={() => setSelectedProjectId(project.id)}
            >
              <Text style={styles.projectCountry}>{project.country}</Text>
              <Text
                style={[
                  styles.projectName,
                  selectedProjectId === project.id && styles.projectNameActive,
                ]}
                numberOfLines={1}
              >
                {project.name}
              </Text>
            </Pressable>
          ))}
      </View>

      {/* Main Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Overall Progress</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(progressHealth.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(progressHealth.status) }]}>
              {progressHealth.status.replace('-', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.progressCircle}>
          <Text style={[styles.progressValue, { color: SITE_LEAD_COLOR }]}>
            {progressHealth.overallProgress}%
          </Text>
          <Text style={styles.progressLabel}>Complete</Text>
        </View>

        <View style={styles.comparisonBars}>
          <View style={styles.progressBarRow}>
            <Text style={styles.barLabel}>Actual</Text>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFillActual, { width: `${progressHealth.overallProgress}%` }]}
              />
            </View>
            <Text style={styles.barValue}>{progressHealth.overallProgress}%</Text>
          </View>
          <View style={styles.progressBarRow}>
            <Text style={styles.barLabel}>Planned</Text>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFillPlan, { width: `${progressHealth.plannedProgress}%` }]}
              />
            </View>
            <Text style={styles.barValue}>{progressHealth.plannedProgress}%</Text>
          </View>
        </View>

        <View style={styles.varianceRow}>
          <Text style={styles.varianceLabel}>Variance</Text>
          <Text style={[styles.varianceValue, { color: getStatusColor(progressHealth.status) }]}>
            {progressHealth.variance > 0 ? '+' : ''}{progressHealth.variance}%
          </Text>
        </View>
      </View>

      {/* Active Work Fronts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Work Fronts ({activeActivities.length})</Text>
        <View style={styles.activityList}>
          {activeActivities.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={styles.activityInfo}>
                <Text style={styles.activityName}>{activity.name}</Text>
                <Text style={styles.activityWbs}>{activity.wbsCode}</Text>
              </View>
              <View style={styles.activityProgress}>
                <View style={styles.activityBar}>
                  <View
                    style={[styles.activityFill, { width: `${activity.percentComplete}%` }]}
                  />
                </View>
                <Text style={styles.activityPercent}>{activity.percentComplete}%</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.sm,
    gap: Spacing.sm,
    paddingBottom: 100,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.titleSize,
  },
  projectSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  projectPill: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  projectPillActive: {
    borderColor: SITE_LEAD_COLOR,
  },
  projectCountry: {
    color: SITE_LEAD_COLOR,
    fontSize: TYPE.tinySize - 1,
    fontWeight: '700',
  },
  projectName: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  projectNameActive: {
    color: SemanticColors.textPrimary,
  },
  progressCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  statusText: {
    fontSize: TYPE.tinySize,
    fontWeight: '700',
  },
  progressCircle: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  progressValue: {
    fontSize: 48,
    fontWeight: '700',
  },
  progressLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
    marginTop: 4,
  },
  comparisonBars: {
    gap: Spacing.sm,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  barLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    width: 50,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFillActual: {
    height: '100%',
    backgroundColor: SITE_LEAD_COLOR,
    borderRadius: 5,
  },
  barFillPlan: {
    height: '100%',
    backgroundColor: SemanticColors.textSecondary,
    borderRadius: 5,
  },
  barValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  varianceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  varianceLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
  },
  varianceValue: {
    fontSize: TYPE.titleSize,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityList: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '500',
  },
  activityWbs: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    marginTop: 2,
  },
  activityProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  activityBar: {
    width: 60,
    height: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  activityFill: {
    height: '100%',
    backgroundColor: SITE_LEAD_COLOR,
    borderRadius: 3,
  },
  activityPercent: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    width: 35,
    textAlign: 'right',
  },
});
