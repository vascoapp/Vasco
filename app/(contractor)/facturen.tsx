// =============================================================================
// FACTUREN - Invoices & Quotes (Simplified)
// =============================================================================
// Clean invoice management with integrated financial auditing
// =============================================================================

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  RefreshControl,
  LayoutAnimation,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, GRID, RADIUS, TYPE } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { TieredQuoteBuilder } from '../../src/components/contractor/TieredQuoteBuilder';
import { useCashFlow, type Invoice } from '../../src/services/cashFlowService';
import { ContractorDashboardHeader } from '../../src/components/contractor/ContractorDashboardHeader';
import { LoadingSkeleton } from '../../src/components/shared/LoadingSkeleton';
import { BottomSheet, type BottomSheetAction } from '../../src/components/shared/BottomSheet';
import { useAppState } from '../../src/state/AppState';

// Integrate financial auditor for invoice verification
import { useFinancialAuditFindings } from '../../src/services/financialAuditorService';
import { hapticSuccess } from '../../src/utils/haptics';
import { Share } from 'react-native';
import { invoiceAutomationService } from '../../src/services/invoiceAutomationService';
import { generateInvoicePdf, buildInvoiceShareText } from '../../src/services/invoicePdfService';
import { createPaymentLink as createMolliePaymentLink } from '../../src/integrations/mollie';
import { createPaymentLink as createStripePaymentLink } from '../../src/integrations/stripe';
import { SUPPORTED_METHODS } from '../../src/integrations/stripe';
import { useAuth } from '../../src/context/AuthContext';
import { getMollieMethodsForCountry } from '../../src/config/paymentMethods';
import { calculateLatePaymentInterest } from '../../src/services/dutchComplianceService';
import { useTranslation } from 'react-i18next';

// P3: Collections Agent
import { useCollectionsAgent } from '../../src/services/collectionsAgentService';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { useQuoteApprovals, useApprovalStats } from '../../src/services/quoteApprovalService';
import type { DunningSequence as DunningSeqType } from '../../src/services/collectionsAgentService';
import { predictCustomerDSO } from '../../src/intelligence/predictions';
import { Toast } from '../../src/components/shared/Toast';
import { getCustomerPaymentPreference } from '../../src/services/customerPaymentPreferenceService';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// TYPES
// ============================================

type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

interface Quote {
  id: string;
  reference: string;
  customer: string;
  title: string;
  status: QuoteStatus;
  sentDate?: string;
  total: number;
  tiers: { good: number; better: number; best: number };
  selectedTier?: 'good' | 'better' | 'best';
  viewCount?: number;
}

// ============================================
// COMPONENTS
// ============================================

function DSOHint({ customerId, amount }: { customerId: string; amount?: number }) {
  const { t } = useTranslation();
  const [dsoData, setDsoData] = useState<{ predictedDSO: number } | null>(null);
  const [mlPrediction, setMlPrediction] = useState<{ predictedDays: number; risk: string; probability30d: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    predictCustomerDSO(customerId).then((result) => {
      if (!cancelled) setDsoData(result);
    });
    // ML payment prediction
    import('../../src/intelligence/mlModels').then(({ predictPaymentTiming }) => {
      predictPaymentTiming({ customerId, amount: amount ?? 0 }).then((result) => {
        if (!cancelled) setMlPrediction(result);
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [customerId, amount]);
  if (!dsoData && !mlPrediction) return null;
  const days = mlPrediction?.predictedDays ?? dsoData?.predictedDSO ?? 21;
  const riskColor = mlPrediction?.risk === 'low' ? SemanticColors.feedbackSuccess : mlPrediction?.risk === 'high' ? SemanticColors.feedbackError : Palette.hermesOrange;
  return (
    <Text style={{ fontSize: 11, fontFamily: TYPE.bodyFamily, color: riskColor, marginTop: 2 }}>
      {t('invoices.expectedPayment', 'Verwachte betaling')}: ~{days} {t('invoices.days', 'dagen')}
      {mlPrediction ? ` · ${Math.round(mlPrediction.probability30d * 100)}% binnen 30d` : ''}
    </Text>
  );
}

function InvoiceList({ invoices, expandedId, onToggleExpand }: { invoices: Invoice[]; expandedId: string | null; onToggleExpand: (id: string) => void }) {
  const { t } = useTranslation();
  const { businessProfile } = useAppState();
  const { user } = useAuth();

  // Determine payment provider based on country (UK → Stripe, all others → Mollie)
  // Respect contractor's enabled payment methods from business settings
  // When a customer has a payment preference (from decision tracker), prioritize that method
  const createPaymentLink = useCallback(async (request: { invoiceId: string; amount: number; description: string; customerPreferredMethod?: string }) => {
    const country = user?.country ?? 'NL';
    const enabledMethods = businessProfile?.enabledPaymentMethods;
    const preferredMethod = request.customerPreferredMethod;

    if (country === 'UK') {
      const allMethods = SUPPORTED_METHODS[country] ?? SUPPORTED_METHODS.UK;
      let paymentMethods = enabledMethods
        ? allMethods.filter((m: string) => enabledMethods.includes(m))
        : allMethods;
      // Pre-select customer preferred method by putting it first
      if (preferredMethod) {
        const preferred = paymentMethods.find((m: string) => m.toLowerCase() === preferredMethod.toLowerCase());
        if (preferred) {
          paymentMethods = [preferred, ...paymentMethods.filter((m: string) => m !== preferred)];
        }
      }
      return createStripePaymentLink({ ...request, currency: 'GBP', paymentMethods });
    }
    const countryMethods = getMollieMethodsForCountry(country).methods;
    let methods = enabledMethods
      ? countryMethods.filter(m => enabledMethods.includes(m))
      : countryMethods;
    // Pre-select customer preferred method by putting it first
    if (preferredMethod) {
      const preferred = methods.find(m => m.toLowerCase() === preferredMethod.toLowerCase());
      if (preferred) {
        methods = [preferred, ...methods.filter(m => m !== preferred)];
      }
    }
    return createMolliePaymentLink({ ...request, method: methods });
  }, [user?.country, businessProfile?.enabledPaymentMethods]);
  const getStatusConfig = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return { label: t('invoices.statusPaid', 'Betaald'), color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' as IconName };
      case 'sent':
        return { label: t('invoices.statusSent', 'Verzonden'), color: SemanticColors.feedbackInfo, icon: 'paper-plane' as IconName };
      case 'viewed':
        return { label: t('invoices.statusViewed', 'Bekeken'), color: Palette.hermesOrange, icon: 'eye' as IconName };
      case 'overdue':
        return { label: t('invoices.statusOverdue', 'Verlopen'), color: SemanticColors.feedbackError, icon: 'alert-circle' as IconName };
      default:
        return { label: t('invoices.statusDraft', 'Concept'), color: SemanticColors.textTertiary, icon: 'document' as IconName };
    }
  };

  if (invoices.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={40} color={SemanticColors.textTertiary} />
        <Text style={styles.emptyStateText}>{t('invoices.emptyInvoices', 'Nog geen facturen')}</Text>
      </View>
    );
  }

  // Sort by to-do hierarchy: overdue first, then sent/viewed (actionable), then draft, then paid
  const statusPriority: Record<string, number> = {
    overdue: 0,
    sent: 1,
    viewed: 2,
    draft: 3,
    paid: 4,
  };
  const sorted = [...invoices].sort((a, b) => {
    const priorityDiff = (statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
  });

  return (
    <View style={styles.invoiceCardList}>
      {sorted.map((invoice) => {
        const status = getStatusConfig(invoice.status);
        const isExpanded = expandedId === invoice.id;
        const showActions = ['sent', 'viewed', 'overdue'].includes(invoice.status);
        return (
          <View key={invoice.id}>
            <Pressable
              style={styles.invoiceCard}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                onToggleExpand(isExpanded ? '' : invoice.id);
              }}
            >
              <View style={[styles.invoiceCardAccent, { backgroundColor: status.color }]} />
              <Ionicons name={status.icon} size={20} color={status.color} style={{ marginLeft: Spacing.sm }} />
              <View style={styles.invoiceInfo}>
                <Text style={styles.invoiceCustomer} numberOfLines={1}>{invoice.customerName}</Text>
                <Text style={styles.invoiceProject} numberOfLines={1}>{invoice.projectName}</Text>
                {invoice.status !== 'paid' && <DSOHint customerId={invoice.id} />}
              </View>
              <View style={styles.invoiceRight}>
                <Text style={[
                  styles.invoiceAmount,
                  invoice.status === 'paid' && { color: SemanticColors.feedbackSuccess }
                ]}>
                  €{invoice.amount.toLocaleString()}
                </Text>
                <Text style={[styles.invoiceStatus, { color: status.color }]}>{status.label}</Text>
                {invoice.status === 'overdue' && (() => {
                  const daysOverdue = Math.max(1, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
                  const interest = calculateLatePaymentInterest(invoice.amount, daysOverdue);
                  return (
                    <Text style={{ fontSize: 10, fontFamily: TYPE.bodyFamily, color: SemanticColors.feedbackError, marginTop: 2 }}>
                      {t('invoices.lateInterest', 'Interest')}: €{interest.interest.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({t('invoices.commercialInterestRate', '8% commercial interest')})
                    </Text>
                  );
                })()}
              </View>
            </Pressable>
            {isExpanded && showActions && (
              <View style={styles.invoiceActions}>
                <Pressable
                  style={styles.invoiceActionBtn}
                  onPress={async () => {
                    const autoInv = invoiceAutomationService.getInvoice(invoice.id);
                    if (autoInv) {
                      const link = await createPaymentLink({
                        invoiceId: invoice.id,
                        amount: autoInv.total,
                        description: t('invoices.invoicePrefix', 'Invoice {{number}}', { number: autoInv.invoiceNumber }),
                      });
                      hapticSuccess();
                      const text = buildInvoiceShareText(autoInv, businessProfile.businessName, link?.url);
                      await Share.share({ message: text, title: t('invoices.sendReminder', 'Herinnering') + ` ${autoInv.invoiceNumber}` });
                    } else {
                      hapticSuccess();
                      Alert.alert(t('invoices.reminderSent', 'Herinnering verstuurd'), t('invoices.reminderSentDesc', 'Betaalherinnering verstuurd.'));
                    }
                  }}
                >
                  <Ionicons name="notifications-outline" size={16} color={Palette.hermesOrange} />
                  <Text style={styles.invoiceActionText}>{t('invoices.reminder', 'Herinnering')}</Text>
                </Pressable>
                <Pressable
                  style={styles.invoiceActionBtn}
                  onPress={async () => {
                    const autoInv = invoiceAutomationService.getInvoice(invoice.id);
                    if (autoInv) {
                      hapticSuccess();
                      const link = await createPaymentLink({
                        invoiceId: invoice.id,
                        amount: autoInv.total,
                        description: t('invoices.invoicePrefix', 'Invoice {{number}}', { number: autoInv.invoiceNumber }),
                      });
                      await generateInvoicePdf(autoInv, businessProfile, link?.url);
                    } else {
                      Alert.alert(t('invoices.downloadPdf', 'PDF'), t('invoices.invoiceNotFound', 'Factuur niet gevonden in automatiseringssysteem.'));
                    }
                  }}
                >
                  <Ionicons name="document-outline" size={16} color={Palette.hermesOrange} />
                  <Text style={styles.invoiceActionText}>{t('invoices.sharePdf', 'PDF delen')}</Text>
                </Pressable>
                <Pressable
                  style={styles.invoiceActionBtn}
                  onPress={async () => {
                    const link = await createPaymentLink({
                      invoiceId: invoice.id,
                      amount: invoice.amount,
                      description: t('invoices.invoicePrefix', 'Invoice {{number}}', { number: invoice.id }),
                    });
                    if (link?.url) {
                      hapticSuccess();
                      Alert.alert(
                        t('invoices.paymentLinkCreated', 'Payment link created'),
                        `${t('invoices.paymentLinkReady', 'Payment link is ready to share')}:\n${link.url}`,
                      );
                      await Share.share({ message: `${t('invoices.paymentLink', 'Betaallink')}: €${invoice.amount.toLocaleString()}\n${link.url}`, title: t('invoices.paymentLink', 'Betaallink') });
                    } else {
                      Alert.alert(t('invoices.error', 'Fout'), t('invoices.paymentLinkFailed', 'Betaallink kon niet worden aangemaakt.'));
                    }
                  }}
                >
                  <Ionicons name="link-outline" size={16} color={Palette.hermesOrange} />
                  <Text style={styles.invoiceActionText}>{t('invoices.paymentLink', 'Betaallink')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function QuoteItem({ quote, onPress }: { quote: Quote; onPress: () => void }) {
  const { t } = useTranslation();
  const getStatusConfig = (status: QuoteStatus) => {
    switch (status) {
      case 'viewed':
        return { label: t('invoices.quoteViewed', 'Bekeken'), color: Palette.hermesOrange, icon: 'eye' as IconName };
      case 'accepted':
        return { label: t('invoices.quoteAccepted', 'Geaccepteerd'), color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' as IconName };
      case 'rejected':
        return { label: t('invoices.quoteRejected', 'Afgewezen'), color: SemanticColors.feedbackError, icon: 'close-circle' as IconName };
      default:
        return { label: t('invoices.quoteSent', 'Verstuurd'), color: SemanticColors.feedbackInfo, icon: 'paper-plane' as IconName };
    }
  };

  const status = getStatusConfig(quote.status);

  return (
    <Pressable style={styles.quoteCard} onPress={onPress}>
      <View style={[styles.quoteCardAccent, { backgroundColor: status.color }]} />
      <Ionicons name={status.icon} size={20} color={status.color} style={{ marginLeft: Spacing.sm }} />
      <View style={styles.quoteInfo}>
        <Text style={styles.quoteCustomer} numberOfLines={1}>{quote.customer}</Text>
        <Text style={styles.quoteTitle} numberOfLines={1}>{quote.title}</Text>
      </View>
      <View style={styles.quoteRight}>
        <Text style={styles.quoteAmount}>€{quote.total.toLocaleString()}</Text>
        <Text style={[styles.quoteStatus, { color: status.color }]}>{status.label}</Text>
      </View>
    </Pressable>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

type TabView = 'offertes' | 'facturen' | 'incasso';

export default function FacturenScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>('offertes');
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [overdueDismissed, setOverdueDismissed] = useState(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bottomSheet, setBottomSheet] = useState<{ visible: boolean; title: string; actions: BottomSheetAction[] }>({ visible: false, title: '', actions: [] });
  const closeBottomSheet = useCallback(() => setBottomSheet(prev => ({ ...prev, visible: false })), []);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const scrollViewRef = useRef<ScrollView>(null);

  // Screen visit tracking
  useEffect(() => { recordScreenVisit('invoices'); }, []);

  // Brief loading state with 300ms minimum to prevent flicker
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      hapticSuccess();
    }, 800);
  }, []);

  // Connect to services
  const { jobs, addInvoiceFromJob, businessProfile } = useAppState();
  const { invoices, summary } = useCashFlow();
  const { findings: auditFindings } = useFinancialAuditFindings();

  // P3: Collections Agent
  const { summary: collectionsSummary, sequences: dunningSequences, alerts: cashGapAlerts, dso } = useCollectionsAgent();

  // Quote Approvals
  const { approvals: pendingApprovals, approve: approveQuote, reject: rejectQuote } = useQuoteApprovals('pending');
  const approvalStats = useApprovalStats();

  // Compute KPI values
  const pendingInvoices = invoices.filter(i => ['sent', 'viewed'].includes(i.status));
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const pendingValue = pendingInvoices.reduce((sum, i) => sum + i.amount, 0);
  const overdueValue = overdueInvoices.reduce((sum, i) => sum + i.amount, 0);

  // Transform invoices to quotes
  const quotes = useMemo((): Quote[] => {
    return invoices
      .filter(inv => ['sent', 'viewed', 'draft'].includes(inv.status))
      .map((inv): Quote => ({
        id: inv.id,
        reference: `Q-${inv.id.replace('inv_', '')}`,
        customer: inv.customerName,
        title: inv.projectName,
        status: inv.status === 'viewed' ? 'viewed' : inv.status === 'draft' ? 'draft' : 'sent',
        sentDate: new Date(inv.issueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        total: inv.amount,
        tiers: {
          good: Math.round(inv.amount * 0.75),
          better: Math.round(inv.amount * 0.9),
          best: inv.amount,
        },
      }));
  }, [invoices]);

  // Check for audit alerts
  const hasAuditAlert = auditFindings.some(f => f.severity === 'critical' && f.status === 'new');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('invoices.title', 'Facturen')}</Text>
          <Text style={styles.headerSubtitle}>{invoices.length} {t('invoices.invoices', 'facturen')} · {quotes.length} {t('invoices.quotes', 'offertes')}</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowQuoteBuilder(true)}
        >
          <Ionicons name="add" size={22} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      {/* KPI Header */}
      <View style={{ paddingHorizontal: Spacing.md }}>
        <ContractorDashboardHeader
          kpis={[
            { icon: 'receipt', value: `€${pendingValue.toLocaleString()}`, label: t('invoices.outstanding', 'Openstaand') },
            { icon: 'timer', value: `${dso.currentDSO}d`, label: 'DSO', color: dso.trend === 'worsening' ? SemanticColors.feedbackError : dso.trend === 'improving' ? SemanticColors.feedbackSuccess : undefined },
            { icon: 'document-text', value: String(quotes.length), label: t('invoices.quotes', 'Offertes'), color: Palette.hermesOrange },
          ]}
        />
      </View>

      {/* Audit Alert */}
      {hasAuditAlert && (
        <View style={styles.auditAlert}>
          <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
          <Text style={styles.auditAlertText}>
            {t('invoices.auditDiscrepancy', 'Factuur discrepantie gedetecteerd')}
          </Text>
          <Pressable onPress={() => {
            const critical = auditFindings.find(f => f.severity === 'critical' && f.status === 'new');
            if (critical) {
              setBottomSheet({
                visible: true,
                title: `${t('invoices.invoiceDiscrepancy', 'Factuur Discrepantie')}\n\n${critical.title}\n\n${critical.description}${critical.suggestedAction ? `\n\n${t('invoices.recommendation', 'Aanbeveling')}: ${critical.suggestedAction.description}` : ''}`,
                actions: [
                  { label: t('invoices.close', 'Sluiten'), icon: 'close-outline', onPress: closeBottomSheet },
                ],
              });
            }
          }}>
            <Text style={styles.auditAlertAction}>{t('invoices.view', 'Bekijk')}</Text>
          </Pressable>
        </View>
      )}

      {/* Sticky Overdue Banner */}
      {!overdueDismissed && overdueValue > 0 && (
        <View style={styles.stickyOverdueBanner}>
          <View style={styles.stickyOverdueLeft}>
            <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
            <Text style={styles.stickyOverdueText}>
              {overdueInvoices.length} {t('invoices.invoicesOverdue', 'facturen verlopen')} · {'\u20AC'}{overdueValue.toLocaleString()}
            </Text>
          </View>
          <View style={styles.stickyOverdueActions}>
            <Pressable
              onPress={() => {
                setActiveTab('facturen');
                hapticSuccess();
              }}
            >
              <Text style={styles.stickyOverdueAction}>{t('invoices.view', 'Bekijk')}</Text>
            </Pressable>
            <Pressable onPress={() => setOverdueDismissed(true)}>
              <Ionicons name="close" size={16} color={SemanticColors.feedbackError} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'offertes' && styles.tabActive]}
          onPress={() => setActiveTab('offertes')}
        >
          <Text style={[styles.tabText, activeTab === 'offertes' && styles.tabTextActive]}>
            {t('invoices.tabQuotes', 'Offertes')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'facturen' && styles.tabActive]}
          onPress={() => setActiveTab('facturen')}
        >
          <Text style={[styles.tabText, activeTab === 'facturen' && styles.tabTextActive]}>
            {t('invoices.tabInvoices', 'Facturen')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'incasso' && styles.tabActive]}
          onPress={() => setActiveTab('incasso')}
        >
          <Text style={[styles.tabText, activeTab === 'incasso' && styles.tabTextActive]}>
            {t('invoices.tabCollections', 'Incasso')}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ padding: Spacing.md }}>
          <LoadingSkeleton variant="list-item" count={4} />
        </View>
      ) : (
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />
        }
      >
        {activeTab === 'offertes' ? (
          <View style={{ gap: Spacing.sm }}>
            {/* Nieuwe Offerte CTA — front and center */}
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Pressable
                style={[styles.nieuweOfferteCta, { flex: 1 }]}
                onPress={() => setShowQuoteBuilder(true)}
              >
                <Ionicons name="add-circle" size={24} color={Palette.white} />
                <Text style={styles.nieuweOfferteCtaText}>{t('invoices.newQuote', 'Nieuwe offerte')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderWidth: 1, borderColor: SemanticColors.borderDefault,
                }, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/contractor/quote-templates' as any)}
              >
                <Ionicons name="copy-outline" size={18} color={Palette.hermesOrange} />
                <Text style={{ fontSize: 13, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary }}>Templates</Text>
              </Pressable>
            </View>

            {/* Pending Approvals */}
            {pendingApprovals.length > 0 && (
              <View style={styles.approvalBanner}>
                <View style={styles.approvalHeader}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={SemanticColors.feedbackWarning} />
                  <Text style={styles.approvalTitle}>
                    {pendingApprovals.length} {t('invoices.pendingApproval', 'offerte(s) wacht op goedkeuring')}
                  </Text>
                </View>
                {pendingApprovals.slice(0, 3).map(approval => (
                  <View key={approval.id} style={styles.approvalItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.approvalCustomer}>{approval.customerName}</Text>
                      <Text style={styles.approvalRef}>{approval.quoteReference} · €{approval.amount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.approvalActions}>
                      <Pressable
                        style={styles.approvalRejectBtn}
                        onPress={() => {
                          setBottomSheet({
                            visible: true,
                            title: `${approval.quoteReference} ${t('invoices.rejectConfirm', 'afwijzen')}?`,
                            actions: [
                              { label: t('invoices.reject', 'Afwijzen'), icon: 'close-circle-outline', destructive: true, onPress: () => { rejectQuote(approval.id, 'Eigenaar', 'Afgewezen'); closeBottomSheet(); } },
                              { label: t('invoices.cancel', 'Annuleren'), icon: 'arrow-back-outline', onPress: closeBottomSheet },
                            ],
                          });
                        }}
                      >
                        <Ionicons name="close" size={16} color={SemanticColors.feedbackError} />
                      </Pressable>
                      <Pressable
                        style={styles.approvalApproveBtn}
                        onPress={() => {
                          approveQuote(approval.id, 'Eigenaar');
                          hapticSuccess();
                        }}
                      >
                        <Ionicons name="checkmark" size={16} color={SemanticColors.feedbackSuccess} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {quotes.length > 0 ? (
              <View style={styles.quoteCardList}>
                {quotes.map((quote) => (
                  <QuoteItem
                    key={quote.id}
                    quote={quote}
                    onPress={() => router.push(`/quotes/${quote.id}` as any)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={40} color={SemanticColors.textTertiary} />
                <Text style={styles.emptyStateText}>{t('invoices.emptyQuotes', 'Geen actieve offertes')}</Text>
              </View>
            )}
          </View>
        ) : activeTab === 'facturen' ? (
          <View style={{ gap: Spacing.xs }}>
            <InvoiceList invoices={invoices} expandedId={expandedInvoiceId} onToggleExpand={setExpandedInvoiceId} />

            {/* Nieuwe Factuur van Klus */}
            {jobs.filter(j => ['completed', 'in-progress'].includes(j.status)).length > 0 && (
              <Pressable
                style={styles.nieuweFactuurBanner}
                onPress={() => {
                  const completedJobs = jobs.filter(j => ['completed', 'in-progress'].includes(j.status));
                  if (completedJobs.length === 1) {
                    const job = completedJobs[0];
                    setBottomSheet({
                      visible: true,
                      title: `${t('invoices.createInvoiceFor', 'Factuur maken voor')} "${job.title}" (\u20AC${(job.agreedAmount || job.quotedAmount || 0).toLocaleString()})?`,
                      actions: [
                        {
                          label: t('invoices.create', 'Aanmaken'),
                          icon: 'receipt-outline',
                          onPress: async () => {
                            closeBottomSheet();
                            await addInvoiceFromJob(job.id);
                            hapticSuccess();
                            setToast({ visible: true, message: `${t('invoices.invoiceCreated', 'Factuur aangemaakt')} — ${t('invoices.invoiceCreatedDesc', 'De factuur is aangemaakt als concept.')}` });
                          },
                        },
                        { label: t('invoices.cancel', 'Annuleren'), icon: 'close-outline', onPress: closeBottomSheet },
                      ],
                    });
                  } else {
                    setBottomSheet({
                      visible: true,
                      title: t('invoices.chooseJobDesc', 'Kies een klus om te factureren:'),
                      actions: [
                        ...completedJobs.slice(0, 5).map(job => ({
                          label: `${job.title} · \u20AC${(job.agreedAmount || job.quotedAmount || 0).toLocaleString()}`,
                          icon: 'briefcase-outline' as const,
                          onPress: async () => {
                            closeBottomSheet();
                            await addInvoiceFromJob(job.id);
                            hapticSuccess();
                            setToast({ visible: true, message: `${t('invoices.invoiceCreated', 'Factuur aangemaakt')} — ${t('invoices.invoiceCreatedDesc', 'De factuur is aangemaakt als concept.')}` });
                          },
                        })),
                        { label: t('invoices.cancel', 'Annuleren'), icon: 'close-outline' as const, onPress: closeBottomSheet },
                      ],
                    });
                  }
                }}
              >
                <Ionicons name="receipt" size={22} color={Palette.white} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nieuweOfferteBannerTitle} numberOfLines={1}>{t('invoices.newInvoice', 'Nieuwe Factuur')}</Text>
                  <Text style={styles.nieuweOfferteBannerSub} numberOfLines={1}>
                    {t('invoices.newInvoiceDesc', 'Maak een factuur direct van een klus')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Palette.white} />
              </Pressable>
            )}

            {/* Verlopen banner — below invoices */}
            {overdueValue > 0 && (
              <Pressable
                style={styles.overdueBanner}
                onPress={() => {
                  setBottomSheet({
                    visible: true,
                    title: t('invoices.sendReminders', 'Herinneringen versturen'),
                    actions: [
                      {
                        label: t('invoices.send', 'Versturen'),
                        icon: 'paper-plane-outline',
                        onPress: () => {
                          closeBottomSheet();
                          setToast({ visible: true, message: t('invoices.remindersSentAll', 'Herinneringen zijn verstuurd naar alle klanten met verlopen facturen.') });
                        },
                      },
                      { label: t('invoices.cancel', 'Annuleren'), icon: 'close-outline', onPress: closeBottomSheet },
                    ],
                  });
                }}
              >
                <Ionicons name="notifications" size={22} color={Palette.white} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.overdueBannerTitle} numberOfLines={1}>{t('invoices.sendReminder', 'Stuur Herinnering')}</Text>
                  <Text style={styles.overdueBannerSub} numberOfLines={1}>
                    {'\u20AC'}{overdueValue.toLocaleString()} verlopen · {overdueInvoices.length} facturen
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Palette.white} />
              </Pressable>
            )}
          </View>
        ) : (
          /* Incasso tab (P3) */
          <View style={{ gap: Spacing.md }}>
            {/* DSO Card */}
            <View style={styles.dsoCard}>
              <View style={styles.dsoMain}>
                <Text style={styles.dsoValue}>{dso.currentDSO}d</Text>
                <Text style={styles.dsoLabel}>{t('invoices.dsoLabel', 'Days Sales Outstanding')}</Text>
              </View>
              <View style={styles.dsoDetails}>
                <View style={styles.dsoDetailItem}>
                  <Text style={styles.dsoDetailLabel}>{t('invoices.target', 'Doel')}</Text>
                  <Text style={styles.dsoDetailValue}>{dso.targetDSO}d</Text>
                </View>
                <View style={styles.dsoDetailItem}>
                  <Text style={styles.dsoDetailLabel}>{t('invoices.previous', 'Vorige')}</Text>
                  <Text style={styles.dsoDetailValue}>{dso.previousDSO}d</Text>
                </View>
                <View style={styles.dsoDetailItem}>
                  <Text style={styles.dsoDetailLabel}>{t('invoices.industry', 'Branche')}</Text>
                  <Text style={styles.dsoDetailValue}>{dso.industryAverage}d</Text>
                </View>
              </View>
            </View>

            {/* Dunning Sequences */}
            <View style={{ gap: Spacing.xs }}>
              <Text style={styles.incassoSectionTitle}>{t('invoices.dunningSequences', 'Dunning Sequences')}</Text>
              {dunningSequences.map((seq: DunningSeqType) => {
                const stepColors: Record<string, string> = {
                  vriendelijk: SemanticColors.feedbackInfo,
                  herinnering: SemanticColors.feedbackWarning,
                  urgent: SemanticColors.feedbackError,
                  aanmaning: SemanticColors.feedbackError,
                  incasso: Palette.hermesOrange,
                };
                return (
                  <View key={seq.id} style={styles.dunningCard}>
                    <View style={styles.dunningHeader}>
                      <Text style={styles.dunningCustomer} numberOfLines={1}>{seq.customerName}</Text>
                      <Text style={styles.dunningAmount}>{'\u20AC'}{seq.invoiceAmount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.dunningMeta}>
                      <View style={[styles.dunningStepBadge, { backgroundColor: (stepColors[seq.currentStep] || SemanticColors.textTertiary) + '14' }]}>
                        <Text style={[styles.dunningStepText, { color: stepColors[seq.currentStep] || SemanticColors.textTertiary }]} numberOfLines={1}>
                          {seq.currentStep.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.dunningDays}>{seq.daysOverdue} {t('invoices.daysOverdue', 'dagen verlopen')}</Text>
                      {seq.autoSendEnabled && (
                        <View style={styles.dunningAutoTag}>
                          <Ionicons name="flash" size={10} color={SemanticColors.feedbackSuccess} />
                          <Text style={styles.dunningAutoText}>Auto</Text>
                        </View>
                      )}
                    </View>
                    {/* Step progress */}
                    <View style={styles.dunningSteps}>
                      {seq.steps.map((step, idx) => (
                        <View key={idx} style={styles.dunningStepDot}>
                          <View style={[
                            styles.dunningDot,
                            { backgroundColor: step.status === 'sent' ? SemanticColors.feedbackSuccess : step.status === 'pending' ? SemanticColors.textDisabled : SemanticColors.textTertiary }
                          ]} />
                        </View>
                      ))}
                    </View>
                    <Pressable
                      style={styles.dunningAction}
                      onPress={() => setToast({ visible: true, message: t('invoices.reminderSentTo', 'Herinnering verstuurd naar {{name}}.', { name: seq.customerName }) })}
                    >
                      <Text style={styles.dunningActionText} numberOfLines={1}>{t('invoices.sendNow', 'Verstuur nu')}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Cash Gap Alerts */}
            {cashGapAlerts.length > 0 && (
              <View style={{ gap: Spacing.xs }}>
                <Text style={styles.incassoSectionTitle}>{t('invoices.cashGapAlerts', 'Cash Gap Alerts')}</Text>
                {cashGapAlerts.map((alert) => (
                  <View key={alert.id} style={[styles.cashGapCard, {
                    borderLeftColor: alert.severity === 'kritiek' ? SemanticColors.feedbackError : SemanticColors.feedbackWarning,
                  }]}>
                    <Ionicons
                      name={alert.severity === 'kritiek' ? 'alert-circle' : 'warning'}
                      size={18}
                      color={alert.severity === 'kritiek' ? SemanticColors.feedbackError : SemanticColors.feedbackWarning}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cashGapTitle} numberOfLines={1}>{alert.title}</Text>
                      <Text style={styles.cashGapDesc} numberOfLines={2}>{alert.description}</Text>
                    </View>
                    <Text style={[styles.cashGapAmount, {
                      color: alert.severity === 'kritiek' ? SemanticColors.feedbackError : SemanticColors.feedbackWarning,
                    }]}>{'\u20AC'}{alert.gapAmount.toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
      )}

      {/* Quote Builder Modal */}
      <Modal
        visible={showQuoteBuilder}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <TieredQuoteBuilder
          onSend={(quote) => {
            setShowQuoteBuilder(false);
            setToast({ visible: true, message: t('invoices.quoteSentDesc', 'Je offerte is succesvol aangemaakt en verstuurd naar de klant.') });
          }}
          onClose={() => setShowQuoteBuilder(false)}
        />
      </Modal>

      <BottomSheet
        visible={bottomSheet.visible}
        onClose={closeBottomSheet}
        title={bottomSheet.title}
        actions={bottomSheet.actions}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type="success"
        onHide={() => setToast({ visible: false, message: '' })}
      />

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
    marginTop: 2,
    fontFamily: TYPE.labelFamily,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange + '0A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Audit Alert
  auditAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: 8,
  },
  auditAlertText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.feedbackError,
  },
  auditAlertAction: {
    fontSize: 13,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.feedbackError,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Palette.hermesOrange,
  },
  tabText: {
    fontSize: 13,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textTertiary,
  },
  tabTextActive: {
    color: Palette.white,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SafeArea.content,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },

  // Quote Cards (matching invoice card style)
  quoteCardList: {
    gap: 6,
  },
  quoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: Spacing.sm,
    paddingLeft: 0,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  quoteCardAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  quoteInfo: {
    flex: 1,
  },
  quoteCustomer: {
    fontSize: 14,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  quoteTitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  quoteRight: {
    alignItems: 'flex-end',
  },
  quoteAmount: {
    fontSize: 14,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  quoteStatus: {
    fontSize: 11,
    fontFamily: TYPE.labelFamily,
    marginTop: 1,
  },

  // Invoice Cards
  invoiceCardList: {
    gap: 6,
  },
  invoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: Spacing.sm,
    paddingLeft: 0,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  invoiceCardAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceCustomer: {
    fontSize: 14,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  invoiceProject: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 14,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  invoiceStatus: {
    fontSize: 11,
    fontFamily: TYPE.labelFamily,
    marginTop: 1,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
  },
  emptyStateButton: {
    marginTop: Spacing.sm,
    backgroundColor: Palette.hermesOrange,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: 13,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },

  // Financial Intelligence Strip
  finIntelStrip: {
    flexDirection: 'row',
    backgroundColor: Palette.hermesOrange + '08',
    borderRadius: 14,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
  },
  finIntelItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  finIntelValue: {
    fontSize: 18,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  finIntelLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  finIntelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  finIntelBadgeText: {
    fontSize: 10,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.feedbackSuccess,
  },
  finIntelDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderMuted,
    marginHorizontal: Spacing.xs,
  },

  // Incasso Tab Content (P3)
  dsoCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  dsoMain: {
    alignItems: 'center',
    gap: 4,
  },
  dsoValue: {
    fontSize: 36,
    fontFamily: TYPE.displayFamily,
    color: Palette.hermesOrange,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'] as any,
  },
  dsoLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontFamily: TYPE.labelFamily,
  },
  dsoDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dsoDetailItem: {
    alignItems: 'center',
    gap: 2,
  },
  dsoDetailLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    letterSpacing: 0.3,
  },
  dsoDetailValue: {
    fontSize: 14,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  incassoSectionTitle: {
    fontSize: 13,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textSecondary,
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.xs,
  },
  dunningCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  dunningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dunningCustomer: {
    fontSize: 15,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  dunningAmount: {
    fontSize: 15,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  dunningMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dunningStepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dunningStepText: {
    fontSize: 10,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: 0.3,
  },
  dunningDays: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  dunningAutoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dunningAutoText: {
    fontSize: 10,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.feedbackSuccess,
  },
  dunningSteps: {
    flexDirection: 'row',
    gap: 6,
  },
  dunningStepDot: {
    alignItems: 'center',
  },
  dunningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dunningAction: {
    alignItems: 'center',
    backgroundColor: Palette.hermesOrange + '10',
    paddingVertical: 8,
    borderRadius: 8,
  },
  dunningActionText: {
    fontSize: 13,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
  },
  cashGapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
  },
  cashGapTitle: {
    fontSize: 13,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  cashGapDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  cashGapAmount: {
    fontSize: 14,
    fontFamily: TYPE.sectionFamily,
    fontVariant: ['tabular-nums'] as any,
  },

  // Approval Banner
  approvalBanner: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.feedbackWarning,
    gap: Spacing.sm,
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  approvalTitle: {
    fontSize: 13,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.feedbackWarning,
  },
  approvalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  approvalCustomer: {
    fontSize: 14,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  approvalRef: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 6,
  },
  approvalRejectBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SemanticColors.feedbackError + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalApproveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SemanticColors.feedbackSuccess + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Nieuwe Offerte CTA
  nieuweOfferteCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: Spacing.md,
  },
  nieuweOfferteCtaText: {
    fontSize: 17,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  // Legacy banner styles (used by Nieuwe Factuur banner title/sub)
  nieuweOfferteBannerTitle: {
    fontSize: 16,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  nieuweOfferteBannerSub: {
    fontSize: 12,
    color: Palette.white + 'CC',
    marginTop: 2,
  },

  // Nieuwe Factuur banner
  nieuweFactuurBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 14,
    padding: Spacing.md,
    paddingVertical: 16,
  },

  // Sticky Overdue Banner
  stickyOverdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: SemanticColors.feedbackError + '10',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.feedbackError,
  },
  stickyOverdueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stickyOverdueText: {
    fontSize: 13,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.feedbackError,
    fontVariant: ['tabular-nums'] as any,
  },
  stickyOverdueActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stickyOverdueAction: {
    fontSize: 13,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.feedbackError,
  },

  // Invoice Quick Actions
  invoiceActions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    marginTop: -4,
  },
  invoiceActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: Palette.hermesOrange + '0A',
    borderRadius: 8,
  },
  invoiceActionText: {
    fontSize: 11,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
  },

  // Overdue banner (matching Nieuwe Offerte style)
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 14,
    padding: Spacing.md,
    paddingVertical: 16,
  },
  overdueBannerTitle: {
    fontSize: 16,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  overdueBannerSub: {
    fontSize: 12,
    color: Palette.white + 'CC',
    marginTop: 2,
  },
});
