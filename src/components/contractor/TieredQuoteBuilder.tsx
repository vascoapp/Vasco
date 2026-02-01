// Tiered Quote Builder - Good-Better-Best pricing presentation
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type { Customer } from '../../types/contractor';
import type { TieredQuote, QuoteTier, PricebookItem } from '../../types/contractor-features';
import { MOCK_PRICEBOOK } from '../../data/mockPricebook';
import { intelligence } from '../../intelligence/intelligenceEngine';

interface TieredQuoteBuilderProps {
  customer?: Customer;
  onSend: (quote: Partial<TieredQuote>) => void;
  onClose: () => void;
}

const TIER_CONFIG = {
  good: {
    name: 'Basic',
    tagline: 'Gets the job done',
    color: SemanticColors.textSecondary,
    icon: 'checkmark-circle-outline' as const,
  },
  better: {
    name: 'Standard',
    tagline: 'Most popular choice',
    color: SemanticColors.actionPrimary,
    icon: 'star-outline' as const,
  },
  best: {
    name: 'Premium',
    tagline: 'Best value & quality',
    color: '#8B5CF6',
    icon: 'diamond-outline' as const,
  },
};

export function TieredQuoteBuilder({ customer, onSend, onClose }: TieredQuoteBuilderProps) {
  const [selectedServices, setSelectedServices] = useState<{
    item: PricebookItem;
    quantity: number;
    unit: string;
  }[]>([]);
  const [showPricebook, setShowPricebook] = useState(false);

  const formatCurrency = (amount: number) => `€${amount.toFixed(2)}`;

  // Calculate tier prices based on selected services
  const calculateTiers = (): QuoteTier[] => {
    const tiers: QuoteTier[] = [];

    (['good', 'better', 'best'] as const).forEach((tierKey) => {
      let subtotal = 0;
      const features: string[] = [];
      const lineItems = selectedServices.map((service) => {
        const variant = service.item.variants?.find((v) => v.tier === tierKey);
        const price = variant ? variant.price : service.item.basePrice;
        const total = price * service.quantity;
        subtotal += total;

        if (variant) {
          variant.features.forEach((f) => {
            if (!features.includes(f)) features.push(f);
          });
        }

        return {
          pricebookItemId: service.item.id,
          description: variant ? `${service.item.name} - ${variant.name}` : service.item.name,
          quantity: service.quantity,
          unit: service.unit,
          unitPrice: price,
          total,
          includedInTier: true,
        };
      });

      const vatRate = 21;
      const vatAmount = subtotal * (vatRate / 100);

      tiers.push({
        tier: tierKey,
        name: TIER_CONFIG[tierKey].name,
        tagline: TIER_CONFIG[tierKey].tagline,
        lineItems,
        subtotal,
        vatRate,
        vatAmount,
        total: subtotal + vatAmount,
        features: features.slice(0, 5),
        isRecommended: tierKey === 'better',
      });
    });

    return tiers;
  };

  const tiers = calculateTiers();

  const addService = (item: PricebookItem) => {
    const existing = selectedServices.find((s) => s.item.id === item.id);
    if (existing) {
      setSelectedServices(
        selectedServices.map((s) =>
          s.item.id === item.id ? { ...s, quantity: s.quantity + 1 } : s
        )
      );
    } else {
      setSelectedServices([
        ...selectedServices,
        { item, quantity: 1, unit: item.unit || 'each' },
      ]);
    }
    setShowPricebook(false);
  };

  const removeService = (itemId: string) => {
    setSelectedServices(selectedServices.filter((s) => s.item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeService(itemId);
    } else {
      setSelectedServices(
        selectedServices.map((s) =>
          s.item.id === itemId ? { ...s, quantity } : s
        )
      );
    }
  };

  const handleSend = () => {
    if (selectedServices.length === 0) {
      Alert.alert('No Services', 'Please add at least one service to the quote.');
      return;
    }

    Alert.alert(
      'Send Quote',
      `Send this tiered quote to ${customer?.name || 'customer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            const quote: Partial<TieredQuote> = {
              reference: `TQ-${Date.now()}`,
              title: 'Project Quote',
              tiers,
              validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              paymentTerms: '30% deposit, 70% on completion',
              status: 'sent',
            };

            // Track quote sent for intelligence learning
            intelligence.trackEvent({
              eventType: 'quote_sent',
              userId: 'current-user',
              sessionId: 'current',
              context: {
                platform: 'ios',
                appVersion: '1.0.0',
                dayOfWeek: new Date().getDay(),
                hourOfDay: new Date().getHours(),
                isWeekend: new Date().getDay() === 0 || new Date().getDay() === 6,
                season: 'winter',
              },
              payload: {
                quoteReference: quote.reference,
                tierCount: 3,
                goodTotal: tiers[0].total,
                betterTotal: tiers[1].total,
                bestTotal: tiers[2].total,
                serviceCount: selectedServices.length,
                customerId: customer?.id,
              },
              entities: customer ? [{
                id: customer.id,
                type: 'customer',
                name: customer.name,
                confidence: 1.0,
              }] : [],
            });

            onSend(quote);
          },
        },
      ]
    );
  };

  if (showPricebook) {
    return (
      <PricebookSelector
        onSelect={addService}
        onClose={() => setShowPricebook(false)}
        selectedIds={selectedServices.map((s) => s.item.id)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Create Tiered Quote</Text>
          {customer && <Text style={styles.headerSubtitle}>{customer.name}</Text>}
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Selected Services */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Services</Text>
            <Pressable style={styles.addServiceBtn} onPress={() => setShowPricebook(true)}>
              <Ionicons name="add" size={18} color={SemanticColors.actionPrimary} />
              <Text style={styles.addServiceText}>Add from Pricebook</Text>
            </Pressable>
          </View>

          {selectedServices.length > 0 ? (
            <View style={styles.servicesList}>
              {selectedServices.map((service) => (
                <View key={service.item.id} style={styles.serviceRow}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.item.name}</Text>
                    <Text style={styles.serviceBase}>
                      Base: {formatCurrency(service.item.basePrice)}/{service.unit}
                    </Text>
                  </View>
                  <View style={styles.quantityControl}>
                    <Pressable
                      style={styles.quantityBtn}
                      onPress={() => updateQuantity(service.item.id, service.quantity - 1)}
                    >
                      <Ionicons name="remove" size={16} color={SemanticColors.textPrimary} />
                    </Pressable>
                    <Text style={styles.quantityText}>
                      {service.quantity} {service.unit}
                    </Text>
                    <Pressable
                      style={styles.quantityBtn}
                      onPress={() => updateQuantity(service.item.id, service.quantity + 1)}
                    >
                      <Ionicons name="add" size={16} color={SemanticColors.textPrimary} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Pressable style={styles.emptyServices} onPress={() => setShowPricebook(true)}>
              <Ionicons name="document-text-outline" size={32} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyServicesText}>Add services from your pricebook</Text>
            </Pressable>
          )}
        </View>

        {/* Tiered Preview */}
        {selectedServices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quote Preview</Text>
            <Text style={styles.sectionSubtitle}>
              Customer will see these three options
            </Text>

            <View style={styles.tiersPreview}>
              {tiers.map((tier) => {
                const config = TIER_CONFIG[tier.tier];
                return (
                  <View
                    key={tier.tier}
                    style={[
                      styles.tierCard,
                      tier.isRecommended && styles.tierCardRecommended,
                    ]}
                  >
                    {tier.isRecommended && (
                      <View style={styles.recommendedRibbon}>
                        <Text style={styles.recommendedRibbonText}>RECOMMENDED</Text>
                      </View>
                    )}

                    <View style={[styles.tierIcon, { backgroundColor: config.color + '15' }]}>
                      <Ionicons name={config.icon} size={24} color={config.color} />
                    </View>

                    <Text style={[styles.tierName, { color: config.color }]}>{tier.name}</Text>
                    <Text style={styles.tierTagline}>{tier.tagline}</Text>

                    <Text style={styles.tierPrice}>{formatCurrency(tier.total)}</Text>
                    <Text style={styles.tierPriceLabel}>incl. VAT</Text>

                    <View style={styles.tierFeatures}>
                      {tier.features.map((feature, idx) => (
                        <View key={idx} style={styles.tierFeatureRow}>
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={SemanticColors.feedbackSuccess}
                          />
                          <Text style={styles.tierFeatureText} numberOfLines={1}>
                            {feature}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {tier.tier === 'better' && (
                      <View style={styles.upsellNote}>
                        <Text style={styles.upsellNoteText}>
                          +{formatCurrency(tiers[2].total - tier.total)} for Premium
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Upsell Stats */}
            <View style={styles.upsellStats}>
              <Ionicons name="trending-up" size={16} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.upsellStatsText}>
                83% of your customers choose Better or Best options
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      {selectedServices.length > 0 && (
        <View style={styles.bottomActions}>
          <Pressable style={styles.previewButton}>
            <Ionicons name="eye-outline" size={20} color={SemanticColors.textPrimary} />
            <Text style={styles.previewButtonText}>Preview</Text>
          </Pressable>
          <Pressable style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.sendButtonText}>Send to Customer</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Simple Pricebook Selector
function PricebookSelector({
  onSelect,
  onClose,
  selectedIds,
}: {
  onSelect: (item: PricebookItem) => void;
  onClose: () => void;
  selectedIds: string[];
}) {
  const itemsWithVariants = MOCK_PRICEBOOK.filter((i) => i.variants && i.variants.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Select Service</Text>
          <Text style={styles.headerSubtitle}>Services with tiered pricing</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {itemsWithVariants.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <Pressable
              key={item.id}
              style={[styles.pricebookItem, isSelected && styles.pricebookItemSelected]}
              onPress={() => onSelect(item)}
            >
              <View style={styles.pricebookItemInfo}>
                <Text style={styles.pricebookItemName}>{item.name}</Text>
                <Text style={styles.pricebookItemDesc}>{item.description}</Text>
                <View style={styles.pricebookItemPrices}>
                  {item.variants?.map((v) => (
                    <Text key={v.id} style={styles.pricebookItemPrice}>
                      {v.tier}: €{v.price}/{item.unit}
                    </Text>
                  ))}
                </View>
              </View>
              {isSelected ? (
                <Ionicons name="checkmark-circle" size={24} color={SemanticColors.feedbackSuccess} />
              ) : (
                <Ionicons name="add-circle-outline" size={24} color={SemanticColors.actionPrimary} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
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
  closeButton: {
    padding: Spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 120,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  addServiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: 8,
  },
  addServiceText: {
    color: SemanticColors.actionPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  servicesList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  serviceBase: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'center',
  },
  emptyServices: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderStyle: 'dashed',
  },
  emptyServicesText: {
    color: SemanticColors.textTertiary,
    fontSize: 14,
  },
  tiersPreview: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tierCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
    gap: 6,
  },
  tierCardRecommended: {
    borderColor: SemanticColors.actionPrimary,
    borderWidth: 2,
  },
  recommendedRibbon: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 3,
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  recommendedRibbonText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  tierIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  tierName: {
    fontSize: 14,
    fontWeight: '700',
  },
  tierTagline: {
    color: SemanticColors.textTertiary,
    fontSize: 9,
    textAlign: 'center',
  },
  tierPrice: {
    color: SemanticColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  tierPriceLabel: {
    color: SemanticColors.textTertiary,
    fontSize: 9,
  },
  tierFeatures: {
    width: '100%',
    gap: 3,
    marginTop: 8,
  },
  tierFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tierFeatureText: {
    color: SemanticColors.textSecondary,
    fontSize: 9,
    flex: 1,
  },
  upsellNote: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
    width: '100%',
  },
  upsellNoteText: {
    color: SemanticColors.actionPrimary,
    fontSize: 9,
    textAlign: 'center',
    fontWeight: '500',
  },
  upsellStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    padding: Spacing.md,
    borderRadius: 10,
  },
  upsellStatsText: {
    color: SemanticColors.feedbackSuccess,
    fontSize: 12,
    flex: 1,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
  },
  previewButtonText: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  sendButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 12,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  pricebookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: Spacing.sm,
  },
  pricebookItemSelected: {
    borderColor: SemanticColors.feedbackSuccess,
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  pricebookItemInfo: {
    flex: 1,
    gap: 4,
  },
  pricebookItemName: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  pricebookItemDesc: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  pricebookItemPrices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pricebookItemPrice: {
    color: SemanticColors.textTertiary,
    fontSize: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
