/**
 * Intelligence Bridge — pipeline orchestrator that feeds extracted invoice data
 * into every intelligence subsystem: material catalog, supplier profiles,
 * entity graph, training examples, price observations, events, and calibration.
 *
 * All stages are fire-and-forget (non-blocking, console.warn on error).
 * All no-op when Supabase is not configured.
 */

import { isSupabaseConfigured } from '../lib/supabase';
import {
  upsertMaterial,
  addMaterialAlias,
  upsertSupplier,
  upsertEntity,
  insertTrainingExample,
  bulkInsertPriceObservations,
  insertEvent,
  getCalibrationEntriesByGenerator,
  resolveCalibrationEntry,
} from '../lib/intelligenceDataProvider';
import type { ExtractedInvoice } from './invoiceExtractor';

// ── Types ──────────────────────────────────────────────────

export type IngestionSourceType = 'pdf' | 'paste' | 'excel' | 'csv' | 'camera';

export interface ProcessExtractionStats {
  materialsCreated: number;
  suppliersUpdated: number;
  entitiesCreated: number;
  trainingExamplesCreated: number;
  priceObservationsCreated: number;
  calibrationsResolved: number;
}

// ── Pipeline ───────────────────────────────────────────────

/**
 * Process a fully extracted invoice through all 7 intelligence stages.
 * Returns stats about what was created/updated.
 */
export async function processExtraction(
  invoice: ExtractedInvoice,
  sourceType: IngestionSourceType,
): Promise<ProcessExtractionStats> {
  const stats: ProcessExtractionStats = {
    materialsCreated: 0,
    suppliersUpdated: 0,
    entitiesCreated: 0,
    trainingExamplesCreated: 0,
    priceObservationsCreated: 0,
    calibrationsResolved: 0,
  };

  if (!isSupabaseConfigured) return stats;

  // ── Stage 1: Material catalog ──────────────────────────
  try {
    for (const item of invoice.lineItems) {
      const materialId = await upsertMaterial({
        name: item.productName ?? item.description,
        brand: item.brand,
        category: item.category,
        sku: item.sku,
        base_unit: item.unit,
        aliases: [item.description],
      });
      if (materialId) {
        stats.materialsCreated++;
        // Add the raw description as an alias if different from name
        if (item.productName && item.productName !== item.description) {
          await addMaterialAlias(materialId, item.description).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn('[IntBridge] Stage 1 (materials):', e);
  }

  // ── Stage 2: Supplier enrichment ───────────────────────
  let supplierId: string | null = null;
  try {
    if (invoice.supplierName) {
      supplierId = await upsertSupplier({ name: invoice.supplierName });
      if (supplierId) stats.suppliersUpdated++;
    }
  } catch (e) {
    console.warn('[IntBridge] Stage 2 (supplier):', e);
  }

  // ── Stage 3: Entity graph ─────────────────────────────
  try {
    if (invoice.supplierName) {
      const eid = await upsertEntity({
        entity_type: 'supplier',
        name: invoice.supplierName,
        attributes: {
          supplierId: invoice.supplierId ?? supplierId,
          vatNumber: invoice.supplierVatNumber,
          address: invoice.supplierAddress,
        },
        sources: [sourceType],
      });
      if (eid) stats.entitiesCreated++;
    }

    for (const item of invoice.lineItems) {
      const eid = await upsertEntity({
        entity_type: 'material',
        name: item.productName ?? item.description,
        aliases: [item.description],
        attributes: {
          brand: item.brand,
          category: item.category,
          sku: item.sku,
        },
        sources: [sourceType],
      });
      if (eid) stats.entitiesCreated++;
    }
  } catch (e) {
    console.warn('[IntBridge] Stage 3 (entities):', e);
  }

  // ── Stage 4: Training examples ─────────────────────────
  try {
    for (const item of invoice.lineItems) {
      // material_demand example
      const demandId = await insertTrainingExample({
        model_type: 'material_demand',
        features: {
          material: item.productName ?? item.description,
          brand: item.brand,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          supplier: invoice.supplierName,
          date: invoice.documentDate,
        },
        target: item.quantity,
        source: `${sourceType}:${invoice.id}`,
      });
      if (demandId) stats.trainingExamplesCreated++;

      // supplier_selection example
      if (invoice.supplierName) {
        const selId = await insertTrainingExample({
          model_type: 'supplier_selection',
          features: {
            material: item.productName ?? item.description,
            category: item.category,
            unitPrice: item.unitPrice,
            supplier: invoice.supplierName,
          },
          target: invoice.supplierName,
          source: `${sourceType}:${invoice.id}`,
        });
        if (selId) stats.trainingExamplesCreated++;
      }
    }

    // quote_pricing example (if it's a quote)
    if (invoice.documentType === 'quote' && invoice.total) {
      const qpId = await insertTrainingExample({
        model_type: 'quote_pricing',
        features: {
          supplier: invoice.supplierName,
          lineItemCount: invoice.lineItems.length,
          subtotal: invoice.subtotal,
          vatRate: invoice.vatRate,
          categories: [...new Set(invoice.lineItems.map((i) => i.category).filter(Boolean))],
        },
        target: invoice.total,
        source: `${sourceType}:${invoice.id}`,
      });
      if (qpId) stats.trainingExamplesCreated++;
    }
  } catch (e) {
    console.warn('[IntBridge] Stage 4 (training):', e);
  }

  // ── Stage 5: Price observations ────────────────────────
  try {
    const observations = invoice.lineItems
      .filter((item) => item.unitPrice > 0)
      .map((item) => ({
        material_id: item.sku ?? item.id,
        material_name: item.productName ?? item.description,
        supplier_id: invoice.supplierId ?? supplierId ?? undefined,
        supplier_name: invoice.supplierName,
        price: item.unitPrice,
        currency: invoice.currency,
        unit: item.unit,
        source: sourceType,
        confidence: item.confidence,
      }));

    if (observations.length > 0) {
      stats.priceObservationsCreated = await bulkInsertPriceObservations(observations);
    }
  } catch (e) {
    console.warn('[IntBridge] Stage 5 (prices):', e);
  }

  // ── Stage 6: Event tracking ────────────────────────────
  try {
    const entities = [
      ...(invoice.supplierName ? [{ type: 'supplier', name: invoice.supplierName }] : []),
      ...invoice.lineItems.map((i) => ({
        type: 'material',
        name: i.productName ?? i.description,
      })),
    ];

    await insertEvent({
      event_type: 'document_ingested',
      context: {
        sourceType,
        documentType: invoice.documentType,
        supplier: invoice.supplierName,
      },
      payload: {
        lineItemCount: invoice.lineItems.length,
        total: invoice.total,
        confidence: invoice.extractionConfidence,
        stats,
      },
      entities,
    });
  } catch (e) {
    console.warn('[IntBridge] Stage 6 (event):', e);
  }

  // ── Stage 7: Calibration resolution ────────────────────
  try {
    if (invoice.supplierName && invoice.total) {
      // Check pricing-related generators for pending predictions
      const generators = [
        'supplierPricingGenerator',
        'materialCostGenerator',
        'quotePricingGenerator',
      ];

      for (const gen of generators) {
        const entries = await getCalibrationEntriesByGenerator(gen, {
          unresolvedOnly: true,
          maxAgeDays: 90,
        });

        for (const entry of entries) {
          // Match by supplier name (fuzzy) and approximate amount (within 15%)
          const predictionStr = String(entry.prediction ?? '').toLowerCase();
          const matchesSupplier = invoice.supplierName &&
            predictionStr.includes(invoice.supplierName.toLowerCase());

          const matchesAmount = entry.predicted_value &&
            invoice.total &&
            Math.abs(entry.predicted_value - invoice.total) / entry.predicted_value < 0.15;

          if (matchesSupplier || matchesAmount) {
            const accurate = entry.predicted_value
              ? Math.abs(entry.predicted_value - invoice.total) / entry.predicted_value < 0.1
              : false;

            await resolveCalibrationEntry(entry.id, invoice.total, accurate);
            stats.calibrationsResolved++;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[IntBridge] Stage 7 (calibration):', e);
  }

  return stats;
}
