// =============================================================================
// PROFIT & LOSS — Winst & Verlies overzicht
// =============================================================================
// Simple P&L view built from existing invoice, cost, and expense data
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAutoInvoices } from '../../src/services/invoiceAutomationService';
import { usePurchaseOrders } from '../../src/services/purchaseOrderService';

type IconName = keyof typeof Ionicons.glyphMap;
type PeriodType = 'maand' | 'kwartaal' | 'jaar';

interface PLLine {
  label: string;
  amount: number;
  icon: IconName;
  type: 'income' | 'expense' | 'total';
  detail?: string;
}

export default function ProfitLossScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<PeriodType>('maand');
  const { invoices } = useAutoInvoices();
  const { orders } = usePurchaseOrders();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }, []);

  const data = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'maand':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'kwartaal':
        const q = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), q, 1);
        break;
      case 'jaar':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    // Income: paid invoices
    const paidInvoices = invoices.filter(
      i => i.status === 'paid' && i.paidDate && i.paidDate >= startDate,
    );
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
    const totalVATCollected = paidInvoices.reduce((sum, i) => sum + i.vatAmount, 0);
    const netRevenue = totalRevenue - totalVATCollected;

    // Expenses: delivered purchase orders
    const deliveredPOs = orders.filter(
      o => o.status === 'delivered' && o.actualDelivery && o.actualDelivery >= startDate,
    );
    const materialCosts = deliveredPOs.reduce((sum, o) => sum + o.subtotal, 0);
    const materialVAT = deliveredPOs.reduce((sum, o) => sum + o.vatAmount, 0);

    // Estimated labor (from invoice count × avg hours)
    const estimatedLaborHours = paidInvoices.length * 6; // ~6h per job average
    const laborRate = 55;
    const laborCosts = estimatedLaborHours * laborRate;

    // Fixed costs estimates
    const vehicleCosts = period === 'maand' ? 450 : period === 'kwartaal' ? 1350 : 5400;
    const insuranceCosts = period === 'maand' ? 180 : period === 'kwartaal' ? 540 : 2160;
    const toolsCosts = period === 'maand' ? 120 : period === 'kwartaal' ? 360 : 1440;
    const officeCosts = period === 'maand' ? 85 : period === 'kwartaal' ? 255 : 1020;

    const totalExpenses = materialCosts + laborCosts + vehicleCosts + insuranceCosts + toolsCosts + officeCosts;
    const grossProfit = netRevenue - materialCosts;
    const netProfit = netRevenue - totalExpenses;
    const margin = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 100) : 0;

    const incomeLines: PLLine[] = [
      { label: t('financials.revenueExVat', 'Omzet (excl. BTW)'), amount: netRevenue, icon: 'cash-outline', type: 'income', detail: `${paidInvoices.length} ${t('financials.invoices', 'facturen')}` },
      { label: t('financials.vatReceived', 'BTW ontvangen'), amount: totalVATCollected, icon: 'swap-horizontal-outline', type: 'income', detail: t('financials.toBePaid', 'Af te dragen') },
    ];

    const expenseLines: PLLine[] = [
      { label: t('financials.materialCosts', 'Materiaalkosten'), amount: materialCosts, icon: 'cube-outline', type: 'expense', detail: `${deliveredPOs.length} ${t('financials.orders', 'bestellingen')}` },
      { label: t('financials.laborCosts', 'Arbeidskosten'), amount: laborCosts, icon: 'people-outline', type: 'expense', detail: `${estimatedLaborHours}u × €${laborRate}` },
      { label: t('financials.vehicleCosts', 'Voertuigkosten'), amount: vehicleCosts, icon: 'car-outline', type: 'expense' },
      { label: t('financials.insurance', 'Verzekeringen'), amount: insuranceCosts, icon: 'shield-outline', type: 'expense' },
      { label: t('financials.tools', 'Gereedschap'), amount: toolsCosts, icon: 'construct-outline', type: 'expense' },
      { label: t('financials.officeCosts', 'Kantoorkosten'), amount: officeCosts, icon: 'desktop-outline', type: 'expense' },
    ];

    return {
      incomeLines,
      expenseLines,
      netRevenue,
      totalExpenses,
      grossProfit,
      netProfit,
      margin,
      totalVATCollected,
      materialVAT,
    };
  }, [invoices, orders, period]);

  const fmt = (n: number) => `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const periodLabel = period === 'maand' ? t('financials.thisMonth', 'Deze maand') : period === 'kwartaal' ? t('financials.thisQuarter', 'Dit kwartaal') : t('financials.thisYear', 'Dit jaar');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('financials.profitAndLoss', 'Winst & Verlies')}</Text>
          <Text style={styles.headerSubtitle}>{periodLabel}</Text>
        </View>
      </View>

      {/* Period Tabs */}
      <View style={styles.tabBar}>
        {(['maand', 'kwartaal', 'jaar'] as PeriodType[]).map(p => (
          <Pressable
            key={p}
            style={[styles.tab, period === p && styles.tabActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
              {p === 'maand' ? t('financials.month', 'Maand') : p === 'kwartaal' ? t('financials.quarter', 'Kwartaal') : t('financials.year', 'Jaar')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('financials.revenue', 'Omzet')}</Text>
            <Text style={[styles.summaryValue, { color: SemanticColors.feedbackSuccess }]}>{fmt(data.netRevenue)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('financials.costs', 'Kosten')}</Text>
            <Text style={[styles.summaryValue, { color: SemanticColors.feedbackError }]}>{fmt(data.totalExpenses)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('financials.netProfit', 'Netto winst')}</Text>
            <Text style={[styles.summaryValue, { color: data.netProfit >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
              {fmt(data.netProfit)}
            </Text>
          </View>
        </View>
        {/* Margin bar */}
        <View style={styles.marginBar}>
          <View style={[styles.marginFill, { width: `${Math.max(Math.min(data.margin, 100), 0)}%` }]} />
        </View>
        <Text style={styles.marginText}>{t('financials.netMargin', 'Nettomarge')}: {data.margin}%</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}>
        {/* Income Section */}
        <Text style={styles.sectionTitle}>{t('financials.income', 'Inkomsten')}</Text>
        {data.incomeLines.map((line, idx) => (
          <View key={idx} style={styles.plRow}>
            <Ionicons name={line.icon} size={18} color={SemanticColors.feedbackSuccess} />
            <View style={styles.plInfo}>
              <Text style={styles.plLabel}>{line.label}</Text>
              {line.detail && <Text style={styles.plDetail}>{line.detail}</Text>}
            </View>
            <Text style={[styles.plAmount, { color: SemanticColors.feedbackSuccess }]}>{fmt(line.amount)}</Text>
          </View>
        ))}

        {/* Expenses Section */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>{t('financials.costs', 'Kosten')}</Text>
        {data.expenseLines.map((line, idx) => (
          <View key={idx} style={styles.plRow}>
            <Ionicons name={line.icon} size={18} color={SemanticColors.feedbackError} />
            <View style={styles.plInfo}>
              <Text style={styles.plLabel}>{line.label}</Text>
              {line.detail && <Text style={styles.plDetail}>{line.detail}</Text>}
            </View>
            <Text style={[styles.plAmount, { color: SemanticColors.feedbackError }]}>-{fmt(line.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('financials.grossProfit', 'Brutowinst')}</Text>
            <Text style={styles.totalValue}>{fmt(data.grossProfit)}</Text>
          </View>
          <View style={[styles.totalRow, styles.netRow]}>
            <Text style={styles.netLabel}>{t('financials.netProfitLabel', 'Nettowinst')}</Text>
            <Text style={[styles.netValue, { color: data.netProfit >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
              {fmt(data.netProfit)}
            </Text>
          </View>
        </View>

        {/* VAT Summary */}
        <View style={styles.vatCard}>
          <Text style={styles.vatTitle}>{t('financials.vatOverview', 'BTW Overzicht')}</Text>
          <View style={styles.vatRow}>
            <Text style={styles.vatLabel}>{t('financials.vatReceived', 'BTW ontvangen')}</Text>
            <Text style={styles.vatValue}>{fmt(data.totalVATCollected)}</Text>
          </View>
          <View style={styles.vatRow}>
            <Text style={styles.vatLabel}>{t('financials.vatPaidPurchase', 'BTW betaald (inkoop)')}</Text>
            <Text style={styles.vatValue}>-{fmt(data.materialVAT)}</Text>
          </View>
          <View style={[styles.vatRow, { borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault, paddingTop: 6, marginTop: 4 }]}>
            <Text style={[styles.vatLabel, { fontFamily: 'Manrope_700Bold' }]}>{t('financials.vatDue', 'BTW af te dragen')}</Text>
            <Text style={[styles.vatValue, { fontFamily: 'Manrope_700Bold' }]}>{fmt(data.totalVATCollected - data.materialVAT)}</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 30, fontFamily: 'Manrope_800ExtraBold', color: SemanticColors.textPrimary, letterSpacing: -1.0 },
  headerSubtitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary, marginTop: 2 },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: Spacing.md },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center' },
  tabActive: { backgroundColor: Palette.hermesOrange },
  tabText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textTertiary },
  tabTextActive: { color: '#fff' },
  summaryCard: {
    marginHorizontal: SafeArea.side, backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md,
  },
  summaryRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textSecondary, letterSpacing: 0.3 },
  summaryValue: { fontSize: 26, fontFamily: 'Manrope_800ExtraBold', marginTop: 4 },
  summaryDivider: { width: 1, backgroundColor: SemanticColors.borderDefault, marginHorizontal: Spacing.xs },
  marginBar: { height: 6, backgroundColor: SemanticColors.borderDefault, borderRadius: 3, overflow: 'hidden' },
  marginFill: { height: '100%', backgroundColor: SemanticColors.feedbackSuccess, borderRadius: 3 },
  marginText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary, textAlign: 'center', marginTop: 6 },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  sectionTitle: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', color: SemanticColors.textPrimary, letterSpacing: -0.5, marginBottom: Spacing.xs },
  plRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: Spacing.sm, marginBottom: 4,
  },
  plInfo: { flex: 1 },
  plLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary },
  plDetail: { fontSize: 14, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary, marginTop: 1 },
  plAmount: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  totalSection: { marginTop: Spacing.md, gap: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary },
  totalValue: { fontSize: 15, fontFamily: 'Inter_700Bold', color: SemanticColors.textPrimary },
  netRow: { borderTopWidth: 2, borderTopColor: SemanticColors.textPrimary, paddingTop: 8, marginTop: 4 },
  netLabel: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  netValue: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold' },
  vatCard: {
    marginTop: Spacing.lg, backgroundColor: Palette.hermesOrange + '08',
    borderRadius: 16, padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: Palette.hermesOrange,
  },
  vatTitle: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', color: SemanticColors.textPrimary, letterSpacing: -0.5, marginBottom: Spacing.xs },
  vatRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  vatLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary },
  vatValue: { fontSize: 15, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary },
});
