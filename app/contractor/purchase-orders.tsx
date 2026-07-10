// =============================================================================
// PURCHASE ORDERS — Inkooporders beheer
// =============================================================================
// Create, track, and manage purchase orders for jobs
// =============================================================================

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { usePurchaseOrders, usePOStats, type PurchaseOrder, type POStatus } from '../../src/services/purchaseOrderService';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { EmptyState } from '../../src/components/shared/EmptyState';
import { useTranslation } from 'react-i18next';
import { useProcurementAgent, type MaterialNeed } from '../../src/services/procurementAgentService';

type IconName = keyof typeof Ionicons.glyphMap;

const STATUS_CONFIG: Record<POStatus, { labelKey: string; fallback: string; color: string; icon: IconName }> = {
  draft: { labelKey: 'purchaseOrders.draft', fallback: 'Draft', color: SemanticColors.textTertiary, icon: 'document-outline' },
  submitted: { labelKey: 'purchaseOrders.submitted', fallback: 'Submitted', color: SemanticColors.feedbackInfo, icon: 'paper-plane-outline' },
  confirmed: { labelKey: 'purchaseOrders.confirmed', fallback: 'Confirmed', color: Palette.hermesOrange, icon: 'checkmark-circle-outline' },
  shipped: { labelKey: 'purchaseOrders.shipped', fallback: 'Shipped', color: '#a855f7', icon: 'car-outline' },
  delivered: { labelKey: 'purchaseOrders.delivered', fallback: 'Delivered', color: SemanticColors.feedbackSuccess, icon: 'cube-outline' },
  invoiced: { labelKey: 'purchaseOrders.invoiced', fallback: 'Invoiced', color: SemanticColors.feedbackInfo, icon: 'receipt-outline' },
  cancelled: { labelKey: 'purchaseOrders.cancelled', fallback: 'Cancelled', color: SemanticColors.feedbackError, icon: 'close-circle-outline' },
};

export default function PurchaseOrdersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { orders, submit, updateStatus } = usePurchaseOrders();
  const stats = usePOStats();
  const { suppliers, jobs } = useAppState();
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
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('purchaseOrders.title', 'Inkooporders')}</Text>
          <Text style={styles.headerSubtitle}>
            {stats.pendingOrders} {t('purchaseOrders.pending', 'openstaand')} · €{stats.pendingValue.toLocaleString(undefined)}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/contractor/material-search' as any)}
          style={styles.searchMaterialsBtn}
          accessibilityLabel={t('purchaseOrders.searchMaterials', 'Search materials')}
        >
          <Ionicons name="search" size={18} color={Palette.hermesOrange} />
        </Pressable>
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
        {sortedOrders.length === 0 && (
          <EmptyState
            icon="cart-outline"
            title={t('purchaseOrders.emptyTitle', 'No purchase orders yet')}
            description={t('purchaseOrders.emptyDesc', 'Create your first order, or let Vasco suggest materials from your planned jobs.')}
          />
        )}
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
                  <Text style={styles.orderAmount}>€{order.total.toLocaleString(undefined)}</Text>
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
                      <Text style={styles.lineTotal}>€{item.total.toLocaleString(undefined)}</Text>
                    </View>
                  ))}

                  {/* Totals */}
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>{t('purchaseOrders.subtotal', 'Subtotaal')}</Text>
                    <Text style={styles.totalsValue}>€{order.subtotal.toLocaleString(undefined)}</Text>
                  </View>
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>BTW {order.vatRate}%</Text>
                    <Text style={styles.totalsValue}>€{order.vatAmount.toLocaleString(undefined)}</Text>
                  </View>
                  <View style={[styles.totalsRow, styles.totalsFinal]}>
                    <Text style={styles.totalsFinalLabel}>{t('purchaseOrders.total', 'Totaal')}</Text>
                    <Text style={styles.totalsFinalValue}>€{order.total.toLocaleString(undefined)}</Text>
                  </View>

                  {/* Expected delivery */}
                  {order.expectedDelivery && (
                    <View style={styles.deliveryRow}>
                      <Ionicons name="calendar-outline" size={14} color={SemanticColors.textSecondary} />
                      <Text style={styles.deliveryText}>
                        {t('purchaseOrders.expectedDelivery', 'Verwachte levering')}: {order.expectedDelivery.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
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
        <View style={{ height: 140 }} />
      </ScrollView>

      {/* FAB — new purchase order */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }]}
        onPress={() => {
          const jobsWithMaterials = jobs.filter((j: any) => j.materials && j.materials.length > 0).slice(0, 5);
          if (jobsWithMaterials.length === 0) {
            Alert.alert(
              t('purchaseOrders.newPO', 'New Purchase Order'),
              t('purchaseOrders.noJobsWithMaterials', 'No jobs with materials found. Add materials to a job first.'),
            );
            return;
          }
          Alert.alert(
            t('purchaseOrders.newPO', 'New Purchase Order'),
            t('purchaseOrders.selectJob', 'Select a job to create a purchase order from its materials list'),
            [
              ...jobsWithMaterials.map((j: any) => ({
                text: j.title,
                onPress: () => {
                  hapticSuccess();
                  const matCount = j.materials?.length ?? 0;
                  Alert.alert(
                    t('purchaseOrders.poCreated', 'PO Created'),
                    t('purchaseOrders.poCreatedDesc', {
                      defaultValue: 'PO created for "{{title}}" with {{count}} materials',
                      title: j.title,
                      count: matCount,
                    }),
                  );
                },
              })),
              { text: t('purchaseOrders.cancel', 'Cancel'), style: 'cancel' as const },
            ],
          );
        }}
        accessibilityLabel={t('purchaseOrders.newPO', 'New Purchase Order')}
      >
        <Ionicons name="add" size={28} color={Palette.white} />
      </Pressable>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm + 4,
    marginHorizontal: SafeArea.side, marginBottom: Spacing.sm,
    backgroundColor: Palette.hermesOrange + '08', borderRadius: RADIUS.lg, padding: 14,
  },
  aiBannerTitle: { fontSize: TYPE.captionSize + 1, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  aiBannerSub: { fontSize: TYPE.labelSize, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
  },
  backButton: { padding: 4 },
  searchMaterialsBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.hermesOrange + '10',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: { fontSize: TYPE.displaySize - 4, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: TYPE.captionSize + 1, color: SemanticColors.textSecondary, marginTop: 2 },
  statsBar: {
    flexDirection: 'row',
    marginHorizontal: SafeArea.side,
    backgroundColor: Palette.hermesOrange + '08',
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
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
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: 6,
  },
  orderAccent: { width: 3, alignSelf: 'stretch' },
  orderInfo: { flex: 1 },
  orderNumber: { fontSize: TYPE.captionSize + 1, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  orderSupplier: { fontSize: TYPE.labelSize, color: SemanticColors.textSecondary, marginTop: 1 },
  orderJob: { fontSize: TYPE.tinySize, color: SemanticColors.textTertiary, marginTop: 1 },
  orderRight: { alignItems: 'flex-end' },
  orderAmount: { fontSize: TYPE.captionSize + 1, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  orderStatus: { fontSize: TYPE.tinySize, fontFamily: 'Inter_600SemiBold', marginTop: 1 },
  expandedContent: {
    backgroundColor: SemanticColors.surfacePrimary,
    marginTop: -6,
    marginBottom: 6,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
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
  lineDesc: { flex: 1, fontSize: TYPE.labelSize, color: SemanticColors.textPrimary },
  lineQty: { fontSize: TYPE.labelSize, color: SemanticColors.textSecondary, marginHorizontal: Spacing.sm },
  lineTotal: { fontSize: TYPE.labelSize, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalsLabel: { fontSize: TYPE.labelSize, color: SemanticColors.textSecondary },
  totalsValue: { fontSize: TYPE.labelSize, color: SemanticColors.textPrimary },
  totalsFinal: { borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault, paddingTop: GRID.xs, marginTop: 2 },
  totalsFinalLabel: { fontSize: TYPE.captionSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  totalsFinalValue: { fontSize: TYPE.captionSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: GRID.xs },
  deliveryText: { fontSize: TYPE.labelSize, color: SemanticColors.textSecondary },
  actionButton: {
    alignItems: 'center',
    backgroundColor: Palette.hermesOrange + '10',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  actionButtonText: { fontSize: TYPE.captionSize, fontFamily: 'Archivo_700Bold', color: Palette.hermesOrange },
  fab: {
    position: 'absolute' as const,
    right: SafeArea.side,
    bottom: 110,
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
