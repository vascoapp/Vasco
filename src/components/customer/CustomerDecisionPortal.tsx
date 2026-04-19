// =============================================================================
// CUSTOMER DECISION PORTAL
// =============================================================================
// Customer-facing interface for viewing and submitting project decisions
// Simple, clean UI focused on ease of use for non-technical users
// =============================================================================

import { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { hapticSuccess } from '../../utils/haptics';
import { formatCurrency } from '../../i18n/formatting';
import type {
  CustomerPortalData,
  CustomerPortalCategory,
  CustomerPortalItem,
  CustomerDecisionSubmission,
} from '../../types/customerPortal';
import type { DecisionOption } from '../../types/decisions';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../../config/paymentMethods';
import type { Country } from '../../context/AuthContext';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MAIN PORTAL COMPONENT
// ============================================

interface CustomerDecisionPortalProps {
  portalData: CustomerPortalData;
  onSubmitDecision: (submission: CustomerDecisionSubmission) => void;
  onActivityLog?: (action: string, metadata?: Record<string, unknown>) => void;
}

export function CustomerDecisionPortal({
  portalData,
  onSubmitDecision,
  onActivityLog,
}: CustomerDecisionPortalProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const completionPercent = Math.round(
    (portalData.completedDecisions / portalData.totalDecisions) * 100
  );

  useEffect(() => {
    onActivityLog?.('portal_accessed');
  }, []);

  const accentColor = portalData.accentColor || Palette.hermesOrange;

  if (activeCategory) {
    const category = portalData.categories.find((c) => c.id === activeCategory);
    if (category) {
      return (
        <CategoryDetailView
          category={category}
          portalData={portalData}
          expandedItem={expandedItem}
          onExpandItem={setExpandedItem}
          onBack={() => setActiveCategory(null)}
          onSubmitDecision={onSubmitDecision}
          onActivityLog={onActivityLog}
          accentColor={accentColor}
        />
      );
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.contractorInfo}>
          <View style={[styles.contractorAvatar, { backgroundColor: accentColor + '20' }]}>
            <Text style={[styles.contractorInitials, { color: accentColor }]}>
              {portalData.contractorName.split(' ').map((n) => n[0]).join('')}
            </Text>
          </View>
          <View>
            <Text style={styles.contractorName}>{portalData.contractorName}</Text>
            {portalData.contractorCompany && (
              <Text style={styles.companyName}>{portalData.contractorCompany}</Text>
            )}
          </View>
        </View>
        {portalData.contractorPhone && (
          <Pressable
            style={styles.contactButton}
            onPress={() => Linking.openURL(`tel:${portalData.contractorPhone}`)}
          >
            <Ionicons name="call" size={20} color={SemanticColors.feedbackSuccess} />
          </Pressable>
        )}
      </View>

      {/* Project Info */}
      <View style={styles.projectCard}>
        <Text style={styles.projectName}>{portalData.projectName}</Text>
        <View style={styles.projectDates}>
          <View style={styles.dateItem}>
            <Ionicons name="calendar-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={styles.dateText}>
              Start: {new Date(portalData.projectStartDate).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
          {portalData.estimatedCompletionDate && (
            <View style={styles.dateItem}>
              <Ionicons name="flag-outline" size={16} color={SemanticColors.textSecondary} />
              <Text style={styles.dateText}>
                Klaar: {new Date(portalData.estimatedCompletionDate).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Uw Keuzes</Text>
          <Text style={styles.progressPercent}>{completionPercent}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${completionPercent}%`, backgroundColor: accentColor }]}
          />
        </View>
        <View style={styles.progressStats}>
          <View style={styles.progressStat}>
            <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.progressStatText}>{portalData.completedDecisions} gekozen</Text>
          </View>
          {portalData.overdueDecisions > 0 && (
            <View style={styles.progressStat}>
              <Ionicons name="alert-circle" size={18} color={SemanticColors.feedbackError} />
              <Text style={[styles.progressStatText, { color: SemanticColors.feedbackError }]}>
                {portalData.overdueDecisions} te laat
              </Text>
            </View>
          )}
          <View style={styles.progressStat}>
            <Ionicons name="time" size={18} color={SemanticColors.textTertiary} />
            <Text style={styles.progressStatText}>
              {portalData.totalDecisions - portalData.completedDecisions} nog te doen
            </Text>
          </View>
        </View>
      </View>

      {/* Urgent Items Banner */}
      {portalData.overdueDecisions > 0 && (
        <Pressable
          style={styles.urgentBanner}
          onPress={() => {
            const overdueCategory = portalData.categories.find((c) =>
              c.items.some((i) => i.isOverdue && i.status === 'pending')
            );
            if (overdueCategory) setActiveCategory(overdueCategory.id);
          }}
        >
          <View style={styles.urgentIcon}>
            <Ionicons name="alert-circle" size={24} color={SemanticColors.feedbackError} />
          </View>
          <View style={styles.urgentContent}>
            <Text style={styles.urgentTitle}>Actie vereist</Text>
            <Text style={styles.urgentText}>
              {portalData.overdueDecisions} keuze{portalData.overdueDecisions > 1 ? 's' : ''} moeten
              nog gemaakt worden om vertraging te voorkomen
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={SemanticColors.feedbackError} />
        </Pressable>
      )}

      {/* Categories */}
      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Categorieën</Text>
        {portalData.categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            accentColor={accentColor}
            onPress={() => {
              setActiveCategory(category.id);
              onActivityLog?.('category_viewed', { categoryId: category.id });
            }}
          />
        ))}
      </View>

      {/* Payment Section — informational badges + Pay now button */}
      {portalData.paymentLink && portalData.paymentStatus !== 'paid' && (
        <PaymentSection
          portalData={portalData}
          accentColor={accentColor}
          onActivityLog={onActivityLog}
        />
      )}

      {/* Payment Success State */}
      {portalData.paymentStatus === 'paid' && (
        <View style={styles.paymentSuccessCard}>
          <View style={styles.paymentSuccessIconWrap}>
            <Ionicons name="checkmark-circle" size={48} color={SemanticColors.feedbackSuccess} />
          </View>
          <Text style={styles.paymentSuccessTitle}>Betaling ontvangen</Text>
          <Text style={styles.paymentSuccessSubtext}>
            Bedankt! Uw betaling is succesvol verwerkt.
          </Text>
          <View style={styles.paymentSuccessDivider} />
          <View style={styles.paymentSuccessDetail}>
            <Text style={styles.paymentSuccessDetailLabel}>Bedrag</Text>
            <Text style={styles.paymentSuccessDetailValue}>
              {formatCurrency(portalData.quoteAmount ?? 0, (portalData.contractorCountry ?? 'NL') as Country)}
            </Text>
          </View>
        </View>
      )}

      {/* Help Footer */}
      <View style={styles.helpFooter}>
        <Ionicons name="help-circle-outline" size={20} color={SemanticColors.textTertiary} />
        <Text style={styles.helpText}>
          Heeft u vragen? Neem contact op met {portalData.contractorName}
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ============================================
// PAYMENT SECTION
// ============================================

interface PaymentSectionProps {
  portalData: CustomerPortalData;
  accentColor: string;
  onActivityLog?: (action: string, metadata?: Record<string, unknown>) => void;
}

function PaymentSection({ portalData, accentColor, onActivityLog }: PaymentSectionProps) {
  const isPartial = portalData.paymentStatus === 'partial';
  const allDecisionsComplete =
    portalData.completedDecisions >= portalData.totalDecisions;

  const fmtAmount = (n: number) =>
    formatCurrency(n, (portalData.contractorCountry ?? 'NL') as Country);

  const payAmount = portalData.depositAmount ?? portalData.quoteAmount ?? 0;
  const totalLabel = portalData.quoteAmount ? fmtAmount(portalData.quoteAmount) : '';
  const depositLabel = portalData.depositAmount ? fmtAmount(portalData.depositAmount) : '';
  const paidLabel = portalData.paidAmount ? fmtAmount(portalData.paidAmount) : '';
  const hasDeposit =
    portalData.depositAmount != null &&
    portalData.depositAmount !== portalData.quoteAmount;

  const handlePayNow = () => {
    if (portalData.paymentLink) {
      onActivityLog?.('payment_started', {
        amount: payAmount,
        method: 'payment_link',
      });
      Linking.openURL(portalData.paymentLink);
    }
  };

  return (
    <View style={styles.paymentSection}>
      {/* Header */}
      <View style={styles.paymentSectionHeader}>
        <View style={[styles.paymentIconWrap, { backgroundColor: accentColor + '15' }]}>
          <Ionicons name="card-outline" size={24} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.paymentSectionTitle}>Betaling</Text>
          {isPartial && paidLabel && (
            <Text style={styles.paymentSubtext}>{paidLabel} van {totalLabel} betaald</Text>
          )}
        </View>
        <View
          style={[
            styles.paymentBadge,
            {
              backgroundColor: isPartial
                ? SemanticColors.feedbackWarning + '18'
                : SemanticColors.feedbackError + '12',
            },
          ]}
        >
          <Text
            style={[
              styles.paymentBadgeText,
              {
                color: isPartial
                  ? SemanticColors.feedbackWarning
                  : SemanticColors.feedbackError,
              },
            ]}
          >
            {isPartial ? 'Deels betaald' : 'Openstaand'}
          </Text>
        </View>
      </View>

      {/* Amount breakdown */}
      <View style={styles.paymentAmounts}>
        <View style={styles.paymentAmountRow}>
          <Text style={styles.paymentAmountLabel}>Offertebedrag</Text>
          <Text style={styles.paymentAmountValue}>{totalLabel}</Text>
        </View>
        {hasDeposit && (
          <View style={styles.paymentAmountRow}>
            <Text style={styles.paymentAmountLabel}>Aanbetaling</Text>
            <Text style={[styles.paymentAmountValue, { color: accentColor }]}>
              {depositLabel}
            </Text>
          </View>
        )}
        {isPartial && portalData.paidAmount != null && portalData.paidAmount > 0 && (
          <View style={styles.paymentAmountRow}>
            <Text style={styles.paymentAmountLabel}>Reeds betaald</Text>
            <Text style={[styles.paymentAmountValue, { color: SemanticColors.feedbackSuccess }]}>
              {paidLabel}
            </Text>
          </View>
        )}
      </View>

      {/* All decisions complete banner */}
      {allDecisionsComplete && (
        <View style={styles.paymentReadyBanner}>
          <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.paymentReadyText}>
            Al uw keuzes zijn opgeslagen. U kunt nu betalen.
          </Text>
        </View>
      )}

      {/* Pay Now button */}
      {portalData.paymentLink && (
        <Pressable
          style={[styles.payNowButton, { backgroundColor: accentColor }]}
          onPress={handlePayNow}
          accessibilityLabel={hasDeposit ? `Pay deposit ${depositLabel}` : `Pay now ${totalLabel}`}
          accessibilityRole="button"
        >
          <Ionicons name="lock-closed" size={18} color="#fff" />
          <Text style={styles.payNowButtonText}>
            {hasDeposit
              ? `Aanbetaling doen — ${depositLabel}`
              : `Nu betalen — ${totalLabel}`}
          </Text>
        </Pressable>
      )}

      {/* Available payment methods — branded horizontal scroll */}
      {portalData.paymentMethods && portalData.paymentMethods.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.paymentMethodsScroll}
        >
          {portalData.paymentMethods.map((method, i) => {
            const brandColor = getPaymentBrandColor(method.name);
            return (
              <View
                key={i}
                style={[
                  styles.paymentMethodChip,
                  { borderColor: brandColor + '30' },
                ]}
                accessibilityLabel={`${method.name} payment method`}
              >
                <View style={[styles.paymentMethodDot, { backgroundColor: brandColor }]} />
                <Text style={styles.paymentMethodText}>{method.name}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Security badge */}
      <View style={styles.securityBadge}>
        <Ionicons name="shield-checkmark" size={14} color={SemanticColors.feedbackSuccess} />
        <Text style={styles.securityBadgeText}>
          Secure payment via {portalData.contractorCountry === 'UK' ? 'Stripe' : 'Mollie'}
        </Text>
      </View>
    </View>
  );
}

// ============================================
// CATEGORY CARD
// ============================================

interface CategoryCardProps {
  category: CustomerPortalCategory;
  accentColor: string;
  onPress: () => void;
}

function CategoryCard({ category, accentColor, onPress }: CategoryCardProps) {
  const progressPercent = Math.round((category.completedCount / category.totalCount) * 100);
  const hasOverdue = category.items.some((i) => i.isOverdue && i.status === 'pending');

  const getIcon = (): IconName => {
    switch (category.icon) {
      case 'water': return 'water';
      case 'grid': return 'grid';
      case 'flash': return 'flash';
      case 'cube': return 'cube';
      case 'color-palette': return 'color-palette';
      default: return 'list';
    }
  };

  return (
    <Pressable
      style={[styles.categoryCard, hasOverdue && styles.categoryCardOverdue]}
      onPress={onPress}
    >
      <View style={[styles.categoryIcon, { backgroundColor: accentColor + '15' }]}>
        <Ionicons name={getIcon()} size={24} color={accentColor} />
      </View>
      <View style={styles.categoryContent}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryName}>{category.name}</Text>
          {hasOverdue && (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>Te laat</Text>
            </View>
          )}
        </View>
        <View style={styles.categoryProgress}>
          <View style={styles.categoryProgressBar}>
            <View
              style={[
                styles.categoryProgressFill,
                { width: `${progressPercent}%`, backgroundColor: accentColor },
              ]}
            />
          </View>
          <Text style={styles.categoryCount}>
            {category.completedCount}/{category.totalCount}
          </Text>
        </View>
        <Text style={styles.categoryDue}>
          Deadline: {new Date(category.dueDate).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
          })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

// ============================================
// CATEGORY DETAIL VIEW
// ============================================

interface CategoryDetailViewProps {
  category: CustomerPortalCategory;
  portalData: CustomerPortalData;
  expandedItem: string | null;
  onExpandItem: (itemId: string | null) => void;
  onBack: () => void;
  onSubmitDecision: (submission: CustomerDecisionSubmission) => void;
  onActivityLog?: (action: string, metadata?: Record<string, unknown>) => void;
  accentColor: string;
}

function CategoryDetailView({
  category,
  portalData,
  expandedItem,
  onExpandItem,
  onBack,
  onSubmitDecision,
  onActivityLog,
  accentColor,
}: CategoryDetailViewProps) {
  const pendingItems = category.items.filter((i) => i.status === 'pending');
  const completedItems = category.items.filter((i) => i.status === 'decided');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.categoryDetailHeader}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.categoryDetailTitle}>
          <Text style={styles.categoryDetailName}>{category.name}</Text>
          <Text style={styles.categoryDetailCount}>
            {category.completedCount} van {category.totalCount} gekozen
          </Text>
        </View>
      </View>

      <ScrollView style={styles.categoryDetailContent}>
        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsSectionTitle}>Nog te kiezen</Text>
            {pendingItems.map((item) => (
              <DecisionItemCard
                key={item.id}
                item={item}
                isExpanded={expandedItem === item.id}
                onToggle={() => {
                  onExpandItem(expandedItem === item.id ? null : item.id);
                  if (expandedItem !== item.id) {
                    onActivityLog?.('item_viewed', { itemId: item.id });
                  }
                }}
                onSubmit={(value, notes, linkedProduct, photoUrls) => {
                  onSubmitDecision({
                    itemId: item.id,
                    trackerId: portalData.accessToken,
                    customerId: 'customer',
                    value,
                    notes,
                    photoUrls,
                    deviceType: Platform.OS === 'ios' || Platform.OS === 'android' ? 'mobile' : 'desktop',
                    linkedProduct,
                    submittedAt: new Date().toISOString(),
                  });
                  hapticSuccess();
                  onExpandItem(null);
                  onActivityLog?.('decision_made', { itemId: item.id, value });

                  // Show confirmation toast
                  const remaining = pendingItems.length - 1;
                  Alert.alert(
                    'Keuze opgeslagen',
                    remaining > 0
                      ? `Nog ${remaining} keuze${remaining > 1 ? 's' : ''} te maken.`
                      : 'Alle keuzes zijn gemaakt! Uw aannemer wordt op de hoogte gesteld.',
                  );
                }}
                accentColor={accentColor}
                contractorCountry={portalData.contractorCountry}
                accessToken={portalData.accessToken}
              />
            ))}
          </View>
        )}

        {/* Completed Items */}
        {completedItems.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsSectionTitle}>Al gekozen</Text>
            {completedItems.map((item) => (
              <CompletedItemCard key={item.id} item={item} accentColor={accentColor} />
            ))}
          </View>
        )}

        {/* Free-text question — Decagon pattern. Low-stakes gets an AI auto-reply,
            high-stakes goes to the contractor's VascoCard queue for approval. */}
        <AskAQuestionCard
          accentColor={accentColor}
          trackerAccessToken={portalData.accessToken}
          contractorCountry={portalData.contractorCountry}
          portalData={portalData}
        />

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================
// ASK A QUESTION CARD (Decagon pattern)
// ============================================

function AskAQuestionCard({
  accentColor,
  trackerAccessToken,
  contractorCountry,
  portalData,
}: {
  accentColor: string;
  trackerAccessToken: string;
  contractorCountry?: string;
  portalData: CustomerPortalData;
}) {
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lang = (
    contractorCountry === 'DE' ? 'de'
    : contractorCountry === 'FR' ? 'fr'
    : contractorCountry === 'ES' ? 'es'
    : contractorCountry === 'IT' ? 'it'
    : contractorCountry === 'UK' ? 'en'
    : 'nl'
  ) as 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

  // Prior decisions to ground the AI on what the customer has already picked.
  const decisions = portalData.categories.flatMap((c) =>
    c.items
      .filter((i) => i.status === 'decided' && i.value != null)
      .slice(0, 10)
      .map((i) => ({
        item: i.name,
        value: Array.isArray(i.value) ? i.value.join(', ') : String(i.value),
      })),
  );

  const submit = async () => {
    const text = question.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { submitCustomerQuestion } = await import('../../services/customerQuestionService');
      const result = await submitCustomerQuestion({
        trackerAccessToken,
        question: text,
        language: lang,
        context: {
          businessName: portalData.contractorName,
          contractorPhone: portalData.contractorPhone,
          jobTitle: portalData.projectName,
          decisions,
        },
      });
      if (!result.ok) {
        setError(result.error ?? 'Kon vraag niet versturen');
        return;
      }
      if (result.autoReply) {
        setReply(result.autoReply);
      } else {
        setPending(true);
      }
      setQuestion('');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setReply(null);
    setPending(false);
    setError(null);
    setQuestion('');
  };

  return (
    <View style={styles.askCard}>
      <View style={styles.askHeader}>
        <Ionicons name="chatbubble-ellipses" size={18} color={accentColor} />
        <Text style={styles.askTitle}>Een vraag stellen</Text>
      </View>
      <Text style={styles.askSubtitle}>
        Vraag iets over de planning, locatie of werkzaamheden — je krijgt direct antwoord of de aannemer bevestigt snel.
      </Text>

      {reply && (
        <View style={styles.askReplyCard}>
          <Ionicons name="sparkles" size={14} color={accentColor} />
          <Text style={styles.askReplyText}>{reply}</Text>
        </View>
      )}

      {pending && (
        <View style={[styles.askReplyCard, { backgroundColor: SemanticColors.feedbackInfo + '10' }]}>
          <Ionicons name="time-outline" size={14} color={SemanticColors.feedbackInfo} />
          <Text style={[styles.askReplyText, { color: SemanticColors.feedbackInfo }]}>
            Vraag verstuurd. De aannemer komt zo met een antwoord.
          </Text>
        </View>
      )}

      {error && (
        <View style={[styles.askReplyCard, { backgroundColor: SemanticColors.feedbackError + '10' }]}>
          <Ionicons name="alert-circle-outline" size={14} color={SemanticColors.feedbackError} />
          <Text style={[styles.askReplyText, { color: SemanticColors.feedbackError }]}>{error}</Text>
        </View>
      )}

      {!reply && !pending && (
        <>
          <TextInput
            style={[styles.textInput, { minHeight: 80 }]}
            placeholder="Typ je vraag… bijv. 'hoe laat komen jullie dinsdag?' of 'kun je ook de kraan vervangen?'"
            placeholderTextColor={SemanticColors.textTertiary}
            value={question}
            onChangeText={setQuestion}
            multiline
            editable={!submitting}
            maxLength={1000}
          />
          <Pressable
            style={[styles.submitButton, { backgroundColor: accentColor }, (!question.trim() || submitting) && styles.submitButtonDisabled]}
            onPress={submit}
            disabled={!question.trim() || submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Versturen…' : 'Stel vraag'}
            </Text>
          </Pressable>
        </>
      )}

      {(reply || pending) && (
        <Pressable onPress={reset} style={{ alignSelf: 'center', paddingVertical: GRID.sm }}>
          <Text style={{ fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: accentColor }}>
            Nog een vraag
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ============================================
// DECISION ITEM CARD
// ============================================

interface DecisionItemCardProps {
  item: CustomerPortalItem;
  isExpanded: boolean;
  onToggle: () => void;
  onSubmit: (
    value: string | number | boolean,
    notes?: string,
    linkedProduct?: CustomerDecisionSubmission['linkedProduct'],
    photoUrls?: string[],
  ) => void;
  accentColor: string;
  contractorCountry?: string;
  accessToken?: string;
}

function DecisionItemCard({
  item,
  isExpanded,
  onToggle,
  onSubmit,
  accentColor,
  contractorCountry,
  accessToken,
}: DecisionItemCardProps) {
  const [textValue, setTextValue] = useState('');
  const [customerPhotos, setCustomerPhotos] = useState<Array<{ uri: string; base64?: string }>>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const MAX_CUSTOMER_PHOTOS = 5;
  // Display-only view model
  const photoUris = customerPhotos.map((p) => p.uri);

  const pickCustomerPhotos = async () => {
    if (customerPhotos.length >= MAX_CUSTOMER_PHOTOS) return;
    const remaining = MAX_CUSTOMER_PHOTOS - customerPhotos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled) {
      const picked = result.assets
        .filter((a) => !!a.uri)
        .map((a) => ({ uri: a.uri, base64: a.base64 || undefined }));
      setCustomerPhotos((prev) => [...prev, ...picked].slice(0, MAX_CUSTOMER_PHOTOS));
    }
  };

  const takeCustomerPhoto = async () => {
    if (customerPhotos.length >= MAX_CUSTOMER_PHOTOS) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const shot = { uri: result.assets[0].uri, base64: result.assets[0].base64 || undefined };
      setCustomerPhotos((prev) => [...prev, shot].slice(0, MAX_CUSTOMER_PHOTOS));
    }
  };

  const removeCustomerPhoto = (idx: number) => {
    setCustomerPhotos((prev) => prev.filter((_, i) => i !== idx));
  };
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const getPriorityLabel = () => {
    switch (item.priority) {
      case 'critical': return 'Belangrijk';
      case 'important': return 'Aanbevolen';
      default: return 'Optioneel';
    }
  };

  const getPriorityColor = () => {
    switch (item.priority) {
      case 'critical': return SemanticColors.feedbackError;
      case 'important': return SemanticColors.feedbackWarning;
      default: return SemanticColors.textTertiary;
    }
  };

  return (
    <View style={[styles.itemCard, item.isOverdue && styles.itemCardOverdue]}>
      <Pressable style={styles.itemHeader} onPress={onToggle}>
        <View style={styles.itemTitleRow}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor() + '15' }]}>
            <Text style={[styles.priorityText, { color: getPriorityColor() }]}>
              {getPriorityLabel()}
            </Text>
          </View>
        </View>
        <Text style={styles.itemDescription}>{item.description}</Text>
        {item.isOverdue && (
          <View style={styles.overdueWarning}>
            <Ionicons name="alert-circle" size={14} color={SemanticColors.feedbackError} />
            <Text style={styles.overdueWarningText}>
              Deadline verstreken - kies zo snel mogelijk
            </Text>
          </View>
        )}
        <View style={styles.itemToggle}>
          <Text style={[styles.itemToggleText, { color: accentColor }]}>
            {isExpanded ? 'Sluiten' : 'Keuze maken'}
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={accentColor}
          />
        </View>
      </Pressable>

      {isExpanded && (
        <View style={styles.itemExpanded}>
          {/* Help Text */}
          {item.helpText && (
            <View style={styles.helpBox}>
              <Ionicons name="information-circle" size={18} color={SemanticColors.feedbackInfo} />
              <Text style={styles.helpBoxText}>{item.helpText}</Text>
            </View>
          )}

          {/* Why It Matters */}
          {item.whyItMatters && (
            <View style={styles.whyBox}>
              <Text style={styles.whyLabel}>Waarom is dit belangrijk?</Text>
              <Text style={styles.whyText}>{item.whyItMatters}</Text>
            </View>
          )}

          {/* Input Based on Type */}
          {item.inputType === 'select' && item.options && (
            <View style={styles.optionsGrid}>
              {item.options.map((option) => (
                <OptionButton
                  key={option.value}
                  option={option}
                  onSelect={() => onSubmit(option.value, notes)}
                  accentColor={accentColor}
                />
              ))}
            </View>
          )}

          {item.inputType === 'boolean' && (
            <View style={styles.booleanOptions}>
              <Pressable
                style={[styles.booleanBtn, styles.booleanYes]}
                onPress={() => onSubmit(true, notes)}
              >
                <Ionicons name="checkmark-circle" size={28} color={SemanticColors.feedbackSuccess} />
                <Text style={[styles.booleanText, { color: SemanticColors.feedbackSuccess }]}>
                  Ja
                </Text>
              </Pressable>
              <Pressable
                style={[styles.booleanBtn, styles.booleanNo]}
                onPress={() => onSubmit(false, notes)}
              >
                <Ionicons name="close-circle" size={28} color={SemanticColors.feedbackError} />
                <Text style={[styles.booleanText, { color: SemanticColors.feedbackError }]}>
                  Nee
                </Text>
              </Pressable>
            </View>
          )}

          {(item.inputType === 'text' || item.inputType === 'color' || item.inputType === 'number') && (
            <View style={styles.textInputSection}>
              {item.exampleAnswer && (
                <Text style={styles.exampleText}>Voorbeeld: {item.exampleAnswer}</Text>
              )}
              <TextInput
                style={styles.textInput}
                placeholder={`Vul uw keuze in${item.unit ? ` (${item.unit})` : ''}...`}
                placeholderTextColor={SemanticColors.textTertiary}
                value={textValue}
                onChangeText={setTextValue}
                keyboardType={item.inputType === 'number' ? 'numeric' : 'default'}
                multiline={item.inputType === 'text'}
              />
              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: accentColor },
                  !textValue.trim() && styles.submitButtonDisabled,
                ]}
                onPress={() => {
                  if (textValue.trim()) {
                    onSubmit(item.inputType === 'number' ? Number(textValue) : textValue, notes);
                    setTextValue('');
                  }
                }}
                disabled={!textValue.trim()}
              >
                <Text style={styles.submitButtonText}>Bevestigen</Text>
              </Pressable>
            </View>
          )}

          {item.inputType === 'photo' && (
            <View style={styles.photoSection}>
              <Text style={styles.photoInstructions}>
                Stuur foto's van uw keuze, of beschrijf wat u wilt. Meerdere hoeken helpen de aannemer meer.
              </Text>

              {/* Photo thumbnails */}
              {photoUris.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GRID.sm, paddingVertical: GRID.xs }}>
                  {photoUris.map((uri, i) => (
                    <View key={uri + i} style={{ position: 'relative' }}>
                      <Image source={{ uri }} style={{ width: 84, height: 84, borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfaceSecondary }} />
                      <Pressable
                        onPress={() => removeCustomerPhoto(i)}
                        style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
                        accessibilityRole="button"
                        accessibilityLabel="Foto verwijderen"
                      >
                        <Ionicons name="close" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Upload buttons */}
              <View style={{ flexDirection: 'row', gap: GRID.sm }}>
                {photoUris.length < MAX_CUSTOMER_PHOTOS && (
                  <>
                    <Pressable
                      style={[styles.submitButton, { flex: 1, backgroundColor: SemanticColors.surfaceSecondary, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }]}
                      onPress={takeCustomerPhoto}
                    >
                      <Ionicons name="camera" size={16} color={SemanticColors.textPrimary} />
                      <Text style={[styles.submitButtonText, { color: SemanticColors.textPrimary }]}>Maak foto</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.submitButton, { flex: 1, backgroundColor: SemanticColors.surfaceSecondary, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }]}
                      onPress={pickCustomerPhotos}
                    >
                      <Ionicons name="images-outline" size={16} color={SemanticColors.textPrimary} />
                      <Text style={[styles.submitButtonText, { color: SemanticColors.textPrimary }]}>Uit galerij</Text>
                    </Pressable>
                  </>
                )}
              </View>

              {/* Optional description */}
              <TextInput
                style={[styles.textInput, { minHeight: 60 }]}
                placeholder="Beschrijving (optioneel) — of plak een link..."
                placeholderTextColor={SemanticColors.textTertiary}
                value={textValue}
                onChangeText={setTextValue}
                multiline
              />

              {/* Submit */}
              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: accentColor },
                  customerPhotos.length === 0 && !textValue.trim() && styles.submitButtonDisabled,
                ]}
                onPress={async () => {
                  if (customerPhotos.length === 0 && !textValue.trim()) return;
                  setUploadingPhotos(true);
                  try {
                    // Upload to Supabase Storage via customer-uploads bucket.
                    // Each photo → signed URL returned so contractor sees it.
                    let uploadedUrls: string[] = [];
                    if (customerPhotos.length > 0) {
                      const { uploadCustomerPhotos } = await import('../../services/customerPhotoUploadService');
                      uploadedUrls = await uploadCustomerPhotos(customerPhotos, { accessToken }).catch(() => customerPhotos.map((p) => p.uri));
                    }
                    const isUrl = textValue.match(/^https?:\/\//);
                    const valueForSubmit = uploadedUrls.length > 0
                      ? `${uploadedUrls.length} foto${uploadedUrls.length > 1 ? "'s" : ''}${textValue.trim() ? ' — ' + textValue : ''}`
                      : textValue;
                    onSubmit(
                      valueForSubmit,
                      notes,
                      isUrl ? { name: textValue, url: textValue } : undefined,
                      uploadedUrls,
                    );
                    setTextValue('');
                    setCustomerPhotos([]);
                  } finally {
                    setUploadingPhotos(false);
                  }
                }}
                disabled={(customerPhotos.length === 0 && !textValue.trim()) || uploadingPhotos}
              >
                <Text style={styles.submitButtonText}>{uploadingPhotos ? 'Uploaden…' : 'Versturen'}</Text>
              </Pressable>
            </View>
          )}

          {/* payment_method input type removed — payment handled via PaymentSection */}

          {/* Add Notes Toggle */}
          <Pressable
            style={styles.addNotesToggle}
            onPress={() => setShowNotes(!showNotes)}
          >
            <Ionicons
              name={showNotes ? 'chatbubble' : 'chatbubble-outline'}
              size={16}
              color={SemanticColors.textSecondary}
            />
            <Text style={styles.addNotesText}>
              {showNotes ? 'Notitie verbergen' : 'Notitie toevoegen'}
            </Text>
          </Pressable>

          {showNotes && (
            <TextInput
              style={styles.notesInput}
              placeholder="Voeg een opmerking toe..."
              placeholderTextColor={SemanticColors.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          )}
        </View>
      )}
    </View>
  );
}

// ============================================
// (PaymentSection defined above — single implementation)

// ============================================
// OPTION BUTTON
// ============================================

interface OptionButtonProps {
  option: DecisionOption;
  onSelect: () => void;
  accentColor: string;
}

function OptionButton({ option, onSelect, accentColor }: OptionButtonProps) {
  return (
    <Pressable style={styles.optionButton} onPress={onSelect}>
      {option.imageUrl && (
        <View style={styles.optionImage}>
          <Ionicons name="image" size={32} color={SemanticColors.textTertiary} />
        </View>
      )}
      <View style={styles.optionContent}>
        <Text style={styles.optionLabel}>{option.label}</Text>
        {option.description && (
          <Text style={styles.optionDescription}>{option.description}</Text>
        )}
        {option.priceImpact !== undefined && option.priceImpact !== 0 && (
          <Text
            style={[
              styles.optionPrice,
              {
                color: option.priceImpact > 0
                  ? SemanticColors.feedbackError
                  : SemanticColors.feedbackSuccess,
              },
            ]}
          >
            {option.priceImpact > 0 ? '+' : ''}{formatCurrency(Math.abs(option.priceImpact))}
          </Text>
        )}
      </View>
      <View style={[styles.optionSelect, { borderColor: accentColor }]}>
        <Text style={[styles.optionSelectText, { color: accentColor }]}>Kiezen</Text>
      </View>
    </Pressable>
  );
}

// ============================================
// COMPLETED ITEM CARD
// ============================================

interface CompletedItemCardProps {
  item: CustomerPortalItem;
  accentColor: string;
}

function CompletedItemCard({ item, accentColor }: CompletedItemCardProps) {
  const getDisplayValue = () => {
    if (typeof item.value === 'boolean') {
      return item.value ? 'Ja' : 'Nee';
    }
    if (item.options) {
      const option = item.options.find((o) => o.value === item.value);
      return option?.label || String(item.value);
    }
    return String(item.value);
  };

  return (
    <View style={styles.completedCard}>
      <View style={styles.completedIcon}>
        <Ionicons name="checkmark-circle" size={24} color={SemanticColors.feedbackSuccess} />
      </View>
      <View style={styles.completedContent}>
        <Text style={styles.completedName}>{item.name}</Text>
        <Text style={[styles.completedValue, { color: accentColor }]}>{getDisplayValue()}</Text>
        {item.decidedAt && (
          <Text style={styles.completedDate}>
            Gekozen op {new Date(item.decidedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        )}
      </View>
    </View>
  );
}

// ============================================
// ACCESS CODE ENTRY
// ============================================

interface AccessCodeEntryProps {
  onSubmit: (code: string) => void;
  error?: string;
  isLoading?: boolean;
}

export function AccessCodeEntry({ onSubmit, error, isLoading }: AccessCodeEntryProps) {
  const [code, setCode] = useState('');

  return (
    <View style={styles.accessContainer}>
      <View style={styles.accessContent}>
        <View style={styles.accessLogo}>
          <Ionicons name="home" size={48} color={Palette.hermesOrange} />
        </View>
        <Text style={styles.accessTitle}>Project Keuzes</Text>
        <Text style={styles.accessSubtitle}>
          Vul de code in die u van uw aannemer heeft ontvangen
        </Text>

        <TextInput
          style={styles.accessInput}
          placeholder="XXXXXX"
          placeholderTextColor={SemanticColors.textTertiary}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          autoCorrect={false}
        />

        {error && (
          <View style={styles.accessError}>
            <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
            <Text style={styles.accessErrorText}>{error}</Text>
          </View>
        )}

        <Pressable
          style={[styles.accessButton, code.length < 6 && styles.accessButtonDisabled]}
          onPress={() => onSubmit(code)}
          disabled={code.length < 6 || isLoading}
        >
          {isLoading ? (
            <Text style={styles.accessButtonText}>Laden...</Text>
          ) : (
            <Text style={styles.accessButtonText}>Doorgaan</Text>
          )}
        </Pressable>

        <Text style={styles.accessHelp}>
          Geen code? Vraag uw aannemer om een toegangslink.
        </Text>
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
  contentContainer: {
    padding: Spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  contractorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contractorAvatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contractorInitials: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
  },
  contractorName: {
    fontSize: TYPE.titleSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  companyName: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  contactButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Project Card
  projectCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  projectName: {
    fontSize: TYPE.displaySize - 6,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  projectDates: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },

  // Progress Card
  progressCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressTitle: {
    fontSize: TYPE.titleSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  progressPercent: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  progressBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressStatText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },

  // Urgent Banner
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError + '30',
  },
  urgentIcon: {
    marginRight: Spacing.sm,
  },
  urgentContent: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  urgentText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Categories Section
  categoriesSection: {
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },

  // Category Card
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  categoryCardOverdue: {
    borderColor: SemanticColors.feedbackError + '50',
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.feedbackError,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  categoryContent: {
    flex: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryName: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  overdueBadge: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overdueBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  categoryProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  categoryCount: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  categoryDue: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },

  // Help Footer
  helpFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.lg,
  },
  helpText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
  },

  // Category Detail
  categoryDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  categoryDetailTitle: {
    flex: 1,
  },
  categoryDetailName: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  categoryDetailCount: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  categoryDetailContent: {
    flex: 1,
  },

  // Items Section
  itemsSection: {
    padding: Spacing.md,
  },
  itemsSectionTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  // Item Card
  itemCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  itemCardOverdue: {
    borderColor: SemanticColors.feedbackError + '50',
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.feedbackError,
  },
  itemHeader: {
    padding: Spacing.md,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemName: {
    fontSize: TYPE.titleSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },
  overdueWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: SemanticColors.feedbackErrorBg,
    padding: 8,
    borderRadius: RADIUS.sm - 2,
  },
  overdueWarningText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.feedbackError,
    flex: 1,
  },
  itemToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  itemToggleText: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
  },

  // Item Expanded
  itemExpanded: {
    padding: Spacing.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SemanticColors.feedbackInfoBg,
    padding: Spacing.sm,
    borderRadius: RADIUS.sm,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  helpBoxText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  whyBox: {
    marginBottom: Spacing.md,
  },
  whyLabel: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  whyText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
  },

  // Options
  optionsGrid: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  optionImage: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  optionDescription: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  optionPrice: {
    fontSize: TYPE.captionSize,
    fontWeight: '600',
    marginTop: 4,
  },
  optionSelect: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm - 2,
    borderWidth: 1.5,
  },
  optionSelectText: {
    fontSize: TYPE.captionSize,
    fontWeight: '600',
  },

  // Boolean Options
  booleanOptions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  booleanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
  },
  booleanYes: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  booleanNo: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  booleanText: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
  },

  // Text Input Section
  textInputSection: {
    gap: Spacing.sm,
  },
  exampleText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    fontStyle: 'italic',
  },
  textInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: Spacing.md,
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    minHeight: 48,
  },
  submitButton: {
    borderRadius: RADIUS.sm,
    padding: Spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: Palette.white,
  },

  // Photo Section
  photoSection: {
    gap: Spacing.sm,
  },
  photoInstructions: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },

  // Payment Method
  paymentMethodGrid: {
    gap: Spacing.sm,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: SemanticColors.borderDefault,
  },
  paymentMethodLabel: {
    flex: 1,
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
  },

  // Notes
  addNotesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addNotesText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  notesInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
    minHeight: 60,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },

  // Completed Card
  completedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  completedIcon: {
    marginRight: Spacing.sm,
  },
  completedContent: {
    flex: 1,
  },
  completedName: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  completedValue: {
    fontSize: TYPE.titleSize,
    fontWeight: '600',
    marginTop: 2,
  },
  completedDate: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },

  // Access Code Entry
  accessContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  accessContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  accessLogo: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.xl,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  accessTitle: {
    fontSize: TYPE.displaySize - 4,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  accessSubtitle: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  accessInput: {
    width: '100%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.lg,
    fontSize: TYPE.displaySize - 4,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: Spacing.md,
  },
  accessError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  accessErrorText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.feedbackError,
  },
  accessButton: {
    width: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  accessButtonDisabled: {
    opacity: 0.5,
  },
  accessButtonText: {
    fontSize: TYPE.titleSize,
    fontWeight: '600',
    color: Palette.white,
  },
  accessHelp: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },

  // Payment Section
  paymentSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  paymentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentSectionTitle: {
    fontSize: TYPE.titleSize + 1,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  paymentSubtext: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  paymentBadgeText: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  paymentAmounts: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: RADIUS.md,
    padding: 14,
    gap: 8,
  },
  paymentAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentAmountLabel: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  paymentAmountValue: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  paymentReadyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: RADIUS.sm,
    padding: 12,
  },
  paymentReadyText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.feedbackSuccess,
    flex: 1,
    fontWeight: '500',
  },
  payNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
  },
  payNowButtonText: {
    fontSize: TYPE.titleSize,
    fontWeight: '700',
    color: Palette.white,
  },
  paymentMethodsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  paymentMethodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  paymentMethodDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  paymentMethodText: {
    fontSize: TYPE.labelSize,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  securityBadgeText: {
    fontSize: TYPE.tinySize,
    fontWeight: '500',
    color: SemanticColors.textTertiary,
  },
  paymentSuccessCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: SemanticColors.feedbackSuccess + '30',
  },
  paymentSuccessIconWrap: {
    marginBottom: 4,
  },
  paymentSuccessTitle: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  paymentSuccessSubtext: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  paymentSuccessDivider: {
    height: 1,
    backgroundColor: SemanticColors.borderDefault,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  paymentSuccessDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: 8,
  },
  paymentSuccessDetailLabel: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  paymentSuccessDetailValue: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },

  // "Ask a question" card — customer-reply AI (Decagon pattern)
  askCard: {
    marginTop: GRID.md,
    padding: GRID.md,
    borderRadius: RADIUS.lg,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    gap: GRID.sm,
  },
  askHeader: { flexDirection: 'row', alignItems: 'center', gap: GRID.xs },
  askTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  askSubtitle: { fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  askReplyCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: GRID.xs,
    padding: GRID.sm, borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '10',
  },
  askReplyText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary, lineHeight: 18 },
});
