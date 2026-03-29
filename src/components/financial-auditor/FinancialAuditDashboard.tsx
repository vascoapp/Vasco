/**
 * Financial Audit Dashboard
 *
 * Main dashboard combining all financial auditor functions:
 * - Invoice verification queue
 * - Unnecessary spending analysis
 * - Overpayment detection
 * - Budget reconciliation
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import {
  useFinancialAuditStats,
  useUnnecessarySpendAnalysis,
  useOverpaymentAnalysis,
  financialAuditor,
} from '../../services/financialAuditorService';
import { InvoiceVerificationPanel } from './InvoiceVerificationPanel';

const { width } = Dimensions.get('window');

const theme = {
  colors: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceAlt: '#F5F5F5',
    text: '#1A1A1A',
    textSecondary: '#666666',
    textMuted: '#999999',
    border: '#E5E5E5',
    accent: '#FF6B00',
    accentLight: '#FFF4ED',
    success: '#22C55E',
    successLight: '#F0FDF4',
    warning: '#F59E0B',
    warningLight: '#FFFBEB',
    error: '#EF4444',
    errorLight: '#FEF2F2',
    info: '#3B82F6',
    infoLight: '#EFF6FF',
  },
};

type TabType = 'overview' | 'invoices' | 'spending' | 'overpayments';

interface Props {
  projectId?: string;
  initialTab?: TabType;
}

export function FinancialAuditDashboard({ projectId = 'project-001', initialTab = 'overview' }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const stats = useFinancialAuditStats();
  const { analysis: spendingAnalysis, totalSavings, loading: spendingLoading } = useUnnecessarySpendAnalysis(projectId);
  const { analysis: overpaymentAnalysis, totalOverpaid, loading: overpaymentLoading } = useOverpaymentAnalysis(projectId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'grid-outline' },
    { key: 'invoices', label: 'Invoices', icon: 'document-text-outline' },
    { key: 'spending', label: 'Spending', icon: 'trending-down-outline' },
    { key: 'overpayments', label: 'Overpaid', icon: 'alert-circle-outline' },
  ];

  const renderOverview = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <Pressable
          style={[styles.summaryCard, styles.summaryCardWarning]}
          onPress={() => setActiveTab('invoices')}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="document-text" size={24} color={theme.colors.warning} />
          </View>
          <Text style={styles.summaryValue}>{stats?.invoicesWithDiscrepancies || 0}</Text>
          <Text style={styles.summaryLabel}>Invoice Discrepancies</Text>
          <Text style={styles.summarySubtext}>
            {formatCurrency(stats?.totalDiscrepancyValue || 0)}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.summaryCard, styles.summaryCardInfo]}
          onPress={() => setActiveTab('spending')}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="trending-down" size={24} color={theme.colors.info} />
          </View>
          <Text style={styles.summaryValue}>{formatCurrency(totalSavings)}</Text>
          <Text style={styles.summaryLabel}>Potential Savings</Text>
          <Text style={styles.summarySubtext}>
            {spendingAnalysis?.findings.length || 0} findings
          </Text>
        </Pressable>

        <Pressable
          style={[styles.summaryCard, styles.summaryCardError]}
          onPress={() => setActiveTab('overpayments')}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="alert-circle" size={24} color={theme.colors.error} />
          </View>
          <Text style={styles.summaryValue}>{formatCurrency(totalOverpaid)}</Text>
          <Text style={styles.summaryLabel}>Overpaid</Text>
          <Text style={styles.summarySubtext}>
            {overpaymentAnalysis?.findings.length || 0} issues found
          </Text>
        </Pressable>
      </View>

      {/* Critical Findings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Critical Findings</Text>
          <View style={styles.criticalBadge}>
            <Text style={styles.criticalBadgeText}>
              {(stats?.criticalFindings || 0) + (stats?.highFindings || 0)} urgent
            </Text>
          </View>
        </View>

        {/* Invoice Discrepancies Alert */}
        {(stats?.invoicesWithDiscrepancies || 0) > 0 && (
          <Pressable
            style={styles.alertCard}
            onPress={() => setActiveTab('invoices')}
          >
            <View style={[styles.alertIcon, styles.alertIconWarning]}>
              <Ionicons name="receipt-outline" size={20} color={theme.colors.warning} />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Invoice Verification Required</Text>
              <Text style={styles.alertDescription}>
                {stats?.invoicesWithDiscrepancies} invoices have discrepancies totaling {formatCurrency(stats?.totalDiscrepancyValue || 0)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </Pressable>
        )}

        {/* Overpayment Alert */}
        {totalOverpaid > 0 && (
          <Pressable
            style={styles.alertCard}
            onPress={() => setActiveTab('overpayments')}
          >
            <View style={[styles.alertIcon, styles.alertIconError]}>
              <Ionicons name="trending-up" size={20} color={theme.colors.error} />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Overpayment Detected</Text>
              <Text style={styles.alertDescription}>
                Paying above market/contract rates: {formatCurrency(totalOverpaid)} recoverable
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </Pressable>
        )}

        {/* Unnecessary Spending Alert */}
        {totalSavings > 0 && (
          <Pressable
            style={styles.alertCard}
            onPress={() => setActiveTab('spending')}
          >
            <View style={[styles.alertIcon, styles.alertIconInfo]}>
              <Ionicons name="cut-outline" size={20} color={theme.colors.info} />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Savings Opportunity</Text>
              <Text style={styles.alertDescription}>
                {formatCurrency(totalSavings)} in potential savings identified
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Top Savings Opportunities */}
      {spendingAnalysis && spendingAnalysis.prioritizedActions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Savings Actions</Text>
          {spendingAnalysis.prioritizedActions.slice(0, 3).map((action, index) => (
            <View key={action.id} style={styles.actionCard}>
              <View style={styles.actionRank}>
                <Text style={styles.actionRankText}>{index + 1}</Text>
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>
              <View style={styles.actionSavings}>
                <Text style={styles.actionSavingsAmount}>{formatCurrency(action.savingsAmount)}</Text>
                <Pressable style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Act</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Overpayment Alerts */}
      {overpaymentAnalysis && overpaymentAnalysis.findings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overpayment Alerts</Text>
          {overpaymentAnalysis.findings.slice(0, 3).map((finding) => (
            <View key={finding.id} style={styles.overpaymentCard}>
              <View style={styles.overpaymentHeader}>
                <Text style={styles.overpaymentVendor}>{finding.vendor}</Text>
                <Text style={styles.overpaymentAmount}>+{finding.overpaymentPercent.toFixed(0)}% over</Text>
              </View>
              <Text style={styles.overpaymentDescription}>{finding.description}</Text>
              <View style={styles.overpaymentFooter}>
                <Text style={styles.overpaymentTotal}>
                  {formatCurrency(finding.overpaymentAmount)} overpaid
                </Text>
                {finding.isRecoverable && (
                  <View style={styles.recoverableBadge}>
                    <Text style={styles.recoverableBadgeText}>Recoverable</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderSpending = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Potential Savings Identified</Text>
        <Text style={styles.heroValue}>{formatCurrency(totalSavings)}</Text>
        <Text style={styles.heroSubtext}>
          {spendingAnalysis?.findings.length || 0} areas of unnecessary spending found
        </Text>
      </View>

      {spendingAnalysis?.findings.map((finding) => (
        <View key={finding.id} style={styles.findingCard}>
          <View style={styles.findingHeader}>
            <View style={[
              styles.severityIndicator,
              finding.severity === 'critical' && styles.severityCritical,
              finding.severity === 'high' && styles.severityHigh,
              finding.severity === 'medium' && styles.severityMedium,
            ]} />
            <Text style={styles.findingType}>
              {finding.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
          </View>
          <Text style={styles.findingTitle}>{finding.title}</Text>
          <Text style={styles.findingDescription}>{finding.description}</Text>
          <View style={styles.findingNumbers}>
            <View style={styles.findingNumber}>
              <Text style={styles.findingNumberLabel}>Current</Text>
              <Text style={styles.findingNumberValue}>{formatCurrency(finding.currentSpend)}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.textMuted} />
            <View style={styles.findingNumber}>
              <Text style={styles.findingNumberLabel}>Necessary</Text>
              <Text style={styles.findingNumberValue}>{formatCurrency(finding.necessarySpend)}</Text>
            </View>
            <View style={[styles.findingNumber, styles.findingNumberHighlight]}>
              <Text style={styles.findingNumberLabel}>Save</Text>
              <Text style={[styles.findingNumberValue, styles.findingNumberValueSuccess]}>
                {formatCurrency(finding.savingsPotential)}
              </Text>
            </View>
          </View>
          <View style={styles.findingAction}>
            <Ionicons name="bulb" size={16} color={theme.colors.accent} />
            <Text style={styles.findingActionText}>{finding.actionRequired}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderOverpayments = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.heroCard, styles.heroCardError]}>
        <Text style={styles.heroLabel}>Total Overpayments Detected</Text>
        <Text style={[styles.heroValue, styles.heroValueError]}>{formatCurrency(totalOverpaid)}</Text>
        <Text style={styles.heroSubtext}>
          {overpaymentAnalysis?.summary.recoverableAmount
            ? `${formatCurrency(overpaymentAnalysis.summary.recoverableAmount)} potentially recoverable`
            : 'Analyzing recovery options...'}
        </Text>
      </View>

      {/* Rate Creep Trends */}
      {overpaymentAnalysis?.rateCreepTrends && overpaymentAnalysis.rateCreepTrends.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate Creep Detected</Text>
          {overpaymentAnalysis.rateCreepTrends.map((trend, index) => (
            <View key={index} style={styles.trendCard}>
              <View style={styles.trendHeader}>
                <Text style={styles.trendVendor}>{trend.vendor}</Text>
                <Text style={[styles.trendChange, styles.trendChangeNegative]}>
                  +{trend.rateChangePercent.toFixed(1)}%
                </Text>
              </View>
              <Text style={styles.trendItem}>{trend.item}</Text>
              <Text style={styles.trendPeriod}>Over {trend.period}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Findings */}
      {overpaymentAnalysis?.findings.map((finding) => (
        <View key={finding.id} style={styles.findingCard}>
          <View style={styles.findingHeader}>
            <View style={[
              styles.severityIndicator,
              finding.severity === 'critical' && styles.severityCritical,
              finding.severity === 'high' && styles.severityHigh,
              finding.severity === 'medium' && styles.severityMedium,
            ]} />
            <Text style={styles.findingType}>
              {finding.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
          </View>
          <Text style={styles.findingTitle}>{finding.title}</Text>
          <Text style={styles.findingDescription}>{finding.description}</Text>

          <View style={styles.rateComparison}>
            <View style={styles.rateBox}>
              <Text style={styles.rateLabel}>Paid Rate</Text>
              <Text style={[styles.rateValue, styles.rateValueNegative]}>
                {formatCurrency(finding.paidRate)}
              </Text>
            </View>
            <View style={styles.rateBox}>
              <Text style={styles.rateLabel}>{finding.benchmarkSource.replace(/-/g, ' ')}</Text>
              <Text style={styles.rateValue}>{formatCurrency(finding.benchmarkRate)}</Text>
            </View>
            <View style={[styles.rateBox, styles.rateBoxHighlight]}>
              <Text style={styles.rateLabel}>Overpaid</Text>
              <Text style={[styles.rateValue, styles.rateValueNegative]}>
                {formatCurrency(finding.overpaymentAmount)}
              </Text>
            </View>
          </View>

          {finding.isRecoverable && finding.recoveryAction && (
            <View style={styles.recoveryBox}>
              <Ionicons name="refresh" size={16} color={theme.colors.success} />
              <Text style={styles.recoveryText}>{finding.recoveryAction}</Text>
            </View>
          )}
        </View>
      ))}

      {/* Recovery Actions */}
      {overpaymentAnalysis?.recoveryActions && overpaymentAnalysis.recoveryActions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recovery Actions</Text>
          {overpaymentAnalysis.recoveryActions.map((action) => (
            <View key={action.id} style={styles.recoveryActionCard}>
              <View style={styles.recoveryActionHeader}>
                <Text style={styles.recoveryActionVendor}>{action.vendorName}</Text>
                <Text style={styles.recoveryActionAmount}>{formatCurrency(action.amount)}</Text>
              </View>
              <Text style={styles.recoveryActionApproach}>
                {action.suggestedApproach.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
              <Pressable style={styles.initiateButton}>
                <Text style={styles.initiateButtonText}>Initiate Recovery</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Auditor</Text>
        <Text style={styles.headerSubtitle}>AI-powered financial verification</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? theme.colors.accent : theme.colors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'invoices' && <InvoiceVerificationPanel projectId={projectId} />}
      {activeTab === 'spending' && renderSpending()}
      {activeTab === 'overpayments' && renderOverpayments()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: TYPE.displaySize - 4,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: TYPE.bodySize - 1,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.accent,
  },
  tabLabel: {
    fontSize: TYPE.captionSize,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: theme.colors.accent,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryCardWarning: {
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningLight,
  },
  summaryCardInfo: {
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.infoLight,
  },
  summaryCardError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
  },
  summaryIcon: {
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: theme.colors.text,
  },
  summaryLabel: {
    fontSize: TYPE.tinySize,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  summarySubtext: {
    fontSize: TYPE.tinySize - 1,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: TYPE.sectionSize,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  criticalBadge: {
    backgroundColor: theme.colors.errorLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  criticalBadgeText: {
    fontSize: TYPE.labelSize,
    color: theme.colors.error,
    fontWeight: '600',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertIconWarning: {
    backgroundColor: theme.colors.warningLight,
  },
  alertIconError: {
    backgroundColor: theme.colors.errorLight,
  },
  alertIconInfo: {
    backgroundColor: theme.colors.infoLight,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: theme.colors.text,
  },
  alertDescription: {
    fontSize: TYPE.labelSize,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionRank: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionRankText: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: theme.colors.text,
  },
  actionDescription: {
    fontSize: TYPE.labelSize,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  actionSavings: {
    alignItems: 'flex-end',
  },
  actionSavingsAmount: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    color: theme.colors.success,
  },
  actionButton: {
    backgroundColor: theme.colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  actionButtonText: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  overpaymentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderLeftWidth: 4,
  },
  overpaymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overpaymentVendor: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: theme.colors.text,
  },
  overpaymentAmount: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: theme.colors.error,
  },
  overpaymentDescription: {
    fontSize: TYPE.captionSize,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  overpaymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  overpaymentTotal: {
    fontSize: TYPE.labelSize,
    color: theme.colors.error,
    fontWeight: '600',
  },
  recoverableBadge: {
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  recoverableBadgeText: {
    fontSize: TYPE.tinySize - 1,
    color: theme.colors.success,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.lg,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.info,
  },
  heroCardError: {
    borderColor: theme.colors.error,
  },
  heroLabel: {
    fontSize: TYPE.bodySize - 1,
    color: theme.colors.textSecondary,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.info,
    marginVertical: 8,
  },
  heroValueError: {
    color: theme.colors.error,
  },
  heroSubtext: {
    fontSize: TYPE.captionSize,
    color: theme.colors.textSecondary,
  },
  findingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  findingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  severityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textMuted,
  },
  severityCritical: {
    backgroundColor: theme.colors.error,
  },
  severityHigh: {
    backgroundColor: theme.colors.warning,
  },
  severityMedium: {
    backgroundColor: theme.colors.info,
  },
  findingType: {
    fontSize: TYPE.labelSize,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  findingTitle: {
    fontSize: TYPE.titleSize,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  findingDescription: {
    fontSize: TYPE.bodySize - 1,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  findingNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  findingNumber: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: RADIUS.sm,
  },
  findingNumberHighlight: {
    backgroundColor: theme.colors.successLight,
  },
  findingNumberLabel: {
    fontSize: TYPE.tinySize - 1,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  findingNumberValue: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 2,
  },
  findingNumberValueSuccess: {
    color: theme.colors.success,
  },
  findingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: theme.colors.accentLight,
    borderRadius: RADIUS.sm,
  },
  findingActionText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: theme.colors.accent,
  },
  rateComparison: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  rateBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: RADIUS.sm,
  },
  rateBoxHighlight: {
    backgroundColor: theme.colors.errorLight,
  },
  rateLabel: {
    fontSize: TYPE.tinySize - 1,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  rateValue: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 2,
  },
  rateValueNegative: {
    color: theme.colors.error,
  },
  recoveryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: theme.colors.successLight,
    borderRadius: RADIUS.sm,
  },
  recoveryText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: theme.colors.success,
  },
  trendCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendVendor: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: theme.colors.text,
  },
  trendChange: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
  },
  trendChangeNegative: {
    color: theme.colors.error,
  },
  trendItem: {
    fontSize: TYPE.captionSize,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  trendPeriod: {
    fontSize: TYPE.labelSize,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  recoveryActionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  recoveryActionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recoveryActionVendor: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: theme.colors.text,
  },
  recoveryActionAmount: {
    fontSize: TYPE.titleSize,
    fontWeight: '700',
    color: theme.colors.success,
  },
  recoveryActionApproach: {
    fontSize: TYPE.captionSize,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  initiateButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    marginTop: 12,
  },
  initiateButtonText: {
    color: theme.colors.surface,
    fontWeight: '600',
    fontSize: TYPE.bodySize - 1,
  },
});

export default FinancialAuditDashboard;
