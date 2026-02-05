import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
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
            <Text style={[styles.contractValue, { color: Colors.success }]}>
              {procurementStatus.awarded}
            </Text>
            <Text style={styles.contractLabel}>Awarded</Text>
          </View>
          <View style={styles.contractItem}>
            <Text style={[styles.contractValue, { color: Colors.warning }]}>
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
                <Text style={[styles.coDetailValue, { color: Colors.success }]}>
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
              { backgroundColor: procurementStatus.avgCycleTime <= 14 ? Colors.success + '20' : Colors.warning + '20' }
            ]}>
              <Text style={[
                styles.performanceBadgeText,
                { color: procurementStatus.avgCycleTime <= 14 ? Colors.success : Colors.warning }
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
                    backgroundColor: procurementStatus.avgCycleTime <= 14 ? Colors.success : Colors.warning
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
          <Ionicons name="warning-outline" size={24} color={Colors.warning} />
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
                  <Text style={styles.contractListType}>{contract.tradePackage}</Text>
                </View>
                <View style={styles.contractListRight}>
                  <Text style={styles.contractListValue}>{fmt(contract.value || 0)}</Text>
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
    borderColor: COO_COLOR,
  },
  projectCountry: {
    color: COO_COLOR,
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
  contractsGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  contractItem: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  contractValue: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  contractLabel: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  changeOrderCard: {
    backgroundColor: Colors.surfaceElevated,
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
    fontSize: 28,
    fontWeight: '700',
  },
  coLabel: {
    color: Colors.muted,
    fontSize: 10,
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
    color: Colors.muted,
    fontSize: 12,
  },
  coDetailValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  performanceCard: {
    backgroundColor: Colors.surfaceElevated,
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
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  performanceLabel: {
    color: Colors.muted,
    fontSize: 11,
  },
  performanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  performanceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  targetRow: {
    gap: 4,
  },
  targetLabel: {
    color: Colors.muted,
    fontSize: 11,
  },
  targetBar: {
    height: 6,
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.warning + '10',
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },
  riskInfo: {
    flex: 1,
  },
  riskValue: {
    color: Colors.warning,
    fontSize: 22,
    fontWeight: '700',
  },
  riskLabel: {
    color: Colors.muted,
    fontSize: 12,
  },
  contractList: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  contractListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contractListInfo: {
    flex: 1,
  },
  contractListName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  contractListType: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  contractListRight: {
    alignItems: 'flex-end',
  },
  contractListValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  contractListCo: {
    color: COO_COLOR,
    fontSize: 10,
    marginTop: 2,
  },
});
