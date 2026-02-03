// =============================================================================
// BESPAREN - Contractor Savings & Cost Management Hub
// =============================================================================
// Professional hub for savings tools and price intelligence
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
// TYPES & DATA
// ============================================

interface PriceAlert {
  id: string;
  materialName: string;
  supplierName: string;
  type: 'price-drop' | 'bulk-opportunity' | 'sale-ending';
  currentPrice: number;
  previousPrice: number;
  savingsPercent: number;
  expiresIn?: string;
}

const MOCK_ALERTS: PriceAlert[] = [
  {
    id: 'alert_1',
    materialName: 'Dulux Trade Eggshell 5L',
    supplierName: 'Bouwmaat',
    type: 'price-drop',
    currentPrice: 23.40,
    previousPrice: 28.50,
    savingsPercent: 18,
    expiresIn: '12u',
  },
  {
    id: 'alert_2',
    materialName: 'Sigma S2U Allure 2.5L',
    supplierName: 'Verfwinkel',
    type: 'bulk-opportunity',
    currentPrice: 42.00,
    previousPrice: 45.00,
    savingsPercent: 7,
  },
];

interface ToolItem {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  route?: string;
  onPress?: () => void;
  color: string;
  stat?: string;
}

// ============================================
// MAIN SCREEN
// ============================================

export default function BesparenScreen() {
  const router = useRouter();
  const [showFullPurchasing, setShowFullPurchasing] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);

  const savingsTools: ToolItem[] = [
    {
      id: 'scan',
      icon: 'camera',
      title: 'Bon Scanner',
      description: 'Scan bonnen voor administratie',
      onPress: () => setShowReceiptScanner(true),
      color: SemanticColors.feedbackSuccess,
    },
    {
      id: 'pricewatch',
      icon: 'pricetag',
      title: 'Prijswacht',
      description: 'AI monitort 12 leveranciers',
      route: '/contractor/purchasing',
      color: Palette.hermesOrange,
      stat: '3 alerts',
    },
    {
      id: 'purchases',
      icon: 'receipt',
      title: 'Aankopen',
      description: 'Aankoopgeschiedenis',
      route: '/contractor/purchasing',
      color: '#8B5CF6',
    },
    {
      id: 'spend',
      icon: 'pie-chart',
      title: 'Uitgaven Analyse',
      description: 'Inzicht in je kosten',
      route: '/contractor/purchasing',
      color: Palette.terracotta,
    },
    {
      id: 'suppliers',
      icon: 'storefront',
      title: 'Leveranciers',
      description: 'Beheer leveranciers',
      route: '/contractor/purchasing',
      color: SemanticColors.feedbackInfo,
    },
  ];


  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Besparen</Text>
        <Pressable
          style={styles.headerButton}
          onPress={() => setShowFullPurchasing(true)}
        >
          <Ionicons name="analytics" size={20} color={SemanticColors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Savings Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.heroIconContainer}>
              <Ionicons name="trending-down" size={28} color={SemanticColors.feedbackSuccess} />
            </View>
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroLabel}>Bespaard dit jaar</Text>
            <Text style={styles.heroValue}>€1.840</Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>€127</Text>
                <Text style={styles.heroStatLabel}>deze maand</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>12%</Text>
                <Text style={styles.heroStatLabel}>gem. korting</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>23</Text>
                <Text style={styles.heroStatLabel}>deals</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Active Price Alerts */}
        {MOCK_ALERTS.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Prijsalerts</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{MOCK_ALERTS.length} actief</Text>
              </View>
            </View>
            <View style={styles.alertsList}>
              {MOCK_ALERTS.map((alert, index) => (
                <Pressable
                  key={alert.id}
                  style={[
                    styles.alertItem,
                    index < MOCK_ALERTS.length - 1 && styles.alertItemBorder
                  ]}
                >
                  <View style={styles.alertContent}>
                    <View style={styles.alertTop}>
                      <Text style={styles.alertMaterial} numberOfLines={1}>{alert.materialName}</Text>
                      <View style={styles.alertSavings}>
                        <Ionicons name="arrow-down" size={12} color={SemanticColors.feedbackSuccess} />
                        <Text style={styles.alertSavingsText}>{alert.savingsPercent}%</Text>
                      </View>
                    </View>
                    <Text style={styles.alertSupplier}>{alert.supplierName}</Text>
                    <View style={styles.alertPrices}>
                      <Text style={styles.alertCurrentPrice}>€{alert.currentPrice.toFixed(2)}</Text>
                      <Text style={styles.alertOldPrice}>€{alert.previousPrice.toFixed(2)}</Text>
                      {alert.expiresIn && (
                        <View style={styles.alertExpiry}>
                          <Ionicons name="time-outline" size={10} color={SemanticColors.feedbackWarning} />
                          <Text style={styles.alertExpiryText}>{alert.expiresIn}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Pressable style={styles.alertBuyButton}>
                    <Ionicons name="cart" size={16} color="#fff" />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Savings Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inkoop & Kosten</Text>
          <View style={styles.toolsList}>
            {savingsTools.map((tool, index) => (
              <Pressable
                key={tool.id}
                style={[
                  styles.toolRow,
                  index === savingsTools.length - 1 && styles.toolRowLast
                ]}
                onPress={() => {
                  if (tool.onPress) tool.onPress();
                  else if (tool.route) router.push(tool.route as any);
                }}
              >
                <View style={[styles.toolIcon, { backgroundColor: tool.color + '15' }]}>
                  <Ionicons name={tool.icon} size={22} color={tool.color} />
                </View>
                <View style={styles.toolContent}>
                  <Text style={styles.toolTitle}>{tool.title}</Text>
                  <Text style={styles.toolDesc}>{tool.description}</Text>
                </View>
                {tool.stat && (
                  <Text style={[styles.toolStat, { color: tool.color }]}>{tool.stat}</Text>
                )}
                <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* AI Note */}
        <View style={styles.aiNote}>
          <Ionicons name="sparkles" size={14} color={Palette.hermesOrange} />
          <Text style={styles.aiNoteText}>
            AI leert van je aankopen voor betere aanbevelingen
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
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },

  // Hero Card
  heroCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccessBorder,
    gap: Spacing.md,
  },
  heroLeft: {
    justifyContent: 'flex-start',
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  heroValue: {
    fontSize: 32,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
    marginTop: 2,
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  heroStat: {
    flex: 1,
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  heroStatLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.sm,
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertBadge: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },

  // Alerts List
  alertsList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  alertItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  alertContent: {
    flex: 1,
  },
  alertTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertMaterial: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  alertSavings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  alertSavingsText: {
    fontSize: 12,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  alertSupplier: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  alertPrices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  alertCurrentPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  alertOldPrice: {
    fontSize: 13,
    color: SemanticColors.textTertiary,
    textDecorationLine: 'line-through',
  },
  alertExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
  },
  alertExpiryText: {
    fontSize: 11,
    color: SemanticColors.feedbackWarning,
    fontWeight: '500',
  },
  alertBuyButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tools List
  toolsList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  toolRowLast: {
    borderBottomWidth: 0,
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolContent: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  toolDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  toolStat: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },

  // AI Note
  aiNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  aiNoteText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
});
