// =============================================================================
// FINANCIAL REPORTS — P&L, trends, CSV/PDF export
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { formatCurrency } from '../../src/i18n/formatting';
import {
  generateMonthlyReport,
  generateQuarterlyReport,
  exportToCSV,
  exportToPDFHtml,
  type FinancialReport,
} from '../../src/services/financialReportService';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { hapticSuccess } from '../../src/utils/haptics';

type PeriodMode = 'monthly' | 'quarterly';

// Locale-derived: hardcoded English abbreviations rendered "Mar"/"May"/"Oct"
// on a Dutch screen where the correct forms are "mrt"/"mei"/"okt".
function monthLabels(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(locale, { month: 'short' }),
  );
}

export default function ReportsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { invoices, quotes } = useAppState();
  const { user } = useAuth();
  const MONTH_LABELS = useMemo(() => monthLabels(i18n.language), [i18n.language]);

  const now = new Date();
  const [mode, setMode] = useState<PeriodMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [selectedYear] = useState(now.getFullYear());

  const report: FinancialReport = useMemo(() => {
    if (mode === 'monthly') {
      return generateMonthlyReport(selectedMonth, selectedYear, invoices, quotes);
    }
    return generateQuarterlyReport(selectedQuarter, selectedYear, invoices, quotes);
  }, [mode, selectedMonth, selectedQuarter, selectedYear, invoices, quotes]);

  // Thread the user's country — formatCurrency defaults to 'NL', which
  // silently mis-formats every DE/FR/ES/IT contractor's report.
  const country = (user?.country ?? 'NL') as any;
  const fmt = useCallback((amount: number) => formatCurrency(amount, country), [country]);

  const handleShareCSV = useCallback(async () => {
    const csv = exportToCSV(report);
    hapticSuccess();
    await Share.share({ message: csv, title: report.title });
  }, [report]);

  const handleSharePDF = useCallback(async () => {
    // Was the literal 'My Business' — this is a financial document the
    // contractor forwards to their accountant.
    const businessName = user?.company || user?.name || '';
    const html = exportToPDFHtml(report, businessName, fmt);
    hapticSuccess();
    await Share.share({ message: html, title: `${report.title}.pdf` });
  }, [report, fmt, user]);

  const changeIndicator = (value: number) => {
    if (value === 0) return null;
    const isPositive = value > 0;
    return (
      <View style={[s.changePill, { backgroundColor: isPositive ? SemanticColors.feedbackSuccessBg : SemanticColors.feedbackErrorBg }]}>
        <Ionicons
          name={isPositive ? 'trending-up' : 'trending-down'}
          size={12}
          color={isPositive ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError}
        />
        <Text style={[s.changeText, { color: isPositive ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
          {isPositive ? '+' : ''}{value}%
        </Text>
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('reports.title', 'Reports')}</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Period mode toggle */}
        <View style={s.modeRow}>
          <Pressable
            style={[s.modeBtn, mode === 'monthly' && s.modeBtnActive]}
            onPress={() => setMode('monthly')}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'monthly' }}
          >
            <Text style={[s.modeBtnText, mode === 'monthly' && s.modeBtnTextActive]}>
              {t('reports.monthly', 'Monthly')}
            </Text>
          </Pressable>
          <Pressable
            style={[s.modeBtn, mode === 'quarterly' && s.modeBtnActive]}
            onPress={() => setMode('quarterly')}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'quarterly' }}
          >
            <Text style={[s.modeBtnText, mode === 'quarterly' && s.modeBtnTextActive]}>
              {t('reports.quarterly', 'Quarterly')}
            </Text>
          </Pressable>
        </View>

        {/* Period selector */}
        {mode === 'monthly' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.periodScroll}>
            {MONTH_LABELS.map((label, i) => (
              <Pressable
                key={label}
                style={[s.periodChip, selectedMonth === i + 1 && s.periodChipActive]}
                onPress={() => setSelectedMonth(i + 1)}
              >
                <Text style={[s.periodChipText, selectedMonth === i + 1 && s.periodChipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={s.quarterRow}>
            {[1, 2, 3, 4].map(q => (
              <Pressable
                key={q}
                style={[s.periodChip, s.quarterChip, selectedQuarter === q && s.periodChipActive]}
                onPress={() => setSelectedQuarter(q)}
              >
                <Text style={[s.periodChipText, selectedQuarter === q && s.periodChipTextActive]}>
                  Q{q}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <FadeIn key={`${mode}-${selectedMonth}-${selectedQuarter}`} delay={0} duration={300}>
          {/* P&L Card */}
          <View style={s.plCard}>
            <Text style={s.plCardTitle}>{t('reports.profitLoss', 'Profit & Loss')}</Text>
            <Text style={s.plPeriod}>{report.period}</Text>

            {report.lineItems.map((item, i) => (
              <View
                key={item.label}
                style={[
                  s.plRow,
                  item.isTotal && s.plRowTotal,
                  item.isSubtotal && s.plRowSubtotal,
                  i < report.lineItems.length - 1 && s.plRowBorder,
                ]}
              >
                <Text
                  style={[
                    s.plLabel,
                    item.isTotal && s.plLabelTotal,
                    item.isSubtotal && s.plLabelSubtotal,
                    item.indent ? { paddingLeft: GRID.lg } : undefined,
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    s.plAmount,
                    item.isTotal && s.plAmountTotal,
                    item.isSubtotal && s.plAmountSubtotal,
                    item.amount < 0 && s.plAmountNeg,
                  ]}
                >
                  {item.amount < 0 ? `(${fmt(Math.abs(item.amount))})` : fmt(item.amount)}
                </Text>
              </View>
            ))}
          </View>

          {/* KPI summary */}
          <View style={s.kpiRow}>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>{t('reports.revenue', 'Revenue')}</Text>
              <Text style={s.kpiValue}>{fmt(report.revenue)}</Text>
              {changeIndicator(report.revenueChange)}
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>{t('reports.netIncome', 'Net Income')}</Text>
              <Text style={s.kpiValue}>{fmt(report.netIncome)}</Text>
              {changeIndicator(report.netIncomeChange)}
            </View>
          </View>

          <View style={s.kpiRow}>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>{t('reports.margin', 'Margin')}</Text>
              <Text style={s.kpiValue}>{report.profitMargin}%</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>{t('reports.overdue', 'Overdue')}</Text>
              <Text style={[s.kpiValue, report.overdueAmount > 0 && { color: SemanticColors.feedbackError }]}>
                {fmt(report.overdueAmount)}
              </Text>
            </View>
          </View>

          {/* Trend comparison */}
          {report.previousRevenue > 0 && (
            <View style={s.trendCard}>
              <View style={s.trendHeader}>
                <Ionicons name="analytics" size={18} color={Palette.hermesOrange} />
                <Text style={s.trendTitle}>{t('reports.vsPrevious', 'vs Previous Period')}</Text>
              </View>
              <View style={s.trendRow}>
                <Text style={s.trendLabel}>{t('reports.prevRevenue', 'Previous revenue')}</Text>
                <Text style={s.trendValue}>{fmt(report.previousRevenue)}</Text>
              </View>
              <View style={s.trendRow}>
                <Text style={s.trendLabel}>{t('reports.prevNetIncome', 'Previous net income')}</Text>
                <Text style={s.trendValue}>{fmt(report.previousNetIncome)}</Text>
              </View>
            </View>
          )}

          {/* Export buttons */}
          <View style={s.exportSection}>
            <Text style={s.exportTitle}>{t('reports.export', 'Export')}</Text>
            <View style={s.exportRow}>
              <Pressable
                style={({ pressed }) => [s.exportBtn, pressed && { opacity: 0.85 }]}
                onPress={handleSharePDF}
                accessibilityRole="button"
                accessibilityLabel={t('reports.sharePDF', 'Share PDF')}
              >
                <Ionicons name="document" size={18} color={Palette.hermesOrange} />
                <Text style={s.exportBtnText}>{t('reports.sharePDF', 'Share PDF')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.exportBtn, pressed && { opacity: 0.85 }]}
                onPress={handleShareCSV}
                accessibilityRole="button"
                accessibilityLabel={t('reports.shareCSV', 'Share CSV')}
              >
                <Ionicons name="grid" size={18} color={Palette.hermesOrange} />
                <Text style={s.exportBtnText}>{t('reports.shareCSV', 'Share CSV')}</Text>
              </Pressable>
            </View>
          </View>
        </FadeIn>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: GRID.xs,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily,  color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.md },

  // Mode toggle
  modeRow: { flexDirection: 'row', gap: GRID.sm },
  modeBtn: {
    flex: 1, paddingVertical: GRID.sm, borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: Palette.hermesOrange },
  modeBtnText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textTertiary },
  modeBtnTextActive: { color: '#fff' },

  // Period selector
  periodScroll: { gap: GRID.sm, paddingVertical: GRID.xs },
  periodChip: {
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm, borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  periodChipActive: { backgroundColor: Palette.hermesOrange },
  periodChipText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textTertiary },
  periodChipTextActive: { color: '#fff' },
  quarterRow: { flexDirection: 'row', gap: GRID.sm },
  quarterChip: { flex: 1, alignItems: 'center' },

  // P&L card
  plCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    padding: GRID.md, gap: GRID.xs,
  },
  plCardTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  plPeriod: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, marginBottom: GRID.sm },
  plRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: GRID.sm },
  plRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SemanticColors.borderDefault },
  plRowTotal: { borderTopWidth: 2, borderTopColor: SemanticColors.textPrimary, paddingTop: GRID.sm },
  plRowSubtotal: {},
  plLabel: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  plLabelTotal: { fontFamily: TYPE.sectionFamily },
  plLabelSubtotal: { fontFamily: TYPE.titleFamily },
  plAmount: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  plAmountTotal: { fontFamily: TYPE.sectionFamily, fontSize: TYPE.sectionSize },
  plAmountSubtotal: { fontFamily: TYPE.titleFamily },
  plAmountNeg: { color: SemanticColors.feedbackError },

  // KPI
  kpiRow: { flexDirection: 'row', gap: GRID.sm },
  kpiCard: {
    flex: 1, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    padding: GRID.md, gap: GRID.xs,
  },
  kpiLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },
  kpiValue: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },

  // Change indicator
  changePill: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    paddingHorizontal: GRID.sm, paddingVertical: 2, borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  changeText: { fontSize: TYPE.tinySize, fontFamily: TYPE.titleFamily },

  // Trend
  trendCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    padding: GRID.md, gap: GRID.sm,
  },
  trendHeader: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm },
  trendTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  trendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trendLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  trendValue: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },

  // Export
  exportSection: { gap: GRID.sm },
  exportTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  exportRow: { flexDirection: 'row', gap: GRID.sm },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    paddingVertical: GRID.md,
  },
  exportBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },
});
