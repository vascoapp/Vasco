// =============================================================================
// RECOMMENDATION FEEDBACK COMPONENT
// =============================================================================
// Allows contractors to provide feedback on AI recommendations
// Every interaction teaches the system and improves future recommendations
// =============================================================================

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import { pricingAgent } from '../../intelligence/pricingAgent';
import { trackUserAction } from '../../intelligence/intelligenceEngine';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// TYPES
// ============================================

export interface Recommendation {
  id: string;
  type: 'pricing' | 'supplier' | 'timing' | 'material' | 'product' | 'general';
  title: string;
  description: string;
  confidence: number;
  potentialSavings?: number;
  urgency?: 'immediate' | 'today' | 'this_week' | 'low';
  metadata?: Record<string, unknown>;
}

interface FeedbackReason {
  id: string;
  label: string;
  icon: IconName;
}

const REJECTION_REASONS: FeedbackReason[] = [
  { id: 'wrong_price', label: 'Prijs klopt niet', icon: 'cash-outline' },
  { id: 'wrong_supplier', label: 'Andere leverancier', icon: 'storefront-outline' },
  { id: 'wrong_product', label: 'Verkeerd product', icon: 'cube-outline' },
  { id: 'not_relevant', label: 'Niet relevant', icon: 'close-circle-outline' },
  { id: 'already_bought', label: 'Al gekocht', icon: 'checkmark-circle-outline' },
  { id: 'quality_concern', label: 'Kwaliteitszorg', icon: 'shield-outline' },
];

const ACCEPTANCE_CONTEXT: FeedbackReason[] = [
  { id: 'bought_exact', label: 'Precies dit gekocht', icon: 'checkmark-done-outline' },
  { id: 'bought_similar', label: 'Vergelijkbaar gekocht', icon: 'swap-horizontal-outline' },
  { id: 'will_buy_later', label: 'Koop later', icon: 'time-outline' },
  { id: 'good_tip', label: 'Goede tip', icon: 'bulb-outline' },
];

// ============================================
// FEEDBACK CARD COMPONENT
// ============================================

interface RecommendationFeedbackCardProps {
  recommendation: Recommendation;
  onAccept?: (id: string, context?: string, actualPrice?: number) => void;
  onReject?: (id: string, reason?: string, feedback?: string) => void;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

export function RecommendationFeedbackCard({
  recommendation,
  onAccept,
  onReject,
  onDismiss,
  compact = false,
}: RecommendationFeedbackCardProps) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'accept' | 'reject' | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [actualPrice, setActualPrice] = useState('');

  const getTypeConfig = (type: Recommendation['type']) => {
    switch (type) {
      case 'pricing':
        return { icon: 'cash' as IconName, color: SemanticColors.feedbackSuccess, label: 'Prijstip' };
      case 'supplier':
        return { icon: 'storefront' as IconName, color: Palette.hermesOrange, label: 'Leverancier' };
      case 'timing':
        return { icon: 'time' as IconName, color: Palette.terracotta, label: 'Timing' };
      case 'material':
        return { icon: 'cube' as IconName, color: Palette.blue500, label: 'Materiaal' };
      case 'product':
        return { icon: 'pricetag' as IconName, color: Palette.green500, label: 'Product' };
      default:
        return { icon: 'bulb' as IconName, color: SemanticColors.actionPrimary, label: 'Tip' };
    }
  };

  const getUrgencyConfig = (urgency?: Recommendation['urgency']) => {
    switch (urgency) {
      case 'immediate':
        return { label: 'Nu actie', color: SemanticColors.feedbackError };
      case 'today':
        return { label: 'Vandaag', color: SemanticColors.feedbackWarning };
      case 'this_week':
        return { label: 'Deze week', color: Palette.hermesOrange };
      default:
        return null;
    }
  };

  const config = getTypeConfig(recommendation.type);
  const urgencyConfig = getUrgencyConfig(recommendation.urgency);

  const handleAcceptPress = () => {
    setFeedbackType('accept');
    setShowFeedbackModal(true);
  };

  const handleRejectPress = () => {
    setFeedbackType('reject');
    setShowFeedbackModal(true);
  };

  const handleSubmitFeedback = useCallback(() => {
    if (feedbackType === 'accept') {
      const price = actualPrice ? parseFloat(actualPrice.replace(',', '.')) : undefined;
      onAccept?.(recommendation.id, selectedReason || undefined, price);

      // Track acceptance for intelligence
      trackUserAction('ai_recommendation_accepted', {
        recommendationId: recommendation.id,
        type: recommendation.type,
        context: selectedReason,
        actualPrice: price,
        confidence: recommendation.confidence,
      });
    } else if (feedbackType === 'reject') {
      onReject?.(recommendation.id, selectedReason || undefined, feedbackText || undefined);

      // Track rejection for intelligence
      trackUserAction('ai_recommendation_rejected', {
        recommendationId: recommendation.id,
        type: recommendation.type,
        reason: selectedReason,
        feedback: feedbackText,
        confidence: recommendation.confidence,
      });
    }

    // Reset state
    setShowFeedbackModal(false);
    setSelectedReason(null);
    setFeedbackText('');
    setActualPrice('');
    setFeedbackType(null);
  }, [feedbackType, selectedReason, feedbackText, actualPrice, recommendation, onAccept, onReject]);

  const handleQuickDismiss = () => {
    onDismiss?.(recommendation.id);
    trackUserAction('ai_recommendation_dismissed', {
      recommendationId: recommendation.id,
      type: recommendation.type,
    });
  };

  return (
    <>
      <View style={[styles.card, compact && styles.cardCompact]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: config.color + '15' }]}>
            <Ionicons name={config.icon} size={18} color={config.color} />
          </View>
          <View style={styles.cardHeaderContent}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.typeLabel}>{config.label}</Text>
              {urgencyConfig && (
                <View style={[styles.urgencyBadge, { backgroundColor: urgencyConfig.color + '15' }]}>
                  <Text style={[styles.urgencyText, { color: urgencyConfig.color }]}>
                    {urgencyConfig.label}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.confidenceText}>
              {Math.round(recommendation.confidence * 100)}% zeker
            </Text>
          </View>
          {!compact && (
            <Pressable onPress={handleQuickDismiss} hitSlop={8}>
              <Ionicons name="close" size={20} color={SemanticColors.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* Content */}
        <Text style={styles.cardTitle}>{recommendation.title}</Text>
        <Text style={styles.cardDescription}>{recommendation.description}</Text>

        {/* Savings highlight */}
        {recommendation.potentialSavings && recommendation.potentialSavings > 0 && (
          <View style={styles.savingsRow}>
            <Ionicons name="trending-down" size={16} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.savingsText}>
              Bespaar {formatCurrency(recommendation.potentialSavings)}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          <Pressable style={styles.rejectButton} onPress={handleRejectPress}>
            <Ionicons name="close-outline" size={18} color={SemanticColors.textSecondary} />
            <Text style={styles.rejectButtonText}>Niet nuttig</Text>
          </Pressable>
          <Pressable style={styles.acceptButton} onPress={handleAcceptPress}>
            <Ionicons name="checkmark-outline" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Nuttig</Text>
          </Pressable>
        </View>

        {/* Learning indicator */}
        <View style={styles.learningIndicator}>
          <Ionicons name="sparkles" size={12} color={SemanticColors.textTertiary} />
          <Text style={styles.learningText}>
            Je feedback verbetert toekomstige aanbevelingen
          </Text>
        </View>
      </View>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowFeedbackModal(false)} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {feedbackType === 'accept' ? 'Feedback geven' : 'Waarom niet nuttig?'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
            {/* Context info */}
            <View style={styles.contextCard}>
              <View style={[styles.typeIcon, { backgroundColor: config.color + '15' }]}>
                <Ionicons name={config.icon} size={18} color={config.color} />
              </View>
              <View style={styles.contextContent}>
                <Text style={styles.contextTitle}>{recommendation.title}</Text>
                <Text style={styles.contextDescription} numberOfLines={2}>
                  {recommendation.description}
                </Text>
              </View>
            </View>

            {/* Reason selection */}
            <Text style={styles.sectionTitle}>
              {feedbackType === 'accept' ? 'Wat deed je met deze tip?' : 'Selecteer een reden'}
            </Text>
            <View style={styles.reasonGrid}>
              {(feedbackType === 'accept' ? ACCEPTANCE_CONTEXT : REJECTION_REASONS).map((reason) => (
                <Pressable
                  key={reason.id}
                  style={[
                    styles.reasonButton,
                    selectedReason === reason.id && styles.reasonButtonSelected,
                  ]}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <Ionicons
                    name={reason.icon}
                    size={20}
                    color={selectedReason === reason.id ? Palette.hermesOrange : SemanticColors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.reasonLabel,
                      selectedReason === reason.id && styles.reasonLabelSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Actual price input (for accept) */}
            {feedbackType === 'accept' && selectedReason === 'bought_exact' && (
              <View style={styles.priceInputSection}>
                <Text style={styles.inputLabel}>Werkelijke prijs (optioneel)</Text>
                <View style={styles.priceInputRow}>
                  <Text style={styles.pricePrefix}>€</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={actualPrice}
                    onChangeText={setActualPrice}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={SemanticColors.textTertiary}
                  />
                </View>
                <Text style={styles.inputHint}>
                  Dit helpt ons prijzen nauwkeuriger bij te houden
                </Text>
              </View>
            )}

            {/* Additional feedback text (for reject) */}
            {feedbackType === 'reject' && (
              <View style={styles.feedbackSection}>
                <Text style={styles.inputLabel}>Extra feedback (optioneel)</Text>
                <TextInput
                  style={styles.feedbackInput}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="Vertel ons meer over waarom dit niet relevant was..."
                  placeholderTextColor={SemanticColors.textTertiary}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}
          </ScrollView>

          {/* Submit button */}
          <View style={styles.modalFooter}>
            <Pressable
              style={[
                styles.submitButton,
                !selectedReason && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitFeedback}
              disabled={!selectedReason}
            >
              <Text style={styles.submitButtonText}>Feedback versturen</Text>
            </Pressable>
            <View style={styles.privacyNote}>
              <Ionicons name="shield-checkmark" size={12} color={SemanticColors.textTertiary} />
              <Text style={styles.privacyText}>
                Feedback wordt anoniem verwerkt om het systeem te verbeteren
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ============================================
// FEEDBACK LIST COMPONENT
// ============================================

interface RecommendationFeedbackListProps {
  recommendations: Recommendation[];
  onAccept?: (id: string, context?: string, actualPrice?: number) => void;
  onReject?: (id: string, reason?: string, feedback?: string) => void;
  onDismiss?: (id: string) => void;
  emptyMessage?: string;
  compact?: boolean;
}

export function RecommendationFeedbackList({
  recommendations,
  onAccept,
  onReject,
  onDismiss,
  emptyMessage = 'Geen aanbevelingen',
  compact = false,
}: RecommendationFeedbackListProps) {
  if (recommendations.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="checkmark-circle" size={48} color={SemanticColors.feedbackSuccess} />
        <Text style={styles.emptyTitle}>{emptyMessage}</Text>
        <Text style={styles.emptyDescription}>
          Nieuwe tips verschijnen hier zodra ze beschikbaar zijn
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Aanbevelingen voor jou</Text>
        <View style={styles.listBadge}>
          <Text style={styles.listBadgeText}>{recommendations.length}</Text>
        </View>
      </View>
      {recommendations.map((rec) => (
        <RecommendationFeedbackCard
          key={rec.id}
          recommendation={rec}
          onAccept={onAccept}
          onReject={onReject}
          onDismiss={onDismiss}
          compact={compact}
        />
      ))}
    </View>
  );
}

// ============================================
// QUICK FEEDBACK INLINE COMPONENT
// ============================================

interface QuickFeedbackProps {
  recommendationId: string;
  label: string;
  onFeedback: (helpful: boolean) => void;
}

export function QuickFeedback({ recommendationId, label, onFeedback }: QuickFeedbackProps) {
  const [submitted, setSubmitted] = useState(false);

  const handleFeedback = (helpful: boolean) => {
    setSubmitted(true);
    onFeedback(helpful);
    trackUserAction(helpful ? 'quick_feedback_positive' : 'quick_feedback_negative', {
      recommendationId,
      label,
    });
  };

  if (submitted) {
    return (
      <View style={styles.quickFeedbackSubmitted}>
        <Ionicons name="checkmark-circle" size={14} color={SemanticColors.feedbackSuccess} />
        <Text style={styles.quickFeedbackThanks}>Bedankt!</Text>
      </View>
    );
  }

  return (
    <View style={styles.quickFeedback}>
      <Text style={styles.quickFeedbackLabel}>{label}</Text>
      <View style={styles.quickFeedbackButtons}>
        <Pressable
          style={styles.quickFeedbackButton}
          onPress={() => handleFeedback(true)}
          hitSlop={8}
        >
          <Ionicons name="thumbs-up-outline" size={16} color={SemanticColors.feedbackSuccess} />
        </Pressable>
        <Pressable
          style={styles.quickFeedbackButton}
          onPress={() => handleFeedback(false)}
          hitSlop={8}
        >
          <Ionicons name="thumbs-down-outline" size={16} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Card styles
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  cardCompact: {
    padding: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urgencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  confidenceText: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
  },
  rejectButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 8,
  },
  acceptButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  learningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  learningText: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  modalClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  contextCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  contextContent: {
    flex: 1,
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 2,
  },
  contextDescription: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    minWidth: '45%',
  },
  reasonButtonSelected: {
    borderColor: Palette.hermesOrange,
    backgroundColor: Palette.hermesOrange + '10',
  },
  reasonLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  reasonLabelSelected: {
    color: Palette.hermesOrange,
  },
  priceInputSection: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  pricePrefix: {
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 14,
    fontSize: 16,
    color: SemanticColors.textPrimary,
  },
  inputHint: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },
  feedbackSection: {
    gap: Spacing.xs,
  },
  feedbackInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: SemanticColors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    padding: Spacing.lg,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: Spacing.sm,
  },
  submitButton: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: SemanticColors.iconDisabled,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  privacyText: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // List styles
  listContainer: {
    gap: Spacing.sm,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listBadge: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  listBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  emptyDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },

  // Quick feedback
  quickFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
  },
  quickFeedbackLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  quickFeedbackButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickFeedbackButton: {
    padding: 4,
  },
  quickFeedbackSubmitted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 8,
  },
  quickFeedbackThanks: {
    fontSize: 12,
    fontWeight: '500',
    color: SemanticColors.feedbackSuccess,
  },
});
