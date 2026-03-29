// =============================================================================
// WORKFLOW STATUS CARD - Active Workflow Monitoring
// =============================================================================
// Displays running agentic workflows with step progress
// a16z pattern: Multi-step workflows with human-in-the-loop checkpoints
// =============================================================================

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { useActiveWorkflows, workflowAgentsService } from '../../services';
import type { Workflow, WorkflowStep } from '../../types/workflow-agents';
import { useTranslation } from 'react-i18next';
type IconName = keyof typeof Ionicons.glyphMap;

const WORKFLOW_ICONS: Record<string, IconName> = {
  'quote-nurture': 'document-text',
  'cash-collection': 'cash',
  'job-closeout': 'checkmark-done-circle',
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  idle: { color: SemanticColors.textTertiary, label: 'Idle' },
  active: { color: SemanticColors.feedbackSuccess, label: 'Running' },
  paused: { color: SemanticColors.feedbackWarning, label: 'Paused' },
  'waiting-approval': { color: SemanticColors.feedbackInfo, label: 'Needs Approval' },
  completed: { color: SemanticColors.textTertiary, label: 'Completed' },
  failed: { color: SemanticColors.feedbackError, label: 'Failed' },
  cancelled: { color: SemanticColors.textTertiary, label: 'Cancelled' },
};

interface WorkflowStatusCardProps {
  onPress?: () => void;
  compact?: boolean;
}

export function WorkflowStatusCard({ onPress, compact = false }: WorkflowStatusCardProps) {
  const { workflows: activeWorkflows } = useActiveWorkflows();
  const isLoading = !activeWorkflows;
  const pendingActions = null as any;

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.loadingPlaceholder} />
      </View>
    );
  }

  if (!activeWorkflows || activeWorkflows.length === 0) {
    return (
      <Pressable style={[styles.container, compact && styles.containerCompact]} onPress={onPress}>
        <View style={styles.emptyState}>
          <Ionicons name="git-branch-outline" size={24} color={SemanticColors.textTertiary} />
          <Text style={styles.emptyText}>No active workflows</Text>
          <Text style={styles.emptySubtext}>
            Workflows will appear here when Vasco starts automation sequences
          </Text>
        </View>
      </Pressable>
    );
  }

  const needsApproval = activeWorkflows.filter((w) => w.status === 'waiting-approval').length;

  if (compact) {
    return (
      <Pressable style={[styles.container, styles.containerCompact]} onPress={onPress}>
        <View style={styles.compactHeader}>
          <View style={styles.compactIcon}>
            <Ionicons name="git-branch" size={18} color={Palette.hermesOrange} />
          </View>
          <View style={styles.compactContent}>
            <Text style={styles.compactTitle}>Active Workflows</Text>
            <Text style={styles.compactCount}>
              {activeWorkflows.length} running
              {needsApproval > 0 && ` · ${needsApproval} need approval`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
        </View>
        {needsApproval > 0 && (
          <View style={styles.approvalBadge}>
            <Ionicons name="hand-right" size={12} color={SemanticColors.feedbackInfo} />
            <Text style={styles.approvalBadgeText}>
              {needsApproval} awaiting your approval
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="git-branch" size={20} color={Palette.hermesOrange} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Active Workflows</Text>
            <Text style={styles.headerSubtitle}>
              {activeWorkflows.length} running
              {pendingActions && pendingActions.length > 0 &&
                ` · ${pendingActions.length} pending actions`}
            </Text>
          </View>
        </View>
        {needsApproval > 0 && (
          <View style={styles.needsApprovalBadge}>
            <Text style={styles.needsApprovalText}>{needsApproval}</Text>
          </View>
        )}
      </View>

      {/* Workflow List */}
      <View style={styles.workflowList}>
        {activeWorkflows.slice(0, 3).map((workflow) => (
          <WorkflowItem key={workflow.id} workflow={workflow} />
        ))}
        {activeWorkflows.length > 3 && (
          <Text style={styles.moreWorkflows}>
            +{activeWorkflows.length - 3} more workflows
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// Workflow Item Component
function WorkflowItem({ workflow }: { workflow: Workflow }) {
  const icon = WORKFLOW_ICONS[workflow.type] || 'git-branch';
  const statusConfig = STATUS_CONFIG[workflow.status];

  const handleApprove = async (stepId: string) => {
    await workflowAgentsService.approveStep(workflow.id, stepId);
  };

  // Find current step needing approval
  const pendingStep = workflow.steps.find((s) => s.status === 'pending-approval');

  // Calculate progress
  const completedSteps = workflow.steps.filter((s) => s.status === 'completed').length;
  const progress = Math.round((completedSteps / workflow.steps.length) * 100);

  return (
    <View style={styles.workflowItem}>
      {/* Workflow Header */}
      <View style={styles.workflowHeader}>
        <View style={[styles.workflowIcon, { backgroundColor: SemanticColors.actionPrimary + '15' }]}>
          <Ionicons name={icon} size={16} color={SemanticColors.actionPrimary} />
        </View>
        <View style={styles.workflowInfo}>
          <Text style={styles.workflowName}>{workflow.name}</Text>
          <Text style={styles.workflowContext} numberOfLines={1}>
            {(workflow.context?.customerName as string) || (workflow.context?.jobTitle as string) || 'In progress'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '15' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {completedSteps}/{workflow.steps.length} steps
        </Text>
      </View>

      {/* Steps Timeline */}
      <View style={styles.stepsTimeline}>
        {workflow.steps.slice(0, 4).map((step, index) => (
          <StepIndicator
            key={step.id}
            step={step}
            isLast={index === Math.min(workflow.steps.length - 1, 3)}
          />
        ))}
        {workflow.steps.length > 4 && (
          <View style={styles.moreStepsIndicator}>
            <Text style={styles.moreStepsText}>+{workflow.steps.length - 4}</Text>
          </View>
        )}
      </View>

      {/* Approval Action */}
      {pendingStep && (
        <View style={styles.approvalSection}>
          <View style={styles.approvalContent}>
            <Ionicons name="hand-right" size={14} color={SemanticColors.feedbackInfo} />
            <Text style={styles.approvalLabel}>{pendingStep.name}</Text>
          </View>
          <Pressable
            style={styles.approveButton}
            onPress={() => handleApprove(pendingStep.id)}
          >
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={styles.approveButtonText}>Approve</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Step Indicator Component
function StepIndicator({
  step,
  isLast,
}: {
  step: WorkflowStep;
  isLast: boolean;
}) {
  const getStepColor = () => {
    switch (step.status) {
      case 'completed':
        return SemanticColors.feedbackSuccess;
      case 'in-progress':
        return SemanticColors.actionPrimary;
      case 'pending-approval':
        return SemanticColors.feedbackInfo;
      case 'failed':
        return SemanticColors.feedbackError;
      case 'skipped':
        return SemanticColors.textTertiary;
      default:
        return SemanticColors.borderDefault;
    }
  };

  const getStepIcon = (): IconName => {
    switch (step.status) {
      case 'completed':
        return 'checkmark';
      case 'in-progress':
        return 'ellipsis-horizontal';
      case 'pending-approval':
        return 'hand-right';
      case 'failed':
        return 'close';
      case 'skipped':
        return 'remove';
      default:
        return 'ellipse-outline';
    }
  };

  const color = getStepColor();

  return (
    <View style={styles.stepIndicator}>
      <View style={[styles.stepDot, { backgroundColor: color }]}>
        {step.status !== 'pending' && (
          <Ionicons name={getStepIcon()} size={10} color="#fff" />
        )}
      </View>
      {!isLast && (
        <View
          style={[
            styles.stepLine,
            { backgroundColor: step.status === 'completed' ? color : SemanticColors.borderDefault },
          ]}
        />
      )}
    </View>
  );
}

// Widget version for dashboard
export function WorkflowWidget({ onPress }: { onPress?: () => void }) {
  const { workflows: activeWorkflows } = useActiveWorkflows();

  const count = activeWorkflows?.length || 0;
  const needsApproval = activeWorkflows?.filter((w: any) => w.status === 'waiting-approval').length || 0;

  return (
    <Pressable style={styles.widget} onPress={onPress}>
      <View style={styles.widgetIcon}>
        <Ionicons name="git-branch" size={20} color={Palette.hermesOrange} />
      </View>
      <View style={styles.widgetContent}>
        <Text style={styles.widgetValue}>{count}</Text>
        <Text style={styles.widgetLabel}>Active workflows</Text>
      </View>
      {needsApproval > 0 && (
        <View style={styles.widgetBadge}>
          <Text style={styles.widgetBadgeText}>{needsApproval}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  containerCompact: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  loadingPlaceholder: {
    height: 100,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  emptyText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  emptySubtext: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
  // Header
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
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  needsApprovalBadge: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needsApprovalText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.feedbackInfo,
  },
  // Workflow List
  workflowList: {
    gap: Spacing.sm,
  },
  workflowItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  workflowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  workflowIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workflowInfo: {
    flex: 1,
  },
  workflowName: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  workflowContext: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    minWidth: 60,
    textAlign: 'right',
  },
  // Steps Timeline
  stepsTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
  },
  moreStepsIndicator: {
    backgroundColor: SemanticColors.borderDefault,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moreStepsText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  // Approval Section
  approvalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  approvalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  approvalLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.feedbackInfo,
    fontFamily: TYPE.labelFamily,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccess,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  approveButtonText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
  moreWorkflows: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.actionPrimary,
    textAlign: 'center',
  },
  // Compact styles
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContent: {
    flex: 1,
  },
  compactTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  compactCount: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  approvalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: SemanticColors.feedbackInfoBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 52,
  },
  approvalBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackInfo,
  },
  // Widget styles
  widget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  widgetIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetContent: {
    flex: 1,
  },
  widgetValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  widgetLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  widgetBadge: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  widgetBadgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.feedbackInfo,
  },
});
