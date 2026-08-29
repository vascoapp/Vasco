// =============================================================================
// QUOTE DETAIL — pro-grade view (R268: parity with invoice/[id].tsx)
// =============================================================================
// DK Sunset Slate theme, hero card with total + status, section cards with
// header rows + icons, polished line-items table, engagement panel.
// Functions preserved from prior implementation.
// =============================================================================

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticSuccess } from '../../src/utils/haptics';
import { useTranslation } from 'react-i18next';
import { Palette, SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { DK } from '../../src/theme/draftkings';
import { SafeArea } from '../../src/theme/spacing';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { generateQuotePdf, type QuotePdfData } from '../../src/services/quotePdfService';
import { shareQuoteWithAcceptanceLink } from '../../src/services/customerQuoteAcceptanceService';
import { signQuoteLink } from '../../src/services/publicQuotePortalService';
import { getQuoteEngagement, type QuoteEngagement } from '../../src/services/intelligenceCaptureService';
import { isDemoMode } from '../../src/context/AuthContext';
import { MS_PER_DAY } from '../../src/utils/timeConstants';
import { getVATRate } from '../../src/constants/taxRates';
import { formatCurrency as fmtCurrency, formatDate as fmtDate } from '../../src/i18n/formatting';
import { findDocumentCustomer } from '../../src/domain/customers';

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
  const [sharingLink, setSharingLink] = useState(false);
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
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        {/* The dead end needs the back control most: this screen had none, so
            a quote id that resolves to nothing stranded the contractor on a
            single line of text. */}
        <DKScreenHeader title={t('quotes.quote', 'Quote')} />
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
  const customerRecord = findDocumentCustomer(customers as { id: string; name: string }[], quote);
  const customerDisplayName = customerRecord?.name ?? quote.customer;

  // A quote with no STORED lines still has an amount, and the screen used to
  // total only the lines — so a €6.800 quote rendered "GESAMT € 0,00" with a
  // €0,00 subtotal and €0,00 VAT, while `shareQuoteWithAcceptanceLink` and the
  // PDF below both send `quote.amount`. The contractor read zero on screen and
  // the customer received an acceptance link for the real figure.
  //
  // `app/invoices/[id].tsx` already synthesises a line for exactly this case —
  // but it divides by (1 + rate), because `Invoice.amount` is GROSS (#232).
  // `Quote.amount` is NET: the quote→invoice path grosses it up with
  // `grossFromNet(sourceQuote.amount, …)`. So the synthesised line here takes
  // the amount AS IS. Copying the invoice screen's division would quietly
  // under-quote by the VAT.
  const displayLineItems = quoteLineItems.length > 0
    ? quoteLineItems
    : quote.amount > 0
      ? [{
          id: 'quote-amount',
          description: quote.job || t('quotes.services', 'Services'),
          quantity: 1,
          unitPrice: quote.amount,
        }]
      : [];
  const subtotal = displayLineItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const vatRate = getVATRate(country);
  // Round to CENTS, not to whole euros. `sharePdf` below already does
  // `Math.round(sub * vrate * 100) / 100`, so the screen and the PDF the
  // customer receives disagreed: 19% of 106,00 showed as 20,00 / 126,00 here
  // and 20,14 / 126,14 in the PDF.
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  const total = subtotal + vatAmount;

  const riskItem = priceRisk ? quoteLineItems.find((item) => item.description === priceRisk.lineItem) : undefined;
  const currentUnitPrice = riskItem?.unitPrice ?? 0;
  const suggestedUnitPrice = priceRisk?.suggestedUnitPrice ?? 0;
  const canApplySuggestion =
    Boolean(priceRisk?.lineItem) && suggestedUnitPrice > 0 && currentUnitPrice > suggestedUnitPrice;

  const validUntilDate = new Date(Date.now() + 30 * MS_PER_DAY);
  const validUntilLabel = fmtDate(validUntilDate, country);

  // ── Actions ────────────────────────────────────────────────────────────
  // Hoisted out of the JSX so the same handler can be the primary CTA on one
  // status and a compact tile on another. Previously each was an inline arrow
  // inside its own full-width button, which is why adding a case meant adding
  // a banner.

  const sharePdf = async () => {
    const items = lineItems[quote.id] ?? [];
    const sub = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
    const vrate = getVATRate(country);
    const vpct = Math.round(vrate * 100);
    const vamt = Math.round(sub * vrate * 100) / 100;
    const pdfData: QuotePdfData = {
      quoteNumber: quote.id,
      customerName: customerDisplayName ?? t('jobs.client', 'Client'),
      jobTitle: quote.job ?? t('jobs.typeJob', 'Job'),
      issueDate: fmtDate(new Date(), country),
      validUntil: validUntilLabel,
      lineItems: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: vpct })),
      subtotal: sub,
      vatAmount: vamt,
      total: sub + vamt,
      // R63 / Package D4: the AI-generated SOW narrative, from documents.scope_text.
      scopeText: quote.description,
    };
    // R66 NL launch: thread vatScheme so KOR / Kleinunternehmer contractors get
    // 0% VAT + the legal note, matching the invoice PDF (R251).
    // R66 round 11: Print.printToFileAsync can throw; without a catch the press
    // did nothing and the quote stayed 'draft'. markQuoteSent only runs on success.
    try {
      await generateQuotePdf(
        pdfData,
        businessProfile.businessName,
        businessProfile.address,
        businessProfile.kvkNumber,
        businessProfile.vatNumber,
        { vatScheme: businessProfile.vatScheme },
      );
      markQuoteSent(quote.id);
    } catch (err: any) {
      Alert.alert(
        t('quotes.shareFailedTitle', 'Could not share quote'),
        err?.message ?? t('quotes.shareFailedBody', 'Please retry. If this persists, the PDF could not be generated on this device.'),
      );
    }
  };

  // ONE customer link, not two. The screen used to offer both "Offertelink
  // delen" (the signed portal, which shows the line items) and
  // "Goedkeuringslink delen" (accept/decline only, no line items) — two
  // buttons, two token systems, and no way for the contractor to know which
  // one the customer should get. verify-quote-token now mints an acceptance
  // capability for whoever holds a valid portal token, so the portal link is
  // a strict superset: it shows the quote AND accepts it.
  //
  // The acceptance-only link survives as the fallback, because it is minted
  // locally: in demo mode, and for a quote that never reached the backend,
  // signQuoteLink has nothing to sign.
  const shareCustomerLink = async () => {
    if (sharingLink) return;
    setSharingLink(true);
    try {
      const signed = await signQuoteLink(quote.id);
      if (signed.ok && signed.url) {
        const greeting = customerDisplayName ? t('shareQuote.greeting', { name: customerDisplayName }) : '';
        await Share.share({
          message: t('shareQuote.message', { greeting, url: signed.url }),
          url: signed.url,
          title: t('shareQuote.shareTitle', 'Quote'),
        });
        return;
      }
      await shareQuoteWithAcceptanceLink({
        // GROSS, not `quote.amount`. See the unit note above: `Quote.amount` is
        // NET, and this number is the one the CUSTOMER reads — in the share
        // message, under "Gesamt/Totaal/Total" on the acceptance page, and on
        // its confirm button. Sending the net figure meant the customer agreed
        // to €6.800 while this screen called the same quote €8.092 and the
        // invoice made from it billed €8.092. A quote page that names a total
        // must name the total that will be invoiced.
        id: quote.id, customer: quote.customer, customerName: customerDisplayName,
        amount: total, job: quote.job,
      });
      if (isDemoMode) {
        Alert.alert(
          t('quotes.demoMode', 'Demo mode'),
          t('quotes.demoApprovalLink', 'In demo mode, approval links are local only. The link has been shared via your device share sheet.'),
        );
      }
    } catch {
      Alert.alert(t('common.error', 'Error'), t('quotes.approvalLinkFailed', 'Could not create approval link.'));
    } finally {
      setSharingLink(false);
    }
  };

  const acceptAndCreateJob = () => {
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
  };

  const createInvoice = () => router.push(`/quotes/${id}/invoice` as any);

  // The one thing to do next, by status. Everything else is a tile — so the
  // screen has exactly one full-width button whatever the quote's state.
  type QuoteAction = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; tint?: string };

  const A: Record<string, QuoteAction> = {
    link: { key: 'link', label: t('quotes.sendToCustomer', 'Send to customer'), icon: 'paper-plane', onPress: shareCustomerLink },
    pdf: { key: 'pdf', label: t('quotes.pdf', 'PDF'), icon: 'document-text-outline', onPress: sharePdf },
    accept: { key: 'accept', label: t('quotes.accept', 'Accept'), icon: 'checkmark-circle', onPress: acceptAndCreateJob, tint: DK.colors.success },
    invoice: { key: 'invoice', label: t('quotes.invoice', 'Invoice'), icon: 'receipt-outline', onPress: createInvoice },
  };

  const accepted = quote.status === 'accepted';
  const primaryAction: QuoteAction = accepted ? A.invoice : quote.status === 'sent' ? A.link : A.pdf;
  const tileActions: QuoteAction[] = [A.link, A.pdf, A.accept, A.invoice].filter(
    (a) => a.key !== primaryAction.key
      // Accepting twice creates a second job from one quote.
      && !(a.key === 'accept' && accepted)
      // Nothing to link to before the quote has been sent.
      && !(a.key === 'link' && quote.status === 'draft'),
  );
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
        {/* R66r44 DK polish — hero with gradient backdrop + amber glow */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[DK.colors.panel2, DK.colors.panel]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.heroLabel}>
            {quote.status === 'accepted'
              ? t('quotes.heroAccepted', 'Quote accepted').toUpperCase()
              : quote.status === 'rejected'
                ? t('quotes.heroRejected', 'Quote rejected').toUpperCase()
                : t('quotes.totalLabel', 'Total').toUpperCase()}
          </Text>
          <Text style={styles.heroAmount}>{formatCurrency(total)}</Text>
          <Text style={styles.heroDue}>
            {quote.status === 'accepted' || quote.status === 'rejected'
              ? customerDisplayName
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
                      await shareQuoteWithAcceptanceLink({ id: quote.id, customer: quote.customer, customerName: customerDisplayName, amount: total, job: quote.job });
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
          {/* Stacked, not four columns — the same fix `app/invoices/[id].tsx`
              needed. The description cell got ~130pt of a 402pt screen, and
              iOS breaks a word wider than its box BETWEEN CHARACTERS, so the
              Dutch quote rendered "Onderhoudscerti / ficaat" and the header
              itself split "AANTA / L". A quote is a document the CUSTOMER is
              asked to accept; a line whose description is cut is not one. */}
          {displayLineItems.map((item) => (
            <View key={item.id} style={styles.lineItemStack}>
              <Text style={styles.lineText} numberOfLines={3}>{item.description}</Text>
              <View style={styles.lineNumbers}>
                <Text style={styles.lineTextMuted} numberOfLines={1}>
                  {item.quantity} × {formatCurrency(item.unitPrice)}
                </Text>
                <Text style={styles.lineText} numberOfLines={1}>
                  {formatCurrency(item.unitPrice * item.quantity)}
                </Text>
              </View>
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
              {engagement.lastSeenAt ? ` · ${t('quotes.lastSeen', 'last seen')} ${fmtDate(new Date(engagement.lastSeenAt), country)}` : ''}
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
                <Text style={styles.engagementSignal}>💬 {t('quotes.startedQuestions', { count: engagement.questionStartedCount, defaultValue: 'Started {{count}} questions' })}</Text>
              )}
              {!engagement.decided && engagement.totalEvents > 5 && (
                <Text style={[styles.engagementSignal, { color: Palette.hermesOrange }]}>{t('quotes.followupHint', 'High engagement, no decision yet — consider a follow-up')}</Text>
              )}
            </View>
          </View>
        )}

        {/* Actions — ONE full-width CTA, then a row of compact tiles.
            This block used to stack up to five full-width banners on a `sent`
            quote (share link, share PDF, approval link, accept, create
            invoice). Nothing was ranked, so nothing read as the next step, and
            the two that mattered least — a flat orange share button that
            matched no other control on the screen, and a bordered "create
            invoice" that read as disabled — were the two the eye reached
            first and last. */}
        <View style={styles.actionsBlock}>
          <Pressable
            style={styles.primaryBtn}
            onPress={primaryAction.onPress}
            disabled={sharingLink && primaryAction.key === 'link'}
            accessibilityRole="button"
            accessibilityLabel={primaryAction.label}
          >
            <LinearGradient
              colors={DK.effects.ctaGradient as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {sharingLink && primaryAction.key === 'link' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={primaryAction.icon} size={18} color="#fff" />
            )}
            <Text style={styles.primaryBtnText}>{primaryAction.label.toUpperCase()}</Text>
          </Pressable>

          <View style={styles.actionsTileRow}>
            {tileActions.map((a) => (
              <Pressable
                key={a.key}
                style={styles.actionTile}
                onPress={a.onPress}
                disabled={sharingLink && a.key === 'link'}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                {sharingLink && a.key === 'link' ? (
                  <ActivityIndicator size="small" color={Palette.hermesOrange} />
                ) : (
                  <Ionicons name={a.icon} size={18} color={a.tint ?? Palette.hermesOrange} />
                )}
                {/* The captions are short NOUNS so they survive de/fr, where
                    "Rechnung erstellen" / "Créer une facture" would not fit a
                    quarter-width tile. The full action name stays on
                    accessibilityLabel. */}
                <Text style={[styles.actionTileText, a.tint ? { color: a.tint } : null]} numberOfLines={2}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
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
  headerTitle: { fontSize: 18, fontFamily: DK.type.display900, color: DK.colors.text, textTransform: 'uppercase', letterSpacing: 1.6 },
  // R66r44: status pill with subtle border for separation against the hero
  statusBadge: { paddingHorizontal: GRID.sm + 2, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: DK.colors.border },
  statusText: { fontSize: 10, fontFamily: DK.type.display800, letterSpacing: 1.4, textTransform: 'uppercase' },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { padding: GRID.md, gap: GRID.md, paddingBottom: 80 },

  // Hero — DK gradient backdrop + amber glow + Archivo display amount
  heroCard: {
    borderRadius: DK.radius.card,
    paddingVertical: GRID.lg + 8, paddingHorizontal: GRID.lg,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    borderWidth: 1, borderColor: DK.colors.border,
    ...DK.effects.heroGlow,
  },
  heroLabel: {
    fontSize: 11, fontFamily: DK.type.display800,
    color: DK.colors.textMuted, letterSpacing: 1.8,
  },
  heroAmount: {
    fontSize: 38, fontFamily: DK.type.display900,
    color: DK.colors.text, letterSpacing: -1,
  },
  heroDue: { fontSize: 13, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, textAlign: 'center' },

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
  // letterSpacing 1 pushed German "STÜCKPREIS" past its column and RN broke it
  // mid-word ("STÜCKPREI / S"). Width, not font size — learnings #113.
  lineHeaderText: { fontSize: 10, fontFamily: TYPE.labelFamily, color: SemanticColors.textTertiary, letterSpacing: 0.2, textTransform: 'uppercase' },
  lineItemRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, paddingVertical: GRID.xs },
  lineItemStack: { paddingVertical: GRID.sm, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SemanticColors.borderMuted },
  lineNumbers: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: GRID.sm },
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

  // Actions — DK CTA treatment: gradient backdrop + amber glow shadow
  actionsBlock: { gap: GRID.sm, marginTop: GRID.xs },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.sm,
    borderRadius: DK.radius.button,
    paddingVertical: GRID.md,
    minHeight: 48,
    overflow: 'hidden',
    ...DK.effects.ctaShadow,
  },
  primaryBtnText: { color: '#fff', fontFamily: DK.type.display800, fontSize: 13, letterSpacing: 1.2 },
  // Accept & create — DK success branch keeps green semantic but bumps weight
  successBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.sm,
    backgroundColor: DK.colors.success,
    borderRadius: DK.radius.button,
    paddingVertical: GRID.md,
    minHeight: 48,
    shadowColor: DK.colors.success, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  secondaryBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.button,
    paddingVertical: GRID.md,
    minHeight: 48,
    borderWidth: 1, borderColor: DK.colors.border,
  },
  secondaryBtnText: { color: DK.colors.text, fontFamily: DK.type.display700, fontSize: 13, letterSpacing: 1.2 },
  // Compact tiles, same shape the job screen uses for its secondary row, so a
  // contractor meets one pattern for "the other things I can do here".
  actionsTileRow: { flexDirection: 'row', gap: GRID.sm },
  actionTile: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center', gap: GRID.xs,
    paddingVertical: 14, paddingHorizontal: 4,
    borderRadius: DK.radius.button,
    backgroundColor: DK.colors.panel2,
    borderWidth: 1, borderColor: DK.colors.border,
    minHeight: 64,
  },
  actionTileText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.text,
    textAlign: 'center',
  },
});
