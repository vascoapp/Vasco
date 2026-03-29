import { useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import {
  MOCK_S106_HEADS,
  MOCK_CIL_LIABILITY,
  generateS106CILDashboard,
  generateS106Alerts,
  generateCILAlerts,
  type S106Head,
  type CILLiability,
  type S106Category,
  type S106CILAlert,
} from '../../modules/s106CILTracker';

type TabType = 'overview' | 's106' | 'cil' | 'alerts';

export function S106CILDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const s106Agreements = useMemo(() => [{
    id: 'agreement-1',
    projectId: 'uk-001',
    permitId: 'perm-001',
    deedRef: 'S106/2023/001',
    dateSigned: '2023-06-15',
    parties: ['Developer Ltd', 'Tower Hamlets Council', 'TfL'],
    localAuthority: 'Tower Hamlets',
    totalFinancialValue: 430000,
    heads: MOCK_S106_HEADS,
  }], []);

  const cilLiabilities = useMemo(() => [MOCK_CIL_LIABILITY], []);

  const dashboard = useMemo(
    () => generateS106CILDashboard(s106Agreements, cilLiabilities),
    [s106Agreements, cilLiabilities]
  );

  const allAlerts = useMemo(() => [
    ...generateS106Alerts(MOCK_S106_HEADS),
    ...generateCILAlerts(cilLiabilities),
  ], [cilLiabilities]);

  const formatCurrency = (amount: number) =>
    `£${amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

  const getCategoryIcon = (category: S106Category) => {
    switch (category) {
      case 'affordable-housing': return '🏠';
      case 'education': return '📚';
      case 'highways': return '🛣️';
      case 'open-space': return '🌳';
      case 'healthcare': return '🏥';
      case 'public-transport': return '🚌';
      default: return '📋';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'discharged':
      case 'paid':
        return SemanticColors.feedbackSuccess;
      case 'triggered':
      case 'pending':
        return SemanticColors.feedbackWarning;
      case 'overdue':
        return SemanticColors.feedbackError;
      default:
        return SemanticColors.textSecondary;
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return SemanticColors.feedbackError;
      case 'warning': return SemanticColors.feedbackWarning;
      default: return SemanticColors.textSecondary;
    }
  };

  const renderS106Head = (head: S106Head) => (
    <View key={head.id} style={styles.headCard}>
      <View style={styles.headHeader}>
        <View style={styles.headTitleRow}>
          <Text style={styles.headIcon}>{getCategoryIcon(head.category)}</Text>
          <View style={styles.headTitleInfo}>
            <Text style={styles.headCategory}>
              {head.category.replace(/-/g, ' ').toUpperCase()}
            </Text>
            <Text style={styles.headClause}>{head.clauseRef}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(head.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(head.status) }]}>
            {head.status.replace(/-/g, ' ')}
          </Text>
        </View>
      </View>

      <Text style={styles.headDescription}>{head.description}</Text>

      <View style={styles.headDetails}>
        {head.financialValue && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Financial Value</Text>
            <Text style={styles.detailValue}>{formatCurrency(head.financialValue)}</Text>
          </View>
        )}
        {head.currentIndexedValue && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Indexed Value</Text>
            <Text style={[styles.detailValue, styles.indexedValue]}>
              {formatCurrency(head.currentIndexedValue)}
            </Text>
          </View>
        )}
        {head.inKindValue && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>In-Kind Value</Text>
            <Text style={styles.detailValue}>{formatCurrency(head.inKindValue)}</Text>
          </View>
        )}
      </View>

      <View style={styles.triggerRow}>
        <Text style={styles.triggerLabel}>Trigger:</Text>
        <Text style={styles.triggerText}>{head.triggerDescription}</Text>
      </View>

      {head.dueDate && (
        <View style={styles.dueDateRow}>
          <Text style={styles.dueDateLabel}>Due:</Text>
          <Text style={[styles.dueDateValue, head.status === 'overdue' && styles.overdue]}>
            {head.dueDate}
          </Text>
        </View>
      )}

      <View style={styles.recipientRow}>
        <Text style={styles.recipientLabel}>Recipient:</Text>
        <Text style={styles.recipientText}>{head.recipientAuthority}</Text>
      </View>
    </View>
  );

  const renderCILLiability = (liability: CILLiability) => (
    <View key={liability.id} style={styles.cilCard}>
      <View style={styles.cilHeader}>
        <View>
          <Text style={styles.cilAuthority}>{liability.localAuthority}</Text>
          <Text style={styles.cilZone}>{liability.zone} - {liability.useClass}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: SemanticColors.actionPrimary + '20' }]}>
          <Text style={[styles.statusText, { color: SemanticColors.actionPrimary }]}>
            {liability.status.replace(/-/g, ' ')}
          </Text>
        </View>
      </View>

      {/* Area Calculation */}
      <View style={styles.areaSection}>
        <Text style={styles.sectionLabel}>Area Calculation</Text>
        <View style={styles.areaGrid}>
          <View style={styles.areaItem}>
            <Text style={styles.areaValue}>{liability.grossInternalArea.toLocaleString()}</Text>
            <Text style={styles.areaLabel}>GIA (sqm)</Text>
          </View>
          <View style={styles.areaItem}>
            <Text style={styles.areaValue}>-{liability.existingLawfulArea.toLocaleString()}</Text>
            <Text style={styles.areaLabel}>Existing</Text>
          </View>
          <View style={styles.areaItem}>
            <Text style={[styles.areaValue, styles.chargeableArea]}>
              {liability.netChargeableArea.toLocaleString()}
            </Text>
            <Text style={styles.areaLabel}>Chargeable</Text>
          </View>
        </View>
      </View>

      {/* CIL Calculation */}
      <View style={styles.calcSection}>
        <Text style={styles.sectionLabel}>Liability Calculation</Text>
        <View style={styles.calcRow}>
          <Text style={Typography.body}>Base Rate</Text>
          <Text style={Typography.body}>£{liability.baseRate}/sqm</Text>
        </View>
        <View style={styles.calcRow}>
          <Text style={Typography.muted}>Indexation ({(liability.indexationFactor * 100 - 100).toFixed(0)}%)</Text>
          <Text style={Typography.muted}>£{liability.indexedRate.toFixed(0)}/sqm</Text>
        </View>
        <View style={styles.calcRow}>
          <Text style={Typography.muted}>Base Liability</Text>
          <Text style={Typography.muted}>{formatCurrency(liability.baseLiability)}</Text>
        </View>
        <View style={[styles.calcRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Net Liability</Text>
          <Text style={styles.totalValue}>{formatCurrency(liability.netLiability)}</Text>
        </View>
      </View>

      {/* Payment Schedule */}
      <View style={styles.scheduleSection}>
        <Text style={styles.sectionLabel}>Payment Schedule</Text>
        {liability.paymentSchedule.map((instalment, index) => (
          <View key={instalment.id} style={styles.instalmentRow}>
            <View style={styles.instalmentInfo}>
              <Text style={styles.instalmentNumber}>Instalment {instalment.instalmentNumber}</Text>
              <Text style={styles.instalmentDue}>{instalment.dueDate}</Text>
            </View>
            <View style={styles.instalmentRight}>
              <Text style={styles.instalmentAmount}>{formatCurrency(instalment.amount)}</Text>
              <View style={[
                styles.instalmentStatus,
                { backgroundColor: getStatusColor(instalment.status) + '20' }
              ]}>
                <Text style={[styles.instalmentStatusText, { color: getStatusColor(instalment.status) }]}>
                  {instalment.status}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderAlert = (alert: S106CILAlert) => (
    <View key={alert.id} style={[styles.alertCard, { borderLeftColor: getAlertSeverityColor(alert.severity) }]}>
      <View style={styles.alertHeader}>
        <View style={[styles.alertTypeBadge, { backgroundColor: alert.type === 's106' ? SemanticColors.actionPrimary + '20' : SemanticColors.textTertiary + '20' }]}>
          <Text style={[styles.alertTypeText, { color: alert.type === 's106' ? SemanticColors.actionPrimary : SemanticColors.textTertiary }]}>
            {alert.type.toUpperCase()}
          </Text>
        </View>
        {alert.daysRemaining !== undefined && (
          <Text style={[styles.alertDays, { color: getAlertSeverityColor(alert.severity) }]}>
            {alert.daysRemaining > 0 ? `${alert.daysRemaining}d remaining` : `${Math.abs(alert.daysRemaining)}d overdue`}
          </Text>
        )}
      </View>
      <Text style={styles.alertTitle}>{alert.title}</Text>
      <Text style={styles.alertDescription}>{alert.description}</Text>
      {alert.amount && (
        <Text style={styles.alertAmount}>{formatCurrency(alert.amount)}</Text>
      )}
      <View style={styles.alertAction}>
        <Text style={styles.alertActionLabel}>Action:</Text>
        <Text style={styles.alertActionText}>{alert.actionRequired}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={Typography.title}>S106 & CIL Tracker</Text>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatCurrency(dashboard.totalS106Value)}</Text>
          <Text style={styles.summaryLabel}>S106 Total</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatCurrency(dashboard.totalCILValue)}</Text>
          <Text style={styles.summaryLabel}>CIL Total</Text>
        </View>
        <View style={[styles.summaryCard, allAlerts.length > 0 && styles.summaryCardWarning]}>
          <Text style={[styles.summaryValue, allAlerts.length > 0 && styles.summaryValueWarning]}>
            {allAlerts.length}
          </Text>
          <Text style={styles.summaryLabel}>Alerts</Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabRow}>
        {(['overview', 's106', 'cil', 'alerts'] as TabType[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 's106' ? 'S106' : tab === 'cil' ? 'CIL' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Progress */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Completion Progress</Text>
            <View style={styles.progressSection}>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>S106 Obligations</Text>
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${(dashboard.completionProgress.s106Discharged / Math.max(1, dashboard.completionProgress.s106Total)) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {dashboard.completionProgress.s106Discharged}/{dashboard.completionProgress.s106Total}
                  </Text>
                </View>
              </View>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>CIL Payments</Text>
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${(dashboard.completionProgress.cilPaid / Math.max(1, dashboard.completionProgress.cilTotal)) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {formatCurrency(dashboard.completionProgress.cilPaid)} / {formatCurrency(dashboard.completionProgress.cilTotal)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Upcoming Payments */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Pending Payments</Text>
            {dashboard.pendingPayments.slice(0, 5).map((payment, index) => (
              <View key={index} style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <View style={[styles.paymentTypeBadge, { backgroundColor: payment.type === 's106' ? SemanticColors.actionPrimary + '20' : SemanticColors.textTertiary + '20' }]}>
                    <Text style={[styles.paymentTypeText, { color: payment.type === 's106' ? SemanticColors.actionPrimary : SemanticColors.textTertiary }]}>
                      {payment.type.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.paymentDue}>{payment.dueDate}</Text>
                </View>
                <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
              </View>
            ))}
          </View>

          {/* By Category */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>S106 by Category</Text>
            {dashboard.s106ByCategory.map((cat, index) => (
              <View key={index} style={styles.categoryRow}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryIcon}>{getCategoryIcon(cat.category)}</Text>
                  <Text style={styles.categoryName}>
                    {cat.category.replace(/-/g, ' ').charAt(0).toUpperCase() + cat.category.replace(/-/g, ' ').slice(1)}
                  </Text>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={styles.categoryValue}>{formatCurrency(cat.value)}</Text>
                  <View style={[styles.categoryStatusBadge, { backgroundColor: getStatusColor(cat.status) + '20' }]}>
                    <Text style={[styles.categoryStatusText, { color: getStatusColor(cat.status) }]}>
                      {cat.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* S106 Tab */}
      {activeTab === 's106' && (
        <View style={styles.headsList}>
          {MOCK_S106_HEADS.map(renderS106Head)}
        </View>
      )}

      {/* CIL Tab */}
      {activeTab === 'cil' && (
        <View style={styles.cilList}>
          {cilLiabilities.map(renderCILLiability)}
        </View>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <View style={styles.alertsList}>
          {allAlerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✓</Text>
              <Text style={styles.emptyText}>No alerts - all obligations on track</Text>
            </View>
          ) : (
            allAlerts.map(renderAlert)
          )}
        </View>
      )}
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
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
  },
  summaryCardWarning: {
    backgroundColor: SemanticColors.feedbackWarning + '10',
    borderColor: SemanticColors.feedbackWarning + '40',
  },
  summaryValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontWeight: '700',
  },
  summaryValueWarning: {
    color: SemanticColors.feedbackWarning,
  },
  summaryLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    marginTop: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: SemanticColors.surfacePrimary,
  },
  tabText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontWeight: '600',
  },
  tabTextActive: {
    color: SemanticColors.textPrimary,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  progressSection: {
    gap: Spacing.md,
  },
  progressItem: {
    gap: 8,
  },
  progressLabel: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '600',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 4,
  },
  progressText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentTypeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  paymentTypeText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '700',
  },
  paymentDue: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  paymentAmount: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryIcon: {
    fontSize: TYPE.sectionSize,
  },
  categoryName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '500',
  },
  categoryRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  categoryValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
  },
  categoryStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  categoryStatusText: {
    fontSize: TYPE.tinySize - 2,
    fontWeight: '600',
  },
  headsList: {
    gap: Spacing.md,
  },
  headCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 10,
  },
  headHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headIcon: {
    fontSize: TYPE.displaySize - 4,
  },
  headTitleInfo: {
    flex: 1,
  },
  headCategory: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headClause: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headDescription: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    lineHeight: 18,
  },
  headDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  detailItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: 10,
    minWidth: '45%',
    flex: 1,
  },
  detailLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
  },
  detailValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    marginTop: 2,
  },
  indexedValue: {
    color: SemanticColors.actionPrimary,
  },
  triggerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  triggerLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  triggerText: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.tinySize,
    flex: 1,
  },
  dueDateRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dueDateLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  dueDateValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.tinySize,
  },
  overdue: {
    color: SemanticColors.feedbackError,
    fontWeight: '700',
  },
  recipientRow: {
    flexDirection: 'row',
    gap: 6,
  },
  recipientLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  recipientText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  cilList: {
    gap: Spacing.md,
  },
  cilCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  cilHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cilAuthority: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontWeight: '700',
  },
  cilZone: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    marginTop: 2,
  },
  areaSection: {
    gap: 8,
  },
  sectionLabel: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontWeight: '700',
  },
  areaGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  areaItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  areaValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontWeight: '700',
  },
  areaLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    marginTop: 2,
  },
  chargeableArea: {
    color: SemanticColors.actionPrimary,
  },
  calcSection: {
    gap: 8,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: 10,
    marginTop: 6,
  },
  totalLabel: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
  },
  totalValue: {
    color: SemanticColors.actionPrimary,
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
  },
  scheduleSection: {
    gap: 8,
  },
  instalmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  instalmentInfo: {},
  instalmentNumber: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '600',
  },
  instalmentDue: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    marginTop: 2,
  },
  instalmentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  instalmentAmount: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
  },
  instalmentStatus: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  instalmentStatusText: {
    fontSize: TYPE.tinySize - 2,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  alertsList: {
    gap: Spacing.md,
  },
  alertCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderLeftWidth: 4,
    gap: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTypeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  alertTypeText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '700',
  },
  alertDays: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  alertTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
  },
  alertDescription: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  alertAmount: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontWeight: '700',
  },
  alertAction: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  alertActionLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  alertActionText: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.tinySize,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    color: SemanticColors.feedbackSuccess,
    marginBottom: Spacing.md,
  },
  emptyText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
  },
});
