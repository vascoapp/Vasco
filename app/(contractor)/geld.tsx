// =============================================================================
// GELD — Money tab. Clean answer to: "Where's my money?"
// =============================================================================
// KPIs → VascoCard (financial AI) → Facturen+Offertes → Cashflow
// No dashboards, no bleed between sections. Vasco is the financial brain.
// =============================================================================

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Share, Platform, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { SafeArea } from '../../src/theme/spacing';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { useAppState } from '../../src/state/AppState';
import { useCashFlow } from '../../src/services/cashFlowService';
import { useFinancialAnalysis } from '../../src/services/financialAnalysisService';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { Sparkline } from '../../src/components/shared/Sparkline';
import { VascoCard } from '../../src/components/shared/VascoCard';
import { SkeletonList } from '../../src/components/shared/SkeletonList';
import { useAIQueue } from '../../src/services/aiActionQueueService';
import { useVascoGuidance } from '../../src/services/vascoGuidanceService';

export default function GeldScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState('');
  const [quoteFilter, setQuoteFilter] = useState('');
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
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
            <Pressable style={s.kpiItem} onPress={() => router.push('/(contractor)/facturen' as any)} accessibilityRole="button" accessibilityLabel={`${t('money.received', 'Ontvangen')}: \u20AC${paidTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}>
              <Text style={s.kpiLabel}>{t('money.revenue', 'Omzet')}</Text>
              <Text style={[s.kpiValue, { color: SemanticColors.feedbackSuccess }]}>{'\u20AC'}{paidTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </Pressable>
            <View style={s.kpiDivider} />
            <Pressable style={s.kpiItem} onPress={() => router.push('/(contractor)/facturen' as any)} accessibilityRole="button" accessibilityLabel={`${t('money.outstanding', 'Uitstaand')}: \u20AC${outstandingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}>
              <Text style={s.kpiLabel}>{t('money.outstanding', 'Uitstaand')}</Text>
              <Text style={s.kpiValue}>{'\u20AC'}{outstandingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </Pressable>
            <View style={s.kpiDivider} />
            <Pressable style={s.kpiItem} accessibilityRole="button" accessibilityLabel={`${t('money.pipeline', 'Pipeline')}: \u20AC${fin.quotePipeline.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}>
              <Text style={s.kpiLabel}>{t('money.pipeline', 'Pipeline')}</Text>
              <Text style={s.kpiValue}>{'\u20AC'}{fin.quotePipeline.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </Pressable>
            <View style={s.kpiDivider} />
            <Pressable style={s.kpiItem} accessibilityRole="button" accessibilityLabel={`${t('money.winRate', 'Win rate')}: ${fin.quoteWinRate}%`}>
              <Text style={s.kpiLabel}>{t('money.winRate', 'Win rate')}</Text>
              <Text style={[s.kpiValue, fin.quoteWinRate < 50 && fin.quoteWinRate > 0 && { color: SemanticColors.feedbackWarning }]}>{fin.quoteWinRate > 0 ? `${fin.quoteWinRate}%` : '—'}</Text>
            </Pressable>
          </View>
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
              <Text style={s.sectionCount}>{invoices.length}</Text>
            </View>
            <View style={s.filterRow}>
              <View style={s.filterInput}>
                <Ionicons name="search" size={14} color={SemanticColors.textTertiary} />
                <TextInput
                  style={s.filterText}
                  placeholder={t('money.filterByName', 'Search...')}
                  placeholderTextColor={SemanticColors.textTertiary}
                  value={invoiceFilter}
                  onChangeText={setInvoiceFilter}
                />
              </View>
            </View>
            {invoices.length > 0 ? (
              <View style={s.docList}>
                {documents.filter(d => d.type === 'factuur' && (!invoiceFilter || d.name.toLowerCase().includes(invoiceFilter.toLowerCase()))).map((doc) => (
                  <Pressable
                    key={doc.id}
                    style={({ pressed }) => [s.docRow, pressed && { opacity: 0.9 }]}
                    onPress={() => router.push(doc.route as any)}
                    onLongPress={() => handleDeleteDocument(doc.id, doc.type, doc.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('invoices.invoice', 'Factuur')}: ${doc.name}, \u20AC${doc.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}, ${doc.status}`}
                    accessibilityHint={t('a11y.opensDetails', 'Opens details')}
                  >
                    <View style={[s.docDot, { backgroundColor: getStatusColor(doc.status) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.docName} numberOfLines={1} ellipsizeMode="tail">{doc.name}</Text>
                      <Text style={s.docDesc} numberOfLines={1} ellipsizeMode="tail">{doc.description} · {doc.status}</Text>
                    </View>
                    <Text style={s.docAmount}>{'\u20AC'}{doc.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
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
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>{t('money.noInvoices', 'No invoices yet')}</Text>
              </View>
            )}
          </View>
        </FadeIn>

        {/* Offertes — separate section */}
        <FadeIn delay={100}>
          <View style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.sectionTitle}>{t('quotes.quotes', 'Offertes')}</Text>
              <Text style={s.sectionCount}>{quotes.length}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [s.newQuoteBtn, pressed && { opacity: 0.9 }]}
              onPress={() => router.push('/contractor/tiered-quote' as any)}
              accessibilityRole="button"
              accessibilityLabel={t('quotes.newQuote', 'Nieuwe offerte')}
            >
              <Ionicons name="add-circle-outline" size={18} color={Palette.white} />
              <Text style={s.newQuoteBtnText}>{t('quotes.newQuote', 'Nieuwe offerte')}</Text>
            </Pressable>

            <View style={s.filterRow}>
              <View style={s.filterInput}>
                <Ionicons name="search" size={14} color={SemanticColors.textTertiary} />
                <TextInput
                  style={s.filterText}
                  placeholder={t('money.filterByName', 'Search...')}
                  placeholderTextColor={SemanticColors.textTertiary}
                  value={quoteFilter}
                  onChangeText={setQuoteFilter}
                />
              </View>
            </View>

            {quotes.length > 0 ? (
              <View style={s.docList}>
                {documents.filter(d => d.type === 'offerte' && (!quoteFilter || d.name.toLowerCase().includes(quoteFilter.toLowerCase()))).map((doc) => (
                  <Pressable
                    key={doc.id}
                    style={({ pressed }) => [s.docRow, pressed && { opacity: 0.9 }]}
                    onPress={() => router.push(doc.route as any)}
                    onLongPress={() => handleDeleteDocument(doc.id, doc.type, doc.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('quotes.quote', 'Offerte')}: ${doc.name}, \u20AC${doc.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}, ${doc.status}`}
                    accessibilityHint={t('a11y.opensDetails', 'Opens details')}
                  >
                    <View style={[s.docDot, { backgroundColor: getStatusColor(doc.status) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.docName} numberOfLines={1} ellipsizeMode="tail">{doc.name}</Text>
                      <Text style={s.docDesc} numberOfLines={1} ellipsizeMode="tail">{doc.description} · {doc.status}</Text>
                    </View>
                    <Text style={s.docAmount}>{'\u20AC'}{doc.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>{t('money.noQuotes', 'No quotes yet')}</Text>
              </View>
            )}
          </View>
        </FadeIn>

        {/* Cashflow — real analysis */}
        <FadeIn delay={120}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('money.cashflow', 'Cashflow')}</Text>
            <View style={s.cfCard}>
              <View style={s.cfRow}>
                <View style={s.cfItem}>
                  <Text style={[s.cfValue, { color: SemanticColors.feedbackSuccess }]}>
                    {'\u20AC'}{paidTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={s.cfLabel}>{t('money.revenue', 'Omzet')}</Text>
                </View>
                <View style={s.cfDivider} />
                <View style={s.cfItem}>
                  <Text style={s.cfValue}>
                    {'\u20AC'}{fin.totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={s.cfLabel}>{t('money.costs', 'Kosten')}</Text>
                </View>
                <View style={s.cfDivider} />
                <View style={s.cfItem}>
                  <Text style={[s.cfValue, { color: fin.netIncome >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
                    {'\u20AC'}{fin.netIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={s.cfLabel}>{t('money.profit', 'Winst')}</Text>
                </View>
              </View>
              <View style={s.marginBar}>
                <View style={[s.marginFill, { width: `${Math.min(Math.max(fin.profitMargin, 0), 100)}%` }]} />
              </View>
              {sparkData.length >= 2 && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Sparkline data={sparkData} width={120} height={28} color={SemanticColors.feedbackSuccess} />
                </View>
              )}
              {/* Projected next month */}
              <View style={s.projRow}>
                <Text style={s.projLabel}>{t('money.projected', 'Prognose volgende maand')}</Text>
                <Text style={[s.projValue, { color: fin.projectedCashflow >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
                  {'\u20AC'}{fin.projectedCashflow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </Text>
              </View>
              {/* DSO */}
              {fin.avgDaysToPayment > 0 && (
                <View style={s.projRow}>
                  <Text style={s.projLabel}>{t('money.dso', 'Gem. betaaltermijn')}</Text>
                  <Text style={[s.projValue, fin.avgDaysToPayment > 30 && { color: SemanticColors.feedbackWarning }]}>
                    {fin.avgDaysToPayment} {t('common.days', 'dagen')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </FadeIn>

        {/* Overdue invoices detail */}
        {fin.overdueDetails.length > 0 && (
          <FadeIn delay={140}>
            <View style={s.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={s.sectionTitle}>{t('money.overdue', 'Achterstallig')}</Text>
                <Text style={[s.sectionCount, { color: SemanticColors.feedbackError }]}>{'\u20AC'}{fin.overdueAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              </View>
              <View style={s.docList}>
                {fin.overdueDetails.map((od) => (
                  <Pressable
                    key={od.invoiceId}
                    style={({ pressed }) => [s.docRow, pressed && { opacity: 0.9 }]}
                    onPress={() => router.push(`/invoices/${od.invoiceId}` as any)}
                    accessibilityRole="button"
                  >
                    <View style={[s.docDot, { backgroundColor: SemanticColors.feedbackError }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.docName} numberOfLines={1}>{od.customer}</Text>
                      <Text style={s.docDesc}>{od.daysOverdue} {t('common.daysOverdue', 'dagen achterstallig')}</Text>
                    </View>
                    <Text style={[s.docAmount, { color: SemanticColors.feedbackError }]}>{'\u20AC'}{od.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </FadeIn>
        )}

        {/* Top customers by revenue */}
        {fin.topCustomers.length > 0 && (
          <FadeIn delay={160}>
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('money.topCustomers', 'Top klanten')}</Text>
              <View style={s.docList}>
                {fin.topCustomers.map((cust) => (
                  <View key={cust.customer} style={s.docRow}>
                    <View style={[s.docDot, { backgroundColor: cust.percentage > 50 ? SemanticColors.feedbackWarning : SemanticColors.feedbackSuccess }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.docName} numberOfLines={1}>{cust.customer}</Text>
                      <Text style={s.docDesc}>{cust.invoiceCount} {t('invoices.invoices', 'facturen')} · {cust.percentage}%</Text>
                    </View>
                    <Text style={s.docAmount}>{'\u20AC'}{cust.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                  </View>
                ))}
              </View>
              {fin.concentrationRisk && (
                <View style={s.riskBanner}>
                  <Ionicons name="warning" size={14} color={SemanticColors.feedbackWarning} />
                  <Text style={s.riskText}>{t('money.concentrationRisk', 'High concentration: diversify your client base')}</Text>
                </View>
              )}
            </View>
          </FadeIn>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

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
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.lg },

  // KPIs
  kpiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
  },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  kpiValue: {
    fontSize: 24,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: -0.5,
    marginTop: GRID.xs,
  },
  kpiDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: SemanticColors.borderDefault,
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

  // Cashflow card
  cfCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.md - 2,
  },
  cfRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cfItem: { flex: 1, alignItems: 'center' },
  cfLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  cfValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: -0.3,
  },
  cfDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: SemanticColors.borderDefault,
  },
  marginBar: {
    height: 6,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 3,
    overflow: 'hidden',
  },
  marginFill: {
    height: 6,
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 3,
  },

  // Projection rows
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

  // Risk banner
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    backgroundColor: SemanticColors.feedbackWarning + '15',
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
