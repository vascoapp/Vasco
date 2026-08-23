// =============================================================================
// PAYROLL — Verloning overzicht
// =============================================================================
// Hours actually logged, per person, at the rate recorded for them.
//
// This screen used to read `teamManagementService` — a demo-only singleton
// with no persistence that NOTHING in the app ever adds a member to. So an
// aannemer who had built a five-person crew in Team was told "no team members
// yet", and in demo builds the export button offered their bookkeeper a CSV of
// three fabricated employees at fabricated rates. It now reads the same
// `workers` and `jobs` every other crew surface reads.
//
// The arithmetic lives in `payrollService` (pure, tested), including its two
// deliberate refusals to invent a number: no overtime premium (CAO-dependent
// across six countries) and an unknown rate stays unknown rather than
// summing as zero.
// =============================================================================

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { EmptyState } from '../../src/components/shared/EmptyState';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { buildPayrollCsv } from '../../src/utils/payrollCsv';
import { buildPayroll, periodBounds, type PayrollPeriod } from '../../src/services/payrollService';
import { formatCurrency, formatDecimal1 } from '../../src/i18n/formatting';
import type { Country } from '../../src/i18n/formatting';

export default function PayrollScreen() {
  const { t } = useTranslation();
  // Dutch 'u' (uren) was hardcoded here — an English contractor read "7.5u".
  // common.durationH is the localised unit: {{h}}h · {{h}}u · {{h}} Std.
  const router = useRouter();
  const [period, setPeriod] = useState<PayrollPeriod>('week');
  const { jobs, workers, businessProfile } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  const hoursLabel = (h: number) =>
    t('common.durationH', { defaultValue: '{{h}}h', h: formatDecimal1(h, country) });

  const contractorName = businessProfile?.businessName || user?.name || t('payroll.you', 'You');

  // Same rate `getProjectPnL` charges the contractor's own hours at, so the
  // two surfaces cannot disagree about what one person's day cost.
  const contractorHourlyCost = (businessProfile as { hourlyRate?: number } | undefined)?.hourlyRate;

  const payrollData = useMemo(
    () => buildPayroll({ jobs, workers, period, now: new Date(), contractorName, contractorHourlyCost }),
    [jobs, workers, period, contractorName, contractorHourlyCost],
  );

  const fmt = (n: number) => formatCurrency(n, country);

  const handleExport = async () => {
    const { from, to } = periodBounds(period, new Date());
    // The separator and the decimal mark are ONE decision, and this file used
    // to split them: `;` (chosen for EU bookkeeping imports) with `.` decimals,
    // defended in a comment as "machine readable". But `;` is the separator
    // precisely BECAUSE comma-decimal locales need the comma for numbers — so
    // German and Dutch Excel opened this file and read every amount as text.
    // 1.234,56 does not become 1234.56 by wishing; the two conventions come as
    // a pair, and picking one from each is the only combination that is wrong
    // in every locale.
    const csv = buildPayrollCsv(
      payrollData.lines,
      {
        name: t('payroll.csvName', 'Name'),
        hours: t('payroll.csvHours', 'Hours'),
        rate: t('payroll.csvRate', 'Hourly cost'),
        cost: t('payroll.csvCost', 'Cost'),
      },
      country,
      { from, to },
    );

    try {
      await Share.share({
        message: csv,
        title: t('payroll.exportTitle', 'Payroll export {{from}} — {{to}}', { from, to }),
      });
    } catch {
      Alert.alert(t('payroll.exportFailed', 'Export failed'), t('common.tryAgain', 'Please try again.'));
    }
  };

  const periodLabel = period === 'week'
    ? t('payroll.thisWeek', 'This week')
    : t('payroll.thisMonth', 'This month');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          {/* "LOHNABRECHNUNG" broke to "LOHNABRECHNUN / G" — #113 again, after
              STÜCKPREIS and AUFTRAGSABSCHLUSS. Local 24pt headers are the class
              (DKScreenHeader is 18pt and already numberOfLines={1}); a German
              compound is one word, so it has to shrink rather than wrap. */}
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t('payroll.title', 'Payroll')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {periodLabel} · {t('payroll.peopleCount', { count: payrollData.lines.length, defaultValue: '{{count}} people' })}
          </Text>
        </View>
        <Pressable style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="share-outline" size={20} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      {/* Period Tabs */}
      <View style={styles.tabBar}>
        {(['week', 'month'] as PayrollPeriod[]).map(p => (
          <Pressable key={p} style={[styles.tab, period === p && styles.tabActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
              {p === 'week' ? t('payroll.week', 'Week') : t('payroll.month', 'Month')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{hoursLabel(payrollData.totalHours)}</Text>
            <Text style={styles.summaryLabel}>{t('payroll.totalHours', 'Total hours')}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {t('payroll.peopleCount', { count: payrollData.lines.length, defaultValue: '{{count}} people' })}
            </Text>
            <Text style={styles.summaryLabel}>{t('payroll.worked', 'Worked')}</Text>
          </View>
        </View>
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>{t('payroll.totalPayroll', 'Total payroll')}</Text>
          <Text style={styles.grandTotalValue}>{fmt(payrollData.knownCost)}</Text>
        </View>
        {/* The total covers only the people who HAVE a rate. Saying so is the
            difference between a wage bill and an understated one — a missing
            rate must never quietly read as a free employee. */}
        {payrollData.unpricedCount > 0 && (
          <Text style={styles.unpricedNote}>
            {t('payroll.unpricedNote', {
              count: payrollData.unpricedCount,
              hours: formatDecimal1(payrollData.unpricedHours, country),
              defaultValue: 'Excludes {{count}} person with no hourly cost recorded ({{hours}}h). Add it under Team.',
            })}
          </Text>
        )}
      </View>

      {/* Per-member breakdown */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Empty means "nobody logged an hour in this period", which is a
            different problem from "you have no crew" — the old copy asserted
            the latter to an aannemer with five people on the board. */}
        {payrollData.lines.length === 0 && (
          <EmptyState
            icon="time-outline"
            title={t('payroll.noHoursTitle', 'No hours logged this period')}
            description={
              workers.length === 0
                ? t('payroll.noHoursSolo', 'Log hours on a job and they appear here, ready to export for your bookkeeper.')
                : t('payroll.noHoursCrew', 'Hours logged against a job are attributed to whoever is assigned to it. Nothing has been logged for this period yet.')
            }
          />
        )}
        {payrollData.lines.map(line => (
          <View key={line.workerId ?? 'self'} style={styles.memberCard}>
            <View style={styles.memberHeader}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {line.name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName} numberOfLines={1}>{line.name}</Text>
                <Text style={styles.memberRole} numberOfLines={1}>
                  {line.hourlyCost === undefined
                    ? t('payroll.noRate', 'No hourly cost recorded')
                    : t('payroll.perHour', '{{rate}}/h', { rate: fmt(line.hourlyCost) })}
                  {line.isInactive ? ` · ${t('payroll.inactive', 'No longer on the crew')}` : ''}
                </Text>
              </View>
              {/* An unknown cost prints a dash, not a figure. */}
              <Text style={[styles.memberTotal, line.cost === undefined && styles.memberTotalUnknown]}>
                {line.cost === undefined ? '—' : fmt(line.cost)}
              </Text>
            </View>
            <View style={styles.memberDetails}>
              <View style={styles.detailCol}>
                <Text style={styles.detailValue}>{hoursLabel(line.hours)}</Text>
                <Text style={styles.detailLabel}>{t('payroll.hours', 'Hours')}</Text>
              </View>
              <View style={styles.detailCol}>
                <Text style={styles.detailValue}>
                  {t('payroll.jobsCount', { count: line.jobCount, defaultValue: '{{count}} jobs' })}
                </Text>
                <Text style={styles.detailLabel}>{t('payroll.onJobs', 'On jobs')}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Export banner — pointless with nothing to export. */}
        {payrollData.lines.length > 0 && (
          <Pressable style={styles.exportBanner} onPress={handleExport}>
            <Ionicons name="download-outline" size={22} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.exportBannerTitle}>{t('payroll.export', 'Export')}</Text>
              <Text style={styles.exportBannerSub}>{t('payroll.exportSub', 'Share as CSV for your accounting software or bookkeeper')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </Pressable>
        )}

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
  headerTitle: { fontSize: 24, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  exportButton: { width: 40, height: 40, borderRadius: 16, backgroundColor: Palette.hermesOrange + '0A', alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: Spacing.md },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center' },
  tabActive: { backgroundColor: Palette.hermesOrange },
  tabText: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: SemanticColors.textTertiary },
  tabTextActive: { color: '#fff' },
  summaryCard: {
    marginHorizontal: SafeArea.side, backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md,
  },
  summaryRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  summaryLabel: { fontSize: 10, color: SemanticColors.textSecondary, marginTop: 2, letterSpacing: 0.3 },
  summaryDivider: { width: 1, backgroundColor: SemanticColors.borderDefault, marginHorizontal: Spacing.xs },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault, paddingTop: Spacing.sm },
  grandTotalLabel: { fontSize: 14, fontFamily: 'Archivo_700Bold', color: SemanticColors.textSecondary },
  grandTotalValue: { fontSize: 18, fontFamily: 'Archivo_900Black', color: SemanticColors.textPrimary },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  memberCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm, marginBottom: 6,
  },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.hermesOrange + '15', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontFamily: 'Archivo_800ExtraBold', color: Palette.hermesOrange },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  memberRole: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 1 },
  memberTotal: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  memberTotalUnknown: { color: SemanticColors.textTertiary },
  unpricedNote: {
    fontSize: 12, color: Palette.hermesOrange, marginTop: Spacing.xs, lineHeight: 16,
  },
  memberDetails: { flexDirection: 'row', marginTop: Spacing.sm, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault },
  detailCol: { flex: 1, alignItems: 'center' },
  detailValue: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  detailLabel: { fontSize: 10, color: SemanticColors.textTertiary, marginTop: 1 },
  exportBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Palette.hermesOrange, borderRadius: 16, padding: Spacing.md, paddingVertical: 16, marginTop: Spacing.md,
  },
  exportBannerTitle: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', color: '#fff' },
  exportBannerSub: { fontSize: 12, color: '#ffffffCC', marginTop: 2 },
});
