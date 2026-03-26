// =============================================================================
// MATERIAL PRICE COMPARISON VIEW
// =============================================================================
// Shows real-time price comparisons across suppliers
// Core value proposition of the pricing moat
// =============================================================================

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { formatCurrency } from '../../i18n/formatting';
import { Spacing } from '../../theme/spacing';
import { trackUserAction } from '../../intelligence/intelligenceEngine';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// TYPES
// ============================================

interface Material {
  id: string;
  name: string;
  brand?: string;
  category: string;
  unit: string;
  image?: string;
}

interface PricePoint {
  supplierId: string;
  supplierName: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  inStock: boolean;
  stockLevel?: 'high' | 'medium' | 'low';
  deliveryDays: number;
  lastUpdated: string;
  isYourSupplier?: boolean;
}

interface MaterialPrice {
  material: Material;
  prices: PricePoint[];
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  yourLastPaid?: number;
  priceHistory: { date: string; price: number }[];
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_MATERIALS: MaterialPrice[] = [
  {
    material: {
      id: 'mat_dulux_white_5l',
      name: 'Dulux Trade Eggshell White',
      brand: 'Dulux',
      category: 'Verf',
      unit: '5L',
    },
    prices: [
      { supplierId: 'bouwmaat', supplierName: 'Bouwmaat', price: 23.40, originalPrice: 28.50, discount: 18, inStock: true, stockLevel: 'high', deliveryDays: 1, lastUpdated: '2 uur geleden', isYourSupplier: true },
      { supplierId: 'praxis', supplierName: 'Praxis', price: 26.95, inStock: true, stockLevel: 'medium', deliveryDays: 2, lastUpdated: '4 uur geleden' },
      { supplierId: 'gamma', supplierName: 'Gamma', price: 27.50, inStock: true, stockLevel: 'high', deliveryDays: 1, lastUpdated: '1 dag geleden' },
      { supplierId: 'verfwinkel', supplierName: 'Verfwinkel.nl', price: 24.80, inStock: false, deliveryDays: 3, lastUpdated: '6 uur geleden' },
    ],
    lowestPrice: 23.40,
    highestPrice: 27.50,
    averagePrice: 25.66,
    yourLastPaid: 26.50,
    priceHistory: [
      { date: '2025-01-01', price: 28.50 },
      { date: '2025-01-08', price: 27.00 },
      { date: '2025-01-15', price: 26.50 },
      { date: '2025-01-22', price: 24.50 },
      { date: '2025-01-29', price: 23.40 },
    ],
    trend: 'down',
    trendPercent: -12,
  },
  {
    material: {
      id: 'mat_sigma_satin_2.5l',
      name: 'Sigma S2U Allure Semi-Gloss',
      brand: 'Sigma',
      category: 'Verf',
      unit: '2.5L',
    },
    prices: [
      { supplierId: 'verfwinkel', supplierName: 'Verfwinkel.nl', price: 38.50, inStock: true, stockLevel: 'high', deliveryDays: 2, lastUpdated: '3 uur geleden' },
      { supplierId: 'bouwmaat', supplierName: 'Bouwmaat', price: 42.00, inStock: true, stockLevel: 'medium', deliveryDays: 1, lastUpdated: '5 uur geleden', isYourSupplier: true },
      { supplierId: 'praxis', supplierName: 'Praxis', price: 44.95, inStock: true, stockLevel: 'low', deliveryDays: 2, lastUpdated: '1 dag geleden' },
    ],
    lowestPrice: 38.50,
    highestPrice: 44.95,
    averagePrice: 41.82,
    yourLastPaid: 43.00,
    priceHistory: [
      { date: '2025-01-01', price: 42.00 },
      { date: '2025-01-15', price: 41.50 },
      { date: '2025-01-29', price: 38.50 },
    ],
    trend: 'down',
    trendPercent: -8,
  },
  {
    material: {
      id: 'mat_grohe_kraan',
      name: 'Grohe Eurosmart Keukenkraan',
      brand: 'Grohe',
      category: 'Sanitair',
      unit: 'stuk',
    },
    prices: [
      { supplierId: 'sanitairwinkel', supplierName: 'Sanitairwinkel.nl', price: 89.00, inStock: true, stockLevel: 'high', deliveryDays: 2, lastUpdated: '2 uur geleden' },
      { supplierId: 'tu', supplierName: 'Technische Unie', price: 92.50, inStock: true, stockLevel: 'high', deliveryDays: 1, lastUpdated: '1 uur geleden', isYourSupplier: true },
      { supplierId: 'praxis', supplierName: 'Praxis', price: 109.00, inStock: true, stockLevel: 'medium', deliveryDays: 3, lastUpdated: '12 uur geleden' },
    ],
    lowestPrice: 89.00,
    highestPrice: 109.00,
    averagePrice: 96.83,
    yourLastPaid: 95.00,
    priceHistory: [
      { date: '2025-01-01', price: 95.00 },
      { date: '2025-01-15', price: 92.00 },
      { date: '2025-01-29', price: 89.00 },
    ],
    trend: 'down',
    trendPercent: -6,
  },
  {
    material: {
      id: 'mat_geberit_duofix',
      name: 'Geberit Duofix Inbouwreservoir',
      brand: 'Geberit',
      category: 'Sanitair',
      unit: 'stuk',
    },
    prices: [
      { supplierId: 'tu', supplierName: 'Technische Unie', price: 185.00, inStock: true, stockLevel: 'medium', deliveryDays: 1, lastUpdated: '30 min geleden', isYourSupplier: true },
      { supplierId: 'sanitairwinkel', supplierName: 'Sanitairwinkel.nl', price: 189.00, inStock: true, stockLevel: 'high', deliveryDays: 2, lastUpdated: '4 uur geleden' },
      { supplierId: 'gamma', supplierName: 'Gamma', price: 219.00, inStock: false, deliveryDays: 5, lastUpdated: '2 dagen geleden' },
    ],
    lowestPrice: 185.00,
    highestPrice: 219.00,
    averagePrice: 197.67,
    yourLastPaid: 192.00,
    priceHistory: [
      { date: '2024-12-01', price: 179.00 },
      { date: '2025-01-01', price: 185.00 },
      { date: '2025-01-29', price: 185.00 },
    ],
    trend: 'stable',
    trendPercent: 0,
  },
];

const CATEGORIES = ['Alles', 'Verf', 'Sanitair', 'Tegels', 'Gereedschap', 'Elektra'];

// ============================================
// COMPONENTS
// ============================================

interface PriceComparisonProps {
  onClose?: () => void;
}

export function PriceComparison({ onClose }: PriceComparisonProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alles');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialPrice | null>(null);

  const filteredMaterials = MOCK_MATERIALS.filter((m) => {
    const matchesSearch =
      searchQuery === '' ||
      m.material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.material.brand?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'Alles' || m.material.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleMaterialSelect = useCallback((material: MaterialPrice) => {
    setSelectedMaterial(material);
    trackUserAction('material_price_checked', {
      materialId: material.material.id,
      materialName: material.material.name,
      lowestPrice: material.lowestPrice,
      suppliersCompared: material.prices.length,
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Prijsvergelijking</Text>
          <Text style={styles.headerSubtitle}>Vergelijk prijzen bij {5} leveranciers</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={SemanticColors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Zoek materiaal..."
            placeholderTextColor={SemanticColors.textTertiary}
          />
          {searchQuery !== '' && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={SemanticColors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map((category) => (
          <Pressable
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextActive,
              ]}
            >
              {category}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Materials List */}
      <FlatList
        data={filteredMaterials}
        keyExtractor={(item) => item.material.id}
        renderItem={({ item }) => (
          <MaterialPriceCard
            materialPrice={item}
            onPress={() => handleMaterialSelect(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyTitle}>Geen materialen gevonden</Text>
            <Text style={styles.emptyText}>Probeer een andere zoekopdracht</Text>
          </View>
        }
      />

      {/* Detail Panel */}
      {selectedMaterial && (
        <MaterialDetailPanel
          materialPrice={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
        />
      )}
    </View>
  );
}

// ============================================
// MATERIAL PRICE CARD
// ============================================

function MaterialPriceCard({
  materialPrice,
  onPress,
}: {
  materialPrice: MaterialPrice;
  onPress: () => void;
}) {
  const { material, prices, lowestPrice, averagePrice, yourLastPaid, trend, trendPercent } = materialPrice;
  const bestDeal = prices.reduce((best, p) => (p.price < best.price ? p : best), prices[0]);
  const savings = yourLastPaid ? yourLastPaid - lowestPrice : averagePrice - lowestPrice;

  const getTrendColor = () => {
    if (trend === 'down') return SemanticColors.feedbackSuccess;
    if (trend === 'up') return SemanticColors.feedbackError;
    return SemanticColors.textTertiary;
  };

  const getTrendIcon = (): IconName => {
    if (trend === 'down') return 'trending-down';
    if (trend === 'up') return 'trending-up';
    return 'remove';
  };

  return (
    <Pressable style={styles.materialCard} onPress={onPress}>
      {/* Header */}
      <View style={styles.materialHeader}>
        <View style={styles.materialInfo}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{material.category}</Text>
          </View>
          <Text style={styles.materialName}>{material.name}</Text>
          {material.brand && (
            <Text style={styles.materialBrand}>{material.brand} · {material.unit}</Text>
          )}
        </View>
        <View style={styles.trendBadge}>
          <Ionicons name={getTrendIcon()} size={14} color={getTrendColor()} />
          <Text style={[styles.trendText, { color: getTrendColor() }]}>
            {trendPercent > 0 ? '+' : ''}{trendPercent}%
          </Text>
        </View>
      </View>

      {/* Price Comparison */}
      <View style={styles.priceComparisonRow}>
        <View style={styles.bestPrice}>
          <Text style={styles.priceLabel}>Beste prijs</Text>
          <Text style={styles.bestPriceValue}>{formatCurrency(lowestPrice)}</Text>
          <Text style={styles.bestPriceSupplier}>{bestDeal.supplierName}</Text>
        </View>
        {yourLastPaid && (
          <View style={styles.yourPrice}>
            <Text style={styles.priceLabel}>Jij betaalde</Text>
            <Text style={styles.yourPriceValue}>{formatCurrency(yourLastPaid)}</Text>
            {savings > 0 && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>Bespaar {formatCurrency(savings)}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Supplier Preview */}
      <View style={styles.supplierPreview}>
        {prices.slice(0, 4).map((price, index) => (
          <View key={index} style={styles.supplierDot}>
            <View
              style={[
                styles.supplierDotInner,
                price.price === lowestPrice && styles.supplierDotBest,
                price.isYourSupplier && styles.supplierDotYours,
              ]}
            />
          </View>
        ))}
        <Text style={styles.supplierCount}>{prices.length} leveranciers</Text>
        <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
      </View>
    </Pressable>
  );
}

// ============================================
// MATERIAL DETAIL PANEL
// ============================================

function MaterialDetailPanel({
  materialPrice,
  onClose,
}: {
  materialPrice: MaterialPrice;
  onClose: () => void;
}) {
  const { material, prices, priceHistory, lowestPrice, highestPrice, averagePrice } = materialPrice;

  const getStockColor = (level?: 'high' | 'medium' | 'low') => {
    if (level === 'high') return SemanticColors.feedbackSuccess;
    if (level === 'medium') return SemanticColors.feedbackWarning;
    return SemanticColors.feedbackError;
  };

  const getStockLabel = (level?: 'high' | 'medium' | 'low') => {
    if (level === 'high') return 'Ruim op voorraad';
    if (level === 'medium') return 'Beperkt';
    return 'Bijna op';
  };

  // Calculate chart dimensions
  const maxPrice = Math.max(...priceHistory.map((p) => p.price));
  const minPrice = Math.min(...priceHistory.map((p) => p.price));
  const priceRange = maxPrice - minPrice || 1;

  return (
    <View style={styles.detailPanel}>
      {/* Header */}
      <View style={styles.detailPanelHeader}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.detailPanelTitle}>
          <Text style={styles.detailMaterialName}>{material.name}</Text>
          <Text style={styles.detailMaterialBrand}>{material.brand} · {material.unit}</Text>
        </View>
        <Pressable style={styles.alertButton}>
          <Ionicons name="notifications-outline" size={22} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      <ScrollView style={styles.detailContent}>
        {/* Price Summary */}
        <View style={styles.priceSummary}>
          <View style={styles.priceSummaryItem}>
            <Text style={styles.priceSummaryLabel}>Laagste</Text>
            <Text style={[styles.priceSummaryValue, { color: SemanticColors.feedbackSuccess }]}>
              {formatCurrency(lowestPrice)}
            </Text>
          </View>
          <View style={styles.priceSummaryDivider} />
          <View style={styles.priceSummaryItem}>
            <Text style={styles.priceSummaryLabel}>Gemiddeld</Text>
            <Text style={styles.priceSummaryValue}>{formatCurrency(averagePrice)}</Text>
          </View>
          <View style={styles.priceSummaryDivider} />
          <View style={styles.priceSummaryItem}>
            <Text style={styles.priceSummaryLabel}>Hoogste</Text>
            <Text style={[styles.priceSummaryValue, { color: SemanticColors.feedbackError }]}>
              {formatCurrency(highestPrice)}
            </Text>
          </View>
        </View>

        {/* Price History Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Prijsverloop (30 dagen)</Text>
          <View style={styles.miniChart}>
            <View style={styles.chartLine}>
              {priceHistory.map((point, index) => {
                const heightPercent = ((point.price - minPrice) / priceRange) * 100;
                return (
                  <View key={index} style={styles.chartPoint}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: `${Math.max(heightPercent, 10)}%` },
                      ]}
                    />
                    <Text style={styles.chartLabel}>
                      {point.date.split('-')[2]}/{point.date.split('-')[1]}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Supplier List */}
        <View style={styles.supplierSection}>
          <Text style={styles.sectionTitle}>Prijzen per leverancier</Text>
          {prices.map((price, index) => (
            <View
              key={index}
              style={[
                styles.supplierRow,
                price.price === lowestPrice && styles.supplierRowBest,
              ]}
            >
              <View style={styles.supplierRowLeft}>
                <View style={styles.supplierRowHeader}>
                  <Text style={styles.supplierRowName}>{price.supplierName}</Text>
                  {price.isYourSupplier && (
                    <View style={styles.yourSupplierBadge}>
                      <Text style={styles.yourSupplierText}>Jouw leverancier</Text>
                    </View>
                  )}
                </View>
                <View style={styles.supplierRowMeta}>
                  {price.inStock ? (
                    <View style={styles.stockBadge}>
                      <View style={[styles.stockDot, { backgroundColor: getStockColor(price.stockLevel) }]} />
                      <Text style={[styles.stockText, { color: getStockColor(price.stockLevel) }]}>
                        {getStockLabel(price.stockLevel)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.stockBadge}>
                      <View style={[styles.stockDot, { backgroundColor: SemanticColors.feedbackError }]} />
                      <Text style={[styles.stockText, { color: SemanticColors.feedbackError }]}>
                        Niet op voorraad
                      </Text>
                    </View>
                  )}
                  <Text style={styles.deliveryText}>
                    {price.deliveryDays === 1 ? 'Morgen' : `${price.deliveryDays} dagen`}
                  </Text>
                </View>
              </View>
              <View style={styles.supplierRowRight}>
                {price.originalPrice && price.discount && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>-{price.discount}%</Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.supplierPrice,
                    price.price === lowestPrice && styles.supplierPriceBest,
                  ]}
                >
                  {formatCurrency(price.price)}
                </Text>
                {price.originalPrice && (
                  <Text style={styles.originalPrice}>{formatCurrency(price.originalPrice)}</Text>
                )}
                <Text style={styles.lastUpdated}>{price.lastUpdated}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Pressable style={styles.secondaryButton}>
            <Ionicons name="notifications-outline" size={18} color={Palette.hermesOrange} />
            <Text style={styles.secondaryButtonText}>Prijsalert instellen</Text>
          </Pressable>
          <Pressable style={styles.primaryButton}>
            <Ionicons name="cart-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Koop bij {prices[0].supplierName}</Text>
          </Pressable>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
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
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    color: SemanticColors.textPrimary,
  },
  categoriesContainer: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  categoriesContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 20,
    marginRight: Spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: Palette.hermesOrange,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },

  // Material Card
  materialCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  materialInfo: {
    flex: 1,
    gap: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
  },
  materialName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  materialBrand: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priceComparisonRow: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bestPrice: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  priceLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  bestPriceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  bestPriceSupplier: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  yourPrice: {
    flex: 1,
    padding: Spacing.md,
  },
  yourPriceValue: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  savingsBadge: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  supplierPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  supplierDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplierDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.textTertiary,
  },
  supplierDotBest: {
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  supplierDotYours: {
    backgroundColor: Palette.hermesOrange,
  },
  supplierCount: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: SemanticColors.textTertiary,
  },

  // Detail Panel
  detailPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '85%',
    backgroundColor: SemanticColors.surfaceBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  detailPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  detailPanelTitle: {
    flex: 1,
    alignItems: 'center',
  },
  detailMaterialName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  detailMaterialBrand: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  alertButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  priceSummary: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  priceSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  priceSummaryLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginBottom: 4,
  },
  priceSummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  priceSummaryDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
  },
  chartSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  miniChart: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    height: 120,
  },
  chartLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  chartPoint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  chartBar: {
    width: '60%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 4,
    minHeight: 8,
  },
  chartLabel: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
  },
  supplierSection: {
    marginBottom: Spacing.lg,
  },
  supplierRow: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  supplierRowBest: {
    borderColor: SemanticColors.feedbackSuccess,
    backgroundColor: SemanticColors.feedbackSuccessBg + '30',
  },
  supplierRowLeft: {
    flex: 1,
    gap: 4,
  },
  supplierRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  supplierRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  yourSupplierBadge: {
    backgroundColor: Palette.pastelOrange + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  yourSupplierText: {
    fontSize: 9,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  supplierRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    fontSize: 11,
  },
  deliveryText: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  supplierRowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  discountBadge: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  supplierPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  supplierPriceBest: {
    color: SemanticColors.feedbackSuccess,
  },
  originalPrice: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    textDecorationLine: 'line-through',
  },
  lastUpdated: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hermesOrange,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  primaryButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
