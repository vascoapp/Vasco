// =============================================================================
// GELD — DraftKings-patterned money tab
// =============================================================================
// Functions preserved (UI restructured):
//   3-KPI stadium (omzet/uitstaand/pipeline, tappable, trend arrow) ·
//   collection rate badge · CashFlowForecastCard · financial VascoCard ·
//   facturen list + filter modal + long-press delete + draft send button ·
//   offertes list + filter modal + new-quote button + long-press delete ·
//   BTW-aangifte card (NL only) · cashflow (revenue/costs/profit/margin-bar/
//   sparkline/projected/DSO) · overdue list + inline remind share + total ·
//   top-customers bar chart + concentration-risk banner ·
//   pull-to-refresh · FAB new quote · skeleton loader
// =============================================================================

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Share, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DK } from '../../src/theme/draftkings';
import { collectionRate as computeCollectionRate, issuedInvoices } from '../../src/utils/collectionRate';
import { useAppState } from '../../src/state/AppState';
import { useFinancialAnalysis } from '../../src/services/financialAnalysisService';
import { MoatInsightsCard } from '../../src/components/contractor/MoatInsightsCard';
import { ReconciliationCard } from '../../src/components/contractor/ReconciliationCard';
import { formatCurrency, compactCurrency, type Country } from '../../src/i18n/formatting';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { Sparkline } from '../../src/components/shared/Sparkline';
import { SkeletonList } from '../../src/components/shared/SkeletonList';
import { CashFlowForecastCard } from '../../src/components/contractor/CashFlowForecastCard';
import { CashflowGapPredictionCard } from '../../src/components/contractor/CashflowGapPredictionCard';
import { MaterialDriftCard } from '../../src/components/contractor/MaterialDriftCard';
import { MarketPulseCard } from '../../src/components/contractor/MarketPulseCard';
import { useAIQueue } from '../../src/services/aiActionQueueService';
import { executeApprovedQueueItem } from '../../src/services/queueItemExecutor';
import { useVascoGuidance } from '../../src/services/vascoGuidanceService';
import { DKLabel } from '../../src/components/shared/DKLabel';

/**
 * Cashflow chart axis. Was a hardcoded English array, so the Dutch Geld tab
 * plotted "Mar Apr May" — and "May"/"Mar"/"Oct" are not Dutch at all.
 * Intl gives the right abbreviation per locale for free; cashFlowService.ts
 * already did it this way.
 */
function getLastNMonthLabels(n: number, locale: string): string[] {
  const now = new Date();
  const labels: string[] = [];
  const fmt = (() => {
    try { return new Intl.DateTimeFormat(locale, { month: 'short' }); }
    catch { return new Intl.DateTimeFormat('en', { month: 'short' }); }
  })();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(fmt.format(d));
  }
  return labels;
}

type SortMode = 'value-desc' | 'date-desc' | 'status';

export default function GeldScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  // Invoice/quote status was concatenated raw ('overdue'/'paid'/'draft') into
  // the list subtitle — localise it (the facturen drill-down already did).
  const humanizeStatus = (raw: string) => raw.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const invoiceStatusLabel = (raw?: string) => raw ? t(`invoices.status.${raw}`, humanizeStatus(raw)) : '';
  const quoteStatusLabel = (raw?: string) => raw ? t(`quotes.status.${raw}`, humanizeStatus(raw)) : '';
  const [refreshing, setRefreshing] = useState(false);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>('all');
  const [invoiceSort, setInvoiceSort] = useState<SortMode>('date-desc');
  const [quoteSort, setQuoteSort] = useState<SortMode>('date-desc');
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [showInvoiceFilterModal, setShowInvoiceFilterModal] = useState(false);
  const [showQuoteFilterModal, setShowQuoteFilterModal] = useState(false);
  const { invoices, quotes, markInvoiceSent, removeInvoice, removeQuote, isLoading, businessProfile } = useAppState();
  const fin = useFinancialAnalysis();
  const aiQueue = useAIQueue();
  const allGuidance = useVascoGuidance('contractor', 'geld');
  const topInsight = allGuidance.filter(g => g.priority === 'critical' || g.priority === 'high')[0] ?? null;

  useEffect(() => { recordScreenVisit('geld'); }, []);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const handleDeleteDocument = useCallback((docId: string, docType: 'factuur' | 'offerte', docName: string) => {
    const title = docType === 'factuur'
      ? t('invoices.deleteInvoice', 'Delete invoice?')
      : t('quotes.deleteQuote', 'Delete quote?');
    Alert.alert(title, docName, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      { text: t('common.delete', 'Delete'), style: 'destructive', onPress: () => { (docType === 'factuur' ? removeInvoice : removeQuote)(docId); hapticSuccess(); } },
    ]);
  }, [removeInvoice, removeQuote, t]);

  // compactCurrency defaults to NL, and these three tiles passed nothing — so a
  // German contractor's KPIs rendered "€ 760" (Dutch: symbol first) directly
  // above an insight card correctly reading "800 €" (German: symbol last).
  // Two currency conventions on one screen.
  const kpiCountry = (businessProfile?.country ?? 'NL') as Country;
  const outstandingTotal = fin.totalOutstanding;
  const paidTotal = fin.totalRevenue;

  // `icon: null` = nothing to compare against yet. Rendering the 'remove'
  // dash in that case put a bare "–" next to the amount ("€760 –"), which
  // reads as a stray hyphen rather than "flat". A dash is only meaningful
  // when there IS a previous month and it genuinely did not move.
  const revenueTrend = useMemo((): { icon: 'trending-up' | 'trending-down' | 'remove' | null; color: string } => {
    const prev = fin.monthlyInflows.length >= 2 ? fin.monthlyInflows[fin.monthlyInflows.length - 2] : 0;
    if (prev === 0) return { icon: null, color: DK.colors.textMuted };
    if (paidTotal === prev) return { icon: 'remove', color: DK.colors.textMuted };
    return paidTotal > prev
      ? { icon: 'trending-up', color: DK.colors.success }
      : { icon: 'trending-down', color: DK.colors.danger };
  }, [paidTotal, fin.monthlyInflows]);

  // Rule lives in src/utils/collectionRate.ts — it was wrong in two ways here
  // (drafts in the denominator; counting documents rather than money, which
  // contradicted the euros printed beside it) and nothing could test it while
  // it sat inline in this component.
  const issued = useMemo(() => issuedInvoices(invoices), [invoices]);
  const collectionRate = useMemo(() => computeCollectionRate(invoices), [invoices]);

  const invoiceDocs = useMemo(() => {
    return invoices
      .filter((inv: any) => invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter)
      .map((inv: any) => ({
        id: inv.id,
        // Was `|| inv.reference` as a last resort — but reference is a
        // document number ("Q-2024-0042"), not a person, so an invoice with
        // no customer rendered its reference where the customer name goes.
        // Blank beats leaking an internal identifier; this matches the same
        // conclusion drawn for addInvoiceFromJob in AppState (see the
        // "cust-003" comment there).
        name: inv.customer || inv.customerName || '',
        description: inv.job || t('invoices.invoice', 'Factuur'),
        amount: inv.total || inv.amount || 0,
        status: inv.status,
      }))
      .sort((a, b) => invoiceSort === 'value-desc' ? b.amount - a.amount : 0);
  }, [invoices, invoiceStatusFilter, invoiceSort, t]);

  const quoteDocs = useMemo(() => {
    return quotes
      .filter((q: any) => quoteStatusFilter === 'all' || q.status === quoteStatusFilter)
      .map((q: any) => ({
        id: q.id,
        name: q.customer || q.job || '',
        description: q.job || q.description || t('quotes.quote', 'Offerte'),
        amount: q.amount || 0,
        status: q.status,
      }))
      .sort((a, b) => quoteSort === 'value-desc' ? b.amount - a.amount : 0);
  }, [quotes, quoteStatusFilter, quoteSort, t]);

  const sparkData = fin.monthlyInflows;
  const sparkMonthLabels = useMemo(() => getLastNMonthLabels(sparkData.length || 6, i18n.language), [sparkData.length, i18n.language]);
  const sparkMin = sparkData.length ? Math.min(...sparkData) : 0;
  const sparkMax = sparkData.length ? Math.max(...sparkData) : 0;

  const sortedOverdue = useMemo(() =>
    [...fin.overdueDetails].sort((a, b) => b.daysOverdue - a.daysOverdue),
    [fin.overdueDetails]
  );

  const maxCustomerRevenue = useMemo(() =>
    fin.topCustomers.length === 0 ? 0 : Math.max(...fin.topCustomers.map(c => c.revenue)),
    [fin.topCustomers]
  );

  // Null = not known. Costs come from the expense ledger now, so a contractor
  // who has recorded none has an UNKNOWN margin, not a 100% one.
  // With no recorded expenses the projection's outflows are 0, so the figure is
  // money coming IN, not what is left after costs. Say which — a gross number
  // under "projected next month" quietly promises profit. The income wording is
  // also shorter, and this label already ellipsized in German.
  const projectionLabel = fin.projectedIsNet
    ? t('dk.money.projectedMonth', 'Projected next month')
    : t('dk.money.projectedIncomeMonth', 'Expected income');

  const marginPercent = fin.netIncome !== null && paidTotal > 0
    ? Math.round((fin.netIncome / paidTotal) * 100)
    : null;

  const dsoStatus = useMemo((): { color: string } => {
    if (fin.avgDaysToPayment <= 21) return { color: DK.colors.success };
    if (fin.avgDaysToPayment <= 30) return { color: DK.colors.accent };
    return { color: DK.colors.danger };
  }, [fin.avgDaysToPayment]);

  if (isLoading) {
    return (
      <View style={s.root}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
          <View style={s.topBar}><DKLabel style={s.title}>{t('tabs.money', 'Geld')}</DKLabel></View>
        </SafeAreaView>
        <SkeletonList count={3} showAction lines={3} />
      </View>
    );
  }

  // R66 round 29: full-empty state when fresh contractor has no quotes
  // OR invoices yet. Pre-R29 they hit an empty financial dashboard
  // (zeroed cards + bare segmented tabs) with no orientation. Now points
  // them at the "create your first quote" CTA, matching werk's pattern.
  if (invoices.length === 0 && quotes.length === 0) {
    return (
      <View style={s.root}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
          <View style={s.topBar}><DKLabel style={s.title}>{t('tabs.money', 'Money')}</DKLabel></View>
        </SafeAreaView>
        <View style={s.fullEmpty}>
          <Ionicons name="cash-outline" size={48} color={DK.colors.textMuted} />
          <DKLabel style={s.fullEmptyTitle}>{t('dk.empty.noFinancials', 'No quotes or invoices yet')}</DKLabel>
          <Text style={s.fullEmptyDesc}>{t('dk.empty.noFinancialsDesc', 'Create your first quote to start tracking money in.')}</Text>
          <Pressable style={s.fullEmptyBtn} onPress={() => router.push('/contractor/tiered-quote' as any)}>
            <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <DKLabel style={s.fullEmptyBtnText}>{t('dk.actions.newQuote', 'New quote')}</DKLabel>
          </Pressable>
        </View>
      </View>
    );
  }

  const financialQueue = aiQueue.items.filter(i => i.type === 'draft_invoice' || i.type === 'draft_reminder');

  return (
    <View style={s.root}>
      {/* ─── TOP BAR ─── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: DK.colors.bg }}>
        <View style={s.topBar}>
          <DKLabel style={s.title}>{t('tabs.money', 'Money')}</DKLabel>
        </View>
      </SafeAreaView>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DK.colors.accent} />}
      >
        {/* ─── 3-KPI STADIUM ─── */}
        <View style={s.kpiRow}>
          <Pressable style={s.kpiTile} onPress={() => router.push('/(contractor)/facturen' as any)}>
            <DKLabel style={s.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('dk.pill.revenue', 'Revenue')}</DKLabel>
            <View style={s.kpiValueRow}>
              <Text style={[s.kpiValue, { color: DK.colors.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>{compactCurrency(paidTotal, kpiCountry)}</Text>
              {revenueTrend.icon ? (
                <Ionicons name={revenueTrend.icon} size={14} color={revenueTrend.color} />
              ) : null}
            </View>
          </Pressable>
          <Pressable style={s.kpiTile} onPress={() => router.push('/(contractor)/facturen' as any)}>
            <DKLabel style={s.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('dk.pill.outstanding', 'Outstanding')}</DKLabel>
            <Text style={[s.kpiValue, { color: DK.colors.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>{compactCurrency(outstandingTotal, kpiCountry)}</Text>
          </Pressable>
          <Pressable style={s.kpiTile}>
            <DKLabel style={s.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('dk.pill.pipeline', 'Pipeline')}</DKLabel>
            <Text style={[s.kpiValue, { color: DK.colors.highlight }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>{compactCurrency(fin.quotePipeline, kpiCountry)}</Text>
          </Pressable>
        </View>

        {/* R247: bank-reconciliation surface — actionable, shown first */}
        <ReconciliationCard />

        {/* R243: MARKT & PRESTATIE — closes mv_winrate_by_amount + */}
        {/* mv_margin_by_trade_month + ts_daily_business_metrics dormant tables */}
        <MoatInsightsCard />

        {/* ─── COLLECTION RATE BADGE ─── */}
        {/* Gated on ISSUED, not on `invoices.length`: a contractor whose only
            invoices are drafts has billed nothing, and showing them a red 0%
            would score an empty set as a bad outcome. */}
        {issued.length > 0 && (
          <View style={s.collectionBadge}>
            <Ionicons name="checkmark-circle" size={14} color={collectionRate >= 80 ? DK.colors.success : collectionRate >= 50 ? DK.colors.highlight : DK.colors.danger} />
            <Text style={s.collectionText}>{t('dk.pill.collectionRate', 'Collection rate').toUpperCase()} · <Text style={{ color: collectionRate >= 80 ? DK.colors.success : collectionRate >= 50 ? DK.colors.highlight : DK.colors.danger }}>{collectionRate}%</Text></Text>
          </View>
        )}

        {/* ─── NEW OFFERTE (primary creation CTA, elevated) ─── */}
        <Pressable
          style={({ pressed }) => [s.newQuoteBtn, pressed && { opacity: 0.9 }]}
          onPress={() => router.push('/contractor/tiered-quote' as any)}
        >
          <LinearGradient colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
          <DKLabel style={s.newQuoteBtnText}>{t('dk.actions.newQuote', 'New quote')}</DKLabel>
        </Pressable>

        {/* ─── CASHFLOW FORECAST (embedded self-styled component) ─── */}
        {/* R300: ML cashflow-gap prediction banner — hidden when low confidence or small gap */}
        <CashflowGapPredictionCard />
        <CashFlowForecastCard invoices={invoices as any} quotes={quotes as any} jobs={[] as any} country={(businessProfile?.country as any) ?? 'NL'} />

        {/* ─── FINANCIAL AI QUEUE (was VascoCard) ─── */}
        {(financialQueue.length > 0 || topInsight) && (
          <View style={s.vascoPanel}>
            <View style={s.vascoHeader}>
              <View style={s.vascoChip}>
                <View style={s.vascoChipDot} />
                <DKLabel style={s.vascoChipText}>{t('dk.hero.eveFinance', 'Vasco Finance')}</DKLabel>
              </View>
              <Text style={s.vascoCountText}>{financialQueue.length}</Text>
            </View>
            {topInsight ? (
              <Pressable onPress={() => (topInsight as any).actionRoute && router.push((topInsight as any).actionRoute)} style={s.vascoInsight}>
                <Text style={s.vascoInsightTitle}>{topInsight.title}</Text>
                <Text style={s.vascoInsightDesc} numberOfLines={2}>{topInsight.message}</Text>
              </Pressable>
            ) : null}
            {financialQueue.slice(0, 3).map((item) => (
              // Stacked — the action label sized the button and starved the
              // flex:1 title ("2× Herinneri…"). Same fix as InlineQueueRow.
              <View key={item.id} style={s.vascoQueueRow}>
                <View style={{ minWidth: 0 }}>
                  <Text style={s.vascoQueueTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={s.vascoQueueImpact}>{item.estimatedImpact}</Text>
                </View>
                <View style={s.vascoQueueActions}>
                <Pressable hitSlop={6} onPress={() => aiQueue.reject(item.id)} style={s.vascoQueueReject}>
                  <Ionicons name="close" size={12} color={DK.colors.textMuted} />
                </Pressable>
                <Pressable
                  onPress={async () => {
                    hapticSuccess();
                    // R286: actually fire the action after approval. Geld's
                    // queue rows don't render VascoCard, so shareable items
                    // need the executor to open the Share sheet too.
                    const approved = await aiQueue.approve(item.id);
                    if (approved) await executeApprovedQueueItem(approved, { router }, { alreadyShared: false });
                  }}
                  style={s.vascoQueueApprove}
                >
                  <DKLabel style={s.vascoQueueApproveText} numberOfLines={1}>{item.actionLabel}</DKLabel>
                </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── FACTUREN ─── */}
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionTitleBlock}>
            <DKLabel style={s.sectionTitle}>{t('invoices.invoices', 'Facturen')}</DKLabel>
            <View style={s.sectionCountPill}><Text style={s.sectionCountText}>{invoices.length}</Text></View>
          </View>
          <Pressable onPress={() => setShowInvoiceFilterModal(true)} hitSlop={8}>
            <Ionicons name="options-outline" size={20} color={invoiceStatusFilter !== 'all' ? DK.colors.accent : DK.colors.textMuted} />
          </Pressable>
        </View>
        {invoices.length > 0 ? (
          <View style={s.docList}>
            {invoiceDocs.map((doc) => (
              <Pressable
                key={doc.id}
                style={({ pressed }) => [s.docRow, pressed && { opacity: 0.9 }]}
                onPress={() => router.push(`/invoices/${doc.id}` as any)}
                onLongPress={() => handleDeleteDocument(doc.id, 'factuur', doc.name)}
              >
                <View style={[s.docDot, { backgroundColor: statusColor(doc.status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.docName} numberOfLines={1}>{doc.name}</Text>
                  <Text style={s.docDesc} numberOfLines={1}>{[doc.description, invoiceStatusLabel(doc.status)].filter(Boolean).join(' · ')}</Text>
                </View>
                <Text style={s.docAmount}>{formatCurrency(doc.amount)}</Text>
                {doc.status === 'draft' && (
                  <Pressable
                    style={[s.sendBtn, sendingInvoiceId === doc.id && { opacity: 0.5 }]}
                    disabled={sendingInvoiceId === doc.id}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      if (sendingInvoiceId) return;
                      setSendingInvoiceId(doc.id);
                      try { hapticSuccess(); markInvoiceSent(doc.id); Alert.alert(t('invoices.markedAsSent', 'Invoice marked as sent'), t('invoices.markedAsSentDesc', 'Share the PDF with your customer via the share button on the invoice detail screen.')); }
                      finally { setSendingInvoiceId(null); }
                    }}
                    hitSlop={6}
                  >
                    <Ionicons name="send" size={12} color="#FFFFFF" />
                  </Pressable>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyPanel
            icon="receipt-outline"
            title={t('dk.empty.noInvoices', 'No invoices yet').toUpperCase()}
            description={t('dk.empty.noInvoicesDesc', 'Create one from a completed job.')}
            ctaLabel={t('dk.actions.newInvoice', 'New invoice').toUpperCase()}
            onCta={() => router.push('/invoices/new' as any)}
          />
        )}

        {/* ─── OFFERTES ─── */}
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionTitleBlock}>
            <DKLabel style={s.sectionTitle}>{t('quotes.quotes', 'Offertes')}</DKLabel>
            <View style={s.sectionCountPill}><Text style={s.sectionCountText}>{quotes.length}</Text></View>
          </View>
          <Pressable onPress={() => setShowQuoteFilterModal(true)} hitSlop={8}>
            <Ionicons name="options-outline" size={20} color={quoteStatusFilter !== 'all' ? DK.colors.accent : DK.colors.textMuted} />
          </Pressable>
        </View>
        {quotes.length > 0 ? (
          <View style={s.docList}>
            {quoteDocs.map((doc) => (
              <Pressable
                key={doc.id}
                style={({ pressed }) => [s.docRow, pressed && { opacity: 0.9 }]}
                onPress={() => router.push(`/quotes/${doc.id}` as any)}
                onLongPress={() => handleDeleteDocument(doc.id, 'offerte', doc.name)}
              >
                <View style={[s.docDot, { backgroundColor: statusColor(doc.status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.docName} numberOfLines={1}>{doc.name}</Text>
                  <Text style={s.docDesc} numberOfLines={1}>{[doc.description, quoteStatusLabel(doc.status)].filter(Boolean).join(' · ')}</Text>
                </View>
                <Text style={s.docAmount}>{formatCurrency(doc.amount)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyPanel
            icon="document-text-outline"
            title={t('dk.empty.noQuotes', 'No quotes yet').toUpperCase()}
            description={t('dk.empty.noQuotesDesc', 'Use the tiered quote builder.')}
            ctaLabel={t('dk.actions.newQuote', 'New quote').toUpperCase()}
            onCta={() => router.push('/contractor/tiered-quote' as any)}
          />
        )}

        {/* ─── BTW-AANGIFTE (NL only) ─── */}
        {(businessProfile?.country === 'NL' || businessProfile?.country === 'DE') && (
          <Pressable
            testID="vat-prep-card"
            onPress={() => router.push('/contractor/vat-prep' as any)}
            style={({ pressed }) => [s.vatCard, pressed && { opacity: 0.92 }]}
          >
            <View style={s.vatIconWrap}>
              <Ionicons name="receipt-outline" size={20} color={DK.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <DKLabel style={s.vatTitle}>{t('dk.money.vatPrep', 'Prepare VAT return')}</DKLabel>
              <Text style={s.vatSub}>{t('dk.money.vatPrepSub', 'Vasco classifies invoices + expenses. You file.')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={DK.colors.textMuted} />
          </Pressable>
        )}

        {/* R269: financial reports — was orphaned in /contractor/reports */}
        <Pressable
          onPress={() => router.push('/contractor/reports' as any)}
          style={({ pressed }) => [s.vatCard, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel={t('dk.money.reports', 'Financial reports')}
        >
          <View style={s.vatIconWrap}>
            <Ionicons name="bar-chart-outline" size={20} color={DK.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <DKLabel style={s.vatTitle}>{t('dk.money.reports', 'Financial reports')}</DKLabel>
            <Text style={s.vatSub}>{t('dk.money.reportsSub', 'P&L, monthly + quarterly. CSV/PDF export.')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={DK.colors.textMuted} />
        </Pressable>

        {/* R273: purchasing hub — receipt scanner, reorders, DATANORM imports.
             R110: gated EU-only. DATANORM is the German/Dutch supplier-spec
             format; reorder feeds run against the EU6 supplier registry
             (Gamma/Praxis/Hornbach/Bauhaus/Leroy Merlin/Würth/etc.). US
             contractors have no supplier index here, so this card would
             open to an empty screen. */}
        {businessProfile?.country !== 'US' ? (
          <Pressable
            onPress={() => router.push('/contractor/inkoop' as any)}
            style={({ pressed }) => [s.vatCard, pressed && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel={t('dk.money.purchasing', 'Purchasing')}
          >
            <View style={s.vatIconWrap}>
              <Ionicons name="cart-outline" size={20} color={DK.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <DKLabel style={s.vatTitle}>{t('dk.money.purchasing', 'Purchasing')}</DKLabel>
              <Text style={s.vatSub}>{t('dk.money.purchasingSub', 'Receipt scanner, reorders, supplier prices.')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={DK.colors.textMuted} />
          </Pressable>
        ) : null}

        {/* ─── MATERIAL DRIFT (R192) — cohort-observed supplier price moves ───
             R110: EU-only. Pricing-moat data is sourced from EU6 supplier
             cohorts; US has no equivalent feed yet. */}
        {businessProfile?.country !== 'US' ? (
          <MaterialDriftCard
            trade={businessProfile?.trade ?? 'general'}
            country={businessProfile?.country ?? 'NL'}
            onPress={() => router.push('/contractor/market-prices' as any)}
          />
        ) : null}

        {/* ─── MARKET PULSE (R205) — margin drift + customer risk + accept lag ───
             R110: EU-only — same EU6 cohort source as MaterialDrift. */}
        {businessProfile?.country !== 'US' ? (
          <MarketPulseCard
            trade={businessProfile?.trade ?? 'general'}
            country={businessProfile?.country ?? 'NL'}
          />
        ) : null}

        {/* ─── CASHFLOW DEEP-DIVE ─── (R267: each section now wired) */}
        <SectionHeader title={t('dk.money.cashflow', 'Cashflow').toUpperCase()} />
        <View style={s.cfCard}>
          <View style={s.cfRow}>
            <Pressable
              style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/(contractor)/facturen' as any)}
              accessibilityRole="button"
              accessibilityLabel={t('dk.pill.revenue', 'Revenue')}
            >
              <CfItem label={t('dk.pill.revenue', 'Revenue').toUpperCase()} value={formatCurrency(paidTotal)} tone={DK.colors.success} />
            </Pressable>
            <View style={s.cfDivider} />
            <Pressable
              style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/contractor/expenses' as any)}
              accessibilityRole="button"
              accessibilityLabel={t('dk.money.costs', 'Costs')}
            >
              <CfItem label={t('dk.money.costs', 'Costs').toUpperCase()} value={fin.totalExpenses === null ? '—' : formatCurrency(fin.totalExpenses)} tone={DK.colors.text} />
            </Pressable>
            <View style={s.cfDivider} />
            <Pressable
              style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.7 }]}
              // Was '/hub/savings' — wrong twice over. It sent a solo
              // contractor into the enterprise portfolio surface (which ships
              // to nobody, so nobody maintains it), and it answered a tap on
              // PROFIT with a SAVINGS screen. /contractor/reports is the P&L
              // this figure comes from, and geld already links to it above.
              onPress={() => router.push('/contractor/reports' as any)}
              accessibilityRole="button"
              accessibilityLabel={t('dk.money.profit', 'Profit')}
            >
              <View style={s.cfProfitRow}>
                <Text style={[s.cfValue, { color: (fin.netIncome ?? 0) >= 0 ? DK.colors.success : DK.colors.danger }]}>{fin.netIncome === null ? '—' : formatCurrency(fin.netIncome)}</Text>
                {marginPercent !== null && (
                  <View style={[s.marginPill, { backgroundColor: (marginPercent >= 0 ? DK.colors.success : DK.colors.danger) + '22', borderColor: (marginPercent >= 0 ? DK.colors.success : DK.colors.danger) + '55' }]}>
                    <Text style={[s.marginPillText, { color: marginPercent >= 0 ? DK.colors.success : DK.colors.danger }]}>{marginPercent}%</Text>
                  </View>
                )}
              </View>
              <DKLabel style={s.cfLabel}>{t('dk.money.profit', 'Profit')}</DKLabel>
            </Pressable>
          </View>
          {/* Margin bar — omitted when the margin is unknown. An empty bar
              reads as "0% margin", which is a claim, not an absence. */}
          {fin.profitMargin !== null && (
            <View style={s.marginBar}>
              <LinearGradient
                colors={[DK.colors.primary, DK.colors.accent, DK.colors.success]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.marginFill, { width: `${Math.min(Math.max(fin.profitMargin, 0), 100)}%` as any }]}
              />
            </View>
          )}
          {/* Sparkline */}
          {sparkData.length >= 2 && (
            <View style={s.sparkBlock}>
              <View style={s.sparkRow}>
                <View style={s.sparkYAxis}>
                  <Text style={s.sparkAxisLabel}>{formatCurrency(sparkMax)}</Text>
                  <Text style={s.sparkAxisLabel}>{formatCurrency(sparkMin)}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Sparkline data={sparkData} width={220} height={48} color={DK.colors.success} />
                </View>
              </View>
              <View style={s.sparkXAxis}>
                {sparkMonthLabels.map((label, idx) => (
                  <Text key={idx} style={s.sparkAxisLabel}>{label}</Text>
                ))}
              </View>
            </View>
          )}
          {/* Projected next month → real cashflow forecast (CashFlowDashboard).
              R10.1: was routing to /hub/intelligence (the data-ingestion overview),
              which had nothing to do with cashflow forecasting — title and
              destination didn't match. */}
          <Pressable
            style={({ pressed }) => [s.projRow, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/contractor/cashflow' as any)}
            accessibilityRole="button"
            accessibilityLabel={projectionLabel}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <View style={[s.projIcon, { backgroundColor: (fin.projectedCashflow >= 0 ? DK.colors.success : DK.colors.danger) + '22' }]}>
                <Ionicons name={fin.projectedCashflow >= 0 ? 'trending-up' : 'trending-down'} size={16} color={fin.projectedCashflow >= 0 ? DK.colors.success : DK.colors.danger} />
              </View>
              <DKLabel style={[s.projLabel, { flexShrink: 1 }]} numberOfLines={1}>{projectionLabel}</DKLabel>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
              <Text style={[s.projValue, { color: fin.projectedCashflow >= 0 ? DK.colors.success : DK.colors.danger }]}>
                {formatCurrency(fin.projectedCashflow)}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={DK.colors.textMuted} />
            </View>
          </Pressable>
          {/* DSO → invoices list filtered to overdue */}
          {fin.avgDaysToPayment > 0 && (
            <Pressable
              style={({ pressed }) => [s.dsoRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/(contractor)/facturen' as any)}
              accessibilityRole="button"
              accessibilityLabel={t('dk.money.avgDso', 'Avg payment term')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <View style={[s.dsoDot, { backgroundColor: dsoStatus.color }]} />
                <DKLabel style={[s.dsoLabel, { flexShrink: 1 }]} numberOfLines={1}>{t('dk.money.avgDso', 'Avg payment term')}</DKLabel>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.dsoValue, { color: dsoStatus.color }]}>{fin.avgDaysToPayment}{t('dk.status.daysShort', 'D')}</Text>
                <Ionicons name="chevron-forward" size={14} color={DK.colors.textMuted} />
              </View>
            </Pressable>
          )}
        </View>

        {/* ─── OVERDUE ─── */}
        {sortedOverdue.length > 0 && (
          <>
            <SectionHeader title={t('dk.money.dunning', 'Overdue').toUpperCase()} count={sortedOverdue.length} accent={DK.colors.danger} />
            <View style={s.docList}>
              {sortedOverdue.map((od) => (
                <Pressable
                  key={od.invoiceId}
                  style={({ pressed }) => [s.overdueRow, pressed && { opacity: 0.9 }]}
                  onPress={() => router.push(`/invoices/${od.invoiceId}` as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.docName} numberOfLines={1}>{od.customer}</Text>
                    <View style={s.overdueMeta}>
                      <View style={s.overduePill}><Text style={s.overduePillText}>{od.daysOverdue}{t('dk.status.daysShort', 'D')}</Text></View>
                      <Text style={s.docDesc}>{t('dk.status.daysOverdue', 'days overdue')}</Text>
                    </View>
                  </View>
                  <Text style={[s.docAmount, { color: DK.colors.danger }]}>{formatCurrency(od.amount)}</Text>
                  <Pressable
                    style={s.remindBtn}
                    hitSlop={6}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      Share.share({ message: t('money.reminderMessage', { defaultValue: 'Hi {{customer}}, a friendly reminder that your invoice of {{amount}} is now {{days}} days overdue. Could you arrange payment? Thanks!', customer: od.customer, amount: formatCurrency(od.amount), days: od.daysOverdue }) });
                    }}
                  >
                    <DKLabel style={s.remindBtnText}>{t('dk.actions.remind', 'Remind')}</DKLabel>
                  </Pressable>
                </Pressable>
              ))}
              <View style={s.overdueTotalRow}>
                <DKLabel style={s.overdueTotalLabel}>{t('dk.money.totalOutstanding', 'Total outstanding')}</DKLabel>
                <Text style={s.overdueTotalAmount}>{formatCurrency(fin.overdueAmount)}</Text>
              </View>
            </View>
          </>
        )}

        {/* ─── TOP CUSTOMERS ─── */}
        {fin.topCustomers.length > 0 && (
          <>
            <SectionHeader title={t('dk.money.topCustomers', 'Top customers').toUpperCase()} />
            {fin.concentrationRisk && (
              <View style={s.riskBanner}>
                <Ionicons name="warning" size={14} color={DK.colors.highlight} />
                <DKLabel style={s.riskText}>{t('dk.money.concentrationRisk', 'High concentration · diversify your client base')}</DKLabel>
              </View>
            )}
            <View style={s.docList}>
              {fin.topCustomers.map((cust) => {
                const barWidth = maxCustomerRevenue > 0 ? Math.max((cust.revenue / maxCustomerRevenue) * 100, 4) : 0;
                return (
                  <View key={cust.customer} style={s.customerRow}>
                    <View style={s.customerHeader}>
                      <Text style={s.docName} numberOfLines={1}>{cust.customer}</Text>
                      <Text style={s.docAmount}>{formatCurrency(cust.revenue)}</Text>
                    </View>
                    <View style={s.customerBarTrack}>
                      <View style={[s.customerBarFill, { width: `${barWidth}%` as any, backgroundColor: cust.percentage > 50 ? DK.colors.highlight : DK.colors.accent }]} />
                    </View>
                    {/* Pluralised, not concatenated: this read "1 RECHNUNGEN" in German and
                        "1 FACTUREN" in Dutch. Same bug feed2a4 fixed for "1 JOBS",
                        and the same dk.pill.*Count _one/_other shape. */}
                    <Text style={s.customerMeta}>{t('dk.pill.invoicesCount', { defaultValue: '{{count}} invoices', count: cust.invoiceCount }).toUpperCase()} · {cust.percentage}%</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ─── FILTER MODALS ─── */}
      <Modal visible={showInvoiceFilterModal} transparent animationType="fade" onRequestClose={() => setShowInvoiceFilterModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowInvoiceFilterModal(false)}>
          <View style={s.modalSheet}>
            <DKLabel style={s.modalTitle}>{t('dk.actions.filterInvoices', 'Filter invoices')}</DKLabel>
            {(['all', 'overdue', 'sent', 'paid', 'draft'] as const).map(status => (
              <Pressable key={status} style={[s.modalRow, invoiceStatusFilter === status && s.modalRowActive]} onPress={() => { setInvoiceStatusFilter(status); setShowInvoiceFilterModal(false); }}>
                <DKLabel style={[s.modalRowText, invoiceStatusFilter === status && s.modalRowTextActive]}>{status}</DKLabel>
                {invoiceStatusFilter === status && <Ionicons name="checkmark" size={18} color={DK.colors.accent} />}
              </Pressable>
            ))}
            <View style={s.modalDivider} />
            <DKLabel style={s.modalSubtitle}>{t('dk.actions.sortBy', 'Sort by')}</DKLabel>
            {(['value-desc', 'date-desc'] as const).map(sort => (
              <Pressable key={sort} style={[s.modalRow, invoiceSort === sort && s.modalRowActive]} onPress={() => { setInvoiceSort(sort); setShowInvoiceFilterModal(false); }}>
                <Text style={[s.modalRowText, invoiceSort === sort && s.modalRowTextActive]}>{(sort === 'value-desc' ? t('dk.actions.byValue', 'Value') : t('dk.actions.byDate', 'Date')).toUpperCase()}</Text>
                {invoiceSort === sort && <Ionicons name="checkmark" size={18} color={DK.colors.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showQuoteFilterModal} transparent animationType="fade" onRequestClose={() => setShowQuoteFilterModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowQuoteFilterModal(false)}>
          <View style={s.modalSheet}>
            <DKLabel style={s.modalTitle}>{t('dk.actions.filterQuotes', 'Filter quotes')}</DKLabel>
            {(['all', 'sent', 'accepted', 'draft'] as const).map(status => (
              <Pressable key={status} style={[s.modalRow, quoteStatusFilter === status && s.modalRowActive]} onPress={() => { setQuoteStatusFilter(status); setShowQuoteFilterModal(false); }}>
                <DKLabel style={[s.modalRowText, quoteStatusFilter === status && s.modalRowTextActive]}>{status}</DKLabel>
                {quoteStatusFilter === status && <Ionicons name="checkmark" size={18} color={DK.colors.accent} />}
              </Pressable>
            ))}
            <View style={s.modalDivider} />
            <Text style={s.modalSubtitle}>{t('dk.money.sortBy', 'SORT BY')}</Text>
            {(['value-desc', 'date-desc'] as const).map(sort => (
              <Pressable key={sort} style={[s.modalRow, quoteSort === sort && s.modalRowActive]} onPress={() => { setQuoteSort(sort); setShowQuoteFilterModal(false); }}>
                <Text style={[s.modalRowText, quoteSort === sort && s.modalRowTextActive]}>{(sort === 'value-desc' ? t('dk.actions.byValue', 'Value') : t('dk.actions.byDate', 'Date')).toUpperCase()}</Text>
                {quoteSort === sort && <Ionicons name="checkmark" size={18} color={DK.colors.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* FAB REMOVED (2026-08-07 screen walk).
          It pushed to `/contractor/tiered-quote` — the SAME route as the
          full-width "New quote" CTA a few rows up, so it added no capability.
          What it did add was a 56pt circle parked at right:20/bottom:110,
          directly over the right-hand edge of the ACHTERSTALLIG rows: the
          "Herinner" button on any overdue invoice scrolled to that height was
          covered and could not be tapped. A duplicate action is not worth
          blocking a real one. Same call as recurring/index.tsx's twin CTAs. */}
    </View>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────
function SectionHeader({ title, count, accent }: { title: string; count?: number; accent?: string }) {
  return (
    <View style={s.sectionHeaderRow}>
      <View style={s.sectionTitleBlock}>
        <Text style={[s.sectionTitle, accent ? { color: accent } : null]}>{title}</Text>
        {typeof count === 'number' ? (
          <View style={[s.sectionCountPill, accent ? { backgroundColor: accent + '22', borderColor: accent + '55' } : null]}>
            <Text style={[s.sectionCountText, accent ? { color: accent } : null]}>{count}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CfItem({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.cfValue, { color: tone }]}>{value}</Text>
      <Text style={s.cfLabel}>{label}</Text>
    </View>
  );
}

function EmptyPanel({ icon, title, description, ctaLabel, onCta }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; ctaLabel: string; onCta: () => void }) {
  return (
    <View style={s.emptyPanel}>
      <View style={s.emptyIcon}><Ionicons name={icon} size={28} color={DK.colors.accent} /></View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyDesc}>{description}</Text>
      <Pressable style={({ pressed }) => [s.emptyCta, pressed && { opacity: 0.85 }]} onPress={onCta}>
        <Text style={s.emptyCtaText}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

function statusColor(status?: string): string {
  switch (status) {
    case 'paid': return DK.colors.success;
    case 'sent': return DK.colors.accent;
    case 'overdue': return DK.colors.danger;
    case 'accepted': return DK.colors.success;
    case 'draft': return DK.colors.textMuted;
    default: return DK.colors.textMuted;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  scroll: { flex: 1 },
  // 180 = FAB bottom offset (110) + FAB height (56) + breathing room, so the
  // last row can scroll clear of the floating button instead of sitting under
  // it (the FAB was clipping the last action's label).
  scrollContent: { paddingHorizontal: 20, paddingBottom: 180, gap: 14 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontFamily: DK.type.display900, fontSize: 28, color: DK.colors.text, letterSpacing: -0.8 },

  // KPI
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiTile: {
    flex: 1,
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 14, minHeight: 82,
    justifyContent: 'space-between',
  },
  // The three tiles are flex:1 across the row, so the label box is ~92dp. Dutch
  // "OPENSTAAND" fits; English "OUTSTANDING" does not and wrapped, orphaning the
  // final letter onto its own line ("OUTSTANDIN" / "G") — seen on the Android
  // emulator in en-US. Call sites pass numberOfLines + adjustsFontSizeToFit so a
  // long label shrinks a little instead of wrapping; NOT defaulted inside
  // DKLabel, because R107 removed exactly that default after it ellipsized
  // unrelated chips and headers.
  kpiLabel: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.textMuted, letterSpacing: 1.3 },
  kpiValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiValue: { fontFamily: DK.type.display900, fontSize: 22, letterSpacing: -0.6, lineHeight: 24 },

  collectionBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.panel2,
    borderWidth: 1, borderColor: DK.colors.border,
  },
  collectionText: {
    fontFamily: DK.type.display800,
    fontSize: 11,
    color: DK.colors.textMuted,
    letterSpacing: 1,
  },

  // Vasco panel
  vascoPanel: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 14,
  },
  vascoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  vascoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: DK.radius.chip, backgroundColor: DK.colors.accent + '22', borderWidth: 1, borderColor: DK.colors.accent + '55' },
  vascoChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DK.colors.accent },
  vascoChipText: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.accent, letterSpacing: 1.3 },
  vascoCountText: { fontFamily: DK.type.display900, fontSize: 12, color: DK.colors.textMuted },
  vascoInsight: {
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.button,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 12, marginBottom: 8,
  },
  vascoInsightTitle: { fontFamily: DK.type.display800, fontSize: 13, color: DK.colors.text },
  vascoInsightDesc: { fontFamily: DK.type.body400, fontSize: 12, color: DK.colors.textMuted, marginTop: 3, lineHeight: 16 },
  vascoQueueRow: { flexDirection: 'column', gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DK.colors.border },
  vascoQueueActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  vascoQueueTitle: { fontFamily: DK.type.display700, fontSize: 13, color: DK.colors.text },
  vascoQueueImpact: { fontFamily: DK.type.body500, fontSize: 11, color: DK.colors.highlight, marginTop: 2 },
  vascoQueueReject: { width: 26, height: 26, borderRadius: 13, backgroundColor: DK.colors.panel2, borderWidth: 1, borderColor: DK.colors.border, alignItems: 'center', justifyContent: 'center' },
  vascoQueueApprove: { backgroundColor: DK.colors.accent, paddingVertical: 6, paddingHorizontal: 10, borderRadius: DK.radius.button },
  vascoQueueApproveText: { fontFamily: DK.type.display900, fontSize: 10, color: DK.colors.bg, letterSpacing: 1 },

  // Section headers
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitleBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: DK.type.display900, fontSize: 13, color: DK.colors.text, letterSpacing: 1.8 },
  sectionCountPill: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, borderRadius: DK.radius.chip, backgroundColor: DK.colors.panel2, borderWidth: 1, borderColor: DK.colors.border, alignItems: 'center' },
  sectionCountText: { fontFamily: DK.type.display900, fontSize: 10, color: DK.colors.textMuted },

  // Doc list
  docList: { gap: 6 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 12,
  },
  docDot: { width: 8, height: 8, borderRadius: 4 },
  docName: { fontFamily: DK.type.display800, fontSize: 13, color: DK.colors.text },
  docDesc: { fontFamily: DK.type.body400, fontSize: 11, color: DK.colors.textMuted, marginTop: 2 },
  docAmount: { fontFamily: DK.type.display900, fontSize: 14, color: DK.colors.text, letterSpacing: -0.3 },
  sendBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: DK.colors.accent, alignItems: 'center', justifyContent: 'center' },

  // New quote primary
  newQuoteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: DK.radius.button,
    overflow: 'hidden',
    shadowColor: DK.colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  newQuoteBtnText: { fontFamily: DK.type.display900, fontSize: 13, color: '#FFFFFF', letterSpacing: 1.4 },

  // VAT card
  vatCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 14,
  },
  vatIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: DK.colors.accent + '1A', alignItems: 'center', justifyContent: 'center' },
  vatTitle: { fontFamily: DK.type.display800, fontSize: 13, color: DK.colors.text, letterSpacing: 0.8 },
  vatSub: { fontFamily: DK.type.body400, fontSize: 12, color: DK.colors.textMuted, marginTop: 3 },

  // Cashflow card
  cfCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 16, gap: 14,
  },
  cfRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cfDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: DK.colors.border },
  cfValue: { fontFamily: DK.type.display900, fontSize: 18, letterSpacing: -0.4, lineHeight: 22 },
  cfLabel: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.textMuted, letterSpacing: 1.3, marginTop: 4 },
  cfProfitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  marginPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: DK.radius.chip, borderWidth: 1 },
  marginPillText: { fontFamily: DK.type.display900, fontSize: 10, letterSpacing: 0.6 },

  marginBar: { height: 6, backgroundColor: DK.colors.panel2, borderRadius: 3, overflow: 'hidden' },
  marginFill: { height: '100%' },

  sparkBlock: { gap: 6 },
  sparkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkYAxis: { height: 48, justifyContent: 'space-between', alignItems: 'flex-end', minWidth: 40 },
  sparkAxisLabel: { fontFamily: DK.type.body600, fontSize: 9, color: DK.colors.textMuted, letterSpacing: 0.5 },
  sparkXAxis: { flexDirection: 'row', justifyContent: 'space-around' },

  projRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DK.colors.border },
  projIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  projLabel: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.textMuted, letterSpacing: 1.2 },
  projValue: { fontFamily: DK.type.display900, fontSize: 16, letterSpacing: -0.3 },

  dsoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DK.colors.border },
  dsoDot: { width: 8, height: 8, borderRadius: 4 },
  dsoLabel: { fontFamily: DK.type.display800, fontSize: 10, color: DK.colors.textMuted, letterSpacing: 1.2 },
  dsoValue: { fontFamily: DK.type.display900, fontSize: 14, letterSpacing: -0.3 },

  // Overdue
  overdueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.danger + '55',
    padding: 12,
  },
  overdueMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  overduePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: DK.radius.chip, backgroundColor: DK.colors.danger + '22', borderWidth: 1, borderColor: DK.colors.danger + '55' },
  overduePillText: { fontFamily: DK.type.display900, fontSize: 10, color: DK.colors.danger, letterSpacing: 0.6 },
  remindBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: DK.radius.button, backgroundColor: DK.colors.danger, alignItems: 'center', justifyContent: 'center' },
  remindBtnText: { fontFamily: DK.type.display900, fontSize: 10, color: '#FFFFFF', letterSpacing: 1.1 },
  overdueTotalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: DK.colors.panel2,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingVertical: 14, paddingHorizontal: 14,
  },
  overdueTotalLabel: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.textMuted, letterSpacing: 1.3 },
  overdueTotalAmount: { fontFamily: DK.type.display900, fontSize: 18, color: DK.colors.danger, letterSpacing: -0.3 },

  // Top customers
  riskBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: DK.radius.card,
    backgroundColor: DK.colors.highlight + '1A',
    borderWidth: 1, borderColor: DK.colors.highlight + '55',
  },
  riskText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.highlight, letterSpacing: 1, flex: 1 },
  customerRow: {
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    padding: 12,
  },
  customerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerBarTrack: { height: 6, backgroundColor: DK.colors.panel2, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  customerBarFill: { height: '100%', borderRadius: 3 },
  customerMeta: { fontFamily: DK.type.body600, fontSize: 10, color: DK.colors.textMuted, marginTop: 6, letterSpacing: 0.8 },

  // Empty panel
  emptyPanel: {
    alignItems: 'center',
    backgroundColor: DK.colors.panel,
    borderRadius: DK.radius.card,
    borderWidth: 1, borderColor: DK.colors.border,
    paddingVertical: 32, paddingHorizontal: 24,
    gap: 8,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: DK.colors.accent + '1A', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: DK.type.display900, fontSize: 14, color: DK.colors.text, letterSpacing: 1.4 },
  emptyDesc: { fontFamily: DK.type.body400, fontSize: 12, color: DK.colors.textMuted, textAlign: 'center', lineHeight: 17 },
  emptyCta: {
    marginTop: 4,
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: DK.radius.chip,
    backgroundColor: DK.colors.accent + '14',
    borderWidth: 1, borderColor: DK.colors.accent + '44',
  },
  emptyCtaText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.accent, letterSpacing: 1.2 },

  // Filter modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalSheet: { width: '100%', maxWidth: 340, backgroundColor: DK.colors.panel, borderRadius: DK.radius.card, borderWidth: 1, borderColor: DK.colors.border, padding: 16 },
  modalTitle: { fontFamily: DK.type.display900, fontSize: 14, color: DK.colors.text, letterSpacing: 1.6, marginBottom: 10 },
  modalSubtitle: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.textMuted, letterSpacing: 1.4, marginTop: 8, marginBottom: 6 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: DK.radius.button },
  modalRowActive: { backgroundColor: DK.colors.accent + '14' },
  modalRowText: { fontFamily: DK.type.display800, fontSize: 12, color: DK.colors.textMuted, letterSpacing: 1.1 },
  modalRowTextActive: { color: DK.colors.accent },
  modalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: DK.colors.border, marginVertical: 8 },

  // Full empty
  fullEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  fullEmptyTitle: { fontFamily: DK.type.display900, fontSize: 16, color: DK.colors.text, letterSpacing: 1.8, marginTop: 10 },
  fullEmptyDesc: { fontFamily: DK.type.body400, fontSize: 13, color: DK.colors.textMuted, textAlign: 'center' },
  fullEmptyBtn: {
    marginTop: 14,
    paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: DK.radius.button,
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: DK.colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 10,
  },
  fullEmptyBtnText: { fontFamily: DK.type.display900, fontSize: 13, color: '#FFFFFF', letterSpacing: 1.4 },

  // FAB
});
