import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import {
  mockProjects,
  mockDeliveryMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  formatCurrency,
  formatPercent,
  getCurrencyForCountry,
} from '../../modules/countryModules';

const CFO_COLOR = '#2563EB'; // Blue for CFO (per theme)

export function CostControlDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const deliveryMetrics = useMemo(() => mockDeliveryMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(
    () => (selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP'),
    [selectedProject]
  );

  const costHealth = useMemo(() => {
    if (!selectedProject || !deliveryMetrics) return null;

    const cpi = deliveryMetrics.cpiCostPerformanceIndex;
    const eac = deliveryMetrics.estimateAtCompletion;
    const budgetVariance = selectedProject.totalBudget - eac;
    const contingencyRemaining = selectedProject.contingency - selectedProject.contingencyUsed;
    const contingencyPercent =
      selectedProject.contingency > 0
        ? contingencyRemaining / selectedProject.contingency
        : 0;

    return {
      cpi,
      eac,
      budgetVariance,
      contingencyRemaining,
      contingencyPercent,
      status: cpi >= 0.95 ? 'healthy' : cpi >= 0.85 ? 'at-risk' : 'critical',
    };
  }, [selectedProject, deliveryMetrics]);

  const fmt = (amount: number) => formatCurrency(amount, currency);

  const getCpiColor = (cpi: number) => {
    if (cpi >= 0.95) return SemanticColors.feedbackSuccess;
    if (cpi >= 0.85) return SemanticColors.feedbackWarning;
    return SemanticColors.feedbackError;
  };

  if (!selectedProject || !costHealth) {
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

      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: getCpiColor(costHealth.cpi) + '20' }]}>
        <Text style={[styles.statusText, { color: getCpiColor(costHealth.cpi) }]}>
          {costHealth.status.toUpperCase()}
        </Text>
      </View>

      {/* Cost Overview Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cost Overview</Text>
        <View style={styles.costGrid}>
          <View style={styles.costItem}>
            <Text style={styles.costLabel}>Budget</Text>
            <Text style={styles.costValue}>{fmt(selectedProject.totalBudget)}</Text>
          </View>
          <View style={styles.costItem}>
            <Text style={styles.costLabel}>Committed</Text>
            <Text style={styles.costValue}>{fmt(selectedProject.committedCosts)}</Text>
          </View>
          <View style={styles.costItem}>
            <Text style={styles.costLabel}>Spent</Text>
            <Text style={styles.costValue}>{fmt(selectedProject.actualSpent)}</Text>
          </View>
          <View style={styles.costItem}>
            <Text style={styles.costLabel}>EAC</Text>
            <Text style={[styles.costValue, costHealth.budgetVariance < 0 && { color: SemanticColors.feedbackError }]}>
              {fmt(costHealth.eac)}
            </Text>
          </View>
        </View>
      </View>

      {/* CPI Card */}
      <View style={styles.cpiCard}>
        <View style={styles.cpiCircle}>
          <Text style={[styles.cpiValue, { color: getCpiColor(costHealth.cpi) }]}>
            {costHealth.cpi.toFixed(2)}
          </Text>
          <Text style={styles.cpiLabel}>CPI</Text>
        </View>
        <View style={styles.cpiInfo}>
          <View style={styles.cpiRow}>
            <Text style={styles.cpiRowLabel}>Variance</Text>
            <Text style={[
              styles.cpiRowValue,
              { color: costHealth.budgetVariance >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }
            ]}>
              {costHealth.budgetVariance >= 0 ? '+' : ''}{fmt(costHealth.budgetVariance)}
            </Text>
          </View>
        </View>
      </View>

      {/* Contingency Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contingency</Text>
        <View style={styles.contingencyCard}>
          <View style={styles.contingencyHeader}>
            <Text style={styles.contingencyAmount}>{fmt(costHealth.contingencyRemaining)}</Text>
            <Text style={styles.contingencyPercent}>
              {formatPercent(costHealth.contingencyPercent)} remaining
            </Text>
          </View>
          <View style={styles.contingencyBar}>
            <View
              style={[
                styles.contingencyUsed,
                { width: `${(1 - costHealth.contingencyPercent) * 100}%` },
              ]}
            />
          </View>
          <View style={styles.contingencyDetails}>
            <View style={styles.contingencyRow}>
              <Text style={styles.contingencyLabel}>Original</Text>
              <Text style={styles.contingencyValue}>{fmt(selectedProject.contingency)}</Text>
            </View>
            <View style={styles.contingencyRow}>
              <Text style={styles.contingencyLabel}>Used</Text>
              <Text style={styles.contingencyValue}>{fmt(selectedProject.contingencyUsed)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Budget Lines */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cost Categories ({selectedProject.budgetLines.length})</Text>
        <View style={styles.budgetLinesList}>
          {selectedProject.budgetLines.map((line) => {
            const forecastFinal = line.forecastFinal || 0;
            const currentBudget = line.currentBudget || 0;
            const actualSpent = line.actualSpent || 0;
            const variance = forecastFinal - currentBudget;
            const isOver = variance > 0;
            const percentSpent = currentBudget > 0 ? actualSpent / currentBudget : 0;

            return (
              <View key={line.id} style={styles.budgetLineItem}>
                <View style={styles.budgetLineInfo}>
                  <Text style={styles.budgetLineName}>{line.description}</Text>
                  <View style={styles.budgetLineProgress}>
                    <View style={styles.budgetLineBar}>
                      <View
                        style={[
                          styles.budgetLineFill,
                          { width: `${Math.min(percentSpent * 100, 100)}%` },
                          percentSpent > 1 && { backgroundColor: SemanticColors.feedbackError }
                        ]}
                      />
                    </View>
                    <Text style={styles.budgetLineSpent}>
                      {fmt(actualSpent)} / {fmt(currentBudget)}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.varianceBadge,
                  isOver ? styles.varianceOver : styles.varianceUnder,
                ]}>
                  <Text style={[
                    styles.varianceText,
                    { color: isOver ? SemanticColors.feedbackError : SemanticColors.feedbackSuccess },
                  ]}>
                    {variance >= 0 ? '+' : ''}{fmt(variance)}
                  </Text>
                </View>
              </View>
            );
          })}
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
    fontSize: 16,
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
    borderColor: CFO_COLOR,
  },
  projectCountry: {
    color: CFO_COLOR,
    fontSize: 10,
    fontWeight: '700',
  },
  projectName: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  projectNameActive: {
    color: SemanticColors.textPrimary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  costGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  costItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  costLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
  },
  costValue: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  cpiCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
  },
  cpiCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: SemanticColors.surfacePrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: CFO_COLOR,
  },
  cpiValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  cpiLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 10,
  },
  cpiInfo: {
    flex: 1,
  },
  cpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cpiRowLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  cpiRowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  contingencyCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  contingencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  contingencyAmount: {
    color: SemanticColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  contingencyPercent: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  contingencyBar: {
    height: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  contingencyUsed: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackWarning,
    borderRadius: 4,
  },
  contingencyDetails: {
    gap: 4,
  },
  contingencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contingencyLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  contingencyValue: {
    color: SemanticColors.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  budgetLinesList: {
    gap: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  budgetLineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  budgetLineInfo: {
    flex: 1,
    gap: 4,
  },
  budgetLineName: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  budgetLineProgress: {
    gap: 4,
  },
  budgetLineBar: {
    height: 4,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  budgetLineFill: {
    height: '100%',
    backgroundColor: CFO_COLOR,
    borderRadius: 2,
  },
  budgetLineSpent: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
  },
  varianceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginLeft: Spacing.sm,
  },
  varianceOver: {
    backgroundColor: SemanticColors.feedbackError + '20',
  },
  varianceUnder: {
    backgroundColor: SemanticColors.feedbackSuccess + '20',
  },
  varianceText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
