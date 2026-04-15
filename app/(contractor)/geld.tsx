// =============================================================================
// GELD — Money tab. Clean answer to: "Where's my money?"
// =============================================================================
// KPIs → VascoCard (financial AI) → Facturen+Offertes → Cashflow
// No dashboards, no bleed between sections. Vasco is the financial brain.
// =============================================================================

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Share, Platform, Alert, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { SafeArea } from '../../src/theme/spacing';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { useAppState } from '../../src/state/AppState';
import { useCashFlow } from '../../src/services/cashFlowService';
import { useFinancialAnalysis } from '../../src/services/financialAnalysisService';
import { formatCurrency } from '../../src/i18n/formatting';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { Sparkline } from '../../src/components/shared/Sparkline';
import { VascoCard } from '../../src/components/shared/VascoCard';
import { SkeletonList } from '../../src/components/shared/SkeletonList';
import { EmptyState } from '../../src/components/shared/EmptyState';
import { CashFlowForecastCard } from '../../src/components/contractor/CashFlowForecastCard';
import { useAIQueue } from '../../src/services/aiActionQueueService';
import { useVascoGuidance } from '../../src/services/vascoGuidanceService';

// Month label helper for sparkline axis
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function getLastNMonthLabels(n: number): string[] {
  const now = new Date();
  const labels: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(MONTH_LABELS[d.getMonth()]);
  }
  return labels;
}

/** Compact currency: €12.5K, €1.2M, €850 */
function compactCurrency(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `\u20AC${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `\u20AC${(amount / 1_000).toFixed(1)}K`;
  return `\u20AC${Math.round(amount)}`;
}

type SortMode = 'value-desc' | 'date-desc' | 'status';

export default function GeldScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState('');
  const [quoteFilter, setQuoteFilter] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>('all');
  const [invoiceSort, setInvoiceSort] = useState<SortMode>('date-desc');
  const [quoteSort, setQuoteSort] = useState<SortMode>('date-desc');
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [showInvoiceFilterModal, setShowInvoiceFilterModal] = useState(false);
  const [showQuoteFilterModal, setShowQuoteFilterModal] = useState(false);
  const { invoices, quotes, markInvoiceSent, removeInvoice, removeQuote, isLoading } = useAppState();
  const cashFlow = useCashFlow();
  const fin = useFinancialAnalysis();

  const aiQueue = useAIQueue();
  const allGuidance = useVascoGuidance('contractor', 'geld');
  const topInsight = allGuidance.filter(g => g.priority === 'critical' || g.priority === 'high')[0] ?? null;

  const handleDeleteDocument = useCallback((docId: string, docType: 'factuur' | 'offerte', docName: string) => {
    const title = docType === 'factuur'
      ? t('invoices.deleteInvoice', 'Delete invoice?')
      : t('quotes.deleteQuote', 'Delete quote?');
    Alert.alert(title, docName, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('common.delete', 'Delete'),
        style: 'destructive',
        onPress: () => {
          if (docType === 'factuur') removeInvoice(docId);
          else removeQuote(docId);
          hapticSuccess();
        },
      },
    ]);
  }, [removeInvoice, removeQuote, t]);

  useEffect(() => { recordScreenVisit('geld'); }, []);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  // Financial analysis — real numbers from the analysis engine
  const outstandingTotal = fin.totalOutstanding;
  const overdueCount = fin.overdueCount;
  const paidTotal = fin.totalRevenue;

  // Trend indicators — compare current vs previous month
  const trendArrow = useCallback((current: number, previous: number): { icon: 'trending-up' | 'trending-down' | 'remove'; color: string } => {
    if (previous === 0 || current === previous) return { icon: 'remove', color: SemanticColors.textTertiary };
    return current > previous
      ? { icon: 'trending-up', color: SemanticColors.feedbackSuccess }
      : { icon: 'trending-down', color: SemanticColors.feedbackError };
  }, []);
  const revenueTrend = useMemo(() => {
    const prev = fin.monthlyInflows.length >= 2 ? fin.monthlyInflows[fin.monthlyInflows.length - 2] : 0;
    return trendArrow(paidTotal, prev);
  }, [paidTotal, fin.monthlyInflows, trendArrow]);

  // Collection rate — % of invoices paid on time (not overdue)
  const collectionRate = useMemo(() => {
    const total = invoices.length;
    if (total === 0) return 0;
    const paidOnTime = invoices.filter((i: any) => i.status === 'paid').length;
    return Math.round((paidOnTime / total) * 100);
  }, [invoices]);

  // All documents: invoices + quotes, sorted by status priority (overdue first)
  const documents = useMemo(() => {
    const statusOrder: Record<string, number> = { overdue: 0, sent: 1, draft: 2, accepted: 3, paid: 4 };
    const docs = [
      ...invoices.map((inv: any) => ({
        id: inv.id,
        type: 'factuur' as const,
        name: inv.customer || inv.customerName || inv.reference || inv.id,
        description: inv.job || t('invoices.invoice', 'Factuur'),
        amount: inv.total || inv.amount || 0,
        status: inv.status,
        route: `/invoices/${inv.id}`,
      })),
      ...quotes.map((q: any) => ({
        id: q.id,
        type: 'offerte' as const,
        name: q.customer || q.id,
        description: q.job || q.description || t('quotes.quote', 'Offerte'),
        amount: q.amount || 0,
        status: q.status,
        route: `/quotes/${q.id}`,
      })),
    ];
    return docs.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
  }, [invoices, quotes]);

  // Sparkline from financial analysis engine (last 6 months inflows)
  const sparkData = useMemo(() => fin.monthlyInflows, [fin.monthlyInflows]);
  const sparkMonthLabels = useMemo(() => getLastNMonthLabels(sparkData.length || 6), [sparkData.length]);
  const sparkMin = useMemo(() => sparkData.length ? Math.min(...sparkData) : 0, [sparkData]);
  const sparkMax = useMemo(() => sparkData.length ? Math.max(...sparkData) : 0, [sparkData]);

  // Overdue details sorted by most overdue first
  const sortedOverdue = useMemo(() =>
    [...fin.overdueDetails].sort((a, b) => b.daysOverdue - a.daysOverdue),
    [fin.overdueDetails]
  );

  // Top customers: compute max revenue for bar chart
  const maxCustomerRevenue = useMemo(() => {
    if (fin.topCustomers.length === 0) return 0;
    return Math.max(...fin.topCustomers.map(c => c.revenue));
  }, [fin.topCustomers]);
  const totalCustomerRevenue = useMemo(() => {
    return fin.topCustomers.reduce((sum, c) => sum + c.revenue, 0);
  }, [fin.topCustomers]);

  // Profit margin percentage
  const marginPercent = useMemo(() => {
    return paidTotal > 0 ? Math.round((fin.netIncome / paidTotal) * 100) : 0;
  }, [fin.netIncome, paidTotal]);

  // DSO status
  const dsoStatus = useMemo((): { color: string; dotColor: string } => {
    if (fin.avgDaysToPayment <= 21) return { color: SemanticColors.feedbackSuccess, dotColor: SemanticColors.feedbackSuccess };
    if (fin.avgDaysToPayment <= 30) return { color: Palette.hermesOrange, dotColor: Palette.hermesOrange };
    return { color: SemanticColors.feedbackError, dotColor: SemanticColors.feedbackError };
  }, [fin.avgDaysToPayment]);

  if (isLoading) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('tabs.money', 'Geld')}</Text>
        </View>
        <SkeletonList count={3} showAction lines={3} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('tabs.money', 'Geld')}</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* KPIs — the 4 numbers that matter */}
        <FadeIn delay={0}>
          <View style={s.kpiCard}>
            <Pressable style={s.kpiItem} onPress={() => router.push('/(contractor)/facturen' as any)} accessibilityRole="button" accessibilityLabel={`${t('money.received', 'Ontvangen')}: ${formatCurrency(paidTotal)}`}>
              <Ionicons name="wallet" size={16} color={SemanticColors.feedbackSuccess} style={{ marginBottom: GRID.xs }} />
              <Text style={s.kpiLabel}>{t('money.revenue', 'Omzet')}</Text>
              <View style={s.kpiValueRow}>
                <Text style={[s.kpiValue, { color: SemanticColors.feedbackSuccess }]}>{compactCurrency(paidTotal)}</Text>
                <Ionicons name={revenueTrend.icon} size={14} color={revenueTrend.color} />
              </View>
              <View style={[s.kpiAccentLine, { backgroundColor: SemanticColors.feedbackSuccess }]} />
            </Pressable>
            <View style={s.kpiDivider} />
            <Pressable style={s.kpiItem} onPress={() => router.push('/(contractor)/facturen' as any)} accessibilityRole="button" accessibilityLabel={`${t('money.outstanding', 'Uitstaand')}: ${formatCurrency(outstandingTotal)}`}>
              <Ionicons name="hourglass" size={16} color={Palette.hermesOrange} style={{ marginBottom: GRID.xs }} />
              <Text style={s.kpiLabel}>{t('money.outstanding', 'Uitstaand')}</Text>
              <Text style={s.kpiValue}>{compactCurrency(outstandingTotal)}</Text>
              <View style={[s.kpiAccentLine, { backgroundColor: Palette.hermesOrange }]} />
            </Pressable>
            <View style={s.kpiDivider} />
            <Pressable style={s.kpiItem} accessibilityRole="button" accessibilityLabel={`${t('money.pipeline', 'Pipeline')}: ${formatCurrency(fin.quotePipeline)}`}>
              <Ionicons name="analytics" size={16} color={SemanticColors.feedbackInfo} style={{ marginBottom: GRID.xs }} />
              <Text style={s.kpiLabel}>{t('money.pipeline', 'Pipeline')}</Text>
              <Text style={s.kpiValue}>{compactCurrency(fin.quotePipeline)}</Text>
              <View style={[s.kpiAccentLine, { backgroundColor: SemanticColors.feedbackInfo }]} />
            </Pressable>
          </View>
          {/* Collection rate badge */}
          {invoices.length > 0 && (
            <View style={s.collectionBadge}>
              <Ionicons name="checkmark-circle" size={14} color={collectionRate >= 80 ? SemanticColors.feedbackSuccess : collectionRate >= 50 ? SemanticColors.feedbackWarning : SemanticColors.feedbackError} />
              <Text style={s.collectionText}>{t('money.collectionRate', 'Collection rate')}: <Text style={{ fontFamily: TYPE.sectionFamily, color: collectionRate >= 80 ? SemanticColors.feedbackSuccess : collectionRate >= 50 ? SemanticColors.feedbackWarning : SemanticColors.feedbackError }}>{collectionRate}%</Text></Text>
            </View>
          )}
        </FadeIn>

        {/* 30-day cash-flow forecast — inflows vs outflows */}
        <FadeIn delay={30}>
          <CashFlowForecastCard
            invoices={invoices as any}
            quotes={quotes as any}
            jobs={[] as any}
          />
        </FadeIn>

        {/* Vasco — financial AI (overdue reminders, payment predictions, expense tips) */}
        <FadeIn delay={40}>
          <VascoCard
            briefing={null}
            queueItems={aiQueue.items.filter(i => i.type === 'draft_invoice' || i.type === 'draft_reminder')}
            topInsight={topInsight}
            automationsCount={0}
            onApproveQueueItem={(id) => { hapticSuccess(); aiQueue.approve(id); }}
            onRejectQueueItem={(id) => aiQueue.reject(id)}
            onInsightAction={(insight) => {
              if ((insight as any).actionRoute) router.push((insight as any).actionRoute as any);
            }}
          />
        </FadeIn>

        {/* Facturen — separate section */}
        <FadeIn delay={80}>
          <View style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.sectionTitle}>{t('invoices.invoices', 'Facturen')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: GRID.sm }}>
                <Text style={s.sectionCount}>{invoices.length}</Text>
                <Pressable onPress={() => setShowInvoiceFilterModal(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('money.filter', 'Filter')}>
                  <Ionicons name="options-outline" size={20} color={invoiceStatusFilter !== 'all' ? Palette.hermesOrange : SemanticColors.textSecondary} />
                </Pressable>
              </View>
            </View>
            {invoices.length > 0 ? (
              <View style={s.docList}>
                {documents.filter(d => d.type === 'factuur' && (!invoiceFilter || d.name.toLowerCase().includes(invoiceFilter.toLowerCase())) && (invoiceStatusFilter === 'all' || d.status === invoiceStatusFilter)).sort((a, b) => invoiceSort === 'value-desc' ? b.amount - a.amount : 0).map((doc) => (
                  <Pressable
                    key={doc.id}
                    style={({ pressed }) => [s.docRow, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => router.push(doc.route as any)}
                    onLongPress={() => handleDeleteDocument(doc.id, doc.type, doc.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('invoices.invoice', 'Factuur')}: ${doc.name}, ${formatCurrency(doc.amount)}, ${doc.status}`}
                    accessibilityHint={t('a11y.opensDetails', 'Opens details')}
                  >
                    <View style={[s.docDot, { backgroundColor: getStatusColor(doc.status) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.docName} numberOfLines={1} ellipsizeMode="tail">{doc.name}</Text>
                      <Text style={s.docDesc} numberOfLines={1} ellipsizeMode="tail">{doc.description} · {doc.status}</Text>
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
                          try {
                            hapticSuccess();
                            markInvoiceSent(doc.id);
                            Alert.alert(t('invoices.markedAsSent', 'Invoice marked as sent'), t('invoices.markedAsSentDesc', 'Share the PDF with your customer via the share button on the invoice detail screen.'));
                          } finally {
                            setSendingInvoiceId(null);
                          }
                        }}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t('a11y.sendInvoice', 'Send invoice')}
                      >
                        <Ionicons name="send" size={14} color={Palette.white} />
                      </Pressable>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState
                icon="receipt-outline"
                title={t('money.noInvoicesTitle', 'No invoices yet')}
                description={t('money.noInvoicesDesc', 'Create one from a completed job or from scratch — Vasco handles the reminders and payment links.')}
                actionLabel={t('money.newInvoice', 'New invoice')}
                onAction={() => router.push('/contractor/new-invoice' as any)}
              />
            )}
          </View>
        </FadeIn>

        {/* Offertes — separate section */}
        <FadeIn delay={100}>
          <View style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.sectionTitle}>{t('quotes.quotes', 'Offertes')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: GRID.sm }}>
                <Text style={s.sectionCount}>{quotes.length}</Text>
                <Pressable onPress={() => setShowQuoteFilterModal(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('money.filter', 'Filter')}>
                  <Ionicons name="options-outline" size={20} color={quoteStatusFilter !== 'all' ? Palette.hermesOrange : SemanticColors.textSecondary} />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [s.newQuoteBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              onPress={() => router.push('/contractor/tiered-quote' as any)}
              accessibilityRole="button"
              accessibilityLabel={t('quotes.newQuote', 'Nieuwe offerte')}
            >
              <Ionicons name="add-circle-outline" size={18} color={Palette.white} />
              <Text style={s.newQuoteBtnText}>{t('quotes.newQuote', 'Nieuwe offerte')}</Text>
            </Pressable>

            {quotes.length > 0 ? (
              <View style={s.docList}>
                {documents.filter(d => d.type === 'offerte' && (!quoteFilter || d.name.toLowerCase().includes(quoteFilter.toLowerCase())) && (quoteStatusFilter === 'all' || d.status === quoteStatusFilter)).sort((a, b) => quoteSort === 'value-desc' ? b.amount - a.amount : 0).map((doc) => (
                  <Pressable
                    key={doc.id}
                    style={({ pressed }) => [s.docRow, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => router.push(doc.route as any)}
                    onLongPress={() => handleDeleteDocument(doc.id, doc.type, doc.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('quotes.quote', 'Offerte')}: ${doc.name}, ${formatCurrency(doc.amount)}, ${doc.status}`}
                    accessibilityHint={t('a11y.opensDetails', 'Opens details')}
                  >
                    <View style={[s.docDot, { backgroundColor: getStatusColor(doc.status) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.docName} numberOfLines={1} ellipsizeMode="tail">{doc.name}</Text>
                      <Text style={s.docDesc} numberOfLines={1} ellipsizeMode="tail">{doc.description} · {doc.status}</Text>
                    </View>
                    <Text style={s.docAmount}>{formatCurrency(doc.amount)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState
                icon="document-text-outline"
                title={t('money.noQuotesTitle', 'No quotes yet')}
                description={t('money.noQuotesDesc', 'Try the tiered quote builder — customers accept directly from their phone.')}
                actionLabel={t('quotes.newQuote', 'New quote')}
                onAction={() => router.push('/contractor/tiered-quote' as any)}
              />
            )}
          </View>
        </FadeIn>

        {/* Cashflow — real analysis */}
        <FadeIn delay={120}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('money.cashflow', 'Cashflow')}</Text>
            <View style={s.cfCard}>
              {/* Revenue / Costs / Profit row */}
              <View style={s.cfRow}>
                <View style={s.cfItem}>
                  <Text style={[s.cfValueDisplay, { color: SemanticColors.feedbackSuccess }]}>
                    {formatCurrency(paidTotal)}
                  </Text>
                  <Text style={s.cfLabel}>{t('money.revenue', 'Omzet')}</Text>
                </View>
                <View style={s.cfDivider} />
                <View style={s.cfItem}>
                  <Text style={s.cfValueDisplay}>
                    {formatCurrency(fin.totalExpenses)}
                  </Text>
                  <Text style={s.cfLabel}>{t('money.costs', 'Kosten')}</Text>
                </View>
                <View style={s.cfDivider} />
                <View style={s.cfItem}>
                  <View style={s.profitRow}>
                    <Text style={[s.cfValueDisplay, { color: fin.netIncome >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
                      {formatCurrency(fin.netIncome)}
                    </Text>
                    {paidTotal > 0 && (
                      <View style={[s.marginPill, { backgroundColor: marginPercent >= 0 ? SemanticColors.feedbackSuccessBg : SemanticColors.feedbackErrorBg }]}>
                        <Text style={[s.marginPillText, { color: marginPercent >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
                          {marginPercent}%
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.cfLabel}>{t('money.profit', 'Winst')}</Text>
                </View>
              </View>

              {/* Margin bar with gradient */}
              <View style={s.marginBar}>
                <LinearGradient
                  colors={[Palette.hermesOrange, SemanticColors.feedbackSuccess]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.marginFill, { width: `${Math.min(Math.max(fin.profitMargin, 0), 100)}%` as any }]}
                />
              </View>

              {/* Sparkline with axis labels */}
              {sparkData.length >= 2 && (
                <View style={s.sparkSection}>
                  <View style={s.sparklineContainer}>
                    {/* Y-axis labels */}
                    <View style={s.sparkYAxis}>
                      <Text style={s.sparkAxisLabel}>{formatCurrency(sparkMax)}</Text>
                      <Text style={s.sparkAxisLabel}>{formatCurrency(sparkMin)}</Text>
                    </View>
                    <View style={s.sparkChartArea}>
                      <Sparkline data={sparkData} width={220} height={48} color={SemanticColors.feedbackSuccess} />
                    </View>
                  </View>
                  {/* X-axis month labels */}
                  <View style={s.sparkXAxis}>
                    {sparkMonthLabels.map((label, idx) => (
                      <Text key={idx} style={s.sparkAxisLabel}>{label}</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Projected next month — prominent card */}
              <View style={s.projCard}>
                <View style={s.projCardLeft}>
                  <View style={[s.projIconWrap, { backgroundColor: fin.projectedCashflow >= 0 ? SemanticColors.feedbackSuccessBg : SemanticColors.feedbackErrorBg }]}>
                    <Ionicons
                      name={fin.projectedCashflow >= 0 ? 'trending-up' : 'trending-down'}
                      size={18}
                      color={fin.projectedCashflow >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError}
                    />
                  </View>
                  <Text style={s.projCardLabel}>{t('money.projected', 'Prognose volgende maand')}</Text>
                </View>
                <Text style={[s.projCardValue, { color: fin.projectedCashflow >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
                  {formatCurrency(fin.projectedCashflow)}
                </Text>
              </View>

              {/* DSO with status dot */}
              {fin.avgDaysToPayment > 0 && (
                <View style={s.dsoRow}>
                  <View style={s.dsoLeft}>
                    <View style={[s.dsoDot, { backgroundColor: dsoStatus.dotColor }]} />
                    <Text style={s.projLabel}>{t('money.dso', 'Gem. betaaltermijn')}</Text>
                  </View>
                  <Text style={[s.projValue, { color: dsoStatus.color }]}>
                    {fin.avgDaysToPayment} {t('common.days', 'dagen')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </FadeIn>

        {/* Overdue invoices detail — urgency */}
        {sortedOverdue.length > 0 && (
          <FadeIn delay={140}>
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('money.overdue', 'Achterstallig')}</Text>
              <View style={s.docList}>
                {sortedOverdue.map((od) => (
                  <Pressable
                    key={od.invoiceId}
                    style={({ pressed }) => [s.overdueRow, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => router.push(`/invoices/${od.invoiceId}` as any)}
                    accessibilityRole="button"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.docName} numberOfLines={1}>{od.customer}</Text>
                      <View style={s.overdueMetaRow}>
                        <View style={s.overduePill}>
                          <Text style={s.overduePillText}>{od.daysOverdue}d</Text>
                        </View>
                        <Text style={s.docDesc}>{t('common.daysOverdue', 'dagen achterstallig')}</Text>
                      </View>
                    </View>
                    <Text style={[s.docAmount, { color: SemanticColors.feedbackError }]}>{formatCurrency(od.amount)}</Text>
                    <Pressable
                      style={s.inlineRemindBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        Share.share({ message: t('money.reminderMessage', { defaultValue: 'Hi, this is a friendly reminder that invoice for {{customer}} ({{amount}}) is {{days}} days overdue. Could you arrange payment?', customer: od.customer, amount: formatCurrency(od.amount), days: od.daysOverdue }) });
                      }}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={t('money.sendReminder', 'Send reminder')}
                    >
                      <Text style={s.inlineRemindText}>{t('money.remind', 'Remind')}</Text>
                    </Pressable>
                  </Pressable>
                ))}
                {/* Total outstanding at bottom */}
                <View style={s.overdueTotalRow}>
                  <Text style={s.overdueTotalLabel}>{t('money.totalOutstanding', 'Total outstanding')}</Text>
                  <Text style={s.overdueTotalAmount}>{formatCurrency(fin.overdueAmount)}</Text>
                </View>
              </View>
            </View>
          </FadeIn>
        )}

        {/* Top customers by revenue — with mini bar chart */}
        {fin.topCustomers.length > 0 && (
          <FadeIn delay={160}>
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('money.topCustomers', 'Top klanten')}</Text>
              {fin.concentrationRisk && (
                <View style={s.riskBanner}>
                  <Ionicons name="warning" size={14} color={SemanticColors.feedbackWarning} />
                  <Text style={s.riskText}>{t('money.concentrationRisk', 'High concentration: diversify your client base')}</Text>
                </View>
              )}
              <View style={s.docList}>
                {fin.topCustomers.map((cust) => {
                  const barWidth = totalCustomerRevenue > 0 ? Math.max((cust.revenue / totalCustomerRevenue) * 100, 4) : 0;
                  return (
                    <View key={cust.customer} style={s.customerRow}>
                      <View style={{ flex: 1 }}>
                        <View style={s.customerHeader}>
                          <Text style={s.docName} numberOfLines={1}>{cust.customer}</Text>
                          <Text style={s.docAmount}>{formatCurrency(cust.revenue)}</Text>
                        </View>
                        <View style={s.customerBarTrack}>
                          <View style={[
                            s.customerBarFill,
                            {
                              width: `${barWidth}%` as any,
                              backgroundColor: cust.percentage > 50 ? SemanticColors.feedbackWarning : Palette.hermesOrange,
                            },
                          ]} />
                        </View>
                        <Text style={s.customerMeta}>{cust.invoiceCount} {t('invoices.invoices', 'facturen')} · {cust.percentage}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </FadeIn>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Invoice Filter Modal */}
      <Modal visible={showInvoiceFilterModal} transparent animationType="fade">
        <Pressable style={s.filterModalOverlay} onPress={() => setShowInvoiceFilterModal(false)}>
          <View style={s.filterModalSheet}>
            <Text style={s.filterModalTitle}>{t('money.filterInvoices', 'Filter invoices')}</Text>
            {(['all', 'overdue', 'sent', 'paid', 'draft'] as const).map(status => (
              <Pressable key={status} style={[s.filterModalRow, invoiceStatusFilter === status && s.filterModalRowActive]} onPress={() => { setInvoiceStatusFilter(status); setShowInvoiceFilterModal(false); }}>
                <Text style={[s.filterModalRowText, invoiceStatusFilter === status && s.filterModalRowTextActive]}>
                  {status === 'all' ? t('common.all', 'All') : status === 'overdue' ? t('money.overdue', 'Overdue') : status === 'sent' ? t('invoices.sent', 'Sent') : status === 'paid' ? t('invoices.paid', 'Paid') : t('invoices.draft', 'Draft')}
                </Text>
                {invoiceStatusFilter === status && <Ionicons name="checkmark" size={18} color={Palette.hermesOrange} />}
              </Pressable>
            ))}
            <View style={s.filterModalDivider} />
            <Text style={s.filterModalSubtitle}>{t('money.sortBy', 'Sort by')}</Text>
            {(['value-desc', 'date-desc'] as const).map(sort => (
              <Pressable key={sort} style={[s.filterModalRow, invoiceSort === sort && s.filterModalRowActive]} onPress={() => { setInvoiceSort(sort); setShowInvoiceFilterModal(false); }}>
                <Text style={[s.filterModalRowText, invoiceSort === sort && s.filterModalRowTextActive]}>
                  {sort === 'value-desc' ? t('money.byValue', 'Value') : t('money.byDate', 'Date')}
                </Text>
                {invoiceSort === sort && <Ionicons name="checkmark" size={18} color={Palette.hermesOrange} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Quote Filter Modal */}
      <Modal visible={showQuoteFilterModal} transparent animationType="fade">
        <Pressable style={s.filterModalOverlay} onPress={() => setShowQuoteFilterModal(false)}>
          <View style={s.filterModalSheet}>
            <Text style={s.filterModalTitle}>{t('money.filterQuotes', 'Filter quotes')}</Text>
            {(['all', 'sent', 'accepted', 'draft'] as const).map(status => (
              <Pressable key={status} style={[s.filterModalRow, quoteStatusFilter === status && s.filterModalRowActive]} onPress={() => { setQuoteStatusFilter(status); setShowQuoteFilterModal(false); }}>
                <Text style={[s.filterModalRowText, quoteStatusFilter === status && s.filterModalRowTextActive]}>
                  {status === 'all' ? t('common.all', 'All') : status === 'sent' ? t('quotes.sent', 'Sent') : status === 'accepted' ? t('quotes.accepted', 'Accepted') : t('quotes.draft', 'Draft')}
                </Text>
                {quoteStatusFilter === status && <Ionicons name="checkmark" size={18} color={Palette.hermesOrange} />}
              </Pressable>
            ))}
            <View style={s.filterModalDivider} />
            <Text style={s.filterModalSubtitle}>{t('money.sortBy', 'Sort by')}</Text>
            {(['value-desc', 'date-desc'] as const).map(sort => (
              <Pressable key={sort} style={[s.filterModalRow, quoteSort === sort && s.filterModalRowActive]} onPress={() => { setQuoteSort(sort); setShowQuoteFilterModal(false); }}>
                <Text style={[s.filterModalRowText, quoteSort === sort && s.filterModalRowTextActive]}>
                  {sort === 'value-desc' ? t('money.byValue', 'Value') : t('money.byDate', 'Date')}
                </Text>
                {quoteSort === sort && <Ionicons name="checkmark" size={18} color={Palette.hermesOrange} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* FAB — new quote */}
      <Pressable
        style={({ pressed }) => [s.fab, pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }]}
        onPress={() => { hapticSuccess(); router.push('/contractor/tiered-quote' as any); }}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.newQuote', 'New quote')}
      >
        <Ionicons name="add" size={28} color={Palette.white} />
      </Pressable>
    </View>
  );
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'paid': return SemanticColors.feedbackSuccess;
    case 'sent': return SemanticColors.feedbackInfo;
    case 'overdue': return SemanticColors.feedbackError;
    case 'accepted': return SemanticColors.feedbackSuccess;
    case 'draft': return SemanticColors.textTertiary;
    default: return SemanticColors.textTertiary;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SafeArea.top,
    paddingHorizontal: SafeArea.side,
    paddingBottom: GRID.sm,
    backgroundColor: PAGE_BG,
  },
  headerTitle: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.displayTracking,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, paddingBottom: 100, gap: GRID.lg },

  // KPIs — premium
  kpiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
  },
  kpiValue: {
    fontSize: 24,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: -0.5,
    marginTop: GRID.xs,
  },
  kpiAccentLine: {
    width: 24,
    height: 2,
    borderRadius: 1,
    marginTop: GRID.sm,
  },
  kpiDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: SemanticColors.borderDefault,
  },

  // Collection rate badge
  collectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm + 2,
    marginTop: GRID.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  collectionText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },

  // Sections
  section: { gap: GRID.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.sectionTracking,
  },
  sectionCount: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: GRID.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden' as const,
  },
  seeAll: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },

  // New quote button
  newQuoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  newQuoteBtnText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },

  // Filter
  filterRow: { marginBottom: GRID.sm },
  filterInput: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: GRID.xs, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, paddingHorizontal: GRID.sm, paddingVertical: GRID.sm },
  filterText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary, padding: 0 },

  // Document list
  docList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderDefault,
  },
  docDot: { width: 8, height: 8, borderRadius: 4 },
  docName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    flexShrink: 1,
  },
  docTypeBadge: {
    backgroundColor: SemanticColors.textTertiary + '15',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  docTypeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
  },
  docDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  docAmount: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  sendBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  emptyCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
  },

  // Cashflow card — dashboard quality
  cfCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  cfRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cfItem: { flex: 1, alignItems: 'center' },
  cfLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  cfValueDisplay: {
    fontSize: 20,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: -0.5,
  },
  cfDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: SemanticColors.borderDefault,
  },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
  },
  marginPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  marginPillText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
  },
  marginBar: {
    height: 6,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 3,
    overflow: 'hidden',
  },
  marginFill: {
    height: 6,
    borderRadius: 3,
  },

  // Sparkline with axes
  sparkSection: {
    paddingTop: GRID.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.borderDefault,
  },
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  sparkYAxis: {
    justifyContent: 'space-between',
    height: 48,
    alignItems: 'flex-end',
  },
  sparkAxisLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
  },
  sparkChartArea: {
    flex: 1,
  },
  sparkXAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: GRID.xs,
    paddingLeft: 50, // offset for Y-axis labels
  },
  sparklineLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },

  // Projected cashflow — prominent card
  projCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PAGE_BG,
    borderRadius: RADIUS.md,
    padding: GRID.md,
  },
  projCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    flex: 1,
  },
  projIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projCardLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    flex: 1,
  },
  projCardValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: -0.3,
  },

  // DSO row
  dsoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: GRID.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.borderDefault,
  },
  dsoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  dsoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Projection rows (kept for DSO label)
  projRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: GRID.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.borderDefault,
  },
  projLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },
  projValue: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },

  // Overdue rows — red accent
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderDefault,
    borderLeftWidth: 2,
    borderLeftColor: SemanticColors.feedbackError,
  },
  overdueMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    marginTop: 2,
  },
  overduePill: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.sm,
  },
  overduePillText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.feedbackError,
  },

  // Customer rows with bar chart
  customerRow: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderDefault,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: GRID.xs,
  },
  customerBarTrack: {
    height: 4,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: GRID.xs,
  },
  customerBarFill: {
    height: 4,
    borderRadius: 2,
  },
  customerMeta: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },

  // Risk banner
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.sm,
  },
  riskText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    flex: 1,
  },

  // Filter chips
  chipRow: {
    flexDirection: 'row',
    gap: GRID.sm,
    paddingBottom: GRID.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.full,
    paddingHorizontal: GRID.md - 4,
    paddingVertical: GRID.sm - 2,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  filterChipActive: {
    backgroundColor: Palette.hermesOrange,
    borderColor: Palette.hermesOrange,
  },
  filterChipText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  filterChipTextActive: {
    color: Palette.white,
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: SemanticColors.borderDefault,
  },

  // Inline remind button for overdue
  inlineRemindBtn: {
    marginLeft: GRID.sm,
  },
  inlineRemindText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  overdueTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  overdueTotalLabel: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  overdueTotalAmount: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.feedbackError,
    letterSpacing: TYPE.sectionTracking,
  },

  // Filter modal
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModalSheet: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.lg,
    width: '80%',
    maxWidth: 320,
  },
  filterModalTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    marginBottom: GRID.md,
  },
  filterModalSubtitle: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: GRID.sm,
  },
  filterModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: GRID.sm + 2,
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.sm,
  },
  filterModalRowActive: {
    backgroundColor: Palette.hermesOrange + '0A',
  },
  filterModalRowText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  filterModalRowTextActive: {
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  filterModalDivider: {
    height: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginVertical: GRID.sm,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: SafeArea.side,
    bottom: 110,
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
