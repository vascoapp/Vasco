// =============================================================================
// PURCHASE ORDERS — Inkooporders beheer
// =============================================================================
// Create, track, and manage purchase orders for jobs
// =============================================================================

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { usePurchaseOrders, usePOStats, type PurchaseOrder, type POStatus } from '../../src/services/purchaseOrderService';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { useTranslation } from 'react-i18next';
import { useProcurementAgent, type MaterialNeed } from '../../src/services/procurementAgentService';

type IconName = keyof typeof Ionicons.glyphMap;

const STATUS_CONFIG: Record<POStatus, { labelKey: string; fallback: string; color: string; icon: IconName }> = {
  draft: { labelKey: 'purchaseOrders.draft', fallback: 'Concept', color: SemanticColors.textTertiary, icon: 'document-outline' },
  submitted: { labelKey: 'purchaseOrders.submitted', fallback: 'Verstuurd', color: SemanticColors.feedbackInfo, icon: 'paper-plane-outline' },
  confirmed: { labelKey: 'purchaseOrders.confirmed', fallback: 'Bevestigd', color: Palette.hermesOrange, icon: 'checkmark-circle-outline' },
  shipped: { labelKey: 'purchaseOrders.shipped', fallback: 'Onderweg', color: '#a855f7', icon: 'car-outline' },
  delivered: { labelKey: 'purchaseOrders.delivered', fallback: 'Geleverd', color: SemanticColors.feedbackSuccess, icon: 'cube-outline' },
  invoiced: { labelKey: 'purchaseOrders.invoiced', fallback: 'Gefactureerd', color: SemanticColors.feedbackInfo, icon: 'receipt-outline' },
  cancelled: { labelKey: 'purchaseOrders.cancelled', fallback: 'Geannuleerd', color: SemanticColors.feedbackError, icon: 'close-circle-outline' },
};

export default function PurchaseOrdersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { orders, submit, updateStatus } = usePurchaseOrders();
  const stats = usePOStats();
  const { suppliers } = useAppState();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600); }, []);

  // AI Procurement Agent — analyze pending orders for savings
  const pendingMaterials: MaterialNeed[] = orders
    .filter(o => o.status === 'draft')
    .flatMap(o => (o.items || []).map((item: any) => ({
      name: item.description || item.name || 'Materiaal',
      quantity: item.quantity || 1,
      unit: item.unit || 'stuk',
      jobId: o.jobId,
      urgency: 'normal' as const,
    })));
  const procurement = useProcurementAgent(pendingMaterials);

  const sortedOrders = [...orders].sort((a, b) => {
    const priority: Record<POStatus, number> = { draft: 0, submitted: 1, confirmed: 2, shipped: 3, delivered: 4, invoiced: 5, cancelled: 6 };
    return (priority[a.status] ?? 5) - (priority[b.status] ?? 5);
  });

  const handleAction = (order: PurchaseOrder) => {
    switch (order.status) {
      case 'draft':
        Alert.alert(t('purchaseOrders.submitOrder', 'Bestelling versturen'), `${order.poNumber} ${t('purchaseOrders.submitTo', 'versturen naar')} ${order.supplierName}?`, [
          { text: t('purchaseOrders.cancel', 'Annuleren'), style: 'cancel' },
          { text: t('purchaseOrders.submit', 'Versturen'), onPress: () => submit(order.id) },
        ]);
        break;
      case 'confirmed':
      case 'shipped':
        Alert.alert(t('purchaseOrders.deliveryReceived', 'Levering ontvangen'), `${t('purchaseOrders.materialsReceived', 'Materialen voor')} ${order.poNumber} ${t('purchaseOrders.received', 'ontvangen')}?`, [
          { text: t('purchaseOrders.cancel', 'Annuleren'), style: 'cancel' },
          { text: t('purchaseOrders.receive', 'Ontvangen'), onPress: () => updateStatus(order.id, 'delivered') },
        ]);
        break;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('purchaseOrders.title', 'Inkooporders')}</Text>
          <Text style={styles.headerSubtitle}>
            {stats.pendingOrders} {t('purchaseOrders.pending', 'openstaand')} · €{stats.pendingValue.toLocaleString('nl-NL')}
          </Text>
        </View>
      </View>

      {/* Stats Bar */}
      <FadeIn delay={0} duration={400}>
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>{t('purchaseOrders.total', 'Totaal')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, stats.pendingOrders > 0 && { color: Palette.hermesOrange }]}>
              {stats.pendingOrders}
            </Text>
            <Text style={styles.statLabel}>{t('purchaseOrders.pending', 'Openstaand')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.deliveredThisMonth}</Text>
            <Text style={styles.statLabel}>{t('purchaseOrders.delivered', 'Geleverd')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>€{(stats.totalSpentThisMonth / 1000).toFixed(1)}k</Text>
            <Text style={styles.statLabel}>{t('purchaseOrders.spent', 'Besteed')}</Text>
          </View>
        </View>
      </FadeIn>

      {/* AI Procurement Agent Banner */}
      {procurement.totalSavings > 0 && !procurement.loading && (
        <Pressable
          style={styles.aiBanner}
          onPress={() => Alert.alert(
            'AI Inkoopadvies',
            procurement.results.map(r => r.recommendation).join('\n\n'),
          )}
        >
          <Ionicons name="sparkles" size={18} color={Palette.hermesOrange} />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiBannerTitle}>{procurement.recommendation}</Text>
            <Text style={styles.aiBannerSub}>
              {procurement.results.length} materialen geanalyseerd
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
        </Pressable>
      )}

      {/* Orders List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}>
        {sortedOrders.map(order => {
          const config = STATUS_CONFIG[order.status];
          const isExpanded = expandedId === order.id;
          const hasAction = ['draft', 'confirmed', 'shipped'].includes(order.status);

          return (
            <View key={order.id}>
              <Pressable
                style={styles.orderCard}
                onPress={() => setExpandedId(isExpanded ? null : order.id)}
              >
                <View style={[styles.orderAccent, { backgroundColor: config.color }]} />
                <Ionicons name={config.icon} size={20} color={config.color} style={{ marginLeft: Spacing.sm }} />
                <View style={styles.orderInfo}>
                  <Text style={styles.orderNumber}>{order.poNumber}</Text>
                  <Text style={styles.orderSupplier} numberOfLines={1}>{order.supplierName}</Text>
                  {order.jobTitle && (
                    <Text style={styles.orderJob} numberOfLines={1}>{order.jobTitle}</Text>
                  )}
                </View>
                <View style={styles.orderRight}>
                  <Text style={styles.orderAmount}>€{order.total.toLocaleString('nl-NL')}</Text>
                  <Text style={[styles.orderStatus, { color: config.color }]}>{t(config.labelKey, config.fallback)}</Text>
                </View>
              </Pressable>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  {/* Line Items */}
                  {order.items.map(item => (
                    <View key={item.id} style={styles.lineItem}>
                      <Text style={styles.lineDesc} numberOfLines={1}>{item.description}</Text>
                      <Text style={styles.lineQty}>{item.quantity} {item.unit}</Text>
                      <Text style={styles.lineTotal}>€{item.total.toLocaleString('nl-NL')}</Text>
                    </View>
                  ))}

                  {/* Totals */}
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>{t('purchaseOrders.subtotal', 'Subtotaal')}</Text>
                    <Text style={styles.totalsValue}>€{order.subtotal.toLocaleString('nl-NL')}</Text>
                  </View>
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>BTW {order.vatRate}%</Text>
                    <Text style={styles.totalsValue}>€{order.vatAmount.toLocaleString('nl-NL')}</Text>
                  </View>
                  <View style={[styles.totalsRow, styles.totalsFinal]}>
                    <Text style={styles.totalsFinalLabel}>{t('purchaseOrders.total', 'Totaal')}</Text>
                    <Text style={styles.totalsFinalValue}>€{order.total.toLocaleString('nl-NL')}</Text>
                  </View>

                  {/* Expected delivery */}
                  {order.expectedDelivery && (
                    <View style={styles.deliveryRow}>
                      <Ionicons name="calendar-outline" size={14} color={SemanticColors.textSecondary} />
                      <Text style={styles.deliveryText}>
                        {t('purchaseOrders.expectedDelivery', 'Verwachte levering')}: {order.expectedDelivery.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  )}

                  {/* Action Button */}
                  {hasAction && (
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => handleAction(order)}
                    >
                      <Text style={styles.actionButtonText}>
                        {order.status === 'draft' ? t('purchaseOrders.submit', 'Versturen') : t('purchaseOrders.markReceived', 'Ontvangen markeren')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: SafeArea.side, marginBottom: Spacing.sm,
    backgroundColor: Palette.hermesOrange + '08', borderRadius: 16, padding: 14,
  },
  aiBannerTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  aiBannerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  statsBar: {
    flexDirection: 'row',
    marginHorizontal: SafeArea.side,
    backgroundColor: Palette.hermesOrange + '08',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  statLabel: { fontSize: 10, color: SemanticColors.textSecondary, marginTop: 2, letterSpacing: 0.3 },
  statDivider: { width: 1, backgroundColor: SemanticColors.borderDefault, marginHorizontal: Spacing.xs },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: Spacing.sm,
    paddingLeft: 0,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
  },
  orderAccent: { width: 3, alignSelf: 'stretch' },
  orderInfo: { flex: 1 },
  orderNumber: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  orderSupplier: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 1 },
  orderJob: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 1 },
  orderRight: { alignItems: 'flex-end' },
  orderAmount: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  orderStatus: { fontSize: 11, fontFamily: 'Manrope_500Medium', marginTop: 1 },
  expandedContent: {
    backgroundColor: SemanticColors.surfacePrimary,
    marginTop: -6,
    marginBottom: 6,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: Spacing.sm,
    paddingTop: Spacing.xs,
    gap: 4,
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  lineDesc: { flex: 1, fontSize: 12, color: SemanticColors.textPrimary },
  lineQty: { fontSize: 12, color: SemanticColors.textSecondary, marginHorizontal: Spacing.sm },
  lineTotal: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalsLabel: { fontSize: 12, color: SemanticColors.textSecondary },
  totalsValue: { fontSize: 12, color: SemanticColors.textPrimary },
  totalsFinal: { borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault, paddingTop: 4, marginTop: 2 },
  totalsFinalLabel: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  totalsFinalValue: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  deliveryText: { fontSize: 12, color: SemanticColors.textSecondary },
  actionButton: {
    alignItems: 'center',
    backgroundColor: Palette.hermesOrange + '10',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  actionButtonText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Palette.hermesOrange },
});
