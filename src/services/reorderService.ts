// =============================================================================
// SMART REORDER SERVICE
// =============================================================================
// Predicts material needs and suggests optimal reorder timing
// Learns from usage patterns to improve suggestions
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// ============================================
// TYPES
// ============================================

export interface MaterialInventory {
  id: string;
  materialId: string;
  materialName: string;
  brand?: string;
  category: string;
  unit: string;

  // Current stock
  currentStock: number;
  minimumStock: number;
  optimalStock: number;

  // Usage data
  avgDailyUsage: number;
  avgWeeklyUsage: number;
  usageTrend: 'increasing' | 'stable' | 'decreasing';

  // Pricing
  lastPrice: number;
  preferredSupplier: string;

  // Dates
  lastOrderDate: string;
  lastUsedDate: string;
}

export interface ReorderSuggestion {
  id: string;
  materialId: string;
  materialName: string;
  category: string;

  // Urgency
  priority: 'critical' | 'high' | 'medium' | 'low';
  daysUntilStockout: number;

  // Suggestion details
  suggestedQuantity: number;
  suggestedOrderDate: string;
  reason: string;

  // Pricing info
  estimatedCost: number;
  bulkDiscount?: {
    quantity: number;
    discountPercent: number;
    savings: number;
  };
  priceOptimization?: {
    currentPrice: number;
    betterPrice: number;
    betterSupplier: string;
    savings: number;
  };

  // Smart insights
  confidence: number;
  basedOn: string[];

  // Status
  status: 'pending' | 'ordered' | 'dismissed' | 'snoozed';
  snoozedUntil?: string;
}

export interface ReorderBundle {
  id: string;
  name: string;
  description: string;
  items: Array<{
    materialId: string;
    materialName: string;
    quantity: number;
    price: number;
  }>;
  totalValue: number;
  savings: number;
  savingsPercent: number;
  supplier: string;
  validUntil: string;
}

export interface UsagePattern {
  materialId: string;
  dayOfWeek: Record<number, number>; // 0-6 = Sun-Sat
  monthlyTrend: number[]; // Last 12 months
  projectTypeUsage: Record<string, number>; // By project type
  seasonalFactor: number; // 0.5-1.5
}

export interface ReorderStatistics {
  suggestionsGenerated: number;
  ordersPlaced: number;
  totalSavings: number;
  stockoutsAvoided: number;
  accuracyRate: number;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_INVENTORY: MaterialInventory[] = [
  {
    id: 'inv_1',
    materialId: 'mat_dulux_white_5l',
    materialName: 'Dulux Trade Eggshell White 5L',
    brand: 'Dulux',
    category: 'Verf',
    unit: 'stuks',
    currentStock: 2,
    minimumStock: 3,
    optimalStock: 8,
    avgDailyUsage: 0.4,
    avgWeeklyUsage: 2.8,
    usageTrend: 'stable',
    lastPrice: 26.50,
    preferredSupplier: 'Bouwmaat',
    lastOrderDate: '2025-01-10',
    lastUsedDate: '2025-01-30',
  },
  {
    id: 'inv_2',
    materialId: 'mat_sigma_satin',
    materialName: 'Sigma S2U Allure 2.5L',
    brand: 'Sigma',
    category: 'Verf',
    unit: 'stuks',
    currentStock: 0,
    minimumStock: 2,
    optimalStock: 6,
    avgDailyUsage: 0.3,
    avgWeeklyUsage: 2.1,
    usageTrend: 'increasing',
    lastPrice: 44.00,
    preferredSupplier: 'Verfwinkel.nl',
    lastOrderDate: '2025-01-05',
    lastUsedDate: '2025-01-31',
  },
  {
    id: 'inv_3',
    materialId: 'mat_primer_universal',
    materialName: 'Universele Primer 2.5L',
    category: 'Verf',
    unit: 'stuks',
    currentStock: 5,
    minimumStock: 2,
    optimalStock: 6,
    avgDailyUsage: 0.2,
    avgWeeklyUsage: 1.4,
    usageTrend: 'stable',
    lastPrice: 18.50,
    preferredSupplier: 'Bouwmaat',
    lastOrderDate: '2025-01-15',
    lastUsedDate: '2025-01-28',
  },
  {
    id: 'inv_4',
    materialId: 'mat_schuurpapier_p120',
    materialName: 'Schuurpapier P120 (50 vel)',
    category: 'Gereedschap',
    unit: 'pak',
    currentStock: 1,
    minimumStock: 2,
    optimalStock: 4,
    avgDailyUsage: 0.15,
    avgWeeklyUsage: 1.05,
    usageTrend: 'increasing',
    lastPrice: 12.50,
    preferredSupplier: 'Toolstation',
    lastOrderDate: '2025-01-08',
    lastUsedDate: '2025-01-31',
  },
  {
    id: 'inv_5',
    materialId: 'mat_grohe_kraan',
    materialName: 'Grohe Eurosmart Keukenkraan',
    brand: 'Grohe',
    category: 'Sanitair',
    unit: 'stuks',
    currentStock: 1,
    minimumStock: 1,
    optimalStock: 2,
    avgDailyUsage: 0.05,
    avgWeeklyUsage: 0.35,
    usageTrend: 'stable',
    lastPrice: 95.00,
    preferredSupplier: 'Technische Unie',
    lastOrderDate: '2025-01-02',
    lastUsedDate: '2025-01-25',
  },
];

const MOCK_BUNDLES: ReorderBundle[] = [
  {
    id: 'bundle_1',
    name: 'Schilderset Compleet',
    description: 'Alles wat je nodig hebt voor schilderwerk',
    items: [
      { materialId: 'mat_dulux_white_5l', materialName: 'Dulux Trade Eggshell White 5L', quantity: 4, price: 23.40 },
      { materialId: 'mat_primer_universal', materialName: 'Universele Primer 2.5L', quantity: 2, price: 16.50 },
      { materialId: 'mat_schuurpapier_p120', materialName: 'Schuurpapier P120 (50 vel)', quantity: 2, price: 11.00 },
    ],
    totalValue: 148.60,
    savings: 22.00,
    savingsPercent: 13,
    supplier: 'Bouwmaat',
    validUntil: '2025-02-15',
  },
  {
    id: 'bundle_2',
    name: 'Premium Verf Pakket',
    description: 'Hoogwaardige verven met korting',
    items: [
      { materialId: 'mat_sigma_satin', materialName: 'Sigma S2U Allure 2.5L', quantity: 3, price: 39.00 },
      { materialId: 'mat_sikkens_rubbol', materialName: 'Sikkens Rubbol BL Satin 2.5L', quantity: 2, price: 48.00 },
    ],
    totalValue: 213.00,
    savings: 32.00,
    savingsPercent: 13,
    supplier: 'Verfwinkel.nl',
    validUntil: '2025-02-10',
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class ReorderService {
  private inventory: Map<string, MaterialInventory> = new Map();
  private suggestions: Map<string, ReorderSuggestion> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    // R285: empty by default. The MOCK_INVENTORY fixtures stay in the file so
    // tests can opt in via __seedMockInventory(), but production starts empty
    // — the inkoop hero stats and reorder list now reflect real usage instead
    // of fake "13 days of stock left" lines that no contractor ever entered.
    this.generateSuggestions();
  }

  /**
   * Test-only seed for the mock fixtures. Production must NEVER call this.
   */
  __seedMockInventory(): void {
    MOCK_INVENTORY.forEach((item) => this.inventory.set(item.id, item));
    this.generateSuggestions();
  }

  // -----------------------------------------
  // Inventory Management
  // -----------------------------------------

  /**
   * Get all inventory items
   */
  getInventory(filter?: { category?: string; lowStock?: boolean }): MaterialInventory[] {
    let items = Array.from(this.inventory.values());

    if (filter?.category) {
      items = items.filter((i) => i.category === filter.category);
    }
    if (filter?.lowStock) {
      items = items.filter((i) => i.currentStock <= i.minimumStock);
    }

    return items.sort((a, b) => {
      // Sort by stock level relative to minimum
      const aRatio = a.currentStock / a.minimumStock;
      const bRatio = b.currentStock / b.minimumStock;
      return aRatio - bRatio;
    });
  }

  /**
   * Get low stock items
   */
  getLowStockItems(): MaterialInventory[] {
    return this.getInventory({ lowStock: true });
  }

  /**
   * Update stock level
   */
  updateStock(inventoryId: string, newStock: number): void {
    const item = this.inventory.get(inventoryId);
    if (item) {
      item.currentStock = newStock;
      item.lastUsedDate = new Date().toISOString().split('T')[0];
      this.generateSuggestions();
      this.notifyListeners();

      trackUserAction('stock_updated', {
        inventoryId,
        materialId: item.materialId,
        newStock,
      });
    }
  }

  /**
   * Record order placed
   */
  recordOrder(inventoryId: string, quantity: number, price: number): void {
    const item = this.inventory.get(inventoryId);
    if (item) {
      item.currentStock += quantity;
      item.lastOrderDate = new Date().toISOString().split('T')[0];
      item.lastPrice = price;
      this.generateSuggestions();
      this.notifyListeners();

      trackUserAction('order_placed', {
        inventoryId,
        materialId: item.materialId,
        quantity,
        price,
      });
    }
  }

  // -----------------------------------------
  // Reorder Suggestions
  // -----------------------------------------

  /**
   * Get all reorder suggestions
   */
  getSuggestions(filter?: { priority?: ReorderSuggestion['priority'] }): ReorderSuggestion[] {
    let suggestions = Array.from(this.suggestions.values()).filter(
      (s) => s.status === 'pending'
    );

    if (filter?.priority) {
      suggestions = suggestions.filter((s) => s.priority === filter.priority);
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get critical suggestions (need immediate action)
   */
  getCriticalSuggestions(): ReorderSuggestion[] {
    return this.getSuggestions().filter(
      (s) => s.priority === 'critical' || s.priority === 'high'
    );
  }

  /**
   * Mark suggestion as ordered
   */
  markOrdered(suggestionId: string): void {
    const suggestion = this.suggestions.get(suggestionId);
    if (suggestion) {
      suggestion.status = 'ordered';
      this.notifyListeners();

      trackUserAction('suggestion_ordered', {
        suggestionId,
        materialId: suggestion.materialId,
        quantity: suggestion.suggestedQuantity,
      });
    }
  }

  /**
   * Dismiss a suggestion
   */
  dismissSuggestion(suggestionId: string, reason?: string): void {
    const suggestion = this.suggestions.get(suggestionId);
    if (suggestion) {
      suggestion.status = 'dismissed';
      this.notifyListeners();

      trackUserAction('suggestion_dismissed', {
        suggestionId,
        materialId: suggestion.materialId,
        reason,
      });
    }
  }

  /**
   * Snooze a suggestion
   */
  snoozeSuggestion(suggestionId: string, days: number): void {
    const suggestion = this.suggestions.get(suggestionId);
    if (suggestion) {
      const snoozedUntil = new Date();
      snoozedUntil.setDate(snoozedUntil.getDate() + days);
      suggestion.status = 'snoozed';
      suggestion.snoozedUntil = snoozedUntil.toISOString();
      this.notifyListeners();

      trackUserAction('suggestion_snoozed', {
        suggestionId,
        days,
      });
    }
  }

  // -----------------------------------------
  // Bundles
  // -----------------------------------------

  /**
   * Get available bundles. R285: returns empty until a real bundle source
   * (supplier deals API) is wired. The MOCK_BUNDLES fixtures expired in
   * Feb 2025 anyway — they were never refreshed.
   */
  getBundles(): ReorderBundle[] {
    return [];
  }

  /**
   * Get relevant bundles for current suggestions
   */
  getRelevantBundles(): ReorderBundle[] {
    const suggestedMaterials = new Set(
      this.getSuggestions().map((s) => s.materialId)
    );

    return this.getBundles().filter((bundle) =>
      bundle.items.some((item) => suggestedMaterials.has(item.materialId))
    );
  }

  // -----------------------------------------
  // Smart Features
  // -----------------------------------------

  /**
   * Generate reorder suggestions based on inventory
   */
  private generateSuggestions(): void {
    this.suggestions.clear();

    this.inventory.forEach((item) => {
      const daysUntilStockout = this.calculateDaysUntilStockout(item);
      const shouldSuggest = daysUntilStockout <= 14 || item.currentStock <= item.minimumStock;

      if (shouldSuggest) {
        const suggestion = this.createSuggestion(item, daysUntilStockout);
        this.suggestions.set(suggestion.id, suggestion);
      }
    });
  }

  /**
   * Calculate days until stockout
   */
  private calculateDaysUntilStockout(item: MaterialInventory): number {
    if (item.avgDailyUsage === 0) return 999;
    return Math.floor(item.currentStock / item.avgDailyUsage);
  }

  /**
   * Create a reorder suggestion
   */
  private createSuggestion(
    item: MaterialInventory,
    daysUntilStockout: number
  ): ReorderSuggestion {
    const priority = this.calculatePriority(item, daysUntilStockout);
    const suggestedQuantity = this.calculateOptimalQuantity(item);
    const orderDate = this.calculateOptimalOrderDate(item, daysUntilStockout);

    // Check for bulk discount
    const bulkDiscount = this.checkBulkDiscount(item, suggestedQuantity);

    // Check for price optimization
    const priceOptimization = this.checkPriceOptimization(item);

    return {
      id: `sug_${item.materialId}_${Date.now()}`,
      materialId: item.materialId,
      materialName: item.materialName,
      category: item.category,
      priority,
      daysUntilStockout,
      suggestedQuantity: bulkDiscount?.quantity || suggestedQuantity,
      suggestedOrderDate: orderDate,
      reason: this.generateReason(item, daysUntilStockout, priority),
      estimatedCost: (bulkDiscount?.quantity || suggestedQuantity) * item.lastPrice,
      bulkDiscount,
      priceOptimization,
      confidence: this.calculateConfidence(item),
      basedOn: this.getDataSources(item),
      status: 'pending',
    };
  }

  /**
   * Calculate suggestion priority
   */
  private calculatePriority(
    item: MaterialInventory,
    daysUntilStockout: number
  ): ReorderSuggestion['priority'] {
    if (item.currentStock === 0) return 'critical';
    if (daysUntilStockout <= 2) return 'critical';
    if (daysUntilStockout <= 5) return 'high';
    if (daysUntilStockout <= 10) return 'medium';
    return 'low';
  }

  /**
   * Calculate optimal order quantity
   */
  private calculateOptimalQuantity(item: MaterialInventory): number {
    // Order enough to reach optimal stock + 1 week buffer
    const targetStock = item.optimalStock + item.avgWeeklyUsage;
    const neededQuantity = Math.ceil(targetStock - item.currentStock);
    return Math.max(neededQuantity, 1);
  }

  /**
   * Calculate optimal order date
   */
  private calculateOptimalOrderDate(
    item: MaterialInventory,
    daysUntilStockout: number
  ): string {
    // Order when we have ~3 days buffer (assuming 1-2 day delivery)
    const daysUntilOrder = Math.max(0, daysUntilStockout - 3);
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() + daysUntilOrder);
    return orderDate.toISOString().split('T')[0];
  }

  /**
   * Check for bulk discount opportunities
   */
  private checkBulkDiscount(
    item: MaterialInventory,
    baseQuantity: number
  ): ReorderSuggestion['bulkDiscount'] | undefined {
    // Mock bulk discount logic
    if (baseQuantity >= 5 && item.category === 'Verf') {
      const bulkQuantity = Math.ceil(baseQuantity / 5) * 5; // Round up to nearest 5
      return {
        quantity: bulkQuantity,
        discountPercent: 10,
        savings: bulkQuantity * item.lastPrice * 0.1,
      };
    }
    return undefined;
  }

  /**
   * Check for better prices elsewhere
   */
  private checkPriceOptimization(
    item: MaterialInventory
  ): ReorderSuggestion['priceOptimization'] | undefined {
    // R34: was `if (Math.random() > 0.5) return mockBetterPrice` — half the
    // time the contractor saw a fake "Hornbach is 8% cheaper" suggestion,
    // the other half nothing, with no real supplier data backing it. Real
    // cross-supplier price intelligence flows through cohortBenchmarkService
    // + material_price_history (R243+). Until reorderService is wired to
    // those, return undefined (no suggestion) instead of randomly fabricating.
    return undefined;
  }

  /**
   * Generate reason text
   */
  private generateReason(
    item: MaterialInventory,
    daysUntilStockout: number,
    priority: ReorderSuggestion['priority']
  ): string {
    if (item.currentStock === 0) {
      return 'Voorraad is op! Bestel zo snel mogelijk.';
    }
    if (priority === 'critical') {
      return `Nog maar ${item.currentStock} ${item.unit} op voorraad. Verwachte stockout over ${daysUntilStockout} dagen.`;
    }
    if (item.usageTrend === 'increasing') {
      return `Verbruik neemt toe. Nog ${daysUntilStockout} dagen voorraad bij huidig tempo.`;
    }
    return `Voorraad onder minimum niveau (${item.currentStock}/${item.minimumStock} ${item.unit}).`;
  }

  /**
   * Calculate confidence in suggestion
   */
  private calculateConfidence(item: MaterialInventory): number {
    // Higher confidence with more consistent usage data
    let confidence = 0.7;
    if (item.usageTrend === 'stable') confidence += 0.1;
    if (item.avgWeeklyUsage > 0) confidence += 0.1;
    return Math.min(confidence, 0.95);
  }

  /**
   * Get data sources used for suggestion
   */
  private getDataSources(item: MaterialInventory): string[] {
    const sources = ['Voorraadniveau', 'Gemiddeld verbruik'];
    if (item.usageTrend !== 'stable') sources.push('Verbruikstrend');
    sources.push('Ordergeschiedenis');
    return sources;
  }

  // -----------------------------------------
  // Statistics
  // -----------------------------------------

  /**
   * Get reorder statistics
   */
  getStatistics(): ReorderStatistics {
    return {
      suggestionsGenerated: 156,
      ordersPlaced: 89,
      totalSavings: 1245,
      stockoutsAvoided: 12,
      accuracyRate: 87,
    };
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const reorderService = new ReorderService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useInventory(filter?: { category?: string; lowStock?: boolean }) {
  const [inventory, setInventory] = useState<MaterialInventory[]>(() =>
    reorderService.getInventory(filter)
  );

  useEffect(() => {
    const unsubscribe = reorderService.subscribe(() => {
      setInventory(reorderService.getInventory(filter));
    });
    return unsubscribe;
  }, [filter?.category, filter?.lowStock]);

  const updateStock = useCallback((inventoryId: string, newStock: number) => {
    reorderService.updateStock(inventoryId, newStock);
  }, []);

  const recordOrder = useCallback(
    (inventoryId: string, quantity: number, price: number) => {
      reorderService.recordOrder(inventoryId, quantity, price);
    },
    []
  );

  return {
    inventory,
    lowStockCount: inventory.filter((i) => i.currentStock <= i.minimumStock).length,
    updateStock,
    recordOrder,
  };
}

export function useReorderSuggestions() {
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>(() =>
    reorderService.getSuggestions()
  );

  useEffect(() => {
    const unsubscribe = reorderService.subscribe(() => {
      setSuggestions(reorderService.getSuggestions());
    });
    return unsubscribe;
  }, []);

  const markOrdered = useCallback((suggestionId: string) => {
    reorderService.markOrdered(suggestionId);
  }, []);

  const dismissSuggestion = useCallback((suggestionId: string, reason?: string) => {
    reorderService.dismissSuggestion(suggestionId, reason);
  }, []);

  const snoozeSuggestion = useCallback((suggestionId: string, days: number) => {
    reorderService.snoozeSuggestion(suggestionId, days);
  }, []);

  const criticalCount = useMemo(
    () => suggestions.filter((s) => s.priority === 'critical' || s.priority === 'high').length,
    [suggestions]
  );

  return {
    suggestions,
    criticalCount,
    markOrdered,
    dismissSuggestion,
    snoozeSuggestion,
    bundles: reorderService.getRelevantBundles(),
    statistics: reorderService.getStatistics(),
  };
}

export function useReorderBundles() {
  return useMemo(() => reorderService.getBundles(), []);
}
