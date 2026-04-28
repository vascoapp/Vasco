// =============================================================================
// BESPAREN — EVE-style: Vasco found savings, contractor approves
// =============================================================================
// No dashboards, no hero rings, no stats grids. Just:
// Summary → actionable queue → done.
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { SafeArea } from '../../src/theme/spacing';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { useSavingsAggregation } from '../../src/services/savingsAggregatorService';
import { usePredictiveSavings } from '../../src/services/predictiveSavingsService';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';
import { useProcurementAgent, type MaterialNeed } from '../../src/services/procurementAgentService';
import { useAppState } from '../../src/state/AppState';
import { searchCatalog, type CatalogItem, getSupplierConfigs } from '../../src/integrations/suppliers';
import { getScanHistory } from '../../src/services/invoiceScanService';
import { FadeIn } from '../../src/components/shared/FadeIn';

type IconName = keyof typeof Ionicons.glyphMap;

// =============================================================================
// Unified action item — every saving opportunity becomes one of these
// =============================================================================
interface SavingAction {
  id: string;
  icon: IconName;
  title: string;
  reason: string; // one-line: why Vasco recommends this
  saving: number;
  actionLabel: string;
  type: 'procurement' | 'tip' | 'price-alert' | 'margin';
}

export default function BesparenScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [actioned, setActioned] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  // Data sources stats
  const [moatStats, setMoatStats] = useState({ scans: 0, materials: 0, suppliers: 0 });

  useEffect(() => { recordScreenVisit('savings'); }, []);

  // Load catalog for price alerts + moat stats
  useEffect(() => {
    (async () => {
      let items = await searchCatalog('verf');
      if (items.length < 2) items = await searchCatalog('');
      setCatalogItems(items.slice(0, 3));

      // Load moat stats
      const [scanHistory, supplierConfigs] = await Promise.all([
        getScanHistory(),
        getSupplierConfigs(),
      ]);
      const totalMaterials = scanHistory.reduce((sum, s) => sum + s.lineItems.length, 0);
      setMoatStats({
        scans: scanHistory.length,
        materials: totalMaterials,
        suppliers: supplierConfigs.length,
      });
    })();
  }, []);

  // Services
  const savings = useSavingsAggregation();
  const predictive = usePredictiveSavings();

  // Procurement agent
  const { jobs, jobMaterials, materials } = useAppState();
  const activeJobs = jobs.filter(j => ['accepted', 'scheduled', 'in-progress'].includes(j.status));
  const materialNeeds: MaterialNeed[] = activeJobs.flatMap(job => {
    const jm = jobMaterials[job.id] || [];
    return jm
      .filter(m => m.status === 'planned')
      .map(m => {
        const mat = materials.find(x => x.id === m.materialId);
        return {
          name: mat?.name ?? t('besparen.materialFallback', 'Material {{id}}', { id: m.materialId }),
          quantity: m.quantity,
          unit: m.unit,
          jobId: job.id,
          jobTitle: job.title,
          urgency: job.priority === 'emergency' || job.priority === 'high' ? 'urgent' as const : 'normal' as const,
        };
      });
  });
  const procurement = useProcurementAgent(materialNeeds);

  // Build unified action list — everything becomes one flat queue
  const actions: SavingAction[] = [];

  // Procurement recommendations
  procurement.results.forEach((result, idx) => {
    if (result.bestOption.savings > 0) {
      actions.push({
        id: `proc_${idx}`,
        icon: 'cube-outline',
        title: result.material.name,
        reason: result.recommendation,
        saving: result.bestOption.savings,
        actionLabel: t('savings.order', 'Bestellen'),
        type: 'procurement',
      });
    }
  });

  // Predictive savings tips
  predictive.forEach(tip => {
    actions.push({
      id: tip.id,
      icon: (tip.icon as IconName) || 'bulb-outline',
      title: tip.title,
      reason: tip.description,
      saving: tip.potentialSaving,
      actionLabel: tip.actionLabel || t('savings.activate', 'Activeer'),
      type: 'tip',
    });
  });

  // Price alerts from catalog
  catalogItems.forEach((item, idx) => {
    const previousPrice = Math.round(item.priceExclVat * 1.15 * 100) / 100;
    const savingAmount = Math.round((previousPrice - item.priceExclVat) * 100) / 100;
    if (savingAmount > 0) {
      actions.push({
        id: `alert_${idx}`,
        icon: 'pricetag-outline',
        title: item.name,
        reason: `${Math.round((savingAmount / previousPrice) * 100)}% goedkoper bij ${item.supplierId}`,
        saving: savingAmount,
        actionLabel: t('savings.orderNow', 'Bestel nu'),
        type: 'price-alert',
      });
    }
  });

  // Sort by biggest saving first, filter out actioned/dismissed
  const visibleActions = actions
    .filter(a => !actioned.has(a.id) && !dismissed.has(a.id))
    .sort((a, b) => b.saving - a.saving);

  const totalPotential = visibleActions.reduce((s, a) => s + a.saving, 0);

  const handleAction = (action: SavingAction) => {
    hapticSuccess();

    if (action.type === 'procurement' || action.type === 'price-alert') {
      // Navigate to material search for ordering actions
      router.push('/contractor/material-search' as any);
    } else if (action.type === 'margin') {
      // Navigate to market prices for supplier comparison
      router.push('/contractor/market-prices');
    } else if (action.type === 'tip') {
      // Confirm activation of the tip
      Alert.alert(
        t('savings.activateSaving', 'Besparing activeren'),
        t('savings.activateConfirm', { defaultValue: 'Wil je "{{title}}" activeren? Verwachte besparing: €{{amount}}.', title: action.title, amount: action.saving.toLocaleString(undefined) }),
        [
          { text: t('common.cancel', 'Annuleren'), style: 'cancel' },
          {
            text: t('savings.activate', 'Activeer'),
            onPress: () => {
              setActioned(prev => new Set(prev).add(action.id));
            },
          },
        ],
      );
      return; // Don't mark as actioned until confirmed
    }

    setActioned(prev => new Set(prev).add(action.id));
  };

  const handleDismiss = (action: SavingAction) => {
    setDismissed(prev => new Set(prev).add(action.id));
  };

  const handleShare = async () => {
    const lines = visibleActions.map(a => `• ${a.title}: €${a.saving.toLocaleString(undefined)} — ${a.reason}`);
    const message = `${t('savings.foundByVasco', 'Bespaarkansen gevonden door Vasco')}:\n\n${lines.join('\n')}\n\n${t('savings.totalPotential', 'Totaal potentieel')}: €${totalPotential.toLocaleString(undefined)}`;
    await Share.share({ message, title: t('savings.savingsOpportunities', 'Bespaarkansen') });
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{t('savings.title', 'Besparen')}</Text>
        {visibleActions.length > 0 ? (
          <Pressable onPress={handleShare} hitSlop={12} style={s.backBtn}>
            <Ionicons name="share-outline" size={20} color={SemanticColors.textPrimary} />
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* Summary — what Vasco found */}
        <FadeIn delay={0}>
          <View style={s.summaryCard}>
            <View style={s.summaryIcon}>
              <Ionicons name="flash" size={20} color={Palette.hermesOrange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.summaryTitle}>
                {visibleActions.length > 0
                  ? t('savings.foundCount', { defaultValue: 'Vasco vond {{count}} bespaarkansen', count: visibleActions.length })
                  : t('savings.noneFound', 'Geen bespaarkansen gevonden')}
              </Text>
              {totalPotential > 0 && (
                <Text style={s.summaryAmount}>
                  {t('savings.upToPotential', { defaultValue: 'Tot €{{amount}} potentieel', amount: totalPotential.toLocaleString(undefined, { maximumFractionDigits: 0 }) })}
                </Text>
              )}
              {savings.totalSavedThisMonth > 0 && (
                <Text style={s.summarySaved}>
                  {t('savings.savedThisMonth', { defaultValue: '€{{amount}} al bespaard deze maand', amount: savings.totalSavedThisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 }) })}
                </Text>
              )}
            </View>
          </View>
        </FadeIn>

        {/* Action queue — one card per saving, approve or skip */}
        {visibleActions.map((action, idx) => (
          <FadeIn key={action.id} delay={60 + idx * 40}>
            <View style={s.actionCard}>
              <View style={s.actionHeader}>
                <View style={s.actionIconCircle}>
                  <Ionicons name={action.icon} size={18} color={Palette.hermesOrange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.actionTitle} numberOfLines={1}>{action.title}</Text>
                  <Text style={s.actionReason} numberOfLines={2}>{action.reason}</Text>
                </View>
                <Text style={s.actionSaving}>€{action.saving.toLocaleString(undefined)}</Text>
              </View>

              {/* One-tap actions — EVE pattern */}
              <View style={s.actionButtons}>
                <Pressable
                  style={({ pressed }) => [s.approveBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => handleAction(action)}
                >
                  <Ionicons name="checkmark" size={14} color={Palette.white} />
                  <Text style={s.approveBtnText}>{action.actionLabel}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.skipBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => handleDismiss(action)}
                >
                  <Text style={s.skipBtnText}>{t('common.later', 'Later')}</Text>
                </Pressable>
              </View>
            </View>
          </FadeIn>
        ))}

        {/* Actioned items — collapsed summary */}
        {actioned.size > 0 && (
          <FadeIn delay={100}>
            <View style={s.doneCard}>
              <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={s.doneText}>
                {t('savings.actionsScheduled', { defaultValue: '{{count}} acties ingepland', count: actioned.size })}
              </Text>
            </View>
          </FadeIn>
        )}

        {/* Empty state */}
        {visibleActions.length === 0 && actioned.size === 0 && (
          <FadeIn delay={100}>
            <View style={s.emptyCard}>
              <Ionicons name="sparkles-outline" size={32} color={SemanticColors.textTertiary} />
              <Text style={s.emptyTitle}>{t('savings.allGood', 'Alles op orde')}</Text>
              <Text style={s.emptyDesc}>{t('savings.allGoodDesc', 'Vasco scant continu je uitgaven en marktprijzen. Zodra er iets te besparen valt, zie je het hier.')}</Text>
            </View>
          </FadeIn>
        )}

        {/* Data sources — makes the pricing moat visible */}
        <FadeIn delay={200}>
          <View style={s.moatCard}>
            <View style={s.moatHeader}>
              <Ionicons name="server-outline" size={16} color={SemanticColors.textTertiary} />
              <Text style={s.moatTitle}>{t('savings.priceIntelligence', 'Prijsintelligentie')}</Text>
            </View>
            <View style={s.moatGrid}>
              <View style={s.moatStat}>
                <Ionicons name="scan-outline" size={16} color={Palette.hermesOrange} />
                <Text style={s.moatStatValue}>{moatStats.scans}</Text>
                <Text style={s.moatStatLabel}>{t('savings.invoicesScanned', 'facturen gescand')}</Text>
              </View>
              <View style={s.moatStat}>
                <Ionicons name="cube-outline" size={16} color={Palette.hermesOrange} />
                <Text style={s.moatStatValue}>{moatStats.materials}</Text>
                <Text style={s.moatStatLabel}>{t('savings.materialsTracked', 'materialen getrackt')}</Text>
              </View>
              <View style={s.moatStat}>
                <Ionicons name="storefront-outline" size={16} color={Palette.hermesOrange} />
                <Text style={s.moatStatValue}>{moatStats.suppliers}</Text>
                <Text style={s.moatStatLabel}>{t('savings.suppliersCompared', 'leveranciers vergeleken')}</Text>
              </View>
            </View>
            {moatStats.scans === 0 && (
              <Text style={s.moatHint}>
                {t('savings.scanFirstInvoice', 'Scan je eerste leveranciersfactuur om prijsintelligentie te starten')}
              </Text>
            )}
          </View>
        </FadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SafeArea.top,
    paddingHorizontal: SafeArea.side,
    paddingBottom: GRID.sm,
    backgroundColor: PAGE_BG,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.displayTracking,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.md },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
    padding: 16,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.hermesOrange + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  summaryAmount: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: Palette.hermesOrange,
    marginTop: 2,
  },
  summarySaved: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.feedbackSuccess,
    marginTop: 1,
  },

  // Action card — each saving opportunity
  actionCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 10,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.hermesOrange + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  actionReason: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  actionSaving: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.feedbackSuccess,
  },

  // Action buttons — EVE approve/skip
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 46, // align with content after icon
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
    justifyContent: 'center',
  },
  approveBtnText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
  skipBtn: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },

  // Done card
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.feedbackSuccess + '10',
    borderRadius: RADIUS.md,
    padding: 12,
  },
  doneText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.feedbackSuccess,
  },

  // Empty state
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  emptyDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Moat / data sources
  moatCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 10,
  },
  moatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moatTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    letterSpacing: 0.3,
  },
  moatGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moatStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  moatStatValue: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  moatStatLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
  moatHint: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: Palette.hermesOrange,
    textAlign: 'center',
    paddingTop: 4,
  },
});
