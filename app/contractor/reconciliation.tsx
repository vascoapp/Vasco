// =============================================================================
// RECONCILIATION — PO ↔ Levering ↔ Factuur matching
// =============================================================================
import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { usePurchaseOrders, type PurchaseOrder } from '../../src/services/purchaseOrderService';

type IconName = keyof typeof Ionicons.glyphMap;
type MatchStatus = 'matched' | 'partial' | 'discrepancy' | 'unmatched';

interface ReconciliationItem {
  id: string;
  poNumber: string;
  supplierName: string;
  poTotal: number;
  deliveredTotal: number;
  invoicedTotal: number;
  status: MatchStatus;
  discrepancyAmount: number;
  discrepancyReason?: string;
}

// Note: labels are static defaults; i18n is applied at render time
const STATUS_CONFIG: Record<MatchStatus, { labelKey: string; labelDefault: string; color: string; icon: IconName }> = {
  matched: { labelKey: 'financials.matched', labelDefault: 'Gematcht', color: SemanticColors.feedbackSuccess, icon: 'checkmark-circle' },
  partial: { labelKey: 'financials.partial', labelDefault: 'Gedeeltelijk', color: SemanticColors.feedbackWarning, icon: 'alert-circle-outline' },
  discrepancy: { labelKey: 'financials.discrepancy', labelDefault: 'Afwijking', color: SemanticColors.feedbackError, icon: 'warning-outline' },
  unmatched: { labelKey: 'financials.unmatched', labelDefault: 'Niet gematcht', color: SemanticColors.textTertiary, icon: 'help-circle-outline' },
};

export default function ReconciliationScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { orders } = usePurchaseOrders();

  // Build reconciliation from PO data
  const reconciliationItems = useMemo((): ReconciliationItem[] => {
    return orders.map(order => {
      let deliveredTotal: number;
      let invoicedTotal: number;
      let status: MatchStatus;
      let discrepancyReason: string | undefined;

      switch (order.status) {
        case 'delivered':
          // Simulate: 90% chance prices match, 10% minor discrepancy
          const hasDiscrepancy = order.id === 'po-2';
          deliveredTotal = order.total;
          invoicedTotal = hasDiscrepancy ? order.total * 1.03 : order.total; // 3% overcharge
          status = hasDiscrepancy ? 'discrepancy' : 'matched';
          discrepancyReason = hasDiscrepancy ? 'Leveranciersfactuur 3% hoger dan PO' : undefined;
          break;
        case 'confirmed':
        case 'shipped':
          deliveredTotal = 0;
          invoicedTotal = 0;
          status = 'unmatched';
          break;
        case 'draft':
        case 'submitted':
          deliveredTotal = 0;
          invoicedTotal = 0;
          status = 'unmatched';
          break;
        default:
          deliveredTotal = order.total;
          invoicedTotal = order.total;
          status = 'matched';
      }

      const discrepancyAmount = Math.abs(invoicedTotal - order.total);

      return {
        id: order.id,
        poNumber: order.poNumber,
        supplierName: order.supplierName,
        poTotal: order.total,
        deliveredTotal,
        invoicedTotal,
        status,
        discrepancyAmount: Math.round(discrepancyAmount * 100) / 100,
        discrepancyReason,
      };
    });
  }, [orders]);

  const stats = useMemo(() => {
    const matched = reconciliationItems.filter(i => i.status === 'matched').length;
    const discrepancies = reconciliationItems.filter(i => i.status === 'discrepancy');
    const totalDisc = discrepancies.reduce((sum, d) => sum + d.discrepancyAmount, 0);
    return {
      total: reconciliationItems.length,
      matched,
      discrepancyCount: discrepancies.length,
      totalDiscrepancy: totalDisc,
      unmatched: reconciliationItems.filter(i => i.status === 'unmatched').length,
    };
  }, [reconciliationItems]);

  const fmt = (n: number) => `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('financials.reconciliation', 'Reconciliatie')}</Text>
          <Text style={styles.headerSubtitle}>{t('financials.reconciliationSubtitle', 'PO ↔ Levering ↔ Factuur matching')}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>{stats.matched}</Text>
            <Text style={styles.statLabel}>{t('financials.matched', 'Gematcht')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, stats.discrepancyCount > 0 && { color: SemanticColors.feedbackError }]}>{stats.discrepancyCount}</Text>
            <Text style={styles.statLabel}>{t('financials.discrepancies', 'Afwijkingen')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.unmatched}</Text>
            <Text style={styles.statLabel}>{t('financials.outstanding', 'Openstaand')}</Text>
          </View>
        </View>
        {stats.totalDiscrepancy > 0 && (
          <View style={styles.discBanner}>
            <Ionicons name="warning-outline" size={16} color={SemanticColors.feedbackError} />
            <Text style={styles.discBannerText}>
              {fmt(stats.totalDiscrepancy)} {t('financials.totalDiscrepanciesFound', 'totaal aan afwijkingen gevonden')}
            </Text>
          </View>
        )}
      </View>

      {/* Items */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {reconciliationItems.map(item => {
          const conf = STATUS_CONFIG[item.status];
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={[styles.itemAccent, { backgroundColor: conf.color }]} />
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemPO}>{item.poNumber}</Text>
                    <Text style={styles.itemSupplier}>{item.supplierName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: conf.color + '15' }]}>
                    <Ionicons name={conf.icon} size={14} color={conf.color} />
                    <Text style={[styles.statusText, { color: conf.color }]}>{t(conf.labelKey, conf.labelDefault)}</Text>
                  </View>
                </View>

                {/* 3-column comparison */}
                <View style={styles.comparison}>
                  <View style={styles.compCol}>
                    <Text style={styles.compLabel}>{t('financials.ordered', 'Besteld')}</Text>
                    <Text style={styles.compValue}>{fmt(item.poTotal)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={SemanticColors.textTertiary} />
                  <View style={styles.compCol}>
                    <Text style={styles.compLabel}>{t('financials.delivered', 'Geleverd')}</Text>
                    <Text style={[styles.compValue, item.deliveredTotal === 0 && { color: SemanticColors.textTertiary }]}>
                      {item.deliveredTotal > 0 ? fmt(item.deliveredTotal) : '—'}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={SemanticColors.textTertiary} />
                  <View style={styles.compCol}>
                    <Text style={styles.compLabel}>{t('financials.invoice', 'Factuur')}</Text>
                    <Text style={[
                      styles.compValue,
                      item.invoicedTotal === 0 && { color: SemanticColors.textTertiary },
                      item.status === 'discrepancy' && { color: SemanticColors.feedbackError },
                    ]}>
                      {item.invoicedTotal > 0 ? fmt(item.invoicedTotal) : '—'}
                    </Text>
                  </View>
                </View>

                {item.discrepancyReason && (
                  <View style={styles.discRow}>
                    <Ionicons name="alert-circle" size={14} color={SemanticColors.feedbackError} />
                    <Text style={styles.discText}>{item.discrepancyReason}</Text>
                    <Text style={styles.discAmount}>+{fmt(item.discrepancyAmount)}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  statsCard: { marginHorizontal: SafeArea.side, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md },
  statsRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  statLabel: { fontSize: 10, color: SemanticColors.textSecondary, marginTop: 2, letterSpacing: 0.3 },
  statDivider: { width: 1, backgroundColor: SemanticColors.borderDefault },
  discBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: SemanticColors.feedbackError + '10', borderRadius: 8, padding: 8 },
  discBannerText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.feedbackError },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  itemCard: { flexDirection: 'row', backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, overflow: 'hidden', marginBottom: 6 },
  itemAccent: { width: 3 },
  itemContent: { flex: 1, padding: Spacing.sm, gap: 8 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemInfo: {},
  itemPO: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  itemSupplier: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold' },
  comparison: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'space-between' },
  compCol: { flex: 1, alignItems: 'center' },
  compLabel: { fontSize: 10, color: SemanticColors.textTertiary, letterSpacing: 0.3 },
  compValue: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary, marginTop: 2 },
  discRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: SemanticColors.feedbackError + '08', borderRadius: 8, padding: 6 },
  discText: { flex: 1, fontSize: 12, color: SemanticColors.feedbackError },
  discAmount: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: SemanticColors.feedbackError },
});
