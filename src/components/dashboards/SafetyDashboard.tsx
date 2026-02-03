import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import { formatPercent } from '../../modules/countryModules';
import {
  mockProjects,
  mockSiteMetrics,
  getProjectById,
} from '../../data/mockProjects';

const SITE_LEAD_COLOR = '#F97316';

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
        return Colors.success;
      case 'good':
        return SITE_LEAD_COLOR;
      case 'needs-attention':
        return Colors.warning;
      default:
        return Colors.muted;
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
            <Text style={[styles.metricValue, safetyHealth.incidentsTotal > 0 && { color: Colors.danger }]}>
              {safetyHealth.incidentsTotal}
            </Text>
            <Text style={styles.metricLabel}>Total Incidents</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, safetyHealth.incidentsThisPeriod > 0 && { color: Colors.danger }]}>
              {safetyHealth.incidentsThisPeriod}
            </Text>
            <Text style={styles.metricLabel}>This Period</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: Colors.warning }]}>
              {safetyHealth.nearMisses}
            </Text>
            <Text style={styles.metricLabel}>Near Misses</Text>
          </View>
        </View>
      </View>

      {/* Incident Alert */}
      {safetyHealth.incidentsThisPeriod > 0 && (
        <View style={styles.alertCard}>
          <Ionicons name="warning" size={24} color={Colors.danger} />
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
            <Text style={[styles.closureValue, { color: Colors.success }]}>
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
              <Text style={[styles.defectValue, { color: Colors.success }]}>
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
                color={check.done ? Colors.success : Colors.muted}
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
    color: Colors.muted,
    fontSize: 16,
  },
  projectSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  projectPill: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  projectPillActive: {
    borderColor: SITE_LEAD_COLOR,
  },
  projectCountry: {
    color: SITE_LEAD_COLOR,
    fontSize: 10,
    fontWeight: '700',
  },
  projectName: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  projectNameActive: {
    color: Colors.text,
  },
  ltirCard: {
    backgroundColor: Colors.surfaceElevated,
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
    color: Colors.text,
    fontSize: 14,
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
    fontSize: 10,
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
    color: Colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  ltirBar: {
    height: 8,
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.text,
  },
  section: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.muted,
    fontSize: 11,
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
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  metricValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  metricLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '15',
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  alertSubtitle: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  closureCard: {
    backgroundColor: Colors.surfaceElevated,
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
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  closureValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  closureBar: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  closureFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 4,
  },
  defectRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  defectItem: {
    alignItems: 'center',
  },
  defectValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  defectLabel: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  checklistCard: {
    backgroundColor: Colors.surfaceElevated,
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
    color: Colors.text,
    fontSize: 13,
  },
  checklistDone: {
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
});
