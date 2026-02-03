import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import {
  mockProjects,
  mockAppraisals,
  getProjectById,
} from '../../data/mockProjects';
import {
  formatCurrency,
  formatPercent,
  getCurrencyForCountry,
} from '../../modules/countryModules';

const CFO_COLOR = '#22C55E';

export function AppraisalDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const appraisal = useMemo(() => mockAppraisals[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(
    () => (selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP'),
    [selectedProject]
  );

  const fmt = (amount: number) => formatCurrency(amount, currency);

  if (!selectedProject || !appraisal) {
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
        {mockProjects.map((project) => (
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

      {/* Phase Badge */}
      <View style={styles.phaseBadge}>
        <Text style={styles.phaseText}>{selectedProject.phase}</Text>
      </View>

      {/* Key Metrics Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>GDV</Text>
          <Text style={styles.metricValue}>{fmt(appraisal.gdv)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Total Cost</Text>
          <Text style={styles.metricValue}>{fmt(appraisal.totalDevelopmentCost)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Profit on Cost</Text>
          <Text style={[styles.metricValue, { color: CFO_COLOR }]}>
            {formatPercent(appraisal.profitOnCost)}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Profit on GDV</Text>
          <Text style={styles.metricValue}>{formatPercent(appraisal.profitOnGdv)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>IRR</Text>
          <Text style={[styles.metricValue, { color: CFO_COLOR }]}>
            {formatPercent(appraisal.irr)}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>NPV</Text>
          <Text style={styles.metricValue}>{fmt(appraisal.npv)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Yield on Cost</Text>
          <Text style={styles.metricValue}>{formatPercent(appraisal.yieldOnCost)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Peak Equity</Text>
          <Text style={styles.metricValue}>{fmt(appraisal.peakEquityRequired || 0)}</Text>
        </View>
      </View>

      {/* Equity Returns Card */}
      {appraisal.equityIrr && (
        <View style={styles.equityCard}>
          <Text style={styles.equityTitle}>Equity Returns</Text>
          <View style={styles.equityRow}>
            <View style={styles.equityItem}>
              <Text style={styles.equityValue}>{formatPercent(appraisal.equityIrr)}</Text>
              <Text style={styles.equityLabel}>Equity IRR</Text>
            </View>
            {appraisal.equityMultiple && (
              <View style={styles.equityItem}>
                <Text style={styles.equityValue}>{appraisal.equityMultiple.toFixed(2)}x</Text>
                <Text style={styles.equityLabel}>Multiple</Text>
              </View>
            )}
          </View>
        </View>
      )}
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
    borderColor: CFO_COLOR,
  },
  projectCountry: {
    color: CFO_COLOR,
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
  phaseBadge: {
    alignSelf: 'flex-start',
    backgroundColor: CFO_COLOR + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  phaseText: {
    color: CFO_COLOR,
    fontSize: 12,
    fontWeight: '600',
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
  },
  metricLabel: {
    color: Colors.muted,
    fontSize: 11,
  },
  metricValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  equityCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  equityTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  equityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  equityItem: {
    alignItems: 'center',
  },
  equityValue: {
    color: CFO_COLOR,
    fontSize: 24,
    fontWeight: '700',
  },
  equityLabel: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
});
