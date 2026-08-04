// =============================================================================
// PRICEBOOK — the contractor's own service catalogue
// =============================================================================
// Until now this screen rendered MOCK_PRICEBOOK: twelve invented painting
// services belonging to "contractor-001", shown to every real contractor as
// their own price list, above an add button with no handler. It now reads and
// writes the real catalogue (pricebookService, AsyncStorage).
//
// Margin is shown only when the contractor has entered what the work costs
// them. When they have not, the row is absent rather than showing a plausible
// number — see the design notes in pricebookService.
// =============================================================================
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import { useAuth } from '../../context/AuthContext';
import {
  usePricebook,
  searchEntries,
  categoriesInUse,
  marginOf,
  costOf,
  type PricebookEntry,
  type PricebookVariantEntry,
  type PricebookCategory,
} from '../../services/pricebookService';
import { useTranslation } from 'react-i18next';
type IconName = keyof typeof Ionicons.glyphMap;

interface PricebookProps {
  onSelectItem?: (item: PricebookEntry, variant?: PricebookVariantEntry) => void;
  onClose?: () => void;
  /** Opens the editor. Undefined hides the add/edit affordances entirely. */
  onEditItem?: (id: string) => void;
  onCreateItem?: () => void;
  mode?: 'browse' | 'select';
}

const CATEGORY_CONFIG: Record<PricebookCategory, { label: string; icon: IconName; color: string }> = {
  // legacy, painting-shop categories
  preparation: { label: 'Preparation', icon: 'construct-outline', color: '#F59E0B' },
  painting: { label: 'Painting', icon: 'color-palette-outline', color: '#3B82F6' },
  repairs: { label: 'Repairs', icon: 'hammer-outline', color: '#EF4444' },
  finishing: { label: 'Finishing', icon: 'sparkles-outline', color: '#8B5CF6' },
  specialty: { label: 'Specialty', icon: 'star-outline', color: '#EC4899' },
  consultation: { label: 'Consultation', icon: 'chatbubbles-outline', color: '#10B981' },
  // trade-neutral
  callout: { label: 'Call-out', icon: 'car-outline', color: '#F97316' },
  installation: { label: 'Installation', icon: 'build-outline', color: '#0EA5E9' },
  maintenance: { label: 'Maintenance', icon: 'refresh-outline', color: '#14B8A6' },
  inspection: { label: 'Inspection', icon: 'search-outline', color: '#A855F7' },
  other: { label: 'Other', icon: 'ellipsis-horizontal-outline', color: '#94A3B8' },
};

const FALLBACK_CATEGORY = CATEGORY_CONFIG.other;

export function Pricebook({ onSelectItem, onClose, onEditItem, onCreateItem, mode = 'browse' }: PricebookProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const country = user?.country ?? 'NL';
  const { entries, loading, refresh } = usePricebook();

  // This list stays mounted while the editor is pushed on top of it, and the
  // editor holds its OWN copy of the pricebook. Without this, saving an edit
  // and tapping back showed the pre-edit list — and adding a first service
  // returned you to the empty state you had just left.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PricebookCategory | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const filteredItems = searchEntries(entries, searchQuery, selectedCategory);
  const categories = categoriesInUse(entries);

  const handleSelectVariant = (item: PricebookEntry, variant: PricebookVariantEntry) => {
    onSelectItem?.(item, variant);
  };

  const handleSelectBase = (item: PricebookEntry) => {
    onSelectItem?.(item);
  };

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
          <Text style={styles.headerTitle}>{t('pricebook.title', 'Pricebook')}</Text>
          <Text style={styles.headerSubtitle}>{t('pricebook.count', { count: entries.filter((e) => e.isActive).length, defaultValue: '{{count}} services' })}</Text>
        </View>
        {onCreateItem && (
          <Pressable
            style={styles.addButton}
            onPress={onCreateItem}
            accessibilityRole="button"
            accessibilityLabel={t('pricebook.add', 'Add service')}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={SemanticColors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('pricebook.searchPlaceholder', 'Search services…')}
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
            {t('pricebook.all', 'All')}
          </Text>
        </Pressable>
        {categories.map((cat) => {
          const config = CATEGORY_CONFIG[cat] ?? FALLBACK_CATEGORY;
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
                {t(`pricebook.cat.${cat}`, config.label)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Items List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filteredItems.map((item) => {
          const categoryConfig = CATEGORY_CONFIG[item.category] ?? FALLBACK_CATEGORY;
          const isExpanded = expandedItemId === item.id;
          const margin = marginOf(item);
          const cost = costOf(item);

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
                  <Text style={styles.itemPrice}>{formatCurrency(item.basePrice, country)}</Text>
                  {/* A fixed price has no unit, and "/undefined" was rendering. */}
                  {item.pricingType !== 'fixed' && !!item.unit && (
                    <Text style={styles.itemUnit}>/{item.unit}</Text>
                  )}
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
                  {/* Stats Row. Margin and cost appear only when the contractor
                      has entered cost inputs; otherwise we do not know them and
                      show nothing rather than a guess. */}
                  <View style={styles.statsRow}>
                    {margin !== null && (
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>{t('pricebook.margin', 'Margin')}</Text>
                        <Text
                          style={[
                            styles.statValue,
                            { color: margin < 0 ? SemanticColors.feedbackError : SemanticColors.feedbackSuccess },
                          ]}
                        >
                          {margin.toFixed(0)}%
                        </Text>
                      </View>
                    )}
                    {cost !== null && (
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>{t('pricebook.cost', 'Cost')}</Text>
                        <Text style={styles.statValue}>{formatCurrency(cost, country)}</Text>
                      </View>
                    )}
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>{t('pricebook.used', 'Used')}</Text>
                      <Text style={styles.statValue}>{t('pricebook.usedTimes', { count: item.usageCount, defaultValue: '{{count}}x' })}</Text>
                    </View>
                    {!!item.laborMinutes && (
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>{t('pricebook.time', 'Time')}</Text>
                        <Text style={styles.statValue}>{t('pricebook.minutes', { count: item.laborMinutes, defaultValue: '{{count}} min' })}</Text>
                      </View>
                    )}
                  </View>

                  {onEditItem && (
                    <Pressable style={styles.editButton} onPress={() => onEditItem(item.id)}>
                      <Ionicons name="create-outline" size={16} color={SemanticColors.textSecondary} />
                      <Text style={styles.editButtonText}>{t('pricebook.edit', 'Edit')}</Text>
                    </Pressable>
                  )}

                  {/* Variants (Good-Better-Best) */}
                  {item.variants && item.variants.length > 0 ? (
                    <View style={styles.variantsSection}>
                      <Text style={styles.variantsTitle}>{t('pricebook.pricingOptions', 'Pricing options')}</Text>
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
                                <Text style={styles.recommendedBadgeText}>{t('pricebook.popular', 'POPULAR')}</Text>
                              </View>
                            )}
                            <Text style={styles.variantTier}>
                              {t(`pricebook.tier.${variant.tier}`, variant.tier)}
                            </Text>
                            <Text style={styles.variantName}>{variant.name}</Text>
                            <Text style={styles.variantPrice}>
                              {formatCurrency(variant.price, country)}
                              {item.pricingType !== 'fixed' && !!item.unit && (
                                <Text style={styles.variantUnit}>/{item.unit}</Text>
                              )}
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
                                  {t('pricebook.select', 'Select')}
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
                        <Text style={styles.addToQuoteText}>{t('pricebook.addToQuote', 'Add to quote')}</Text>
                      </Pressable>
                    )
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Three distinct states. An empty book and a filter that matched
            nothing are different problems, and offering "add your first
            service" to someone who has forty of them reads as broken. */}
        {loading && (
          <View style={styles.emptyState}>
            <ActivityIndicator color={SemanticColors.actionPrimary} />
          </View>
        )}

        {!loading && filteredItems.length === 0 && entries.length > 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyStateText}>{t('pricebook.noMatches', 'No services match')}</Text>
          </View>
        )}

        {!loading && entries.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyStateText}>{t('pricebook.emptyTitle', 'No services yet')}</Text>
            <Text style={styles.emptyStateHint}>
              {t('pricebook.emptyHint', 'Add the work you quote most often, with the price you charge. Then a quote is picking from a list instead of typing it out.')}
            </Text>
            {onCreateItem && (
              <Pressable style={styles.emptyCta} onPress={onCreateItem}>
                <Ionicons name="add" size={18} color={Palette.white} />
                <Text style={styles.emptyCtaText}>{t('pricebook.addFirst', 'Add your first service')}</Text>
              </Pressable>
            )}
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
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  headerSubtitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
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
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
  },
  categoryFilters: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
    // A horizontal ScrollView's content container defaults to
    // alignItems:'stretch', so each pill grew to the full height of the
    // scroll area — the filter row was rendering as six tall boxes taking
    // roughly half the screen. Size pills to their content instead.
    alignItems: 'center',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  categoryPillActive: {
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderColor: SemanticColors.actionPrimary + '40',
  },
  categoryPillText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
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
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  itemDescription: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  itemPricing: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
  },
  itemUnit: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
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
    fontSize: TYPE.tinySize - 1,
    textTransform: 'uppercase',
  },
  statValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  variantsSection: {
    gap: Spacing.sm,
  },
  variantsTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    textTransform: 'uppercase',
  },
  variantsGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  variantCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
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
    color: Palette.white,
    fontSize: TYPE.tinySize - 3,
    fontFamily: TYPE.sectionFamily,
  },
  variantTier: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize - 2,
    fontFamily: TYPE.titleFamily,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  variantName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  variantPrice: {
    color: SemanticColors.actionPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.sectionFamily,
  },
  variantUnit: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize - 1,
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
    fontSize: TYPE.tinySize - 1,
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
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  selectButtonTextRecommended: {
    color: Palette.white,
  },
  addToQuoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: RADIUS.sm,
  },
  addToQuoteText: {
    color: SemanticColors.actionPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.bodySize - 1,
  },
  emptyStateHint: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.captionSize,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: Spacing.md,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.actionPrimary,
  },
  emptyCtaText: {
    color: Palette.white,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  editButtonText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
});
