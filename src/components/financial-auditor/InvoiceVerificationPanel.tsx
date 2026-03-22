/**
 * Invoice Verification Panel
 *
 * Displays invoice verification results with:
 * - Invoice list with verification status badges
 * - Side-by-side comparison: Invoice vs Budget/Contract/PO
 * - Line-by-line variance highlighting
 * - One-tap actions: Approve, Request Credit, Flag for Review, Reject
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  InvoiceVerification,
  InvoiceDiscrepancy,
  VerificationStatus,
} from '../../types/financial-auditor';
import {
  useInvoiceVerification,
  financialAuditor,
} from '../../services/financialAuditorService';

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

interface Props {
  projectId: string;
  onInvoiceSelect?: (invoiceId: string) => void;
}

// Mock pending invoices
const MOCK_PENDING_INVOICES = [
  { id: 'INV-2024-0892', vendor: 'BuildCo Ltd', amount: 23450, date: '2024-02-01' },
  { id: 'INV-2024-0891', vendor: 'MechServ', amount: 8200, date: '2024-01-28' },
  { id: 'INV-2024-0890', vendor: 'ElecPro', amount: 15600, date: '2024-01-25' },
];

export function InvoiceVerificationPanel({ projectId, onInvoiceSelect }: Props) {
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Map<string, InvoiceVerification>>(new Map());
  const [verifying, setVerifying] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const handleVerify = async (invoiceId: string) => {
    setVerifying(invoiceId);
    try {
      const result = await financialAuditor.verifyInvoice({
        invoiceId,
        projectId,
        compareAgainst: ['budget', 'contract', 'po'],
      });
      setVerificationResults(prev => new Map(prev).set(invoiceId, result));
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setVerifying(null);
    }
  };

  const handleVerifyAll = async () => {
    for (const invoice of MOCK_PENDING_INVOICES) {
      await handleVerify(invoice.id);
    }
  };

  const getStatusBadge = (invoiceId: string) => {
    const result = verificationResults.get(invoiceId);
    if (!result) return null;

    const status = result.verificationResult.status;
    const discrepancyCount = result.verificationResult.discrepancies.length;

    if (status === 'matched') {
      return (
        <View style={[styles.badge, styles.badgeSuccess]}>
          <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
          <Text style={styles.badgeTextSuccess}>Matched</Text>
        </View>
      );
    } else if (status === 'discrepancy') {
      return (
        <View style={[styles.badge, styles.badgeWarning]}>
          <Ionicons name="warning" size={14} color={theme.colors.warning} />
          <Text style={styles.badgeTextWarning}>{discrepancyCount} discrepancies</Text>
        </View>
      );
    } else if (status === 'missing-reference') {
      return (
        <View style={[styles.badge, styles.badgeInfo]}>
          <Ionicons name="help-circle" size={14} color={theme.colors.info} />
          <Text style={styles.badgeTextInfo}>No reference</Text>
        </View>
      );
    }
    return null;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  };

  const renderInvoiceCard = (invoice: typeof MOCK_PENDING_INVOICES[0]) => {
    const verification = verificationResults.get(invoice.id);
    const isVerifying = verifying === invoice.id;
    const hasDiscrepancies = (verification?.verificationResult.discrepancies.length ?? 0) > 0;

    return (
      <Pressable
        key={invoice.id}
        style={[
          styles.invoiceCard,
          hasDiscrepancies && styles.invoiceCardWarning,
        ]}
        onPress={() => {
          setSelectedInvoice(invoice.id);
          if (verification) {
            setDetailModalVisible(true);
          } else {
            handleVerify(invoice.id);
          }
        }}
      >
        <View style={styles.invoiceHeader}>
          <View>
            <Text style={styles.invoiceNumber}>{invoice.id}</Text>
            <Text style={styles.invoiceVendor}>{invoice.vendor}</Text>
          </View>
          <View style={styles.invoiceRight}>
            <Text style={styles.invoiceAmount}>{formatCurrency(invoice.amount)}</Text>
            {getStatusBadge(invoice.id)}
          </View>
        </View>

        {verification && (
          <View style={styles.verificationSummary}>
            <View style={styles.varianceRow}>
              <Text style={styles.varianceLabel}>Expected:</Text>
              <Text style={styles.varianceValue}>
                {formatCurrency(verification.verificationResult.expectedAmount)}
              </Text>
            </View>
            <View style={styles.varianceRow}>
              <Text style={styles.varianceLabel}>Variance:</Text>
              <Text style={[
                styles.varianceValue,
                verification.verificationResult.variance > 0 ? styles.varianceNegative : styles.variancePositive,
              ]}>
                {verification.verificationResult.variance > 0 ? '+' : ''}
                {formatCurrency(verification.verificationResult.variance)}
                {' '}({verification.verificationResult.variancePercent.toFixed(1)}%)
              </Text>
            </View>
          </View>
        )}

        {isVerifying && (
          <View style={styles.verifyingOverlay}>
            <Text style={styles.verifyingText}>Verifying...</Text>
          </View>
        )}

        {!verification && !isVerifying && (
          <Pressable
            style={styles.verifyButton}
            onPress={() => handleVerify(invoice.id)}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.accent} />
            <Text style={styles.verifyButtonText}>Verify Invoice</Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  const renderDiscrepancyItem = (discrepancy: InvoiceDiscrepancy) => {
    const severityColors = {
      critical: theme.colors.error,
      high: theme.colors.warning,
      medium: theme.colors.info,
      low: theme.colors.textMuted,
    };

    return (
      <View key={discrepancy.id} style={styles.discrepancyItem}>
        <View style={styles.discrepancyHeader}>
          <View style={[styles.severityDot, { backgroundColor: severityColors[discrepancy.severity] }]} />
          <Text style={styles.discrepancyType}>
            {discrepancy.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Text>
        </View>
        <Text style={styles.discrepancyDescription}>{discrepancy.description}</Text>
        <View style={styles.discrepancyValues}>
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>Invoiced</Text>
            <Text style={styles.valueAmount}>
              {typeof discrepancy.invoicedValue === 'number' && discrepancy.invoicedValue > 100
                ? formatCurrency(discrepancy.invoicedValue)
                : discrepancy.invoicedValue}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={theme.colors.textMuted} />
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>Expected</Text>
            <Text style={styles.valueAmount}>
              {typeof discrepancy.expectedValue === 'number' && discrepancy.expectedValue > 100
                ? formatCurrency(discrepancy.expectedValue)
                : discrepancy.expectedValue}
            </Text>
          </View>
          <View style={[styles.valueBox, styles.varianceBox]}>
            <Text style={styles.valueLabel}>Variance</Text>
            <Text style={[styles.valueAmount, discrepancy.variance > 0 ? styles.varianceNegative : styles.variancePositive]}>
              {discrepancy.variance > 0 ? '+' : ''}{discrepancy.variancePercent.toFixed(1)}%
            </Text>
          </View>
        </View>
        <View style={styles.recommendationBox}>
          <Ionicons name="bulb-outline" size={14} color={theme.colors.accent} />
          <Text style={styles.recommendationText}>{discrepancy.recommendation}</Text>
        </View>
      </View>
    );
  };

  const selectedVerification = selectedInvoice ? verificationResults.get(selectedInvoice) : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Invoice Verification</Text>
          <Text style={styles.subtitle}>
            {MOCK_PENDING_INVOICES.length} invoices pending review
          </Text>
        </View>
        <Pressable style={styles.verifyAllButton} onPress={handleVerifyAll}>
          <Ionicons name="checkmark-done" size={18} color={theme.colors.surface} />
          <Text style={styles.verifyAllButtonText}>Verify All</Text>
        </Pressable>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{verificationResults.size}</Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
        <View style={[styles.statCard, styles.statCardWarning]}>
          <Text style={[styles.statValue, styles.statValueWarning]}>
            {Array.from(verificationResults.values()).filter(v => v.verificationResult.discrepancies.length > 0).length}
          </Text>
          <Text style={styles.statLabel}>With Issues</Text>
        </View>
        <View style={[styles.statCard, styles.statCardSuccess]}>
          <Text style={[styles.statValue, styles.statValueSuccess]}>
            {Array.from(verificationResults.values()).filter(v => v.verificationResult.autoApprovalEligible).length}
          </Text>
          <Text style={styles.statLabel}>Auto-Approve OK</Text>
        </View>
      </View>

      {/* Invoice List */}
      <ScrollView style={styles.invoiceList} showsVerticalScrollIndicator={false}>
        {MOCK_PENDING_INVOICES.map(renderInvoiceCard)}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invoice Details</Text>
            <Pressable onPress={() => setDetailModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          {selectedVerification && (
            <ScrollView style={styles.modalContent}>
              {/* Invoice Summary */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Invoice Summary</Text>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Invoice</Text>
                    <Text style={styles.summaryValue}>{selectedVerification.invoiceNumber}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Vendor</Text>
                    <Text style={styles.summaryValue}>{selectedVerification.vendor}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Amount</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(selectedVerification.invoiceAmount)}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Expected</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(selectedVerification.verificationResult.expectedAmount)}</Text>
                  </View>
                </View>
              </View>

              {/* Discrepancies */}
              {selectedVerification.verificationResult.discrepancies.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    Discrepancies ({selectedVerification.verificationResult.discrepancies.length})
                  </Text>
                  {selectedVerification.verificationResult.discrepancies.map(renderDiscrepancyItem)}
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionButtons}>
                <Pressable style={[styles.actionButton, styles.actionButtonReject]}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.error} />
                  <Text style={styles.actionButtonTextReject}>Reject</Text>
                </Pressable>
                <Pressable style={[styles.actionButton, styles.actionButtonCredit]}>
                  <Ionicons name="return-down-back" size={18} color={theme.colors.warning} />
                  <Text style={styles.actionButtonTextCredit}>Request Credit</Text>
                </Pressable>
                <Pressable style={[styles.actionButton, styles.actionButtonApprove]}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                  <Text style={styles.actionButtonTextApprove}>Approve</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  verifyAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  verifyAllButtonText: {
    color: theme.colors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statCardWarning: {
    backgroundColor: theme.colors.warningLight,
    borderColor: theme.colors.warning,
  },
  statCardSuccess: {
    backgroundColor: theme.colors.successLight,
    borderColor: theme.colors.success,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statValueWarning: {
    color: theme.colors.warning,
  },
  statValueSuccess: {
    color: theme.colors.success,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  invoiceList: {
    flex: 1,
    padding: 16,
  },
  invoiceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  invoiceCardWarning: {
    borderColor: theme.colors.warning,
    borderWidth: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  invoiceVendor: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    gap: 4,
  },
  badgeSuccess: {
    backgroundColor: theme.colors.successLight,
  },
  badgeWarning: {
    backgroundColor: theme.colors.warningLight,
  },
  badgeInfo: {
    backgroundColor: theme.colors.infoLight,
  },
  badgeTextSuccess: {
    fontSize: 12,
    color: theme.colors.success,
    fontWeight: '500',
  },
  badgeTextWarning: {
    fontSize: 12,
    color: theme.colors.warning,
    fontWeight: '500',
  },
  badgeTextInfo: {
    fontSize: 12,
    color: theme.colors.info,
    fontWeight: '500',
  },
  verificationSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  varianceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  varianceLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  varianceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  varianceNegative: {
    color: theme.colors.error,
  },
  variancePositive: {
    color: theme.colors.success,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.accentLight,
    gap: 6,
  },
  verifyButtonText: {
    color: theme.colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  verifyingOverlay: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  verifyingText: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  modalContent: {
    flex: 1,
  },
  modalSection: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    marginBottom: 8,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryItem: {
    width: '48%',
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 2,
  },
  discrepancyItem: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  discrepancyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  discrepancyType: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  discrepancyDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  discrepancyValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  valueBox: {
    flex: 1,
    alignItems: 'center',
  },
  varianceBox: {
    backgroundColor: theme.colors.warningLight,
    padding: 8,
    borderRadius: 6,
  },
  valueLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  valueAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 2,
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.accentLight,
    padding: 10,
    borderRadius: 6,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.accent,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonReject: {
    backgroundColor: theme.colors.errorLight,
  },
  actionButtonCredit: {
    backgroundColor: theme.colors.warningLight,
  },
  actionButtonApprove: {
    backgroundColor: theme.colors.successLight,
  },
  actionButtonTextReject: {
    color: theme.colors.error,
    fontWeight: '600',
    fontSize: 14,
  },
  actionButtonTextCredit: {
    color: theme.colors.warning,
    fontWeight: '600',
    fontSize: 14,
  },
  actionButtonTextApprove: {
    color: theme.colors.success,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default InvoiceVerificationPanel;
