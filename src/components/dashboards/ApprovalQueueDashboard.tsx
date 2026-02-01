import { useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import {
  ACTION_DEFINITIONS,
  createAction,
  submitForApproval,
  recordApproval,
  executeAction,
  generateActionDashboard,
  type ActionInstance,
  type ActionCategory,
  type ActionRiskLevel,
  type ApprovalRole,
} from '../../modules/agentActions';

type TabType = 'pending' | 'my-approvals' | 'executed' | 'all';

// Mock current user roles
const CURRENT_USER_ROLES: ApprovalRole[] = ['project-manager', 'coo'];
const CURRENT_USER_ID = 'user-001';
const CURRENT_USER_NAME = 'John Smith';

// Mock action instances
const createMockActions = (): ActionInstance[] => {
  const actions: ActionInstance[] = [];

  // Pending draw request
  const drawRequest = createAction('draw-request', 'uk-001', 'system', {
    title: 'Lender Draw Request #5',
    description: 'Monthly draw request for January 2024 construction progress',
    generatedContent: 'DRAW REQUEST #5\n================\nProject: Whitechapel Mixed-Use\nAmount: £2,450,000',
    amount: 2450000,
    currency: 'GBP',
  });
  actions.push(submitForApproval(drawRequest, 'system'));

  // Pending change order
  const changeOrder = createAction('approve-change-order', 'uk-001', 'site-lead-001', {
    title: 'CO-2024-015: Additional Fire Stopping',
    description: 'Fire stopping requirements to level 3 risers per BC comment',
    amount: 45000,
    currency: 'GBP',
    linkedEntities: [{ type: 'change-order', id: 'co-015' }],
  });
  actions.push(submitForApproval(changeOrder, 'site-lead-001'));

  // Pending payment
  const payment = createAction('approve-payment', 'uk-001', 'qs-001', {
    title: 'Payment Cert #12 - BuildRight Construction',
    description: 'Monthly payment certificate for December works',
    amount: 850000,
    currency: 'GBP',
  });
  actions.push(submitForApproval(payment, 'qs-001'));

  // S106 payment
  const s106 = createAction('s106-payment', 'uk-001', 'system', {
    title: 'S106 Education Contribution - Instalment 1',
    description: 'First instalment of education contribution per S106 agreement',
    amount: 93600,
    currency: 'GBP',
  });
  actions.push(submitForApproval(s106, 'system'));

  // Reforecast approval
  const reforecast = createAction('approve-reforecast', 'uk-001', 'coo', {
    title: 'Q1 2024 Schedule Reforecast',
    description: 'Updated schedule reflecting weather delays and recovery plan',
    generatedContent: 'REFORECAST SUMMARY\n=================\nNew completion: 2024-09-30\nRecovery plan attached',
  });
  actions.push(submitForApproval(reforecast, 'coo'));

  // An already executed action
  const executedPayment = createAction('approve-payment', 'uk-001', 'qs-001', {
    title: 'Payment Cert #11 - BuildRight Construction',
    description: 'November monthly payment',
    amount: 780000,
    currency: 'GBP',
  });
  let executed = submitForApproval(executedPayment, 'qs-001');
  executed = recordApproval(executed, 'project-manager', 'user-001', 'John Smith', 'approved');
  executed = executeAction(executed, 'user-001');
  actions.push(executed);

  return actions;
};

export function ApprovalQueueDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [actions, setActions] = useState<ActionInstance[]>(() => createMockActions());
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const dashboard = useMemo(
    () => generateActionDashboard(actions, CURRENT_USER_ROLES),
    [actions]
  );

  const handleApprove = (actionId: string) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== actionId) return a;
        // Find which role the user can approve as
        const pendingApproval = a.approvals.find(
          (app) => app.decision === 'pending' && CURRENT_USER_ROLES.includes(app.role)
        );
        if (pendingApproval) {
          return recordApproval(a, pendingApproval.role, CURRENT_USER_ID, CURRENT_USER_NAME, 'approved');
        }
        return a;
      })
    );
  };

  const handleReject = (actionId: string) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== actionId) return a;
        const pendingApproval = a.approvals.find(
          (app) => app.decision === 'pending' && CURRENT_USER_ROLES.includes(app.role)
        );
        if (pendingApproval) {
          return recordApproval(a, pendingApproval.role, CURRENT_USER_ID, CURRENT_USER_NAME, 'rejected', 'Requires revision');
        }
        return a;
      })
    );
  };

  const handleExecute = (actionId: string) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== actionId || a.status !== 'approved') return a;
        return executeAction(a, CURRENT_USER_ID);
      })
    );
  };

  const getCategoryColor = (category: ActionCategory) => {
    switch (category) {
      case 'financial': return Colors.success;
      case 'contractual': return Colors.accentDeep;
      case 'compliance': return Colors.accentMuted;
      case 'communication': return '#9B59B6';
      case 'schedule': return Colors.warning;
      case 'risk': return Colors.danger;
      default: return Colors.muted;
    }
  };

  const getRiskColor = (risk: ActionRiskLevel) => {
    switch (risk) {
      case 'critical': return Colors.danger;
      case 'high': return Colors.warning;
      case 'medium': return Colors.accentMuted;
      case 'low': return Colors.success;
    }
  };

  const formatCurrency = (amount: number) =>
    `£${amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const hoursRemaining = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (hoursRemaining < 0) return 'Expired';
    if (hoursRemaining < 24) return `${hoursRemaining}h remaining`;
    return `${Math.floor(hoursRemaining / 24)}d remaining`;
  };

  const getFilteredActions = (): ActionInstance[] => {
    switch (activeTab) {
      case 'pending':
        return dashboard.pendingActions;
      case 'my-approvals':
        return dashboard.myPendingApprovals;
      case 'executed':
        return actions.filter((a) => a.status === 'executed');
      case 'all':
        return actions;
      default:
        return [];
    }
  };

  const renderActionCard = (action: ActionInstance) => {
    const definition = ACTION_DEFINITIONS.find((d) => d.type === action.type);
    const isExpanded = expandedAction === action.id;
    const canUserApprove = action.approvals.some(
      (a) => a.decision === 'pending' && CURRENT_USER_ROLES.includes(a.role)
    );

    return (
      <View key={action.id} style={styles.actionCard}>
        <Pressable
          style={styles.actionHeader}
          onPress={() => setExpandedAction(isExpanded ? null : action.id)}
        >
          <View style={styles.actionHeaderLeft}>
            <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(definition?.category || 'financial') + '20' }]}>
              <Text style={[styles.categoryText, { color: getCategoryColor(definition?.category || 'financial') }]}>
                {definition?.category.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.riskBadge, { backgroundColor: getRiskColor(action.riskLevel) + '20' }]}>
              <Text style={[styles.riskText, { color: getRiskColor(action.riskLevel) }]}>
                {action.riskLevel.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: action.status === 'pending-approval' ? Colors.warning + '20' :
                            action.status === 'approved' ? Colors.success + '20' :
                            action.status === 'executed' ? Colors.accentDeep + '20' :
                            action.status === 'rejected' ? Colors.danger + '20' : Colors.muted + '20'
          }]}>
            <Text style={[styles.statusText, {
              color: action.status === 'pending-approval' ? Colors.warning :
                     action.status === 'approved' ? Colors.success :
                     action.status === 'executed' ? Colors.accentDeep :
                     action.status === 'rejected' ? Colors.danger : Colors.muted
            }]}>
              {action.status.replace(/-/g, ' ')}
            </Text>
          </View>
        </Pressable>

        <Text style={styles.actionTitle}>{action.title}</Text>
        <Text style={styles.actionDescription}>{action.description}</Text>

        {action.amount && (
          <Text style={styles.actionAmount}>{formatCurrency(action.amount)}</Text>
        )}

        {action.expiresAt && action.status === 'pending-approval' && (
          <Text style={styles.expiryText}>{getTimeRemaining(action.expiresAt)}</Text>
        )}

        {/* Approval Status */}
        <View style={styles.approvalsSection}>
          <Text style={styles.approvalsLabel}>Approvals Required:</Text>
          <View style={styles.approvalsRow}>
            {action.approvals.map((approval, index) => (
              <View key={index} style={[
                styles.approvalBadge,
                approval.decision === 'approved' && styles.approvalApproved,
                approval.decision === 'rejected' && styles.approvalRejected,
              ]}>
                <Text style={[
                  styles.approvalText,
                  approval.decision === 'approved' && styles.approvalTextApproved,
                  approval.decision === 'rejected' && styles.approvalTextRejected,
                ]}>
                  {approval.role.replace(/-/g, ' ')}
                  {approval.decision === 'approved' && ' ✓'}
                  {approval.decision === 'rejected' && ' ✗'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Expanded Content */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {action.generatedContent && (
              <View style={styles.generatedContent}>
                <Text style={styles.generatedLabel}>Generated Content:</Text>
                <ScrollView style={styles.generatedScroll} nestedScrollEnabled>
                  <Text style={styles.generatedText}>{action.generatedContent}</Text>
                </ScrollView>
              </View>
            )}

            {/* Audit Trail */}
            <View style={styles.auditSection}>
              <Text style={styles.auditLabel}>Audit Trail:</Text>
              {action.auditTrail.slice(-5).map((entry, index) => (
                <View key={index} style={styles.auditRow}>
                  <Text style={styles.auditTime}>
                    {new Date(entry.timestamp).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                  <Text style={styles.auditAction}>{entry.action}</Text>
                  <Text style={styles.auditDetails}>{entry.details}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {canUserApprove && action.status === 'pending-approval' && (
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(action.id)}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(action.id)}
            >
              <Text style={styles.approveButtonText}>Approve</Text>
            </Pressable>
          </View>
        )}

        {action.status === 'approved' && (
          <Pressable
            style={[styles.actionButton, styles.executeButton]}
            onPress={() => handleExecute(action.id)}
          >
            <Text style={styles.executeButtonText}>Execute Action</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={Typography.title}>Approval Queue</Text>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, dashboard.myPendingApprovals.length > 0 && styles.summaryCardHighlight]}>
          <Text style={[styles.summaryValue, dashboard.myPendingApprovals.length > 0 && styles.summaryValueHighlight]}>
            {dashboard.myPendingApprovals.length}
          </Text>
          <Text style={styles.summaryLabel}>My Approvals</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{dashboard.pendingActions.length}</Text>
          <Text style={styles.summaryLabel}>Total Pending</Text>
        </View>
        <View style={[styles.summaryCard, dashboard.upcomingExpiry.length > 0 && styles.summaryCardWarning]}>
          <Text style={[styles.summaryValue, dashboard.upcomingExpiry.length > 0 && styles.summaryValueWarning]}>
            {dashboard.upcomingExpiry.length}
          </Text>
          <Text style={styles.summaryLabel}>Expiring Soon</Text>
        </View>
      </View>

      {/* Risk Summary */}
      {Object.keys(dashboard.byRiskLevel).length > 0 && (
        <View style={styles.riskSummaryRow}>
          {dashboard.byRiskLevel.critical && (
            <View style={[styles.riskSummaryItem, { backgroundColor: Colors.danger + '20' }]}>
              <Text style={[styles.riskSummaryValue, { color: Colors.danger }]}>
                {dashboard.byRiskLevel.critical}
              </Text>
              <Text style={styles.riskSummaryLabel}>Critical</Text>
            </View>
          )}
          {dashboard.byRiskLevel.high && (
            <View style={[styles.riskSummaryItem, { backgroundColor: Colors.warning + '20' }]}>
              <Text style={[styles.riskSummaryValue, { color: Colors.warning }]}>
                {dashboard.byRiskLevel.high}
              </Text>
              <Text style={styles.riskSummaryLabel}>High</Text>
            </View>
          )}
          {dashboard.byRiskLevel.medium && (
            <View style={[styles.riskSummaryItem, { backgroundColor: Colors.accentMuted + '20' }]}>
              <Text style={[styles.riskSummaryValue, { color: Colors.accentMuted }]}>
                {dashboard.byRiskLevel.medium}
              </Text>
              <Text style={styles.riskSummaryLabel}>Medium</Text>
            </View>
          )}
        </View>
      )}

      {/* Tab Navigation */}
      <View style={styles.tabRow}>
        {(['pending', 'my-approvals', 'executed', 'all'] as TabType[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'my-approvals' ? 'My Approvals' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Actions List */}
      <View style={styles.actionsList}>
        {getFilteredActions().length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyText}>No actions in this queue</Text>
          </View>
        ) : (
          getFilteredActions().map(renderActionCard)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 100,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  summaryCardHighlight: {
    backgroundColor: Colors.accentDeep + '10',
    borderColor: Colors.accentDeep + '40',
  },
  summaryCardWarning: {
    backgroundColor: Colors.warning + '10',
    borderColor: Colors.warning + '40',
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  summaryValueHighlight: {
    color: Colors.accentDeep,
  },
  summaryValueWarning: {
    color: Colors.warning,
  },
  summaryLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  riskSummaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  riskSummaryItem: {
    flex: 1,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  riskSummaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  riskSummaryLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.surface,
  },
  tabText: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.text,
  },
  actionsList: {
    gap: Spacing.md,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionHeaderLeft: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: '700',
  },
  riskBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  riskText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  actionDescription: {
    color: Colors.muted,
    fontSize: 12,
  },
  actionAmount: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  expiryText: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  approvalsSection: {
    gap: 6,
  },
  approvalsLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  approvalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  approvalBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  approvalApproved: {
    backgroundColor: Colors.success + '20',
    borderColor: Colors.success + '40',
  },
  approvalRejected: {
    backgroundColor: Colors.danger + '20',
    borderColor: Colors.danger + '40',
  },
  approvalText: {
    color: Colors.muted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  approvalTextApproved: {
    color: Colors.success,
  },
  approvalTextRejected: {
    color: Colors.danger,
  },
  expandedContent: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  generatedContent: {
    gap: 8,
  },
  generatedLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  generatedScroll: {
    maxHeight: 150,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    padding: Spacing.sm,
  },
  generatedText: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  auditSection: {
    gap: 8,
  },
  auditLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  auditRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  auditTime: {
    color: Colors.muted,
    fontSize: 10,
    width: 80,
  },
  auditAction: {
    color: Colors.accentMuted,
    fontSize: 10,
    fontWeight: '600',
    width: 60,
  },
  auditDetails: {
    color: Colors.muted,
    fontSize: 10,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
  },
  rejectButtonText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    backgroundColor: Colors.success,
  },
  approveButtonText: {
    color: '#0B0C0F',
    fontSize: 14,
    fontWeight: '700',
  },
  executeButton: {
    backgroundColor: Colors.accentDeep,
    marginTop: Spacing.sm,
  },
  executeButtonText: {
    color: '#0B0C0F',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    color: Colors.success,
    marginBottom: Spacing.md,
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 14,
  },
});
