// Smart Purchasing - AI-powered material buying intelligence
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import type { SmartPurchaseAlert, MaterialCatalogItem, UpcomingMaterialNeed } from '../../types/contractor-features';
import { MOCK_PURCHASE_ALERTS, MOCK_MATERIALS, MOCK_UPCOMING_NEEDS, MOCK_SUPPLIERS } from '../../data/mockPricebook';
import { intelligence } from '../../intelligence/intelligenceEngine';
import { RecommendationFeedbackList } from './RecommendationFeedback';
import { getCurrentUserId } from '../../lib/currentUser';
import { useRecommendationFeedback } from '../../hooks/useRecommendationFeedback';
import { useTranslation } from 'react-i18next';
// Helper to create context for intelligence tracking
const createTrackingContext = () => ({
  platform: 'ios' as const,
  appVersion: '1.0.0',
  dayOfWeek: new Date().getDay(),
  hourOfDay: new Date().getHours(),
  isWeekend: new Date().getDay() === 0 || new Date().getDay() === 6,
  season: 'winter' as const,
});

type IconName = keyof typeof Ionicons.glyphMap;

interface SmartPurchasingProps {
  onClose?: () => void;
}

export function SmartPurchasing({ onClose }: SmartPurchasingProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'alerts' | 'upcoming' | 'prices' | 'tips'>('alerts');

  // Recommendation feedback hook for AI tips
  const {
    recommendations,
    acceptRecommendation,
    rejectRecommendation,
    dismissRecommendation,
  } = useRecommendationFeedback({ source: 'pricing' });

  // formatCurrency imported from ../../i18n/formatting

  const unreadAlerts = MOCK_PURCHASE_ALERTS.filter((a) => !a.isRead && !a.isDismissed);
  const totalSavings = MOCK_PURCHASE_ALERTS.reduce((sum, a) => sum + (a.savingsAmount || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Smart Purchasing</Text>
          <Text style={styles.headerSubtitle}>AI-powered savings</Text>
        </View>
        <View style={styles.savingsBadge}>
          <Ionicons name="trending-down" size={14} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.savingsBadgeText}>{formatCurrency(totalSavings)}</Text>
        </View>
      </View>

      {/* Savings Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryMain}>
          <View style={styles.summaryIcon}>
            <Ionicons name="bulb" size={28} color={SemanticColors.actionPrimary} />
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Potential Savings Found</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalSavings)}</Text>
            <Text style={styles.summarySubtext}>
              {unreadAlerts.length} opportunities available
            </Text>
          </View>
        </View>
        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{formatCurrency(127)}</Text>
            <Text style={styles.summaryStatLabel}>Saved this month</Text>
          </View>
          <View style={styles.summaryStatDivider} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>12%</Text>
            <Text style={styles.summaryStatLabel}>Avg. discount</Text>
          </View>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { id: 'alerts', label: 'Alerts', badge: unreadAlerts.length },
          { id: 'tips', label: 'AI Tips', badge: recommendations.length },
          { id: 'upcoming', label: 'Upcoming', badge: MOCK_UPCOMING_NEEDS.length },
          { id: 'prices', label: 'Prices', badge: 0 },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.id && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.id && styles.tabBadgeTextActive]}>
                  {tab.badge}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'alerts' && <AlertsTab alerts={MOCK_PURCHASE_ALERTS} formatCurrency={formatCurrency} />}
        {activeTab === 'tips' && (
          <View style={styles.tabContent}>
            <RecommendationFeedbackList
              recommendations={recommendations}
              onAccept={acceptRecommendation}
              onReject={rejectRecommendation}
              onDismiss={dismissRecommendation}
              emptyMessage={t('purchasing.noAITips', 'No AI tips right now')}
            />
          </View>
        )}
        {activeTab === 'upcoming' && <UpcomingTab needs={MOCK_UPCOMING_NEEDS} formatCurrency={formatCurrency} />}
        {activeTab === 'prices' && <PriceWatchTab materials={MOCK_MATERIALS} formatCurrency={formatCurrency} />}
      </ScrollView>
    </View>
  );
}

// Alerts Tab
function AlertsTab({
  alerts,
  formatCurrency,
}: {
  alerts: SmartPurchaseAlert[];
  formatCurrency: (n: number) => string;
}) {
  const getAlertIcon = (type: SmartPurchaseAlert['type']): IconName => {
    switch (type) {
      case 'price-drop': return 'trending-down';
      case 'bulk-opportunity': return 'layers';
      case 'stock-low': return 'warning';
      case 'sale-ending': return 'time';
      case 'reorder-reminder': return 'refresh';
      default: return 'notifications';
    }
  };

  const getAlertColor = (type: SmartPurchaseAlert['type']): string => {
    switch (type) {
      case 'price-drop': return SemanticColors.feedbackSuccess;
      case 'bulk-opportunity': return '#8B5CF6';
      case 'stock-low': return SemanticColors.feedbackWarning;
      case 'sale-ending': return SemanticColors.feedbackError;
      case 'reorder-reminder': return SemanticColors.feedbackInfo;
      default: return SemanticColors.textSecondary;
    }
  };

  const activeAlerts = alerts.filter((a) => !a.isDismissed);

  return (
    <View style={styles.tabContent}>
      {activeAlerts.map((alert) => {
        const color = getAlertColor(alert.type);
        return (
          <Pressable key={alert.id} style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={[styles.alertIcon, { backgroundColor: color + '15' }]}>
                <Ionicons name={getAlertIcon(alert.type)} size={20} color={color} />
              </View>
              <View style={styles.alertInfo}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertMaterial}>{alert.materialName}</Text>
              </View>
              {alert.savingsAmount && (
                <View style={styles.savingsTag}>
                  <Text style={styles.savingsTagText}>
                    Save {formatCurrency(alert.savingsAmount)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.alertMessage}>{alert.message}</Text>
            {alert.supplierName && (
              <View style={styles.alertSupplier}>
                <Ionicons name="storefront-outline" size={14} color={SemanticColors.textTertiary} />
                <Text style={styles.alertSupplierText}>{alert.supplierName}</Text>
              </View>
            )}
            {alert.expiresAt && (
              <View style={styles.alertExpiry}>
                <Ionicons name="time-outline" size={12} color={SemanticColors.feedbackWarning} />
                <Text style={styles.alertExpiryText}>
                  Expires {new Date(alert.expiresAt).toLocaleDateString(undefined)}
                </Text>
              </View>
            )}
            <View style={styles.alertActions}>
              <Pressable
                style={styles.alertActionPrimary}
                onPress={() => {
                  // Track material action for intelligence
                  intelligence.trackEvent({
                    eventType: 'material_price_checked',
                    userId: getCurrentUserId(),
                    sessionId: 'current',
                    context: createTrackingContext(),
                    payload: {
                      alertId: alert.id,
                      alertType: alert.type,
                      materialId: alert.materialId,
                      materialName: alert.materialName,
                      supplierId: alert.supplierId,
                      supplierName: alert.supplierName,
                      savingsAmount: alert.savingsAmount,
                      savingsPercent: alert.savingsPercent,
                      action: 'accepted',
                    },
                    entities: [
                      { id: alert.materialId, type: 'material', name: alert.materialName, confidence: 1.0 },
                    ],
                  });
                  Alert.alert('Action', `Taking action on: ${alert.title}`);
                }}
              >
                <Text style={styles.alertActionPrimaryText}>{alert.actionLabel}</Text>
              </Pressable>
              <Pressable
                style={styles.alertActionSecondary}
                onPress={() => {
                  // Track dismissal for learning what's not relevant
                  intelligence.trackEvent({
                    eventType: 'ai_recommendation_rejected',
                    userId: getCurrentUserId(),
                    sessionId: 'current',
                    context: createTrackingContext(),
                    payload: {
                      alertId: alert.id,
                      alertType: alert.type,
                      materialName: alert.materialName,
                      reason: 'dismissed',
                    },
                    entities: [],
                  });
                }}
              >
                <Text style={styles.alertActionSecondaryText}>Dismiss</Text>
              </Pressable>
            </View>
          </Pressable>
        );
      })}

      {activeAlerts.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.emptyStateTitle}>All caught up!</Text>
          <Text style={styles.emptyStateText}>No purchasing alerts right now</Text>
        </View>
      )}
    </View>
  );
}

// Upcoming Needs Tab
function UpcomingTab({
  needs,
  formatCurrency,
}: {
  needs: UpcomingMaterialNeed[];
  formatCurrency: (n: number) => string;
}) {
  return (
    <View style={styles.tabContent}>
      <View style={styles.infoCard}>
        <Ionicons name="calendar" size={18} color={SemanticColors.feedbackInfo} />
        <Text style={styles.infoText}>
          Based on your scheduled jobs, here's what you'll need to purchase
        </Text>
      </View>

      {needs.map((need) => (
        <View key={need.materialId} style={styles.needCard}>
          <View style={styles.needHeader}>
            <Text style={styles.needMaterial}>{need.materialName}</Text>
            {need.recommendation.action === 'buy-now' && (
              <View style={styles.buyNowTag}>
                <Ionicons name="flash" size={12} color="#fff" />
                <Text style={styles.buyNowTagText}>Buy Now</Text>
              </View>
            )}
          </View>

          <View style={styles.needStats}>
            <View style={styles.needStat}>
              <Text style={styles.needStatLabel}>Need</Text>
              <Text style={styles.needStatValue}>{need.totalNeeded} {need.unit}</Text>
            </View>
            <View style={styles.needStat}>
              <Text style={styles.needStatLabel}>In Stock</Text>
              <Text style={styles.needStatValue}>{need.currentStock} {need.unit}</Text>
            </View>
            <View style={styles.needStat}>
              <Text style={styles.needStatLabel}>To Buy</Text>
              <Text style={[styles.needStatValue, { color: SemanticColors.feedbackWarning }]}>
                {need.needToPurchase} {need.unit}
              </Text>
            </View>
          </View>

          <View style={styles.needJobs}>
            <Text style={styles.needJobsLabel}>For jobs:</Text>
            {need.jobs.map((job) => (
              <View key={job.jobId} style={styles.needJobRow}>
                <Text style={styles.needJobTitle}>{job.jobTitle}</Text>
                <Text style={styles.needJobQty}>{job.quantityNeeded} {need.unit}</Text>
              </View>
            ))}
          </View>

          {need.recommendation.potentialSavings && (
            <View style={styles.needSavings}>
              <Ionicons name="bulb" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.needSavingsText}>
                {need.recommendation.reason} - Save {formatCurrency(need.recommendation.potentialSavings)}
              </Text>
            </View>
          )}

          <Pressable
            style={styles.needAction}
            onPress={() => {
              // Track material added to shopping list
              intelligence.trackEvent({
                eventType: 'material_purchased',
                userId: getCurrentUserId(),
                sessionId: 'current',
                context: createTrackingContext(),
                payload: {
                  materialId: need.materialId,
                  materialName: need.materialName,
                  quantity: need.needToPurchase,
                  unit: need.unit,
                  recommendation: need.recommendation,
                  relatedJobs: need.jobs.map(j => j.jobId),
                  action: 'added_to_list',
                },
                entities: [
                  { id: need.materialId, type: 'material', name: need.materialName, confidence: 1.0 },
                ],
              });
              Alert.alert('Added', `${need.materialName} added to shopping list`);
            }}
          >
            <Ionicons name="cart" size={18} color="#fff" />
            <Text style={styles.needActionText}>Add to Shopping List</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// Price Watch Tab
function PriceWatchTab({
  materials,
  formatCurrency,
}: {
  materials: MaterialCatalogItem[];
  formatCurrency: (n: number) => string;
}) {
  const getTrendIcon = (trend: MaterialCatalogItem['pricetrend']): IconName => {
    switch (trend) {
      case 'rising': return 'trending-up';
      case 'falling': return 'trending-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend: MaterialCatalogItem['pricetrend']): string => {
    switch (trend) {
      case 'rising': return SemanticColors.feedbackError;
      case 'falling': return SemanticColors.feedbackSuccess;
      default: return SemanticColors.textSecondary;
    }
  };

  return (
    <View style={styles.tabContent}>
      {materials.map((material) => {
        const lowestPrice = material.prices.reduce(
          (min, p) => (p.salePrice || p.price) < min ? (p.salePrice || p.price) : min,
          Infinity
        );
        const lowestPriceSupplier = material.prices.find(
          (p) => (p.salePrice || p.price) === lowestPrice
        );
        const supplier = MOCK_SUPPLIERS.find((s) => s.id === lowestPriceSupplier?.supplierId);

        return (
          <Pressable key={material.id} style={styles.priceCard}>
            <View style={styles.priceHeader}>
              <View style={styles.priceInfo}>
                <Text style={styles.priceMaterial}>{material.name}</Text>
                <Text style={styles.priceBrand}>{material.brand}</Text>
              </View>
              <View style={styles.priceTrend}>
                <Ionicons
                  name={getTrendIcon(material.pricetrend)}
                  size={16}
                  color={getTrendColor(material.pricetrend)}
                />
                <Text style={[styles.priceTrendText, { color: getTrendColor(material.pricetrend) }]}>
                  {material.pricetrend}
                </Text>
              </View>
            </View>

            <View style={styles.priceComparison}>
              <View style={styles.priceCol}>
                <Text style={styles.priceLabel}>Best Price</Text>
                <Text style={styles.priceValue}>{formatCurrency(lowestPrice)}</Text>
                <Text style={styles.priceSupplier}>{supplier?.name}</Text>
              </View>
              <View style={styles.priceCol}>
                <Text style={styles.priceLabel}>Average</Text>
                <Text style={styles.priceValueMuted}>
                  {formatCurrency(material.averagePrice || 0)}
                </Text>
              </View>
              <View style={styles.priceCol}>
                <Text style={styles.priceLabel}>You Save</Text>
                <Text style={[styles.priceValue, { color: SemanticColors.feedbackSuccess }]}>
                  {formatCurrency((material.averagePrice || 0) - lowestPrice)}
                </Text>
              </View>
            </View>

            {material.buyRecommendation && (
              <View style={[
                styles.recommendation,
                material.buyRecommendation.action === 'buy-now' && styles.recommendationBuyNow,
              ]}>
                <Ionicons
                  name={material.buyRecommendation.action === 'buy-now' ? 'flash' : 'information-circle'}
                  size={14}
                  color={material.buyRecommendation.action === 'buy-now'
                    ? SemanticColors.feedbackSuccess
                    : SemanticColors.feedbackInfo
                  }
                />
                <Text style={styles.recommendationText}>
                  {material.buyRecommendation.reason}
                </Text>
              </View>
            )}

            <View style={styles.priceActions}>
              <Pressable style={styles.comparePricesBtn}>
                <Text style={styles.comparePricesBtnText}>Compare {material.prices.length} suppliers</Text>
              </Pressable>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  headerSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  savingsBadgeText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.sectionFamily,
  },
  summaryCard: {
    margin: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  summaryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.actionPrimary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  summaryValue: {
    color: SemanticColors.feedbackSuccess,
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.sectionFamily,
  },
  summarySubtext: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
  },
  summaryStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.sm,
  },
  summaryStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderMuted,
  },
  summaryStatValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  summaryStatLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize - 1,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },
  tabActive: {
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  tabTextActive: {
    color: SemanticColors.textPrimary,
    fontFamily: TYPE.titleFamily,
  },
  tabBadge: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  tabBadgeText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  tabBadgeTextActive: {
    color: Palette.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  tabContent: {
    gap: Spacing.sm,
  },
  alertCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  alertMaterial: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  savingsTag: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsTagText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  alertMessage: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    lineHeight: 18,
  },
  alertSupplier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertSupplierText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
  },
  alertExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertExpiryText: {
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.tinySize,
  },
  alertActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  alertActionPrimary: {
    flex: 2,
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  alertActionPrimaryText: {
    color: Palette.white,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
  alertActionSecondary: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  alertActionSecondaryText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
  },
  emptyStateText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.bodySize - 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.feedbackInfoBg,
    padding: Spacing.md,
    borderRadius: RADIUS.md,
  },
  infoText: {
    flex: 1,
    color: SemanticColors.feedbackInfo,
    fontSize: TYPE.captionSize,
  },
  needCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  needHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  needMaterial: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    flex: 1,
  },
  buyNowTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccess,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  buyNowTagText: {
    color: Palette.white,
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.sectionFamily,
  },
  needStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
  },
  needStat: {
    flex: 1,
    alignItems: 'center',
  },
  needStatLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize - 1,
  },
  needStatValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  needJobs: {
    gap: 4,
  },
  needJobsLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
  },
  needJobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  needJobTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  needJobQty: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
  },
  needSavings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    padding: Spacing.sm,
    borderRadius: RADIUS.sm,
  },
  needSavingsText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: TYPE.labelSize,
    flex: 1,
  },
  needAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
  },
  needActionText: {
    color: Palette.white,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  priceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priceInfo: {
    flex: 1,
  },
  priceMaterial: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  priceBrand: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  priceTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceTrendText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    textTransform: 'capitalize',
  },
  priceComparison: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
  },
  priceCol: {
    flex: 1,
    alignItems: 'center',
  },
  priceLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize - 1,
  },
  priceValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
  },
  priceValueMuted: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.titleSize,
  },
  priceSupplier: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize - 1,
  },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.feedbackInfoBg,
    padding: Spacing.sm,
    borderRadius: RADIUS.sm,
  },
  recommendationBuyNow: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  recommendationText: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    flex: 1,
  },
  priceActions: {
    marginTop: 4,
  },
  comparePricesBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
  },
  comparePricesBtnText: {
    color: SemanticColors.actionPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
});
