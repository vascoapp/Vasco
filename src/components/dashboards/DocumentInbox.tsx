import { useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { formatCurrency } from '../../modules/countryModules';
import type { CREDocumentType, CREExtractionResult } from '../../ingestion/buildosSchema';

type TabId = 'inbox' | 'processed' | 'actions';
type DocumentStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';

// Document type labels
const DOC_TYPE_LABELS: Record<CREDocumentType, string> = {
  'payment-application': 'Payment Application',
  'payment-certificate': 'Payment Certificate',
  'change-order': 'Change Order',
  'variation-order': 'Variation Order',
  'contract': 'Contract',
  'subcontract': 'Subcontract',
  'professional-appointment': 'Professional Appointment',
  'permit-application': 'Permit Application',
  'permit-decision': 'Permit Decision',
  'site-report': 'Site Report',
  'qs-valuation': 'QS Valuation',
  'invoice': 'Invoice',
  'insurance-certificate': 'Insurance Certificate',
  'bond': 'Bond',
  'unknown': 'Unknown',
};

// Document type icons
const DOC_TYPE_ICONS: Partial<Record<CREDocumentType, string>> = {
  'payment-certificate': '💰',
  'payment-application': '📝',
  'change-order': '🔄',
  'variation-order': '🔄',
  'invoice': '🧾',
  'site-report': '📋',
  'contract': '📄',
  'permit-application': '🏛️',
  'permit-decision': '✓',
  'insurance-certificate': '🛡️',
};

// Mock ingested documents
interface IngestedDocument {
  id: string;
  fileName: string;
  uploadedAt: string;
  status: DocumentStatus;
  extraction: CREExtractionResult;
  projectId: string;
  projectName: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

const MOCK_DOCUMENTS: IngestedDocument[] = [
  {
    id: 'doc-001',
    fileName: 'Payment_Certificate_05_Jan2024.pdf',
    uploadedAt: '2025-01-28T10:30:00Z',
    status: 'pending',
    projectId: 'uk-001',
    projectName: 'Whitechapel Mixed-Use',
    extraction: {
      document: {
        docType: 'payment-certificate',
        certNumber: 5,
        period: 'January 2024',
        periodEnd: '2024-01-31',
        contractor: 'BuildRight Construction Ltd',
        projectRef: 'PRJ-UK-001',
        lines: [
          {
            costCode: '100',
            description: 'Preliminaries',
            contractSum: 250000,
            previousCertified: 200000,
            thisPeriod: 25000,
            cumulativeCertified: 225000,
            percentComplete: 90,
          },
          {
            costCode: '200',
            description: 'Substructure',
            contractSum: 1500000,
            previousCertified: 1350000,
            thisPeriod: 100000,
            cumulativeCertified: 1450000,
            percentComplete: 97,
          },
        ],
        grossValuation: 3915000,
        lessPreviousCerts: 3470000,
        netPayable: 445000,
        retentionHeld: 19575,
        retentionPercent: 5,
        vatAmount: 85085,
        totalDue: 510510,
        currency: 'GBP',
        qsSigned: true,
        clientSigned: false,
      },
      meta: {
        extractedAt: '2025-01-28T10:31:15Z',
        processingTimeMs: 1250,
        confidence: 'high',
        confidenceScore: 0.92,
        warnings: [],
        sourceFile: 'Payment_Certificate_05_Jan2024.pdf',
      },
    },
  },
  {
    id: 'doc-002',
    fileName: 'CO-2024-012_Fire_Stopping.pdf',
    uploadedAt: '2025-01-27T14:15:00Z',
    status: 'pending',
    projectId: 'uk-001',
    projectName: 'Whitechapel Mixed-Use',
    extraction: {
      document: {
        docType: 'change-order',
        coNumber: 'CO-2024-012',
        projectRef: 'PRJ-UK-001',
        contractRef: 'CON-001',
        contractor: 'BuildRight Construction Ltd',
        description: 'Additional fire stopping requirements to level 3 risers',
        reason: 'Building control comment requiring enhanced fire stopping specification',
        requestedBy: 'Architect',
        dateSubmitted: '2024-01-15',
        proposedCost: 45000,
        proposedTimeImpact: 5,
        currency: 'GBP',
        status: 'pending',
        breakdown: [
          { category: 'Labour', amount: 18000 },
          { category: 'Materials', amount: 22000 },
          { category: 'Preliminaries', amount: 5000 },
        ],
      },
      meta: {
        extractedAt: '2025-01-27T14:16:30Z',
        processingTimeMs: 980,
        confidence: 'high',
        confidenceScore: 0.88,
        warnings: ['Cost breakdown may be incomplete'],
        sourceFile: 'CO-2024-012_Fire_Stopping.pdf',
      },
    },
  },
  {
    id: 'doc-003',
    fileName: 'Invoice_QualityMaterials_Jan2024.pdf',
    uploadedAt: '2025-01-27T09:45:00Z',
    status: 'reviewed',
    projectId: 'uk-001',
    projectName: 'Whitechapel Mixed-Use',
    reviewedBy: 'John Smith',
    reviewedAt: '2025-01-27T16:00:00Z',
    extraction: {
      document: {
        docType: 'invoice',
        invoiceNumber: 'INV-2024-0089',
        invoiceDate: '2024-01-20',
        dueDate: '2024-02-19',
        supplier: 'Quality Materials Ltd',
        project: 'Whitechapel Mixed-Use',
        costCode: '410',
        lines: [
          {
            description: 'Structural steel - Grade S355',
            quantity: 45,
            unitPrice: 1200,
            totalPrice: 54000,
          },
          {
            description: 'Steel fixings and connections',
            quantity: 1,
            unitPrice: 8500,
            totalPrice: 8500,
          },
        ],
        subtotal: 65000,
        vatRate: 20,
        vatAmount: 13000,
        total: 78000,
        currency: 'GBP',
        paymentDetails: {
          bankName: 'Barclays',
          iban: 'GB82 WEST 1234 5698 7654 32',
        },
      },
      meta: {
        extractedAt: '2025-01-27T09:46:00Z',
        processingTimeMs: 850,
        confidence: 'high',
        confidenceScore: 0.95,
        warnings: [],
        sourceFile: 'Invoice_QualityMaterials_Jan2024.pdf',
      },
    },
  },
  {
    id: 'doc-004',
    fileName: 'Daily_Site_Report_28Jan.pdf',
    uploadedAt: '2025-01-28T17:30:00Z',
    status: 'approved',
    projectId: 'uk-001',
    projectName: 'Whitechapel Mixed-Use',
    reviewedBy: 'Site Manager',
    reviewedAt: '2025-01-28T18:00:00Z',
    extraction: {
      document: {
        docType: 'site-report',
        reportDate: '2025-01-28',
        project: 'Whitechapel Mixed-Use Development',
        weather: 'Overcast, occasional light rain',
        temperature: 8,
        workforceCount: 85,
        hoursWorked: 680,
        workCompleted: [
          'Level 3 slab pour completed - 180m³',
          'M&E first fix ongoing floors 1-2',
          'Façade panels installed - north elevation 40%',
        ],
        delaysEncountered: [
          'Crane standby due to wind speed 11:00-13:00',
        ],
        safetyObservations: [
          'All personnel wearing correct PPE',
          'Edge protection satisfactory',
        ],
        deliveries: [
          { supplier: 'Ready Mix Ltd', description: 'Concrete C40 - 180m³' },
        ],
        visitorsOnSite: ['Client representative - site walk'],
        photos: 24,
        preparedBy: 'John Smith, Site Manager',
      },
      meta: {
        extractedAt: '2025-01-28T17:31:00Z',
        processingTimeMs: 750,
        confidence: 'high',
        confidenceScore: 0.91,
        warnings: [],
        sourceFile: 'Daily_Site_Report_28Jan.pdf',
      },
    },
  },
];

export function DocumentInbox() {
  const [activeTab, setActiveTab] = useState<TabId>('inbox');
  const [selectedDoc, setSelectedDoc] = useState<IngestedDocument | null>(null);
  const [documents, setDocuments] = useState(MOCK_DOCUMENTS);

  // Filter documents by status
  const pendingDocs = useMemo(
    () => documents.filter((d) => d.status === 'pending'),
    [documents]
  );
  const processedDocs = useMemo(
    () => documents.filter((d) => d.status !== 'pending'),
    [documents]
  );

  // Stats
  const stats = useMemo(() => ({
    pending: pendingDocs.length,
    reviewed: documents.filter((d) => d.status === 'reviewed').length,
    approved: documents.filter((d) => d.status === 'approved').length,
    rejected: documents.filter((d) => d.status === 'rejected').length,
    highConfidence: documents.filter((d) => d.extraction.meta.confidenceScore >= 0.85).length,
  }), [documents, pendingDocs]);

  const handleApprove = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? { ...d, status: 'approved' as DocumentStatus, reviewedAt: new Date().toISOString() }
          : d
      )
    );
    setSelectedDoc(null);
  };

  const handleReject = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? { ...d, status: 'rejected' as DocumentStatus, reviewedAt: new Date().toISOString() }
          : d
      )
    );
    setSelectedDoc(null);
  };

  const getStatusColor = (status: DocumentStatus) => {
    switch (status) {
      case 'pending':
        return SemanticColors.feedbackWarning;
      case 'reviewed':
        return SemanticColors.textTertiary;
      case 'approved':
        return SemanticColors.feedbackSuccess;
      case 'rejected':
        return SemanticColors.feedbackError;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.85) return SemanticColors.feedbackSuccess;
    if (score >= 0.7) return SemanticColors.feedbackWarning;
    return SemanticColors.feedbackError;
  };

  const renderDocumentPreview = (doc: IngestedDocument) => {
    const { document } = doc.extraction;

    switch (document.docType) {
      case 'payment-certificate':
        return (
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>Payment Certificate #{document.certNumber}</Text>
            <Text style={styles.previewValue}>
              Net Payable: {formatCurrency(document.netPayable || 0, document.currency || 'GBP')}
            </Text>
            <Text style={styles.previewMeta}>
              Period: {document.period} | Contractor: {document.contractor}
            </Text>
          </View>
        );
      case 'change-order':
        return (
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>{document.coNumber}</Text>
            <Text style={styles.previewValue}>
              Proposed Cost: {formatCurrency(document.proposedCost || 0, document.currency || 'GBP')}
            </Text>
            <Text style={styles.previewMeta}>
              Time Impact: {document.proposedTimeImpact} days | Status: {document.status}
            </Text>
          </View>
        );
      case 'invoice':
        return (
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>{document.invoiceNumber}</Text>
            <Text style={styles.previewValue}>
              Total: {formatCurrency(document.total || 0, document.currency || 'GBP')}
            </Text>
            <Text style={styles.previewMeta}>
              From: {document.supplier} | Due: {document.dueDate}
            </Text>
          </View>
        );
      case 'site-report':
        return (
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>Site Report - {document.reportDate}</Text>
            <Text style={styles.previewValue}>
              Workforce: {document.workforceCount} | Hours: {document.hoursWorked}
            </Text>
            <Text style={styles.previewMeta}>
              Weather: {document.weather} | Prepared by: {document.preparedBy}
            </Text>
          </View>
        );
      default:
        return (
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>{DOC_TYPE_LABELS[document.docType]}</Text>
          </View>
        );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={Typography.title}>Document Inbox</Text>

      {/* Stats Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: SemanticColors.feedbackWarning }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>{stats.approved}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: SemanticColors.textTertiary }]}>{stats.highConfidence}</Text>
            <Text style={styles.statLabel}>High Confidence</Text>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabRow}>
        {(['inbox', 'processed', 'actions'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'inbox' ? `Inbox (${stats.pending})` : tab === 'processed' ? 'Processed' : 'Bulk Actions'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Inbox Tab */}
      {activeTab === 'inbox' && (
        <View style={styles.content}>
          {pendingDocs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No pending documents</Text>
            </View>
          ) : (
            pendingDocs.map((doc) => (
              <Pressable
                key={doc.id}
                style={styles.documentCard}
                onPress={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
              >
                <View style={styles.docHeader}>
                  <View style={styles.docIcon}>
                    <Text style={styles.docIconText}>
                      {DOC_TYPE_ICONS[doc.extraction.document.docType] || '📄'}
                    </Text>
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docFileName}>{doc.fileName}</Text>
                    <Text style={styles.docMeta}>
                      {DOC_TYPE_LABELS[doc.extraction.document.docType]} | {doc.projectName}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.confidenceBadge,
                      { backgroundColor: getConfidenceColor(doc.extraction.meta.confidenceScore) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.confidenceText,
                        { color: getConfidenceColor(doc.extraction.meta.confidenceScore) },
                      ]}
                    >
                      {Math.round(doc.extraction.meta.confidenceScore * 100)}%
                    </Text>
                  </View>
                </View>

                {renderDocumentPreview(doc)}

                {doc.extraction.meta.warnings.length > 0 && (
                  <View style={styles.warningsSection}>
                    {doc.extraction.meta.warnings.map((warning, i) => (
                      <Text key={i} style={styles.warningText}>⚠️ {warning}</Text>
                    ))}
                  </View>
                )}

                {selectedDoc?.id === doc.id && (
                  <View style={styles.actionButtons}>
                    <Pressable
                      style={styles.approveButton}
                      onPress={() => handleApprove(doc.id)}
                    >
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </Pressable>
                    <Pressable
                      style={styles.reviewButton}
                      onPress={() => {}}
                    >
                      <Text style={styles.reviewButtonText}>Review Details</Text>
                    </Pressable>
                    <Pressable
                      style={styles.rejectButton}
                      onPress={() => handleReject(doc.id)}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </Pressable>
                  </View>
                )}

                <Text style={styles.uploadTime}>
                  Uploaded: {new Date(doc.uploadedAt).toLocaleString()}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* Processed Tab */}
      {activeTab === 'processed' && (
        <View style={styles.content}>
          {processedDocs.map((doc) => (
            <View key={doc.id} style={styles.documentCard}>
              <View style={styles.docHeader}>
                <View style={styles.docIcon}>
                  <Text style={styles.docIconText}>
                    {DOC_TYPE_ICONS[doc.extraction.document.docType] || '📄'}
                  </Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docFileName}>{doc.fileName}</Text>
                  <Text style={styles.docMeta}>
                    {DOC_TYPE_LABELS[doc.extraction.document.docType]}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(doc.status) + '20' },
                  ]}
                >
                  <Text style={[styles.statusText, { color: getStatusColor(doc.status) }]}>
                    {doc.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {renderDocumentPreview(doc)}

              {doc.reviewedBy && (
                <Text style={styles.reviewInfo}>
                  Reviewed by {doc.reviewedBy} on {new Date(doc.reviewedAt!).toLocaleDateString()}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Bulk Actions Tab */}
      {activeTab === 'actions' && (
        <View style={styles.content}>
          <View style={styles.bulkActionCard}>
            <Text style={Typography.subtitle}>Bulk Processing</Text>
            <Text style={styles.bulkActionDesc}>
              Process multiple documents at once based on confidence thresholds.
            </Text>

            <View style={styles.bulkActionOption}>
              <View style={styles.bulkActionInfo}>
                <Text style={styles.bulkActionTitle}>Auto-approve High Confidence</Text>
                <Text style={styles.bulkActionMeta}>
                  Approve documents with confidence {'>'}= 90%
                </Text>
              </View>
              <Pressable style={styles.bulkButton}>
                <Text style={styles.bulkButtonText}>Apply</Text>
              </Pressable>
            </View>

            <View style={styles.bulkActionOption}>
              <View style={styles.bulkActionInfo}>
                <Text style={styles.bulkActionTitle}>Flag Low Confidence</Text>
                <Text style={styles.bulkActionMeta}>
                  Mark documents with confidence {'<'} 70% for manual review
                </Text>
              </View>
              <Pressable style={styles.bulkButton}>
                <Text style={styles.bulkButtonText}>Apply</Text>
              </Pressable>
            </View>

            <View style={styles.bulkActionOption}>
              <View style={styles.bulkActionInfo}>
                <Text style={styles.bulkActionTitle}>Export to Accounting</Text>
                <Text style={styles.bulkActionMeta}>
                  Export approved invoices to accounting system
                </Text>
              </View>
              <Pressable style={styles.bulkButton}>
                <Text style={styles.bulkButtonText}>Export</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.ingestionStats}>
            <Text style={Typography.subtitle}>Ingestion Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statsCell}>
                <Text style={styles.statsCellValue}>{documents.length}</Text>
                <Text style={styles.statsCellLabel}>Total Processed</Text>
              </View>
              <View style={styles.statsCell}>
                <Text style={styles.statsCellValue}>
                  {Math.round(
                    documents.reduce((sum, d) => sum + d.extraction.meta.processingTimeMs, 0) /
                      documents.length
                  )}ms
                </Text>
                <Text style={styles.statsCellLabel}>Avg Processing</Text>
              </View>
              <View style={styles.statsCell}>
                <Text style={styles.statsCellValue}>
                  {Math.round(
                    (documents.reduce((sum, d) => sum + d.extraction.meta.confidenceScore, 0) /
                      documents.length) *
                      100
                  )}%
                </Text>
                <Text style={styles.statsCellLabel}>Avg Confidence</Text>
              </View>
            </View>
          </View>
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
  statsBanner: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.displaySize - 4,
    fontWeight: '700',
  },
  statLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: SemanticColors.borderDefault,
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
  content: {
    gap: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
  },
  documentCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconText: {
    fontSize: TYPE.sectionSize,
  },
  docInfo: {
    flex: 1,
  },
  docFileName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '600',
  },
  docMeta: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  confidenceBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: TYPE.tinySize,
    fontWeight: '700',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    fontSize: TYPE.tinySize - 2,
    fontWeight: '700',
  },
  previewSection: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.md,
    gap: 4,
  },
  previewLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  previewValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontWeight: '700',
  },
  previewMeta: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  warningsSection: {
    gap: 4,
  },
  warningText: {
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.tinySize,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  approveButton: {
    flex: 1,
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#0B0C0F',
    fontSize: TYPE.labelSize,
    fontWeight: '700',
  },
  reviewButton: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  reviewButtonText: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: SemanticColors.feedbackError + '20',
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError,
  },
  rejectButtonText: {
    color: SemanticColors.feedbackError,
    fontSize: TYPE.labelSize,
    fontWeight: '600',
  },
  uploadTime: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    textAlign: 'right',
  },
  reviewInfo: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontStyle: 'italic',
  },
  bulkActionCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  bulkActionDesc: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  bulkActionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  bulkActionInfo: {
    flex: 1,
    gap: 2,
  },
  bulkActionTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontWeight: '600',
  },
  bulkActionMeta: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  bulkButton: {
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bulkButtonText: {
    color: '#0B0C0F',
    fontSize: TYPE.labelSize,
    fontWeight: '700',
  },
  ingestionStats: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statsCell: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statsCellValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
  },
  statsCellLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    marginTop: 4,
    textAlign: 'center',
  },
});
