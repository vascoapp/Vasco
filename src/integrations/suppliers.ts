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

export async function comparePrices(articleNumber: string): Promise<PriceCheck | null> {
  // Search all mock catalogs for matching article numbers or name keywords
  const allItems = Object.values(MOCK_CATALOGS).flat();
  const query = articleNumber.toLowerCase();

  const matches = allItems.filter(
    item => item.articleNumber.toLowerCase() === query
      || item.articleNumber.toLowerCase().includes(query)
      || item.name.toLowerCase().includes(query)
  );

  if (matches.length === 0) return null;

  // Build prices from actual catalog data (consistent, deterministic)
  const allSuppliers = [...DUTCH_SUPPLIERS, ...GERMAN_SUPPLIERS, ...FRENCH_SUPPLIERS, ...SPANISH_SUPPLIERS, ...ITALIAN_SUPPLIERS, ...UK_SUPPLIERS];
  const prices = matches.map(item => {
    const supplier = allSuppliers.find(s => s.id === item.supplierId);
    return {
      supplierId: item.supplierId,
      supplierName: supplier?.name ?? item.supplierId,
      price: item.priceExclVat,
      inStock: item.inStock,
    };
  });

  // Deduplicate by supplier (keep cheapest per supplier)
  const bySupplier = new Map<SupplierId, typeof prices[0]>();
  for (const p of prices) {
    const existing = bySupplier.get(p.supplierId);
    if (!existing || p.price < existing.price) {
      bySupplier.set(p.supplierId, p);
    }
  }
  const dedupedPrices = Array.from(bySupplier.values());

  dedupedPrices.sort((a, b) => a.price - b.price);
  const cheapest = dedupedPrices[0].supplierId;
  const savings = dedupedPrices.length > 1
    ? dedupedPrices[dedupedPrices.length - 1].price - dedupedPrices[0].price
    : 0;

  return {
    articleNumber,
    name: matches[0].name,
    prices: dedupedPrices,
    cheapest,
    savings: Math.round(savings * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Catalog search (mock — real implementation needs supplier API keys)
// ---------------------------------------------------------------------------

// Mock catalog items per trade for demo mode
const MOCK_CATALOGS: Record<string, CatalogItem[]> = {
  plumbing: [
    { supplierId: 'technische_unie', articleNumber: 'TU-10234', name: 'Koperen buis 15mm 3m', category: 'buizen', priceExclVat: 12.50, vatRate: 21, unit: 'stuk', inStock: true, brand: 'Viega' },
    { supplierId: 'technische_unie', articleNumber: 'TU-10567', name: 'Knelkoppeling 15mm', category: 'fittingen', priceExclVat: 4.80, vatRate: 21, unit: 'stuk', inStock: true, brand: 'VSH' },
    { supplierId: 'brouwer', articleNumber: 'BR-2045', name: 'Thermostaatkraan set', category: 'kranen', priceExclVat: 89.00, vatRate: 21, unit: 'stuk', inStock: true, brand: 'Grohe' },
    { supplierId: 'solar_nederland', articleNumber: 'SN-8812', name: 'CV-ketel Nefit 24kW', category: 'verwarming', priceExclVat: 1250.00, vatRate: 21, unit: 'stuk', inStock: false, leadTimeDays: 5, brand: 'Nefit' },
  ],
  electrical: [
    { supplierId: 'rexel', articleNumber: 'RX-5501', name: 'YMvK 3x2.5mm² 100m', category: 'kabels', priceExclVat: 85.00, vatRate: 21, unit: 'rol', inStock: true, brand: 'Draka' },
    { supplierId: 'rexel', articleNumber: 'RX-5523', name: 'Aardlekschakelaar 30mA 2P', category: 'beveiliging', priceExclVat: 34.50, vatRate: 21, unit: 'stuk', inStock: true, brand: 'Hager' },
    { supplierId: 'technische_unie', articleNumber: 'TU-30112', name: 'Inbouwdoos 50mm', category: 'dozen', priceExclVat: 0.65, vatRate: 21, unit: 'stuk', inStock: true, brand: 'Attema' },
    { supplierId: 'sonepar', articleNumber: 'SP-7789', name: 'LED paneel 60x60 40W', category: 'verlichting', priceExclVat: 28.00, vatRate: 21, unit: 'stuk', inStock: true, brand: 'Philips' },
  ],
  painting: [
    { supplierId: 'hornbach', articleNumber: 'HB-P100', name: 'Sigma S2U Nova satin 2.5L', category: 'verf', priceExclVat: 42.00, vatRate: 21, unit: 'stuk', inStock: true, brand: 'Sigma' },
    { supplierId: 'hornbach', articleNumber: 'HB-P112', name: 'Sikkens Rubbol BL Satura 1L', category: 'verf', priceExclVat: 38.50, vatRate: 21, unit: 'stuk', inStock: true, brand: 'Sikkens' },
    { supplierId: 'hornbach', articleNumber: 'HB-P200', name: 'Schuurpapier K120 5m rol', category: 'schuurmateriaal', priceExclVat: 8.90, vatRate: 21, unit: 'rol', inStock: true },
  ],
  carpentry: [
    { supplierId: 'hornbach', articleNumber: 'HB-H300', name: 'Vuren balk 50x100 3m', category: 'hout', priceExclVat: 14.50, vatRate: 21, unit: 'stuk', inStock: true },
    { supplierId: 'hornbach', articleNumber: 'HB-H310', name: 'MDF plaat 18mm 244x122', category: 'plaatmateriaal', priceExclVat: 32.00, vatRate: 21, unit: 'stuk', inStock: true },
  ],
  gas: [
    { supplierId: 'technische_unie', articleNumber: 'TU-40100', name: 'Gasslang RVS 100cm', category: 'gasleiding', priceExclVat: 18.50, vatRate: 21, unit: 'stuk', inStock: true },
    { supplierId: 'solar_nederland', articleNumber: 'SN-9001', name: 'Intergas HRE 36/30 CW5', category: 'ketels', priceExclVat: 1450.00, vatRate: 21, unit: 'stuk', inStock: false, leadTimeDays: 7, brand: 'Intergas' },
  ],
};

export async function searchCatalog(query: string, trade?: string): Promise<CatalogItem[]> {
  // In production: search across connected supplier catalogs via API
  // For now: filter mock catalog by query string
  const q = query.toLowerCase();
  const items = trade && MOCK_CATALOGS[trade]
    ? MOCK_CATALOGS[trade]
    : Object.values(MOCK_CATALOGS).flat();

  return items.filter(
    item => item.name.toLowerCase().includes(q)
      || item.category.toLowerCase().includes(q)
      || item.articleNumber.toLowerCase().includes(q)
      || (item.brand?.toLowerCase().includes(q) ?? false)
  );
}
