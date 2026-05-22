// =============================================================================
// EXECUTION CONFIRMATION MODAL
// =============================================================================
// Final confirmation gate for high-stakes actions (P0 - a16z E9 Liability)
// Prevents accidental execution of critical actions
// =============================================================================

import { useState, useCallback } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import type { ActionInstance, ActionRiskLevel } from '../../modules/agentActions';
import {
  getConfirmationRequirements,
  confirmAndExecute,
  type ConfirmationRequirements,
} from '../../modules/agentActions';

// ============================================
// TYPES
// ============================================

interface ExecutionConfirmationModalProps {
  visible: boolean;
  action: ActionInstance | null;
  userName: string;
  userId: string;
  onConfirm: (action: ActionInstance) => void;
  onCancel: () => void;
}

type ConfirmationStep = 'review' | 'pin' | '2fa' | 'final';

// ============================================
// COMPONENT
// ============================================

export function ExecutionConfirmationModal({
  visible,
  action,
  userName,
  userId,
  onConfirm,
  onCancel,
}: ExecutionConfirmationModalProps) {
  const [currentStep, setCurrentStep] = useState<ConfirmationStep>('review');
  const [pinCode, setPinCode] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get confirmation requirements for this action
  const requirements = action ? getConfirmationRequirements(action) : null;

  // formatCurrency imported from ../../i18n/formatting

  const getRiskLevelColor = (level: ActionRiskLevel) => {
    switch (level) {
      case 'critical':
        return SemanticColors.feedbackError;
      case 'high':
        return SemanticColors.feedbackWarning;
      case 'medium':
        return SemanticColors.feedbackInfo;
      default:
        return SemanticColors.textSecondary;
    }
  };

  const getRiskLevelIcon = (level: ActionRiskLevel): keyof typeof Ionicons.glyphMap => {
    switch (level) {
      case 'critical':
        return 'alert-circle';
      case 'high':
        return 'warning';
      case 'medium':
        return 'information-circle';
      default:
        return 'checkmark-circle';
    }
  };

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleProceed = useCallback(() => {
    if (!requirements) return;

    if (requirements.requiresPin && currentStep === 'review') {
      setCurrentStep('pin');
      return;
    }

    if (requirements.requires2FA && currentStep === 'pin') {
      setCurrentStep('2fa');
      return;
    }

    setCurrentStep('final');
  }, [requirements, currentStep]);

  const validatePin = useCallback(() => {
    if (pinCode.length < 4) {
      setError('PIN must be at least 4 digits');
      return false;
    }
    // In production, validate against stored PIN
    setError(null);
    return true;
  }, [pinCode]);

  const validate2FA = useCallback(() => {
    if (twoFactorCode.length !== 6) {
      setError('2FA code must be 6 digits');
      return false;
    }
    // In production, validate against TOTP
    setError(null);
    return true;
  }, [twoFactorCode]);

  const handleConfirm = useCallback(async () => {
    if (!action) return;

    // Validate based on current step
    if (currentStep === 'pin' && !validatePin()) return;
    if (currentStep === '2fa' && !validate2FA()) return;

    // If not on final step, proceed to next
    if (currentStep !== 'final') {
      handleProceed();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Execute the confirmation
      const confirmedAction = confirmAndExecute(
        action,
        userId,
        userName,
        pinCode || undefined
      );

      onConfirm(confirmedAction);

      // Reset state
      setCurrentStep('review');
      setPinCode('');
      setTwoFactorCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setIsLoading(false);
    }
  }, [action, currentStep, userId, userName, pinCode, validatePin, validate2FA, handleProceed, onConfirm]);

  const handleCancel = useCallback(() => {
    setCurrentStep('review');
    setPinCode('');
    setTwoFactorCode('');
    setError(null);
    onCancel();
  }, [onCancel]);

  // ----------------------------------------
  // RENDER FUNCTIONS
  // ----------------------------------------

  const renderReviewStep = () => {
    if (!action || !requirements) return null;

    return (
      <>
        {/* Warning Header */}
        <View style={[styles.warningHeader, { backgroundColor: getRiskLevelColor(action.riskLevel) + '20' }]}>
          <Ionicons
            name={getRiskLevelIcon(action.riskLevel)}
            size={32}
            color={getRiskLevelColor(action.riskLevel)}
          />
          <Text style={[styles.warningTitle, { color: getRiskLevelColor(action.riskLevel) }]}>
            {action.riskLevel === 'critical' ? 'Critical Action' :
             action.riskLevel === 'high' ? 'High-Stakes Action' : 'Action Confirmation'}
          </Text>
        </View>

        {/* Action Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.actionTitle}>{action.title}</Text>
          <Text style={styles.actionDescription}>{action.description}</Text>

          {/* Amount if applicable */}
          {action.amount && (
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Amount</Text>
              <Text style={styles.amountValue}>
                {formatCurrency(action.amount)}
              </Text>
            </View>
          )}
        </View>

        {/* Warning Message */}
        {requirements.warningMessage && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={20} color={SemanticColors.feedbackWarning} />
            <Text style={styles.warningText}>{requirements.warningMessage}</Text>
          </View>
        )}

        {/* Confirmation Reason */}
        <View style={styles.reasonBox}>
          <Ionicons name="information-circle" size={18} color={SemanticColors.feedbackInfo} />
          <Text style={styles.reasonText}>{requirements.reason}</Text>
        </View>

        {/* Impact Summary */}
        {requirements.impactSummary && (
          <View style={styles.impactSection}>
            <Text style={styles.impactTitle}>Impact Summary</Text>
            {requirements.impactSummary.financial && (
              <View style={styles.impactRow}>
                <Ionicons name="cash" size={16} color={SemanticColors.textSecondary} />
                <Text style={styles.impactText}>
                  Financial: {formatCurrency(
                    requirements.impactSummary.financial.amount
                  )}
                </Text>
              </View>
            )}
            {requirements.impactSummary.legal && (
              <View style={styles.impactRow}>
                <Ionicons name="document-text" size={16} color={SemanticColors.textSecondary} />
                <Text style={styles.impactText}>Legal: {requirements.impactSummary.legal}</Text>
              </View>
            )}
            {requirements.impactSummary.operational && (
              <View style={styles.impactRow}>
                <Ionicons name="construct" size={16} color={SemanticColors.textSecondary} />
                <Text style={styles.impactText}>Operational: {requirements.impactSummary.operational}</Text>
              </View>
            )}
          </View>
        )}

        {/* Security Requirements */}
        <View style={styles.securitySection}>
          <Text style={styles.securityTitle}>Security Verification</Text>
          <View style={styles.securityItems}>
            <View style={styles.securityItem}>
              <Ionicons
                name={requirements.requiresPin ? 'lock-closed' : 'lock-open'}
                size={16}
                color={requirements.requiresPin ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
              />
              <Text style={[
                styles.securityItemText,
                requirements.requiresPin && styles.securityItemRequired,
              ]}>
                PIN Verification {requirements.requiresPin ? '(Required)' : '(Not Required)'}
              </Text>
            </View>
            <View style={styles.securityItem}>
              <Ionicons
                name={requirements.requires2FA ? 'shield-checkmark' : 'shield'}
                size={16}
                color={requirements.requires2FA ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
              />
              <Text style={[
                styles.securityItemText,
                requirements.requires2FA && styles.securityItemRequired,
              ]}>
                2FA Verification {requirements.requires2FA ? '(Required)' : '(Not Required)'}
              </Text>
            </View>
          </View>
        </View>
      </>
    );
  };

  const renderPinStep = () => (
    <View style={styles.verificationSection}>
      <View style={styles.verificationHeader}>
        <Ionicons name="lock-closed" size={40} color={SemanticColors.actionPrimary} />
        <Text style={styles.verificationTitle}>Enter PIN</Text>
        <Text style={styles.verificationSubtitle}>
          Enter your security PIN to proceed
        </Text>
      </View>

      <View style={styles.pinInputContainer}>
        <TextInput
          style={styles.pinInput}
          value={pinCode}
          onChangeText={setPinCode}
          placeholder="• • • •"
          placeholderTextColor={SemanticColors.textTertiary}
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          autoFocus
        />
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );

  const render2FAStep = () => (
    <View style={styles.verificationSection}>
      <View style={styles.verificationHeader}>
        <Ionicons name="shield-checkmark" size={40} color={SemanticColors.actionPrimary} />
        <Text style={styles.verificationTitle}>Two-Factor Authentication</Text>
        <Text style={styles.verificationSubtitle}>
          Enter the 6-digit code from your authenticator app
        </Text>
      </View>

      <View style={styles.pinInputContainer}>
        <TextInput
          style={styles.pinInput}
          value={twoFactorCode}
          onChangeText={setTwoFactorCode}
          placeholder="• • • • • •"
          placeholderTextColor={SemanticColors.textTertiary}
          keyboardType="numeric"
          maxLength={6}
          autoFocus
        />
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );

  const renderFinalStep = () => (
    <View style={styles.finalSection}>
      <View style={styles.finalHeader}>
        <Ionicons name="help-circle" size={48} color={SemanticColors.feedbackWarning} />
        <Text style={styles.finalTitle}>Are you sure?</Text>
        <Text style={styles.finalSubtitle}>
          This action cannot be undone. Please confirm you want to proceed.
        </Text>
      </View>

      <View style={styles.finalSummary}>
        <Text style={styles.finalSummaryLabel}>Action:</Text>
        <Text style={styles.finalSummaryValue}>{action?.title}</Text>

        {action?.amount && (
          <>
            <Text style={styles.finalSummaryLabel}>Amount:</Text>
            <Text style={styles.finalSummaryValue}>
              {formatCurrency(action.amount)}
            </Text>
          </>
        )}

        <Text style={styles.finalSummaryLabel}>Confirmed by:</Text>
        <Text style={styles.finalSummaryValue}>{userName}</Text>

        <Text style={styles.finalSummaryLabel}>Timestamp:</Text>
        <Text style={styles.finalSummaryValue}>{new Date().toLocaleString()}</Text>
      </View>

      <View style={styles.auditNotice}>
        <Ionicons name="document-text" size={16} color={SemanticColors.feedbackInfo} />
        <Text style={styles.auditNoticeText}>
          This confirmation will be recorded in the audit trail
        </Text>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'review':
        return renderReviewStep();
      case 'pin':
        return renderPinStep();
      case '2fa':
        return render2FAStep();
      case 'final':
        return renderFinalStep();
      default:
        return null;
    }
  };

  const getConfirmButtonText = () => {
    if (isLoading) return 'Processing...';

    switch (currentStep) {
      case 'review':
        if (requirements?.requiresPin) return 'Continue to PIN';
        if (requirements?.requires2FA) return 'Continue to 2FA';
        return 'Confirm & Execute';
      case 'pin':
        if (requirements?.requires2FA) return 'Verify PIN & Continue';
        return 'Verify PIN & Execute';
      case '2fa':
        return 'Verify & Execute';
      case 'final':
        return 'Execute Action';
      default:
        return 'Confirm';
    }
  };

  // ----------------------------------------
  // MAIN RENDER
  // ----------------------------------------

  if (!action) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Execution Confirmation</Text>
              <Text style={styles.headerSubtitle}>Final verification required</Text>
            </View>
            <Pressable onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
          </View>

          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            {['Review', 'Verify', 'Confirm'].map((label, index) => {
              const stepIndex = currentStep === 'review' ? 0 :
                              currentStep === 'pin' || currentStep === '2fa' ? 1 : 2;
              const isActive = index === stepIndex;
              const isCompleted = index < stepIndex;

              return (
                <View key={label} style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    isActive && styles.stepDotActive,
                    isCompleted && styles.stepDotCompleted,
                  ]}>
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={12} color={Palette.white} />
                    ) : (
                      <Text style={[
                        styles.stepNumber,
                        isActive && styles.stepNumberActive,
                      ]}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    isActive && styles.stepLabelActive,
                  ]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Content */}
          <View style={styles.content}>
            {renderCurrentStep()}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.footerButton, styles.cancelButton]}
              onPress={handleCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.footerButton,
                styles.confirmButton,
                currentStep === 'final' && styles.confirmButtonDanger,
                isLoading && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Palette.white} />
              ) : (
                <>
                  <Text style={styles.confirmButtonText}>{getConfirmButtonText()}</Text>
                  {currentStep === 'final' && (
                    <Ionicons name="checkmark-circle" size={18} color={Palette.white} />
                  )}
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
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
  closeButton: {
    padding: Spacing.xs,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.md,
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
  stepNumber: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  stepNumberActive: {
    color: Palette.white,
  },
  stepLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
  },
  stepLabelActive: {
    color: SemanticColors.actionPrimary,
    fontFamily: TYPE.titleFamily,
  },
  content: {
    padding: Spacing.md,
    maxHeight: 500,
  },
  warningHeader: {
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: RADIUS.md,
    marginBottom: Spacing.md,
    gap: 8,
  },
  warningTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  summarySection: {
    gap: 8,
    marginBottom: Spacing.md,
  },
  actionTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
  },
  actionDescription: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
  },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    marginTop: 8,
  },
  amountLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
  },
  amountValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: RADIUS.sm,
    marginBottom: Spacing.md,
  },
  warningText: {
    flex: 1,
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.captionSize,
  },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackInfoBg,
    borderRadius: RADIUS.sm,
    marginBottom: Spacing.md,
  },
  reasonText: {
    flex: 1,
    color: SemanticColors.feedbackInfo,
    fontSize: TYPE.labelSize,
  },
  impactSection: {
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    marginBottom: Spacing.md,
  },
  impactTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  impactText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  securitySection: {
    gap: 8,
  },
  securityTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
  securityItems: {
    gap: 4,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  securityItemText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
  },
  securityItemRequired: {
    color: SemanticColors.feedbackSuccess,
    fontFamily: TYPE.labelFamily,
  },
  verificationSection: {
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  verificationHeader: {
    alignItems: 'center',
    gap: 8,
  },
  verificationTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  verificationSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
    textAlign: 'center',
  },
  pinInputContainer: {
    width: '100%',
    maxWidth: 200,
  },
  pinInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
    textAlign: 'center',
    color: SemanticColors.textPrimary,
    letterSpacing: 8,
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: RADIUS.sm,
  },
  errorText: {
    color: SemanticColors.feedbackError,
    fontSize: TYPE.captionSize,
  },
  finalSection: {
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  finalHeader: {
    alignItems: 'center',
    gap: 8,
  },
  finalTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
  },
  finalSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
    textAlign: 'center',
  },
  finalSummary: {
    width: '100%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    gap: 4,
  },
  finalSummaryLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
    marginTop: 8,
  },
  finalSummaryValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
  },
  auditNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackInfoBg,
    borderRadius: RADIUS.sm,
  },
  auditNoticeText: {
    color: SemanticColors.feedbackInfo,
    fontSize: TYPE.labelSize,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
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
  cancelButton: {
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  cancelButtonText: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  confirmButton: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  confirmButtonDanger: {
    backgroundColor: SemanticColors.feedbackError,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: Palette.white,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
});
