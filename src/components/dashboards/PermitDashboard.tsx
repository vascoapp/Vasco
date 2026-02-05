import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import {
  mockProjects,
  getProjectById,
} from '../../data/mockProjects';
import { calculatePermitStatus } from '../../modules/countryModules';

const COO_COLOR = '#7C3AED'; // Purple for COO (per theme)

export function PermitDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);

  const permitStatus = useMemo(() => {
    if (!selectedProject) return null;

    const approved = selectedProject.permits.filter(
      (p) => p.status === 'approved' || p.status === 'approved-with-conditions'
    );
    const pending = selectedProject.permits.filter(
      (p) => p.status === 'under-review' || p.status === 'submitted'
    );
    const notSubmitted = selectedProject.permits.filter(
      (p) => p.status === 'not-submitted'
    );
    const atRisk = selectedProject.permits.filter((p) => {
      if (!p.submissionDate || !p.targetDecisionDate) return false;
      const status = calculatePermitStatus(p.submissionDate, p.targetDecisionDate);
      return status.status === 'at-risk' || status.status === 'overdue';
    });

    return { approved, pending, notSubmitted, atRisk, total: selectedProject.permits.length };
  }, [selectedProject]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'approved-with-conditions':
        return { name: 'checkmark-circle', color: Colors.success };
      case 'under-review':
      case 'submitted':
        return { name: 'time', color: Colors.warning };
      case 'not-submitted':
        return { name: 'ellipse-outline', color: Colors.muted };
      default:
        return { name: 'help-circle', color: Colors.muted };
    }
  };

  if (!selectedProject || !permitStatus) {
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

      {/* Summary Grid */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.success }]}>
            {permitStatus.approved.length}
          </Text>
          <Text style={styles.summaryLabel}>Approved</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.warning }]}>
            {permitStatus.pending.length}
          </Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.danger }]}>
            {permitStatus.atRisk.length}
          </Text>
          <Text style={styles.summaryLabel}>At Risk</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{permitStatus.total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Permit Progress</Text>
          <Text style={styles.progressPercent}>
            {Math.round((permitStatus.approved.length / permitStatus.total) * 100)}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(permitStatus.approved.length / permitStatus.total) * 100}%` }
            ]}
          />
        </View>
      </View>

      {/* At Risk Permits */}
      {permitStatus.atRisk.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning" size={16} color={Colors.danger} />
            <Text style={[styles.sectionTitle, { color: Colors.danger }]}>At Risk</Text>
          </View>
          <View style={styles.permitList}>
            {permitStatus.atRisk.map((permit) => {
              const status = permit.submissionDate && permit.targetDecisionDate
                ? calculatePermitStatus(permit.submissionDate, permit.targetDecisionDate)
                : null;
              return (
                <View key={permit.id} style={[styles.permitItem, styles.permitItemAtRisk]}>
                  <View style={styles.permitInfo}>
                    <Text style={styles.permitType}>{permit.type}</Text>
                    <Text style={styles.permitRef}>{permit.reference || 'No reference'}</Text>
                  </View>
                  {status && (
                    <View style={styles.daysRemaining}>
                      <Text style={[styles.daysValue, { color: Colors.danger }]}>
                        {status.daysRemaining}
                      </Text>
                      <Text style={styles.daysLabel}>days</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* All Permits List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Permits</Text>
        <View style={styles.permitList}>
          {selectedProject.permits.map((permit) => {
            const icon = getStatusIcon(permit.status);
            const status = permit.submissionDate && permit.targetDecisionDate
              ? calculatePermitStatus(permit.submissionDate, permit.targetDecisionDate)
              : null;

            return (
              <View key={permit.id} style={styles.permitItem}>
                <Ionicons name={icon.name as any} size={20} color={icon.color} />
                <View style={styles.permitInfo}>
                  <Text style={styles.permitType}>{permit.type}</Text>
                  <Text style={styles.permitRef}>{permit.reference || 'No reference'}</Text>
                  {permit.status === 'approved-with-conditions' && (
                    <View style={styles.conditionsBadge}>
                      <Text style={styles.conditionsText}>
                        {permit.conditions.filter(c => !c.dischargedDate).length} conditions outstanding
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.permitRight}>
                  <Text style={[styles.permitStatus, { color: icon.color }]}>
                    {permit.status.replace(/-/g, ' ')}
                  </Text>
                  {status && status.daysRemaining > 0 && (
                    <Text style={styles.permitDays}>{status.daysRemaining}d remaining</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Conditions Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conditions to Discharge</Text>
        <View style={styles.conditionsCard}>
          {selectedProject.permits.flatMap(p => p.conditions.filter(c => !c.dischargedDate)).length > 0 ? (
            <>
              <Text style={styles.conditionsCount}>
                {selectedProject.permits.flatMap(p => p.conditions.filter(c => !c.dischargedDate)).length}
              </Text>
              <Text style={styles.conditionsLabel}>Outstanding Conditions</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
              <Text style={styles.conditionsLabel}>All conditions discharged</Text>
            </>
          )}
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
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  summaryLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  progressCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  progressPercent: {
    color: COO_COLOR,
    fontSize: 14,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 4,
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
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  permitList: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  permitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  permitItemAtRisk: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  permitInfo: {
    flex: 1,
  },
  permitType: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  permitRef: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  permitRight: {
    alignItems: 'flex-end',
  },
  permitStatus: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  permitDays: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  daysRemaining: {
    alignItems: 'center',
  },
  daysValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  daysLabel: {
    color: Colors.muted,
    fontSize: 10,
  },
  conditionsBadge: {
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  conditionsText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '500',
  },
  conditionsCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  conditionsCount: {
    color: Colors.warning,
    fontSize: 32,
    fontWeight: '700',
  },
  conditionsLabel: {
    color: Colors.muted,
    fontSize: 12,
  },
});
