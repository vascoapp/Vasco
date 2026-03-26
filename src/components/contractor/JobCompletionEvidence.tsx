// Job Completion Evidence - Photo proof triggers invoice generation
// Implements the "evidence graph": work → photos → checklist → invoice
import { useState, useMemo } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';

// Types
interface CompletionItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
  photo?: string; // URI of photo evidence
  notes?: string;
  category: 'work' | 'safety' | 'quality' | 'cleanup';
}

interface JobForCompletion {
  id: string;
  title: string;
  customerName: string;
  address: string;
  agreedAmount: number;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
}

interface JobCompletionEvidenceProps {
  job: JobForCompletion;
  onGenerateInvoice: (evidencePackage: EvidencePackage) => void;
  onClose?: () => void;
}

interface EvidencePackage {
  jobId: string;
  completedAt: string;
  checklist: CompletionItem[];
  photos: { uri: string; caption: string; timestamp: string }[];
  customerSignature?: string;
  totalPhotos: number;
  allRequiredComplete: boolean;
}

// Default checklist items by category
const DEFAULT_CHECKLIST: Omit<CompletionItem, 'completed' | 'photo'>[] = [
  // Work items
  { id: 'work-1', label: 'All quoted work completed', required: true, category: 'work' },
  { id: 'work-2', label: 'Customer walkthrough done', required: true, category: 'work' },
  { id: 'work-3', label: 'Final inspection passed', required: false, category: 'work' },

  // Quality items
  { id: 'quality-1', label: 'Work meets quality standards', required: true, category: 'quality' },
  { id: 'quality-2', label: 'No visible defects', required: true, category: 'quality' },
  { id: 'quality-3', label: 'Materials match specifications', required: false, category: 'quality' },

  // Safety items
  { id: 'safety-1', label: 'Site left safe', required: true, category: 'safety' },
  { id: 'safety-2', label: 'All utilities functioning', required: true, category: 'safety' },

  // Cleanup items
  { id: 'cleanup-1', label: 'Work area cleaned', required: true, category: 'cleanup' },
  { id: 'cleanup-2', label: 'Debris removed', required: true, category: 'cleanup' },
  { id: 'cleanup-3', label: 'Tools and materials removed', required: false, category: 'cleanup' },
];

const CATEGORY_CONFIG: Record<CompletionItem['category'], {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = {
  work: { label: 'Work Completed', icon: 'construct', color: SemanticColors.actionPrimary },
  quality: { label: 'Quality Check', icon: 'checkmark-done', color: '#8B5CF6' },
  safety: { label: 'Safety', icon: 'shield-checkmark', color: SemanticColors.feedbackSuccess },
  cleanup: { label: 'Site Cleanup', icon: 'sparkles', color: SemanticColors.feedbackInfo },
};

export function JobCompletionEvidence({ job, onGenerateInvoice, onClose }: JobCompletionEvidenceProps) {
  const [checklist, setChecklist] = useState<CompletionItem[]>(
    DEFAULT_CHECKLIST.map(item => ({ ...item, completed: false }))
  );
  const [photos, setPhotos] = useState<{ uri: string; caption: string; timestamp: string }[]>([]);
  const [customerApproved, setCustomerApproved] = useState(false);

  // formatCurrency imported from ../../i18n/formatting

  // Calculate completion stats
  const stats = useMemo(() => {
    const required = checklist.filter(i => i.required);
    const requiredComplete = required.filter(i => i.completed);
    const allComplete = checklist.filter(i => i.completed);

    return {
      totalItems: checklist.length,
      completedItems: allComplete.length,
      requiredItems: required.length,
      requiredComplete: requiredComplete.length,
      allRequiredDone: requiredComplete.length === required.length,
      percentage: Math.round((allComplete.length / checklist.length) * 100),
    };
  }, [checklist]);

  // Group by category
  const groupedChecklist = useMemo(() => {
    const groups: Record<CompletionItem['category'], CompletionItem[]> = {
      work: [],
      quality: [],
      safety: [],
      cleanup: [],
    };
    checklist.forEach(item => {
      groups[item.category].push(item);
    });
    return groups;
  }, [checklist]);

  const toggleItem = (id: string) => {
    setChecklist(checklist.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const addPhoto = () => {
    // In real app, this would open camera/gallery
    // For now, simulate adding a photo
    const mockPhoto = {
      uri: `https://picsum.photos/400/300?random=${Date.now()}`,
      caption: `Photo ${photos.length + 1}`,
      timestamp: new Date().toISOString(),
    };
    setPhotos([...photos, mockPhoto]);
    Alert.alert('Photo Added', 'Evidence photo has been added to this job completion.');
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const canGenerateInvoice = stats.allRequiredDone && photos.length >= 1;

  const handleGenerateInvoice = () => {
    if (!canGenerateInvoice) {
      Alert.alert(
        'Cannot Generate Invoice',
        `Please complete all required items (${stats.requiredComplete}/${stats.requiredItems}) and add at least 1 photo.`
      );
      return;
    }

    Alert.alert(
      'Generate Invoice',
      `Create invoice for ${formatCurrency(job.agreedAmount)} with ${photos.length} evidence photos attached?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () => {
            const evidencePackage: EvidencePackage = {
              jobId: job.id,
              completedAt: new Date().toISOString(),
              checklist,
              photos,
              customerSignature: customerApproved ? 'approved' : undefined,
              totalPhotos: photos.length,
              allRequiredComplete: stats.allRequiredDone,
            };
            onGenerateInvoice(evidencePackage);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Complete Job</Text>
          <Text style={styles.headerSubtitle}>{job.title}</Text>
        </View>
      </View>

      {/* Job Summary */}
      <View style={styles.jobSummary}>
        <View style={styles.jobInfo}>
          <Text style={styles.jobCustomer}>{job.customerName}</Text>
          <Text style={styles.jobAddress}>{job.address}</Text>
        </View>
        <View style={styles.jobAmount}>
          <Text style={styles.jobAmountLabel}>Invoice Amount</Text>
          <Text style={styles.jobAmountValue}>{formatCurrency(job.agreedAmount)}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Completion Progress</Text>
          <Text style={styles.progressPercent}>{stats.percentage}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${stats.percentage}%` }]} />
        </View>
        <Text style={styles.progressSubtext}>
          {stats.completedItems}/{stats.totalItems} items • {stats.requiredComplete}/{stats.requiredItems} required
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Photo Evidence Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="camera" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.sectionTitle}>Photo Evidence</Text>
            </View>
            <View style={styles.photoBadge}>
              <Text style={styles.photoBadgeText}>{photos.length} photos</Text>
            </View>
          </View>

          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                <Pressable
                  style={styles.photoRemove}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close-circle" size={22} color={SemanticColors.feedbackError} />
                </Pressable>
                <View style={styles.photoCaption}>
                  <Text style={styles.photoCaptionText} numberOfLines={1}>
                    {photo.caption}
                  </Text>
                </View>
              </View>
            ))}

            <Pressable style={styles.addPhotoButton} onPress={addPhoto}>
              <Ionicons name="camera" size={28} color={SemanticColors.actionPrimary} />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </Pressable>
          </View>

          {photos.length === 0 && (
            <View style={styles.photoHint}>
              <Ionicons name="information-circle" size={16} color={SemanticColors.feedbackInfo} />
              <Text style={styles.photoHintText}>
                At least 1 photo required for invoice generation
              </Text>
            </View>
          )}
        </View>

        {/* Checklist Sections */}
        {(Object.keys(groupedChecklist) as CompletionItem['category'][]).map((category) => {
          const items = groupedChecklist[category];
          if (items.length === 0) return null;

          const config = CATEGORY_CONFIG[category];
          const categoryComplete = items.filter(i => i.completed).length;

          return (
            <View key={category} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name={config.icon} size={18} color={config.color} />
                  <Text style={styles.sectionTitle}>{config.label}</Text>
                </View>
                <Text style={styles.sectionCount}>{categoryComplete}/{items.length}</Text>
              </View>

              <View style={styles.checklistItems}>
                {items.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.checklistItem, item.completed && styles.checklistItemCompleted]}
                    onPress={() => toggleItem(item.id)}
                  >
                    <View style={[
                      styles.checkbox,
                      item.completed && styles.checkboxChecked,
                      item.completed && { backgroundColor: config.color, borderColor: config.color },
                    ]}>
                      {item.completed && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text style={[
                      styles.checklistLabel,
                      item.completed && styles.checklistLabelCompleted,
                    ]}>
                      {item.label}
                    </Text>
                    {item.required && (
                      <View style={styles.requiredBadge}>
                        <Text style={styles.requiredBadgeText}>Required</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}

        {/* Customer Approval */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="person-circle" size={18} color="#8B5CF6" />
              <Text style={styles.sectionTitle}>Customer Approval</Text>
            </View>
          </View>

          <Pressable
            style={[styles.approvalCard, customerApproved && styles.approvalCardApproved]}
            onPress={() => setCustomerApproved(!customerApproved)}
          >
            <View style={[
              styles.checkbox,
              customerApproved && styles.checkboxChecked,
              customerApproved && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
            ]}>
              {customerApproved && (
                <Ionicons name="checkmark" size={14} color="#fff" />
              )}
            </View>
            <View style={styles.approvalContent}>
              <Text style={styles.approvalTitle}>Customer has approved completed work</Text>
              <Text style={styles.approvalSubtitle}>
                Optional but recommended - provides additional protection
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Evidence Summary */}
        <View style={styles.evidenceSummary}>
          <View style={styles.evidenceSummaryIcon}>
            <Ionicons name="shield-checkmark" size={24} color={SemanticColors.feedbackSuccess} />
          </View>
          <View style={styles.evidenceSummaryContent}>
            <Text style={styles.evidenceSummaryTitle}>Evidence Package</Text>
            <Text style={styles.evidenceSummaryText}>
              {photos.length} photos • {stats.completedItems} checks • {customerApproved ? 'Customer approved' : 'No approval yet'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomInfo}>
          {canGenerateInvoice ? (
            <>
              <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.bottomInfoText}>Ready to invoice</Text>
            </>
          ) : (
            <>
              <Ionicons name="alert-circle" size={20} color={SemanticColors.feedbackWarning} />
              <Text style={styles.bottomInfoTextWarning}>
                {!stats.allRequiredDone
                  ? `${stats.requiredItems - stats.requiredComplete} required items left`
                  : 'Add at least 1 photo'}
              </Text>
            </>
          )}
        </View>
        <Pressable
          style={[styles.invoiceButton, !canGenerateInvoice && styles.invoiceButtonDisabled]}
          onPress={handleGenerateInvoice}
        >
          <Ionicons name="receipt" size={20} color="#fff" />
          <Text style={styles.invoiceButtonText}>Generate Invoice</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  jobSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  jobInfo: {
    flex: 1,
  },
  jobCustomer: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  jobAddress: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  jobAmount: {
    alignItems: 'flex-end',
  },
  jobAmountLabel: {
    color: SemanticColors.textTertiary,
    fontSize: 10,
  },
  jobAmountValue: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 20,
    fontWeight: '700',
  },
  progressSection: {
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercent: {
    color: SemanticColors.actionPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 4,
  },
  progressSubtext: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  section: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  sectionCount: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
  },
  photoBadge: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoBadgeText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 11,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 11,
  },
  photoCaption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 4,
  },
  photoCaptionText: {
    color: '#fff',
    fontSize: 9,
    textAlign: 'center',
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: SemanticColors.actionPrimary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: SemanticColors.actionPrimary + '08',
  },
  addPhotoText: {
    color: SemanticColors.actionPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  photoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackInfoBg,
    borderRadius: 8,
  },
  photoHintText: {
    color: SemanticColors.feedbackInfo,
    fontSize: 12,
    flex: 1,
  },
  checklistItems: {
    gap: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    gap: 10,
  },
  checklistItemCompleted: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: SemanticColors.feedbackSuccess,
    borderColor: SemanticColors.feedbackSuccess,
  },
  checklistLabel: {
    flex: 1,
    color: SemanticColors.textPrimary,
    fontSize: 13,
  },
  checklistLabelCompleted: {
    color: SemanticColors.feedbackSuccess,
  },
  requiredBadge: {
    backgroundColor: SemanticColors.feedbackWarningBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredBadgeText: {
    color: SemanticColors.feedbackWarning,
    fontSize: 9,
    fontWeight: '600',
  },
  approvalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    gap: 12,
  },
  approvalCardApproved: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  approvalContent: {
    flex: 1,
  },
  approvalTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  approvalSubtitle: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  evidenceSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  evidenceSummaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.feedbackSuccess + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceSummaryContent: {
    flex: 1,
  },
  evidenceSummaryTitle: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 14,
    fontWeight: '600',
  },
  evidenceSummaryText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  bottomInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bottomInfoText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 13,
    fontWeight: '500',
  },
  bottomInfoTextWarning: {
    color: SemanticColors.feedbackWarning,
    fontSize: 13,
    fontWeight: '500',
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 12,
  },
  invoiceButtonDisabled: {
    backgroundColor: SemanticColors.textTertiary,
  },
  invoiceButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
