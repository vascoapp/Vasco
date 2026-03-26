/**
 * Ingestion Intelligence Service — hooks for the contractor intelligence dashboard.
 * Aggregates data from intelligenceDataProvider to show ingestion stats,
 * material catalog, and price history.
 */

import { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  searchMaterials,
  getSuppliers,
  listExtractedDocuments,
  getAllCalibrationScores,
  getTrainingExamples,
  queryEvents,
  getPriceHistory,
} from '../lib/intelligenceDataProvider';
import { logWarn } from '../utils/errorHandler';

// ── Types ──────────────────────────────────────────────────

export interface IngestionStats {
  materialsCount: number;
  priceObservationsCount: number;
  suppliersCount: number;
  documentsProcessed: number;
  trainingExamplesCount: number;
  calibrationAccuracy: number;
  recentEvents: RecentEvent[];
}

export interface RecentEvent {
  id: string;
  sourceType: string;
  documentType: string;
  supplier: string;
  lineItemCount: number;
  total: number;
  createdAt: string;
}

export interface MaterialWithPrice {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  baseUnit?: string;
  aliases?: string[];
}

export interface PriceHistoryEntry {
  id: string;
  supplierName?: string;
  price: number;
  currency?: string;
  unit?: string;
  source?: string;
  observedAt: string;
}

// ── useIngestionStats ──────────────────────────────────────

export function useIngestionStats(): {
  stats: IngestionStats;
  loading: boolean;
  refresh: () => void;
} {
  const empty: IngestionStats = {
    materialsCount: 0,
    priceObservationsCount: 0,
    suppliersCount: 0,
    documentsProcessed: 0,
    trainingExamplesCount: 0,
    calibrationAccuracy: 0,
    recentEvents: [],
  };

  const [stats, setStats] = useState<IngestionStats>(empty);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setStats(empty);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [
        materials,
        suppliers,
        documents,
        calibration,
        demandExamples,
        selectionExamples,
        pricingExamples,
        events,
      ] = await Promise.all([
        searchMaterials(''),
        getSuppliers(),
        listExtractedDocuments(),
        getAllCalibrationScores(),
        getTrainingExamples('material_demand', 1000),
        getTrainingExamples('supplier_selection', 1000),
        getTrainingExamples('quote_pricing', 1000),
        queryEvents('document_ingested', { limit: 20 }),
      ]);

      // Sum price observations from ingestion events
      let priceObsCount = 0;
      for (const evt of events) {
        priceObsCount += evt.payload?.stats?.priceObservationsCreated ?? 0;
      }

      // Calibration accuracy: weighted average across generators
      let calAccuracy = 0;
      if (calibration.length > 0) {
        const totalResolved = calibration.reduce((s, c) => s + c.resolved, 0);
        const totalAccurate = calibration.reduce((s, c) => s + c.accurate, 0);
        calAccuracy = totalResolved > 0 ? Math.round((totalAccurate / totalResolved) * 100) : 0;
      }

      const recentEvents: RecentEvent[] = events.map((e: any) => ({
        id: e.id,
        sourceType: e.context?.sourceType ?? 'unknown',
        documentType: e.context?.documentType ?? 'unknown',
        supplier: e.context?.supplier ?? '',
        lineItemCount: e.payload?.lineItemCount ?? 0,
        total: e.payload?.total ?? 0,
        createdAt: e.created_at,
      }));

      setStats({
        materialsCount: materials.length,
        priceObservationsCount: priceObsCount,
        suppliersCount: suppliers.length,
        documentsProcessed: documents.length,
        trainingExamplesCount:
          demandExamples.length + selectionExamples.length + pricingExamples.length,
        calibrationAccuracy: calAccuracy,
        recentEvents,
      });
    } catch (e) {
      logWarn('IngestionIntelligence', `load error: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { stats, loading, refresh: load };
}

// ── useMaterialCatalog ─────────────────────────────────────

export function useMaterialCatalog(
  query: string,
  category?: string,
): {
  materials: MaterialWithPrice[];
  categories: string[];
  loading: boolean;
  refresh: () => void;
} {
  const [materials, setMaterials] = useState<MaterialWithPrice[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setMaterials([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // First fetch: get all for categories (only on initial/refresh)
      if (categories.length === 0) {
        const allMats = await searchMaterials('', { limit: 200 });
        const cats = [...new Set(
          allMats.map((m: any) => m.category).filter(Boolean) as string[],
        )].sort();
        setCategories(cats);
      }

      const results = await searchMaterials(query, { category, limit: 200 });
      setMaterials(
        results.map((m: any) => ({
          id: m.id,
          name: m.name,
          brand: m.brand,
          category: m.category,
          baseUnit: m.base_unit,
          aliases: m.aliases,
        })),
      );
    } catch (e) {
      logWarn('IngestionIntelligence', `catalog error: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [query, category]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    setCategories([]); // force re-derive categories
    load();
  }, [load]);

  return { materials, categories, loading, refresh };
}

// ── useMaterialPriceHistory ────────────────────────────────

export function useMaterialPriceHistory(
  materialId: string | null,
): {
  history: PriceHistoryEntry[];
  loading: boolean;
} {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!materialId || !isSupabaseConfigured) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getPriceHistory(materialId, { limit: 20 })
      .then((data) => {
        if (cancelled) return;
        setHistory(
          data.map((p: any) => ({
            id: p.id,
            supplierName: p.supplier_name,
            price: p.price,
            currency: p.currency,
            unit: p.unit,
            source: p.source,
            observedAt: p.observed_at,
          })),
        );
      })
      .catch((e) => {
        if (!cancelled) logWarn('IngestionIntelligence', `price history error: ${e}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [materialId]);

  return { history, loading };
}
