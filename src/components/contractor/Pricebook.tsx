// Pricebook - Service catalog with Good-Better-Best pricing
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type { PricebookItem, PricebookVariant } from '../../types/contractor-features';
import { MOCK_PRICEBOOK } from '../../data/mockPricebook';

type IconName = keyof typeof Ionicons.glyphMap;

interface PricebookProps {
  onSelectItem?: (item: PricebookItem, variant?: PricebookVariant) => void;
  onClose?: () => void;
  mode?: 'browse' | 'select';
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: IconName; color: string }> = {
  preparation: { label: 'Preparation', icon: 'construct-outline', color: '#F59E0B' },
  painting: { label: 'Painting', icon: 'color-palette-outline', color: '#3B82F6' },
  repairs: { label: 'Repairs', icon: 'hammer-outline', color: '#EF4444' },
  finishing: { label: 'Finishing', icon: 'sparkles-outline', color: '#8B5CF6' },
  specialty: { label: 'Specialty', icon: 'star-outline', color: '#EC4899' },
  consultation: { label: 'Consultation', icon: 'chatbubbles-outline', color: '#10B981' },
};

export function Pricebook({ onSelectItem, onClose, mode = 'browse' }: PricebookProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const formatCurrency = (amount: number) => `€${amount.toFixed(2)}`;

  // Filter items
  const filteredItems = MOCK_PRICEBOOK.filter((item) => {
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory && item.isActive;
  });

  // Group by category
  const categories = [...new Set(MOCK_PRICEBOOK.map((i) => i.category))];

  const handleSelectVariant = (item: PricebookItem, variant: PricebookVariant) => {
    onSelectItem?.(item, variant);
  };

  const handleSelectBase = (item: PricebookItem) => {
    onSelectItem?.(item);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Pricebook</Text>
          <Text style={styles.headerSubtitle}>{MOCK_PRICEBOOK.length} services</Text>
        </View>
        <Pressable style={styles.addButton}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={SemanticColors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search services..."
          placeholderTextColor={SemanticColors.textTertiary}
        />
      </View>

      {/* Category Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryFilters}
      >
        <Pressable
          style={[styles.categoryPill, !selectedCategory && styles.categoryPillActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryPillText, !selectedCategory && styles.categoryPillTextActive]}>
            All
          </Text>
        </Pressable>
        {categories.map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          const isActive = selectedCategory === cat;
          return (
            <Pressable
              key={cat}
              style={[styles.categoryPill, isActive && { backgroundColor: config.color + '20', borderColor: config.color + '40' }]}
              onPress={() => setSelectedCategory(isActive ? null : cat)}
            >
              <Ionicons
                name={config.icon}
                size={14}
                color={isActive ? config.color : SemanticColors.textSecondary}
              />
              <Text style={[styles.categoryPillText, isActive && { color: config.color }]}>
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Items List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filteredItems.map((item) => {
          const categoryConfig = CATEGORY_CONFIG[item.category];
          const isExpanded = expandedItemId === item.id;

          return (
            <View key={item.id} style={styles.itemCard}>
              {/* Item Header */}
              <Pressable
                style={styles.itemHeader}
                onPress={() => setExpandedItemId(isExpanded ? null : item.id)}
              >
                <View style={[styles.itemIcon, { backgroundColor: categoryConfig.color + '15' }]}>
                  <Ionicons name={categoryConfig.icon} size={20} color={categoryConfig.color} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDescription} numberOfLines={1}>
                    {item.description}
                  </Text>
                </View>
                <View style={styles.itemPricing}>
                  <Text style={styles.itemPrice}>{formatCurrency(item.basePrice)}</Text>
                  <Text style={styles.itemUnit}>/{item.unit}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={SemanticColors.textTertiary}
                />
              </Pressable>

              {/* Expanded Content */}
              {isExpanded && (
                <View style={styles.itemExpanded}>
                  {/* Stats Row */}
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Margin</Text>
                      <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>
                        {item.margin}%
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Used</Text>
                      <Text style={styles.statValue}>{item.usageCount}x</Text>
                    </View>
                    {item.laborMinutes && (
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Time</Text>
                        <Text style={styles.statValue}>{item.laborMinutes}m</Text>
                      </View>
                    )}
                  </View>

                  {/* Variants (Good-Better-Best) */}
                  {item.variants && item.variants.length > 0 ? (
                    <View style={styles.variantsSection}>
                      <Text style={styles.variantsTitle}>Pricing Options</Text>
                      <View style={styles.variantsGrid}>
                        {item.variants.map((variant) => (
                          <Pressable
                            key={variant.id}
                            style={[
                              styles.variantCard,
                              variant.isRecommended && styles.variantCardRecommended,
                            ]}
                            onPress={() => mode === 'select' && handleSelectVariant(item, variant)}
                          >
                            {variant.isRecommended && (
                              <View style={styles.recommendedBadge}>
                                <Text style={styles.recommendedBadgeText}>POPULAR</Text>
                              </View>
                            )}
                            <Text style={styles.variantTier}>
                              {variant.tier.charAt(0).toUpperCase() + variant.tier.slice(1)}
                            </Text>
                            <Text style={styles.variantName}>{variant.name}</Text>
                            <Text style={styles.variantPrice}>
                              {formatCurrency(variant.price)}
                              <Text style={styles.variantUnit}>/{item.unit}</Text>
                            </Text>
                            <View style={styles.variantFeatures}>
                              {variant.features.slice(0, 3).map((feature, idx) => (
                                <View key={idx} style={styles.featureRow}>
                                  <Ionicons
                                    name="checkmark"
                                    size={12}
                                    color={SemanticColors.feedbackSuccess}
                                  />
                                  <Text style={styles.featureText} numberOfLines={1}>
                                    {feature}
                                  </Text>
                                </View>
                              ))}
                            </View>
                            {mode === 'select' && (
                              <Pressable
                                style={[
                                  styles.selectButton,
                                  variant.isRecommended && styles.selectButtonRecommended,
                                ]}
                                onPress={() => handleSelectVariant(item, variant)}
                              >
                                <Text
                                  style={[
                                    styles.selectButtonText,
                                    variant.isRecommended && styles.selectButtonTextRecommended,
                                  ]}
                                >
                                  Select
                                </Text>
                              </Pressable>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : (
                    mode === 'select' && (
                      <Pressable
                        style={styles.addToQuoteButton}
                        onPress={() => handleSelectBase(item)}
                      >
                        <Ionicons name="add-circle" size={18} color={SemanticColors.actionPrimary} />
                        <Text style={styles.addToQuoteText}>Add to Quote</Text>
                      </Pressable>
                    )
                  )}
                </View>
              )}
            </View>
          );
        })}

        {filteredItems.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyStateText}>No services found</Text>
          </View>
        )}
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
  backButton: {
    padding: Spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: SemanticColors.textPrimary,
    fontSize: 15,
  },
  categoryFilters: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  categoryPillActive: {
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderColor: SemanticColors.actionPrimary + '40',
  },
  categoryPillText: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: SemanticColors.actionPrimary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 100,
    gap: Spacing.sm,
  },
  itemCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: SemanticColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  itemDescription: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  itemPricing: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  itemUnit: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  itemExpanded: {
    padding: Spacing.md,
    paddingTop: 0,
    gap: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: SemanticColors.textTertiary,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  statValue: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  variantsSection: {
    gap: Spacing.sm,
  },
  variantsTitle: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  variantsGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  variantCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 4,
  },
  variantCardRecommended: {
    borderColor: SemanticColors.actionPrimary,
    backgroundColor: SemanticColors.actionPrimary + '08',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    left: -1,
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 2,
    alignItems: 'center',
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
  },
  recommendedBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  variantTier: {
    color: SemanticColors.textTertiary,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  variantName: {
    color: SemanticColors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  variantPrice: {
    color: SemanticColors.actionPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  variantUnit: {
    color: SemanticColors.textTertiary,
    fontSize: 10,
    fontWeight: '400',
  },
  variantFeatures: {
    gap: 2,
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    color: SemanticColors.textSecondary,
    fontSize: 10,
    flex: 1,
  },
  selectButton: {
    marginTop: 8,
    paddingVertical: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  selectButtonRecommended: {
    backgroundColor: SemanticColors.actionPrimary,
    borderColor: SemanticColors.actionPrimary,
  },
  selectButtonText: {
    color: SemanticColors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  selectButtonTextRecommended: {
    color: '#fff',
  },
  addToQuoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: 10,
  },
  addToQuoteText: {
    color: SemanticColors.actionPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    color: SemanticColors.textTertiary,
    fontSize: 14,
  },
});
