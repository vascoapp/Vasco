// =============================================================================
// INVOICE SCAN SERVICE — Photo → Structured Data → Pricing Moat
// =============================================================================
// Scans supplier invoices/receipts via Claude Vision and feeds extracted
// line items into the pricing intelligence database for the AI moat.
// =============================================================================

import { formatMoney, currencyForCountry, type Country } from '../i18n/formatting';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { emitBusinessEvent, emitMaterialPurchased } from '../intelligence/dataCollector';
import { recordMetricSnapshot } from '../intelligence/learningStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMaterialBaselines } from './cohortBenchmarkService';
import { getCurrentUserId, getCurrentCountry, getCurrentTrade } from '../lib/currentUser';
import { logWarn } from '../utils/errorHandler';
import { verifyExtractedInvoice, summariseVerification } from './extractionVerification';

const SCAN_HISTORY_KEY = '@vasco_invoice_scans';
const RATE_LIMIT_KEY = '@vasco_last_invoice_scan';
const RATE_LIMIT_MS = 15000; // 15 seconds between scans

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScannedLineItem {
  description: string;
  articleNumber?: string;
  ean?: string;
  brand?: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  totalPrice: number;
  confidence: number;
}

export interface ScannedInvoice {
  id: string;
  documentType: 'invoice' | 'receipt' | 'delivery_note' | 'quote';
  supplierName: string;
  supplierAddress?: string;
  supplierVat?: string;
  documentNumber?: string;
  documentDate: string;
  lineItems: ScannedLineItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  paymentTerms?: string;
  confidence: number;
  scannedAt: string;
  imageUri?: string;
}

// ---------------------------------------------------------------------------
// Scan invoice photo via Edge Function
// ---------------------------------------------------------------------------

export async function scanInvoicePhoto(
  imageBase64: string,
  country: string = 'NL',
): Promise<ScannedInvoice | null> {
  // Rate limiting
  const lastScan = await AsyncStorage.getItem(RATE_LIMIT_KEY);
  if (lastScan && Date.now() - Number(lastScan) < RATE_LIMIT_MS) {
    return null; // Too soon
  }
  await AsyncStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));

  // Try real API first — one retry with backoff before falling through.
  // A transient invoke failure used to drop straight to mock (dev) / null
  // (prod); a scanned invoice is worth a second attempt.
  if (isSupabaseConfigured) {
    try {
      let data: any = null;
      let error: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await supabase.functions.invoke('analyze-photo', {
          body: { imageBase64, country, mode: 'invoice' },
        });
        data = res.data; error = res.error;
        if (!error && data && data.lineItems) break;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
      }

      if (!error && data && data.lineItems) {
        const invoice: ScannedInvoice = {
          id: `scan-${Date.now()}`,
          documentType: data.documentType ?? 'invoice',
          supplierName: data.supplierName ?? 'Onbekend',
          supplierAddress: data.supplierAddress,
          supplierVat: data.supplierVat,
          documentNumber: data.documentNumber,
          documentDate: data.documentDate ?? new Date().toISOString().split('T')[0],
          lineItems: data.lineItems ?? [],
          subtotal: data.subtotal ?? 0,
          vatAmount: data.vatAmount ?? 0,
          total: data.total ?? 0,
          paymentTerms: data.paymentTerms,
          confidence: data.confidence ?? 70,
          scannedAt: new Date().toISOString(),
        };

        // Save to history
        await saveScanHistory(invoice);
        // Feed the moat
        await feedPricingMoat(invoice);
        // R239+: persist analysis for cross-quote learning + agent queries
        import('./intelligenceCaptureService').then((m) =>
          m.persistPhotoAnalysis({
            detectedMaterials: data.lineItems,
            rawResponse: data,
          }),
        ).catch(() => {});

        return invoice;
      }
    } catch {
      // Fall through to mock
    }
  }

  // Only fall back to demo scan in __DEV__ / demo mode.
  // In production builds we surface a null so the UI can show an explicit error.
  if (__DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
    return mockScanResult();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Feed scanned data into pricing moat
// ---------------------------------------------------------------------------

export async function feedPricingMoat(invoice: ScannedInvoice): Promise<void> {
  const userId = getCurrentUserId();

  // ARITHMETIC GATE. The per-line confidence filter below is the extractor
  // grading its own homework; this is an independent check that the document
  // reconciles against itself (line totals sum to the subtotal, subtotal + VAT
  // equals the total). An extractor that mis-read a decimal or dropped a line
  // usually reports high confidence anyway, and a poisoned
  // `material_price_history` is the one thing we cannot un-poison: it is the
  // training data the entire cohort moat runs on.
  //
  // Deliberately gates ONLY the moat write. The contractor still gets their
  // scan saved in full — a document that does not add up is often still a
  // perfectly useful receipt to keep.
  const verification = verifyExtractedInvoice(invoice);
  if (!verification.moatSafe) {
    logWarn('InvoiceScan', `Not feeding moat: ${summariseVerification(verification)}`);
    return;
  }

  // R282: cohort attribution — fall back to user's profile when the OCR
  // doesn't return a category (most invoices don't).
  // R283: single-write path. Was previously duplicating the row via
  // emitMaterialPurchased + a separate direct insert that carried the OCR
  // enrichment fields (brand/ean/currency/vat_rate). Cohort sample sizes
  // for OCR rows were 2x. Now feeds enrichment into the emitter and the
  // dataCollector writes one row.
  const userTrade = getCurrentTrade();
  const userCountry = getCurrentCountry() || 'NL';
  // #6: country-aware currency — was hardcoded 'EUR', mis-tagging every GBP/USD
  // scanned line. The moat aggregates by currency, so a mis-tag silently mixed
  // £ and € into one average.
  const moatCurrency = currencyForCountry(userCountry as Country);
  // #3b: don't train the moat on OCR we don't trust. A mis-read unit price on a
  // low-confidence line poisons the cohort average for that material. Feed only
  // confident lines; the scan itself is still saved in full for the contractor.
  const MOAT_MIN_LINE_CONFIDENCE = 50;
  for (const item of invoice.lineItems) {
    if (typeof item.confidence === 'number' && item.confidence < MOAT_MIN_LINE_CONFIDENCE) continue;
    const itemTrade = item.category || userTrade || 'general';
    emitMaterialPurchased(userId, {
      materialName: item.description,
      supplierId: invoice.supplierName.toLowerCase().replace(/\s+/g, '_'),
      supplierName: invoice.supplierName,
      price: item.unitPrice,
      quantity: item.quantity,
      unit: item.unit,
      trade: itemTrade,
      country: userCountry,
      materialCategory: item.category,
      brand: item.brand,
      eanCode: item.ean,
      currency: moatCurrency,
      vatRate: item.vatRate,
      observedAt: invoice.documentDate,
      source: 'invoice_scan',
    }).catch(() => {});
  }

  // Record total spend for metrics
  recordMetricSnapshot('marginLeakage', invoice.total).catch(() => {});

  // Emit scan event
  emitBusinessEvent(userId, {
    eventType: 'invoice_scanned',
    entityType: 'material',
    entityId: invoice.id,
    payload: {
      supplier: invoice.supplierName,
      total: invoice.total,
      lineItemCount: invoice.lineItems.length,
      confidence: invoice.confidence,
    },
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Scan history (AsyncStorage)
// ---------------------------------------------------------------------------

async function saveScanHistory(invoice: ScannedInvoice): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
    const history: ScannedInvoice[] = raw ? JSON.parse(raw) : [];
    history.unshift(invoice);
    // Keep last 200 scans — old scans still have pricing value for the moat
    const trimmed = history.slice(0, 200);
    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
  // Cross-device sync: push to scanned_invoices table (migration in round 37)
  if (isSupabaseConfigured) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await (supabase.from('scanned_invoices' as any) as any).insert({
        id: invoice.id,
        user_id: user.id,
        document_type: invoice.documentType,
        supplier_name: invoice.supplierName,
        supplier_address: invoice.supplierAddress ?? null,
        supplier_vat: invoice.supplierVat ?? null,
        document_number: invoice.documentNumber ?? null,
        document_date: invoice.documentDate ?? null,
        subtotal: invoice.subtotal,
        vat_amount: invoice.vatAmount,
        total: invoice.total,
        currency: currencyForCountry((getCurrentCountry() || 'NL') as Country),
        payment_terms: invoice.paymentTerms ?? null,
        confidence: invoice.confidence,
        line_items: invoice.lineItems,
        scanned_at: invoice.scannedAt,
      });
    } catch {
      // Offline — AsyncStorage copy is still the source of truth; offlineWriteQueue can pick up later.
    }
  }
}

export async function getScanHistory(): Promise<ScannedInvoice[]> {
  try {
    const raw = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Price recommendation from scan history
// ---------------------------------------------------------------------------

export interface PriceRecommendation {
  materialName: string;
  currentPrice: number;
  avgPrice: number;
  lowestPrice: number;
  lowestSupplier: string;
  savingsPotential: number;
  trend: 'rising' | 'stable' | 'falling';
  action: 'buy_now' | 'wait' | 'switch_supplier';
  reason: string;
}

export async function getPriceRecommendations(): Promise<PriceRecommendation[]> {
  const history = await getScanHistory();
  if (history.length < 1) return [];

  // Build price map: material → [{price, supplier, date}]
  const priceMap = new Map<string, { price: number; supplier: string; date: string }[]>();
  for (const scan of history) {
    for (const item of scan.lineItems) {
      const key = item.description.toLowerCase().trim();
      const entries = priceMap.get(key) ?? [];
      entries.push({ price: item.unitPrice, supplier: scan.supplierName, date: scan.documentDate });
      priceMap.set(key, entries);
    }
  }

  const recommendations: PriceRecommendation[] = [];

  // For single-scan users, enrich with material baselines
  const baselines = getMaterialBaselines();
  const allBaselines = [
    ...baselines,
    ...getMaterialBaselines('plumbing'),
    ...getMaterialBaselines('electrical'),
    ...getMaterialBaselines('gas'),
    ...getMaterialBaselines('carpentry'),
    ...getMaterialBaselines('painting'),
  ];

  for (const [name, prices] of priceMap) {
    if (prices.length < 1) continue;

    const sorted = prices.sort((a, b) => a.price - b.price);
    const avg = prices.reduce((s, p) => s + p.price, 0) / prices.length;
    const current = prices[prices.length - 1]; // most recent
    let lowest = sorted[0];

    // For single-price items, check against material baselines for comparison
    const baseline = allBaselines.find(b => name.includes(b.name) || b.name.includes(name));
    if (prices.length === 1 && baseline && baseline.avgPrice < current.price) {
      lowest = { price: baseline.avgPrice, supplier: baseline.cheaperSupplier, date: current.date };
    }

    // Determine trend (compare first half avg to second half avg)
    let trend: PriceRecommendation['trend'] = 'stable';
    if (prices.length >= 2) {
      const mid = Math.floor(prices.length / 2);
      const firstHalf = prices.slice(0, mid);
      const secondHalf = prices.slice(mid);
      const firstAvg = firstHalf.reduce((s, p) => s + p.price, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, p) => s + p.price, 0) / secondHalf.length;
      trend = secondAvg > firstAvg * 1.05 ? 'rising' : secondAvg < firstAvg * 0.95 ? 'falling' : 'stable';
    }

    const savingsPotential = Math.round((current.price - lowest.price) * 100) / 100;

    let action: PriceRecommendation['action'] = 'buy_now';
    let reason = 'Prijs is stabiel en marktconform';

    if (savingsPotential > current.price * 0.1) {
      action = 'switch_supplier';
      reason = `${lowest.supplier} biedt ${formatMoney(savingsPotential)} goedkoper`;
    } else if (trend === 'falling') {
      action = 'wait';
      reason = 'Prijstrend is dalend — even wachten kan voordeliger zijn';
    } else if (trend === 'rising') {
      action = 'buy_now';
      reason = 'Prijstrend is stijgend — nu bestellen voorkomt hogere kosten';
    }

    recommendations.push({
      materialName: name,
      currentPrice: current.price,
      avgPrice: Math.round(avg * 100) / 100,
      lowestPrice: lowest.price,
      lowestSupplier: lowest.supplier,
      savingsPotential,
      trend,
      action,
      reason,
    });
  }

  // Sort by savings potential (highest first)
  return recommendations.sort((a, b) => b.savingsPotential - a.savingsPotential);
}

// ---------------------------------------------------------------------------
// Scanned unit-price index — the contractor's OWN supplier prices, keyed by
// material name. Feeds the photo→quote repricing (quoteMoatRepricing) so a
// detected material line is priced from what THIS contractor actually paid,
// not a generic AI guess. Uses the median across scans to shrug off one-off
// outliers / typos in the OCR.
// ---------------------------------------------------------------------------

export interface ScannedUnitPrice {
  unitPrice: number;
  unit: string;
  supplier: string;
  samples: number;
  lastObserved: string;
  // Carried through for exact EAN / article-number matching (#2) — the strong
  // link that beats fuzzy description matching.
  ean?: string;
  articleNumber?: string;
}

export async function getScannedUnitPriceIndex(): Promise<Map<string, ScannedUnitPrice>> {
  const history = await getScanHistory();
  const acc = new Map<string, { prices: number[]; unit: string; supplier: string; last: string; ean?: string; articleNumber?: string }>();
  for (const scan of history) {
    for (const item of scan.lineItems) {
      const key = item.description.toLowerCase().trim();
      if (!key || !(item.unitPrice > 0)) continue;
      const e = acc.get(key) ?? { prices: [], unit: item.unit, supplier: scan.supplierName, last: scan.documentDate, ean: item.ean, articleNumber: item.articleNumber };
      e.prices.push(item.unitPrice);
      // Keep the most recent supplier/date + identifiers as representative.
      if (scan.documentDate > e.last) {
        e.last = scan.documentDate;
        e.supplier = scan.supplierName;
        if (item.ean) e.ean = item.ean;
        if (item.articleNumber) e.articleNumber = item.articleNumber;
      }
      if (!e.ean && item.ean) e.ean = item.ean;
      if (!e.articleNumber && item.articleNumber) e.articleNumber = item.articleNumber;
      acc.set(key, e);
    }
  }
  const out = new Map<string, ScannedUnitPrice>();
  for (const [k, v] of acc) {
    const sorted = v.prices.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    out.set(k, { unitPrice: median, unit: v.unit, supplier: v.supplier, samples: v.prices.length, lastObserved: v.last, ean: v.ean, articleNumber: v.articleNumber });
  }
  return out;
}

// ---------------------------------------------------------------------------
// First scan insights — compares scanned prices against trade baselines
// ---------------------------------------------------------------------------
// Works with just 1 scanned invoice, giving immediate value to new users.

export interface FirstScanInsight {
  name: string;
  scannedPrice: number;
  marketAvg: number;
  savings: number;
  cheaperSupplier: string;
  priceVsMarket: number; // ratio: 1.0 = at market, 1.15 = 15% above
}

export function getFirstScanInsights(scannedItems: ScannedLineItem[], trade: string = 'general'): FirstScanInsight[] {
  // Gather baselines from the scanned trade + general
  const baselines = [
    ...getMaterialBaselines(trade),
    ...getMaterialBaselines('general'),
  ];
  // Deduplicate by name
  const seen = new Set<string>();
  const uniqueBaselines = baselines.filter(b => {
    if (seen.has(b.name)) return false;
    seen.add(b.name);
    return true;
  });

  const insights: FirstScanInsight[] = [];

  for (const item of scannedItems) {
    const itemName = item.description.toLowerCase().trim();
    // Find matching baseline (fuzzy: check if either contains the other)
    const match = uniqueBaselines.find(b =>
      itemName.includes(b.name) || b.name.includes(itemName) ||
      // Also try matching on significant words (3+ chars)
      b.name.split(' ').filter(w => w.length >= 3).some(w => itemName.includes(w))
    );

    if (!match) continue;

    const priceVsMarket = item.unitPrice / match.avgPrice;
    const savings = Math.round((item.unitPrice - match.avgPrice) * item.quantity * 100) / 100;

    insights.push({
      name: item.description,
      scannedPrice: item.unitPrice,
      marketAvg: match.avgPrice,
      savings: Math.max(0, savings),
      cheaperSupplier: match.cheaperSupplier,
      priceVsMarket: Math.round(priceVsMarket * 100) / 100,
    });
  }

  // Sort by savings (highest first)
  return insights.sort((a, b) => b.savings - a.savings);
}

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

function mockScanResult(): ScannedInvoice {
  return {
    id: `scan-${Date.now()}`,
    documentType: 'invoice',
    supplierName: 'Technische Unie',
    documentNumber: 'TU-2026-04521',
    documentDate: new Date().toISOString().split('T')[0],
    lineItems: [
      { description: 'Koperen buis 15mm 3m', articleNumber: 'TU-10234', brand: 'Viega', category: 'plumbing', quantity: 10, unit: 'stuk', unitPrice: 12.50, vatRate: 21, totalPrice: 125.00, confidence: 95 },
      { description: 'Knelkoppeling 15mm', articleNumber: 'TU-10567', brand: 'VSH', category: 'plumbing', quantity: 20, unit: 'stuk', unitPrice: 4.80, vatRate: 21, totalPrice: 96.00, confidence: 92 },
      { description: 'Thermostaatkraan set', articleNumber: 'BR-2045', brand: 'Grohe', category: 'plumbing', quantity: 2, unit: 'stuk', unitPrice: 89.00, vatRate: 21, totalPrice: 178.00, confidence: 88 },
    ],
    subtotal: 399.00,
    vatAmount: 83.79,
    total: 482.79,
    confidence: 90,
    scannedAt: new Date().toISOString(),
  };
}
