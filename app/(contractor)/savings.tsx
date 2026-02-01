// =============================================================================
// SAVINGS - Smart Purchasing & Price Intelligence
// =============================================================================
// AI-powered material savings, price tracking, and purchase optimization
// This is where the pricing moat becomes visible value
// =============================================================================

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { SmartPurchasing } from '../../src/components/contractor/SmartPurchasing';
import { ReceiptScanner } from '../../src/components/contractor/ReceiptScanner';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MOCK DATA
// ============================================

interface PriceAlert {
  id: string;
  materialName: string;
  supplierName: string;
  type: 'price-drop' | 'bulk-opportunity' | 'sale-ending';
  currentPrice: number;
  previousPrice: number;
  savingsPercent: number;
  savingsAmount: number;
  expiresIn?: string;
  urgency: 'high' | 'medium' | 'low';
}

const MOCK_ALERTS: PriceAlert[] = [
  {
    id: 'alert_1',
    materialName: 'Dulux Trade Eggshell White 5L',
    supplierName: 'Bouwmaat',
    type: 'price-drop',
    currentPrice: 23.40,
    previousPrice: 28.50,
    savingsPercent: 18,
    savingsAmount: 5.10,
    expiresIn: '12h left',
    urgency: 'high',
  },
  {
    id: 'alert_2',
    materialName: 'Sigma S2U Allure Semi-Gloss 2.5L',
    supplierName: 'Verfwinkel',
    type: 'bulk-opportunity',
    currentPrice: 42.00,
    previousPrice: 45.00,
    savingsPercent: 7,
    savingsAmount: 3.00,
    urgency: 'medium',
  },
  {
    id: 'alert_3',
    materialName: 'Flexa Creations Chalk 1L',
    supplierName: 'Praxis',
    type: 'sale-ending',
    currentPrice: 18.95,
    previousPrice: 24.99,
    savingsPercent: 24,
    savingsAmount: 6.04,
    expiresIn: '2 days',
    urgency: 'medium',
  },
];

interface SavingsStats {
  savedThisMonth: number;
  savedThisYear: number;
  alertsActedOn: number;
  avgSavingsPercent: number;
}

const MOCK_STATS: SavingsStats = {
  savedThisMonth: 127,
  savedThisYear: 1840,
  alertsActedOn: 23,
  avgSavingsPercent: 12,
};

// ============================================
// COMPONENTS
// ============================================

function SavingsOverview({ stats }: { stats: SavingsStats }) {
  return (
    <View style={styles.overviewCard}>
      <View style={styles.overviewHeader}>
        <View style={styles.overviewIcon}>
          <Ionicons name="trending-down" size={28} color={SemanticColors.feedbackSuccess} />
        </View>
        <View style={styles.overviewContent}>
          <Text style={styles.overviewLabel}>You've Saved</Text>
          <Text style={styles.overviewValue}>€{stats.savedThisYear.toLocaleString()}</Text>
          <Text style={styles.overviewMeta}>this year with smart buying</Text>
        </View>
      </View>

      <View style={styles.overviewStats}>
        <View style={styles.overviewStat}>
          <Text style={styles.overviewStatValue}>€{stats.savedThisMonth}</Text>
          <Text style={styles.overviewStatLabel}>This month</Text>
        </View>
        <View style={styles.overviewStatDivider} />
        <View style={styles.overviewStat}>
          <Text style={styles.overviewStatValue}>{stats.avgSavingsPercent}%</Text>
          <Text style={styles.overviewStatLabel}>Avg. discount</Text>
        </View>
        <View style={styles.overviewStatDivider} />
        <View style={styles.overviewStat}>
          <Text style={styles.overviewStatValue}>{stats.alertsActedOn}</Text>
          <Text style={styles.overviewStatLabel}>Deals taken</Text>
        </View>
      </View>
    </View>
  );
}

function PriceAlertCard({ alert, onAction }: { alert: PriceAlert; onAction: () => void }) {
  const getAlertConfig = (type: PriceAlert['type']) => {
    switch (type) {
      case 'price-drop':
        return { label: 'Price Drop', icon: 'trending-down' as IconName, color: SemanticColors.feedbackSuccess };
      case 'bulk-opportunity':
        return { label: 'Bulk Deal', icon: 'layers' as IconName, color: Palette.terracotta };
      case 'sale-ending':
        return { label: 'Sale Ending', icon: 'time' as IconName, color: SemanticColors.feedbackWarning };
    }
  };

  const config = getAlertConfig(alert.type);

  return (
    <View style={[styles.alertCard, alert.urgency === 'high' && styles.alertCardUrgent]}>
      <View style={styles.alertHeader}>
        <View style={[styles.alertType, { backgroundColor: config.color + '15' }]}>
          <Ionicons name={config.icon} size={14} color={config.color} />
          <Text style={[styles.alertTypeText, { color: config.color }]}>{config.label}</Text>
        </View>
        {alert.expiresIn && (
          <View style={styles.alertExpiry}>
            <Ionicons name="time-outline" size={12} color={SemanticColors.feedbackWarning} />
            <Text style={styles.alertExpiryText}>{alert.expiresIn}</Text>
          </View>
        )}
      </View>

      <Text style={styles.alertMaterial}>{alert.materialName}</Text>
      <Text style={styles.alertSupplier}>{alert.supplierName}</Text>

      <View style={styles.alertPricing}>
        <View style={styles.alertPriceRow}>
          <Text style={styles.alertPriceLabel}>Now</Text>
          <Text style={styles.alertPriceCurrent}>€{alert.currentPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.alertPriceRow}>
          <Text style={styles.alertPriceLabel}>Was</Text>
          <Text style={styles.alertPriceOld}>€{alert.previousPrice.toFixed(2)}</Text>
        </View>
        <View style={[styles.alertSavings, { backgroundColor: SemanticColors.feedbackSuccessBg }]}>
          <Text style={styles.alertSavingsText}>
            Save €{alert.savingsAmount.toFixed(2)} ({alert.savingsPercent}%)
          </Text>
        </View>
      </View>

      <View style={styles.alertActions}>
        <Pressable style={styles.alertActionSecondary}>
          <Text style={styles.alertActionSecondaryText}>Compare</Text>
        </Pressable>
        <Pressable style={styles.alertActionPrimary} onPress={onAction}>
          <Ionicons name="cart" size={16} color="#fff" />
          <Text style={styles.alertActionPrimaryText}>Buy Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface QuickLinkItem {
  icon: IconName;
  label: string;
  route?: string;
  onPress?: () => void;
  highlight?: boolean;
}

function QuickLinks({ onScanReceipt }: { onScanReceipt: () => void }) {
  const router = useRouter();

  const links: QuickLinkItem[] = [
    { icon: 'camera' as IconName, label: 'Scan Receipt', onPress: onScanReceipt, highlight: true },
    { icon: 'pricetag' as IconName, label: 'Price Watch', route: '/contractor/purchasing' },
    { icon: 'receipt' as IconName, label: 'Past Purchases', route: '/contractor/purchasing' },
    { icon: 'bar-chart' as IconName, label: 'Spend Analysis', route: '/contractor/purchasing' },
    { icon: 'storefront' as IconName, label: 'Suppliers', route: '/contractor/purchasing' },
  ];

  return (
    <View style={styles.quickLinks}>
      {links.map((link) => (
        <Pressable
          key={link.label}
          style={[styles.quickLink, link.highlight && styles.quickLinkHighlight]}
          onPress={() => {
            if (link.onPress) {
              link.onPress();
            } else if (link.route) {
              router.push(link.route as any);
            }
          }}
        >
          <Ionicons
            name={link.icon}
            size={20}
            color={link.highlight ? '#fff' : Palette.hermesOrange}
          />
          <Text style={[styles.quickLinkLabel, link.highlight && styles.quickLinkLabelHighlight]}>
            {link.label}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={link.highlight ? 'rgba(255,255,255,0.7)' : SemanticColors.textTertiary}
          />
        </Pressable>
      ))}
    </View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function SavingsScreen() {
  const router = useRouter();
  const [showFullPurchasing, setShowFullPurchasing] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);

  const highPriorityAlerts = MOCK_ALERTS.filter(a => a.urgency === 'high');
  const otherAlerts = MOCK_ALERTS.filter(a => a.urgency !== 'high');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Savings</Text>
        <Pressable
          style={styles.expandButton}
          onPress={() => setShowFullPurchasing(true)}
        >
          <Text style={styles.expandButtonText}>Full View</Text>
          <Ionicons name="expand-outline" size={18} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Savings Overview */}
        <SavingsOverview stats={MOCK_STATS} />

        {/* AI Info */}
        <View style={styles.aiInfo}>
          <Ionicons name="sparkles" size={16} color={Palette.hermesOrange} />
          <Text style={styles.aiInfoText}>
            AI monitors 12 suppliers to find you the best prices
          </Text>
        </View>

        {/* High Priority Alerts */}
        {highPriorityAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Act Now</Text>
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>{highPriorityAlerts.length} urgent</Text>
              </View>
            </View>
            {highPriorityAlerts.map(alert => (
              <PriceAlertCard
                key={alert.id}
                alert={alert}
                onAction={() => console.log('Buy:', alert.materialName)}
              />
            ))}
          </View>
        )}

        {/* Other Alerts */}
        {otherAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>More Opportunities</Text>
            {otherAlerts.map(alert => (
              <PriceAlertCard
                key={alert.id}
                alert={alert}
                onAction={() => console.log('Buy:', alert.materialName)}
              />
            ))}
          </View>
        )}

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tools</Text>
          <QuickLinks onScanReceipt={() => setShowReceiptScanner(true)} />
        </View>

        {/* Learning Note */}
        <View style={styles.learningNote}>
          <Ionicons name="bulb-outline" size={16} color={SemanticColors.textTertiary} />
          <Text style={styles.learningNoteText}>
            The more you buy, the better our recommendations get
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Full Purchasing Modal */}
      <Modal
        visible={showFullPurchasing}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SmartPurchasing onClose={() => setShowFullPurchasing(false)} />
      </Modal>

      {/* Receipt Scanner Modal */}
      <Modal
        visible={showReceiptScanner}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <ReceiptScanner onClose={() => setShowReceiptScanner(false)} />
      </Modal>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },

  // Overview
  overviewCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccessBorder,
  },
  overviewHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  overviewIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewContent: {
    flex: 1,
  },
  overviewLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  overviewValue: {
    fontSize: 32,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  overviewMeta: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  overviewStats: {
    flexDirection: 'row',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  overviewStat: {
    flex: 1,
    alignItems: 'center',
  },
  overviewStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  overviewStatLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  overviewStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
  },

  // AI Info
  aiInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.pastelOrange + '30',
    padding: Spacing.md,
    borderRadius: 10,
  },
  aiInfoText: {
    flex: 1,
    fontSize: 13,
    color: Palette.hermesOrange,
    fontWeight: '500',
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urgentBadge: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  urgentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },

  // Alert Card
  alertCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  alertCardUrgent: {
    borderColor: SemanticColors.feedbackSuccessBorder,
    backgroundColor: SemanticColors.feedbackSuccessBg + '30',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alertTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  alertExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertExpiryText: {
    fontSize: 11,
    color: SemanticColors.feedbackWarning,
    fontWeight: '500',
  },
  alertMaterial: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  alertSupplier: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  alertPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    padding: Spacing.sm,
    borderRadius: 8,
  },
  alertPriceRow: {
    alignItems: 'center',
  },
  alertPriceLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  alertPriceCurrent: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  alertPriceOld: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
    textDecorationLine: 'line-through',
  },
  alertSavings: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  alertSavingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  alertActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  alertActionSecondary: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
  },
  alertActionSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  alertActionPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 8,
  },
  alertActionPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Quick Links
  quickLinks: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  quickLinkLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  quickLinkHighlight: {
    backgroundColor: Palette.hermesOrange,
    borderBottomWidth: 0,
  },
  quickLinkLabelHighlight: {
    color: '#fff',
    fontWeight: '600',
  },

  // Learning Note
  learningNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  learningNoteText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
});
