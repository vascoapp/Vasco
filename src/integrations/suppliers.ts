// =============================================================================
// DUTCH SUPPLIER INTEGRATIONS
// =============================================================================
// Major Dutch construction material suppliers:
// - Technische Unie (electrical, plumbing, HVAC)
// - Rexel (electrical wholesale)
// - Solar Nederland (plumbing, HVAC, solar)
// - Brouwer (plumbing supplies)
// - Sonepar (electrical, industrial)
// - Hornbach / Gamma / Praxis (general hardware, retail)
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMaterialBaselinesForCountry, getAllMaterialBaselines } from '../services/cohortBenchmarkService';
import { getScanHistory } from '../services/invoiceScanService';
import { getStandardVatRate, type BusinessProfile } from '../domain/business';
import { loadConfiguredClient } from './supplierLiveApi';

const STORAGE_KEY = '@vasco_suppliers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupplierId =
  // Netherlands
  | 'technische_unie'
  | 'rexel'
  | 'solar_nederland'
  | 'brouwer'
  | 'sonepar'
  | 'hornbach'
  // Germany
  | 'elektro_wandelt'
  | 'sonepar_de'
  | 'rexel_de'
  | 'richter_frenzel'
  | 'baywa'
  | 'hornbach_de'
  // France
  | 'rexel_fr'
  | 'sonepar_fr'
  | 'saint_gobain'
  | 'prolians'
  | 'legrand'
  | 'leroy_merlin_fr'
  // Spain
  | 'sonepar_es'
  | 'saltoki'
  | 'comafe'
  | 'rexel_es'
  | 'salvador_escoda'
  | 'leroy_merlin_es'
  // Italy
  | 'sonepar_it'
  | 'comoli_ferrari'
  | 'wurth_it'
  | 'fiorentini'
  | 'rexel_it'
  | 'leroy_merlin_it'
  // United Kingdom
  | 'screwfix'
  | 'toolstation'
  | 'city_electrical'
  | 'plumbase'
  | 'edmundson_electrical'
  | 'travis_perkins'
  | 'custom';

export interface SupplierConfig {
  id: SupplierId;
  connected: boolean;
  accountNumber?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}

export interface SupplierInfo {
  id: SupplierId;
  name: string;
  description: string;
  website: string;
  trades: string[]; // which trades use this supplier
  hasApi: boolean;
  hasCatalog: boolean;
  hasOrderTracking: boolean;
}

export interface CatalogItem {
  supplierId: SupplierId;
  articleNumber: string;
  ean?: string;
  name: string;
  description?: string;
  brand?: string;
  category: string;
  priceExclVat: number;
  vatRate: number;
  unit: string; // 'stuk', 'meter', 'rol', 'doos', 'kg'
  inStock: boolean;
  leadTimeDays?: number;
  imageUrl?: string;
}

export interface PriceCheck {
  articleNumber: string;
  name: string;
  prices: { supplierId: SupplierId; supplierName: string; price: number; inStock: boolean }[];
  cheapest: SupplierId;
  savings: number; // difference between cheapest and most expensive
}

// ---------------------------------------------------------------------------
// Supplier registry — all Dutch suppliers with metadata
// ---------------------------------------------------------------------------

export const DUTCH_SUPPLIERS: SupplierInfo[] = [
  {
    id: 'technische_unie',
    name: 'Technische Unie',
    description: 'Technisch groothandel — elektra, loodgieterij, HVAC',
    website: 'https://www.technischeunie.nl',
    trades: ['plumbing', 'electrical', 'gas', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'rexel',
    name: 'Rexel Nederland',
    description: 'Elektrotechnische groothandel',
    website: 'https://www.rexel.nl',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'solar_nederland',
    name: 'Solar Nederland',
    description: 'Sanitair, CV, solar en elektra',
    website: 'https://www.solar.nl',
    trades: ['plumbing', 'gas', 'electrical'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'brouwer',
    name: 'Brouwer',
    description: 'Sanitair en verwarmingsgroothandel',
    website: 'https://www.brouwer.nl',
    trades: ['plumbing', 'gas'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'sonepar',
    name: 'Sonepar',
    description: 'Industriële en elektrotechnische distributie',
    website: 'https://www.sonepar.nl',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'hornbach',
    name: 'Hornbach',
    description: 'Bouwmarkt — breed assortiment',
    website: 'https://www.hornbach.nl',
    trades: ['painting', 'carpentry', 'general', 'other'],
    hasApi: false,
    hasCatalog: false,
    hasOrderTracking: false,
  },
];

// German suppliers
export const GERMAN_SUPPLIERS: SupplierInfo[] = [
  {
    id: 'elektro_wandelt',
    name: 'Elektro Wandelt',
    description: 'Elektro-Großhandel — Kabel, Schalter, Leuchten',
    website: 'https://www.elektro-wandelt.de',
    trades: ['electrical', 'general'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'sonepar_de',
    name: 'Sonepar Deutschland',
    description: 'Elektro- und Industriegroßhandel',
    website: 'https://www.sonepar.de',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'rexel_de',
    name: 'Rexel Deutschland',
    description: 'Elektrotechnischer Großhandel — IDS Connect',
    website: 'https://www.rexel.de',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'richter_frenzel',
    name: 'Richter+Frenzel',
    description: 'Sanitär, Heizung, Klima — SHK Großhandel',
    website: 'https://www.richter-frenzel.de',
    trades: ['plumbing', 'gas', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'baywa',
    name: 'BayWa Baustoffe',
    description: 'Baustoffe, Holz, Garten — Süddeutschland',
    website: 'https://www.baywa-baustoffe.de',
    trades: ['carpentry', 'general', 'painting'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'hornbach_de',
    name: 'Hornbach Deutschland',
    description: 'Baumarkt — breites Sortiment',
    website: 'https://www.hornbach.de',
    trades: ['painting', 'carpentry', 'general', 'other'],
    hasApi: false,
    hasCatalog: false,
    hasOrderTracking: false,
  },
];

// French suppliers
export const FRENCH_SUPPLIERS: SupplierInfo[] = [
  {
    id: 'rexel_fr',
    name: 'Rexel France',
    description: 'Grossiste en matériel électrique',
    website: 'https://www.rexel.fr',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'sonepar_fr',
    name: 'Sonepar France / Réseau Pro',
    description: 'Distribution de matériel électrique et sanitaire',
    website: 'https://www.sonepar.fr',
    trades: ['electrical', 'plumbing', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'saint_gobain',
    name: 'Saint-Gobain Distribution',
    description: 'Point.P, Cedeo — matériaux de construction et sanitaire',
    website: 'https://www.saint-gobain-distribution.fr',
    trades: ['plumbing', 'general', 'carpentry', 'painting'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'prolians',
    name: 'Prolians',
    description: 'Fournitures industrielles — plomberie, CVC',
    website: 'https://www.prolians.fr',
    trades: ['plumbing', 'gas', 'general'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'legrand',
    name: 'Legrand',
    description: 'Composants électriques — appareillage, tableaux',
    website: 'https://www.legrand.fr',
    trades: ['electrical'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'leroy_merlin_fr',
    name: 'Leroy Merlin',
    description: 'Grande surface de bricolage — assortiment large',
    website: 'https://www.leroymerlin.fr',
    trades: ['painting', 'carpentry', 'general', 'other'],
    hasApi: false,
    hasCatalog: false,
    hasOrderTracking: false,
  },
];

// Spanish suppliers
export const SPANISH_SUPPLIERS: SupplierInfo[] = [
  {
    id: 'sonepar_es',
    name: 'Sonepar Ibérica',
    description: 'Distribución de material eléctrico',
    website: 'https://www.sonepar.es',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'saltoki',
    name: 'Saltoki',
    description: 'Fontanería, climatización y calefacción',
    website: 'https://www.saltoki.es',
    trades: ['plumbing', 'gas', 'general'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'comafe',
    name: 'Comafe',
    description: 'Ferretería y suministros generales',
    website: 'https://www.comafe.com',
    trades: ['general', 'carpentry', 'painting', 'other'],
    hasApi: false,
    hasCatalog: false,
    hasOrderTracking: false,
  },
  {
    id: 'rexel_es',
    name: 'Rexel Spain',
    description: 'Distribución de material eléctrico',
    website: 'https://www.rexel.es',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'salvador_escoda',
    name: 'Salvador Escoda',
    description: 'Climatización, fontanería y energías renovables',
    website: 'https://www.salvadorescoda.com',
    trades: ['gas', 'plumbing', 'general'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'leroy_merlin_es',
    name: 'Leroy Merlin Spain',
    description: 'Gran superficie de bricolaje y construcción',
    website: 'https://www.leroymerlin.es',
    trades: ['painting', 'carpentry', 'general', 'other'],
    hasApi: false,
    hasCatalog: false,
    hasOrderTracking: false,
  },
];

// Italian suppliers
export const ITALIAN_SUPPLIERS: SupplierInfo[] = [
  {
    id: 'sonepar_it',
    name: 'Sonepar Italia',
    description: 'Distribuzione di materiale elettrico',
    website: 'https://www.sonepar.it',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'comoli_ferrari',
    name: 'Comoli Ferrari',
    description: 'Distribuzione elettrica e industriale',
    website: 'https://www.comoliferrari.it',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'wurth_it',
    name: 'Würth Italia',
    description: 'Fissaggio, utensili e materiali generali',
    website: 'https://www.wuerth.it',
    trades: ['general', 'carpentry', 'electrical'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'fiorentini',
    name: 'Fiorentini',
    description: 'Gas, riscaldamento e climatizzazione',
    website: 'https://www.fiorentini.com',
    trades: ['gas', 'plumbing'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'rexel_it',
    name: 'Rexel Italia',
    description: 'Distribuzione di materiale elettrico',
    website: 'https://www.rexel.it',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'leroy_merlin_it',
    name: 'Leroy Merlin Italia',
    description: 'Grande distribuzione fai-da-te e edilizia',
    website: 'https://www.leroymerlin.it',
    trades: ['painting', 'carpentry', 'general', 'other'],
    hasApi: false,
    hasCatalog: false,
    hasOrderTracking: false,
  },
];

// UK suppliers
export const UK_SUPPLIERS: SupplierInfo[] = [
  {
    id: 'screwfix',
    name: 'Screwfix',
    description: 'Trade supplies — electrical, plumbing, tools',
    website: 'https://www.screwfix.com',
    trades: ['electrical', 'plumbing', 'general', 'other'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'toolstation',
    name: 'Toolstation',
    description: 'Trade tools and materials',
    website: 'https://www.toolstation.com',
    trades: ['electrical', 'plumbing', 'painting', 'carpentry', 'general'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'city_electrical',
    name: 'City Electrical Factors',
    description: 'Electrical wholesale distributor',
    website: 'https://www.cef.co.uk',
    trades: ['electrical'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'plumbase',
    name: 'Plumbase',
    description: 'Plumbing and heating supplies',
    website: 'https://www.plumbase.co.uk',
    trades: ['plumbing', 'gas'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
  {
    id: 'edmundson_electrical',
    name: 'Edmundson Electrical',
    description: 'UK\'s largest electrical distributor',
    website: 'https://www.edmundson-electrical.co.uk',
    trades: ['electrical', 'general'],
    hasApi: true,
    hasCatalog: true,
    hasOrderTracking: true,
  },
  {
    id: 'travis_perkins',
    name: 'Travis Perkins',
    description: 'Building materials and timber',
    website: 'https://www.travisperkins.co.uk',
    trades: ['carpentry', 'general', 'other'],
    hasApi: false,
    hasCatalog: true,
    hasOrderTracking: false,
  },
];

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

export async function getSupplierConfigs(): Promise<SupplierConfig[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveSupplierConfig(config: SupplierConfig): Promise<void> {
  const configs = await getSupplierConfigs();
  const idx = configs.findIndex(c => c.id === config.id);
  if (idx >= 0) {
    configs[idx] = config;
  } else {
    configs.push(config);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export async function disconnectSupplier(id: SupplierId): Promise<void> {
  const configs = await getSupplierConfigs();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(configs.filter(c => c.id !== id))
  );
}

// ---------------------------------------------------------------------------
// Get suppliers relevant to a trade
// ---------------------------------------------------------------------------

export function getSuppliersForTrade(trade: string, country?: string): SupplierInfo[] {
  const ALL_SUPPLIERS = [...DUTCH_SUPPLIERS, ...GERMAN_SUPPLIERS, ...FRENCH_SUPPLIERS, ...SPANISH_SUPPLIERS, ...ITALIAN_SUPPLIERS, ...UK_SUPPLIERS];
  const suppliers = country === 'DE' ? GERMAN_SUPPLIERS
    : country === 'NL' ? DUTCH_SUPPLIERS
    : country === 'FR' ? FRENCH_SUPPLIERS
    : country === 'ES' ? SPANISH_SUPPLIERS
    : country === 'IT' ? ITALIAN_SUPPLIERS
    : country === 'UK' ? UK_SUPPLIERS
    : ALL_SUPPLIERS; // show all if no country
  return suppliers.filter(s => s.trades.includes(trade));
}

// ---------------------------------------------------------------------------
// Price comparison across connected suppliers
// ---------------------------------------------------------------------------

export async function comparePrices(query: string, country?: string): Promise<PriceCheck | null> {
  // R285: live supplier API takes precedence when configured. Returns null
  // means "this provider can't help" — fall through to baselines.
  const live = loadConfiguredClient();
  if (live) {
    try {
      const result = await live.comparePrices(query, country);
      if (result) return result;
    } catch {
      // Drop to baseline path on adapter failure — never block the UI.
    }
  }

  const q = query.toLowerCase().trim();
  const countries: Array<'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK'> = ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'];
  const targetCountries = country ? [country as 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK'] : countries;

  // Build cross-country price list from real material baselines
  const prices: { supplierId: SupplierId; supplierName: string; price: number; inStock: boolean }[] = [];
  let matchedName = '';

  for (const c of targetCountries) {
    const baselines = getAllMaterialBaselines(c);
    for (const mat of baselines) {
      if (mat.name.toLowerCase().includes(q) || q.includes(mat.name.toLowerCase())) {
        if (!matchedName) matchedName = mat.name;
        // Map supplier name to the nearest known SupplierId
        const suppliersList = getSuppliersForTrade(mat.trade, c);
        const bestMatch = suppliersList[0];
        prices.push({
          supplierId: bestMatch?.id ?? 'custom',
          supplierName: `${mat.cheaperSupplier} (${c})`,
          price: mat.avgPrice,
          inStock: true,
        });
      }
    }
  }

  // Also overlay scanned real prices from invoice history
  try {
    const scans = await getScanHistory();
    for (const scan of scans) {
      for (const item of scan.lineItems) {
        if (item.description.toLowerCase().includes(q) || q.includes(item.description.toLowerCase())) {
          if (!matchedName) matchedName = item.description;
          prices.push({
            supplierId: 'custom',
            supplierName: `${scan.supplierName} (scanned)`,
            price: item.unitPrice,
            inStock: true,
          });
        }
      }
    }
  } catch {}

  if (prices.length === 0) return null;

  // Deduplicate by supplier name (keep cheapest per supplier)
  const byName = new Map<string, typeof prices[0]>();
  for (const p of prices) {
    const existing = byName.get(p.supplierName);
    if (!existing || p.price < existing.price) {
      byName.set(p.supplierName, p);
    }
  }
  const dedupedPrices = Array.from(byName.values()).sort((a, b) => a.price - b.price);

  const cheapest = dedupedPrices[0].supplierId;
  const savings = dedupedPrices.length > 1
    ? dedupedPrices[dedupedPrices.length - 1].price - dedupedPrices[0].price
    : 0;

  return {
    articleNumber: query,
    name: matchedName,
    prices: dedupedPrices,
    cheapest,
    savings: Math.round(savings * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Catalog search — backed by 79 real material baselines + scan history
// ---------------------------------------------------------------------------

/**
 * Search the material catalog using real baseline data from cohortBenchmarkService.
 * Overlays scanned invoice prices when available for price accuracy.
 *
 * @param query - Search term (fuzzy matches on material name)
 * @param trade - Optional trade filter (plumbing, electrical, gas, painting, carpentry, general)
 * @param country - Optional country code (NL, DE, FR, ES, IT, UK) for localized pricing
 */
export async function searchCatalog(
  query: string,
  trade?: string,
  country?: string,
): Promise<CatalogItem[]> {
  // R285: live supplier API takes precedence when configured.
  const live = loadConfiguredClient();
  if (live) {
    try {
      const result = await live.searchCatalog(query, trade, country);
      if (result && result.length > 0) return result;
    } catch {
      // Drop to baseline path on adapter failure.
    }
  }

  const q = query.toLowerCase().trim();
  if (!q) return [];

  const countryCode = (country as 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK') || 'NL';

  // 1. Load baselines — either trade-specific or all trades
  const baselines = trade
    ? getMaterialBaselinesForCountry(trade, countryCode).map(b => ({ ...b, trade }))
    : getAllMaterialBaselines(countryCode);

  // 2. Fuzzy filter: match on name tokens
  const queryTokens = q.split(/\s+/);
  const scored = baselines
    .map(mat => {
      const nameLower = mat.name.toLowerCase();
      let score = 0;
      for (const token of queryTokens) {
        if (nameLower.includes(token)) score += 2;
        else if (nameLower.split(/\s+/).some(w => w.startsWith(token))) score += 1;
      }
      return { mat, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  // 3. Build scan price overlay for more accurate pricing
  const scanPrices = new Map<string, { price: number; supplier: string }>();
  try {
    const scans = await getScanHistory();
    for (const scan of scans) {
      for (const item of scan.lineItems) {
        const key = item.description.toLowerCase().trim();
        const existing = scanPrices.get(key);
        // Keep the most recent (last) scanned price
        scanPrices.set(key, { price: item.unitPrice, supplier: scan.supplierName });
      }
    }
  } catch {}

  // 4. Map to CatalogItem format with real data
  const allSuppliers = getSuppliersForTrade(trade || 'general', countryCode);
  const defaultSupplier = allSuppliers[0];

  const results: CatalogItem[] = scored.map(({ mat }, idx) => {
    const scannedData = scanPrices.get(mat.name.toLowerCase());
    const price = scannedData?.price ?? mat.avgPrice;
    const supplierName = scannedData?.supplier ?? mat.cheaperSupplier;

    // Try to find matching supplier ID
    const matchedSupplier = allSuppliers.find(
      s => s.name.toLowerCase().includes(supplierName.toLowerCase().split(' ')[0])
    );

    return {
      supplierId: matchedSupplier?.id ?? defaultSupplier?.id ?? 'custom',
      articleNumber: `MAT-${String(idx + 1).padStart(4, '0')}`,
      name: mat.name,
      description: scannedData ? `Real price from ${scannedData.supplier}` : `Market avg (${countryCode})`,
      category: (mat as any).trade || trade || 'general',
      priceExclVat: Math.round(price * 100) / 100,
      // R66r51: full EU6 VAT (was UK/NL only; DE 19, FR/UK 20, ES 21, IT 22).
      vatRate: getStandardVatRate(countryCode as BusinessProfile['country']),
      unit: mat.unit,
      inStock: true,
    };
  });

  return results;
}
