// =============================================================================
// VAT REPORT — what the contractor hands their accountant (2026-10-03)
// =============================================================================
// User's decision: Vasco does not do tax returns. This screen shows a simple,
// correct VAT report for a period — sales and VAT per rate, VAT on purchases,
// the balance, the documents behind every figure, and what is NOT included —
// exported as a PDF or a spreadsheet for the accountant, or typed into the tax
// portal by the contractor. Every market, the same report.
//
// It replaces the "BTW-aangifte voorbereiding" (NL/DE only), which GUESSED
// each invoice's rate from words in the job title and worked the VAT back
// from the gross amount — so a mixed-rate invoice landed in one box at one
// rate and the return could disagree with the invoices the customers had.
// The figures here are the invoices' own (src/services/vatReport.ts).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { useExpenses } from '../../src/services/expenseService';
import { buildVatReport, reportPeriod, type VatReportRow } from '../../src/services/vatReport';
import { rowLabel, shareVatReportCsv, shareVatReportPdf } from '../../src/services/vatReportExport';
import { formatCurrency, type Country } from '../../src/i18n/formatting';
import { getStandardVatRate } from '../../src/domain/business';
import { friendlyError } from '../../src/utils/friendlyError';
import { DKMenu } from '../../src/components/shared/DKMenu';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { DK } from '../../src/theme/draftkings';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';

type PeriodKey = 'previous' | 'current' | 'lastYear';

export default function VatReportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { invoices, lineItems, customers, businessProfile } = useAppState();
  const { expenses } = useExpenses();
  const { user } = useAuth();
  // Profile first, account second (#218) — and never a guessed one: an unknown
  // country is asked for below (the money format and the fallback rate follow it).
  const knownCountry = (businessProfile?.country ?? user?.country) as Country | undefined;
  const country = (knownCountry ?? 'NL') as Country;
  // The quarter-end card passes period=current|previous (queueItemExecutor).
  const { period: periodParam } = useLocalSearchParams<{ period?: string }>();
  const [periodKey, setPeriodKey] = useState<PeriodKey>(periodParam === 'current' ? 'current' : 'previous');
  // A second push from the quarter card to a mounted screen carries a new period.
  useEffect(() => {
    if (periodParam === 'current' || periodParam === 'previous') setPeriodKey(periodParam);
  }, [periodParam]);
  const [busy, setBusy] = useState(false);

  // The contractor's own cadence (profile `filingPeriod`), quarterly by default.
  const cadence: 'month' | 'quarter' | 'year' =
    businessProfile?.filingPeriod === 'monthly' ? 'month' : businessProfile?.filingPeriod === 'yearly' ? 'year' : 'quarter';
  const periodLabel = (k: PeriodKey): string => {
    if (k === 'lastYear') return t('vatReport.periodPrevY', 'Last year');
    if (cadence === 'month') return k === 'current' ? t('vatReport.periodCurM', 'This month') : t('vatReport.periodPrevM', 'Last month');
    if (cadence === 'year') return k === 'current' ? t('vatReport.periodCurY', 'This year') : t('vatReport.periodPrevY', 'Last year');
    return k === 'current' ? t('vatReport.periodCurQ', 'This quarter') : t('vatReport.periodPrevQ', 'Last quarter');
  };
  const periodKeys: PeriodKey[] = cadence === 'year' ? ['previous', 'current'] : ['previous', 'current', 'lastYear'];
  const bounds = periodKey === 'lastYear' ? reportPeriod('year', 'previous') : reportPeriod(cadence, periodKey);

  const report = useMemo(() => buildVatReport({
    periodStart: bounds.start,
    periodEnd: bounds.end,
    vatBasis: businessProfile?.vatBasis,
    vatScheme: businessProfile?.vatScheme,
    standardRatePct: getStandardVatRate(country as any),
    invoices: invoices as any,
    lineItems: lineItems as any,
    customers: customers as any,
    country,
    expenses: expenses.map((e) => ({ id: e.id, description: e.description, supplier: e.supplier, amount: e.amount, vatAmount: e.vatAmount, vatRate: e.vatRate, date: e.date })),
  }), [bounds.start, bounds.end, businessProfile?.vatBasis, businessProfile?.vatScheme, country, invoices, lineItems, customers, expenses]);

  const money = (n: number) => formatCurrency(n, country);
  const tt = (k: string, o?: Record<string, unknown>) => String(t(k, o as any));
  const doExport = async (kind: 'pdf' | 'csv') => {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === 'pdf') await shareVatReportPdf(report, tt, money, businessProfile?.businessName ?? '');
      // The accountant's Excel follows the MARKET, not this phone's language.
      else await shareVatReportCsv(report, tt, country === 'UK' ? 'en' : 'eu');
    } catch (err) {
      Alert.alert(t('vatReport.exportFailed', 'Export not created'), friendlyError(err, t('common.didNotWork', "That didn't work. Please try again in a moment.")));
    } finally {
      setBusy(false);
    }
  };

  const RateRows = ({ rows }: { rows: VatReportRow[] }) => (
    <>
      {rows.map((r) => (
        <View key={`${r.ratePct}-${r.nature ?? ''}`} style={styles.row}>
          <Text style={styles.rowLabel}>{rowLabel(r, tt)}</Text>
          <Text style={styles.rowNum}>{money(r.net)}</Text>
          <Text style={styles.rowNum}>{money(r.vat)}</Text>
        </View>
      ))}
    </>
  );
  const balanceToPay = report.balance >= 0;

  // Every hook above this line (#338).
  if (!knownCountry) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <DKScreenHeader title={t('vatReport.title', 'VAT report')} />
        <View style={styles.scroll}>
          <Text style={styles.note}>{t('vatPrep.needCountry', 'Set your country first.')}</Text>
          <Pressable onPress={() => router.push('/(modals)/business-settings' as any)} style={styles.anchor} accessibilityRole="button" testID="vatprep-set-country">
            <Text style={styles.anchorText}>{t('vatPrep.setCountry', 'Set country')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DKScreenHeader title={t('vatReport.title', 'VAT report')} subtitle={t('vatReport.subtitle', 'For your accountant or the tax portal')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.periodRow}>
          <DKMenu
            accessibilityLabel={t('vatReport.period', 'Period')}
            items={periodKeys.map((k) => ({ key: k, label: periodLabel(k), selected: k === periodKey, onPress: () => setPeriodKey(k) }))}
            renderAnchor={(open) => (
              <Pressable onPress={open} style={styles.anchor} accessibilityRole="button" testID="vat-report-period">
                <Text style={styles.anchorText}>{periodLabel(periodKey)}</Text>
                <Ionicons name="chevron-down" size={16} color={DK.colors.text} />
              </Pressable>
            )}
          />
          <Text style={styles.meta}>
            {bounds.start} – {bounds.end} · {report.basis === 'cash' ? t('vatReport.basisCash', 'Counted on the payment date') : t('vatReport.basisInvoice', 'Counted on the invoice date')}
          </Text>
        </View>

        {report.exempt && <Text style={styles.note}>{t('vatReport.exemptBody', 'Small-business scheme: you charge no VAT and reclaim none.')}</Text>}

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{t('vatReport.sales', 'Sales')}</Text>
            <Text style={styles.colHead}>{t('vatReport.net', 'Net')}</Text>
            <Text style={styles.colHead}>{t('vatReport.vat', 'VAT')}</Text>
          </View>
          <RateRows rows={report.sales.rows} />
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.rowLabel} />
            <Text style={[styles.rowNum, styles.bold]} testID="vat-report-sales-net">{money(report.sales.net)}</Text>
            <Text style={[styles.rowNum, styles.bold]} testID="vat-report-sales-vat">{money(report.sales.vat)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{t('vatReport.purchases', 'Purchases')}</Text>
            <Text style={styles.colHead}>{t('vatReport.net', 'Net')}</Text>
            <Text style={styles.colHead}>{t('vatReport.vat', 'VAT')}</Text>
          </View>
          <RateRows rows={report.purchases.rows} />
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.rowLabel} />
            <Text style={[styles.rowNum, styles.bold]}>{money(report.purchases.net)}</Text>
            <Text style={[styles.rowNum, styles.bold]} testID="vat-report-purchases-vat">{money(report.purchases.vat)}</Text>
          </View>
          <Text style={styles.meta}>{t('vatReport.purchasesSource', 'From the expenses you recorded. Supplier invoices you only scanned are not included.')}</Text>
        </View>

        <View style={[styles.card, styles.balanceCard]}>
          <Text style={styles.cardTitle}>{t('vatReport.balance', 'Balance')}</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>{balanceToPay ? t('vatReport.toPay', 'To pay') : t('vatReport.toReclaim', 'To reclaim')}</Text>
            <Text style={styles.balanceValue} testID="vat-report-balance">{money(Math.abs(report.balance))}</Text>
          </View>
        </View>

        {report.notIncluded.drafts.length > 0 && (
          <View style={styles.attention}>
            <Text style={styles.attentionTitle}>{t('vatReport.draftsTitle', 'Not included: drafts')} ({report.notIncluded.drafts.length})</Text>
            <Text style={styles.note}>{t('vatReport.draftsBody', 'These invoices are still drafts. If you sent them, mark them as sent and they will count.')}</Text>
            <Text style={styles.note}>{report.notIncluded.drafts.map((d) => d.number).join(', ')}</Text>
          </View>
        )}
        {report.notIncluded.retentionReleases.length > 0 && (
          <View style={styles.attention}>
            <Text style={styles.attentionTitle}>{t('vatReport.retentionTitle', 'Not counted again: retention released')} ({report.notIncluded.retentionReleases.length})</Text>
            <Text style={styles.note}>{t('vatReport.retentionBody', 'Withheld amounts paid out now. Their turnover and VAT were declared on the original invoices.')}</Text>
          </View>
        )}
        {report.notIncluded.unpaidOnCashBasis.length > 0 && (
          <View style={styles.attention}>
            <Text style={styles.attentionTitle}>{t('vatReport.unpaidTitle', 'Not included: unpaid (cash basis)')} ({report.notIncluded.unpaidOnCashBasis.length})</Text>
            <Text style={styles.note}>{t('vatReport.unpaidBody', 'You declare VAT when you are paid. These invoices count in the period they are paid.')}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('vatReport.invoices', 'Invoices in this report')}</Text>
        {report.sales.invoices.length === 0
          ? <Text style={styles.note}>{t('vatReport.noInvoices', 'No invoices in this period.')}</Text>
          : report.sales.invoices.map((i) => (
            <View key={i.id} style={styles.docRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>{i.number} · {i.customer}</Text>
                <Text style={styles.meta}>{i.date}</Text>
              </View>
              <Text style={styles.rowNum}>{money(i.net)}</Text>
              <Text style={styles.rowNum}>{money(i.vat)}</Text>
            </View>
          ))}

        <Text style={styles.sectionTitle}>{t('vatReport.purchasesList', 'Purchases in this report')}</Text>
        {report.purchases.items.length === 0
          ? <Text style={styles.note}>{t('vatReport.noPurchases', 'No purchases recorded in this period.')}</Text>
          : report.purchases.items.map((p) => (
            <View key={p.id} style={styles.docRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>{p.supplier ? `${p.supplier} · ` : ''}{p.description}</Text>
                <Text style={styles.meta}>{p.date}</Text>
              </View>
              <Text style={styles.rowNum}>{money(p.net)}</Text>
              <Text style={styles.rowNum}>{money(p.vat)}</Text>
            </View>
          ))}

        <Text style={styles.disclaimer}>{t('vatReport.disclaimer', 'Vasco prepares this report from your invoices and receipts. You or your accountant file the VAT return. Reverse charge, cross-border work and private-use corrections are for your accountant.')}</Text>

        <DKMenu
          accessibilityLabel={t('vatReport.export', 'Export')}
          items={[
            { key: 'pdf', label: t('vatReport.exportPdf', 'Share as PDF'), onPress: () => { void doExport('pdf'); } },
            { key: 'csv', label: t('vatReport.exportCsv', 'Share as spreadsheet (CSV)'), onPress: () => { void doExport('csv'); } },
          ]}
          renderAnchor={(open) => (
            <Pressable onPress={open} style={[styles.exportBtn, busy && { opacity: 0.6 }]} disabled={busy} accessibilityRole="button" testID="vat-report-export">
              <Ionicons name="share-outline" size={18} color={DK.colors.text} />
              <Text style={styles.exportText}>{t('vatReport.export', 'Export')}</Text>
            </Pressable>
          )}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { padding: GRID.md, gap: GRID.md, paddingBottom: GRID.xl * 2 },
  periodRow: { gap: GRID.xs },
  anchor: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: GRID.sm,
    paddingVertical: GRID.sm, paddingHorizontal: GRID.md, borderRadius: RADIUS.md,
    backgroundColor: DK.colors.panel, borderWidth: 1, borderColor: DK.colors.border,
  },
  anchorText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  meta: { fontSize: TYPE.tinySize, fontFamily: TYPE.bodyFamily, color: DK.colors.textMuted },
  note: { fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: DK.colors.textMuted, lineHeight: 18 },
  card: { padding: GRID.md, borderRadius: RADIUS.lg, backgroundColor: DK.colors.panel, borderWidth: 1, borderColor: DK.colors.border, gap: GRID.xs },
  cardTitle: { flex: 1, fontSize: TYPE.titleSize, fontFamily: TYPE.sectionFamily, color: DK.colors.text },
  colHead: { width: 96, textAlign: 'right', fontSize: TYPE.tinySize, fontFamily: TYPE.bodyFamily, color: DK.colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  rowNum: { width: 96, textAlign: 'right', fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: DK.colors.text },
  bold: { fontFamily: TYPE.titleFamily },
  totalRow: { borderTopWidth: 1, borderTopColor: DK.colors.border, marginTop: GRID.xs, paddingTop: GRID.xs },
  balanceCard: { borderColor: DK.colors.accent },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { fontSize: TYPE.bodySize, fontFamily: TYPE.sectionFamily, color: DK.colors.text },
  balanceValue: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: DK.colors.accent },
  attention: { padding: GRID.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: DK.colors.highlight, gap: 4 },
  attentionTitle: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: DK.colors.highlight },
  sectionTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.sectionFamily, color: DK.colors.text, marginTop: GRID.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: GRID.xs, borderBottomWidth: 1, borderBottomColor: DK.colors.border },
  docTitle: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: DK.colors.text },
  disclaimer: { fontSize: TYPE.tinySize, fontFamily: TYPE.bodyFamily, color: DK.colors.textMuted, lineHeight: 16, marginTop: GRID.md },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.xs,
    paddingVertical: GRID.md, borderRadius: RADIUS.md, backgroundColor: DK.colors.primary,
  },
  exportText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: DK.colors.text },
});
