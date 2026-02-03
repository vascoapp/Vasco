// =============================================================================
// AGENT ACTIONS PANEL - System of Action Interface
// =============================================================================
// One-tap approval for AI-generated actions (a16z "system of action" pattern)
// =============================================================================

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import {
  usePendingActions,
  useActionStats,
  agentActionsService,
} from '../../services';
import type { AgentAction, ActionStake } from '../../types/agent-actions';

type IconName = keyof typeof Ionicons.glyphMap;

const STAKE_CONFIG: Record<ActionStake, { color: string; bgColor: string; icon: IconName; label: string }> = {
  low: {
    color: SemanticColors.feedbackSuccess,
    bgColor: SemanticColors.feedbackSuccessBg,
    icon: 'checkmark-circle',
    label: 'Auto',
  },
  medium: {
    color: SemanticColors.feedbackWarning,
    bgColor: SemanticColors.feedbackWarningBg,
    icon: 'hand-right',
    label: 'Review',
  },
  high: {
    color: SemanticColors.feedbackError,
    bgColor: SemanticColors.feedbackErrorBg,
    icon: 'alert-circle',
    label: 'Approval',
  },
};

const CATEGORY_ICONS: Record<string, IconName> = {
  quote: 'document-text',
  invoice: 'receipt',
  scheduling: 'calendar',
  purchasing: 'cart',
  communication: 'chatbubble',
  compliance: 'shield-checkmark',
  reporting: 'bar-chart',
  'job-management': 'construct',
};

export function AgentActionsPanel() {
  const { actions: pendingActions, pendingCount } = usePendingActions();
  const stats = useActionStats();
  const [selectedAction, setSelectedAction] = useState<AgentAction | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const handleApprove = async (action: AgentAction) => {
    setProcessing(action.id);
    try {
      await agentActionsService.approveAction(action.id);
      setSelectedAction(null);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (action: AgentAction, reason?: string) => {
    setProcessing(action.id);
    try {
      await agentActionsService.rejectAction(action.id, reason);
      setSelectedAction(null);
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async () => {
    if (!pendingActions) return;
    const lowStakeIds = pendingActions
      .filter((a: AgentAction) => a.stake === 'low' && a.confidence >= 85)
      .map((a: AgentAction) => a.id);

    if (lowStakeIds.length > 0) {
      await agentActionsService.bulkApprove(lowStakeIds);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!pendingActions || pendingActions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="checkmark-done" size={28} color={SemanticColors.feedbackSuccess} />
        </View>
        <Text style={styles.emptyTitle}>All caught up!</Text>
        <Text style={styles.emptySubtitle}>No pending actions to review</Text>
      </View>
    );
  }

  const lowStakeCount = pendingActions.filter((a: AgentAction) => a.stake === 'low' && a.confidence >= 85).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="flash" size={18} color={Palette.hermesOrange} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Pending Actions</Text>
            <Text style={styles.headerSubtitle}>
              {pendingActions.length} action{pendingActions.length !== 1 ? 's' : ''} ready for review
            </Text>
          </View>
        </View>
        {lowStakeCount > 0 && (
          <Pressable style={styles.bulkApproveButton} onPress={handleBulkApprove}>
            <Ionicons name="checkmark-done" size={14} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.bulkApproveText}>Approve {lowStakeCount} safe</Text>
          </Pressable>
        )}
      </View>

      {/* Actions List */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsList}
      >
        {pendingActions.map((action: AgentAction) => {
          const stakeConfig = STAKE_CONFIG[action.stake];
          const categoryIcon = CATEGORY_ICONS[action.category] || 'ellipsis-horizontal';
          const isProcessing = processing === action.id;

          return (
            <Pressable
              key={action.id}
              style={styles.actionCard}
              onPress={() => setSelectedAction(action)}
              disabled={isProcessing}
            >
              {/* Stake Indicator */}
              <View style={[styles.stakeIndicator, { backgroundColor: stakeConfig.bgColor }]}>
                <Ionicons name={stakeConfig.icon} size={12} color={stakeConfig.color} />
                <Text style={[styles.stakeLabel, { color: stakeConfig.color }]}>
                  {stakeConfig.label}
                </Text>
              </View>

              {/* Category Icon */}
              <View style={[styles.categoryIcon, { backgroundColor: SemanticColors.actionPrimary + '15' }]}>
                <Ionicons name={categoryIcon} size={20} color={SemanticColors.actionPrimary} />
              </View>

              {/* Content */}
              <Text style={styles.actionTitle} numberOfLines={2}>
                {action.title}
              </Text>
              <Text style={styles.actionReason} numberOfLines={2}>
                {action.reason}
              </Text>

              {/* Preview Amount if applicable */}
              {action.preview?.amount && (
                <Text style={styles.actionAmount}>
                  €{action.preview.amount.toLocaleString('nl-NL')}
                </Text>
              )}

              {/* Footer */}
              <View style={styles.actionFooter}>
                <Text style={styles.actionTime}>{formatTimeAgo(action.createdAt)}</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>{action.confidence}%</Text>
                </View>
              </View>

              {/* Quick Approve Button */}
              {action.stake === 'low' && (
                <Pressable
                  style={styles.quickApproveButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleApprove(action);
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.quickApproveText}>Approve</Text>
                    </>
                  )}
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Stats Row */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.todayExecuted}</Text>
            <Text style={styles.statLabel}>Executed today</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.rejected}</Text>
            <Text style={styles.statLabel}>Rejected</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Math.round(stats.avgConfidence)}%</Text>
            <Text style={styles.statLabel}>Avg confidence</Text>
          </View>
        </View>
      )}

      {/* Action Detail Modal */}
      <Modal
        visible={selectedAction !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedAction(null)}
      >
        {selectedAction && (
          <ActionDetailView
            action={selectedAction}
            onApprove={() => handleApprove(selectedAction)}
            onReject={(reason) => handleReject(selectedAction, reason)}
            onClose={() => setSelectedAction(null)}
            isProcessing={processing === selectedAction.id}
          />
        )}
      </Modal>
    </View>
  );
}

// Action Detail View Component
function ActionDetailView({
  action,
  onApprove,
  onReject,
  onClose,
  isProcessing,
}: {
  action: AgentAction;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  onClose: () => void;
  isProcessing: boolean;
}) {
  const stakeConfig = STAKE_CONFIG[action.stake];
  const categoryIcon = CATEGORY_ICONS[action.category] || 'ellipsis-horizontal';

  return (
    <View style={styles.modalContainer}>
      {/* Modal Header */}
      <View style={styles.modalHeader}>
        <Pressable style={styles.modalCloseButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={SemanticColors.textSecondary} />
        </Pressable>
        <Text style={styles.modalTitle}>Review Action</Text>
        <View style={styles.modalHeaderRight} />
      </View>

      <ScrollView contentContainerStyle={styles.modalContent}>
        {/* Stake Badge */}
        <View style={[styles.modalStakeBadge, { backgroundColor: stakeConfig.bgColor }]}>
          <Ionicons name={stakeConfig.icon} size={16} color={stakeConfig.color} />
          <Text style={[styles.modalStakeText, { color: stakeConfig.color }]}>
            {action.stake.charAt(0).toUpperCase() + action.stake.slice(1)} Stake Action
          </Text>
        </View>

        {/* Action Info */}
        <View style={styles.modalSection}>
          <View style={[styles.modalCategoryIcon, { backgroundColor: SemanticColors.actionPrimary + '15' }]}>
            <Ionicons name={categoryIcon} size={28} color={SemanticColors.actionPrimary} />
          </View>
          <Text style={styles.modalActionTitle}>{action.title}</Text>
          <Text style={styles.modalActionDescription}>{action.description}</Text>
        </View>

        {/* Reason */}
        <View style={styles.modalSection}>
          <View style={styles.modalSectionHeader}>
            <Ionicons name="bulb-outline" size={16} color={Palette.hermesOrange} />
            <Text style={styles.modalSectionTitle}>Why Vasco suggests this</Text>
          </View>
          <Text style={styles.modalReasonText}>{action.reason}</Text>
        </View>

        {/* Preview */}
        {action.preview && (
          <View style={styles.modalSection}>
            <View style={styles.modalSectionHeader}>
              <Ionicons name="eye-outline" size={16} color={SemanticColors.textSecondary} />
              <Text style={styles.modalSectionTitle}>Preview</Text>
            </View>
            {action.preview.content && (
              <View style={styles.previewContent}>
                <Text style={styles.previewText}>{action.preview.content}</Text>
              </View>
            )}
            {action.preview.amount && (
              <View style={styles.previewAmountRow}>
                <Text style={styles.previewLabel}>Amount</Text>
                <Text style={styles.previewAmount}>
                  €{action.preview.amount.toLocaleString('nl-NL')}
                </Text>
              </View>
            )}
            {action.preview.proposedDate && (
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Proposed Date</Text>
                <Text style={styles.previewValue}>{action.preview.proposedDate}</Text>
              </View>
            )}
            {action.preview.fields?.map((field, index) => (
              <View key={index} style={styles.previewRow}>
                <Text style={styles.previewLabel}>{field.label}</Text>
                <Text style={styles.previewValue}>{field.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Estimated Impact */}
        {action.estimatedImpact && (
          <View style={styles.modalSection}>
            <View style={styles.modalSectionHeader}>
              <Ionicons name="trending-up" size={16} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.modalSectionTitle}>Estimated Impact</Text>
            </View>
            <View style={styles.impactGrid}>
              {action.estimatedImpact.timeSavedMinutes && (
                <View style={styles.impactItem}>
                  <Text style={styles.impactValue}>
                    {action.estimatedImpact.timeSavedMinutes} min
                  </Text>
                  <Text style={styles.impactLabel}>Time saved</Text>
                </View>
              )}
              {action.estimatedImpact.revenueImpact && (
                <View style={styles.impactItem}>
                  <Text style={styles.impactValue}>
                    €{action.estimatedImpact.revenueImpact.toLocaleString('nl-NL')}
                  </Text>
                  <Text style={styles.impactLabel}>Revenue impact</Text>
                </View>
              )}
              {action.estimatedImpact.paymentSpeedup && (
                <View style={styles.impactItem}>
                  <Text style={styles.impactValue}>
                    {action.estimatedImpact.paymentSpeedup}d
                  </Text>
                  <Text style={styles.impactLabel}>Faster payment</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Confidence */}
        <View style={styles.confidenceSection}>
          <Text style={styles.confidenceLabel}>Agent Confidence</Text>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${action.confidence}%`,
                  backgroundColor:
                    action.confidence >= 80
                      ? SemanticColors.feedbackSuccess
                      : action.confidence >= 60
                        ? SemanticColors.feedbackWarning
                        : SemanticColors.feedbackError,
                },
              ]}
            />
          </View>
          <Text style={styles.confidencePercent}>{action.confidence}%</Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.modalActions}>
        <Pressable
          style={[styles.rejectButton, isProcessing && styles.buttonDisabled]}
          onPress={() => onReject()}
          disabled={isProcessing}
        >
          <Ionicons name="close" size={20} color={SemanticColors.feedbackError} />
          <Text style={styles.rejectButtonText}>Reject</Text>
        </Pressable>
        <Pressable
          style={[styles.approveButton, isProcessing && styles.buttonDisabled]}
          onPress={onApprove}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.approveButtonText}>Approve & Execute</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  bulkApproveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bulkApproveText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  actionsList: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  actionCard: {
    width: 200,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.xs,
  },
  stakeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: Spacing.xs,
  },
  stakeLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    lineHeight: 18,
  },
  actionReason: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  actionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.actionPrimary,
    marginTop: Spacing.xs,
  },
  actionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  actionTime: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  confidenceBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  quickApproveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccess,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: Spacing.sm,
  },
  quickApproveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.md,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalHeaderRight: {
    width: 40,
  },
  modalContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  modalStakeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalStakeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  modalCategoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  modalActionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  modalActionDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalReasonText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },
  previewContent: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: Spacing.sm,
  },
  previewText: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  previewAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  previewAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.actionPrimary,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  impactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  impactItem: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  impactValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  impactLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  confidenceSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  confidenceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  confidenceBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidencePercent: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingVertical: 14,
    borderRadius: 12,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  approveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: SemanticColors.feedbackSuccess,
    paddingVertical: 14,
    borderRadius: 12,
  },
  approveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
