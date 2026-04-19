// =============================================================================
// VAT PREP SCREEN — Dutch BTW quarterly return preparation
// =============================================================================
// Truewind-style "ready for review" UX. Contractor reviews the AI-classified
// return, fixes low-confidence lines, then exports to Moneybird OR files
// manually via Belastingdienst DigiD. We NEVER submit directly — only the
// taxpayer or a certified intermediary can legally file.
// =============================================================================

import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../src/state/AppState';
import {
  prepareVatReturn,
  currentBtwPeriod,
  previousBtwPeriod,
  type VatReturnDraft,
  type VatLine,
} from '../../src/services/vatPrepService';
import { useExpenses } from '../../src/services/expenseService';
import {
  shareSummary as shareVatSummary,
  sharePdf as shareVatPdf,
  openDigiD as openDigiDPortal,
} from '../../src/services/vatPrepExportService';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';

type PeriodChoice = 'current' | 'previous';

export default function VatPrepScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { invoices, businessProfile } = useAppState();
  const { expenses: rawExpenses } = useExpenses();
  const [periodChoice, setPeriodChoice] = useState<PeriodChoice>('previous');

  const draft: VatReturnDraft = useMemo(() => {
    const bounds = periodChoice === 'current' ? currentBtwPeriod() : previousBtwPeriod();
    return prepareVatReturn({
      country: 'NL',
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      invoices: invoices as any,
      expenses: rawExpenses.map((e) => ({
        id: e.id,
        description: e.description,
        date: e.date instanceof Date ? e.date.toISOString() : String(e.date),
        amount: e.amount + (e.vatAmount ?? 0),
        vatRate: e.vatRate,
        category: e.category,
      })),
    });
  }, [periodChoice, invoices, rawExpenses]);

  const lowConfLines = draft.lines.filter((l) => l.confidence < 0.75);

  const handleExport = () => {
    const businessName = (businessProfile as any)?.businessName ?? 'Vasco';
    Alert.alert(
      t('vatPrep.export', 'Export'),
      t('vatPrep.exportDesc', 'Vasco prepares the return — you submit via DigiD (Belastingdienst) or forward to your bookkeeper. This never auto-files.'),
      [
        {
          text: t('vatPrep.shareSummary', 'Share summary'),
          onPress: () => {
            shareVatSummary(draft, businessName).catch((err) => {
              Alert.alert(t('common.error', 'Error'), String(err?.message ?? err));
            });
          },
        },
        {
          text: t('vatPrep.sharePdf', 'Share PDF'),
          onPress: () => {
            shareVatPdf(draft, businessName).catch((err) => {
              Alert.alert(t('common.error', 'Error'), String(err?.message ?? err));
            });
          },
        },
        {
          text: t('vatPrep.openDigiD', 'Open DigiD'),
          onPress: async () => {
            const ok = await openDigiDPortal();
            if (!ok) {
              Alert.alert(
                t('vatPrep.cannotOpen', 'Cannot open portal'),
                t('vatPrep.cannotOpenDesc', 'Could not open the Belastingdienst portal. Open belastingdienst.nl in your browser.'),
              );
            }
          },
        },
        { text: t('common.close', 'Close'), style: 'cancel' },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('vatPrep.title', 'BTW-aangifte voorbereiding')}</Text>
          <Text style={styles.subtitle}>{draft.period}</Text>
        </View>
      </View>

      <View style={styles.periodRow}>
        {(['previous', 'current'] as PeriodChoice[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriodChoice(p)}
            style={[styles.periodChip, periodChoice === p && styles.periodChipActive]}
          >
            <Text style={[styles.periodChipText, periodChoice === p && styles.periodChipTextActive]}>
              {p === 'previous' ? t('vatPrep.previousQuarter', 'Afgelopen kwartaal') : t('vatPrep.currentQuarter', 'Huidige kwartaal')}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Safety banner — AI prepares, human submits */}
        <View style={styles.safetyBanner}>
          <Ionicons name="shield-checkmark" size={16} color={SemanticColors.feedbackInfo} />
          <Text style={styles.safetyText}>
            {t('vatPrep.safetyBanner', 'Vasco bereidt je aangifte voor. Je dient zelf in via DigiD of je boekhouder — Vasco verstuurt nooit direct naar de Belastingdienst.')}
          </Text>
        </View>

        {/* Warnings */}
        {draft.warnings.map((w, i) => (
          <View key={i} style={styles.warningCard}>
            <Ionicons name="warning" size={14} color={SemanticColors.feedbackWarning} />
            <Text style={styles.warningText}>{w}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsCard}>
          <Text style={styles.totalsTitle}>{t('vatPrep.totals', 'Totalen')}</Text>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t('vatPrep.outputVat', 'Af te dragen BTW')}</Text>
            <Text style={styles.totalsValue}>€{draft.totalOutputVat.toFixed(2)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t('vatPrep.inputVat', 'Voorbelasting')}</Text>
            <Text style={styles.totalsValue}>€{draft.totalInputVat.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalsRow, styles.totalsRowBig]}>
            <Text style={styles.totalsLabelBig}>
              {draft.netPayable >= 0 ? t('vatPrep.toPay', 'Te betalen') : t('vatPrep.refund', 'Terug te krijgen')}
            </Text>
            <Text style={[styles.totalsValueBig, { color: draft.netPayable >= 0 ? SemanticColors.feedbackError : SemanticColors.feedbackSuccess }]}>
              €{Math.abs(draft.netPayable).toFixed(2)}
            </Text>
          </View>
          {draft.yoyVariancePct != null && (
            <Text style={styles.totalsMeta}>
              {draft.yoyVariancePct >= 0 ? '+' : ''}{Math.round(draft.yoyVariancePct)}% {t('vatPrep.vsLastYear', 'vs. zelfde kwartaal vorig jaar')}
            </Text>
          )}
        </View>

        {/* Low-confidence review */}
        {lowConfLines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('vatPrep.reviewNeeded', 'Te controleren')} ({lowConfLines.length})
            </Text>
            {lowConfLines.map((l) => <LineCard key={l.id} line={l} highlight />)}
          </View>
        )}

        {/* All lines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('vatPrep.allLines', 'Alle regels')} ({draft.lines.length})
          </Text>
          {draft.lines.filter((l) => l.confidence >= 0.75).map((l) => <LineCard key={l.id} line={l} />)}
        </View>

        <Pressable style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="share-outline" size={18} color={Palette.white} />
          <Text style={styles.exportBtnText}>{t('vatPrep.export', 'Exporteer voor aangifte')}</Text>
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function LineCard({ line, highlight }: { line: VatLine; highlight?: boolean }) {
  return (
    <View style={[styles.lineCard, highlight && styles.lineCardHighlight]}>
      <View style={styles.lineHeader}>
        <Text style={styles.lineDescription} numberOfLines={1}>{line.description}</Text>
        <Text style={styles.lineVatAmount}>€{line.vatAmount.toFixed(2)}</Text>
      </View>
      <View style={styles.lineMeta}>
        <Text style={styles.lineMetaText}>
          {line.sourceType === 'invoice_sent' ? 'Factuur' : 'Uitgave'} · {line.vatRate}% · {line.classification}
        </Text>
        {line.confidence < 0.75 && (
          <View style={styles.confBadge}>
            <Ionicons name="help-circle" size={11} color={SemanticColors.feedbackWarning} />
            <Text style={styles.confBadgeText}>Controleer</Text>
          </View>
        )}
      </View>
      {line.warnings.length > 0 && (
        <Text style={styles.lineWarning}>{line.warnings.join(' · ')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, paddingHorizontal: GRID.md, paddingVertical: GRID.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: SemanticColors.surfaceSecondary },
  title: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  subtitle: { fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  periodRow: { flexDirection: 'row', gap: GRID.sm, paddingHorizontal: GRID.md, marginBottom: GRID.sm },
  periodChip: { paddingHorizontal: GRID.md, paddingVertical: GRID.sm, borderRadius: RADIUS.full, backgroundColor: SemanticColors.surfaceSecondary },
  periodChipActive: { backgroundColor: Palette.hermesOrange + '20' },
  periodChipText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary },
  periodChipTextActive: { color: Palette.hermesOrange },
  scroll: { padding: GRID.md, gap: GRID.md },
  safetyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    padding: GRID.sm, borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.feedbackInfo + '10',
  },
  safetyText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.feedbackInfo, lineHeight: 18 },
  warningCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: GRID.xs,
    padding: GRID.sm, borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.feedbackWarning + '10',
  },
  warningText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.feedbackWarning },
  totalsCard: {
    padding: GRID.md, borderRadius: RADIUS.lg,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1, borderColor: SemanticColors.borderMuted,
    gap: GRID.xs,
  },
  totalsTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, marginBottom: GRID.xs },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalsRowBig: { marginTop: GRID.sm, paddingTop: GRID.sm, borderTopWidth: 1, borderTopColor: SemanticColors.borderMuted },
  totalsLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  totalsValue: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  totalsLabelBig: { fontSize: TYPE.bodySize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  totalsValueBig: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily },
  totalsMeta: { fontSize: TYPE.tinySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textTertiary, marginTop: GRID.xs },
  section: { gap: GRID.sm },
  sectionTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, marginBottom: 4 },
  lineCard: {
    padding: GRID.sm, borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1, borderColor: SemanticColors.borderMuted,
    gap: 4,
  },
  lineCardHighlight: { borderColor: SemanticColors.feedbackWarning + '60' },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: GRID.sm },
  lineDescription: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  lineVatAmount: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  lineMeta: { flexDirection: 'row', alignItems: 'center', gap: GRID.xs },
  lineMetaText: { fontSize: TYPE.tinySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textTertiary },
  confBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.feedbackWarning + '15',
  },
  confBadgeText: { fontSize: TYPE.tinySize, fontFamily: TYPE.titleFamily, color: SemanticColors.feedbackWarning },
  lineWarning: { fontSize: TYPE.tinySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.feedbackWarning },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.xs,
    paddingVertical: GRID.md, borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange,
  },
  exportBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },
});
