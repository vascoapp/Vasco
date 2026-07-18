// =============================================================================
// CUSTOMER DECISION PORTAL
// =============================================================================
// Customer-facing interface for viewing and submitting project decisions
// Simple, clean UI focused on ease of use for non-technical users
// =============================================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SignaturePad } from '../shared/SignaturePad';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { DK } from '../../theme/draftkings';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { hapticSuccess } from '../../utils/haptics';
import { formatCurrency, getCountryConfig } from '../../i18n/formatting';
import { CustomerLanguageSwitcher } from './CustomerLanguageSwitcher';
import { CUSTOMER_GLOSSARY } from '../../data/customerGlossary';
import type { SubmitResult } from '../../services/decisionSyncService';

type ToastKind = 'success' | 'pending' | 'info';
import type {
  CustomerPortalData,
  CustomerPortalCategory,
  CustomerPortalItem,
  CustomerDecisionSubmission,
} from '../../types/customerPortal';
import type { DecisionOption } from '../../types/decisions';
import { getPaymentDisplayForCountry, getPaymentBrandColor } from '../../config/paymentMethods';
import { RegionalPreferencePanel } from './RegionalPreferencePanel';
import type { Country } from '../../context/AuthContext';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MAIN PORTAL COMPONENT
// ============================================

// Non-blocking toast — replaces Alert.alert so confirmations don't interrupt
// the customer mid-flow (and don't fall back to the ugly browser alert on web).
function PortalToast({ toast }: { toast: { kind: ToastKind; text: string } | null }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: toast ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [toast, anim]);
  if (!toast) return null;
  const accent =
    toast.kind === 'success' ? DK.colors.success
    : toast.kind === 'pending' ? DK.colors.highlight
    : DK.colors.accent;
  const icon =
    toast.kind === 'success' ? 'checkmark-circle'
    : toast.kind === 'pending' ? 'cloud-offline-outline'
    : 'information-circle';
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { borderColor: accent + '55', opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Ionicons name={icon as IconName} size={18} color={accent} />
      <Text style={styles.toastText}>{toast.text}</Text>
    </Animated.View>
  );
}

// #7: plain-language project timeline so a non-expert customer can see
// "where are we" at a glance. Phases come from ProjectPhase; labels are
// friendly (not trade jargon). Current phase highlighted; past phases checked.
const PHASE_ORDER = ['planning', 'demolition', 'rough_in', 'installation', 'finishing', 'final'] as const;

function ProjectTimeline({ currentPhase, accentColor }: { currentPhase: string; accentColor: string }) {
  const { t } = useTranslation();
  const currentIdx = Math.max(0, PHASE_ORDER.indexOf(currentPhase as typeof PHASE_ORDER[number]));
  const labels: Record<string, string> = {
    planning: t('decisionPortal.phasePlanning', 'Planning'),
    demolition: t('decisionPortal.phaseDemolition', 'Strip-out'),
    rough_in: t('decisionPortal.phaseRoughIn', 'First fix'),
    installation: t('decisionPortal.phaseInstallation', 'Installation'),
    finishing: t('decisionPortal.phaseFinishing', 'Finishing'),
    final: t('decisionPortal.phaseFinal', 'Handover'),
  };
  return (
    <View style={styles.timeline} accessibilityLabel={t('decisionPortal.timelineLabel', 'Project progress')}>
      <Text style={styles.timelineTitle}>{t('decisionPortal.timelineTitle', 'Where we are')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineRow}>
        {PHASE_ORDER.map((phase, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <View key={phase} style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineDot,
                  done && { backgroundColor: DK.colors.success, borderColor: DK.colors.success },
                  active && { backgroundColor: accentColor + '22', borderColor: accentColor },
                ]}
              >
                {done
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Text style={[styles.timelineDotNum, active && { color: accentColor }]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.timelineStepText, active && { color: DK.colors.text, fontFamily: DK.type.display800 }]} numberOfLines={1}>
                {labels[phase]}
              </Text>
              {i < PHASE_ORDER.length - 1 && <View style={[styles.timelineBar, done && { backgroundColor: DK.colors.success }]} />}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Tap-to-enlarge photo viewer. Critical for a *visual* decision portal — a
// customer choosing tiles/paint/fixtures needs to see the option full-size,
// not a 64px thumbnail. Used for option photos + customer-uploaded photos.
function PhotoLightbox({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.lightboxRoot} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close', 'Close')}>
        {uri && <Image source={{ uri }} style={styles.lightboxImage} resizeMode="contain" />}
        <View style={styles.lightboxClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </View>
      </Pressable>
    </Modal>
  );
}

// Deadline urgency: turns a bare date into "Due in 3 days" / "Due today" /
// "X days overdue" with color so non-experts can prioritize what's time-sensitive.
function DeadlinePill({ dueDate, overdue, accentColor }: { dueDate: string; overdue?: boolean; accentColor: string }) {
  const { t } = useTranslation();
  const MS_DAY = 86_400_000;
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / MS_DAY);
  const isOverdue = overdue || days < 0;
  const soon = !isOverdue && days <= 3;
  const color = isOverdue ? DK.colors.danger : soon ? DK.colors.highlight : DK.colors.textMuted;
  const label = isOverdue
    ? t('decisionPortal.dueOverdue', '{{count}} days overdue', { count: Math.abs(days) })
    : days === 0
      ? t('decisionPortal.dueToday', 'Due today')
      : days === 1
        ? t('decisionPortal.dueTomorrow', 'Due tomorrow')
        : t('decisionPortal.dueInDays', 'Due in {{count}} days', { count: days });
  return (
    <View style={[styles.deadlinePill, { backgroundColor: color + '18' }]}>
      <Ionicons name={isOverdue ? 'alert-circle' : 'time-outline'} size={12} color={color} />
      <Text style={[styles.deadlinePillText, { color }]}>{label}</Text>
    </View>
  );
}

interface CustomerDecisionPortalProps {
  portalData: CustomerPortalData;
  onSubmitDecision: (submission: CustomerDecisionSubmission) => void | Promise<SubmitResult | void>;
  onActivityLog?: (action: string, metadata?: Record<string, unknown>) => void;
  // R303: pass region + trade so DecisionItemCard can fetch
  // getRegionalPreferences and surface "67% of customers chose X" hints
  // when k-anonymity ≥20 (R301 aggregation pipeline).
  region?: string;
  trade?: string;
}

export function CustomerDecisionPortal({
  portalData,
  onSubmitDecision,
  onActivityLog,
  region,
  trade,
}: CustomerDecisionPortalProps) {
  const { t, i18n } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  // Phase 2: first-time orientation for customers who don't know construction.
  // Shown until the customer dismisses it or has already made a choice.
  const [showHowTo, setShowHowTo] = useState(true);
  // Glossary modal — plain-language construction terms for non-expert customers.
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  // Toast — replaces blocking Alert.alert popups for non-interrupting feedback.
  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (kind: ToastKind, text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind, text });
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const completionPercent = portalData.totalDecisions > 0
    ? Math.round((portalData.completedDecisions / portalData.totalDecisions) * 100)
    : 0;

  // Running cost summary: sum the price impact of every chosen option across all
  // categories, so the customer sees how their selections add up vs the base quote.
  const upgradeTotal = useMemo(() => {
    let total = 0;
    for (const cat of portalData.categories) {
      for (const item of cat.items) {
        if (item.status !== 'decided' || !item.options) continue;
        const chosen = item.options.find((o) => o.value === item.value);
        if (chosen?.priceImpact) total += chosen.priceImpact;
      }
    }
    return total;
  }, [portalData.categories]);

  useEffect(() => {
    onActivityLog?.('portal_accessed');
  }, []);

  const accentColor = portalData.accentColor || Palette.hermesOrange;
  // Localize project dates to the contractor's country (was device-locale).
  const dateLocale = getCountryConfig((portalData.contractorCountry ?? 'NL') as any).locale;

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
          region={region}
          trade={trade}
        />
      );
    }
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Language switcher — lets a customer who doesn't read the contractor's
          language use the portal in their own (fully localized in 6 languages). */}
      <View style={styles.langBar}>
        <CustomerLanguageSwitcher />
      </View>

      {/* R66 round 49: payment-success hero. Pre-R49 the customer returned
          from Mollie checkout to a portal that looked identical to before —
          the success state was buried below the categories list as a small
          inline card. Now: when paymentStatus='paid', a full-bleed celebration
          hero leads the screen with success-green gradient + glow + the paid
          amount prominently displayed. The regular portal flows below for
          reference. Closes the customer's loop visibly. */}
      {portalData.paymentStatus === 'paid' && (
        <View style={styles.successHero}>
          <LinearGradient
            colors={[DK.colors.success, '#0EA86F', '#057A4F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.successCheckCircle}>
            <Ionicons name="checkmark" size={36} color={DK.colors.success} />
          </View>
          <Text style={styles.successHeroLabel}>
            {t('decisionPortal.paymentReceived', 'Payment received').toUpperCase()}
          </Text>
          <Text style={styles.successHeroAmount}>
            {formatCurrency(portalData.paidAmount ?? portalData.quoteAmount ?? 0, (portalData.contractorCountry ?? 'NL') as Country)}
          </Text>
          <Text style={styles.successHeroSubtext}>
            {t('decisionPortal.paymentReceivedNext', '{{name}} is op de hoogte gesteld en neemt zo snel mogelijk contact op.', {
              name: portalData.contractorName,
            })}
          </Text>
        </View>
      )}

      {/* R66 round 48: unified hero — gradient backdrop + amber glow + bigger
          Archivo display project name. Combines contractor header + project
          info + progress into one branded surface (the customer's first and
          most important impression of the contractor's brand). */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[DK.colors.panel2, DK.colors.panel]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Contractor row */}
        <View style={styles.heroTopRow}>
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
              style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
              onPress={() => Linking.openURL(`tel:${portalData.contractorPhone}`)}
              accessibilityRole="button"
              accessibilityLabel={t('decisionPortal.callContractor', 'Call {{name}}', { name: portalData.contractorName })}
            >
              <Ionicons name="call" size={20} color={DK.colors.success} />
            </Pressable>
          )}
        </View>

        {/* Project name + dates */}
        <Text style={styles.projectName}>{portalData.projectName}</Text>
        <View style={styles.projectDates}>
          <View style={styles.dateItem}>
            <Ionicons name="calendar-outline" size={14} color={DK.colors.textMuted} />
            <Text style={styles.dateText}>
              {t('decisionPortal.startLabel', 'Start')}: {new Date(portalData.projectStartDate).toLocaleDateString(dateLocale, {
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
          {portalData.estimatedCompletionDate && (
            <View style={styles.dateItem}>
              <Ionicons name="flag-outline" size={14} color={DK.colors.textMuted} />
              <Text style={styles.dateText}>
                {t('decisionPortal.doneLabel', 'Done')}: {new Date(portalData.estimatedCompletionDate).toLocaleDateString(dateLocale, {
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Progress block */}
        <View style={styles.heroProgressBlock}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{t('decisionPortal.yourChoices', 'Your choices').toUpperCase()}</Text>
            <Text style={styles.progressPercent}>{completionPercent}%</Text>
          </View>
          <View style={styles.progressBar}>
            {completionPercent > 0 && (
              <View style={[styles.progressFillWrap, { width: `${completionPercent}%` }]}>
                <LinearGradient
                  colors={DK.effects.ctaGradient as unknown as readonly [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            )}
          </View>
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Ionicons name="checkmark-circle" size={16} color={DK.colors.success} />
              <Text style={styles.progressStatText}>{t('decisionPortal.statChosen', '{{count}} chosen', { count: portalData.completedDecisions })}</Text>
            </View>
            {portalData.overdueDecisions > 0 && (
              <View style={styles.progressStat}>
                <Ionicons name="alert-circle" size={16} color={DK.colors.danger} />
                <Text style={[styles.progressStatText, { color: DK.colors.danger }]}>
                  {t('decisionPortal.statOverdue', '{{count}} overdue', { count: portalData.overdueDecisions })}
                </Text>
              </View>
            )}
            <View style={styles.progressStat}>
              <Ionicons name="time" size={16} color={DK.colors.textMuted} />
              <Text style={styles.progressStatText}>
                {t('decisionPortal.statRemaining', '{{count}} to do', { count: portalData.totalDecisions - portalData.completedDecisions })}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* #7: plain-language project timeline */}
      {portalData.currentPhase && (
        <ProjectTimeline currentPhase={portalData.currentPhase} accentColor={accentColor} />
      )}

      {/* Phase 2: "How this works" orientation — for customers who don't know
          construction. Plain-language 3-step explainer + reassurance that no
          question is too small. Auto-hides once they've made a choice, and is
          dismissible. */}
      {showHowTo && portalData.completedDecisions === 0 && (
        <View style={styles.howToCard}>
          <View style={styles.howToHeader}>
            <View style={styles.howToHeaderIcon}>
              <Ionicons name="hand-left-outline" size={18} color={accentColor} />
            </View>
            <Text style={styles.howToTitle}>{t('decisionPortal.howToTitle', "New here? Here's how it works")}</Text>
            <Pressable
              onPress={() => setShowHowTo(false)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('decisionPortal.howToDismiss', 'Got it')}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="close" size={18} color={DK.colors.textMuted} />
            </Pressable>
          </View>
          {[
            { icon: 'list-outline' as IconName, text: t('decisionPortal.howToStep1', 'Tap a category below to see the choices {{name}} needs from you.', { name: portalData.contractorName }) },
            { icon: 'bulb-outline' as IconName, text: t('decisionPortal.howToStep2', 'Each choice explains what it means and why it matters — just pick what you like best.') },
            { icon: 'chatbubble-ellipses-outline' as IconName, text: t('decisionPortal.howToStep3', 'Not sure about something? You can ask {{name}} a question at the bottom of any category — no question is too small.', { name: portalData.contractorName }) },
          ].map((step, i) => (
            <View key={i} style={styles.howToStep}>
              <View style={styles.howToStepNum}>
                <Text style={[styles.howToStepNumText, { color: accentColor }]}>{i + 1}</Text>
              </View>
              <Ionicons name={step.icon} size={16} color={DK.colors.textMuted} style={{ marginTop: 1 }} />
              <Text style={styles.howToStepText}>{step.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Urgent Items Banner */}
      {portalData.overdueDecisions > 0 && (
        <Pressable
          style={({ pressed }) => [styles.urgentBanner, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('decisionPortal.urgentTitle', 'Action required')}
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
            <Text style={styles.urgentTitle}>{t('decisionPortal.urgentTitle', 'Action required')}</Text>
            <Text style={styles.urgentText}>
              {t('decisionPortal.urgentBody', '{{count}} choices need to be made to avoid delays', { count: portalData.overdueDecisions })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={SemanticColors.feedbackError} />
        </Pressable>
      )}

      {/* #5: all-done celebration before payment — closes the loop so the
          customer knows nothing more is needed from them. */}
      {portalData.totalDecisions > 0 && portalData.completedDecisions >= portalData.totalDecisions && (
        <View style={styles.allDoneBanner}>
          <View style={styles.allDoneIcon}>
            <Ionicons name="sparkles" size={22} color={DK.colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.allDoneTitle}>{t('decisionPortal.allDoneTitle', 'All your choices are in! 🎉')}</Text>
            <Text style={styles.allDoneText}>
              {portalData.paymentLink && portalData.paymentStatus !== 'paid'
                ? t('decisionPortal.allDoneBodyPay', '{{name}} has everything needed. The last step is your payment below.', { name: portalData.contractorName })
                : t('decisionPortal.allDoneBody', '{{name}} has everything needed and will take it from here.', { name: portalData.contractorName })}
            </Text>
          </View>
        </View>
      )}

      {/* Categories */}
      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>{t('decisionPortal.categories', 'Categories')}</Text>
        {portalData.categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            accentColor={accentColor}
            dateLocale={dateLocale}
            onPress={() => {
              setActiveCategory(category.id);
              onActivityLog?.('category_viewed', { categoryId: category.id });
            }}
          />
        ))}
      </View>

      {/* Running cost summary — shows how the customer's choices add up vs the
          base quote, so budget-conscious non-experts can see the impact. */}
      {portalData.completedDecisions > 0 && (
        <View style={styles.selectionSummary}>
          <View style={styles.selectionSummaryRow}>
            <Ionicons name="pricetags-outline" size={16} color={DK.colors.textMuted} />
            <Text style={styles.selectionSummaryLabel}>
              {t('decisionPortal.selectionsSoFar', 'Your choices so far')}
            </Text>
            <Text
              style={[
                styles.selectionSummaryValue,
                { color: upgradeTotal > 0 ? DK.colors.text : DK.colors.success },
              ]}
            >
              {upgradeTotal === 0
                ? t('decisionPortal.noUpgrades', 'No extra cost')
                : `${upgradeTotal > 0 ? '+' : ''}${formatCurrency(upgradeTotal, (portalData.contractorCountry ?? 'NL') as Country)}`}
            </Text>
          </View>
          <Text style={styles.selectionSummaryHint}>
            {upgradeTotal === 0
              ? t('decisionPortal.summaryBaseHint', "You're on the original quoted price.")
              : t('decisionPortal.summaryUpgradeHint', 'Versus the base quote, from your upgrade choices.')}
          </Text>
        </View>
      )}

      {/* Payment Section — informational badges + Pay now button */}
      {portalData.paymentLink && portalData.paymentStatus !== 'paid' && (
        <PaymentSection
          portalData={portalData}
          accentColor={accentColor}
          onActivityLog={onActivityLog}
          onToast={showToast}
        />
      )}

      {/* Payment Success State */}
      {portalData.paymentStatus === 'paid' && (
        <View style={styles.paymentSuccessCard}>
          <View style={styles.paymentSuccessIconWrap}>
            <Ionicons name="checkmark-circle" size={48} color={SemanticColors.feedbackSuccess} />
          </View>
          <Text style={styles.paymentSuccessTitle}>{t('decisionPortal.paymentReceived', 'Payment received')}</Text>
          <Text style={styles.paymentSuccessSubtext}>
            {t('decisionPortal.paymentReceivedThanks', 'Thank you! Your payment has been processed.')}
          </Text>
          <View style={styles.paymentSuccessDivider} />
          <View style={styles.paymentSuccessDetail}>
            <Text style={styles.paymentSuccessDetailLabel}>{t('decisionPortal.amount', 'Amount')}</Text>
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
          {t('decisionPortal.helpFooter', 'Questions? Contact {{name}}', { name: portalData.contractorName })}
        </Text>
      </View>

      {/* Glossary link — plain-language terms for customers new to building. */}
      <Pressable
        style={({ pressed }) => [styles.glossaryLink, pressed && styles.pressed]}
        onPress={() => { setGlossaryOpen(true); onActivityLog?.('glossary_opened'); }}
        accessibilityRole="button"
        accessibilityLabel={t('decisionPortal.glossaryCta', 'What do these words mean?')}
      >
        <Ionicons name="book-outline" size={16} color={accentColor} />
        <Text style={[styles.glossaryLinkText, { color: accentColor }]}>
          {t('decisionPortal.glossaryCta', 'What do these words mean?')}
        </Text>
      </Pressable>

      <View style={{ height: 40 }} />

      {/* Glossary modal */}
      <Modal visible={glossaryOpen} animationType="slide" transparent onRequestClose={() => setGlossaryOpen(false)}>
        <View style={styles.glossaryModalRoot}>
          <View style={styles.glossaryModalCard}>
            <View style={styles.glossaryModalHeader}>
              <Text style={styles.glossaryModalTitle}>{t('decisionPortal.glossaryTitle', 'Building terms, explained')}</Text>
              <Pressable
                onPress={() => setGlossaryOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('common.close', 'Close')}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="close" size={22} color={DK.colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: Spacing.md, paddingBottom: Spacing.lg }}>
              {CUSTOMER_GLOSSARY.map((entry) => {
                const lang = ((i18n.language || 'en').slice(0, 2)) as keyof typeof entry.term;
                return (
                  <View key={entry.id} style={styles.glossaryEntry}>
                    <Text style={styles.glossaryTerm}>{entry.term[lang] ?? entry.term.en}</Text>
                    <Text style={styles.glossaryDef}>{entry.def[lang] ?? entry.def.en}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
    <PortalToast toast={toast} />
    </View>
  );
}

// ============================================
// PAYMENT SECTION
// ============================================

interface PaymentSectionProps {
  portalData: CustomerPortalData;
  accentColor: string;
  onActivityLog?: (action: string, metadata?: Record<string, unknown>) => void;
  onToast?: (kind: ToastKind, text: string) => void;
}

function PaymentSection({ portalData, accentColor, onActivityLog, onToast }: PaymentSectionProps) {
  const { t } = useTranslation();
  const isPartial = portalData.paymentStatus === 'partial';
  const allDecisionsComplete =
    portalData.completedDecisions >= portalData.totalDecisions;

  // R66r56: customer-side acknowledgment signature. Only enabled once all
  // decisions are complete and the customer hasn't already signed. Writes
  // via write_signature_via_portal RPC (anon, server-derived ip_hash).
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const handleSignatureSave = async (svgPath: string) => {
    if (signing) return;
    const trimmedName = signerName.trim();
    if (!trimmedName) {
      onToast?.('info', t('decisionPortal.signNameRequiredDesc', 'Please type your name before signing.'));
      return;
    }
    setSigning(true);
    try {
      const { recordPortalSignature } = await import('../../services/signatureService');
      const id = await recordPortalSignature({
        accessCode: portalData.accessToken,
        signerName: trimmedName,
        signerRole: 'customer',
        signatureSvg: svgPath,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
      if (id) {
        setSignedAt(new Date().toISOString());
        setSignModalOpen(false);
        onActivityLog?.('signature_recorded', { signatureId: id });
        hapticSuccess();
      } else {
        onToast?.('info', t('decisionPortal.signFailedDesc', 'Please try again. If the problem persists, contact your contractor.'));
      }
    } catch {
      onToast?.('info', t('decisionPortal.signFailedDesc', 'Please try again. If the problem persists, contact your contractor.'));
    } finally {
      setSigning(false);
    }
  };

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
    if (!portalData.paymentLink) return;
    // R66 round 45: detect the seeded demo paymentLink and surface a
    // honest "demo mode" alert instead of opening the fake Mollie URL
    // (which 404s in the browser). In live mode the contractor's
    // real Mollie checkout opens.
    if (portalData.paymentLink.includes('example-session-id')) {
      onToast?.('info', t('decisionPortal.demoPaymentBody', 'In live mode this opens your contractor\'s Mollie checkout with the configured payment methods (iDEAL, card, Apple Pay, etc.).'));
      return;
    }
    onActivityLog?.('payment_started', {
      amount: payAmount,
      method: 'payment_link',
    });
    Linking.openURL(portalData.paymentLink);
  };

  return (
    <View style={styles.paymentSection}>
      {/* Header */}
      <View style={styles.paymentSectionHeader}>
        <View style={[styles.paymentIconWrap, { backgroundColor: accentColor + '15' }]}>
          <Ionicons name="card-outline" size={24} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.paymentSectionTitle}>{t('decisionPortal.paymentTitle', 'Payment')}</Text>
          {isPartial && paidLabel && (
            <Text style={styles.paymentSubtext}>{t('decisionPortal.paymentPartialOf', '{{paid}} of {{total}} paid', { paid: paidLabel, total: totalLabel })}</Text>
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
            {isPartial ? t('decisionPortal.statusPartial', 'Partially paid') : t('decisionPortal.statusOutstanding', 'Outstanding')}
          </Text>
        </View>
      </View>

      {/* Amount breakdown */}
      <View style={styles.paymentAmounts}>
        <View style={styles.paymentAmountRow}>
          <Text style={styles.paymentAmountLabel}>{t('decisionPortal.quoteAmount', 'Quote amount')}</Text>
          <Text style={styles.paymentAmountValue}>{totalLabel}</Text>
        </View>
        {hasDeposit && (
          <View style={styles.paymentAmountRow}>
            <Text style={styles.paymentAmountLabel}>{t('decisionPortal.deposit', 'Deposit')}</Text>
            <Text style={[styles.paymentAmountValue, { color: accentColor }]}>
              {depositLabel}
            </Text>
          </View>
        )}
        {isPartial && portalData.paidAmount != null && portalData.paidAmount > 0 && (
          <View style={styles.paymentAmountRow}>
            <Text style={styles.paymentAmountLabel}>{t('decisionPortal.alreadyPaid', 'Already paid')}</Text>
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
            {t('decisionPortal.allChoicesSaved', 'Al uw keuzes zijn opgeslagen. U kunt nu betalen.')}
          </Text>
        </View>
      )}

      {/* R66r56: customer acknowledgment signature. Optional but encouraged —
          gives the contractor a customer-side audit row separate from the
          contractor's own job-handover signature. Hidden once signed. */}
      {allDecisionsComplete && !signedAt && (
        <Pressable
          style={({ pressed }) => [styles.signAckButton, pressed && styles.pressed]}
          onPress={() => setSignModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('decisionPortal.signAckCta', 'Sign to confirm your choices')}
        >
          <Ionicons name="create-outline" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.signAckButtonText}>
            {t('decisionPortal.signAckCta', 'Sign to confirm your choices')}
          </Text>
        </Pressable>
      )}
      {signedAt && (
        <View style={styles.signedBadge}>
          <Ionicons name="checkmark-done" size={16} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.signedBadgeText}>
            {t('decisionPortal.signedAck', 'Signed by {{name}}', { name: signerName.trim() })}
          </Text>
        </View>
      )}

      {/* Signature modal */}
      <Modal
        visible={signModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSignModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.signModalRoot}
        >
          <View style={styles.signModalCard}>
            <Text style={styles.signModalTitle}>
              {t('decisionPortal.signModalTitle', 'Confirm your choices')}
            </Text>
            <Text style={styles.signModalSubtitle}>
              {t('decisionPortal.signModalSubtitle', 'Type your name and sign below to acknowledge the choices you made.')}
            </Text>
            <TextInput
              style={styles.signModalInput}
              placeholder={t('decisionPortal.signNamePlaceholder', 'Your full name')}
              placeholderTextColor={SemanticColors.textTertiary}
              value={signerName}
              onChangeText={setSignerName}
              autoCapitalize="words"
              autoCorrect={false}
              accessibilityLabel={t('decisionPortal.signNamePlaceholder', 'Your full name')}
            />
            <SignaturePad
              label={signerName}
              onSave={handleSignatureSave}
            />
            <Pressable
              onPress={() => setSignModalOpen(false)}
              style={styles.signModalCancel}
              accessibilityRole="button"
            >
              <Text style={styles.signModalCancelText}>
                {t('common.cancel', 'Cancel')}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* R66r48: Pay Now CTA — DK gradient + amber glow shadow. Was flat
          accentColor; gradient + shadow signals "primary action" in the
          customer's first interaction with the contractor's brand. */}
      {portalData.paymentLink && (
        <Pressable
          style={({ pressed }) => [styles.payNowButton, pressed && styles.pressed]}
          onPress={handlePayNow}
          accessibilityLabel={hasDeposit ? `Pay deposit ${depositLabel}` : `Pay now ${totalLabel}`}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={DK.effects.ctaGradient as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="lock-closed" size={18} color="#fff" />
          <Text style={styles.payNowButtonText}>
            {(hasDeposit
              ? t('decisionPortal.payDepositCta', 'Pay deposit — {{amount}}', { amount: depositLabel })
              : t('decisionPortal.payNowCta', 'Pay now — {{amount}}', { amount: totalLabel })).toUpperCase()}
          </Text>
        </Pressable>
      )}

      {/* R66r45: payment-method chips are informational only — they show
          which methods the contractor's Mollie account accepts. The actual
          method selection happens on the Mollie checkout page after Pay
          Now. Pre-R45 customers tapped the chips expecting them to start a
          checkout for that specific method; chips were View not Pressable
          so nothing happened — looked broken. Now prefixed with a clear
          "we accept" label so the role reads correctly. */}
      {portalData.paymentMethods && portalData.paymentMethods.length > 0 && (
        <View>
          <Text style={styles.paymentMethodsLabel}>
            {t('decisionPortal.weAccept', 'We accept').toUpperCase()}
          </Text>
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
        </View>
      )}

      {/* Security badge */}
      <View style={styles.securityBadge}>
        <Ionicons name="shield-checkmark" size={14} color={SemanticColors.feedbackSuccess} />
        <Text style={styles.securityBadgeText}>
          {t('decisionPortal.securePaymentVia', 'Secure payment via {{provider}}', { provider: portalData.contractorCountry === 'UK' ? 'Stripe' : 'Mollie' })}
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
  dateLocale?: string;
}

function CategoryCard({ category, accentColor, onPress, dateLocale }: CategoryCardProps) {
  const { t } = useTranslation();
  const progressPercent = category.totalCount > 0
    ? Math.round((category.completedCount / category.totalCount) * 100)
    : 0;
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
      style={({ pressed }) => [styles.categoryCard, hasOverdue && styles.categoryCardOverdue, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${category.name}, ${category.completedCount}/${category.totalCount}`}
    >
      <View style={[styles.categoryIcon, { backgroundColor: accentColor + '15' }]}>
        <Ionicons name={getIcon()} size={24} color={accentColor} />
      </View>
      <View style={styles.categoryContent}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryName}>{category.name}</Text>
          {hasOverdue && (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>{t('decisionPortal.overdue', 'Overdue')}</Text>
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
        <View style={styles.categoryDueRow}>
          <Text style={styles.categoryDue}>
            {new Date(category.dueDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
          </Text>
          {category.completedCount < category.totalCount && (
            <DeadlinePill dueDate={category.dueDate} overdue={hasOverdue} accentColor={accentColor} />
          )}
        </View>
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
  onSubmitDecision: (submission: CustomerDecisionSubmission) => void | Promise<SubmitResult | void>;
  onActivityLog?: (action: string, metadata?: Record<string, unknown>) => void;
  accentColor: string;
  // R303
  region?: string;
  trade?: string;
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
  region,
  trade,
}: CategoryDetailViewProps) {
  const { t } = useTranslation();
  const pendingItems = category.items.filter((i) => i.status === 'pending');
  const completedItems = category.items.filter((i) => i.status === 'decided');
  const dateLocale = getCountryConfig((portalData.contractorCountry ?? 'NL') as any).locale;
  // #2: a decided item the customer chose to change (re-render as editable).
  const [editingId, setEditingId] = useState<string | null>(null);
  // #4: pre-filled question seeded by a per-item "Ask about this" tap.
  const [askPrefill, setAskPrefill] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  // Local toast (this view is a separate render branch from the overview).
  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (kind: ToastKind, text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind, text });
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const submitDecision = async (
    item: CustomerPortalItem,
    value: string | number | boolean,
    notes?: string,
    linkedProduct?: CustomerDecisionSubmission['linkedProduct'],
    photoUrls?: string[],
    isEdit?: boolean,
  ) => {
    const result = await Promise.resolve(onSubmitDecision({
      itemId: item.id,
      trackerId: portalData.accessToken,
      customerId: 'customer',
      value,
      notes,
      photoUrls,
      deviceType: Platform.OS === 'ios' || Platform.OS === 'android' ? 'mobile' : 'desktop',
      linkedProduct,
      submittedAt: new Date().toISOString(),
    }));
    hapticSuccess();
    onExpandItem(null);
    setEditingId(null);
    onActivityLog?.(isEdit ? 'decision_changed' : 'decision_made', { itemId: item.id, value });
    // 'local' = saved on device but not yet confirmed to the contractor.
    if (result === 'local') {
      showToast('pending', t('decisionPortal.savedOffline', 'Saved on your device — we’ll send it to your contractor when you’re back online.'));
    } else if (isEdit) {
      showToast('success', t('decisionPortal.choiceUpdatedBody', 'Your contractor will see your updated choice.'));
    } else {
      const remaining = pendingItems.length - 1;
      showToast('success',
        remaining > 0
          ? t('decisionPortal.choiceSavedRemaining', '{{count}} choices left.', { count: remaining })
          : t('decisionPortal.allChoicesMade', 'All choices made! Your contractor will be notified.'),
      );
    }
  };

  // #4: seed the question composer with the item's name and scroll to it.
  const handleAskAbout = (itemName: string) => {
    setAskPrefill(t('decisionPortal.askAboutPrefill', 'About "{{name}}": ', { name: itemName }));
    onActivityLog?.('ask_about_item', { itemName });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.categoryDetailHeader}>
        <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.categoryDetailTitle}>
          <Text style={styles.categoryDetailName}>{category.name}</Text>
          <Text style={styles.categoryDetailCount}>
            {t('decisionPortal.detailCount', '{{done}} of {{total}} chosen', { done: category.completedCount, total: category.totalCount })}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.categoryDetailContent} ref={scrollRef}>
        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsSectionTitle}>{t('decisionPortal.toChoose', 'Still to choose')}</Text>
            {pendingItems.map((item) => (
              <DecisionItemCard
                key={item.id}
                item={item}
                region={region}
                trade={trade}
                isExpanded={expandedItem === item.id}
                onToggle={() => {
                  onExpandItem(expandedItem === item.id ? null : item.id);
                  if (expandedItem !== item.id) {
                    onActivityLog?.('item_viewed', { itemId: item.id });
                  }
                }}
                onSubmit={(value, notes, linkedProduct, photoUrls) =>
                  submitDecision(item, value, notes, linkedProduct, photoUrls, false)}
                onAskAbout={handleAskAbout}
                accentColor={accentColor}
                contractorCountry={portalData.contractorCountry}
                accessToken={portalData.accessToken}
              />
            ))}
          </View>
        )}

        {/* Completed Items — tappable "Change" reopens them as editable (#2). */}
        {completedItems.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsSectionTitle}>{t('decisionPortal.alreadyChosen', 'Already chosen')}</Text>
            {completedItems.map((item) =>
              editingId === item.id ? (
                <DecisionItemCard
                  key={item.id}
                  item={item}
                  region={region}
                  trade={trade}
                  isExpanded
                  onToggle={() => { setEditingId(null); onExpandItem(null); }}
                  onSubmit={(value, notes, linkedProduct, photoUrls) =>
                    submitDecision(item, value, notes, linkedProduct, photoUrls, true)}
                  onAskAbout={handleAskAbout}
                  accentColor={accentColor}
                  contractorCountry={portalData.contractorCountry}
                  accessToken={portalData.accessToken}
                />
              ) : (
                <CompletedItemCard
                  key={item.id}
                  item={item}
                  accentColor={accentColor}
                  dateLocale={dateLocale}
                  onChange={() => { setEditingId(item.id); onExpandItem(item.id); }}
                />
              )
            )}
          </View>
        )}

        {/* Free-text question — Decagon pattern. Low-stakes gets an AI auto-reply,
            high-stakes goes to the contractor's VascoCard queue for approval. */}
        <AskAQuestionCard
          accentColor={accentColor}
          trackerAccessToken={portalData.accessToken}
          contractorCountry={portalData.contractorCountry}
          portalData={portalData}
          initialQuestion={askPrefill}
        />

        <View style={{ height: 100 }} />
      </ScrollView>
      <PortalToast toast={toast} />
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
  initialQuestion,
}: {
  accentColor: string;
  trackerAccessToken: string;
  contractorCountry?: string;
  portalData: CustomerPortalData;
  initialQuestion?: string;
}) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');

  // #4: when a per-item "Ask about this" seeds a prefill, drop it into the
  // composer (only when non-empty + the customer hasn't started typing).
  useEffect(() => {
    if (initialQuestion) setQuestion(initialQuestion);
  }, [initialQuestion]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // #6: session Q&A thread — the customer can see what they asked + the
  // answer (instant AI reply, or "awaiting contractor"). Persists for the
  // session so re-reading earlier answers doesn't require re-asking.
  const [history, setHistory] = useState<{ q: string; a: string | null; pending: boolean }[]>([]);

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
        setError(result.error ?? t('decisionPortal.questionSendFailed', 'Could not send question'));
        return;
      }
      setHistory((prev) => [
        ...prev,
        { q: text, a: result.autoReply ?? null, pending: !result.autoReply },
      ]);
      setQuestion('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.askCard}>
      <View style={styles.askHeader}>
        <Ionicons name="chatbubble-ellipses" size={18} color={accentColor} />
        <Text style={styles.askTitle}>{t('decisionPortal.askTitle', 'Ask a question')}</Text>
      </View>
      <Text style={styles.askSubtitle}>
        {t('decisionPortal.askSubtitle', 'Ask about scheduling, location or work — get an instant reply or quick contractor confirmation.')}
      </Text>

      {/* #6: session Q&A thread — your earlier questions + their answers. */}
      {history.map((h, i) => (
        <View key={i} style={styles.qaThreadItem}>
          <View style={styles.qaQuestionRow}>
            <Ionicons name="person-circle-outline" size={15} color={DK.colors.textMuted} />
            <Text style={styles.qaQuestionText}>{h.q}</Text>
          </View>
          {h.a ? (
            <View style={styles.askReplyCard}>
              <Ionicons name="sparkles" size={14} color={accentColor} />
              <Text style={styles.askReplyText}>{h.a}</Text>
            </View>
          ) : (
            <View style={[styles.askReplyCard, { backgroundColor: SemanticColors.feedbackInfo + '10' }]}>
              <Ionicons name="time-outline" size={14} color={SemanticColors.feedbackInfo} />
              <Text style={[styles.askReplyText, { color: SemanticColors.feedbackInfo }]}>
                {t('decisionPortal.questionPending', 'Question sent. The contractor will reply shortly.')}
              </Text>
            </View>
          )}
        </View>
      ))}

      {error && (
        <View style={[styles.askReplyCard, { backgroundColor: SemanticColors.feedbackError + '10' }]}>
          <Ionicons name="alert-circle-outline" size={14} color={SemanticColors.feedbackError} />
          <Text style={[styles.askReplyText, { color: SemanticColors.feedbackError }]}>{error}</Text>
        </View>
      )}

      <TextInput
        style={[styles.textInput, { minHeight: 80 }]}
        placeholder={history.length > 0
          ? t('decisionPortal.questionPlaceholderMore', 'Ask another question…')
          : t('decisionPortal.questionPlaceholder', 'Type your question…')}
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
        accessibilityRole="button"
        accessibilityLabel={t('decisionPortal.askButton', 'Ask question')}
      >
        <Text style={styles.submitButtonText}>
          {submitting ? t('decisionPortal.sending', 'Sending…') : t('decisionPortal.askButton', 'Ask question')}
        </Text>
      </Pressable>
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
  // R303
  region?: string;
  trade?: string;
  // #4: per-item "Ask about this" — seeds the category's question composer.
  onAskAbout?: (itemName: string) => void;
}

function DecisionItemCard({
  item,
  isExpanded,
  onToggle,
  onSubmit,
  accentColor,
  contractorCountry,
  accessToken,
  region,
  trade,
  onAskAbout,
}: DecisionItemCardProps) {
  const { t } = useTranslation();
  const [textValue, setTextValue] = useState('');
  const [customerPhotos, setCustomerPhotos] = useState<Array<{ uri: string; base64?: string }>>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  // Tap-to-enlarge: which photo (option or uploaded) is open full-screen.
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
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
      case 'critical': return t('decisionPortal.priorityCritical', 'Important');
      case 'important': return t('decisionPortal.priorityRecommended', 'Recommended');
      default: return t('decisionPortal.priorityOptional', 'Optional');
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
      <Pressable style={({ pressed }) => [styles.itemHeader, pressed && styles.pressed]} onPress={onToggle} accessibilityRole="button" accessibilityLabel={item.name}>
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
              {t('decisionPortal.deadlinePassed', 'Deadline passed — choose as soon as possible')}
            </Text>
          </View>
        )}
        <View style={styles.itemToggle}>
          <Text style={[styles.itemToggleText, { color: accentColor }]}>
            {isExpanded ? t('decisionPortal.close', 'Close') : t('decisionPortal.makeChoice', 'Make choice')}
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
          {/* R303: regional preferences hint — hidden when k-anonymity not met */}
          <RegionalPreferencePanel
            region={region}
            trade={trade}
            decisionType={(item as any).itemId ?? item.id}
            accentColor={accentColor}
          />

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
              <Text style={styles.whyLabel}>{t('decisionPortal.whyImportant', 'Why is this important?')}</Text>
              <Text style={styles.whyText}>{item.whyItMatters}</Text>
            </View>
          )}

          {/* #4: per-item escape hatch for non-experts who feel stuck. */}
          {onAskAbout && (
            <Pressable
              style={({ pressed }) => [styles.askAboutBtn, pressed && styles.pressed]}
              onPress={() => onAskAbout(item.name)}
              accessibilityRole="button"
              accessibilityLabel={t('decisionPortal.askAboutThis', 'Not sure? Ask about this')}
            >
              <Ionicons name="help-buoy-outline" size={15} color={accentColor} />
              <Text style={[styles.askAboutBtnText, { color: accentColor }]}>
                {t('decisionPortal.askAboutThis', 'Not sure? Ask about this')}
              </Text>
            </Pressable>
          )}

          {/* Input Based on Type */}
          {item.inputType === 'select' && item.options && (
            <View style={styles.optionsGrid}>
              {item.options.map((option) => (
                <OptionButton
                  key={option.value}
                  option={option}
                  onSelect={() => onSubmit(option.value, notes)}
                  onViewPhoto={setLightboxUri}
                  accentColor={accentColor}
                />
              ))}
            </View>
          )}

          {item.inputType === 'boolean' && (
            <View style={styles.booleanOptions}>
              <Pressable
                style={({ pressed }) => [styles.booleanBtn, styles.booleanYes, pressed && styles.pressed]}
                onPress={() => onSubmit(true, notes)}
                accessibilityRole="button"
                accessibilityLabel={t('decisionPortal.yes', 'Yes')}
              >
                <Ionicons name="checkmark-circle" size={28} color={SemanticColors.feedbackSuccess} />
                <Text style={[styles.booleanText, { color: SemanticColors.feedbackSuccess }]}>
                  {t('decisionPortal.yes', 'Yes')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.booleanBtn, styles.booleanNo, pressed && styles.pressed]}
                onPress={() => onSubmit(false, notes)}
                accessibilityRole="button"
                accessibilityLabel={t('decisionPortal.no', 'No')}
              >
                <Ionicons name="close-circle" size={28} color={SemanticColors.feedbackError} />
                <Text style={[styles.booleanText, { color: SemanticColors.feedbackError }]}>
                  {t('decisionPortal.no', 'No')}
                </Text>
              </Pressable>
            </View>
          )}

          {(item.inputType === 'text' || item.inputType === 'color' || item.inputType === 'number') && (
            <View style={styles.textInputSection}>
              {item.exampleAnswer && (
                <Text style={styles.exampleText}>{t('decisionPortal.example', 'Example')}: {item.exampleAnswer}</Text>
              )}
              <TextInput
                style={styles.textInput}
                placeholder={t('decisionPortal.enterChoicePlaceholder', 'Enter your choice{{unit}}...', { unit: item.unit ? ` (${item.unit})` : '' })}
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
                accessibilityRole="button"
                accessibilityLabel={t('decisionPortal.confirm', 'Confirm')}
              >
                <Text style={styles.submitButtonText}>{t('decisionPortal.confirm', 'Confirm')}</Text>
              </Pressable>
            </View>
          )}

          {item.inputType === 'photo' && (
            <View style={styles.photoSection}>
              <Text style={styles.photoInstructions}>
                {t('decisionPortal.photoInstructions', "Send photos of your choice, or describe what you want. Multiple angles help the contractor more.")}
              </Text>

              {/* Photo thumbnails */}
              {photoUris.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GRID.sm, paddingVertical: GRID.xs }}>
                  {photoUris.map((uri, i) => (
                    <View key={uri + i} style={{ position: 'relative' }}>
                      <Pressable onPress={() => setLightboxUri(uri)} accessibilityRole="imagebutton" accessibilityLabel={t('decisionPortal.viewPhoto', 'View photo')}>
                        <Image source={{ uri }} style={{ width: 84, height: 84, borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfaceSecondary }} />
                      </Pressable>
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
                      accessibilityRole="button"
                      accessibilityLabel={t('decisionPortal.takePhoto', 'Take photo')}
                    >
                      <Ionicons name="camera" size={16} color={SemanticColors.textPrimary} />
                      <Text style={[styles.submitButtonText, { color: SemanticColors.textPrimary }]}>{t('decisionPortal.takePhoto', 'Take photo')}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.submitButton, { flex: 1, backgroundColor: SemanticColors.surfaceSecondary, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }]}
                      onPress={pickCustomerPhotos}
                      accessibilityRole="button"
                      accessibilityLabel={t('decisionPortal.fromGallery', 'From gallery')}
                    >
                      <Ionicons name="images-outline" size={16} color={SemanticColors.textPrimary} />
                      <Text style={[styles.submitButtonText, { color: SemanticColors.textPrimary }]}>{t('decisionPortal.fromGallery', 'From gallery')}</Text>
                    </Pressable>
                  </>
                )}
              </View>

              {/* Optional description */}
              <TextInput
                style={[styles.textInput, { minHeight: 60 }]}
                placeholder={t('decisionPortal.descPlaceholder', 'Description (optional) — or paste a link...')}
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
                accessibilityRole="button"
                accessibilityLabel={t('decisionPortal.send', 'Send')}
              >
                <Text style={styles.submitButtonText}>{uploadingPhotos ? t('decisionPortal.uploading', 'Uploading…') : t('decisionPortal.send', 'Send')}</Text>
              </Pressable>
            </View>
          )}

          {/* payment_method input type removed — payment handled via PaymentSection */}

          {/* Add Notes Toggle */}
          <Pressable
            style={({ pressed }) => [styles.addNotesToggle, pressed && styles.pressed]}
            onPress={() => setShowNotes(!showNotes)}
            accessibilityRole="button"
            accessibilityLabel={showNotes ? t('decisionPortal.hideNote', 'Hide note') : t('decisionPortal.addNote', 'Add note')}
          >
            <Ionicons
              name={showNotes ? 'chatbubble' : 'chatbubble-outline'}
              size={16}
              color={SemanticColors.textSecondary}
            />
            <Text style={styles.addNotesText}>
              {showNotes ? t('decisionPortal.hideNote', 'Hide note') : t('decisionPortal.addNote', 'Add note')}
            </Text>
          </Pressable>

          {showNotes && (
            <TextInput
              style={styles.notesInput}
              placeholder={t('decisionPortal.notePlaceholder', 'Add a comment...')}
              placeholderTextColor={SemanticColors.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          )}
        </View>
      )}
      <PhotoLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />
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
  onViewPhoto?: (uri: string) => void;
}

function OptionButton({ option, onSelect, accentColor, onViewPhoto }: OptionButtonProps) {
  const { t } = useTranslation();
  // R66 round 45: surface price context on every option (pre-R45 only
  // priceImpact != 0 rendered, so "standard" options showed nothing →
  // customer had no anchor to compare). Plus stock status + lead time.
  const priceLabel = (() => {
    if (option.priceImpact === undefined || option.priceImpact === 0) {
      return option.basePriceLabel ?? t('decisionPortal.included', 'Standard');
    }
    return `${option.priceImpact > 0 ? '+' : ''}${formatCurrency(Math.abs(option.priceImpact))}`;
  })();
  const priceColor = option.priceImpact === undefined || option.priceImpact === 0
    ? SemanticColors.textTertiary
    : option.priceImpact > 0
      ? SemanticColors.feedbackError
      : SemanticColors.feedbackSuccess;
  const stockMeta = (() => {
    if (option.stockStatus === 'in_stock') {
      return { label: t('decisionPortal.stockInStock', 'In stock'), color: SemanticColors.feedbackSuccess };
    }
    if (option.stockStatus === 'low_stock') {
      return { label: t('decisionPortal.stockLow', 'Limited stock'), color: SemanticColors.feedbackWarning };
    }
    if (option.stockStatus === 'order_only') {
      return { label: t('decisionPortal.stockOrder', 'Order on request'), color: SemanticColors.textTertiary };
    }
    if (option.stockStatus === 'special_order') {
      return { label: t('decisionPortal.stockSpecialOrder', 'Special order'), color: SemanticColors.textTertiary };
    }
    return null;
  })();
  const leadLabel = option.leadTimeDays && option.leadTimeDays > 0
    ? t('decisionPortal.leadTime', '{{days}} day delivery', { days: option.leadTimeDays })
    : null;
  return (
    <Pressable
      style={({ pressed }) => [styles.optionButton, pressed && styles.pressed]}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={`${option.label}${option.description ? ', ' + option.description : ''}`}
    >
      {option.imageUrl ? (
        // #5: render the real product photo (was a placeholder icon) so
        // non-expert customers can actually see what they're choosing.
        // Tapping the photo opens it full-screen (nested Pressable captures
        // the touch, so it doesn't also trigger the option's onSelect).
        <Pressable
          onPress={onViewPhoto ? () => onViewPhoto(option.imageUrl!) : undefined}
          accessibilityRole="imagebutton"
          accessibilityLabel={t('decisionPortal.viewPhotoOf', 'View photo of {{label}}', { label: option.label })}
        >
          <Image
            source={{ uri: option.imageUrl }}
            style={styles.optionImageReal}
            resizeMode="cover"
          />
          <View style={styles.optionImageZoom}>
            <Ionicons name="expand" size={12} color="#fff" />
          </View>
        </Pressable>
      ) : null}
      <View style={styles.optionContent}>
        <Text style={styles.optionLabel}>{option.label}</Text>
        {option.description && (
          <Text style={styles.optionDescription}>{option.description}</Text>
        )}
        <View style={styles.optionMetaRow}>
          <Text style={[styles.optionPrice, { color: priceColor }]}>{priceLabel}</Text>
          {stockMeta && (
            <View style={styles.optionMetaPill}>
              <View style={[styles.optionMetaDot, { backgroundColor: stockMeta.color }]} />
              <Text style={[styles.optionMetaText, { color: stockMeta.color }]}>{stockMeta.label}</Text>
            </View>
          )}
          {leadLabel && (
            <Text style={styles.optionLeadTime}>{leadLabel}</Text>
          )}
        </View>
      </View>
      <View style={[styles.optionSelect, { borderColor: accentColor }]}>
        <Text style={[styles.optionSelectText, { color: accentColor }]}>{t('decisionPortal.choose', 'Choose')}</Text>
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
  // #2: reopen this decided item as editable so the customer can change it.
  onChange?: () => void;
  dateLocale?: string;
}

function CompletedItemCard({ item, accentColor, onChange, dateLocale }: CompletedItemCardProps) {
  const { t } = useTranslation();
  const getDisplayValue = () => {
    if (typeof item.value === 'boolean') {
      return item.value ? t('decisionPortal.yes', 'Yes') : t('decisionPortal.no', 'No');
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
            {t('decisionPortal.chosenOn', 'Chosen on {{date}}', { date: new Date(item.decidedAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' }) })}
          </Text>
        )}
      </View>
      {onChange && (
        <Pressable
          onPress={onChange}
          hitSlop={8}
          style={({ pressed }) => [styles.changeBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('decisionPortal.changeChoice', 'Change')}
        >
          <Ionicons name="pencil" size={13} color={SemanticColors.textSecondary} />
          <Text style={styles.changeBtnText}>{t('decisionPortal.changeChoice', 'Change')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ============================================
// ACCESS CODE ENTRY
// ============================================

interface AccessCodeEntryProps {
  onSubmit: (code: string) => void;
  error?: string;
  // R191: errorKind drives contextual recovery UI. Pre-R191 every error
  // collapsed into a single small toast and the customer had no path
  // forward.
  errorKind?: 'invalid' | 'expired' | 'rateLimited' | 'network' | 'notFound' | null;
  rateLimitUntil?: number; // epoch ms; if rateLimited, button stays disabled until this passes
  onRetry?: () => void;
  isLoading?: boolean;
}

export function AccessCodeEntry({ onSubmit, error, errorKind, rateLimitUntil, onRetry, isLoading }: AccessCodeEntryProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  // R191: live countdown for rate-limit error
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  useEffect(() => {
    if (errorKind !== 'rateLimited' || !rateLimitUntil) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitUntil - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [errorKind, rateLimitUntil]);

  const isRateLimited = errorKind === 'rateLimited' && secondsLeft > 0;

  return (
    <View style={styles.accessContainer}>
      <View style={styles.accessContent}>
        <View style={styles.accessLogo}>
          <Ionicons name="home" size={48} color={Palette.hermesOrange} />
        </View>
        <Text style={styles.accessTitle}>{t('decisionPortal.accessTitle', 'Project choices')}</Text>
        <Text style={styles.accessSubtitle}>
          {t('decisionPortal.accessSubtitle', 'Enter the code you received from your contractor')}
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
            <Text style={styles.accessErrorText}>
              {isRateLimited
                ? t('decisionPortal.tryAgainIn', 'Try again in {{seconds}}s', { seconds: secondsLeft })
                : error}
            </Text>
          </View>
        )}

        <Pressable
          style={[
            styles.accessButton,
            (code.length < 6 || isRateLimited) && styles.accessButtonDisabled,
          ]}
          onPress={() => onSubmit(code)}
          disabled={code.length < 6 || isLoading || isRateLimited}
        >
          {isLoading ? (
            <Text style={styles.accessButtonText}>{t('decisionPortal.loading', 'Loading...')}</Text>
          ) : (
            <Text style={styles.accessButtonText}>{t('decisionPortal.continue', 'Continue')}</Text>
          )}
        </Pressable>

        {/* R191: contextual recovery CTAs. Replaces the static "No code?" hint
            with action-oriented copy + buttons based on what went wrong. */}
        {errorKind === 'expired' || errorKind === 'invalid' || errorKind === 'notFound' ? (
          <Text style={styles.accessHelp}>
            {t('decisionPortal.askForNew', 'Ask your contractor to send you a new link via WhatsApp or SMS.')}
          </Text>
        ) : errorKind === 'network' && onRetry ? (
          <Pressable style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]} onPress={onRetry} accessibilityRole="button">
            <Ionicons name="refresh" size={16} color={Palette.hermesOrange} />
            <Text style={styles.retryBtnText}>{t('decisionPortal.retry', 'Try again')}</Text>
          </Pressable>
        ) : (
          <Text style={styles.accessHelp}>
            {t('decisionPortal.accessHelp', 'No code? Ask your contractor for an access link.')}
          </Text>
        )}
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // R66 round 48: full DK dark slate background
  container: {
    flex: 1,
    backgroundColor: DK.colors.bg,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  // Shared tactile press feedback — applied to interactive Pressables so the
  // customer portal feels responsive on every tap (was 0/21 before).
  pressed: {
    opacity: 0.82,
  },

  // Phase 2: "How this works" orientation card for non-expert customers.
  howToCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1,
    borderColor: DK.colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  howToHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  howToHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: DK.colors.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howToTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: DK.type.display800,
    color: DK.colors.text,
    letterSpacing: 0.2,
  },
  howToStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  howToStepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DK.colors.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howToStepNumText: {
    fontSize: 11,
    fontFamily: DK.type.display900,
  },
  howToStepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: DK.type.body500,
    color: DK.colors.textMuted,
  },

  // Language switcher bar (top of portal)
  langBar: { alignItems: 'flex-end', marginBottom: Spacing.sm },

  // #3 running cost summary
  selectionSummary: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1,
    borderColor: DK.colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: 4,
  },
  selectionSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  selectionSummaryLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: DK.type.display800,
    color: DK.colors.text,
  },
  selectionSummaryValue: { fontSize: 16, fontFamily: DK.type.display900, letterSpacing: -0.3 },
  selectionSummaryHint: { fontSize: 11, fontFamily: DK.type.body500, color: DK.colors.textMuted, marginLeft: 24 },

  // #6 glossary link + modal
  glossaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  glossaryLinkText: { fontSize: 13, fontFamily: DK.type.display800, letterSpacing: 0.2 },
  glossaryModalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  glossaryModalCard: {
    backgroundColor: DK.colors.bg,
    borderTopLeftRadius: DK.radius.card,
    borderTopRightRadius: DK.radius.card,
    padding: Spacing.lg,
    maxHeight: '82%',
    borderTopWidth: 1,
    borderColor: DK.colors.border,
  },
  glossaryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  glossaryModalTitle: { fontSize: 18, fontFamily: DK.type.display900, color: DK.colors.text, letterSpacing: -0.3 },
  glossaryEntry: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1,
    borderColor: DK.colors.border,
    padding: Spacing.md,
    gap: 4,
  },
  glossaryTerm: { fontSize: 14, fontFamily: DK.type.display800, color: DK.colors.text },
  glossaryDef: { fontSize: 13, lineHeight: 19, fontFamily: DK.type.body500, color: DK.colors.textMuted },

  // #4 per-item "Ask about this"
  askAboutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: DK.colors.panel2,
    marginBottom: Spacing.sm,
  },
  askAboutBtnText: { fontSize: 12, fontFamily: DK.type.display800, letterSpacing: 0.2 },

  // #2 change a completed choice
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DK.colors.border,
    alignSelf: 'center',
  },
  changeBtnText: { fontSize: 12, fontFamily: DK.type.body600, color: SemanticColors.textSecondary },

  // #5 real option photo
  optionImageReal: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    backgroundColor: DK.colors.panel2,
    marginRight: Spacing.sm,
  },

  // Toast (#3)
  toast: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: DK.colors.panel2,
    borderWidth: 1,
    borderRadius: DK.radius.card,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  toastText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: DK.type.body600, color: DK.colors.text },

  // Project timeline (#7)
  timeline: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1,
    borderColor: DK.colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  timelineTitle: { fontSize: 11, fontFamily: DK.type.display800, color: DK.colors.textMuted, letterSpacing: 1.4 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: Spacing.md },
  timelineStep: { alignItems: 'center', width: 70, position: 'relative' },
  timelineDot: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: DK.colors.border,
    backgroundColor: DK.colors.panel2,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  timelineDotNum: { fontSize: 11, fontFamily: DK.type.display800, color: DK.colors.textMuted },
  timelineStepText: { fontSize: 10, fontFamily: DK.type.body500, color: DK.colors.textMuted, marginTop: 5, textAlign: 'center' },
  timelineBar: {
    position: 'absolute', top: 12, left: '50%', right: -35, height: 2,
    backgroundColor: DK.colors.border, zIndex: 1,
  },

  // All-done banner (#5)
  allDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: DK.colors.success + '12',
    borderWidth: 1,
    borderColor: DK.colors.success + '40',
    borderRadius: DK.radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  allDoneIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DK.colors.success + '1F',
    alignItems: 'center', justifyContent: 'center',
  },
  allDoneTitle: { fontSize: 15, fontFamily: DK.type.display800, color: DK.colors.text },
  allDoneText: { fontSize: 13, lineHeight: 18, fontFamily: DK.type.body500, color: DK.colors.textMuted, marginTop: 2 },

  // Q&A thread (#6)
  qaThreadItem: { gap: 6, marginBottom: Spacing.sm },
  qaQuestionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  qaQuestionText: { flex: 1, fontSize: 13, fontFamily: DK.type.body600, color: DK.colors.text },

  // Photo lightbox
  lightboxRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '80%' },
  lightboxClose: {
    position: 'absolute', top: 48, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  optionImageZoom: {
    position: 'absolute', bottom: 4, right: Spacing.sm + 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Deadline urgency pill
  categoryDueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  deadlinePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  deadlinePillText: { fontSize: 11, fontFamily: DK.type.display800, letterSpacing: 0.2 },

  // R66 round 49: payment-success celebration hero. Full-bleed gradient
  // (success-green ramp) + glow + big Archivo display amount.
  successHero: {
    borderRadius: DK.radius.card,
    paddingVertical: 28,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 36,
    elevation: 8,
  },
  successCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 6,
  },
  successHeroLabel: {
    fontSize: 12,
    fontFamily: DK.type.display800,
    color: '#fff',
    letterSpacing: 2,
  },
  successHeroAmount: {
    fontSize: 40,
    fontFamily: DK.type.display900,
    color: '#fff',
    letterSpacing: -1,
  },
  successHeroSubtext: {
    fontSize: 13,
    fontFamily: DK.type.body500,
    color: '#fff',
    opacity: 0.92,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  // R66 round 48: unified hero with gradient + amber glow
  hero: {
    borderRadius: DK.radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DK.colors.border,
    gap: Spacing.md,
    ...DK.effects.heroGlow,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contractorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contractorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DK.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  contractorInitials: {
    fontSize: 16,
    fontFamily: DK.type.display900,
    letterSpacing: 0.5,
  },
  contractorName: {
    fontSize: 14,
    fontFamily: DK.type.display800,
    color: DK.colors.text,
  },
  companyName: {
    fontSize: 12,
    fontFamily: DK.type.body500,
    color: DK.colors.textMuted,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: DK.colors.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DK.colors.success + '40',
  },
  // Project name now lives inside hero — bigger, Archivo display
  projectName: {
    fontSize: 26,
    fontFamily: DK.type.display900,
    color: DK.colors.text,
    letterSpacing: -0.5,
  },
  projectDates: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: -Spacing.sm,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    fontFamily: DK.type.body500,
    color: DK.colors.textMuted,
  },
  // Progress block — sits inside hero
  heroProgressBlock: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: DK.colors.border,
    gap: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: DK.type.display800,
    color: DK.colors.textMuted,
    letterSpacing: 1.6,
  },
  progressPercent: {
    fontSize: 22,
    fontFamily: DK.type.display900,
    color: DK.colors.text,
    letterSpacing: -0.5,
  },
  progressBar: {
    height: 8,
    backgroundColor: DK.colors.panel2,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  // R66r48: gradient-filled wrapper replaces the flat colored fill
  progressFillWrap: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  progressStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressStatText: {
    fontSize: 12,
    fontFamily: DK.type.body500,
    color: DK.colors.textMuted,
  },

  // R66 round 48 — Urgent Banner with DK panel + danger glow
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DK.colors.danger + '14',
    borderRadius: DK.radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: DK.colors.danger + '40',
    shadowColor: DK.colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  urgentIcon: {
    marginRight: Spacing.sm,
  },
  urgentContent: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 13,
    fontFamily: DK.type.display800,
    color: DK.colors.danger,
    letterSpacing: 0.3,
  },
  urgentText: {
    fontSize: 12,
    fontFamily: DK.type.body500,
    color: DK.colors.textMuted,
    marginTop: 2,
  },

  // Categories Section
  categoriesSection: {
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: DK.type.display800,
    color: DK.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: Spacing.sm,
  },

  // R66 round 48 — Category card with DK panel + amber-on-active state
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  categoryCardOverdue: {
    borderColor: DK.colors.danger + '60',
    borderLeftWidth: 3,
    borderLeftColor: DK.colors.danger,
    shadowColor: DK.colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  categoryIcon: {
    width: 44,
    height: 44,
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
    fontSize: 14,
    fontFamily: DK.type.display700,
    color: DK.colors.text,
  },
  overdueBadge: {
    backgroundColor: DK.colors.danger + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: DK.colors.danger + '40',
  },
  overdueBadgeText: {
    fontSize: 9,
    fontFamily: DK.type.display800,
    color: DK.colors.danger,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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

  // R66 round 48 — Item Card with DK panel + display800 priority badges
  itemCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: DK.colors.border,
    overflow: 'hidden',
  },
  itemCardOverdue: {
    borderColor: DK.colors.danger + '60',
    borderLeftWidth: 3,
    borderLeftColor: DK.colors.danger,
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
    fontSize: 15,
    fontFamily: DK.type.display700,
    color: DK.colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  priorityText: {
    fontSize: 9,
    fontFamily: DK.type.display800,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  itemDescription: {
    fontSize: 13,
    fontFamily: DK.type.body500,
    color: DK.colors.textMuted,
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
  },
  // R66r45: meta row holds price + stock pill + lead time on one line
  optionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  optionMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  optionMetaDot: { width: 5, height: 5, borderRadius: 3 },
  optionMetaText: { fontSize: 10, fontWeight: '600' },
  optionLeadTime: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    fontWeight: '500',
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
  // R66 round 48: per-item submit (Confirm / Yes / Send photos) — gradient
  // pill via inline LinearGradient at the call sites that already wrap.
  // Background color removed since LinearGradient absoluteFill provides it.
  submitButton: {
    borderRadius: DK.radius.button,
    padding: Spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 13,
    fontFamily: DK.type.display800,
    color: '#fff',
    letterSpacing: 1.2,
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
  // R191 — retry button for network-error recovery state
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '55',
    backgroundColor: Palette.hermesOrange + '0E',
    alignSelf: 'center',
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },

  // Payment Section
  // R66 round 48: full DK treatment for payment surface
  paymentSection: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: DK.colors.border,
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
    fontSize: 17,
    fontFamily: DK.type.display800,
    color: DK.colors.text,
  },
  paymentSubtext: {
    fontSize: 12,
    fontFamily: DK.type.body500,
    color: DK.colors.textMuted,
    marginTop: 2,
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  paymentBadgeText: {
    fontSize: 10,
    fontFamily: DK.type.display800,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  paymentAmounts: {
    backgroundColor: DK.colors.panel2,
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
    fontSize: 13,
    fontFamily: DK.type.body500,
    color: DK.colors.textMuted,
  },
  paymentAmountValue: {
    fontSize: 14,
    fontFamily: DK.type.display700,
    color: DK.colors.text,
  },
  paymentReadyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DK.colors.success + '20',
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: DK.colors.success + '40',
  },
  paymentReadyText: {
    fontSize: 13,
    fontFamily: DK.type.body500,
    color: DK.colors.success,
    flex: 1,
  },
  // R66r56: customer acknowledgment-signature UI
  signAckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  signAckButtonText: {
    fontSize: 13,
    fontFamily: DK.type.body600,
    color: SemanticColors.textSecondary,
  },
  signedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DK.colors.success + '15',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  signedBadgeText: {
    fontSize: 12,
    fontFamily: DK.type.body500,
    color: DK.colors.success,
    flex: 1,
  },
  signModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  signModalCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  signModalTitle: {
    fontSize: 18,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  signModalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textSecondary,
  },
  signModalInput: {
    backgroundColor: DK.colors.panel2,
    borderRadius: RADIUS.md,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textPrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  signModalCancel: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  signModalCancelText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.textTertiary,
  },
  // R66r48: Pay Now CTA — overflow:hidden + glow shadow + display800 label
  payNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: DK.radius.button,
    paddingVertical: 16,
    overflow: 'hidden',
    minHeight: 52,
    ...DK.effects.ctaShadow,
  },
  payNowButtonText: {
    fontSize: 14,
    fontFamily: DK.type.display800,
    color: '#fff',
    letterSpacing: 1.2,
  },
  // R66r45: clarifies the chip row is informational ("we accept these")
  paymentMethodsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: SemanticColors.textTertiary,
    marginBottom: 6,
    marginTop: 8,
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

  // R66 round 48 — "Ask a question" card with full DK panel treatment
  askCard: {
    marginTop: GRID.md,
    padding: GRID.md,
    borderRadius: DK.radius.card,
    backgroundColor: DK.colors.panel,
    borderWidth: 1,
    borderColor: DK.colors.border,
    gap: GRID.sm,
  },
  askHeader: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  askTitle: {
    fontSize: 14,
    fontFamily: DK.type.display800,
    color: DK.colors.text,
    letterSpacing: 0.3,
  },
  askSubtitle: {
    fontSize: 12,
    fontFamily: DK.type.body500,
    color: DK.colors.textMuted,
    lineHeight: 18,
  },
  askReplyCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: GRID.xs,
    padding: GRID.sm, borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '10',
  },
  askReplyText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary, lineHeight: 18 },
});
