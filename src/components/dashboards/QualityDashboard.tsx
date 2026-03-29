import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import {
  mockProjects,
  mockSiteMetrics,
  getProjectById,
} from '../../data/mockProjects';

const SITE_LEAD_COLOR = '#D2691E'; // Terracotta for Site Lead (per theme)

export function QualityDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const siteMetrics = useMemo(() => mockSiteMetrics[selectedProjectId], [selectedProjectId]);

  const getRiskColor = (score: number) => {
    if (score >= 12) return SemanticColors.feedbackError;
    if (score >= 6) return SemanticColors.feedbackWarning;
    return SemanticColors.feedbackSuccess;
  };

  if (!selectedProject || !siteMetrics) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const openRisks = selectedProject.risks.filter((r) => r.status !== 'closed');

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

      {/* Summary Grid */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: SemanticColors.feedbackWarning }]}>
            {siteMetrics.defectsOpenTotal}
          </Text>
          <Text style={styles.summaryLabel}>Open Defects</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: SemanticColors.feedbackSuccess }]}>
            {siteMetrics.defectsClosedTotal}
          </Text>
          <Text style={styles.summaryLabel}>Closed</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{siteMetrics.openConstraints}</Text>
          <Text style={styles.summaryLabel}>Constraints</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: SemanticColors.feedbackSuccess }]}>
            {siteMetrics.constraintsClearedThisWeek}
          </Text>
          <Text style={styles.summaryLabel}>Cleared (Week)</Text>
        </View>
      </View>

      {/* RFI Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RFI Status</Text>
        <View style={styles.rfiCard}>
          <View style={styles.rfiHeader}>
            <View style={styles.rfiCircle}>
              <Text style={[styles.rfiValue, { color: siteMetrics.openRfis > 10 ? SemanticColors.feedbackWarning : SITE_LEAD_COLOR }]}>
                {siteMetrics.openRfis}
              </Text>
              <Text style={styles.rfiLabel}>Open</Text>
            </View>
            <View style={styles.rfiDetails}>
              <View style={styles.rfiRow}>
                <Text style={styles.rfiRowLabel}>Avg Response Time</Text>
                <Text style={styles.rfiRowValue}>{siteMetrics.avgRfiResponseDays} days</Text>
              </View>
              <View style={styles.rfiRow}>
                <Text style={styles.rfiRowLabel}>Target</Text>
                <Text style={styles.rfiRowValue}>7 days</Text>
              </View>
            </View>
          </View>
          {siteMetrics.openRfis > 10 && (
            <View style={styles.rfiWarning}>
              <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackWarning} />
              <Text style={styles.rfiWarningText}>
                High RFI backlog - prioritize responses
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Active Risks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Risks</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{openRisks.length}</Text>
          </View>
        </View>
        <View style={styles.riskList}>
          {openRisks
            .sort((a, b) => b.score - a.score)
            .map((risk) => (
              <View key={risk.id} style={styles.riskItem}>
                <View style={[styles.riskScore, { backgroundColor: getRiskColor(risk.score) + '20' }]}>
                  <Text style={[styles.riskScoreText, { color: getRiskColor(risk.score) }]}>
                    {risk.score}
                  </Text>
                </View>
                <View style={styles.riskInfo}>
                  <Text style={styles.riskCategory}>{risk.category}</Text>
                  <Text style={styles.riskDesc} numberOfLines={2}>
                    {risk.description}
                  </Text>
                  <View style={styles.riskMeta}>
                    <Text style={styles.riskStatus}>{risk.status}</Text>
                    {risk.owner && <Text style={styles.riskOwner}>{risk.owner}</Text>}
                  </View>
                </View>
              </View>
            ))}
        </View>
      </View>

      {/* Constraints Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Constraint Tracking</Text>
        <View style={styles.constraintCard}>
          <View style={styles.constraintRow}>
            <View style={styles.constraintItem}>
              <Ionicons name="lock-closed" size={20} color={SemanticColors.feedbackWarning} />
              <Text style={styles.constraintValue}>{siteMetrics.openConstraints}</Text>
              <Text style={styles.constraintLabel}>Open</Text>
            </View>
            <View style={styles.constraintDivider} />
            <View style={styles.constraintItem}>
              <Ionicons name="lock-open" size={20} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.constraintValue, { color: SemanticColors.feedbackSuccess }]}>
                {siteMetrics.constraintsClearedThisWeek}
              </Text>
              <Text style={styles.constraintLabel}>Cleared (Week)</Text>
            </View>
          </View>
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  summaryValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.displaySize - 4,
    fontWeight: '700',
  },
  summaryLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    marginTop: 4,
  },
  section: {
    gap: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: SemanticColors.feedbackWarning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  countBadgeText: {
    color: Palette.white,
    fontSize: TYPE.tinySize,
    fontWeight: '700',
  },
  rfiCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  rfiHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  rfiCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: SemanticColors.surfacePrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: SITE_LEAD_COLOR,
  },
  rfiValue: {
    fontSize: TYPE.displaySize - 6,
    fontWeight: '700',
  },
  rfiLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
  },
  rfiDetails: {
    flex: 1,
    gap: 8,
  },
  rfiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rfiRowLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  rfiRowValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontWeight: '600',
  },
  rfiWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: SemanticColors.feedbackWarning + '15',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  rfiWarningText: {
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.labelSize,
    flex: 1,
  },
  riskList: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  riskItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  riskScore: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskScoreText: {
    fontSize: TYPE.titleSize,
    fontWeight: '700',
  },
  riskInfo: {
    flex: 1,
  },
  riskCategory: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  riskDesc: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    marginTop: 2,
  },
  riskMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  riskStatus: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    textTransform: 'capitalize',
  },
  riskOwner: {
    color: SITE_LEAD_COLOR,
    fontSize: TYPE.tinySize - 1,
    fontWeight: '500',
  },
  constraintCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  constraintRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  constraintItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  constraintValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.displaySize - 4,
    fontWeight: '700',
  },
  constraintLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  constraintDivider: {
    width: 1,
    height: 50,
    backgroundColor: SemanticColors.borderDefault,
  },
});
