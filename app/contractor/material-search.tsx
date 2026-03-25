// =============================================================================
// MATERIAL SEARCH & ORDER — Catalog search → price comparison → PO creation
// =============================================================================
// Unified sourcing flow: search materials, compare supplier prices, build cart,
// create purchase orders grouped by supplier, and share with suppliers.
// =============================================================================

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID, TOUCH } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { useAuth } from '../../src/context/AuthContext';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { trackEvent } from '../../src/services/eventTrackingService';
import {
  searchCatalog,
  comparePrices,
  getSuppliersForTrade,
  type CatalogItem,
  type PriceCheck,
  type SupplierId,
} from '../../src/integrations/suppliers';
import { purchaseOrderService } from '../../src/services/purchaseOrderService';
import { useLocalSearchParams } from 'expo-router';

// =============================================================================
// TYPES
// =============================================================================

interface CartItem {
  materialName: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  supplierId: string;
  supplierName: string;
}

type TradeFilter = 'all' | 'plumbing' | 'electrical' | 'gas' | 'painting' | 'carpentry';

const TRADE_FILTERS: { key: TradeFilter; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', labelKey: 'materialSearch.filterAll', icon: 'grid-outline' },
  { key: 'plumbing', labelKey: 'materialSearch.filterPlumbing', icon: 'water-outline' },
  { key: 'electrical', labelKey: 'materialSearch.filterElectrical', icon: 'flash-outline' },
  { key: 'gas', labelKey: 'materialSearch.filterGas', icon: 'flame-outline' },
  { key: 'painting', labelKey: 'materialSearch.filterPainting', icon: 'color-palette-outline' },
  { key: 'carpentry', labelKey: 'materialSearch.filterCarpentry', icon: 'construct-outline' },
];

// Country-specific supplier branding + currency
const COUNTRY_CONFIG: Record<string, { currency: string; symbol: string; topSuppliers: string[] }> = {
  NL: { currency: 'EUR', symbol: '€', topSuppliers: ['Technische Unie', 'Rexel', 'Solar Nederland', 'Hornbach'] },
  DE: { currency: 'EUR', symbol: '€', topSuppliers: ['Richter+Frenzel', 'Sonepar', 'Rexel', 'Hornbach'] },
  FR: { currency: 'EUR', symbol: '€', topSuppliers: ['Rexel', 'Sonepar', 'Prolians', 'Leroy Merlin'] },
  ES: { currency: 'EUR', symbol: '€', topSuppliers: ['Saltoki', 'Sonepar', 'Salvador Escoda', 'Leroy Merlin'] },
  IT: { currency: 'EUR', symbol: '€', topSuppliers: ['Comoli Ferrari', 'Sonepar', 'Würth', 'Leroy Merlin'] },
  UK: { currency: 'GBP', symbol: '£', topSuppliers: ['Screwfix', 'Toolstation', 'Travis Perkins', 'City Electrical'] },
};

// =============================================================================
// SCREEN
// =============================================================================

export default function MaterialSearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ q?: string }>();

  // Search state — pre-fill from route params (e.g., reorder_materials links)
  const [query, setQuery] = useState(params.q ?? '');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');
  const [initialSearchDone, setInitialSearchDone] = useState(false);
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compare state — keyed by articleNumber
  const [expandedCompare, setExpandedCompare] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<Record<string, PriceCheck>>({});
  const [comparingId, setComparingId] = useState<string | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [creatingPO, setCreatingPO] = useState(false);

  const country = user?.country ?? 'NL';
  const userTrade = user?.trade ?? 'general';
  const cc = COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.NL;

  // EVE AI insight — shown when user has results
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  // Auto-search on mount if query pre-filled from route params
  const mountRef = useRef(false);
  if (!mountRef.current && params.q && params.q.length >= 2) {
    mountRef.current = true;
    // Trigger search on next tick
    setTimeout(() => performSearch(params.q!, tradeFilter), 100);
  }

  // ---------------------------------------------------------------------------
  // Search with debounce
  // ---------------------------------------------------------------------------

  const performSearch = useCallback(async (searchQuery: string, trade: TradeFilter) => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const tradeArg = trade === 'all' ? undefined : trade;
      const items = await searchCatalog(q, tradeArg, country);
      setResults(items);
      trackEvent('material_search', { query: q, trade: trade, resultCount: items.length });

      // Generate EVE AI insight based on results
      if (items.length > 0) {
        const scannedItems = items.filter(i => i.description?.includes('Real price'));
        const avgPrice = items.reduce((s, i) => s + i.priceExclVat, 0) / items.length;
        if (scannedItems.length > 0) {
          setAiInsight(t('materialSearch.aiScannedInsight', {
            defaultValue: '{{count}} results based on your invoice history. Average price: {{price}}',
            count: scannedItems.length,
            price: formatCurrency(avgPrice, cc.symbol),
          }));
        } else {
          setAiInsight(t('materialSearch.aiMarketInsight', {
            defaultValue: 'Showing {{country}} market prices from {{suppliers}}. Scan supplier invoices to get your real prices.',
            country: country,
            suppliers: cc.topSuppliers.slice(0, 2).join(', '),
          }));
        }
      } else {
        setAiInsight(null);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [country]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(text, tradeFilter);
    }, 300);
  }, [tradeFilter, performSearch]);

  const handleTradeFilter = useCallback((trade: TradeFilter) => {
    setTradeFilter(trade);
    if (query.trim().length >= 2) {
      performSearch(query, trade);
    }
  }, [query, performSearch]);

  // ---------------------------------------------------------------------------
  // Price comparison
  // ---------------------------------------------------------------------------

  const handleCompare = useCallback(async (item: CatalogItem) => {
    const key = item.articleNumber;
    if (expandedCompare === key) {
      setExpandedCompare(null);
      return;
    }

    // Already fetched
    if (compareData[key]) {
      setExpandedCompare(key);
      return;
    }

    setComparingId(key);
    setExpandedCompare(key);
    try {
      const result = await comparePrices(item.name, country);
      if (result) {
        setCompareData(prev => ({ ...prev, [key]: result }));
      }
    } catch {
      // Silent fail — compare panel will show no data
    } finally {
      setComparingId(null);
    }
  }, [expandedCompare, compareData, country]);

  // ---------------------------------------------------------------------------
  // Cart operations
  // ---------------------------------------------------------------------------

  const addToCart = useCallback((item: CatalogItem, supplierOverride?: { id: string; name: string; price: number }) => {
    const supplierInfo = supplierOverride
      ? { supplierId: supplierOverride.id, supplierName: supplierOverride.name, unitPrice: supplierOverride.price }
      : {
          supplierId: item.supplierId,
          supplierName: getSuppliersForTrade(item.category || userTrade, country).find(s => s.id === item.supplierId)?.name ?? item.supplierId,
          unitPrice: item.priceExclVat,
        };

    setCart(prev => {
      const existingIdx = prev.findIndex(
        c => c.materialName === item.name && c.supplierId === supplierInfo.supplierId
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + 1 };
        return updated;
      }
      return [...prev, {
        materialName: item.name,
        quantity: 1,
        unitPrice: supplierInfo.unitPrice,
        unit: item.unit,
        supplierId: supplierInfo.supplierId,
        supplierName: supplierInfo.supplierName,
      }];
    });

    trackEvent('material_added_to_cart', { material: item.name, supplier: supplierInfo.supplierId });
  }, [country, userTrade]);

  const removeFromCart = useCallback((idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateQuantity = useCallback((idx: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty };
    }));
  }, []);

  const cartTotal = useMemo(() => cart.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, c) => sum + c.quantity, 0), [cart]);

  // Cart review mode
  const [showCart, setShowCart] = useState(false);

  // ---------------------------------------------------------------------------
  // Create PO flow
  // ---------------------------------------------------------------------------

  const handleCreatePO = useCallback(async () => {
    if (cart.length === 0) return;
    setCreatingPO(true);

    try {
      // Group cart items by supplier
      const bySupplier = new Map<string, CartItem[]>();
      for (const item of cart) {
        const key = item.supplierId;
        if (!bySupplier.has(key)) bySupplier.set(key, []);
        bySupplier.get(key)!.push(item);
      }

      const createdPOs: { poNumber: string; supplierName: string; total: number }[] = [];

      for (const [supplierId, items] of bySupplier) {
        const supplierName = items[0].supplierName;
        const poItems = items.map(item => ({
          description: item.materialName,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          materialId: undefined,
          jobId: undefined,
        }));

        const po = purchaseOrderService.createOrder(
          supplierId,
          supplierName,
          poItems,
        );

        createdPOs.push({ poNumber: po.poNumber, supplierName, total: po.total });
      }

      // Build share message
      const lines = createdPOs.map(po =>
        `${po.poNumber} — ${po.supplierName}: ${formatCurrency(po.total, cc.symbol)}`
      );
      const message = [
        t('materialSearch.poCreatedTitle', 'Purchase Orders Created'),
        '',
        ...lines,
        '',
        t('materialSearch.poTotal', { count: createdPOs.length, defaultValue: '{{count}} purchase order(s) created' }),
      ].join('\n');

      await Share.share({ message, title: t('materialSearch.poCreatedTitle', 'Purchase Orders Created') });

      setCart([]);
      trackEvent('po_created_from_search', { orderCount: createdPOs.length, totalValue: cartTotal });

      router.push('/contractor/purchase-orders' as any);
    } catch (err) {
      Alert.alert(
        t('common.error', 'Error'),
        t('materialSearch.poCreateError', 'Could not create purchase order. Please try again.'),
      );
    } finally {
      setCreatingPO(false);
    }
  }, [cart, cartTotal, t, router]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderTradeChip = useCallback(({ key, labelKey, icon }: typeof TRADE_FILTERS[number]) => {
    const active = tradeFilter === key;
    return (
      <Pressable
        key={key}
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => handleTradeFilter(key)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={t(labelKey, key)}
      >
        <Ionicons name={icon} size={14} color={active ? '#fff' : SemanticColors.textSecondary} />
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {t(labelKey, key)}
        </Text>
      </Pressable>
    );
  }, [tradeFilter, handleTradeFilter, t]);

  const renderResultItem = useCallback(({ item }: { item: CatalogItem }) => {
    const isScanned = item.description?.includes('Real price');
    const isExpanded = expandedCompare === item.articleNumber;
    const priceCheck = compareData[item.articleNumber];
    const isComparing = comparingId === item.articleNumber;
    const inCart = cart.some(c => c.materialName === item.name);

    return (
      <FadeIn delay={0}>
        <View style={styles.resultCard}>
          {/* Main row */}
          <View style={styles.resultRow}>
            <View style={styles.resultInfo}>
              <Text style={styles.resultName} numberOfLines={2}>{item.name}</Text>
              <View style={styles.resultMeta}>
                <Text style={styles.resultUnit}>/ {item.unit}</Text>
                <View style={[styles.priceBadge, isScanned ? styles.priceBadgeScanned : styles.priceBadgeEstimate]}>
                  <Ionicons
                    name={isScanned ? 'checkmark-circle' : 'analytics'}
                    size={10}
                    color={isScanned ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
                  />
                  <Text style={[styles.priceBadgeText, isScanned && styles.priceBadgeTextScanned]}>
                    {isScanned
                      ? t('materialSearch.scannedPrice', 'Scanned price')
                      : t('materialSearch.marketEstimate', 'Market estimate')
                    }
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.resultActions}>
              <Text style={[styles.resultPrice, isScanned && styles.resultPriceScanned]}>
                {formatCurrency(item.priceExclVat, cc.symbol)}
              </Text>

              <View style={styles.resultButtons}>
                <Pressable
                  style={({ pressed }) => [styles.compareBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => handleCompare(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t('materialSearch.compare', 'Compare prices')}
                >
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'swap-horizontal'}
                    size={16}
                    color={Palette.hermesOrange}
                  />
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.addBtn,
                    inCart && styles.addBtnInCart,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => addToCart(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t('materialSearch.addToOrder', 'Add to order')}
                >
                  <Ionicons
                    name={inCart ? 'checkmark' : 'add'}
                    size={16}
                    color="#fff"
                  />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Compare panel */}
          {isExpanded && (
            <View style={styles.comparePanel}>
              {isComparing ? (
                <ActivityIndicator size="small" color={Palette.hermesOrange} style={{ paddingVertical: GRID.sm }} />
              ) : priceCheck && priceCheck.prices.length > 0 ? (
                <>
                  <Text style={styles.comparePanelTitle}>
                    {t('materialSearch.supplierPrices', 'Supplier prices')}
                  </Text>
                  {priceCheck.prices.slice(0, 4).map((sp, idx) => {
                    const isCheapest = sp.supplierId === priceCheck.cheapest && priceCheck.prices.length > 1;
                    const highestPrice = priceCheck.prices[priceCheck.prices.length - 1]?.price ?? sp.price;
                    const savings = highestPrice - sp.price;

                    return (
                      <Pressable
                        key={`${sp.supplierName}-${idx}`}
                        style={({ pressed }) => [
                          styles.compareRow,
                          isCheapest && styles.compareRowBest,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => addToCart(item, { id: sp.supplierId, name: sp.supplierName, price: sp.price })}
                        accessibilityRole="button"
                        accessibilityLabel={`${sp.supplierName} ${formatCurrency(sp.price, cc.symbol)}`}
                      >
                        <View style={styles.compareInfo}>
                          <View style={styles.compareNameRow}>
                            <Text style={styles.compareSupplier} numberOfLines={1}>{sp.supplierName}</Text>
                            {isCheapest && (
                              <View style={styles.bestBadge}>
                                <Text style={styles.bestBadgeText}>
                                  {t('materialSearch.bestPrice', 'Best price')}
                                </Text>
                              </View>
                            )}
                          </View>
                          {savings > 0 && !isCheapest && (
                            <Text style={styles.compareSavings}>
                              +{formatCurrency(savings, cc.symbol)} {t('materialSearch.vsLowest', 'vs lowest')}
                            </Text>
                          )}
                          {isCheapest && priceCheck.savings > 0 && (
                            <Text style={styles.compareSavingsBest}>
                              {t('materialSearch.save', 'Save')} {formatCurrency(priceCheck.savings, cc.symbol)}
                            </Text>
                          )}
                        </View>
                        <View style={styles.comparePriceCol}>
                          <Text style={[styles.comparePrice, isCheapest && styles.comparePriceBest]}>
                            {formatCurrency(sp.price, cc.symbol)}
                          </Text>
                          <Ionicons name="add-circle-outline" size={16} color={Palette.hermesOrange} />
                        </View>
                      </Pressable>
                    );
                  })}
                </>
              ) : (
                <Text style={styles.compareEmpty}>
                  {t('materialSearch.noCompareData', 'No price comparison available for this item')}
                </Text>
              )}
            </View>
          )}
        </View>
      </FadeIn>
    );
  }, [expandedCompare, compareData, comparingId, cart, handleCompare, addToCart, t]);

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('materialSearch.title', 'Find Materials')}</Text>
        <Pressable
          onPress={() => {
            if (cart.length > 0) setShowCart(!showCart);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('materialSearch.cart', 'Cart')}
        >
          <View>
            <Ionicons name="cart-outline" size={24} color={SemanticColors.textPrimary} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={SemanticColors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('materialSearch.searchPlaceholder', 'Search materials...')}
            placeholderTextColor={SemanticColors.textTertiary}
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setResults([]); }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={SemanticColors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Trade filter chips */}
      <View style={styles.chipRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TRADE_FILTERS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => renderTradeChip(item)}
          contentContainerStyle={styles.chipContent}
        />
      </View>

      {/* EVE AI Insight */}
      {aiInsight && results.length > 0 && (
        <View style={styles.aiCard}>
          <View style={styles.aiCardIcon}>
            <Ionicons name="sparkles" size={14} color={Palette.hermesOrange} />
          </View>
          <Text style={styles.aiCardText}>{aiInsight}</Text>
        </View>
      )}

      {/* Country supplier context */}
      {results.length === 0 && query.length < 2 && (
        <View style={styles.supplierContext}>
          <Text style={styles.supplierContextLabel}>
            {t('materialSearch.topSuppliers', 'Top suppliers in your area')}
          </Text>
          <View style={styles.supplierChips}>
            {cc.topSuppliers.map(s => (
              <View key={s} style={styles.supplierChip}>
                <Ionicons name="business-outline" size={11} color={SemanticColors.textSecondary} />
                <Text style={styles.supplierChipText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.articleNumber}
        renderItem={renderResultItem}
        style={styles.list}
        contentContainerStyle={[styles.listContent, cart.length > 0 && { paddingBottom: 140 }]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {searching ? (
              <ActivityIndicator size="large" color={Palette.hermesOrange} />
            ) : query.length < 2 ? (
              <>
                <Ionicons name="cube-outline" size={48} color={SemanticColors.textTertiary} />
                <Text style={styles.emptyTitle}>{t('materialSearch.searchHint', 'Search for materials')}</Text>
                <Text style={styles.emptyDesc}>
                  {t('materialSearch.searchHintDesc', 'Search by name to find materials, compare prices across suppliers, and create purchase orders.')}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="alert-circle-outline" size={48} color={SemanticColors.textTertiary} />
                <Text style={styles.emptyTitle}>{t('materialSearch.noResults', 'No materials found')}</Text>
                <Text style={styles.emptyDesc}>
                  {t('materialSearch.noResultsDesc', 'Try different search terms or change the trade filter.')}
                </Text>
              </>
            )}
          </View>
        }
      />

      {/* Cart review panel */}
      {showCart && cart.length > 0 && (
        <View style={styles.cartPanel}>
          <View style={styles.cartPanelHeader}>
            <Text style={styles.cartPanelTitle}>{t('materialSearch.orderReview', 'Order review')}</Text>
            <Pressable onPress={() => setShowCart(false)} hitSlop={8}>
              <Ionicons name="close" size={20} color={SemanticColors.textSecondary} />
            </Pressable>
          </View>

          {/* Group by supplier */}
          {(() => {
            const groups = new Map<string, { items: (CartItem & { idx: number })[]; supplierName: string }>();
            cart.forEach((item, idx) => {
              if (!groups.has(item.supplierId)) groups.set(item.supplierId, { items: [], supplierName: item.supplierName });
              groups.get(item.supplierId)!.items.push({ ...item, idx });
            });
            return Array.from(groups.entries()).map(([suppId, group]) => (
              <View key={suppId} style={styles.cartGroup}>
                <View style={styles.cartGroupHeader}>
                  <Ionicons name="business-outline" size={13} color={Palette.hermesOrange} />
                  <Text style={styles.cartGroupName}>{group.supplierName}</Text>
                </View>
                {group.items.map((item) => (
                  <View key={item.idx} style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName} numberOfLines={1}>{item.materialName}</Text>
                      <Text style={styles.cartItemPrice}>{formatCurrency(item.unitPrice, cc.symbol)} / {item.unit}</Text>
                    </View>
                    <View style={styles.cartItemQty}>
                      <Pressable onPress={() => updateQuantity(item.idx, -1)} hitSlop={6} style={styles.qtyBtn}>
                        <Ionicons name="remove" size={14} color={SemanticColors.textSecondary} />
                      </Pressable>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <Pressable onPress={() => updateQuantity(item.idx, 1)} hitSlop={6} style={styles.qtyBtn}>
                        <Ionicons name="add" size={14} color={SemanticColors.textSecondary} />
                      </Pressable>
                      <Pressable onPress={() => removeFromCart(item.idx)} hitSlop={6} style={styles.removeBtn}>
                        <Ionicons name="trash-outline" size={14} color={SemanticColors.feedbackError} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ));
          })()}

          <View style={styles.cartTotalRow}>
            <Text style={styles.cartTotalLabel}>{t('materialSearch.total', 'Total')}</Text>
            <Text style={styles.cartTotalValue}>{formatCurrency(cartTotal, cc.symbol)}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.createPOBtn, pressed && { opacity: 0.85 }]}
            onPress={handleCreatePO}
            disabled={creatingPO}
            accessibilityRole="button"
            accessibilityLabel={t('materialSearch.sendOrder', 'Send order')}
          >
            {creatingPO ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                <Text style={styles.createPOBtnText}>{t('materialSearch.sendOrder', 'Send order to supplier')}</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Sticky bottom cart bar */}
      {cart.length > 0 && !showCart && (
        <Pressable style={styles.cartBar} onPress={() => setShowCart(true)} accessibilityRole="button">
          <View style={styles.cartBarInfo}>
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={styles.cartBarText}>
              {t('materialSearch.cartSummary', '{{count}} items', { count: cartCount })}
              {'  '}
              <Text style={styles.cartBarTotal}>{formatCurrency(cartTotal, cc.symbol)}</Text>
            </Text>
          </View>
          <View style={styles.cartBarButton}>
            <Text style={styles.cartBarButtonText}>{t('materialSearch.reviewOrder', 'Review order')}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(amount: number, symbol = '€'): string {
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SafeArea.top,
    paddingHorizontal: SafeArea.side,
    paddingBottom: GRID.sm,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.sectionTracking,
  },

  // Cart badge
  cartBadge: {
    position: 'absolute',
    top: -GRID.sm + 2,
    right: -GRID.sm,
    minWidth: GRID.md + 2,
    height: GRID.md + 2,
    borderRadius: (GRID.md + 2) / 2,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: GRID.xs,
  },
  cartBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.labelFamily,
    color: '#fff',
  },

  // Search
  searchContainer: {
    paddingHorizontal: SafeArea.side,
    paddingBottom: GRID.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md - 4,
    paddingVertical: GRID.sm + 2,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
    padding: 0,
  },

  // Trade filter chips
  chipRow: {
    paddingBottom: GRID.sm,
  },
  chipContent: {
    paddingHorizontal: SafeArea.side,
    gap: GRID.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingHorizontal: GRID.md - 4,
    paddingVertical: GRID.sm - 2,
    borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  chipActive: {
    backgroundColor: Palette.hermesOrange,
  },
  chipText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },

  // EVE AI insight card
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    marginHorizontal: SafeArea.side,
    marginBottom: GRID.sm,
    backgroundColor: Palette.hermesOrange + '08',
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md - 4,
    paddingVertical: GRID.sm + 2,
  },
  aiCardIcon: {
    width: GRID.lg,
    height: GRID.lg,
    borderRadius: GRID.md - 4,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCardText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    lineHeight: TYPE.captionSize + 5,
  },

  // Country supplier context
  supplierContext: {
    paddingHorizontal: SafeArea.side,
    paddingBottom: GRID.md,
    gap: GRID.sm,
  },
  supplierContextLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  supplierChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID.xs,
  },
  supplierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingHorizontal: GRID.sm + 2,
    paddingVertical: GRID.sm - 3,
    borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  supplierChipText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textSecondary,
  },

  // Results list
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SafeArea.side,
    gap: GRID.sm,
    paddingBottom: 130,
  },

  // Result card
  resultCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    padding: GRID.md,
    gap: GRID.md,
  },
  resultInfo: {
    flex: 1,
    gap: GRID.xs,
  },
  resultName: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    flexWrap: 'wrap',
  },
  resultUnit: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs - 1,
    paddingHorizontal: GRID.sm - 2,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  priceBadgeScanned: {
    backgroundColor: SemanticColors.feedbackSuccess + '15',
  },
  priceBadgeEstimate: {
    backgroundColor: SemanticColors.textTertiary + '10',
  },
  priceBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
  },
  priceBadgeTextScanned: {
    color: SemanticColors.feedbackSuccess,
  },
  resultActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  resultPrice: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.sectionTracking,
  },
  resultPriceScanned: {
    color: SemanticColors.feedbackSuccess,
  },
  resultButtons: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  compareBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnInCart: {
    backgroundColor: SemanticColors.feedbackSuccess,
  },

  // Compare panel
  comparePanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.borderDefault,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    backgroundColor: PAGE_BG,
  },
  comparePanelTitle: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: GRID.sm,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: GRID.sm,
    paddingHorizontal: GRID.sm,
    borderRadius: RADIUS.sm,
    marginBottom: GRID.xs,
  },
  compareRowBest: {
    backgroundColor: SemanticColors.feedbackSuccess + '10',
  },
  compareInfo: {
    flex: 1,
    marginRight: GRID.sm,
  },
  compareNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    flexWrap: 'wrap',
  },
  compareSupplier: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
    flexShrink: 1,
  },
  bestBadge: {
    paddingHorizontal: GRID.sm - 2,
    paddingVertical: 1,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.feedbackSuccess + '20',
  },
  bestBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.feedbackSuccess,
  },
  compareSavings: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  compareSavingsBest: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.feedbackSuccess,
    marginTop: 2,
  },
  comparePriceCol: {
    alignItems: 'flex-end',
    gap: GRID.xs / 2,
  },
  comparePrice: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  comparePriceBest: {
    color: SemanticColors.feedbackSuccess,
  },
  compareEmpty: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
    paddingVertical: GRID.md,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: GRID.xl * 2,
    gap: GRID.md - 4,
    paddingHorizontal: GRID.lg,
  },
  emptyTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },

  // Cart review panel
  cartPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: GRID.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : GRID.md,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cartPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SafeArea.side,
    marginBottom: GRID.md,
  },
  cartPanelTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  cartGroup: {
    paddingHorizontal: SafeArea.side,
    marginBottom: GRID.md,
  },
  cartGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm - 2,
    marginBottom: GRID.xs,
  },
  cartGroupName: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: GRID.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderDefault,
  },
  cartItemInfo: {
    flex: 1,
    marginRight: GRID.sm,
  },
  cartItemName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  cartItemPrice: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  cartItemQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
  },
  qtyBtn: {
    width: RADIUS.full,
    height: RADIUS.full,
    borderRadius: RADIUS.full / 2,
    backgroundColor: PAGE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  removeBtn: {
    width: RADIUS.full,
    height: RADIUS.full,
    borderRadius: RADIUS.full / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: GRID.xs,
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingVertical: GRID.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  cartTotalLabel: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  cartTotalValue: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  createPOBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    marginHorizontal: SafeArea.side,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.lg,
    paddingVertical: GRID.md - 2,
    marginBottom: GRID.sm,
  },
  createPOBtnText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: '#fff',
  },

  // Sticky cart bar
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: SafeArea.side,
    paddingTop: GRID.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : GRID.md,
    gap: GRID.md,
  },
  cartBarInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  cartBarText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: '#fff',
  },
  cartBarTotal: {
    fontFamily: TYPE.sectionFamily,
  },
  cartBarButton: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.lg,
    paddingVertical: GRID.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarButtonText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
});
