// =============================================================================
// PRICING INTELLIGENCE AGENT
// =============================================================================
// Client-side agent that orchestrates pricing intelligence collection and
// recommendation surfacing. Integrates with the pricing API for backend ML.
// =============================================================================

import { pricingApi, PriceObservation, PricingRecommendation, PriceReference } from '../api/pricingApi';
import { intelligence, trackUserAction } from './intelligenceEngine';
import { logWarn, logInfo } from '../utils/errorHandler';

// ============================================
// AGENT CONFIGURATION
// ============================================

interface PricingAgentConfig {
  // Thresholds for recommendations
  minSavingsToAlert: number;           // Minimum € savings to show alert
  minSavingsPercentToAlert: number;    // Minimum % savings to show alert

  // Sync settings
  autoSyncIntervalMs: number;          // How often to check for new prices
  maxPriceAgeHours: number;            // Consider prices stale after this

  // Learning
  trackAllPriceViews: boolean;         // Track when user views any price
  trackSearches: boolean;              // Track material searches

  // Notifications
  enablePushNotifications: boolean;
  notifyOnImmediateOpportunities: boolean;
}

const DEFAULT_CONFIG: PricingAgentConfig = {
  minSavingsToAlert: 5,
  minSavingsPercentToAlert: 5,
  autoSyncIntervalMs: 30 * 60 * 1000, // 30 minutes
  maxPriceAgeHours: 24,
  trackAllPriceViews: true,
  trackSearches: true,
  enablePushNotifications: true,
  notifyOnImmediateOpportunities: true,
};

// ============================================
// PRICING AGENT CLASS
// ============================================

class PricingAgent {
  private config: PricingAgentConfig;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private cachedRecommendations: PricingRecommendation[] = [];
  private lastSyncTime: Date | null = null;

  constructor(config: Partial<PricingAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -----------------------------------------
  // Lifecycle
  // -----------------------------------------

  /**
   * Start the pricing agent - call on app startup
   */
  start(): void {
    logInfo('PricingAgent', 'Starting...');

    // Initial sync
    this.syncRecommendations();

    // Set up periodic sync
    if (this.config.autoSyncIntervalMs > 0) {
      this.syncInterval = setInterval(() => {
        this.syncRecommendations();
      }, this.config.autoSyncIntervalMs);
    }
  }

  /**
   * Stop the pricing agent - call on app shutdown
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    logInfo('PricingAgent', 'Stopped');
  }

  // -----------------------------------------
  // Data Collection
  // -----------------------------------------

  /**
   * Record a price observation from any source
   * This feeds the pricing intelligence moat
   */
  async recordPrice(observation: Omit<PriceObservation, 'id'>): Promise<PriceReference> {
    try {
      const result = await pricingApi.recordPriceObservation(observation);

      // Track for general intelligence
      trackUserAction('material_price_checked', {
        materialId: observation.materialId,
        materialName: observation.materialName,
        supplierId: observation.supplierId,
        supplierName: observation.supplierName,
        price: observation.price,
        source: observation.source,
      }, [
        { id: observation.materialId, type: 'material', name: observation.materialName, confidence: 1 },
      ]);

      // Check if this creates a new opportunity
      if (result.reference) {
        await this.checkForOpportunity(observation.materialId, result.reference);
      }

      return result.reference!;
    } catch (error) {
      logWarn('PricingAgent', `Failed to record price: ${error}`);
      throw error;
    }
  }

  /**
   * Bulk import prices (from invoice parsing, catalog sync, etc)
   */
  async bulkImportPrices(observations: Omit<PriceObservation, 'id'>[]): Promise<{ imported: number; errors: string[] }> {
    try {
      const result = await pricingApi.bulkImportPrices(observations);

      // Track the import event
      trackUserAction('document_extracted', {
        observationCount: result.imported,
        errorCount: result.errors.length,
        source: 'bulk_import',
      });

      // Refresh recommendations after bulk import
      await this.syncRecommendations();

      return result;
    } catch (error) {
      logWarn('PricingAgent', `Bulk import failed: ${error}`);
      throw error;
    }
  }

  /**
   * Extract prices from a document (invoice, quote, catalog)
   */
  async extractFromDocument(documentId: string): Promise<{
    extracted: PriceObservation[];
    needsReview: Array<{ text: string; suggestedMaterial?: string; suggestedPrice?: number }>;
  }> {
    try {
      const result = await pricingApi.extractPricesFromDocument(documentId);

      trackUserAction('document_extracted', {
        documentId,
        extractedCount: result.extracted.length,
        needsReviewCount: result.needsReview.length,
      });

      return result;
    } catch (error) {
      logWarn('PricingAgent', `Document extraction failed: ${error}`);
      throw error;
    }
  }

  // -----------------------------------------
  // Recommendations
  // -----------------------------------------

  /**
   * Get current pricing recommendations
   */
  async getRecommendations(options?: {
    urgencyFilter?: 'all' | 'immediate' | 'today' | 'this_week';
    minSavings?: number;
    limit?: number;
  }): Promise<PricingRecommendation[]> {
    try {
      const recommendations = await pricingApi.getRecommendations({
        ...options,
        minSavings: options?.minSavings ?? this.config.minSavingsToAlert,
      });

      this.cachedRecommendations = recommendations;
      return recommendations;
    } catch (error) {
      logWarn('PricingAgent', `Failed to get recommendations: ${error}`);
      return this.cachedRecommendations; // Return cached on error
    }
  }

  /**
   * Get cached recommendations (no API call)
   */
  getCachedRecommendations(): PricingRecommendation[] {
    return this.cachedRecommendations;
  }

  /**
   * Get recommendation for a specific material
   */
  async getMaterialRecommendation(materialId: string, quantity?: number): Promise<PricingRecommendation | null> {
    try {
      return await pricingApi.getMaterialRecommendation(materialId, quantity);
    } catch (error) {
      logWarn('PricingAgent', `Failed to get material recommendation: ${error}`);
      return null;
    }
  }

  /**
   * Record user action on a recommendation
   */
  async recordRecommendationAction(
    recommendationId: string,
    action: 'accepted' | 'rejected' | 'expired',
    details?: {
      actualPrice?: number;
      actualSupplier?: string;
      feedback?: string;
    }
  ): Promise<void> {
    try {
      await pricingApi.recordRecommendationOutcome(recommendationId, {
        action,
        ...details,
      });

      // Track for general intelligence
      trackUserAction(
        action === 'accepted' ? 'ai_recommendation_accepted' : 'ai_recommendation_rejected',
        {
          recommendationId,
          type: 'pricing',
          ...details,
        }
      );

      // Remove from cache
      this.cachedRecommendations = this.cachedRecommendations.filter(
        r => r.id !== recommendationId
      );
    } catch (error) {
      logWarn('PricingAgent', `Failed to record action: ${error}`);
    }
  }

  // -----------------------------------------
  // Price Comparison
  // -----------------------------------------

  /**
   * Compare prices across suppliers for a material
   */
  async compareSupplierPrices(materialId: string) {
    try {
      const comparison = await pricingApi.compareSupplierPrices(materialId);

      // Track the comparison view
      if (this.config.trackAllPriceViews) {
        trackUserAction('material_price_checked', {
          materialId,
          action: 'compare_suppliers',
          supplierCount: comparison.prices.length,
        });
      }

      return comparison;
    } catch (error) {
      logWarn('PricingAgent', `Failed to compare prices: ${error}`);
      throw error;
    }
  }

  /**
   * Get price reference (benchmark) for a material
   */
  async getPriceReference(materialId: string): Promise<PriceReference | null> {
    try {
      return await pricingApi.getPriceReference(materialId);
    } catch (error) {
      logWarn('PricingAgent', `Failed to get price reference: ${error}`);
      return null;
    }
  }

  // -----------------------------------------
  // Material Search & Resolution
  // -----------------------------------------

  /**
   * Search for materials with fuzzy matching
   */
  async searchMaterials(query: string, category?: string) {
    try {
      const results = await pricingApi.searchMaterials(query, { category, limit: 20 });

      // Track search for learning
      if (this.config.trackSearches) {
        trackUserAction('material_searched', {
          query,
          category,
          resultCount: results.length,
        });
      }

      return results;
    } catch (error) {
      logWarn('PricingAgent', `Material search failed: ${error}`);
      return [];
    }
  }

  /**
   * Resolve a material name to canonical ID
   */
  async resolveMaterial(name: string, context?: { supplier?: string; brand?: string; category?: string }) {
    try {
      return await pricingApi.resolveMaterial(name, context);
    } catch (error) {
      logWarn('PricingAgent', `Material resolution failed: ${error}`);
      return null;
    }
  }

  /**
   * Teach the system a new alias
   */
  async teachMaterialAlias(materialId: string, alias: string): Promise<void> {
    try {
      await pricingApi.addMaterialAlias(materialId, alias);
      logInfo('PricingAgent', `Learned new alias: ${alias} -> ${materialId}`);
    } catch (error) {
      logWarn('PricingAgent', `Failed to add alias: ${error}`);
    }
  }

  // -----------------------------------------
  // Supplier Management
  // -----------------------------------------

  /**
   * Sync prices from a supplier's catalog/API
   */
  async syncSupplierCatalog(supplierId: string) {
    try {
      const result = await pricingApi.syncSupplierCatalog(supplierId);

      trackUserAction('material_price_checked', {
        action: 'supplier_sync',
        supplierId,
        synced: result.synced,
        updated: result.updated,
      });

      // Refresh recommendations after sync
      await this.syncRecommendations();

      return result;
    } catch (error) {
      logWarn('PricingAgent', `Supplier sync failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get supplier profile with performance metrics
   */
  async getSupplierProfile(supplierId: string) {
    return pricingApi.getSupplierProfile(supplierId);
  }

  /**
   * Get all suppliers
   */
  async getSuppliers() {
    return pricingApi.getSuppliers();
  }

  // -----------------------------------------
  // Analytics
  // -----------------------------------------

  /**
   * Get pricing analytics dashboard data
   */
  async getAnalytics(period: '7d' | '30d' | '90d' | '1y' = '30d', category?: string) {
    return pricingApi.getAnalytics({ period, category });
  }

  /**
   * Get spend analysis
   */
  async getSpendAnalysis(startDate?: string, endDate?: string) {
    return pricingApi.getSpendAnalysis({ startDate, endDate });
  }

  // -----------------------------------------
  // Agent Training
  // -----------------------------------------

  /**
   * Trigger agent retraining with latest data
   */
  async retrain(fullRetrain = false): Promise<{ status: string; modelsUpdated: number; accuracy: number }> {
    try {
      const result = await pricingApi.trainAgent({ fullRetrain });
      logInfo('PricingAgent', `Training complete: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      logWarn('PricingAgent', `Training failed: ${error}`);
      throw error;
    }
  }

  // -----------------------------------------
  // Private Methods
  // -----------------------------------------

  private async syncRecommendations(): Promise<void> {
    try {
      logInfo('PricingAgent', 'Syncing recommendations...');
      const recommendations = await pricingApi.getRecommendations({
        minSavings: this.config.minSavingsToAlert,
      });
      this.cachedRecommendations = recommendations;
      this.lastSyncTime = new Date();

      // Check for immediate opportunities to notify
      if (this.config.notifyOnImmediateOpportunities) {
        const immediate = recommendations.filter(r => r.urgency === 'immediate');
        if (immediate.length > 0) {
          this.notifyOpportunities(immediate);
        }
      }

      logInfo('PricingAgent', `Synced ${recommendations.length} recommendations`);
    } catch (error) {
      logWarn('PricingAgent', `Sync failed: ${error}`);
    }
  }

  private async checkForOpportunity(materialId: string, reference: PriceReference): Promise<void> {
    // Check if this price creates a buy opportunity
    if (reference.potentialSavings >= this.config.minSavingsToAlert) {
      const savingsPercent = (reference.potentialSavings / reference.yourAvgPurchasePrice) * 100;
      if (savingsPercent >= this.config.minSavingsPercentToAlert) {
        // Get full recommendation from agent
        const rec = await this.getMaterialRecommendation(materialId);
        if (rec && rec.action === 'buy_now') {
          this.notifyOpportunities([rec]);
        }
      }
    }
  }

  private notifyOpportunities(recommendations: PricingRecommendation[]): void {
    if (!this.config.enablePushNotifications) return;

    // In a real implementation, this would trigger push notifications
    logInfo('PricingAgent', `New opportunities: ${recommendations.map(r => r.materialName).join(', ')}`);

    // For now, we'll emit an event that the UI can subscribe to
    // This could be implemented with EventEmitter, Zustand, or similar
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const pricingAgent = new PricingAgent();

// ============================================
// HOOKS
// ============================================

import { useState, useEffect, useCallback } from 'react';

export function usePricingAgent() {
  return pricingAgent;
}

export function usePricingRecommendations(autoRefresh = true) {
  const [recommendations, setRecommendations] = useState<PricingRecommendation[]>(
    pricingAgent.getCachedRecommendations()
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const recs = await pricingAgent.getRecommendations();
      setRecommendations(recs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      refresh();
    }
  }, [autoRefresh, refresh]);

  const acceptRecommendation = useCallback(async (id: string, details?: { actualPrice?: number }) => {
    await pricingAgent.recordRecommendationAction(id, 'accepted', details);
    setRecommendations(prev => prev.filter(r => r.id !== id));
  }, []);

  const rejectRecommendation = useCallback(async (id: string, feedback?: string) => {
    await pricingAgent.recordRecommendationAction(id, 'rejected', { feedback });
    setRecommendations(prev => prev.filter(r => r.id !== id));
  }, []);

  return {
    recommendations,
    loading,
    refresh,
    acceptRecommendation,
    rejectRecommendation,
  };
}

export function useMaterialPriceComparison(materialId: string | undefined) {
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof pricingAgent.compareSupplierPrices>> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!materialId) return;

    setLoading(true);
    pricingAgent.compareSupplierPrices(materialId)
      .then(setComparison)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [materialId]);

  return { comparison, loading };
}

export function usePricingAnalytics(period: '7d' | '30d' | '90d' | '1y' = '30d') {
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof pricingAgent.getAnalytics>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pricingAgent.getAnalytics(period)
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  return { analytics, loading };
}
