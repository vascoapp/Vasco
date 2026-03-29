// =============================================================================
// HANDOVER PACK BUILDER
// =============================================================================
// Step-by-step wizard for creating complete job handover packages
// Implements the "Evidence Pack & Handover Orchestration" feature (a16z E8)
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import type { EvidencePack, HandoverPackage, ChecklistCategory, EvidenceItem } from '../../types/contractor';
import {
  evidencePackService,
  useEvidencePack,
  useHandoverPackage,
  type PackValidationResult,
  type ComplianceCheckResult,
} from '../../services/evidencePackService';

// ============================================
// TYPES
// ============================================

interface HandoverPackBuilderProps {
  jobId: string;
  contractorId: string;
  customerId: string;
  job: {
    id: string;
    title: string;
    customerName: string;
    address: string;
    quotedAmount: number;
    finalAmount: number;
    currency: 'GBP' | 'EUR';
  };
  onComplete: (handoverPackage: HandoverPackage) => void;
  onClose?: () => void;
}

type WizardStep = 'photos' | 'checklist' | 'documents' | 'certificate' | 'preview';

const WIZARD_STEPS: { id: WizardStep; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'photos', label: 'Photos', icon: 'camera' },
  { id: 'checklist', label: 'Checklist', icon: 'checkmark-done' },
  { id: 'documents', label: 'Documents', icon: 'document-text' },
  { id: 'certificate', label: 'Certificate', icon: 'ribbon' },
  { id: 'preview', label: 'Preview', icon: 'eye' },
];

// ============================================
// COMPONENT
// ============================================

export function HandoverPackBuilder({
  jobId,
  contractorId,
  customerId,
  job,
  onComplete,
  onClose,
}: HandoverPackBuilderProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<WizardStep>('photos');
  const [evidencePackId, setEvidencePackId] = useState<string | null>(null);
  const [handoverPackageId, setHandoverPackageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [customerFeedback, setCustomerFeedback] = useState('');
  const [customerRating, setCustomerRating] = useState<number>(5);

  // Hooks for evidence pack and handover package
  const { pack, validation, compliance, updateChecklist, addPhoto } = useEvidencePack(evidencePackId || undefined);
  const { package: handoverPkg, generatePDF, createPortalLink, recordSignOff, send } = useHandoverPackage(handoverPackageId || undefined);


  const currentStepIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);

  // ----------------------------------------
  // INITIALIZATION
  // ----------------------------------------

  const initializeEvidencePack = useCallback(async () => {
    if (evidencePackId) return;

    setIsLoading(true);
    try {
      const newPack = await evidencePackService.assembleEvidencePack(
        jobId,
        contractorId,
        customerId
      );
      setEvidencePackId(newPack.id);
    } catch (error) {
      Alert.alert(t('common.error', 'Error'), t('handover.initFailed', 'Failed to initialize evidence pack'));
    } finally {
      setIsLoading(false);
    }
  }, [jobId, contractorId, customerId, evidencePackId]);

  // Initialize on mount
  useState(() => {
    initializeEvidencePack();
  });

  // ----------------------------------------
  // NAVIGATION
  // ----------------------------------------

  const canProceed = useMemo(() => {
    if (!pack) return false;

    switch (currentStep) {
      case 'photos':
        return pack.photos.length >= 1;
      case 'checklist':
        return pack.completionPercentage >= 100;
      case 'documents':
        return true; // Documents are optional
      case 'certificate':
        return true; // Certificate generation is optional but recommended
      case 'preview':
        return validation?.isValid || false;
      default:
        return false;
    }
  }, [currentStep, pack, validation]);

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < WIZARD_STEPS.length) {
      setCurrentStep(WIZARD_STEPS[nextIndex].id);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(WIZARD_STEPS[prevIndex].id);
    }
  };

  // ----------------------------------------
  // PHOTO HANDLING
  // ----------------------------------------

  const handleAddPhoto = (type: 'photo_before' | 'photo_during' | 'photo_after') => {
    // In real app, this would open camera/gallery
    const mockPhoto: Omit<EvidenceItem, 'id'> = {
      type,
      name: `${type.replace('photo_', '')} photo`,
      uri: `https://picsum.photos/800/600?random=${Date.now()}`,
      thumbnailUri: `https://picsum.photos/200/150?random=${Date.now()}`,
      mimeType: 'image/jpeg',
      size: 2400000,
      capturedAt: new Date().toISOString(),
      capturedBy: contractorId,
      verified: false,
    };
    addPhoto(mockPhoto);
    Alert.alert(t('handover.photoAdded', 'Photo Added'), t('handover.photoAddedMessage', 'Photo has been added to the evidence pack'));
  };

  // ----------------------------------------
  // HANDOVER CREATION
  // ----------------------------------------

  const createHandoverPackage = async () => {
    if (!evidencePackId || !pack) return;

    setIsLoading(true);
    try {
      const newPackage = evidencePackService.createHandoverPackage(
        evidencePackId,
        {
          id: customerId,
          name: job.customerName,
        },
        {
          quotedAmount: job.quotedAmount,
          finalAmount: job.finalAmount,
          currency: job.currency,
          paymentStatus: 'pending',
        }
      );
      setHandoverPackageId(newPackage.id);
    } catch (error) {
      Alert.alert(t('common.error', 'Error'), t('handover.createFailed', 'Failed to create handover package'));
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------
  // COMPLETION
  // ----------------------------------------

  const handleComplete = async () => {
    if (!handoverPackageId || !handoverPkg) {
      await createHandoverPackage();
    }

    // Record customer sign-off if provided
    if (customerSignature) {
      recordSignOff({
        signatureUri: customerSignature,
        signedByName: job.customerName,
        feedback: customerFeedback || undefined,
        rating: customerRating,
      });
    }

    // Generate PDF
    await generatePDF({
      includePhotos: true,
      includeChecklists: true,
      includeWarranties: true,
      includeFinancialSummary: true,
    });

    if (handoverPkg) {
      onComplete(handoverPkg);
    }
  };

  // ----------------------------------------
  // RENDER FUNCTIONS
  // ----------------------------------------

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {WIZARD_STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = index < currentStepIndex;

        return (
          <Pressable
            key={step.id}
            style={styles.stepItem}
            onPress={() => {
              if (isCompleted || index === currentStepIndex) {
                setCurrentStep(step.id);
              }
            }}
          >
            <View
              style={[
                styles.stepDot,
                isActive && styles.stepDotActive,
                isCompleted && styles.stepDotCompleted,
              ]}
            >
              {isCompleted ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Ionicons
                  name={step.icon}
                  size={14}
                  color={isActive ? '#fff' : SemanticColors.textTertiary}
                />
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                isActive && styles.stepLabelActive,
                isCompleted && styles.stepLabelCompleted,
              ]}
            >
              {step.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderPhotosStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Photo Evidence</Text>
      <Text style={styles.stepDescription}>
        Add before, during, and after photos to document the completed work
      </Text>

      {/* Photo Grid */}
      <View style={styles.photoGrid}>
        {pack?.photos.map((photo, index) => (
          <View key={photo.id} style={styles.photoItem}>
            <Image source={{ uri: photo.thumbnailUri || photo.uri }} style={styles.photoImage} />
            <View style={styles.photoTypeBadge}>
              <Text style={styles.photoTypeText}>
                {photo.type.replace('photo_', '').toUpperCase()}
              </Text>
            </View>
          </View>
        ))}

        {/* Add Photo Buttons */}
        <Pressable
          style={styles.addPhotoButton}
          onPress={() => handleAddPhoto('photo_before')}
        >
          <Ionicons name="camera" size={24} color={SemanticColors.actionPrimary} />
          <Text style={styles.addPhotoText}>Before</Text>
        </Pressable>

        <Pressable
          style={styles.addPhotoButton}
          onPress={() => handleAddPhoto('photo_during')}
        >
          <Ionicons name="camera" size={24} color={SemanticColors.actionPrimary} />
          <Text style={styles.addPhotoText}>During</Text>
        </Pressable>

        <Pressable
          style={styles.addPhotoButton}
          onPress={() => handleAddPhoto('photo_after')}
        >
          <Ionicons name="camera" size={24} color={SemanticColors.feedbackSuccess} />
          <Text style={[styles.addPhotoText, { color: SemanticColors.feedbackSuccess }]}>After</Text>
        </Pressable>
      </View>

      {/* Photo Count */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={18} color={SemanticColors.feedbackInfo} />
        <Text style={styles.infoText}>
          {pack?.photos.length || 0} photos added. At least 1 photo required.
        </Text>
      </View>
    </View>
  );

  const renderChecklistStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Completion Checklist</Text>
      <Text style={styles.stepDescription}>
        Verify all work has been completed to standard
      </Text>

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Progress</Text>
          <Text style={styles.progressPercent}>{pack?.completionPercentage || 0}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pack?.completionPercentage || 0}%` }]} />
        </View>
      </View>

      {/* Checklist Categories */}
      <ScrollView style={styles.checklistScroll}>
        {pack?.checklists.map((category) => (
          <View key={category.id} style={styles.checklistCategory}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            {category.items.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.checklistItem, item.completed && styles.checklistItemCompleted]}
                onPress={() => updateChecklist(category.id, item.id, { completed: !item.completed })}
              >
                <View
                  style={[styles.checkbox, item.completed && styles.checkboxChecked]}
                >
                  {item.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text
                  style={[
                    styles.checklistLabel,
                    item.completed && styles.checklistLabelCompleted,
                  ]}
                >
                  {item.label}
                </Text>
                {item.required && (
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredText}>Required</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderDocumentsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Documents & Warranties</Text>
      <Text style={styles.stepDescription}>
        Attach warranties, certificates, and other documentation
      </Text>

      {/* Warranties */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.sectionTitle}>Warranties</Text>
        </View>

        {pack?.warranties.map((warranty) => (
          <View key={warranty.id} style={styles.documentItem}>
            <Ionicons name="document" size={20} color={SemanticColors.textSecondary} />
            <View style={styles.documentInfo}>
              <Text style={styles.documentName}>{warranty.description}</Text>
              <Text style={styles.documentMeta}>
                Valid until {new Date(warranty.endDate).toLocaleDateString()}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
          </View>
        ))}

        <Pressable style={styles.addButton}>
          <Ionicons name="add-circle" size={20} color={SemanticColors.actionPrimary} />
          <Text style={styles.addButtonText}>Add Warranty</Text>
        </Pressable>
      </View>

      {/* Certificates */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="ribbon" size={18} color={SemanticColors.feedbackInfo} />
          <Text style={styles.sectionTitle}>Certificates</Text>
        </View>

        {pack?.certificates.map((cert) => (
          <View key={cert.id} style={styles.documentItem}>
            <Ionicons name="document" size={20} color={SemanticColors.textSecondary} />
            <View style={styles.documentInfo}>
              <Text style={styles.documentName}>{cert.name}</Text>
              <Text style={styles.documentMeta}>Issued by {cert.issuer}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
          </View>
        ))}

        <Pressable style={styles.addButton}>
          <Ionicons name="add-circle" size={20} color={SemanticColors.actionPrimary} />
          <Text style={styles.addButtonText}>Add Certificate</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderCertificateStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Completion Certificate</Text>
      <Text style={styles.stepDescription}>
        Generate and sign the completion certificate
      </Text>

      {/* Certificate Preview */}
      <View style={styles.certificatePreview}>
        <View style={styles.certificateHeader}>
          <Ionicons name="ribbon" size={40} color={SemanticColors.actionPrimary} />
          <Text style={styles.certificateTitle}>Certificate of Completion</Text>
        </View>

        <View style={styles.certificateContent}>
          <Text style={styles.certificateText}>
            This certifies that the work described as:
          </Text>
          <Text style={styles.certificateJob}>{job.title}</Text>
          <Text style={styles.certificateText}>
            at {job.address}
          </Text>
          <Text style={styles.certificateText}>
            has been completed to the satisfaction of both parties.
          </Text>
        </View>

        <View style={styles.certificateDetails}>
          <View style={styles.certificateRow}>
            <Text style={styles.certificateLabel}>Customer:</Text>
            <Text style={styles.certificateValue}>{job.customerName}</Text>
          </View>
          <View style={styles.certificateRow}>
            <Text style={styles.certificateLabel}>Completion Date:</Text>
            <Text style={styles.certificateValue}>{new Date().toLocaleDateString()}</Text>
          </View>
          <View style={styles.certificateRow}>
            <Text style={styles.certificateLabel}>Final Amount:</Text>
            <Text style={styles.certificateValue}>{formatCurrency(job.finalAmount)}</Text>
          </View>
        </View>
      </View>

      {/* Customer Sign-off */}
      <View style={styles.signatureSection}>
        <Text style={styles.signatureTitle}>Customer Sign-off (Optional)</Text>

        <Pressable
          style={[
            styles.signatureBox,
            customerSignature && styles.signatureBoxSigned,
          ]}
          onPress={() => {
            // In real app, this would open a signature capture
            setCustomerSignature('mock-signature-uri');
            Alert.alert(t('handover.signatureCaptured', 'Signature Captured'), t('handover.signatureRecorded', 'Customer signature has been recorded'));
          }}
        >
          {customerSignature ? (
            <>
              <Ionicons name="checkmark-circle" size={24} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.signatureText}>Signature captured</Text>
            </>
          ) : (
            <>
              <Ionicons name="create" size={24} color={SemanticColors.textTertiary} />
              <Text style={styles.signatureText}>Tap to capture customer signature</Text>
            </>
          )}
        </Pressable>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>Customer Rating</Text>
          <View style={styles.ratingStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setCustomerRating(star)}>
                <Ionicons
                  name={star <= customerRating ? 'star' : 'star-outline'}
                  size={28}
                  color={star <= customerRating ? '#F59E0B' : SemanticColors.textTertiary}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Feedback */}
        <TextInput
          style={styles.feedbackInput}
          placeholder="Customer feedback (optional)"
          placeholderTextColor={SemanticColors.textTertiary}
          value={customerFeedback}
          onChangeText={setCustomerFeedback}
          multiline
          numberOfLines={3}
        />
      </View>
    </View>
  );

  const renderPreviewStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Handover Preview</Text>
      <Text style={styles.stepDescription}>
        Review the handover package before sending to customer
      </Text>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Ionicons name="briefcase" size={24} color={SemanticColors.actionPrimary} />
          <View style={styles.summaryHeaderText}>
            <Text style={styles.summaryTitle}>{job.title}</Text>
            <Text style={styles.summarySubtitle}>{job.customerName}</Text>
          </View>
        </View>

        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pack?.totalPhotos || 0}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pack?.warranties.length || 0}</Text>
            <Text style={styles.statLabel}>Warranties</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pack?.completionPercentage || 0}%</Text>
            <Text style={styles.statLabel}>Complete</Text>
          </View>
        </View>
      </View>

      {/* Validation Results */}
      <View style={styles.validationSection}>
        <Text style={styles.validationTitle}>Validation</Text>

        {validation?.isValid ? (
          <View style={styles.validationSuccess}>
            <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.validationSuccessText}>All requirements met</Text>
          </View>
        ) : (
          <View style={styles.validationWarnings}>
            {validation?.missingRequired.map((item, index) => (
              <View key={index} style={styles.validationItem}>
                <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
                <Text style={styles.validationItemText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {validation?.warnings.map((warning, index) => (
          <View key={index} style={styles.warningItem}>
            <Ionicons name="warning" size={16} color={SemanticColors.feedbackWarning} />
            <Text style={styles.warningItemText}>{warning}</Text>
          </View>
        ))}
      </View>

      {/* Compliance Status */}
      <View style={styles.complianceSection}>
        <Text style={styles.validationTitle}>Compliance</Text>
        <View style={[
          styles.complianceBadge,
          compliance?.status === 'compliant' && styles.complianceCompliant,
          compliance?.status === 'partial' && styles.compliancePartial,
          compliance?.status === 'non-compliant' && styles.complianceNonCompliant,
        ]}>
          <Text style={styles.complianceBadgeText}>
            {compliance?.status === 'compliant' ? 'Compliant' :
             compliance?.status === 'partial' ? 'Partially Compliant' : 'Non-Compliant'}
          </Text>
        </View>
        <Text style={styles.complianceScore}>Score: {compliance?.overallScore || 0}%</Text>
      </View>

      {/* Actions */}
      <View style={styles.actionButtons}>
        <Pressable style={styles.actionButton} onPress={() => generatePDF()}>
          <Ionicons name="document-text" size={20} color={SemanticColors.actionPrimary} />
          <Text style={styles.actionButtonText}>Generate PDF</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => createPortalLink()}>
          <Ionicons name="link" size={20} color={SemanticColors.actionPrimary} />
          <Text style={styles.actionButtonText}>Create Portal Link</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'photos':
        return renderPhotosStep();
      case 'checklist':
        return renderChecklistStep();
      case 'documents':
        return renderDocumentsStep();
      case 'certificate':
        return renderCertificateStep();
      case 'preview':
        return renderPreviewStep();
      default:
        return null;
    }
  };

  // ----------------------------------------
  // MAIN RENDER
  // ----------------------------------------

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Create Handover Pack</Text>
          <Text style={styles.headerSubtitle}>{job.title}</Text>
        </View>
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {renderCurrentStep()}
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.footerButton, styles.footerButtonSecondary]}
          onPress={goToPreviousStep}
          disabled={currentStepIndex === 0}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={currentStepIndex === 0 ? SemanticColors.textDisabled : SemanticColors.textPrimary}
          />
          <Text
            style={[
              styles.footerButtonText,
              currentStepIndex === 0 && styles.footerButtonTextDisabled,
            ]}
          >
            Back
          </Text>
        </Pressable>

        {currentStep === 'preview' ? (
          <Pressable
            style={[styles.footerButton, styles.footerButtonPrimary, !canProceed && styles.footerButtonDisabled]}
            onPress={handleComplete}
            disabled={!canProceed}
          >
            <Text style={styles.footerButtonTextPrimary}>Complete Handover</Text>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.footerButton, styles.footerButtonPrimary, !canProceed && styles.footerButtonDisabled]}
            onPress={goToNextStep}
            disabled={!canProceed}
          >
            <Text style={styles.footerButtonTextPrimary}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        )}
      </View>
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
  closeButton: {
    padding: Spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  headerSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.lg,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  stepDotCompleted: {
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  stepLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize - 1,
  },
  stepLabelActive: {
    color: SemanticColors.actionPrimary,
    fontFamily: TYPE.titleFamily,
  },
  stepLabelCompleted: {
    color: SemanticColors.feedbackSuccess,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  stepContent: {
    gap: Spacing.md,
  },
  stepTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  stepDescription: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoTypeBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoTypeText: {
    color: Palette.white,
    fontSize: TYPE.tinySize - 3,
    fontFamily: TYPE.titleFamily,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    color: SemanticColors.actionPrimary,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackInfoBg,
    borderRadius: RADIUS.sm,
  },
  infoText: {
    color: SemanticColors.feedbackInfo,
    fontSize: TYPE.captionSize,
    flex: 1,
  },
  progressSection: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  progressPercent: {
    color: SemanticColors.feedbackSuccess,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.sectionFamily,
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
  checklistScroll: {
    maxHeight: 400,
  },
  checklistCategory: {
    gap: 8,
    marginBottom: Spacing.md,
  },
  categoryTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    gap: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  checklistItemCompleted: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderColor: SemanticColors.feedbackSuccessBorder,
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
    fontSize: TYPE.captionSize,
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
  requiredText: {
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.tinySize - 2,
    fontFamily: TYPE.titleFamily,
  },
  section: {
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  documentMeta: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.sm,
  },
  addButtonText: {
    color: SemanticColors.actionPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  certificatePreview: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  certificateHeader: {
    alignItems: 'center',
    gap: 8,
  },
  certificateTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  certificateContent: {
    alignItems: 'center',
    gap: 4,
  },
  certificateText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    textAlign: 'center',
  },
  certificateJob: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    textAlign: 'center',
    marginVertical: 4,
  },
  certificateDetails: {
    gap: 8,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  certificateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  certificateLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
  },
  certificateValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  signatureSection: {
    gap: Spacing.md,
  },
  signatureTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  signatureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.lg,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
    borderStyle: 'dashed',
  },
  signatureBoxSigned: {
    borderColor: SemanticColors.feedbackSuccess,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderStyle: 'solid',
  },
  signatureText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
  },
  ratingSection: {
    alignItems: 'center',
    gap: 8,
  },
  ratingLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 4,
  },
  feedbackInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: Spacing.md,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryHeaderText: {
    flex: 1,
  },
  summaryTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
  },
  summarySubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  statLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
  },
  validationSection: {
    gap: Spacing.sm,
  },
  validationTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  validationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: RADIUS.sm,
  },
  validationSuccessText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  validationWarnings: {
    gap: 4,
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: RADIUS.sm,
  },
  validationItemText: {
    color: SemanticColors.feedbackError,
    fontSize: TYPE.labelSize,
    flex: 1,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: RADIUS.sm,
  },
  warningItemText: {
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.labelSize,
    flex: 1,
  },
  complianceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  complianceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  complianceCompliant: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  compliancePartial: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  complianceNonCompliant: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  complianceBadgeText: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  complianceScore: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  actionButtonText: {
    color: SemanticColors.actionPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  footerButtonSecondary: {
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  footerButtonPrimary: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  footerButtonDisabled: {
    backgroundColor: SemanticColors.textDisabled,
    opacity: 0.6,
  },
  footerButtonText: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  footerButtonTextDisabled: {
    color: SemanticColors.textDisabled,
  },
  footerButtonTextPrimary: {
    color: Palette.white,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
});
