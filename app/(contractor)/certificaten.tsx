// =============================================================================
// CERTIFICATEN - Certificates & Documents Management
// =============================================================================
// Manage contractor certificates, licenses, and important documents
// =============================================================================

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// TYPES & DATA
// ============================================

interface Certificate {
  id: string;
  name: string;
  type: 'license' | 'certificate' | 'insurance' | 'contract';
  issuer: string;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired';
  documentUrl?: string;
}

interface Document {
  id: string;
  name: string;
  type: 'contract' | 'invoice' | 'permit' | 'other';
  projectName?: string;
  uploadDate: string;
  fileSize: string;
}

const MOCK_CERTIFICATES: Certificate[] = [
  {
    id: 'cert_1',
    name: 'VCA Basis',
    type: 'certificate',
    issuer: 'SSVV',
    issueDate: '2023-03-15',
    expiryDate: '2033-03-15',
    status: 'valid',
  },
  {
    id: 'cert_2',
    name: 'Aansprakelijkheidsverzekering',
    type: 'insurance',
    issuer: 'Interpolis',
    issueDate: '2024-01-01',
    expiryDate: '2025-01-01',
    status: 'valid',
  },
  {
    id: 'cert_3',
    name: 'KvK Uittreksel',
    type: 'license',
    issuer: 'Kamer van Koophandel',
    issueDate: '2024-06-01',
    expiryDate: '2025-06-01',
    status: 'expiring',
  },
  {
    id: 'cert_4',
    name: 'Asbest Certificaat',
    type: 'certificate',
    issuer: 'Ascert',
    issueDate: '2022-01-10',
    expiryDate: '2024-01-10',
    status: 'expired',
  },
];

const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'doc_1',
    name: 'Raamovereenkomst Bouwbedrijf De Vries',
    type: 'contract',
    projectName: 'Amsterdam Noord',
    uploadDate: '2024-08-15',
    fileSize: '2.4 MB',
  },
  {
    id: 'doc_2',
    name: 'Werkvergunning Gemeente Utrecht',
    type: 'permit',
    projectName: 'Utrecht Centrum',
    uploadDate: '2024-09-01',
    fileSize: '1.1 MB',
  },
  {
    id: 'doc_3',
    name: 'Algemene Voorwaarden v2.0',
    type: 'other',
    uploadDate: '2024-07-20',
    fileSize: '450 KB',
  },
];

// ============================================
// COMPONENTS
// ============================================

function CertificateCard({ certificate }: { certificate: Certificate }) {
  const getStatusConfig = (status: Certificate['status']) => {
    switch (status) {
      case 'valid':
        return {
          label: 'Geldig',
          color: SemanticColors.feedbackSuccess,
          bg: SemanticColors.feedbackSuccessBg,
          icon: 'checkmark-circle' as IconName,
        };
      case 'expiring':
        return {
          label: 'Verloopt binnenkort',
          color: SemanticColors.feedbackWarning,
          bg: SemanticColors.feedbackWarningBg,
          icon: 'alert-circle' as IconName,
        };
      case 'expired':
        return {
          label: 'Verlopen',
          color: SemanticColors.feedbackError,
          bg: SemanticColors.feedbackErrorBg,
          icon: 'close-circle' as IconName,
        };
    }
  };

  const getTypeIcon = (type: Certificate['type']): IconName => {
    switch (type) {
      case 'license': return 'ribbon';
      case 'certificate': return 'school';
      case 'insurance': return 'shield-checkmark';
      case 'contract': return 'document-text';
    }
  };

  const status = getStatusConfig(certificate.status);
  const expiryDate = new Date(certificate.expiryDate);
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <Pressable style={styles.certificateCard}>
      <View style={styles.certificateHeader}>
        <View style={[styles.certificateIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
          <Ionicons name={getTypeIcon(certificate.type)} size={22} color={Palette.hermesOrange} />
        </View>
        <View style={styles.certificateInfo}>
          <Text style={styles.certificateName}>{certificate.name}</Text>
          <Text style={styles.certificateIssuer}>{certificate.issuer}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.certificateDates}>
        <View style={styles.dateItem}>
          <Ionicons name="calendar-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.dateLabel}>Uitgegeven:</Text>
          <Text style={styles.dateValue}>
            {new Date(certificate.issueDate).toLocaleDateString('nl-NL')}
          </Text>
        </View>
        <View style={styles.dateItem}>
          <Ionicons name="time-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.dateLabel}>Verloopt:</Text>
          <Text style={[
            styles.dateValue,
            certificate.status === 'expired' && { color: SemanticColors.feedbackError },
            certificate.status === 'expiring' && { color: SemanticColors.feedbackWarning },
          ]}>
            {expiryDate.toLocaleDateString('nl-NL')}
            {certificate.status === 'expiring' && ` (${daysUntilExpiry} dagen)`}
          </Text>
        </View>
      </View>

      <View style={styles.certificateActions}>
        <Pressable style={styles.actionButton}>
          <Ionicons name="eye-outline" size={18} color={SemanticColors.textSecondary} />
          <Text style={styles.actionButtonText}>Bekijken</Text>
        </Pressable>
        <Pressable style={styles.actionButton}>
          <Ionicons name="share-outline" size={18} color={SemanticColors.textSecondary} />
          <Text style={styles.actionButtonText}>Delen</Text>
        </Pressable>
        {certificate.status !== 'valid' && (
          <Pressable style={[styles.actionButton, styles.actionButtonPrimary]}>
            <Ionicons name="refresh" size={18} color={Palette.hermesOrange} />
            <Text style={[styles.actionButtonText, { color: Palette.hermesOrange }]}>Vernieuwen</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function DocumentRow({ document }: { document: Document }) {
  const getTypeIcon = (type: Document['type']): IconName => {
    switch (type) {
      case 'contract': return 'document-text';
      case 'invoice': return 'receipt';
      case 'permit': return 'ribbon';
      case 'other': return 'document';
    }
  };

  return (
    <Pressable style={styles.documentRow}>
      <View style={styles.documentIcon}>
        <Ionicons name={getTypeIcon(document.type)} size={22} color={SemanticColors.textSecondary} />
      </View>
      <View style={styles.documentContent}>
        <Text style={styles.documentName} numberOfLines={1}>{document.name}</Text>
        <View style={styles.documentMeta}>
          {document.projectName && (
            <Text style={styles.documentProject}>{document.projectName}</Text>
          )}
          <Text style={styles.documentSize}>{document.fileSize}</Text>
          <Text style={styles.documentDate}>
            {new Date(document.uploadDate).toLocaleDateString('nl-NL')}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function CertificatenScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'certificates' | 'documents'>('certificates');

  const validCerts = MOCK_CERTIFICATES.filter(c => c.status === 'valid').length;
  const expiringCerts = MOCK_CERTIFICATES.filter(c => c.status === 'expiring').length;
  const expiredCerts = MOCK_CERTIFICATES.filter(c => c.status === 'expired').length;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Certificaten & Documenten',
          headerStyle: { backgroundColor: SemanticColors.surfacePrimary },
          headerTintColor: SemanticColors.textPrimary,
          headerShadowVisible: false,
        }}
      />

      {/* Summary Cards */}
      <View style={styles.summarySection}>
        <View style={styles.summaryCards}>
          <View style={[styles.summaryCard, { borderColor: SemanticColors.feedbackSuccessBorder }]}>
            <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
            <Text style={[styles.summaryValue, { color: SemanticColors.feedbackSuccess }]}>{validCerts}</Text>
            <Text style={styles.summaryLabel}>Geldig</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: SemanticColors.feedbackWarningBorder }]}>
            <Ionicons name="alert-circle" size={20} color={SemanticColors.feedbackWarning} />
            <Text style={[styles.summaryValue, { color: SemanticColors.feedbackWarning }]}>{expiringCerts}</Text>
            <Text style={styles.summaryLabel}>Verloopt</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: SemanticColors.feedbackErrorBorder }]}>
            <Ionicons name="close-circle" size={20} color={SemanticColors.feedbackError} />
            <Text style={[styles.summaryValue, { color: SemanticColors.feedbackError }]}>{expiredCerts}</Text>
            <Text style={styles.summaryLabel}>Verlopen</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'certificates' && styles.tabActive]}
          onPress={() => setActiveTab('certificates')}
        >
          <Ionicons
            name="ribbon"
            size={18}
            color={activeTab === 'certificates' ? '#fff' : SemanticColors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'certificates' && styles.tabTextActive]}>
            Certificaten
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'documents' && styles.tabActive]}
          onPress={() => setActiveTab('documents')}
        >
          <Ionicons
            name="folder-open"
            size={18}
            color={activeTab === 'documents' ? '#fff' : SemanticColors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'documents' && styles.tabTextActive]}>
            Documenten
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'certificates' ? (
          <>
            {/* Expiring Alert */}
            {(expiringCerts > 0 || expiredCerts > 0) && (
              <View style={styles.alertBanner}>
                <Ionicons name="warning" size={20} color={SemanticColors.feedbackWarning} />
                <Text style={styles.alertText}>
                  {expiredCerts > 0
                    ? `${expiredCerts} certificaat verlopen - vernieuw zo snel mogelijk`
                    : `${expiringCerts} certificaat verloopt binnenkort`}
                </Text>
              </View>
            )}

            {/* Certificates List */}
            {MOCK_CERTIFICATES.map(cert => (
              <CertificateCard key={cert.id} certificate={cert} />
            ))}

            {/* Add Certificate Button */}
            <Pressable style={styles.addButton}>
              <Ionicons name="add-circle" size={22} color={Palette.hermesOrange} />
              <Text style={styles.addButtonText}>Certificaat toevoegen</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Documents List */}
            <View style={styles.documentsList}>
              {MOCK_DOCUMENTS.map((doc, index) => (
                <View key={doc.id}>
                  <DocumentRow document={doc} />
                  {index < MOCK_DOCUMENTS.length - 1 && <View style={styles.documentDivider} />}
                </View>
              ))}
            </View>

            {/* Add Document Button */}
            <Pressable style={styles.addButton}>
              <Ionicons name="cloud-upload" size={22} color={Palette.hermesOrange} />
              <Text style={styles.addButtonText}>Document uploaden</Text>
            </Pressable>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  summarySection: {
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    gap: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabActive: {
    backgroundColor: Palette.hermesOrange,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.feedbackWarningBg,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackWarningBorder,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.feedbackWarning,
    fontWeight: '500',
  },
  certificateCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  certificateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  certificateIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certificateInfo: {
    flex: 1,
  },
  certificateName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  certificateIssuer: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  certificateDates: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  certificateActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  actionButtonPrimary: {
    backgroundColor: Palette.hermesOrange + '15',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  documentsList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  documentDivider: {
    height: 1,
    backgroundColor: SemanticColors.borderMuted,
    marginHorizontal: Spacing.md,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentContent: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  documentProject: {
    fontSize: 11,
    color: Palette.hermesOrange,
    fontWeight: '500',
  },
  documentSize: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  documentDate: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '40',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
});
