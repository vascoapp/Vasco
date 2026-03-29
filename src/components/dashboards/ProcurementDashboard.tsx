import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import {
  mockProjects,
  mockDeliveryMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  formatCurrency,
  getCurrencyForCountry,
} from '../../modules/countryModules';

const COO_COLOR = '#7C3AED'; // Purple for COO (per theme)

export function ProcurementDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const deliveryMetrics = useMemo(() => mockDeliveryMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(
    () => (selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP'),
    [selectedProject]
  );

  const procurementStatus = useMemo(() => {
    if (!deliveryMetrics) return null;
    return {
      awarded: deliveryMetrics.contractsAwarded,
      pending: deliveryMetrics.contractsPending,
      changeOrdersSubmitted: deliveryMetrics.changeOrdersSubmitted,
      changeOrdersApproved: deliveryMetrics.changeOrdersApproved,
      changeOrdersPending: deliveryMetrics.changeOrdersSubmitted - deliveryMetrics.changeOrdersApproved,
      changeOrdersValue: deliveryMetrics.changeOrdersValue,
      avgCycleTime: deliveryMetrics.avgChangeOrderCycleTime,
      riskValue: deliveryMetrics.procurementRiskValue,
    };
  }, [deliveryMetrics]);

  const fmt = (amount: number) => formatCurrency(amount, currency);

  if (!selectedProject || !deliveryMetrics || !procurementStatus) {
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

      {/* Contracts Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contracts</Text>
        <View style={styles.contractsGrid}>
          <View style={styles.contractItem}>
            <Text style={[styles.contractValue, { color: SemanticColors.feedbackSuccess }]}>
              {procurementStatus.awarded}
            </Text>
            <Text style={styles.contractLabel}>Awarded</Text>
          </View>
          <View style={styles.contractItem}>
            <Text style={[styles.contractValue, { color: SemanticColors.feedbackWarning }]}>
              {procurementStatus.pending}
            </Text>
            <Text style={styles.contractLabel}>Pending Award</Text>
          </View>
        </View>
      </View>

      {/* Change Orders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Orders</Text>
        <View style={styles.changeOrderCard}>
          <View style={styles.coHeader}>
            <View style={styles.coCircle}>
              <Text style={styles.coValue}>{procurementStatus.changeOrdersPending}</Text>
              <Text style={styles.coLabel}>Pending</Text>
            </View>
            <View style={styles.coDetails}>
              <View style={styles.coRow}>
                <Text style={styles.coDetailLabel}>Submitted</Text>
                <Text style={styles.coDetailValue}>{procurementStatus.changeOrdersSubmitted}</Text>
              </View>
              <View style={styles.coRow}>
                <Text style={styles.coDetailLabel}>Approved</Text>
                <Text style={[styles.coDetailValue, { color: SemanticColors.feedbackSuccess }]}>
                  {procurementStatus.changeOrdersApproved}
                </Text>
              </View>
              <View style={styles.coRow}>
                <Text style={styles.coDetailLabel}>Total Value</Text>
                <Text style={styles.coDetailValue}>{fmt(procurementStatus.changeOrdersValue || 0)}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Cycle Time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Processing Performance</Text>
        <View style={styles.performanceCard}>
          <View style={styles.performanceItem}>
            <Ionicons name="time-outline" size={20} color={COO_COLOR} />
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceValue}>{procurementStatus.avgCycleTime}d</Text>
              <Text style={styles.performanceLabel}>Avg CO Cycle Time</Text>
            </View>
            <View style={[
              styles.performanceBadge,
              { backgroundColor: procurementStatus.avgCycleTime <= 14 ? SemanticColors.feedbackSuccess + '20' : SemanticColors.feedbackWarning + '20' }
            ]}>
              <Text style={[
                styles.performanceBadgeText,
                { color: procurementStatus.avgCycleTime <= 14 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning }
              ]}>
                {procurementStatus.avgCycleTime <= 14 ? 'On Target' : 'Above Target'}
              </Text>
            </View>
          </View>
          <View style={styles.targetRow}>
            <Text style={styles.targetLabel}>Target: 14 days</Text>
            <View style={styles.targetBar}>
              <View
                style={[
                  styles.targetFill,
                  {
                    width: `${Math.min((procurementStatus.avgCycleTime / 14) * 100, 100)}%`,
                    backgroundColor: procurementStatus.avgCycleTime <= 14 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning
                  }
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Risk Value */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Procurement Risk</Text>
        <View style={styles.riskCard}>
          <Ionicons name="warning-outline" size={24} color={SemanticColors.feedbackWarning} />
          <View style={styles.riskInfo}>
            <Text style={styles.riskValue}>{fmt(procurementStatus.riskValue || 0)}</Text>
            <Text style={styles.riskLabel}>At-Risk Value</Text>
          </View>
        </View>
      </View>

      {/* Contracts List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contract Details</Text>
        <View style={styles.contractList}>
          {selectedProject.contracts.map((contract) => {
            const coCount = contract.variations?.length || 0;
            const coValue = contract.variations?.reduce((sum, v) => sum + v.amount, 0) || 0;

            return (
              <View key={contract.id} style={styles.contractListItem}>
                <View style={styles.contractListInfo}>
                  <Text style={styles.contractListName} numberOfLines={1}>
                    {contract.counterparty}
                  </Text>
                  <Text style={styles.contractListType}>{contract.description}</Text>
                </View>
                <View style={styles.contractListRight}>
                  <Text style={styles.contractListValue}>{fmt(contract.contractSum || 0)}</Text>
                  {coCount > 0 && (
                    <Text style={styles.contractListCo}>
                      {coCount} COs ({fmt(coValue)})
                    </Text>
                  )}
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
    borderColor: COO_COLOR,
  },
  projectCountry: {
    color: COO_COLOR,
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
  contractsGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  contractItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  contractValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.displaySize + 4,
    fontWeight: '700',
  },
  contractLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    marginTop: 4,
  },
  changeOrderCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  coHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  coCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COO_COLOR + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COO_COLOR,
  },
  coValue: {
    color: COO_COLOR,
    fontSize: TYPE.displaySize,
    fontWeight: '700',
  },
  coLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
  },
  coDetails: {
    flex: 1,
    gap: 8,
  },
  coRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coDetailLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  coDetailValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '600',
  },
  performanceCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  performanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  performanceInfo: {
    flex: 1,
  },
  performanceValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
  },
  performanceLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  performanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  performanceBadgeText: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  targetRow: {
    gap: 4,
  },
  targetLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  targetBar: {
    height: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  targetFill: {
    height: '100%',
    borderRadius: 3,
  },
  riskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackWarning + '10',
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackWarning + '30',
  },
  riskInfo: {
    flex: 1,
  },
  riskValue: {
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.displaySize - 6,
    fontWeight: '700',
  },
  riskLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  contractList: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  contractListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  contractListInfo: {
    flex: 1,
  },
  contractListName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '500',
  },
  contractListType: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    marginTop: 2,
  },
  contractListRight: {
    alignItems: 'flex-end',
  },
  contractListValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '600',
  },
  contractListCo: {
    color: COO_COLOR,
    fontSize: TYPE.tinySize - 1,
    marginTop: 2,
  },
});
