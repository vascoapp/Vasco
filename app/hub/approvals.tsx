// Hub: Approvals - Full approval queue with actionable items
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { InlineInsight, VascoInsightCard } from '../../src/components/shared/VascoInsightCard';
import { useVascoGuidance, useInlineInsight } from '../../src/services/vascoGuidanceService';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  useJobToPaymentWorkflows,
  useWorkflowStats,
  crossRoleWorkflowService,
} from '../../src/services/crossRoleWorkflowService';
import type { Workflow } from '../../src/services/crossRoleWorkflowService';

type IconName = keyof typeof Ionicons.glyphMap;

interface ApprovalItem {
  id: string;
  type: string;
  title: string;
  description: string;
  amount: number;
  requestedBy: string;
  daysWaiting: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  project: string;
  checks: { label: string; passed: boolean }[];
}

const MOCK_APPROVALS: ApprovalItem[] = [
  {
    id: 'app-1', type: 'Contract Change', title: 'MEP Subcontract Variation',
    description: 'Additional electrical work required for EV charging points in underground parking.',
    amount: 340000, requestedBy: 'Sarah Chen (PM)', daysWaiting: 5, priority: 'critical', project: 'Riverside Quarter',
    checks: [{ label: 'Budget check', passed: true }, { label: 'Contract review', passed: true }, { label: 'Risk assessment', passed: false }],
  },
  {
    id: 'app-2', type: 'Draw Request', title: 'Phase 2 Draw #4',
    description: 'Monthly draw request for structural works completion.',
    amount: 890000, requestedBy: 'Finance Team', daysWaiting: 3, priority: 'high', project: 'Oak Gardens',
    checks: [{ label: 'Budget check', passed: true }, { label: 'Handover check', passed: true }, { label: 'QS verification', passed: true }],
  },
  {
    id: 'app-3', type: 'Purchase Order', title: 'Steel Order - Phase 3',
    description: 'Structural steel for Phase 3 framework. Price locked until end of month.',
    amount: 156000, requestedBy: 'Tom Harrison (COO)', daysWaiting: 1, priority: 'medium', project: 'Riverside Quarter',
    checks: [{ label: 'Budget check', passed: true }, { label: 'Supplier check', passed: true }],
  },
];

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return SemanticColors.feedbackError;
    case 'high': return SemanticColors.feedbackWarning;
    default: return Palette.hermesOrange;
  }
}

export default function ApprovalsScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [approvals, setApprovals] = useState(MOCK_APPROVALS);
  const cfoInsights = useVascoGuidance('cfo', 'cfo-approvals');
  const inlineTip = useInlineInsight('cfo', 'cfo-approvals', 'overview');
  const topInsight = cfoInsights[0] ?? null;
  const { workflows: paymentWorkflows } = useJobToPaymentWorkflows();
  const workflowStats = useWorkflowStats();
  const activePaymentWorkflows = paymentWorkflows.filter(wf => wf.status !== 'completed' && wf.status !== 'cancelled');

  const handleApprove = useCallback((id: string) => {
    Alert.alert('Goedkeuren', 'Weet je zeker dat je dit wilt goedkeuren?', [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      { text: 'Goedkeuren', onPress: () => setApprovals(prev => prev.filter(a => a.id !== id)) },
    ]);
  }, []);

  const handleReject = useCallback((id: string) => {
    Alert.alert('Afwijzen', 'Weet je zeker dat je dit wilt afwijzen?', [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      { text: 'Afwijzen', style: 'destructive', onPress: () => setApprovals(prev => prev.filter(a => a.id !== id)) },
    ]);
  }, []);

  const totalAmount = approvals.reduce((sum, a) => sum + a.amount, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{approvals.length}</Text>
          <Text style={styles.statLabel}>Wachtend</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>£{(totalAmount / 1000).toFixed(0)}K</Text>
          <Text style={styles.statLabel}>Totaal bedrag</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{Math.round(approvals.reduce((s, a) => s + a.daysWaiting, 0) / approvals.length)}d</Text>
          <Text style={styles.statLabel}>Gem. wachttijd</Text>
        </View>
      </View>

      {inlineTip && <InlineInsight icon={inlineTip.icon as IconName} message={inlineTip.message} />}
      {topInsight && <VascoInsightCard insight={topInsight} compact />}

      {/* Cross-Role Payment Workflows */}
      {activePaymentWorkflows.length > 0 && (
        <View style={styles.wfSection}>
          <View style={styles.wfSectionHeader}>
            <Ionicons name="git-network" size={16} color={Palette.hermesOrange} />
            <Text style={styles.wfSectionTitle}>Betaling Workflows</Text>
            <View style={styles.wfSectionBadge}>
              <Text style={styles.wfSectionBadgeText}>{activePaymentWorkflows.length}</Text>
            </View>
          </View>

          {workflowStats.pendingPaymentValue > 0 && (
            <View style={styles.wfValueBanner}>
              <Ionicons name="cash" size={14} color={SemanticColors.feedbackWarning} />
              <Text style={styles.wfValueBannerText}>
                Totale pending waarde: £{workflowStats.pendingPaymentValue.toLocaleString()}
              </Text>
            </View>
          )}

          {activePaymentWorkflows.map((wf) => {
            const currentStep = wf.steps.find(s => s.id === wf.currentStepId);
            const completedSteps = wf.steps.filter(s => s.status === 'completed').length;

            return (
              <View key={wf.id} style={styles.wfCard}>
                <View style={styles.wfCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wfCardTitle}>{wf.title}</Text>
                    <Text style={styles.wfCardMeta}>
                      {wf.projectName} · {wf.initiatedBy.userName}
                    </Text>
                  </View>
                  <Text style={styles.wfCardAmount}>
                    {wf.currency === 'GBP' ? '£' : '€'}{wf.amount?.toLocaleString()}
                  </Text>
                </View>

                {/* Step Progress Dots */}
                <View style={styles.wfStepsRow}>
                  {wf.steps.map((step, idx) => (
                    <View key={step.id} style={styles.wfStepItem}>
                      <View style={[
                        styles.wfStepDot,
                        step.status === 'completed' && { backgroundColor: SemanticColors.feedbackSuccess },
                        step.status === 'in-progress' && { backgroundColor: Palette.hermesOrange },
                        step.status === 'pending' && { backgroundColor: SemanticColors.surfaceSecondary, borderWidth: 1, borderColor: SemanticColors.borderDefault },
                      ]}>
                        {step.status === 'completed' && (
                          <Ionicons name="checkmark" size={8} color="#fff" />
                        )}
                      </View>
                      {idx < wf.steps.length - 1 && (
                        <View style={[
                          styles.wfStepConnector,
                          step.status === 'completed' && { backgroundColor: SemanticColors.feedbackSuccess },
                        ]} />
                      )}
                    </View>
                  ))}
                </View>

                {/* Current step info */}
                {currentStep && (
                  <View style={styles.wfCurrentStep}>
                    <Ionicons name="arrow-forward-circle" size={14} color={Palette.hermesOrange} />
                    <Text style={styles.wfCurrentStepText}>
                      {currentStep.name}
                      {currentStep.assignedRole === 'cfo' ? ' (CFO)' :
                       currentStep.assignedRole === 'contractor' ? ' (Aannemer)' :
                       currentStep.assignedRole === 'site-lead' ? ' (Site Lead)' :
                       ` (${currentStep.assignedRole})`}
                    </Text>
                  </View>
                )}

                {/* Participants */}
                <View style={styles.wfParticipants}>
                  {wf.participants.map((p) => (
                    <View key={p.userId} style={styles.wfParticipantChip}>
                      <Ionicons name="person" size={10} color={SemanticColors.textTertiary} />
                      <Text style={styles.wfParticipantText}>{p.userName}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Approval cards */}
      {approvals.map(approval => (
        <View key={approval.id} style={[styles.approvalCard, { borderLeftColor: getPriorityColor(approval.priority) }]}>
          <View style={styles.approvalHeader}>
            <View style={styles.approvalType}>
              <Text style={styles.approvalTypeText}>{approval.type}</Text>
            </View>
            <Text style={[styles.priorityBadge, { color: getPriorityColor(approval.priority) }]}>
              {approval.priority.toUpperCase()}
            </Text>
          </View>

          <Text style={styles.approvalTitle}>{approval.title}</Text>
          <Text style={styles.approvalDesc}>{approval.description}</Text>

          <View style={styles.approvalMeta}>
            <Text style={styles.metaText}>{approval.project}</Text>
            <Text style={styles.metaSeparator}>·</Text>
            <Text style={styles.metaText}>{approval.requestedBy}</Text>
            <Text style={styles.metaSeparator}>·</Text>
            <Text style={styles.metaText}>{approval.daysWaiting}d wachtend</Text>
          </View>

          <Text style={styles.amountText}>£{approval.amount.toLocaleString()}</Text>

          {/* AI Checks */}
          <View style={styles.checksRow}>
            {approval.checks.map((check, i) => (
              <View key={i} style={styles.checkItem}>
                <Ionicons
                  name={check.passed ? 'checkmark-circle' : 'alert-circle'}
                  size={14}
                  color={check.passed ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning}
                />
                <Text style={styles.checkLabel}>{check.label}</Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actionRow}>
            <Pressable style={styles.rejectButton} onPress={() => handleReject(approval.id)}>
              <Ionicons name="close" size={16} color={SemanticColors.feedbackError} />
              <Text style={styles.rejectText}>Afwijzen</Text>
            </Pressable>
            <Pressable style={styles.approveButton} onPress={() => handleApprove(approval.id)}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.approveText}>Goedkeuren</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {approvals.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle" size={48} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.emptyTitle}>Alles goedgekeurd!</Text>
          <Text style={styles.emptySubtext}>Geen wachtende goedkeuringen</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  content: { padding: Spacing.md, gap: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 10, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: SemanticColors.borderDefault },
  statValue: { fontSize: 20, fontWeight: '700', color: SemanticColors.textPrimary },
  statLabel: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 2 },
  approvalCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.md, borderLeftWidth: 4, borderWidth: 1, borderColor: SemanticColors.borderDefault, gap: 8 },
  approvalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  approvalType: { backgroundColor: SemanticColors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  approvalTypeText: { fontSize: 11, fontWeight: '600', color: SemanticColors.textSecondary },
  priorityBadge: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  approvalTitle: { fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary },
  approvalDesc: { fontSize: 13, color: SemanticColors.textSecondary, lineHeight: 18 },
  approvalMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: SemanticColors.textTertiary },
  metaSeparator: { fontSize: 12, color: SemanticColors.textTertiary },
  amountText: { fontSize: 20, fontWeight: '700', color: SemanticColors.textPrimary },
  checksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkLabel: { fontSize: 12, color: SemanticColors.textSecondary },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  rejectButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: SemanticColors.feedbackError + '30', backgroundColor: SemanticColors.feedbackErrorBg },
  rejectText: { fontSize: 14, fontWeight: '600', color: SemanticColors.feedbackError },
  approveButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: SemanticColors.feedbackSuccess },
  approveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  emptyState: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: SemanticColors.textPrimary },
  emptySubtext: { fontSize: 14, color: SemanticColors.textTertiary },

  // Cross-Role Workflow Styles
  wfSection: { gap: Spacing.sm },
  wfSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wfSectionTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary },
  wfSectionBadge: { backgroundColor: Palette.hermesOrange, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  wfSectionBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  wfValueBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SemanticColors.feedbackWarningBg, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: SemanticColors.feedbackWarningBorder },
  wfValueBannerText: { fontSize: 13, fontWeight: '600', color: SemanticColors.feedbackWarning },
  wfCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: SemanticColors.borderDefault, gap: 8 },
  wfCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  wfCardTitle: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary },
  wfCardMeta: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
  wfCardAmount: { fontSize: 16, fontWeight: '700', color: Palette.hermesOrange },
  wfStepsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  wfStepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  wfStepDot: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  wfStepConnector: { flex: 1, height: 2, backgroundColor: SemanticColors.borderDefault, marginHorizontal: 2 },
  wfCurrentStep: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wfCurrentStepText: { fontSize: 12, color: SemanticColors.textSecondary },
  wfParticipants: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wfParticipantChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SemanticColors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  wfParticipantText: { fontSize: 10, color: SemanticColors.textTertiary },
});
