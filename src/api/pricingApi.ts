// =============================================================================
// PRICING INTELLIGENCE API
// =============================================================================
// RPC-style API for pricing data collection, analysis, and agent recommendations
// This creates the pricing moat through continuous learning from market data
// =============================================================================

import { isSupabaseConfigured } from '../lib/supabase';
import {
  insertPriceObservation,
  bulkInsertPriceObservations,
  getPriceHistory as dbGetPriceHistory,
  getPriceReference as dbGetPriceReference,
  searchMaterials as dbSearchMaterials,
  upsertMaterial as dbUpsertMaterial,
  addMaterialAlias as dbAddMaterialAlias,
  getSuppliers as dbGetSuppliers,
  getSupplierById as dbGetSupplierById,
} from '../lib/intelligenceDataProvider';

const API_BASE = 'http://localhost:8000';

// ============================================
// TYPES
// ============================================

export interface PriceObservation {
  id?: string;
  materialId: string;
  materialName: string;
  supplierId: string;
  supplierName: string;
  price: number;
  currency: string;
  unit: string;

  // Context
  observedAt: string;
  source: 'manual' | 'api' | 'scrape' | 'invoice' | 'quote';
  confidence: number; // 0-1

  // Sale/promo info
  isSale?: boolean;
  saleEndDate?: string;
  regularPrice?: number;

  // Availability
  inStock?: boolean;
  stockLevel?: 'low' | 'medium' | 'high';
  leadTimeDays?: number;

  // Quantity breaks
  minQuantity?: number;
  bulkPricing?: { quantity: number; price: number }[];
}

export interface PriceReference {
  materialId: string;

  // Computed benchmarks
  avgPrice30d: number;
  avgPrice90d: number;
  minPrice30d: number;
  maxPrice30d: number;

  // Trend
  trend: 'rising' | 'stable' | 'falling';
  trendStrength: number; // 0-1
  volatility: number; // Standard deviation

  // Your behavior
  yourAvgPurchasePrice: number;
  yourLastPurchasePrice: number;
  yourLastPurchaseDate: string;
  yourPreferredSupplier: string;

  // Market position
  percentileVsMarket: number; // Where your avg price sits (0-100)
  potentialSavings: number;

  // Seasonality
  seasonalPattern?: {
    month: number;
    multiplier: number;
  }[];

  updatedAt: string;
}

export interface PricingRecommendation {
  id: string;
  materialId: string;
  materialName: string;

  action: 'buy_now' | 'wait' | 'bulk_buy' | 'switch_supplier' | 'negotiate';
  confidence: number;
  urgency: 'immediate' | 'today' | 'this_week' | 'when_convenient';

  // The opportunity
  currentBestPrice: number;
  currentBestSupplier: string;
  yourTypicalPrice: number;
  savingsAmount: number;
  savingsPercent: number;

  // Reasoning
  reasoning: string[];
  dataPoints: number;

  // For bulk opportunities
  bulkQuantity?: number;
  bulkSavings?: number;

  // For supplier switch
  alternativeSupplier?: string;
  alternativePrice?: number;

  // Expiry
  validUntil?: string;
}

export interface SupplierProfile {
  id: string;
  name: string;

  // Relationship
  accountStatus: 'active' | 'inactive' | 'pending';
  creditTerms?: number; // Days
  discountTier?: string;

  // Performance
  reliabilityScore: number; // 0-100
  avgLeadTimeDays: number;
  onTimeDeliveryRate: number;
  qualityScore: number;

  // Pricing
  avgPriceVsMarket: number; // +/- percentage
  priceConsistency: number; // 0-1, how stable their prices are

  // Your history
  totalSpend: number;
  totalOrders: number;
  lastOrderDate: string;

  // Contact
  apiEnabled: boolean;
  catalogUrl?: string;
}

export interface MaterialCatalogEntry {
  id: string;
  name: string;
  brand?: string;
  category: string;
  subcategory?: string;

  // Identification
  sku?: string;
  ean?: string;
  manufacturerCode?: string;

  // Normalized unit
  baseUnit: string;
  unitConversions?: { unit: string; factor: number }[];

  // Aliases for entity resolution
  aliases: string[];

  // Default specs
  specifications?: Record<string, string | number>;

  // Intelligence
  demandPattern: 'steady' | 'seasonal' | 'project_based';
  avgMonthlyUsage?: number;
  reorderPoint?: number;
}

// ============================================
// PRICING API - RPC Style
// ============================================

function mapSupplierRow(r: any): SupplierProfile {
  return {
    id: r.id,
    name: r.name,
    accountStatus: r.account_status ?? 'active',
    creditTerms: r.credit_terms,
    discountTier: r.discount_tier,
    reliabilityScore: r.reliability_score ?? 50,
    avgLeadTimeDays: r.avg_lead_time_days ?? 0,
    onTimeDeliveryRate: r.on_time_delivery_rate ?? 0,
    qualityScore: r.quality_score ?? 0,
    avgPriceVsMarket: r.avg_price_vs_market ?? 0,
    priceConsistency: r.price_consistency ?? 0,
    totalSpend: r.total_spend ?? 0,
    totalOrders: r.total_orders ?? 0,
    lastOrderDate: r.last_order_date ?? '',
    apiEnabled: r.api_enabled ?? false,
    catalogUrl: r.catalog_url,
  };
}

export const pricingApi = {
  // -----------------------------------------
  // Price Observations
  // -----------------------------------------

  /**
   * Record a new price observation from any source
   * This is the core data ingestion for the pricing moat
   */
  async recordPriceObservation(observation: Omit<PriceObservation, 'id'>): Promise<{ id: string; reference: PriceReference | null }> {
    if (isSupabaseConfigured) {
      const id = await insertPriceObservation({
        material_id: observation.materialId,
        material_name: observation.materialName,
        supplier_id: observation.supplierId,
        supplier_name: observation.supplierName,
        price: observation.price,
        currency: observation.currency,
        unit: observation.unit,
        source: observation.source,
        confidence: observation.confidence,
        is_sale: observation.isSale,
        sale_end_date: observation.saleEndDate,
        regular_price: observation.regularPrice,
        in_stock: observation.inStock,
        stock_level: observation.stockLevel,
        lead_time_days: observation.leadTimeDays,
        min_quantity: observation.minQuantity,
        bulk_pricing: observation.bulkPricing,
      });
      const ref = await dbGetPriceReference(observation.materialId);
      return { id: id ?? '', reference: ref };
    }
    const res = await fetch(`${API_BASE}/pricing/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(observation),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to record observation');
    return res.json();
  },

  /**
   * Bulk import price observations (from invoice parsing, catalog scrape, etc)
   */
  async bulkImportPrices(observations: Omit<PriceObservation, 'id'>[]): Promise<{ imported: number; errors: string[] }> {
    if (isSupabaseConfigured) {
      const rows = observations.map((o) => ({
        material_id: o.materialId,
        material_name: o.materialName,
        supplier_id: o.supplierId,
        supplier_name: o.supplierName,
        price: o.price,
        currency: o.currency,
        unit: o.unit,
        source: o.source,
        confidence: o.confidence,
        is_sale: o.isSale,
        in_stock: o.inStock,
      }));
      const count = await bulkInsertPriceObservations(rows);
      return { imported: count, errors: [] };
    }
    const res = await fetch(`${API_BASE}/pricing/observations/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observations }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to import');
    return res.json();
  },

  /**
   * Get price history for a material
   */
  async getPriceHistory(materialId: string, options?: {
    supplierId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<PriceObservation[]> {
    if (isSupabaseConfigured) {
      const rows = await dbGetPriceHistory(materialId, {
        supplierId: options?.supplierId,
        startDate: options?.startDate,
        limit: options?.limit,
      });
      return rows.map((r: any) => ({
        id: r.id,
        materialId: r.material_id,
        materialName: r.material_name,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        price: r.price,
        currency: r.currency,
        unit: r.unit,
        observedAt: r.observed_at,
        source: r.source,
        confidence: r.confidence,
        isSale: r.is_sale,
        inStock: r.in_stock,
        stockLevel: r.stock_level,
        leadTimeDays: r.lead_time_days,
      }));
    }
    const params = new URLSearchParams();
    if (options?.supplierId) params.set('supplier_id', options.supplierId);
    if (options?.startDate) params.set('start_date', options.startDate);
    if (options?.endDate) params.set('end_date', options.endDate);
    if (options?.limit) params.set('limit', String(options.limit));

    const res = await fetch(`${API_BASE}/pricing/materials/${materialId}/history?${params}`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to get history');
    return res.json();
  },

  // -----------------------------------------
  // Price References (Computed Benchmarks)
  // -----------------------------------------

  /**
   * Get computed price reference for a material
   * These are pre-aggregated for fast lookups
   */
  async getPriceReference(materialId: string): Promise<PriceReference> {
    if (isSupabaseConfigured) {
      const ref = await dbGetPriceReference(materialId);
      if (ref) {
        return {
          materialId: ref.material_id,
          avgPrice30d: ref.avg_price_30d ?? 0,
          avgPrice90d: ref.avg_price_90d ?? 0,
          minPrice30d: ref.min_price_30d ?? 0,
          maxPrice30d: ref.max_price_30d ?? 0,
          trend: 'stable',
          trendStrength: 0,
          volatility: ref.volatility ?? 0,
          yourAvgPurchasePrice: ref.avg_price_90d ?? 0,
          yourLastPurchasePrice: 0,
          yourLastPurchaseDate: ref.last_observed_at ?? '',
          yourPreferredSupplier: '',
          percentileVsMarket: 50,
          potentialSavings: 0,
          updatedAt: ref.last_observed_at ?? new Date().toISOString(),
        };
      }
    }
    const res = await fetch(`${API_BASE}/pricing/references/${materialId}`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to get reference');
    return res.json();
  },

  /**
   * Get price references for multiple materials
   */
  async getPriceReferences(materialIds: string[]): Promise<Record<string, PriceReference>> {
    const res = await fetch(`${API_BASE}/pricing/references/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_ids: materialIds }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to get references');
    return res.json();
  },

  /**
   * Trigger recomputation of price references
   * Called after bulk imports or periodically
   */
  async recomputeReferences(materialIds?: string[]): Promise<{ computed: number }> {
    const res = await fetch(`${API_BASE}/pricing/references/recompute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_ids: materialIds || null }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to recompute');
    return res.json();
  },

  // -----------------------------------------
  // Supplier Management
  // -----------------------------------------

  /**
   * Get supplier profile with performance metrics
   */
  async getSupplierProfile(supplierId: string): Promise<SupplierProfile> {
    if (isSupabaseConfigured) {
      const row = await dbGetSupplierById(supplierId);
      if (row) return mapSupplierRow(row);
    }
    const res = await fetch(`${API_BASE}/pricing/suppliers/${supplierId}`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to get supplier');
    return res.json();
  },

  /**
   * Get all suppliers with their profiles
   */
  async getSuppliers(): Promise<SupplierProfile[]> {
    if (isSupabaseConfigured) {
      const rows = await dbGetSuppliers();
      return rows.map(mapSupplierRow);
    }
    const res = await fetch(`${API_BASE}/pricing/suppliers`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to get suppliers');
    return res.json();
  },

  /**
   * Compare prices across suppliers for a material
   */
  async compareSupplierPrices(materialId: string): Promise<{
    material: MaterialCatalogEntry;
    prices: Array<{
      supplier: SupplierProfile;
      currentPrice: number;
      priceVsAvg: number;
      lastUpdated: string;
      inStock: boolean;
    }>;
    recommendation: string;
  }> {
    const res = await fetch(`${API_BASE}/pricing/materials/${materialId}/compare`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to compare');
    return res.json();
  },

  // -----------------------------------------
  // Material Catalog & Entity Resolution
  // -----------------------------------------

  /**
   * Search materials with fuzzy matching
   * Handles aliases and typos
   */
  async searchMaterials(query: string, options?: {
    category?: string;
    limit?: number;
  }): Promise<MaterialCatalogEntry[]> {
    if (isSupabaseConfigured) {
      const rows = await dbSearchMaterials(query, {
        category: options?.category,
        limit: options?.limit,
      });
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        brand: r.brand,
        category: r.category,
        subcategory: r.subcategory,
        sku: r.sku,
        ean: r.ean,
        manufacturerCode: r.manufacturer_code,
        baseUnit: r.base_unit,
        unitConversions: r.unit_conversions,
        aliases: r.aliases ?? [],
        specifications: r.specifications,
        demandPattern: r.demand_pattern,
        avgMonthlyUsage: r.avg_monthly_usage,
        reorderPoint: r.reorder_point,
      }));
    }
    const params = new URLSearchParams({ q: query });
    if (options?.category) params.set('category', options.category);
    if (options?.limit) params.set('limit', String(options.limit));

    const res = await fetch(`${API_BASE}/pricing/materials/search?${params}`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to search');
    return res.json();
  },

  /**
   * Resolve a material name to canonical ID
   * Uses ML for entity resolution
   */
  async resolveMaterial(name: string, context?: {
    supplier?: string;
    brand?: string;
    category?: string;
  }): Promise<{ materialId: string; confidence: number; alternatives?: MaterialCatalogEntry[] }> {
    const res = await fetch(`${API_BASE}/pricing/materials/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, context }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to resolve');
    return res.json();
  },

  /**
   * Add alias for a material (learning from user corrections)
   */
  async addMaterialAlias(materialId: string, alias: string): Promise<void> {
    if (isSupabaseConfigured) {
      await dbAddMaterialAlias(materialId, alias);
      return;
    }
    const res = await fetch(`${API_BASE}/pricing/materials/${materialId}/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to add alias');
  },

  // -----------------------------------------
  // Pricing Agent
  // -----------------------------------------

  /**
   * Get AI-powered pricing recommendations
   * The agent analyzes all data to find opportunities
   */
  async getRecommendations(options?: {
    userId?: string;
    urgencyFilter?: 'all' | 'immediate' | 'today' | 'this_week';
    minSavings?: number;
    limit?: number;
  }): Promise<PricingRecommendation[]> {
    const params = new URLSearchParams();
    if (options?.userId) params.set('user_id', options.userId);
    if (options?.urgencyFilter) params.set('urgency', options.urgencyFilter);
    if (options?.minSavings) params.set('min_savings', String(options.minSavings));
    if (options?.limit) params.set('limit', String(options.limit));

    const res = await fetch(`${API_BASE}/pricing/agent/recommendations?${params}`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to get recommendations');
    return res.json();
  },

  /**
   * Get recommendation for a specific material
   */
  async getMaterialRecommendation(materialId: string, quantity?: number): Promise<PricingRecommendation> {
    const params = new URLSearchParams();
    if (quantity) params.set('quantity', String(quantity));

    const res = await fetch(`${API_BASE}/pricing/agent/recommend/${materialId}?${params}`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to get recommendation');
    return res.json();
  },

  /**
   * Train/retrain the pricing agent with latest data
   */
  async trainAgent(options?: {
    fullRetrain?: boolean;
    materialIds?: string[];
  }): Promise<{ status: string; modelsUpdated: number; accuracy: number }> {
    const res = await fetch(`${API_BASE}/pricing/agent/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to train');
    return res.json();
  },

  /**
   * Record outcome for recommendation (learning feedback)
   */
  async recordRecommendationOutcome(recommendationId: string, outcome: {
    action: 'accepted' | 'rejected' | 'expired';
    actualPrice?: number;
    actualSupplier?: string;
    feedback?: string;
  }): Promise<void> {
    const res = await fetch(`${API_BASE}/pricing/agent/outcomes/${recommendationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outcome),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to record outcome');
  },

  // -----------------------------------------
  // External Data Sources
  // -----------------------------------------

  /**
   * Fetch latest prices from supplier API
   */
  async syncSupplierCatalog(supplierId: string): Promise<{ synced: number; updated: number; errors: string[] }> {
    const res = await fetch(`${API_BASE}/pricing/sources/suppliers/${supplierId}/sync`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to sync');
    return res.json();
  },

  /**
   * Parse prices from uploaded invoice/quote PDF
   */
  async extractPricesFromDocument(documentId: string): Promise<{
    extracted: PriceObservation[];
    needsReview: Array<{ text: string; suggestedMaterial?: string; suggestedPrice?: number }>;
  }> {
    const res = await fetch(`${API_BASE}/pricing/sources/documents/${documentId}/extract`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to extract');
    return res.json();
  },

  // -----------------------------------------
  // Analytics
  // -----------------------------------------

  /**
   * Get pricing analytics dashboard data
   */
  async getAnalytics(options?: {
    period?: '7d' | '30d' | '90d' | '1y';
    category?: string;
  }): Promise<{
    totalSavingsOpportunity: number;
    avgPriceVsMarket: number;
    topOpportunities: PricingRecommendation[];
    priceAlerts: number;
    supplierPerformance: Array<{ supplierId: string; name: string; score: number }>;
    categoryBreakdown: Array<{ category: string; spend: number; savingsOpp: number }>;
    trendingMaterials: Array<{ materialId: string; name: string; trend: string; change: number }>;
  }> {
    const params = new URLSearchParams();
    if (options?.period) params.set('period', options.period);
    if (options?.category) params.set('category', options.category);

    const res = await fetch(`${API_BASE}/pricing/analytics?${params}`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to get analytics');
    return res.json();
  },

  /**
   * Get spend analysis by supplier
   */
  async getSpendAnalysis(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalSpend: number;
    bySupplier: Array<{ supplier: string; spend: number; percentage: number }>;
    byCategory: Array<{ category: string; spend: number; percentage: number }>;
    savingsAchieved: number;
    savingsMissed: number;
  }> {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('start_date', options.startDate);
    if (options?.endDate) params.set('end_date', options.endDate);

    const res = await fetch(`${API_BASE}/pricing/analytics/spend?${params}`);
    if (!res.ok) throw new Error((await res.json()).detail || 'Failed to get spend analysis');
    return res.json();
  },
};

// ============================================
// HOOKS FOR REACT COMPONENTS
// ============================================

import { useState, useEffect, useCallback } from 'react';

export function usePriceReference(materialId: string | undefined) {
  const [reference, setReference] = useState<PriceReference | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!materialId) return;

    setLoading(true);
    pricingApi.getPriceReference(materialId)
      .then(setReference)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [materialId]);

  return { reference, loading, error };
}

export function usePricingRecommendations(options?: Parameters<typeof pricingApi.getRecommendations>[0]) {
  const [recommendations, setRecommendations] = useState<PricingRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    pricingApi.getRecommendations(options)
      .then(setRecommendations)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [options]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { recommendations, loading, error, refresh };
}

export function useSupplierComparison(materialId: string | undefined) {
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof pricingApi.compareSupplierPrices>> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!materialId) return;

    setLoading(true);
    pricingApi.compareSupplierPrices(materialId)
      .then(setComparison)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [materialId]);

  return { comparison, loading };
}
