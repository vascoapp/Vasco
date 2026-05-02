// =============================================================================
// DECISION INTELLIGENCE SERVICE
// =============================================================================
// Captures customer decision data and feeds it into the pricing/market moat
// Every customer choice becomes training data for recommendations
// =============================================================================

import { pricingApi, PriceObservation } from '../api/pricingApi';
import { trackUserAction } from './intelligenceEngine';
import { logWarn, logInfo } from '../utils/errorHandler';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  CustomerDecisionSubmission,
  DecisionIntelligenceData,
  CustomerPortalActivity,
} from '../types/customerPortal';
import type { CustomerDecisionItem } from '../types/decisions';

// ============================================
// TYPES
// ============================================

interface ProductExtraction {
  name: string;
  brand?: string;
  category: string;
  price?: number;
  retailer?: string;
  url?: string;
  confidence: number;
}

interface RegionalPreference {
  region: string;
  trade: string;
  decisionType: string;
  choices: {
    value: string;
    label: string;
    count: number;
    percentage: number;
  }[];
  totalDecisions: number;
  lastUpdated: string;
}

interface DecisionTiming {
  decisionType: string;
  avgDaysToDecide: number;
  medianDaysToDecide: number;
  overdueRate: number;
  reminderEffectiveness: number; // % who decide within 24h of reminder
}

// ============================================
// DECISION INTELLIGENCE SERVICE
// ============================================

class DecisionIntelligenceService {
  private activityBuffer: CustomerPortalActivity[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  // -----------------------------------------
  // Lifecycle
  // -----------------------------------------

  start(): void {
    logInfo('DecisionIntelligence', 'Starting...');

    // Flush buffered activities periodically
    this.flushInterval = setInterval(() => {
      this.flushActivityBuffer();
    }, 30000); // Every 30 seconds
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushActivityBuffer();
    logInfo('DecisionIntelligence', 'Stopped');
  }

  // -----------------------------------------
  // Decision Capture
  // -----------------------------------------

  /**
   * Process a customer decision submission
   * This is the main entry point for capturing decision data
   */
  async processDecisionSubmission(
    submission: CustomerDecisionSubmission,
    item: CustomerDecisionItem,
    context: {
      trade: string;
      projectType: string;
      region: string;
      projectBudget?: 'budget' | 'mid-range' | 'premium';
      propertyType?: 'apartment' | 'house' | 'commercial';
    }
  ): Promise<void> {
    logInfo('DecisionIntelligence', `Processing decision: ${item.name}`);

    // 1. Extract intelligence data
    const intelligenceData = this.extractIntelligenceData(submission, item, context);

    // 2. If there's a linked product, create price observation
    if (submission.linkedProduct) {
      await this.processLinkedProduct(submission.linkedProduct, item, context);
    }

    // 3. Track for general intelligence
    this.trackDecisionEvent(intelligenceData);

    // 4. Update regional preferences
    await this.updateRegionalPreferences(intelligenceData);

    // 5. Update decision timing analytics
    await this.updateDecisionTiming(submission, item);
  }

  /**
   * Extract structured intelligence data from a submission
   */
  private extractIntelligenceData(
    submission: CustomerDecisionSubmission,
    item: CustomerDecisionItem,
    context: {
      trade: string;
      projectType: string;
      region: string;
      projectBudget?: 'budget' | 'mid-range' | 'premium';
      propertyType?: 'apartment' | 'house' | 'commercial';
    }
  ): DecisionIntelligenceData {
    const chosenLabel = item.options?.find(o => o.value === submission.value)?.label;

    return {
      id: `intel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      decisionType: item.itemId || item.id,
      trade: context.trade,
      projectType: context.projectType,
      chosenValue: String(submission.value),
      chosenLabel,
      linkedProduct: submission.linkedProduct ? {
        name: submission.linkedProduct.name,
        brand: submission.linkedProduct.brand || this.extractBrand(submission.linkedProduct.name) || '',
        category: this.inferProductCategory(item.name, context.trade),
        price: submission.linkedProduct.price,
        retailer: submission.linkedProduct.retailer,
        url: submission.linkedProduct.url,
      } : undefined,
      region: context.region,
      projectBudget: context.projectBudget,
      propertyType: context.propertyType,
      daysBeforeDeadline: this.calculateDaysBeforeDeadline(item.dueDate, submission.submittedAt),
      wasOverdue: item.isOverdue,
      reminderCount: item.remindersSent,
      timeToDecide: submission.timeToDecide || 0,
      viewCount: 1, // Would come from activity tracking
      capturedAt: submission.submittedAt,
    };
  }

  // -----------------------------------------
  // Product & Price Extraction
  // -----------------------------------------

  /**
   * Process a linked product and feed into pricing moat
   */
  private async processLinkedProduct(
    linkedProduct: NonNullable<CustomerDecisionSubmission['linkedProduct']>,
    item: CustomerDecisionItem,
    context: { trade: string; projectType: string; region: string }
  ): Promise<void> {
    // Extract product details
    const extraction = this.extractProductDetails(linkedProduct, item);

    if (!extraction) {
      logInfo('DecisionIntelligence', 'Could not extract product details');
      return;
    }

    // If we have price info, create a price observation
    if (extraction.price && extraction.retailer) {
      const observation: Omit<PriceObservation, 'id'> = {
        materialId: this.generateMaterialId(extraction),
        materialName: extraction.name,
        supplierId: this.normalizeRetailerId(extraction.retailer),
        supplierName: extraction.retailer,
        price: extraction.price,
        currency: 'EUR',
        unit: 'piece', // Would need smarter inference
        observedAt: new Date().toISOString(),
        source: 'quote', // Customer selection counts as a quote-level observation
        confidence: extraction.confidence,
      };

      try {
        await pricingApi.recordPriceObservation(observation);
        logInfo('DecisionIntelligence', `Price observation recorded: ${extraction.name}`);
      } catch (error) {
        logWarn('DecisionIntelligence', `Failed to record price: ${error}`);
      }
    }

    // Track product preference even without price
    trackUserAction('product_selected_by_customer', {
      productName: extraction.name,
      brand: extraction.brand,
      category: extraction.category,
      price: extraction.price,
      retailer: extraction.retailer,
      trade: context.trade,
      projectType: context.projectType,
      region: context.region,
      decisionItem: item.name,
    });
  }

  /**
   * Extract product details from linked product data
   */
  private extractProductDetails(
    linkedProduct: NonNullable<CustomerDecisionSubmission['linkedProduct']>,
    item: CustomerDecisionItem
  ): ProductExtraction | null {
    const { name, brand, price, retailer, url } = linkedProduct;

    // Try to extract brand from name if not provided
    const extractedBrand = brand || this.extractBrand(name);

    // Infer category from decision item
    const category = this.inferProductCategory(item.name, 'general');

    // Calculate confidence based on data completeness
    let confidence = 0.5;
    if (price) confidence += 0.2;
    if (retailer) confidence += 0.15;
    if (brand || extractedBrand) confidence += 0.1;
    if (url) confidence += 0.05;

    return {
      name,
      brand: extractedBrand,
      category,
      price,
      retailer,
      url,
      confidence: Math.min(confidence, 1),
    };
  }

  /**
   * Extract brand from product name using common patterns
   */
  private extractBrand(name: string): string | undefined {
    // Common Dutch/EU building material brands
    const brands = [
      'Grohe', 'Hansgrohe', 'Geberit', 'Villeroy & Boch', 'Duravit', 'Ideal Standard',
      'Mosa', 'Sphinx', 'Bruynzeel', 'Kvik', 'IKEA', 'Karwei', 'Praxis', 'Gamma',
      'Flexa', 'Sikkens', 'Dulux', 'Sigma', 'Wijzonol',
      'Philips', 'Niko', 'Busch-Jaeger', 'Gira', 'Jung', 'Schneider',
      'Bosch', 'Siemens', 'AEG', 'Miele', 'Neff', 'Atag',
      'Desso', 'Interface', 'Forbo', 'Tarkett',
      'Velux', 'Fakro', 'Roto',
    ];

    const nameLower = name.toLowerCase();
    for (const brand of brands) {
      if (nameLower.includes(brand.toLowerCase())) {
        return brand;
      }
    }

    return undefined;
  }

  /**
   * Infer product category from decision item name
   */
  private inferProductCategory(itemName: string, trade: string): string {
    const itemLower = itemName.toLowerCase();

    // Bathroom
    if (itemLower.includes('toilet')) return 'toilets';
    if (itemLower.includes('wastafel') || itemLower.includes('sink') || itemLower.includes('basin')) return 'sinks';
    if (itemLower.includes('douche') || itemLower.includes('shower')) return 'showers';
    if (itemLower.includes('bad') || itemLower.includes('bath')) return 'bathtubs';
    if (itemLower.includes('kraan') || itemLower.includes('tap') || itemLower.includes('faucet')) return 'faucets';

    // Tiles
    if (itemLower.includes('tegel') || itemLower.includes('tile')) {
      if (itemLower.includes('vloer') || itemLower.includes('floor')) return 'floor_tiles';
      if (itemLower.includes('wand') || itemLower.includes('wall')) return 'wall_tiles';
      return 'tiles';
    }

    // Paint
    if (itemLower.includes('verf') || itemLower.includes('paint') || itemLower.includes('kleur') || itemLower.includes('color')) {
      return 'paint';
    }

    // Kitchen
    if (itemLower.includes('keuken') || itemLower.includes('kitchen') || itemLower.includes('cabinet')) return 'kitchen_cabinets';
    if (itemLower.includes('aanrecht') || itemLower.includes('counter') || itemLower.includes('worktop')) return 'countertops';
    if (itemLower.includes('apparaat') || itemLower.includes('appliance')) return 'appliances';

    // Electrical
    if (itemLower.includes('stopcontact') || itemLower.includes('outlet') || itemLower.includes('socket')) return 'electrical_outlets';
    if (itemLower.includes('schakelaar') || itemLower.includes('switch')) return 'switches';
    if (itemLower.includes('lamp') || itemLower.includes('light') || itemLower.includes('verlichting')) return 'lighting';

    // Flooring
    if (itemLower.includes('vloer') || itemLower.includes('floor')) return 'flooring';
    if (itemLower.includes('laminaat') || itemLower.includes('laminate')) return 'laminate_flooring';
    if (itemLower.includes('parket') || itemLower.includes('wood')) return 'wood_flooring';

    // Default to trade
    return trade || 'other';
  }

  /**
   * Generate a material ID for price tracking
   */
  private generateMaterialId(extraction: ProductExtraction): string {
    const parts = [
      extraction.category,
      extraction.brand?.toLowerCase().replace(/\s+/g, '_'),
      extraction.name.toLowerCase().replace(/\s+/g, '_').substring(0, 30),
    ].filter(Boolean);

    return parts.join('_');
  }

  /**
   * Normalize retailer name to ID
   */
  private normalizeRetailerId(retailer: string): string {
    const retailerMap: Record<string, string> = {
      'hornbach': 'hornbach_nl',
      'praxis': 'praxis_nl',
      'gamma': 'gamma_nl',
      'karwei': 'karwei_nl',
      'bouwmaat': 'bouwmaat_nl',
      'technische unie': 'technische_unie_nl',
      'sanitairwinkel': 'sanitairwinkel_nl',
      'tegeldepot': 'tegeldepot_nl',
      'ikea': 'ikea_nl',
    };

    const retailerLower = retailer.toLowerCase();
    for (const [key, value] of Object.entries(retailerMap)) {
      if (retailerLower.includes(key)) {
        return value;
      }
    }

    return retailer.toLowerCase().replace(/\s+/g, '_');
  }

  // -----------------------------------------
  // Regional Preferences
  // -----------------------------------------

  /**
   * Update regional preference aggregations
   */
  private async updateRegionalPreferences(data: DecisionIntelligenceData): Promise<void> {
    // Local-only tracking event (kept for legacy intelligence engine).
    trackUserAction('regional_preference_recorded', {
      region: data.region,
      trade: data.trade,
      decisionType: data.decisionType,
      chosenValue: data.chosenValue,
      chosenLabel: data.chosenLabel,
      projectBudget: data.projectBudget,
      propertyType: data.propertyType,
    });
    // R301: BE upsert. Closes R291 dormancy — `getRegionalPreferences`
    // can now return real data once k-anonymity floor is hit.
    if (!isSupabaseConfigured) return;
    try {
      await (supabase.rpc as any)('upsert_regional_preference', {
        p_region: data.region,
        p_trade: data.trade,
        p_decision_type: data.decisionType,
        p_chosen_value: data.chosenValue,
        p_chosen_label: data.chosenLabel ?? null,
      });
    } catch {
      // Best-effort. Local trackUserAction is the audit trail.
    }
  }

  /**
   * Get regional preferences for a decision type.
   * R291: was hardcoded mock; R301 wires the real aggregation pipeline
   * (`regional_preference_aggregates` + `get_regional_preferences` RPC,
   * migration `20260502000004_decision_aggregates.sql`). Returns null
   * when total decision_count < 20 (k-anonymity floor enforced server-side).
   */
  async getRegionalPreferences(
    region: string,
    trade: string,
    decisionType: string
  ): Promise<RegionalPreference | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await (supabase.rpc as any)('get_regional_preferences', {
        p_region: region,
        p_trade: trade,
        p_decision_type: decisionType,
      });
      if (error || !Array.isArray(data) || data.length === 0) return null;
      return {
        region,
        trade,
        decisionType,
        choices: (data as any[]).map((r) => ({
          value: String(r.chosen_value),
          label: String(r.chosen_label ?? r.chosen_value),
          count: Number(r.count),
          percentage: Number(r.percentage),
        })),
        totalDecisions: Number(data[0]?.total_decisions ?? 0),
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  // -----------------------------------------
  // Decision Timing Analytics
  // -----------------------------------------

  /**
   * Update timing analytics for a decision
   */
  private async updateDecisionTiming(
    submission: CustomerDecisionSubmission,
    item: CustomerDecisionItem
  ): Promise<void> {
    const daysToDecide = submission.timeToDecide
      ? submission.timeToDecide / (24 * 60 * 60) // Convert seconds to days
      : undefined;

    trackUserAction('decision_timing_recorded', {
      decisionType: item.itemId || item.id,
      daysToDecide,
      wasOverdue: item.isOverdue,
      reminderCount: item.remindersSent,
      priority: item.priority,
    });
    // R301: BE upsert. `getDecisionTiming` reads the rolled-up table.
    if (!isSupabaseConfigured) return;
    try {
      await (supabase.rpc as any)('upsert_decision_timing', {
        p_decision_type: item.itemId || item.id,
        p_days_to_decide: daysToDecide ?? null,
        p_was_overdue: Boolean(item.isOverdue),
        p_reminder_responsive: Boolean(item.isOverdue && (item.remindersSent ?? 0) > 0),
      });
    } catch {
      // Best-effort.
    }
  }

  /**
   * Get timing analytics for a decision type.
   * R291: hardcoded mock; R301 wires `get_decision_timing` RPC backed by
   * `decision_timing_aggregates`. K-anonymity ≥20 submissions enforced
   * server-side; below that returns null.
   */
  async getDecisionTiming(decisionType: string): Promise<DecisionTiming | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await (supabase.rpc as any)('get_decision_timing', {
        p_decision_type: decisionType,
      });
      if (error || !Array.isArray(data) || data.length === 0) return null;
      const row = data[0];
      return {
        decisionType,
        avgDaysToDecide: Number(row.avg_days_to_decide ?? 0),
        medianDaysToDecide: Number(row.median_days_to_decide ?? row.avg_days_to_decide ?? 0),
        overdueRate: Number(row.overdue_rate ?? 0),
        reminderEffectiveness: Number(row.reminder_effectiveness ?? 0),
      };
    } catch {
      return null;
    }
  }

  // -----------------------------------------
  // Activity Tracking
  // -----------------------------------------

  /**
   * Buffer a portal activity for batch processing
   */
  trackActivity(activity: CustomerPortalActivity): void {
    this.activityBuffer.push(activity);

    // Immediate flush if buffer is large
    if (this.activityBuffer.length >= 50) {
      this.flushActivityBuffer();
    }
  }

  /**
   * Flush buffered activities to backend.
   * R291: "batch send to backend" comment was aspirational. Today we only
   * emit trackUserAction events — those go to the local intelligence engine,
   * NOT to a server-side aggregation table. Portal activities never reach
   * BE for cross-contractor cohort analysis.
   *
   * Real fix needed: BE table `customer_portal_events` (already in
   * SCHEMA_LOCK Tier 3) + bulk insert here. Currently the table exists
   * but nothing writes to it.
   */
  private async flushActivityBuffer(): Promise<void> {
    if (this.activityBuffer.length === 0) return;

    const activities = [...this.activityBuffer];
    this.activityBuffer = [];

    logInfo('DecisionIntelligence', `Flushing ${activities.length} activities (local only — see R291)`);

    for (const activity of activities) {
      trackUserAction(`portal_${activity.action}`, {
        trackerId: activity.trackerId,
        customerId: activity.customerId,
        itemId: activity.itemId,
        categoryId: activity.categoryId,
        deviceType: activity.deviceType,
        ...activity.metadata,
      });
    }
  }

  // -----------------------------------------
  // Tracking Helpers
  // -----------------------------------------

  private trackDecisionEvent(data: DecisionIntelligenceData): void {
    trackUserAction('customer_decision_made', {
      decisionType: data.decisionType,
      trade: data.trade,
      projectType: data.projectType,
      region: data.region,
      projectBudget: data.projectBudget,
      propertyType: data.propertyType,
      hasLinkedProduct: !!data.linkedProduct,
      wasOverdue: data.wasOverdue,
      reminderCount: data.reminderCount,
      daysBeforeDeadline: data.daysBeforeDeadline,
    });
  }

  private calculateDaysBeforeDeadline(dueDate: string, submittedAt: string): number {
    const due = new Date(dueDate).getTime();
    const submitted = new Date(submittedAt).getTime();
    return Math.floor((due - submitted) / (1000 * 60 * 60 * 24));
  }

  // -----------------------------------------
  // Material Intelligence (shared across app)
  // -----------------------------------------

  /**
   * Auto-categorize a material name using brand extraction + category inference.
   * Used by invoice processing, TCO comparisons, and cost tracking.
   */
  categorizeMaterial(materialName: string, trade: string = 'general'): {
    brand?: string;
    category: string;
    confidence: number;
  } {
    const brand = this.extractBrand(materialName);
    const category = this.inferProductCategory(materialName, trade);
    let confidence = 0.5;
    if (brand) confidence += 0.25;
    if (category !== trade && category !== 'other') confidence += 0.25;
    return { brand, category, confidence: Math.min(confidence, 1) };
  }

  /**
   * Batch categorize materials and find cross-supplier price opportunities.
   * Returns materials grouped by category with brand info.
   */
  analyzeMaterialSpend(
    materials: Array<{ name: string; cost: number; supplier?: string }>
  ): Array<{
    category: string;
    totalSpend: number;
    items: Array<{ name: string; brand?: string; cost: number; supplier?: string }>;
    brandConcentration: string | null;
  }> {
    const categoryMap = new Map<string, Array<{ name: string; brand?: string; cost: number; supplier?: string }>>();

    for (const mat of materials) {
      const { brand, category } = this.categorizeMaterial(mat.name);
      const items = categoryMap.get(category) || [];
      items.push({ name: mat.name, brand, cost: mat.cost, supplier: mat.supplier });
      categoryMap.set(category, items);
    }

    const results: Array<{
      category: string;
      totalSpend: number;
      items: Array<{ name: string; brand?: string; cost: number; supplier?: string }>;
      brandConcentration: string | null;
    }> = [];

    for (const [category, items] of categoryMap) {
      const totalSpend = items.reduce((s, i) => s + i.cost, 0);
      const brands = items.map(i => i.brand).filter(Boolean);
      const brandCounts = new Map<string, number>();
      for (const b of brands) {
        brandCounts.set(b!, (brandCounts.get(b!) || 0) + 1);
      }
      const topBrand = brands.length > 0
        ? [...brandCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null
        : null;

      results.push({ category, totalSpend, items, brandConcentration: topBrand });
    }

    return results.sort((a, b) => b.totalSpend - a.totalSpend);
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const decisionIntelligence = new DecisionIntelligenceService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to get regional preferences for UI display
 */
export function useRegionalPreferences(
  region: string,
  trade: string,
  decisionType: string
) {
  const [preferences, setPreferences] = useState<RegionalPreference | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    decisionIntelligence
      .getRegionalPreferences(region, trade, decisionType)
      .then(setPreferences)
      .finally(() => setLoading(false));
  }, [region, trade, decisionType]);

  return { preferences, loading };
}

/**
 * Hook to get decision timing analytics
 */
export function useDecisionTiming(decisionType: string) {
  const [timing, setTiming] = useState<DecisionTiming | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    decisionIntelligence
      .getDecisionTiming(decisionType)
      .then(setTiming)
      .finally(() => setLoading(false));
  }, [decisionType]);

  return { timing, loading };
}

/**
 * Hook to process a decision submission
 */
export function useDecisionSubmission() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submitDecision = useCallback(async (
    submission: CustomerDecisionSubmission,
    item: CustomerDecisionItem,
    context: {
      trade: string;
      projectType: string;
      region: string;
      projectBudget?: 'budget' | 'mid-range' | 'premium';
      propertyType?: 'apartment' | 'house' | 'commercial';
    }
  ) => {
    setSubmitting(true);
    setError(null);

    try {
      await decisionIntelligence.processDecisionSubmission(submission, item, context);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submitDecision, submitting, error };
}
