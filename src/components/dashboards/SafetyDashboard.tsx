import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import { formatPercent } from '../../modules/countryModules';
import {
  mockProjects,
  mockSiteMetrics,
  getProjectById,
} from '../../data/mockProjects';

const SITE_LEAD_COLOR = '#D2691E'; // Terracotta for Site Lead (per theme)

export function SafetyDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const siteMetrics = useMemo(() => mockSiteMetrics[selectedProjectId], [selectedProjectId]);

  const safetyHealth = useMemo(() => {
    if (!siteMetrics) return null;
    return {
      ltir: siteMetrics.ltir,
      incidentsTotal: siteMetrics.incidentsTotal,
      incidentsThisPeriod: siteMetrics.incidentsThisPeriod,
      nearMisses: siteMetrics.nearMissesThisPeriod,
      hoursWorked: siteMetrics.hoursWorked,
      defectClosureRate: siteMetrics.defectClosureRate,
      status: siteMetrics.ltir < 0.5 ? 'excellent' : siteMetrics.ltir < 1.0 ? 'good' : 'needs-attention',
    };
  }, [siteMetrics]);

  const getSafetyColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return SemanticColors.feedbackSuccess;
      case 'good':
        return SITE_LEAD_COLOR;
      case 'needs-attention':
        return SemanticColors.feedbackWarning;
      default:
        return SemanticColors.textSecondary;
    }
  };

  if (!selectedProject || !siteMetrics || !safetyHealth) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

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

      {/* LTIR Card */}
      <View style={styles.ltirCard}>
        <View style={styles.ltirHeader}>
          <View>
            <Text style={styles.ltirTitle}>Lost Time Incident Rate</Text>
            <View style={[styles.statusBadge, { backgroundColor: getSafetyColor(safetyHealth.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getSafetyColor(safetyHealth.status) }]}>
                {safetyHealth.status.replace('-', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
          <Ionicons
            name={safetyHealth.status === 'excellent' ? 'shield-checkmark' : 'shield-outline'}
            size={32}
            color={getSafetyColor(safetyHealth.status)}
          />
        </View>
        <View style={styles.ltirValue}>
          <Text style={[styles.ltirNumber, { color: getSafetyColor(safetyHealth.status) }]}>
            {safetyHealth.ltir.toFixed(2)}
          </Text>
          <Text style={styles.ltirTarget}>Target: &lt; 1.0</Text>
        </View>
        <View style={styles.ltirBar}>
          <View
            style={[
              styles.ltirFill,
              {
                width: `${Math.min(safetyHealth.ltir * 100, 100)}%`,
                backgroundColor: getSafetyColor(safetyHealth.status)
              }
            ]}
          />
          <View style={styles.ltirMarker} />
        </View>
      </View>

      {/* Metrics Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Safety Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{safetyHealth.hoursWorked.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Hours Worked</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, safetyHealth.incidentsTotal > 0 && { color: SemanticColors.feedbackError }]}>
              {safetyHealth.incidentsTotal}
            </Text>
            <Text style={styles.metricLabel}>Total Incidents</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, safetyHealth.incidentsThisPeriod > 0 && { color: SemanticColors.feedbackError }]}>
              {safetyHealth.incidentsThisPeriod}
            </Text>
            <Text style={styles.metricLabel}>This Period</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: SemanticColors.feedbackWarning }]}>
              {safetyHealth.nearMisses}
            </Text>
            <Text style={styles.metricLabel}>Near Misses</Text>
          </View>
        </View>
      </View>

      {/* Incident Alert */}
      {safetyHealth.incidentsThisPeriod > 0 && (
        <View style={styles.alertCard}>
          <Ionicons name="warning" size={24} color={SemanticColors.feedbackError} />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>
              {safetyHealth.incidentsThisPeriod} incident{safetyHealth.incidentsThisPeriod > 1 ? 's' : ''} this period
            </Text>
            <Text style={styles.alertSubtitle}>Review and close out required</Text>
          </View>
        </View>
      )}

      {/* Defect Closure */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quality & Defects</Text>
        <View style={styles.closureCard}>
          <View style={styles.closureHeader}>
            <Text style={styles.closureTitle}>Defect Closure Rate</Text>
            <Text style={[styles.closureValue, { color: SemanticColors.feedbackSuccess }]}>
              {formatPercent(safetyHealth.defectClosureRate)}
            </Text>
          </View>
          <View style={styles.closureBar}>
            <View
              style={[styles.closureFill, { width: `${safetyHealth.defectClosureRate * 100}%` }]}
            />
          </View>
          <View style={styles.defectRow}>
            <View style={styles.defectItem}>
              <Text style={styles.defectValue}>{siteMetrics.defectsOpenTotal}</Text>
              <Text style={styles.defectLabel}>Open</Text>
            </View>
            <View style={styles.defectItem}>
              <Text style={[styles.defectValue, { color: SemanticColors.feedbackSuccess }]}>
                {siteMetrics.defectsClosedTotal}
              </Text>
              <Text style={styles.defectLabel}>Closed</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Safety Reminders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Safety Checklist</Text>
        <View style={styles.checklistCard}>
          {[
            { item: 'PPE Inspection', done: true },
            { item: 'Site Walk-through', done: true },
            { item: 'Toolbox Talk', done: false },
            { item: 'Permit Review', done: false },
          ].map((check, index) => (
            <View key={index} style={styles.checklistItem}>
              <Ionicons
                name={check.done ? 'checkbox' : 'square-outline'}
                size={20}
                color={check.done ? SemanticColors.feedbackSuccess : SemanticColors.textSecondary}
              />
              <Text style={[styles.checklistText, check.done && styles.checklistDone]}>
                {check.item}
              </Text>
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
  ltirCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  ltirHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ltirTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '700',
  },
  ltirValue: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  ltirNumber: {
    fontSize: 48,
    fontWeight: '700',
  },
  ltirTarget: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    marginTop: 4,
  },
  ltirBar: {
    height: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  ltirFill: {
    height: '100%',
    borderRadius: 4,
  },
  ltirMarker: {
    position: 'absolute',
    right: 0,
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: SemanticColors.textPrimary,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  metricValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
  },
  metricLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    marginTop: 4,
    textAlign: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackError + '15',
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError + '30',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: SemanticColors.feedbackError,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
  },
  alertSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    marginTop: 2,
  },
  closureCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  closureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closureTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '500',
  },
  closureValue: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
  },
  closureBar: {
    height: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  closureFill: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 4,
  },
  defectRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  defectItem: {
    alignItems: 'center',
  },
  defectValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
  },
  defectLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    marginTop: 2,
  },
  checklistCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  checklistText: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
  },
  checklistDone: {
    color: SemanticColors.textSecondary,
    textDecorationLine: 'line-through',
  },
});
