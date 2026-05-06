// =============================================================================
// QUOTE DETAIL — pro-grade view (R268: parity with invoice/[id].tsx)
// =============================================================================
// DK Sunset Slate theme, hero card with total + status, section cards with
// header rows + icons, polished line-items table, engagement panel.
// Functions preserved from prior implementation.
// =============================================================================

import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticSuccess } from '../../src/utils/haptics';
import { useTranslation } from 'react-i18next';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { generateQuotePdf, type QuotePdfData } from '../../src/services/quotePdfService';
import { shareQuoteWithAcceptanceLink } from '../../src/services/customerQuoteAcceptanceService';
import { ShareQuoteButton } from '../../src/components/contractor/ShareQuoteButton';
import { getQuoteEngagement, type QuoteEngagement } from '../../src/services/intelligenceCaptureService';
import { isDemoMode } from '../../src/context/AuthContext';
import { MS_PER_DAY } from '../../src/utils/timeConstants';
import { getVATRate } from '../../src/constants/taxRates';
import { formatCurrency as fmtCurrency } from '../../src/i18n/formatting';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: SemanticColors.surfaceSecondary, fg: SemanticColors.textSecondary },
  sent: { bg: '#F59E0B22', fg: '#F59E0B' },
  viewed: { bg: '#3B82F622', fg: '#3B82F6' },
  accepted: { bg: '#16A34A22', fg: '#16A34A' },
  rejected: { bg: '#DC262622', fg: '#DC2626' },
  expired: { bg: SemanticColors.surfaceSecondary, fg: SemanticColors.textTertiary },
};

export default function QuoteDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { quotes, customers, markQuoteSent, priceRisks, lineItems, applySuggestedPrice, convertQuoteToJob, businessProfile, updateQuote } = useAppState();
  const { user } = useAuth();
  const country = businessProfile.country ?? user?.country ?? 'NL';
  const quote = quotes.find((item) => item.id === id);
  const quoteLineItems = lineItems[quote?.id ?? ''] ?? [];
  const priceRisk = priceRisks.find((risk) => risk.quoteId === quote?.id);
  const [applied, setApplied] = useState(false);
  const [engagement, setEngagement] = useState<QuoteEngagement | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!quote?.id) return;
    let cancelled = false;
    getQuoteEngagement(quote.id).then((e) => {
      if (!cancelled) setEngagement(e);
    });
    return () => { cancelled = true; };
  }, [quote?.id]);

  if (!quote) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundWrap}>
          <Text style={styles.notFoundText}>{t('quotes.notFound', 'Quote not found')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatCurrency = (n: number) => fmtCurrency(n, country);

  // R14.1: quote.customer holds the customer UUID, not the name. Was being
  // rendered directly into the customer card and share-link payload, so the
  // contractor saw "cust-001" instead of "Bakery Jansen". Resolve once.
  const customerRecord = customers.find((c: any) => c.id === quote.customer);
  const customerDisplayName = customerRecord?.name ?? quote.customer;

  const subtotal = quoteLineItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const vatRate = getVATRate(country);
  const vatAmount = Math.round(subtotal * vatRate);
  const total = subtotal + vatAmount;

  const riskItem = priceRisk ? quoteLineItems.find((item) => item.description === priceRisk.lineItem) : undefined;
  const currentUnitPrice = riskItem?.unitPrice ?? 0;
  const suggestedUnitPrice = priceRisk?.suggestedUnitPrice ?? 0;
  const canApplySuggestion =
    Boolean(priceRisk?.lineItem) && suggestedUnitPrice > 0 && currentUnitPrice > suggestedUnitPrice;

  const validUntilDate = new Date(Date.now() + 30 * MS_PER_DAY);
  const validUntilLabel = validUntilDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const statusColors = STATUS_COLORS[quote.status] ?? STATUS_COLORS.draft;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header bar with status pill (matches invoice/[id].tsx) */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('quotes.quote', 'Quote')} {quote.id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.fg }]}>
            {t(`quotes.status.${quote.status}`, quote.status)}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero card — total + valid-until */}
        <View style={styles.heroCard}>
          <Text style={styles.heroAmount}>{formatCurrency(total)}</Text>
          <Text style={styles.heroDue}>
            {quote.status === 'accepted'
              ? t('quotes.heroAccepted', 'Quote accepted')
              : quote.status === 'rejected'
                ? t('quotes.heroRejected', 'Quote rejected')
                : t('quotes.heroValidUntil', 'Valid until {{date}}', { date: validUntilLabel })}
          </Text>
        </View>

        {/* Customer card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('jobs.client', 'Client')}</Text>
            {(quote.status === 'draft' || quote.status === 'sent') && (
              <Pressable
                onPress={() => {
                  if (quote.status === 'sent' && !editing) {
                    Alert.alert(
                      t('quotes.editSentQuote', 'Edit sent quote?'),
                      t('quotes.editSentQuoteDesc', 'Editing will mark this quote as draft. You will need to re-send it.'),
                      [
                        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                        { text: t('common.edit', 'Edit'), onPress: () => { updateQuote(quote.id, { status: 'draft' }); setEditing(true); } },
                      ],
                    );
                  } else { setEditing(!editing); }
                }}
                style={styles.editBtn}
                accessibilityRole="button"
                accessibilityLabel={editing ? t('common.done', 'Done') : t('common.edit', 'Edit')}
              >
                <Ionicons name={editing ? 'checkmark' : 'pencil'} size={14} color={Palette.hermesOrange} />
              </Pressable>
            )}
          </View>
          <Text style={styles.customerName}>{customerDisplayName}</Text>
          <Text style={styles.customerJob}>{quote.job}</Text>
        </View>

        {/* Recommended next step (only when draft) */}
        {quote.status === 'draft' && (
          <Pressable
            style={styles.assistBanner}
            onPress={() => {
              markQuoteSent(quote.id);
              hapticSuccess();
              Alert.alert(
                t('quotes.quoteSent', 'Quote sent!'),
                t('quotes.quoteSentDesc', 'Vasco will remind you in 3 days to follow up.'),
                [
                  { text: t('quotes.shareApprovalLink', 'Share approval link'), onPress: async () => {
                    try {
                      // R14.1: customer arg is the UUID, customerName needs the resolved name.
                      await shareQuoteWithAcceptanceLink({ id: quote.id, customer: quote.customer, customerName: customerDisplayName, amount: quote.amount, job: quote.job });
                    } catch {}
                  }},
                  { text: t('common.close', 'Close') },
                ],
              );
            }}
            accessibilityRole="button"
          >
            <View style={styles.assistIcon}>
              <Ionicons name="paper-plane" size={18} color={Palette.hermesOrange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.assistTitle}>{t('quotes.recommendedNextStep', 'Recommended next step')}</Text>
              <Text style={styles.assistDesc}>{t('quotes.sendQuoteNow', 'Send the quote now to prevent drop-off and shorten payment cycles.')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Palette.hermesOrange} />
          </Pressable>
        )}

        {/* Suggested adjustment */}
        {priceRisk && (
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="trending-down" size={18} color="#F59E0B" />
              <Text style={styles.cardTitle}>{t('quotes.suggestedAdjustment', 'Suggested adjustment')}</Text>
            </View>
            <Text style={styles.bodyText}>{priceRisk.reason}</Text>
            {priceRisk.lineItem && (
              <Text style={styles.adjustmentLine}>
                {priceRisk.lineItem} · {formatCurrency(currentUnitPrice)} → {formatCurrency(suggestedUnitPrice)}
              </Text>
            )}
            <Text style={styles.bodyMuted}>
              {t('quotes.estimatedSavings', 'Estimated savings')}: {formatCurrency(priceRisk.estimatedSavings)}
            </Text>
            {canApplySuggestion && (
              <Pressable
                style={styles.applyBtn}
                onPress={() => {
                  applySuggestedPrice(quote.id, priceRisk.lineItem ?? '', priceRisk.suggestedUnitPrice ?? 0);
                  setApplied(true);
                  hapticSuccess();
                }}
                accessibilityRole="button"
              >
                <Text style={styles.applyBtnText}>{t('quotes.applySuggestedPrice', 'Apply suggested price')}</Text>
              </Pressable>
            )}
            {applied && (
              <Text style={styles.appliedText}>{t('quotes.applied', 'Applied. Quote total updated.')}</Text>
            )}
          </View>
        )}

        {/* Line items */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={18} color={Palette.hermesOrange} />
            <Text style={styles.cardTitle}>{t('quotes.lineItems', 'Line items')}</Text>
          </View>
          <View style={styles.lineHeaderRow}>
            <Text style={[styles.lineHeaderText, { flex: 2 }]}>{t('invoices.description', 'Description')}</Text>
            <Text style={[styles.lineHeaderText, { width: 40, textAlign: 'center' }]}>{t('invoices.qty', 'Qty')}</Text>
            <Text style={[styles.lineHeaderText, { width: 70, textAlign: 'right' }]}>{t('invoices.unitPrice', 'Price')}</Text>
            <Text style={[styles.lineHeaderText, { width: 70, textAlign: 'right' }]}>{t('invoices.total', 'Total')}</Text>
          </View>
          {quoteLineItems.map((item) => (
            <View key={item.id} style={styles.lineItemRow}>
              <Text style={[styles.lineText, { flex: 2 }]} numberOfLines={2}>{item.description}</Text>
              <Text style={[styles.lineTextMuted, { width: 40, textAlign: 'center' }]}>{item.quantity}</Text>
              <Text style={[styles.lineTextMuted, { width: 70, textAlign: 'right' }]}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={[styles.lineText, { width: 70, textAlign: 'right' }]}>{formatCurrency(item.unitPrice * item.quantity)}</Text>
            </View>
          ))}

          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('quotes.subtotal', 'Subtotal')}</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('quotes.vat', 'VAT')} ({Math.round(vatRate * 100)}%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(vatAmount)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>{t('quotes.total', 'Total')}</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
            </View>
          </View>
        </View>

        {/* Customer engagement (when sent) */}
        {engagement && engagement.totalEvents > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="eye" size={18} color={Palette.hermesOrange} />
              <Text style={styles.cardTitle}>{t('quotes.customerActivity', 'Customer activity')}</Text>
            </View>
            <Text style={styles.bodyMuted}>
              {t('quotes.engagementSummary', 'Opened {{count}}× · {{minutes}} min total', {
                count: engagement.portalOpenedCount,
                minutes: Math.round(engagement.totalEngagementSeconds / 60) || 1,
              })}
              {engagement.lastSeenAt ? ` · ${t('quotes.lastSeen', 'last seen')} ${new Date(engagement.lastSeenAt).toLocaleDateString()}` : ''}
            </Text>
            <View style={styles.engagementSignals}>
              {engagement.priceExpandedCount > 0 && (
                <Text style={styles.engagementSignal}>📊 {t('quotes.expandedPricing', 'Expanded pricing')} {engagement.priceExpandedCount}×</Text>
              )}
              {engagement.acceptHoveredCount > 0 && (
                <Text style={[styles.engagementSignal, { color: SemanticColors.feedbackSuccess }]}>✓ {t('quotes.hoveredAccept', 'Hovered accept')} {engagement.acceptHoveredCount}×</Text>
              )}
              {engagement.declineHoveredCount > 0 && (
                <Text style={[styles.engagementSignal, { color: SemanticColors.feedbackError }]}>✗ {t('quotes.hoveredDecline', 'Hovered decline')} {engagement.declineHoveredCount}×</Text>
              )}
              {engagement.questionStartedCount > 0 && (
                <Text style={styles.engagementSignal}>💬 {t('quotes.startedQuestions', 'Started {{count}} question(s)', { count: engagement.questionStartedCount })}</Text>
              )}
              {!engagement.decided && engagement.totalEvents > 5 && (
                <Text style={[styles.engagementSignal, { color: Palette.hermesOrange }]}>{t('quotes.followupHint', 'High engagement, no decision yet — consider a follow-up')}</Text>
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsBlock}>
          {quote.status === 'sent' && (
            <ShareQuoteButton quoteId={quote.id} customerName={customerDisplayName} />
          )}

          <Pressable
            style={styles.primaryBtn}
            onPress={async () => {
              const items = lineItems[quote.id] ?? [];
              const sub = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
              const vrate = getVATRate(country);
              const vpct = Math.round(vrate * 100);
              const vamt = Math.round(sub * vrate * 100) / 100;
              const pdfData: QuotePdfData = {
                quoteNumber: quote.id,
                customerName: customerDisplayName ?? t('jobs.client', 'Client'),
                jobTitle: quote.job ?? t('jobs.typeJob', 'Job'),
                issueDate: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
                validUntil: validUntilLabel,
                lineItems: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: vpct })),
                subtotal: sub,
                vatAmount: vamt,
                total: sub + vamt,
                // R63 / Package D4: render the AI-generated SOW narrative in
                // the PDF. Pulled from documents.scope_text via the R63
                // mapper update; falls back to undefined for older quotes
                // that pre-date the SOW feature.
                scopeText: quote.description,
              };
              // R66 NL launch: thread vatScheme so KOR / Kleinunternehmer
              // contractors get 0% VAT + the legal note on the quote PDF
              // (matches the invoice PDF, R251). Pre-R66 the quote showed
              // 21% even when the contractor was on KOR — confusing the
              // customer when the invoice arrived showing 0%.
              await generateQuotePdf(
                pdfData,
                businessProfile.businessName,
                businessProfile.address,
                businessProfile.kvkNumber,
                businessProfile.vatNumber,
                { vatScheme: businessProfile.vatScheme },
              );
              markQuoteSent(quote.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('quotes.sharePdf', 'Share quote as PDF')}
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('quotes.sharePdf', 'Share quote as PDF')}</Text>
          </Pressable>

          {quote.status === 'sent' && (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: Palette.hermesOrange }]}
              onPress={async () => {
                try {
                  await shareQuoteWithAcceptanceLink({
                    id: quote.id, customer: quote.customer, customerName: customerDisplayName,
                    amount: quote.amount, job: quote.job,
                  });
                  if (isDemoMode) {
                    Alert.alert(t('quotes.demoMode', 'Demo mode'), t('quotes.demoApprovalLink', 'In demo mode, approval links are local only. The link has been shared via your device share sheet.'));
                  }
                } catch {
                  Alert.alert(t('common.error', 'Error'), t('quotes.approvalLinkFailed', 'Could not create approval link.'));
                }
              }}
              accessibilityRole="button"
            >
              <Ionicons name="link" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{t('quotes.shareApprovalLink', 'Share approval link')}</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.successBtn}
            onPress={() => {
              Alert.alert(
                t('quotes.acceptQuote', 'Accept quote'),
                t('quotes.acceptQuoteDesc', { defaultValue: 'Accept quote and create job for {{total}}?', total: formatCurrency(total) }),
                [
                  { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                  {
                    text: t('quotes.accept', 'Accept'),
                    onPress: async () => {
                      try {
                        const jobId = await convertQuoteToJob(quote.id);
                        if (jobId) {
                          hapticSuccess();
                          Alert.alert(
                            t('quotes.jobCreated', 'Job created'),
                            t('quotes.jobCreatedDesc', 'The quote has been accepted and a job has been created.'),
                            [
                              { text: t('quotes.viewJob', 'View job'), onPress: () => router.replace(`/contractor/job/${jobId}` as any) },
                              { text: t('quotes.createInvoice', 'Create invoice'), onPress: () => router.push(`/quotes/${quote.id}/invoice` as any) },
                              { text: t('common.close', 'Close') },
                            ],
                          );
                        }
                      } catch (err: any) {
                        Alert.alert(t('common.error', 'Error'), err?.message || t('quotes.conversionFailed', 'Could not convert quote to job.'));
                      }
                    },
                  },
                ],
              );
            }}
            accessibilityRole="button"
            accessibilityLabel={t('quotes.acceptAndCreateJob', 'Accept and create job')}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('quotes.acceptAndCreateJob', 'Accept & create job')}</Text>
          </Pressable>

          <Link href={`/quotes/${id}/invoice`} asChild>
            <Pressable style={styles.secondaryBtn} accessibilityRole="button" accessibilityLabel={t('quotes.createInvoice', 'Create invoice')}>
              <Text style={styles.secondaryBtnText}>{t('quotes.createInvoice', 'Create invoice')}</Text>
            </Pressable>
          </Link>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  notFoundWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: GRID.lg },
  notFoundText: { fontSize: 18, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },

  // Header
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingHorizontal: SafeArea.side, paddingVertical: GRID.sm,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  statusBadge: { paddingHorizontal: GRID.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontFamily: TYPE.labelFamily, letterSpacing: 1.2, textTransform: 'uppercase' },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { padding: GRID.md, gap: GRID.sm, paddingBottom: 80 },

  // Hero
  heroCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.lg,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  heroAmount: {
    fontSize: 34, fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary, letterSpacing: -0.8,
  },
  heroDue: { fontSize: 13, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, textAlign: 'center' },

  // Cards
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.xs,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  editBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Palette.hermesOrange + '14',
    alignItems: 'center', justifyContent: 'center',
  },

  // Customer
  customerName: { fontSize: 16, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary, marginTop: 4 },
  customerJob: { fontSize: 13, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },

  // Assist banner
  assistBanner: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    backgroundColor: Palette.hermesOrange + '14',
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1, borderColor: Palette.hermesOrange + '40',
  },
  assistIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Palette.hermesOrange + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  assistTitle: { fontSize: 13, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  assistDesc: { fontSize: 12, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },

  // Adjustment / body
  bodyText: { fontSize: 13, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  bodyMuted: { fontSize: 12, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },
  adjustmentLine: { fontSize: 13, fontFamily: TYPE.titleFamily, color: '#F59E0B', marginTop: 4 },
  applyBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: RADIUS.md,
    paddingVertical: 8, paddingHorizontal: GRID.md,
    alignSelf: 'flex-start',
    marginTop: GRID.xs,
  },
  applyBtnText: { color: '#000', fontFamily: TYPE.titleFamily, fontSize: 12, letterSpacing: 1 },
  appliedText: { color: SemanticColors.feedbackSuccess, fontSize: 11, fontFamily: TYPE.titleFamily, marginTop: 4 },

  // Line items
  lineHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: GRID.xs, gap: GRID.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderDefault,
    marginTop: 4,
  },
  lineHeaderText: { fontSize: 10, fontFamily: TYPE.labelFamily, color: SemanticColors.textTertiary, letterSpacing: 1, textTransform: 'uppercase' },
  lineItemRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, paddingVertical: GRID.xs },
  lineText: { fontSize: 13, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  lineTextMuted: { fontSize: 12, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },

  // Total
  totalSection: {
    borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault,
    marginTop: GRID.sm, paddingTop: GRID.sm, gap: 4,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  totalValue: { fontSize: 13, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault, paddingTop: GRID.sm, marginTop: 4 },
  grandTotalLabel: { fontSize: 16, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  grandTotalValue: { fontSize: 18, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },

  // Engagement
  engagementSignals: { gap: 4, marginTop: GRID.xs },
  engagementSignal: { fontSize: 12, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },

  // Actions
  actionsBlock: { gap: GRID.sm, marginTop: GRID.xs },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.xs,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingVertical: GRID.md,
    minHeight: 44,
  },
  primaryBtnText: { color: '#fff', fontFamily: TYPE.titleFamily, fontSize: 14 },
  successBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.xs,
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: RADIUS.md,
    paddingVertical: GRID.md,
    minHeight: 44,
  },
  secondaryBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    paddingVertical: GRID.md,
    minHeight: 44,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  secondaryBtnText: { color: SemanticColors.textPrimary, fontFamily: TYPE.titleFamily, fontSize: 14 },
});
