// =============================================================================
// PURCHASING AGENT SERVICE — AI-powered scheduled autonomous purchasing agent
// =============================================================================
// 5 scheduled agent behaviors:
//   1. Job Material Pre-Sourcing  — on new job creation
//   2. Price Drop Alerts          — daily at 6am
//   3. Bulk Purchase Optimizer    — weekly Monday 7am
//   4. Supplier Loyalty Scoring   — monthly
//   5. Seasonal Stock-Up Advisor  — quarterly
//
// All behaviors gated behind `hasPurchasingAgent` subscription feature.
// Integrates with supplierBacklinkService for affiliate revenue.
// =============================================================================

import { formatMoney } from '../i18n/formatting';
import i18n from '../i18n/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haversineDistance } from '../utils/geo';
import { useState, useEffect, useCallback } from 'react';
import type { Country } from '../context/AuthContext';
import { SUPPLIERS, type Supplier } from './supplierBacklinkService';
import { loadOnboardingPreferences } from './onboardingPreferencesService';
import { loadSubscription, canUseFeature } from './subscriptionService';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MaterialSearch {
  query: string;           // "HR++ glas" or "PIR isolatieplaten"
  quantity?: number;
  unit?: string;
  trade?: string;
  urgent?: boolean;        // Same-day delivery preference
}

export interface SupplierDeal {
  supplier: Supplier;
  estimatedPrice: number;       // EUR per unit (estimated from market data)
  priceConfidence: 'high' | 'medium' | 'low';
  deliveryDays: number;
  distanceKm: number;           // From contractor's postcode
  hasPickup: boolean;           // Can pick up in-store
  affiliateUrl: string;         // Tracked purchase URL
  savingsPercent: number;       // vs. average market price
  matchScore: number;           // 0-100 overall ranking
  matchReasons: string[];       // Why this deal is good
}

export interface DealSearchResult {
  query: string;
  deals: SupplierDeal[];
  averageMarketPrice: number;
  bestPrice: number;
  searchedAt: string;
  suggestedAction: string;      // "Order from X — saves €Y"
}

export interface PriceDropAlert {
  materialName: string;
  supplier: Supplier;
  previousPrice: number;
  currentPrice: number;
  dropPercent: number;
  affiliateUrl: string;
  expiresAt: string;            // Deal likely ends
}

export interface BulkOpportunity {
  materials: Array<{ name: string; totalQuantity: number; unit: string; jobIds: string[] }>;
  bestSupplier: Supplier;
  individualTotal: number;      // Buying per-job
  bulkTotal: number;            // Buying together
  savingsAmount: number;
  savingsPercent: number;
  affiliateUrl: string;
}

export interface SupplierScore {
  supplier: Supplier;
  ordersCount: number;
  avgDeliveryDays: number;
  onTimePercent: number;
  priceConsistency: 'stable' | 'variable' | 'rising';
  overallScore: number;         // 0-100
  recommendation: 'preferred' | 'good' | 'consider_alternatives';
}

export interface SeasonalAdvice {
  trade: string;
  season: string;
  advice: string;
  materials: Array<{ name: string; currentPrice: number; expectedPrice: number; changePercent: number }>;
  suggestedAction: string;
}

export interface PurchaseRecord {
  id: string;
  supplierId: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  orderedAt: string;
  deliveredAt?: string;
  deliveryDays?: number;
}

// ─── Regional Supplier Presence ─────────────────────────────────────────────
// Maps supplier IDs to their warehouse/branch locations for distance estimates

interface SupplierLocation {
  supplierId: string;
  country: Country;
  city: string;
  postcode: string;
  hasPickup: boolean;
  lat: number;
  lng: number;
}

const SUPPLIER_LOCATIONS: SupplierLocation[] = [
  // Netherlands
  { supplierId: 'technische-unie', country: 'NL', city: 'Amsterdam', postcode: '1014', hasPickup: true, lat: 52.38, lng: 4.87 },
  { supplierId: 'technische-unie', country: 'NL', city: 'Rotterdam', postcode: '3011', hasPickup: true, lat: 51.92, lng: 4.48 },
  { supplierId: 'technische-unie', country: 'NL', city: 'Utrecht', postcode: '3500', hasPickup: true, lat: 52.09, lng: 5.12 },
  { supplierId: 'technische-unie', country: 'NL', city: 'Eindhoven', postcode: '5600', hasPickup: true, lat: 51.44, lng: 5.47 },
  { supplierId: 'toolstation', country: 'NL', city: 'Amsterdam', postcode: '1033', hasPickup: true, lat: 52.39, lng: 4.91 },
  { supplierId: 'toolstation', country: 'NL', city: 'Den Haag', postcode: '2521', hasPickup: true, lat: 52.08, lng: 4.33 },
  { supplierId: 'gamma-tuin', country: 'NL', city: 'Nationwide', postcode: '0000', hasPickup: true, lat: 52.15, lng: 5.38 },
  { supplierId: 'rockwool', country: 'NL', city: 'Roermond', postcode: '6041', hasPickup: false, lat: 51.19, lng: 5.99 },
  { supplierId: 'quick-step', country: 'NL', city: 'Distributie NL', postcode: '4800', hasPickup: false, lat: 51.59, lng: 4.78 },
  // UK
  { supplierId: 'travis-perkins', country: 'UK', city: 'Nationwide', postcode: 'NN1', hasPickup: true, lat: 52.24, lng: -0.89 },
  { supplierId: 'screwfix', country: 'UK', city: 'Nationwide', postcode: 'BA1', hasPickup: true, lat: 51.38, lng: -2.36 },
  { supplierId: 'toolstation', country: 'UK', city: 'Nationwide', postcode: 'BS3', hasPickup: true, lat: 51.44, lng: -2.60 },
  { supplierId: 'marshalls', country: 'UK', city: 'Halifax', postcode: 'HX1', hasPickup: false, lat: 53.72, lng: -1.86 },
  // Germany
  { supplierId: 'wurth', country: 'DE', city: 'Künzelsau', postcode: '74653', hasPickup: true, lat: 49.28, lng: 9.69 },
  { supplierId: 'hilti', country: 'DE', city: 'Kaufering', postcode: '86916', hasPickup: true, lat: 48.08, lng: 10.88 },
  { supplierId: 'knauf-insulation', country: 'DE', city: 'Simbach', postcode: '84359', hasPickup: false, lat: 48.27, lng: 13.02 },
  // France
  { supplierId: 'bricoman', country: 'FR', city: 'Nationwide', postcode: '75000', hasPickup: true, lat: 48.86, lng: 2.35 },
  { supplierId: 'saint-gobain', country: 'FR', city: 'Paris', postcode: '92400', hasPickup: false, lat: 48.89, lng: 2.29 },
];

// ─── Postcode → Approximate Coordinates ─────────────────────────────────────
// Simple lookup for EU6 countries. In production, use a geocoding API.

const POSTCODE_REGIONS: Record<string, { lat: number; lng: number }> = {
  // NL — first 2 digits
  '10': { lat: 52.37, lng: 4.89 },  // Amsterdam
  '11': { lat: 52.38, lng: 4.64 },  // Haarlem
  '20': { lat: 51.92, lng: 4.48 },  // Rotterdam
  '25': { lat: 52.07, lng: 4.30 },  // Den Haag
  '30': { lat: 52.09, lng: 5.12 },  // Utrecht
  '35': { lat: 52.22, lng: 6.90 },  // Enschede
  '50': { lat: 51.69, lng: 5.30 },  // Tilburg
  '55': { lat: 51.44, lng: 5.47 },  // Eindhoven
  '60': { lat: 51.98, lng: 5.91 },  // Arnhem
  '65': { lat: 51.84, lng: 5.87 },  // Nijmegen
  '70': { lat: 53.22, lng: 6.57 },  // Groningen
  '80': { lat: 52.52, lng: 5.47 },  // Zwolle
  '90': { lat: 53.20, lng: 5.80 },  // Leeuwarden
  // UK — first letter
  'L': { lat: 51.51, lng: -0.12 },  // London
  'B': { lat: 52.48, lng: -1.90 },  // Birmingham
  'M': { lat: 53.48, lng: -2.24 },  // Manchester
  'E': { lat: 55.95, lng: -3.19 },  // Edinburgh
  'C': { lat: 51.48, lng: -3.18 },  // Cardiff
  // DE — first digit
  '0': { lat: 51.05, lng: 13.74 },  // Dresden
  '1': { lat: 52.52, lng: 13.40 },  // Berlin
  '2': { lat: 53.55, lng: 10.00 },  // Hamburg
  '3': { lat: 52.37, lng: 9.74 },   // Hannover
  '4': { lat: 51.23, lng: 6.78 },   // Düsseldorf
  '5': { lat: 50.94, lng: 6.96 },   // Köln
  '6': { lat: 50.11, lng: 8.68 },   // Frankfurt
  '7': { lat: 48.78, lng: 9.18 },   // Stuttgart
  '8': { lat: 48.14, lng: 11.58 },  // München
  '9': { lat: 49.45, lng: 11.08 },  // Nürnberg
  // FR — first 2 digits
  '75': { lat: 48.86, lng: 2.35 },  // Paris
  '13': { lat: 43.30, lng: 5.37 },  // Marseille
  '69': { lat: 45.76, lng: 4.84 },  // Lyon
  '31': { lat: 43.60, lng: 1.44 },  // Toulouse
  '33': { lat: 44.84, lng: -0.58 }, // Bordeaux
  '44': { lat: 47.22, lng: -1.55 }, // Nantes
};

function estimateCoordinates(postcode: string, country: Country): { lat: number; lng: number } {
  const clean = postcode.replace(/\s+/g, '').toUpperCase();
  if (country === 'NL') {
    const prefix = clean.slice(0, 2);
    return POSTCODE_REGIONS[prefix] ?? { lat: 52.15, lng: 5.38 }; // Default: center NL
  }
  if (country === 'UK') {
    const prefix = clean.charAt(0);
    return POSTCODE_REGIONS[prefix] ?? { lat: 51.51, lng: -0.12 }; // Default: London
  }
  if (country === 'DE') {
    const prefix = clean.charAt(0);
    return POSTCODE_REGIONS[prefix] ?? { lat: 51.16, lng: 10.45 }; // Default: center DE
  }
  if (country === 'FR') {
    const prefix = clean.slice(0, 2);
    return POSTCODE_REGIONS[prefix] ?? { lat: 46.60, lng: 1.88 }; // Default: center FR
  }
  if (country === 'ES') return { lat: 40.42, lng: -3.70 }; // Madrid
  if (country === 'IT') return { lat: 41.90, lng: 12.50 }; // Rome
  return { lat: 52.15, lng: 5.38 };
}

// haversineDistance imported from ../utils/geo

// ─── Market Price Estimates ─────────────────────────────────────────────────
// Baseline prices per material category. In production, use real-time price feeds.

const MARKET_BASELINES: Record<string, { avgPrice: number; unit: string; priceRange: [number, number] }> = {
  // Roofing
  'dakpannen': { avgPrice: 30, unit: 'm²', priceRange: [22, 42] },
  'epdm': { avgPrice: 38, unit: 'm²', priceRange: [28, 50] },
  'bitumen': { avgPrice: 25, unit: 'm²', priceRange: [18, 35] },
  'dakgoten': { avgPrice: 22, unit: 'm¹', priceRange: [15, 32] },
  // Tiling
  'tegels': { avgPrice: 35, unit: 'm²', priceRange: [18, 85] },
  'tegellijm': { avgPrice: 18, unit: '25kg', priceRange: [12, 28] },
  'voegmortel': { avgPrice: 14, unit: '5kg', priceRange: [8, 22] },
  // Insulation
  'glaswol': { avgPrice: 16, unit: 'm²', priceRange: [10, 24] },
  'pir': { avgPrice: 38, unit: 'm²', priceRange: [28, 52] },
  'eps': { avgPrice: 12, unit: 'm²', priceRange: [8, 18] },
  'spouwmuur': { avgPrice: 20, unit: 'm²', priceRange: [14, 28] },
  // Solar
  'zonnepaneel': { avgPrice: 195, unit: 'stuk', priceRange: [145, 280] },
  'omvormer': { avgPrice: 125, unit: 'stuk', priceRange: [85, 220] },
  'montagerail': { avgPrice: 35, unit: 'm¹', priceRange: [22, 50] },
  // Flooring
  'laminaat': { avgPrice: 28, unit: 'm²', priceRange: [14, 55] },
  'pvc click': { avgPrice: 32, unit: 'm²', priceRange: [18, 58] },
  'ondervloer': { avgPrice: 5, unit: 'm²', priceRange: [2, 12] },
  // Glazing
  'hr++ glas': { avgPrice: 185, unit: 'stuk', priceRange: [120, 280] },
  'triple glas': { avgPrice: 250, unit: 'stuk', priceRange: [180, 380] },
  // Plastering
  'stucmortel': { avgPrice: 12, unit: '25kg', priceRange: [8, 18] },
  'gipspleister': { avgPrice: 10, unit: '25kg', priceRange: [6, 16] },
  // Landscaping
  'bestrating': { avgPrice: 28, unit: 'm²', priceRange: [15, 55] },
  'schuttingdelen': { avgPrice: 18, unit: 'm¹', priceRange: [10, 35] },
  'graszoden': { avgPrice: 6, unit: 'm²', priceRange: [3, 10] },
  // General
  'verf': { avgPrice: 22, unit: 'liter', priceRange: [12, 45] },
  'hout': { avgPrice: 8, unit: 'm¹', priceRange: [4, 18] },
  'koper buis': { avgPrice: 12, unit: 'm¹', priceRange: [8, 18] },
  'kabel': { avgPrice: 2, unit: 'm¹', priceRange: [0.80, 5] },
};

// ─── Seasonal Price Multipliers ─────────────────────────────────────────────
// Trade-specific seasonal demand patterns that affect pricing

const SEASONAL_PATTERNS: Record<string, Record<string, { multiplier: number; reason: string }>> = {
  roofing: {
    spring: { multiplier: 1.15, reason: 'Storm damage repair season — high demand' },
    summer: { multiplier: 1.05, reason: 'Peak installation season' },
    autumn: { multiplier: 0.95, reason: 'Pre-winter prep — moderate demand' },
    winter: { multiplier: 0.85, reason: 'Low demand — best deals on materials' },
  },
  insulation: {
    spring: { multiplier: 0.90, reason: 'Off-peak — good time to stock up' },
    summer: { multiplier: 0.95, reason: 'Moderate demand' },
    autumn: { multiplier: 1.20, reason: 'Pre-winter rush — highest prices' },
    winter: { multiplier: 1.10, reason: 'Active installation but supply normalizing' },
  },
  solar: {
    spring: { multiplier: 1.15, reason: 'Installation season begins — rising demand' },
    summer: { multiplier: 1.25, reason: 'Peak season — highest demand and prices' },
    autumn: { multiplier: 0.90, reason: 'Demand drops — clearance deals available' },
    winter: { multiplier: 0.80, reason: 'Lowest demand — best bulk pricing' },
  },
  plumbing: {
    spring: { multiplier: 1.0, reason: 'Stable demand' },
    summer: { multiplier: 0.95, reason: 'Slightly lower demand' },
    autumn: { multiplier: 1.05, reason: 'Pre-winter boiler prep' },
    winter: { multiplier: 1.15, reason: 'Emergency repairs drive prices up' },
  },
  electrical: {
    spring: { multiplier: 1.0, reason: 'Stable demand' },
    summer: { multiplier: 1.05, reason: 'New builds and renovations peak' },
    autumn: { multiplier: 1.0, reason: 'Stable demand' },
    winter: { multiplier: 0.95, reason: 'Slightly lower activity' },
  },
  painting: {
    spring: { multiplier: 1.10, reason: 'Exterior painting season starts' },
    summer: { multiplier: 1.15, reason: 'Peak exterior painting demand' },
    autumn: { multiplier: 0.90, reason: 'Season winding down — deals available' },
    winter: { multiplier: 0.85, reason: 'Interior only — lowest material prices' },
  },
  tiling: {
    spring: { multiplier: 1.05, reason: 'Renovation season begins' },
    summer: { multiplier: 1.10, reason: 'High renovation demand' },
    autumn: { multiplier: 1.0, reason: 'Stable demand' },
    winter: { multiplier: 0.90, reason: 'Lower demand — good deals' },
  },
  general: {
    spring: { multiplier: 1.05, reason: 'Construction season starts' },
    summer: { multiplier: 1.10, reason: 'Peak construction season' },
    autumn: { multiplier: 1.0, reason: 'Demand normalizing' },
    winter: { multiplier: 0.90, reason: 'Off-season — best prices' },
  },
};

// ─── Trade → Material Mapping ───────────────────────────────────────────────
// Used for seasonal advice — which baseline materials belong to which trade

const TRADE_MATERIALS: Record<string, string[]> = {
  roofing: ['dakpannen', 'epdm', 'bitumen', 'dakgoten'],
  tiling: ['tegels', 'tegellijm', 'voegmortel'],
  insulation: ['glaswol', 'pir', 'eps', 'spouwmuur'],
  solar: ['zonnepaneel', 'omvormer', 'montagerail'],
  flooring: ['laminaat', 'pvc click', 'ondervloer'],
  glazing: ['hr++ glas', 'triple glas'],
  plastering: ['stucmortel', 'gipspleister'],
  landscaping: ['bestrating', 'schuttingdelen', 'graszoden'],
  painting: ['verf'],
  plumbing: ['koper buis'],
  electrical: ['kabel'],
  general: ['hout', 'verf', 'kabel', 'koper buis'],
};

// ─── Storage Keys ───────────────────────────────────────────────────────────

const CACHE_KEY = '@vasco_deal_cache';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const PURCHASE_HISTORY_KEY = '@vasco_purchase_history';
const PRICE_SNAPSHOT_KEY = '@vasco_price_snapshots';
const LAST_RUN_KEY = '@vasco_purchasing_agent_runs';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getCurrentSeason(): string {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

function getNextSeason(current: string): string {
  const order = ['spring', 'summer', 'autumn', 'winter'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % 4];
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Check if enough time has elapsed since last run of a given behavior */
async function shouldRunBehavior(behaviorKey: string, intervalMs: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_RUN_KEY);
    const runs: Record<string, string> = raw ? JSON.parse(raw) : {};
    const lastRun = runs[behaviorKey];
    if (!lastRun) return true;
    return Date.now() - new Date(lastRun).getTime() >= intervalMs;
  } catch {
    return true;
  }
}

/** Record that a behavior just ran */
async function markBehaviorRun(behaviorKey: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LAST_RUN_KEY);
    const runs: Record<string, string> = raw ? JSON.parse(raw) : {};
    runs[behaviorKey] = new Date().toISOString();
    await AsyncStorage.setItem(LAST_RUN_KEY, JSON.stringify(runs));
  } catch {}
}

/** Tier gating helper — returns true if the user has purchasing agent access */
async function hasAgentAccess(): Promise<boolean> {
  const sub = await loadSubscription();
  const gate = canUseFeature(sub, 'hasPurchasingAgent');
  return gate.allowed;
}

// ─── Purchase History Tracking ──────────────────────────────────────────────

export async function recordPurchase(record: Omit<PurchaseRecord, 'id'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PURCHASE_HISTORY_KEY);
    const history: PurchaseRecord[] = raw ? JSON.parse(raw) : [];
    const newRecord: PurchaseRecord = { ...record, id: generateId() };
    history.push(newRecord);
    // Keep last 500 records
    await AsyncStorage.setItem(PURCHASE_HISTORY_KEY, JSON.stringify(history.slice(-500)));
  } catch {}
}

export async function getPurchaseHistory(): Promise<PurchaseRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(PURCHASE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Price Snapshots (for drop detection) ───────────────────────────────────

interface PriceSnapshot {
  materialName: string;
  supplierId: string;
  price: number;
  recordedAt: string;
}

async function savePriceSnapshots(snapshots: PriceSnapshot[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PRICE_SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {}
}

async function loadPriceSnapshots(): Promise<PriceSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(PRICE_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Core Search Logic (existing) ──────────────────────────────────────────

export async function searchDeals(
  search: MaterialSearch,
  country: Country,
  postcode: string,
): Promise<DealSearchResult> {
  const queryLower = search.query.toLowerCase();
  const userCoords = estimateCoordinates(postcode, country);

  // Find matching suppliers (by trade + country)
  const matchingSuppliers = SUPPLIERS.filter(s =>
    s.countries.includes(country) &&
    (s.category === 'materials' || s.category === 'tools') &&
    (!search.trade || s.trades.includes(search.trade) || s.trades.includes('general'))
  );

  // Find market baseline for this material
  const baseline = Object.entries(MARKET_BASELINES).find(([key]) =>
    queryLower.includes(key) || key.includes(queryLower.split(' ')[0])
  );
  const avgMarketPrice = baseline?.[1].avgPrice ?? 50;
  const priceRange = baseline?.[1].priceRange ?? [avgMarketPrice * 0.7, avgMarketPrice * 1.3];

  // Score each supplier
  const deals: SupplierDeal[] = matchingSuppliers.map(supplier => {
    // Distance calculation
    const locations = SUPPLIER_LOCATIONS.filter(l =>
      l.supplierId === supplier.id && l.country === country
    );
    let nearestDistance = 999;
    let hasPickup = false;
    for (const loc of locations) {
      const dist = haversineDistance(userCoords.lat, userCoords.lng, loc.lat, loc.lng);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        hasPickup = loc.hasPickup;
      }
    }
    // If no specific location, estimate from delivery days
    if (locations.length === 0) {
      nearestDistance = 50; // Default estimate
    }

    // R66 round 46: was `Math.random ±15%` — every call returned a different
    // price for the same supplier × material. Statistical noise rendered as
    // "price drop" alerts. Now uses the static MARKET_BASELINE avg price as
    // the deterministic estimate, modulated only by supplier tier (real
    // discount signal). Real cohort data flows through checkPriceDrops via
    // get_material_cohort_stats; searchDeals is the fallback supplier-finder
    // when no cohort data exists yet, NOT a price source.
    const bulkDiscount = supplier.avgOrderValue > 300 ? 0.95 : 1.0;
    const estimatedPrice = Math.round(avgMarketPrice * bulkDiscount * 100) / 100;

    // Delivery speed
    const deliveryMatch = supplier.deliveryDays.match(/(\d+)/);
    const deliveryDays = deliveryMatch ? parseInt(deliveryMatch[1]) : 3;

    // Savings vs average
    const savingsPercent = Math.round(((avgMarketPrice - estimatedPrice) / avgMarketPrice) * 100);

    // Overall match score
    let score = 50; // Base
    if (nearestDistance < 20) score += 20;
    else if (nearestDistance < 50) score += 10;
    if (deliveryDays <= 1) score += 15;
    else if (deliveryDays <= 2) score += 10;
    if (savingsPercent > 10) score += 15;
    else if (savingsPercent > 0) score += 5;
    if (supplier.rating >= 4.5) score += 10;
    if (hasPickup) score += 5;
    if (search.urgent && deliveryDays <= 1 && hasPickup) score += 15;
    score = Math.min(100, Math.max(0, score));

    // Match reasons
    const reasons: string[] = [];
    if (savingsPercent > 5) reasons.push(`${savingsPercent}% cheaper than average`);
    if (nearestDistance < 20) reasons.push(`Only ${Math.round(nearestDistance)} km away`);
    if (hasPickup) reasons.push('Pickup available today');
    if (deliveryDays <= 1) reasons.push('Same/next day delivery');
    if (supplier.rating >= 4.5) reasons.push(`${supplier.rating}★ rated`);
    if (supplier.featured) reasons.push('Preferred partner');

    return {
      supplier,
      estimatedPrice,
      priceConfidence: baseline ? 'medium' : 'low',
      deliveryDays,
      distanceKm: Math.round(nearestDistance),
      hasPickup,
      affiliateUrl: `${supplier.url}?${supplier.affiliateParam}&q=${encodeURIComponent(search.query)}`,
      savingsPercent: Math.max(0, savingsPercent),
      matchScore: score,
      matchReasons: reasons,
    };
  });

  // Sort by match score
  deals.sort((a, b) => b.matchScore - a.matchScore);

  const bestPrice = deals.length > 0 ? Math.min(...deals.map(d => d.estimatedPrice)) : avgMarketPrice;
  const topDeal = deals[0];
  const savings = topDeal ? Math.round((avgMarketPrice - topDeal.estimatedPrice) * (search.quantity ?? 1) * 100) / 100 : 0;
  const suggestedAction = topDeal
    ? `Order from ${topDeal.supplier.name}${savings > 0 ? ` — saves ${formatMoney(savings)}` : ''}`
    : 'No suppliers found for this material';

  // Cache the search result
  const result: DealSearchResult = {
    query: search.query,
    deals: deals.slice(0, 10), // Top 10
    averageMarketPrice: avgMarketPrice,
    bestPrice,
    searchedAt: new Date().toISOString(),
    suggestedAction,
  };

  await cacheSearchResult(result).catch(() => {});

  // Also snapshot prices for drop detection
  const snapshots: PriceSnapshot[] = deals.slice(0, 10).map(d => ({
    materialName: search.query,
    supplierId: d.supplier.id,
    price: d.estimatedPrice,
    recordedAt: new Date().toISOString(),
  }));
  const existing = await loadPriceSnapshots();
  // Keep only last 7 days of snapshots + new ones
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fresh = existing.filter(s => s.recordedAt > weekAgo);
  await savePriceSnapshots([...fresh, ...snapshots].slice(-1000));

  return result;
}

// ─── Quick Search for Job Materials ─────────────────────────────────────────

export async function searchDealsForJob(
  jobMaterials: Array<{ name: string; quantity?: number; unit?: string }>,
  trade: string,
  country: Country,
  postcode: string,
): Promise<DealSearchResult[]> {
  const results: DealSearchResult[] = [];
  for (const mat of jobMaterials.slice(0, 5)) { // Max 5 materials per search
    const result = await searchDeals(
      { query: mat.name, quantity: mat.quantity, unit: mat.unit, trade },
      country,
      postcode,
    );
    results.push(result);
  }
  return results;
}

// ─── Cached Results ─────────────────────────────────────────────────────────

async function cacheSearchResult(result: DealSearchResult): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const cache: DealSearchResult[] = raw ? JSON.parse(raw) : [];
    const cutoff = new Date(Date.now() - CACHE_MAX_AGE).toISOString();
    const fresh = cache.filter(r => r.searchedAt > cutoff);
    fresh.push(result);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh.slice(-20))); // Keep last 20
  } catch {}
}

export async function getCachedDeals(): Promise<DealSearchResult[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const cache: DealSearchResult[] = JSON.parse(raw);
    const cutoff = new Date(Date.now() - CACHE_MAX_AGE).toISOString();
    return cache.filter(r => r.searchedAt > cutoff);
  } catch {
    return [];
  }
}

// =============================================================================
// BEHAVIOR 1: Job Material Pre-Sourcing
// =============================================================================
// Called when a new job is created (triggered from AppState).
// Automatically finds best deals for all listed materials.

export async function presourceJobMaterials(job: {
  id: string;
  title: string;
  trade?: string;
  materials?: Array<{ name: string; quantity?: number }>;
}): Promise<DealSearchResult[]> {
  if (!(await hasAgentAccess())) return [];

  const prefs = await loadOnboardingPreferences();
  const country = prefs.country ?? 'NL';
  const postcode = prefs.postcode || '1012';
  const trade = job.trade ?? prefs.trades?.[0] ?? 'general';

  // If no explicit materials, infer from trade
  const materials = job.materials && job.materials.length > 0
    ? job.materials
    : inferMaterialsFromTrade(trade);

  if (materials.length === 0) return [];

  const results = await searchDealsForJob(
    materials.map(m => ({ name: m.name, quantity: m.quantity })),
    trade,
    country,
    postcode,
  );

  return results;
}

/** Infer likely materials from trade type for proactive sourcing */
function inferMaterialsFromTrade(trade: string): Array<{ name: string; quantity?: number }> {
  const tradeKey = trade.toLowerCase();
  const materialKeys = TRADE_MATERIALS[tradeKey] ?? TRADE_MATERIALS['general'] ?? [];
  return materialKeys.slice(0, 3).map(name => ({ name }));
}

// =============================================================================
// BEHAVIOR 2: Price Drop Alerts (scheduled daily at 6am) — R66 round 46
// =============================================================================
// REWRITTEN: pre-R46 this called searchDeals which generated random ±15%
// prices via Math.random — every "drop alert" was statistical noise. Three
// random calls in a row could fabricate a 12% drop or hide a real 12% drop.
// PriceDropAlertCard in the inkoop tab + the daily cron's AI queue items
// were both fed by this fake stream. Same anti-pattern documented in
// DORMANT_AUDIT.md R34.2.
//
// Now: compares the contractor's last actual purchase price against the
// cohort median for the same material (k-anon ≥5 enforced server-side via
// `get_material_cohort_stats`). The "drop" semantic shifts from "price
// fell" (which we can't observe without a real-time feed) to "you're
// paying X% above the cohort median" (which we CAN observe from
// material_price_history).
//
// This is honest signal: every alert references a real purchase the
// contractor actually made and a real cohort stat with a sample size.
// =============================================================================

export async function checkPriceDrops(
  trade: string,
  country: Country,
  _postcode: string,
): Promise<PriceDropAlert[]> {
  if (!(await hasAgentAccess())) return [];

  const sub = await loadSubscription();
  const priceDropGate = canUseFeature(sub, 'hasPriceDropAlerts');
  if (!priceDropGate.allowed) return [];

  const history = await getPurchaseHistory();
  if (history.length === 0) return [];

  // Pull cohort benchmarks once (one RPC call covers all materials in trade × country)
  const { getCohortBenchmarks } = await import('./cohortBenchmarkService');
  const cohort = await getCohortBenchmarks(trade, country);
  if (!cohort || cohort.materialBenchmarks.length === 0) {
    // No cohort data yet (k-anon below threshold) — return empty rather than
    // fabricating. Honest beats wrong.
    await markBehaviorRun('priceDrops');
    return [];
  }

  const alerts: PriceDropAlert[] = [];

  // For each unique material the contractor bought, compare against cohort median
  const seenMaterials = new Set<string>();
  for (const purchase of history) {
    const matKey = purchase.materialName.toLowerCase();
    if (seenMaterials.has(matKey)) continue;
    seenMaterials.add(matKey);

    // Match cohort row by name (case-insensitive contains)
    const benchmark = cohort.materialBenchmarks.find(
      (m: { materialName: string }) => matKey.includes(m.materialName.toLowerCase()) || m.materialName.toLowerCase().includes(matKey),
    );
    if (!benchmark || benchmark.medianPrice <= 0 || benchmark.sampleSize < 5) continue;

    const userPrice = purchase.unitPrice;
    if (userPrice <= 0) continue;

    // Contractor is paying ABOVE median = "drop available" if they switch
    const overpayPct = Math.round(((userPrice - benchmark.medianPrice) / benchmark.medianPrice) * 100);
    if (overpayPct < 5) continue; // Need a meaningful gap (≥5%)

    alerts.push({
      materialName: purchase.materialName,
      supplier: {
        // Synthesize a "cohort median" supplier marker — the UI surfaces this
        // as "cohort median (X contractors)" rather than a single supplier
        // since the cohort is anonymized.
        id: 'cohort',
        name: `Cohort median (${benchmark.sampleSize} contractors)`,
        rating: 0,
        deliveryDays: '—',
        avgOrderValue: 0,
      } as any,
      previousPrice: Math.round(userPrice * 100) / 100,
      currentPrice: Math.round(benchmark.medianPrice * 100) / 100,
      dropPercent: overpayPct,
      // R66r46: cohort signal has no single affiliate URL — set empty so
      // PriceDropAlertCard's optional Linking.openURL call no-ops cleanly.
      affiliateUrl: '',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Biggest gap first
  alerts.sort((a, b) => b.dropPercent - a.dropPercent);

  await markBehaviorRun('priceDrops');
  return alerts.slice(0, 10);
}

// =============================================================================
// BEHAVIOR 3: Bulk Purchase Optimizer (scheduled weekly Monday 7am)
// =============================================================================
// Aggregates materials across upcoming jobs to find bulk savings.

export async function optimizeBulkPurchases(
  upcomingJobs: Array<{ id: string; title: string; materials?: Array<{ name: string; quantity?: number; unit?: string }> }>,
  trade: string,
  country: Country,
  postcode: string,
): Promise<BulkOpportunity | null> {
  if (!(await hasAgentAccess())) return null;

  const sub = await loadSubscription();
  const bulkGate = canUseFeature(sub, 'hasBulkPurchaseOptimizer');
  if (!bulkGate.allowed) return null;

  // Aggregate materials across all jobs
  const materialMap = new Map<string, { totalQuantity: number; unit: string; jobIds: string[] }>();

  for (const job of upcomingJobs) {
    if (!job.materials) continue;
    for (const mat of job.materials) {
      const key = mat.name.toLowerCase();
      const existing = materialMap.get(key);
      if (existing) {
        existing.totalQuantity += mat.quantity ?? 1;
        if (!existing.jobIds.includes(job.id)) existing.jobIds.push(job.id);
      } else {
        materialMap.set(key, {
          totalQuantity: mat.quantity ?? 1,
          unit: mat.unit ?? 'stuk',
          jobIds: [job.id],
        });
      }
    }
  }

  // Only consider materials appearing in 2+ jobs (real bulk opportunity)
  const bulkMaterials = Array.from(materialMap.entries())
    .filter(([_, v]) => v.jobIds.length >= 2)
    .map(([name, v]) => ({ name, ...v }));

  if (bulkMaterials.length === 0) {
    await markBehaviorRun('bulkPurchases');
    return null;
  }

  // Calculate individual vs bulk pricing
  let individualTotal = 0;
  let bulkTotal = 0;

  // Find the supplier that covers the most materials
  const supplierMaterialCoverage = new Map<string, number>();
  const supplierDeals = new Map<string, SupplierDeal>();

  for (const mat of bulkMaterials) {
    const result = await searchDeals(
      { query: mat.name, quantity: mat.totalQuantity, unit: mat.unit, trade },
      country,
      postcode,
    );

    // Individual price = average market price * quantity
    individualTotal += result.averageMarketPrice * mat.totalQuantity;

    // Track which suppliers appear and their best deals
    for (const deal of result.deals.slice(0, 5)) {
      const count = (supplierMaterialCoverage.get(deal.supplier.id) ?? 0) + 1;
      supplierMaterialCoverage.set(deal.supplier.id, count);
      // Keep best deal per supplier
      const existing = supplierDeals.get(deal.supplier.id);
      if (!existing || deal.matchScore > existing.matchScore) {
        supplierDeals.set(deal.supplier.id, deal);
      }
    }
  }

  // Find best overall supplier (most coverage + good deals)
  let bestSupplierId = '';
  let bestCoverage = 0;
  for (const [supplierId, coverage] of supplierMaterialCoverage) {
    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      bestSupplierId = supplierId;
    }
  }

  if (!bestSupplierId) {
    await markBehaviorRun('bulkPurchases');
    return null;
  }

  const bestDeal = supplierDeals.get(bestSupplierId);
  if (!bestDeal) {
    await markBehaviorRun('bulkPurchases');
    return null;
  }

  // Bulk discount: 5-15% off depending on order size
  const totalItems = bulkMaterials.reduce((sum, m) => sum + m.totalQuantity, 0);
  const bulkDiscountPercent = Math.min(15, 5 + Math.floor(totalItems / 10));
  bulkTotal = Math.round(individualTotal * (1 - bulkDiscountPercent / 100) * 100) / 100;
  const savingsAmount = Math.round((individualTotal - bulkTotal) * 100) / 100;
  const savingsPercent = Math.round((savingsAmount / individualTotal) * 100);

  await markBehaviorRun('bulkPurchases');

  return {
    materials: bulkMaterials,
    bestSupplier: bestDeal.supplier,
    individualTotal: Math.round(individualTotal * 100) / 100,
    bulkTotal,
    savingsAmount,
    savingsPercent,
    affiliateUrl: `${bestDeal.supplier.url}?${bestDeal.supplier.affiliateParam}&bulk=true`,
  };
}

// =============================================================================
// BEHAVIOR 4: Supplier Loyalty Scoring (scheduled monthly)
// =============================================================================
// Analyzes purchase history to score suppliers on reliability, price consistency,
// and delivery performance.

export async function scoreSuppliers(country: Country): Promise<SupplierScore[]> {
  if (!(await hasAgentAccess())) return [];

  const sub = await loadSubscription();
  const scoringGate = canUseFeature(sub, 'hasSupplierScoring');
  if (!scoringGate.allowed) return [];

  const history = await getPurchaseHistory();
  const countrySuppliers = SUPPLIERS.filter(s => s.countries.includes(country));
  const scores: SupplierScore[] = [];

  for (const supplier of countrySuppliers) {
    const orders = history.filter(h => h.supplierId === supplier.id);

    if (orders.length === 0) {
      // No history — score based on baseline data only
      scores.push({
        supplier,
        ordersCount: 0,
        avgDeliveryDays: 0,
        onTimePercent: 0,
        priceConsistency: 'stable',
        overallScore: supplier.featured ? 60 : 40, // Baseline from partner status
        recommendation: 'good',
      });
      continue;
    }

    // Delivery performance
    const deliveredOrders = orders.filter(o => o.deliveryDays !== undefined);
    const avgDeliveryDays = deliveredOrders.length > 0
      ? Math.round((deliveredOrders.reduce((sum, o) => sum + (o.deliveryDays ?? 0), 0) / deliveredOrders.length) * 10) / 10
      : 0;

    // Parse expected delivery days from supplier
    const expectedMatch = supplier.deliveryDays.match(/(\d+)/);
    const expectedDays = expectedMatch ? parseInt(expectedMatch[1]) : 3;
    const onTimeOrders = deliveredOrders.filter(o => (o.deliveryDays ?? 999) <= expectedDays + 1);
    const onTimePercent = deliveredOrders.length > 0
      ? Math.round((onTimeOrders.length / deliveredOrders.length) * 100)
      : 0;

    // Price consistency — check variance in unit prices for same materials
    const materialPrices = new Map<string, number[]>();
    for (const order of orders) {
      const prices = materialPrices.get(order.materialName) ?? [];
      prices.push(order.unitPrice);
      materialPrices.set(order.materialName, prices);
    }

    let priceConsistency: 'stable' | 'variable' | 'rising' = 'stable';
    const allPriceSeries = Array.from(materialPrices.values()).filter(p => p.length >= 2);
    if (allPriceSeries.length > 0) {
      let risingCount = 0;
      let variableCount = 0;
      for (const prices of allPriceSeries) {
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.abs(p - avg), 0) / prices.length;
        const variancePercent = (variance / avg) * 100;
        if (variancePercent > 15) variableCount++;
        // Check if trending upward
        if (prices.length >= 2 && prices[prices.length - 1] > prices[0] * 1.1) risingCount++;
      }
      if (risingCount > allPriceSeries.length / 2) priceConsistency = 'rising';
      else if (variableCount > allPriceSeries.length / 2) priceConsistency = 'variable';
    }

    // Calculate overall score (0-100)
    let score = 30; // Base
    // Order volume bonus (max 15)
    score += Math.min(15, orders.length * 3);
    // Delivery performance (max 25)
    score += Math.round(onTimePercent * 0.25);
    // Price stability (max 15)
    if (priceConsistency === 'stable') score += 15;
    else if (priceConsistency === 'variable') score += 5;
    // Supplier rating (max 10)
    score += Math.round(supplier.rating * 2);
    // Partner bonus (5)
    if (supplier.featured) score += 5;
    score = Math.min(100, Math.max(0, score));

    // Recommendation
    let recommendation: 'preferred' | 'good' | 'consider_alternatives' = 'good';
    if (score >= 75) recommendation = 'preferred';
    else if (score < 40) recommendation = 'consider_alternatives';

    scores.push({
      supplier,
      ordersCount: orders.length,
      avgDeliveryDays,
      onTimePercent,
      priceConsistency,
      overallScore: score,
      recommendation,
    });
  }

  // Sort by overall score descending
  scores.sort((a, b) => b.overallScore - a.overallScore);

  await markBehaviorRun('supplierScoring');
  return scores;
}

// =============================================================================
// BEHAVIOR 5: Seasonal Stock-Up Advisor (quarterly)
// =============================================================================
// Cross-references seasonal demand patterns with price trends to recommend
// when to buy materials in bulk before prices rise.


/** Season slug -> localised name. Falls back to the slug, never to a blank. */
function seasonLabelFor(season: string): string {
  return i18n.t(`purchasing.seasons.${season}`, { defaultValue: season });
}

/**
 * Trade slug -> localised name, reusing the onboarding trade table rather than
 * printing the raw slug ("painting") into a sentence shown to the contractor.
 */
function tradeLabelFor(trade: string): string {
  const slug = trade.toLowerCase();
  return i18n.t(`onboarding.trades.${slug}`, { defaultValue: trade });
}

export async function getSeasonalAdvice(
  trade: string,
  country: Country,
): Promise<SeasonalAdvice | null> {
  if (!(await hasAgentAccess())) return null;

  const currentSeason = getCurrentSeason();
  const nextSeason = getNextSeason(currentSeason);
  const tradeKey = trade.toLowerCase();

  // Get seasonal patterns for this trade
  const patterns = SEASONAL_PATTERNS[tradeKey] ?? SEASONAL_PATTERNS['general'];
  if (!patterns) return null;

  const currentPattern = patterns[currentSeason];
  const nextPattern = patterns[nextSeason];
  if (!currentPattern || !nextPattern) return null;

  // Get relevant materials for this trade
  const materialKeys = TRADE_MATERIALS[tradeKey] ?? TRADE_MATERIALS['general'] ?? [];
  if (materialKeys.length === 0) return null;

  // Calculate price impact for each material
  const materials: Array<{ name: string; currentPrice: number; expectedPrice: number; changePercent: number }> = [];

  for (const matKey of materialKeys) {
    const baseline = MARKET_BASELINES[matKey];
    if (!baseline) continue;

    const currentPrice = Math.round(baseline.avgPrice * currentPattern.multiplier * 100) / 100;
    const expectedPrice = Math.round(baseline.avgPrice * nextPattern.multiplier * 100) / 100;
    const changePercent = Math.round(((expectedPrice - currentPrice) / currentPrice) * 100);

    materials.push({ name: matKey, currentPrice, expectedPrice, changePercent });
  }

  if (materials.length === 0) return null;

  // Determine advice based on price trajectory
  const avgChange = materials.reduce((sum, m) => sum + m.changePercent, 0) / materials.length;

  // Localised, and NO PERCENTAGE.
  //
  // This block used to render "expected to drop 12% next season". Both halves
  // of that number are invented: `avgChange` is arithmetic over
  // SEASONAL_PATTERNS multipliers, which are hardcoded judgement calls, applied
  // to MARKET_BASELINES, which is a static reference table — nothing here is a
  // measurement. Printing a percentage claims a forecast the app cannot make
  // (learnings #103). The seasonal DIRECTION is a defensible trade heuristic;
  // the decimal was false precision on top of it, so the direction stays and
  // the number goes.
  //
  // It was also hardcoded English and reached the Vandaag queue in every
  // locale — with a LOCALISED subtitle beside it, so the card rendered half
  // translated.
  const tradeName = tradeLabelFor(trade);
  const seasonName = seasonLabelFor(nextSeason);
  let advice: string;
  let suggestedAction: string;

  if (avgChange > 5) {
    advice = i18n.t('purchasing.seasonal.risingAdvice', {
      trade: tradeName, season: seasonName,
      defaultValue: 'Materials for {{trade}} are usually more expensive in {{season}}.',
    });
    suggestedAction = i18n.t('purchasing.seasonal.risingAction', {
      season: seasonName,
      defaultValue: 'Consider stocking up before {{season}}.',
    });
  } else if (avgChange < -5) {
    advice = i18n.t('purchasing.seasonal.fallingAdvice', {
      trade: tradeName, season: seasonName,
      defaultValue: 'Materials for {{trade}} are usually cheaper in {{season}}.',
    });
    suggestedAction = i18n.t('purchasing.seasonal.fallingAction', {
      season: seasonName,
      defaultValue: 'Consider holding bulk orders until {{season}}.',
    });
  } else {
    advice = i18n.t('purchasing.seasonal.stableAdvice', {
      trade: tradeName,
      defaultValue: 'Prices for {{trade}} materials do not shift much between seasons.',
    });
    suggestedAction = i18n.t('purchasing.seasonal.stableAction', {
      defaultValue: 'Buy as needed.',
    });
  }

  await markBehaviorRun('seasonalAdvice');

  return {
    trade,
    season: currentSeason,
    advice,
    materials: materials.sort((a, b) => b.changePercent - a.changePercent),
    suggestedAction,
  };
}

// =============================================================================
// MASTER SCHEDULER — Called from backgroundJobScheduler.ts
// =============================================================================
// Orchestrates all 5 behaviors based on schedule intervals.
// Returns results for queuing via VascoCard.

export async function runScheduledPurchasingAgent(context: {
  trade: string;
  country: Country;
  postcode: string;
  upcomingJobs: Array<{ id: string; title: string; materials?: Array<{ name: string; quantity?: number; unit?: string }> }>;
}): Promise<{
  priceDrops: PriceDropAlert[];
  bulkOpportunity: BulkOpportunity | null;
  seasonalAdvice: SeasonalAdvice | null;
}> {
  // 1. Check subscription tier — return empty if no hasPurchasingAgent
  if (!(await hasAgentAccess())) {
    return { priceDrops: [], bulkOpportunity: null, seasonalAdvice: null };
  }

  const { trade, country, postcode, upcomingJobs } = context;

  // 2. Run price drops check (daily — 24h interval)
  let priceDrops: PriceDropAlert[] = [];
  const shouldCheckPrices = await shouldRunBehavior('priceDrops', 24 * 60 * 60 * 1000);
  if (shouldCheckPrices) {
    priceDrops = await checkPriceDrops(trade, country, postcode);
  }

  // 3. Run bulk optimizer if there are upcoming jobs (weekly — 7 day interval)
  let bulkOpportunity: BulkOpportunity | null = null;
  if (upcomingJobs.length > 0) {
    const shouldOptimizeBulk = await shouldRunBehavior('bulkPurchases', 7 * 24 * 60 * 60 * 1000);
    if (shouldOptimizeBulk) {
      bulkOpportunity = await optimizeBulkPurchases(upcomingJobs, trade, country, postcode);
    }
  }

  // 4. Run seasonal advice quarterly (90 day interval)
  let seasonalAdvice: SeasonalAdvice | null = null;
  const shouldCheckSeasonal = await shouldRunBehavior('seasonalAdvice', 90 * 24 * 60 * 60 * 1000);
  if (shouldCheckSeasonal) {
    seasonalAdvice = await getSeasonalAdvice(trade, country);
  }

  // 5. Run supplier scoring monthly (30 day interval) — not returned but stored
  const shouldScoreSuppliers = await shouldRunBehavior('supplierScoring', 30 * 24 * 60 * 60 * 1000);
  if (shouldScoreSuppliers) {
    await scoreSuppliers(country);
  }

  return { priceDrops, bulkOpportunity, seasonalAdvice };
}

// ─── React Hook ─────────────────────────────────────────────────────────────

export function usePurchasingAgent() {
  const [results, setResults] = useState<DealSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (query: string, trade?: string) => {
    setSearching(true);
    try {
      const prefs = await loadOnboardingPreferences();
      const country = prefs.country ?? 'NL';
      const postcode = prefs.postcode || '1012';
      const result = await searchDeals(
        { query, trade: trade ?? prefs.trades[0] },
        country,
        postcode,
      );
      setResults(prev => [result, ...prev].slice(0, 10));
      return result;
    } finally {
      setSearching(false);
    }
  }, []);

  // Load cached results on mount
  useEffect(() => {
    getCachedDeals().then(setResults);
  }, []);

  return { results, searching, search };
}
