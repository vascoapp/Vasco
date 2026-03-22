// =============================================================================
// ETIM INTEGRATION — European Technical Information Model
// =============================================================================
// API docs: https://etimapi.etim-international.com
// ETIM classifies construction products (pipes, cables, fittings, valves, etc.)
// Used for standardised material classification across EU wholesalers
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://etimapi.etim-international.com';
const CACHE_KEY = '@vasco_etim_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EtimFeature {
  code: string;        // e.g. "EF000007"
  description: string; // e.g. "Nominal diameter"
  type: 'numeric' | 'alphanumeric' | 'logical' | 'range';
  unit?: string;       // e.g. "mm"
  values?: { code: string; description: string }[];
}

export interface EtimClass {
  code: string;        // e.g. "EC000001"
  description: string; // e.g. "Copper pipe"
  group: string;       // e.g. "EG000012"
  groupDescription: string;
  features: EtimFeature[];
  synonyms: string[];
}

export interface EtimProduct {
  id: string;
  name: string;
  etimClassCode: string;
  etimClassName: string;
  manufacturer?: string;
  eanCode?: string;
  features: Record<string, string | number | boolean>;
}

export interface EtimSearchResult {
  query: string;
  totalCount: number;
  products: EtimProduct[];
  classes: Pick<EtimClass, 'code' | 'description' | 'group' | 'groupDescription'>[];
}

interface EtimConfig {
  clientId: string;
  clientSecret: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// OAuth2 token management
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(config: EtimConfig): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }).toString(),
  });

  if (!response.ok) throw new Error(`ETIM auth failed: ${response.status}`);

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 60s early
  return accessToken!;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY}_${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      await AsyncStorage.removeItem(`${CACHE_KEY}_${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(`${CACHE_KEY}_${key}`, JSON.stringify(entry));
  } catch {
    // cache write failure is non-critical
  }
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

let _config: EtimConfig | null = null;

export function configureEtim(config: EtimConfig): void {
  _config = config;
  accessToken = null;
  tokenExpiry = 0;
}

export async function searchEtimProducts(query: string): Promise<EtimSearchResult> {
  const cacheKey = `search_${query.toLowerCase().trim()}`;
  const cached = await getCached<EtimSearchResult>(cacheKey);
  if (cached) return cached;

  // Try API if configured
  if (_config) {
    try {
      const token = await getAccessToken(_config);
      const response = await fetch(
        `${API_BASE}/api/v2/products/search?q=${encodeURIComponent(query)}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.ok) {
        const data = await response.json();
        const result: EtimSearchResult = {
          query,
          totalCount: data.totalCount ?? data.products?.length ?? 0,
          products: (data.products ?? []).map((p: any) => ({
            id: p.id,
            name: p.name ?? p.description,
            etimClassCode: p.etimClassCode ?? p.classCode,
            etimClassName: p.etimClassName ?? p.classDescription ?? '',
            manufacturer: p.manufacturer,
            eanCode: p.eanCode,
            features: p.features ?? {},
          })),
          classes: (data.classes ?? []).map((c: any) => ({
            code: c.code,
            description: c.description,
            group: c.group ?? '',
            groupDescription: c.groupDescription ?? '',
          })),
        };
        await setCache(cacheKey, result);
        return result;
      }
    } catch {
      // fall through to fallback
    }
  }

  // Fallback: match against hardcoded classes
  const matched = classifyFromFallback(query);
  const result: EtimSearchResult = {
    query,
    totalCount: matched.length,
    products: [],
    classes: matched.map((c) => ({
      code: c.code,
      description: c.description,
      group: c.group,
      groupDescription: c.groupDescription,
    })),
  };
  await setCache(cacheKey, result);
  return result;
}

export async function getEtimClass(code: string): Promise<EtimClass | null> {
  const cacheKey = `class_${code}`;
  const cached = await getCached<EtimClass>(cacheKey);
  if (cached) return cached;

  // Try API
  if (_config) {
    try {
      const token = await getAccessToken(_config);
      const response = await fetch(`${API_BASE}/api/v2/classes/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const etimClass: EtimClass = {
          code: data.code,
          description: data.description,
          group: data.group ?? '',
          groupDescription: data.groupDescription ?? '',
          features: (data.features ?? []).map((f: any) => ({
            code: f.code,
            description: f.description,
            type: f.type ?? 'alphanumeric',
            unit: f.unit,
            values: f.values,
          })),
          synonyms: data.synonyms ?? [],
        };
        await setCache(cacheKey, etimClass);
        return etimClass;
      }
    } catch {
      // fall through to fallback
    }
  }

  // Fallback
  const fallback = FALLBACK_CLASSES.find((c) => c.code === code);
  if (!fallback) return null;

  const result: EtimClass = {
    ...fallback,
    features: [],
    synonyms: fallback.keywords,
  };
  await setCache(cacheKey, result);
  return result;
}

/**
 * Classify a freetext material description to the nearest ETIM class(es)
 * using keyword matching against fallback data or the API.
 */
export async function classifyMaterial(
  description: string,
): Promise<Pick<EtimClass, 'code' | 'description' | 'group' | 'groupDescription'>[]> {
  const cacheKey = `classify_${description.toLowerCase().trim()}`;
  const cached = await getCached<Pick<EtimClass, 'code' | 'description' | 'group' | 'groupDescription'>[]>(cacheKey);
  if (cached) return cached;

  // Try API search first
  if (_config) {
    try {
      const searchResult = await searchEtimProducts(description);
      if (searchResult.classes.length > 0) {
        await setCache(cacheKey, searchResult.classes);
        return searchResult.classes;
      }
    } catch {
      // fall through
    }
  }

  // Keyword matching against fallback
  const matched = classifyFromFallback(description);
  const result = matched.map((c) => ({
    code: c.code,
    description: c.description,
    group: c.group,
    groupDescription: c.groupDescription,
  }));
  await setCache(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------------------
// Fallback: top 50 construction ETIM classes
// ---------------------------------------------------------------------------

interface FallbackClass {
  code: string;
  description: string;
  group: string;
  groupDescription: string;
  keywords: string[];
}

function classifyFromFallback(query: string): FallbackClass[] {
  const terms = query.toLowerCase().split(/[\s,;/]+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored = FALLBACK_CLASSES.map((cls) => {
    let score = 0;
    for (const term of terms) {
      for (const kw of cls.keywords) {
        if (kw.includes(term) || term.includes(kw)) {
          score += kw === term ? 3 : 1;
        }
      }
      if (cls.description.toLowerCase().includes(term)) score += 2;
    }
    return { cls, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map((s) => s.cls);
}

const FALLBACK_CLASSES: FallbackClass[] = [
  // Pipes & tubes
  { code: 'EC000001', description: 'Copper pipe', group: 'EG000012', groupDescription: 'Pipes & tubes', keywords: ['copper', 'pipe', 'koper', 'buis', 'kupfer', 'rohr'] },
  { code: 'EC000002', description: 'PVC pipe', group: 'EG000012', groupDescription: 'Pipes & tubes', keywords: ['pvc', 'pipe', 'buis', 'kunststof', 'plastic'] },
  { code: 'EC000003', description: 'Steel pipe', group: 'EG000012', groupDescription: 'Pipes & tubes', keywords: ['steel', 'pipe', 'staal', 'stahl', 'buis'] },
  { code: 'EC000004', description: 'Multilayer pipe', group: 'EG000012', groupDescription: 'Pipes & tubes', keywords: ['multilayer', 'meerlagen', 'alpex', 'pex-al', 'composite'] },
  { code: 'EC000005', description: 'PE pipe', group: 'EG000012', groupDescription: 'Pipes & tubes', keywords: ['pe', 'polyethylene', 'hdpe', 'gasleiding'] },
  { code: 'EC000006', description: 'PP pipe', group: 'EG000012', groupDescription: 'Pipes & tubes', keywords: ['pp', 'polypropylene', 'afvoer', 'drain'] },

  // Fittings
  { code: 'EC000010', description: 'Copper fitting', group: 'EG000013', groupDescription: 'Fittings', keywords: ['fitting', 'koppeling', 'elbow', 'tee', 'copper', 'solder', 'capillair'] },
  { code: 'EC000011', description: 'Press fitting', group: 'EG000013', groupDescription: 'Fittings', keywords: ['press', 'persfitting', 'crimp', 'mapress', 'viega'] },
  { code: 'EC000012', description: 'Push-fit fitting', group: 'EG000013', groupDescription: 'Fittings', keywords: ['push', 'steek', 'click', 'pushfit', 'speedfit'] },
  { code: 'EC000013', description: 'Threaded fitting', group: 'EG000013', groupDescription: 'Fittings', keywords: ['thread', 'draad', 'gewinde', 'nipple', 'union', 'koppeling'] },
  { code: 'EC000014', description: 'PVC fitting', group: 'EG000013', groupDescription: 'Fittings', keywords: ['pvc', 'fitting', 'lijm', 'glue', 'mof', 'bocht'] },

  // Valves
  { code: 'EC000020', description: 'Ball valve', group: 'EG000015', groupDescription: 'Valves', keywords: ['ball', 'kogelkraan', 'kugelventil', 'valve', 'kraan'] },
  { code: 'EC000021', description: 'Gate valve', group: 'EG000015', groupDescription: 'Valves', keywords: ['gate', 'schuif', 'afsluiter', 'schieber'] },
  { code: 'EC000022', description: 'Check valve', group: 'EG000015', groupDescription: 'Valves', keywords: ['check', 'terugslagklep', 'non-return', 'ruckschlag'] },
  { code: 'EC000023', description: 'Thermostatic valve', group: 'EG000015', groupDescription: 'Valves', keywords: ['thermostatic', 'thermostatisch', 'radiator', 'trv'] },
  { code: 'EC000024', description: 'Pressure reducing valve', group: 'EG000015', groupDescription: 'Valves', keywords: ['pressure', 'druk', 'reduceer', 'reducer', 'prv'] },

  // Cables & wiring
  { code: 'EC000030', description: 'Installation cable', group: 'EG000020', groupDescription: 'Cables & wiring', keywords: ['cable', 'kabel', 'vob', 'xvb', 'ymvk', 'nym', 'wire', 'draad'] },
  { code: 'EC000031', description: 'Data cable', group: 'EG000020', groupDescription: 'Cables & wiring', keywords: ['data', 'utp', 'cat5', 'cat6', 'ethernet', 'netwerk'] },
  { code: 'EC000032', description: 'Coaxial cable', group: 'EG000020', groupDescription: 'Cables & wiring', keywords: ['coax', 'coaxial', 'antenna', 'tv'] },
  { code: 'EC000033', description: 'Flexible cable', group: 'EG000020', groupDescription: 'Cables & wiring', keywords: ['flex', 'snoer', 'h05vv', 'extension', 'verlenging'] },

  // Switches & sockets
  { code: 'EC000040', description: 'Light switch', group: 'EG000022', groupDescription: 'Switches & sockets', keywords: ['switch', 'schakelaar', 'schalter', 'licht', 'light'] },
  { code: 'EC000041', description: 'Socket outlet', group: 'EG000022', groupDescription: 'Switches & sockets', keywords: ['socket', 'stopcontact', 'steckdose', 'outlet', 'wandcontactdoos'] },
  { code: 'EC000042', description: 'Dimmer', group: 'EG000022', groupDescription: 'Switches & sockets', keywords: ['dimmer', 'variateur', 'dimmen'] },
  { code: 'EC000043', description: 'Distribution board', group: 'EG000022', groupDescription: 'Switches & sockets', keywords: ['distribution', 'groepenkast', 'verdeelkast', 'zekeringkast', 'consumer unit'] },

  // Heating
  { code: 'EC000050', description: 'Radiator', group: 'EG000030', groupDescription: 'Heating', keywords: ['radiator', 'heizkorper', 'paneel', 'convector'] },
  { code: 'EC000051', description: 'Boiler', group: 'EG000030', groupDescription: 'Heating', keywords: ['boiler', 'ketel', 'cv', 'heizkessel', 'combi', 'gasketel'] },
  { code: 'EC000052', description: 'Heat pump', group: 'EG000030', groupDescription: 'Heating', keywords: ['heat pump', 'warmtepomp', 'warmepumpe', 'air source', 'lucht'] },
  { code: 'EC000053', description: 'Underfloor heating', group: 'EG000030', groupDescription: 'Heating', keywords: ['underfloor', 'vloerverwarming', 'fussbodenheizung', 'ufh'] },
  { code: 'EC000054', description: 'Thermostat', group: 'EG000030', groupDescription: 'Heating', keywords: ['thermostat', 'thermostaat', 'tado', 'nest', 'honeywell'] },

  // Sanitary
  { code: 'EC000060', description: 'Toilet', group: 'EG000035', groupDescription: 'Sanitary', keywords: ['toilet', 'wc', 'closet', 'geberit'] },
  { code: 'EC000061', description: 'Washbasin', group: 'EG000035', groupDescription: 'Sanitary', keywords: ['basin', 'wastafel', 'waschbecken', 'sink', 'lavabo'] },
  { code: 'EC000062', description: 'Shower', group: 'EG000035', groupDescription: 'Sanitary', keywords: ['shower', 'douche', 'dusche', 'douchekop'] },
  { code: 'EC000063', description: 'Bath', group: 'EG000035', groupDescription: 'Sanitary', keywords: ['bath', 'bad', 'badewanne', 'bathtub', 'ligbad'] },
  { code: 'EC000064', description: 'Tap / faucet', group: 'EG000035', groupDescription: 'Sanitary', keywords: ['tap', 'kraan', 'faucet', 'armatur', 'mixer', 'mengkraan'] },

  // Fixings & fasteners
  { code: 'EC000070', description: 'Screw', group: 'EG000040', groupDescription: 'Fixings & fasteners', keywords: ['screw', 'schroef', 'schraube', 'houtschroef', 'spaanplaat'] },
  { code: 'EC000071', description: 'Anchor / plug', group: 'EG000040', groupDescription: 'Fixings & fasteners', keywords: ['anchor', 'plug', 'rawl', 'dubel', 'muurplug', 'fischer'] },
  { code: 'EC000072', description: 'Pipe clamp', group: 'EG000040', groupDescription: 'Fixings & fasteners', keywords: ['clamp', 'beugel', 'rohrschelle', 'pipe clip', 'buisklem'] },
  { code: 'EC000073', description: 'Cable tray', group: 'EG000040', groupDescription: 'Fixings & fasteners', keywords: ['tray', 'kabelgoot', 'kabelrinne', 'channel', 'goot'] },

  // Insulation
  { code: 'EC000080', description: 'Pipe insulation', group: 'EG000045', groupDescription: 'Insulation', keywords: ['insulation', 'isolatie', 'dammung', 'armaflex', 'foam', 'lagging'] },
  { code: 'EC000081', description: 'Thermal insulation board', group: 'EG000045', groupDescription: 'Insulation', keywords: ['board', 'plaat', 'eps', 'xps', 'pir', 'rockwool', 'glaswol'] },

  // Sealants & adhesives
  { code: 'EC000085', description: 'Silicone sealant', group: 'EG000048', groupDescription: 'Sealants & adhesives', keywords: ['silicone', 'kit', 'sealant', 'afdichten'] },
  { code: 'EC000086', description: 'PTFE tape', group: 'EG000048', groupDescription: 'Sealants & adhesives', keywords: ['ptfe', 'teflon', 'tape', 'thread seal', 'teflontape'] },
  { code: 'EC000087', description: 'PVC glue', group: 'EG000048', groupDescription: 'Sealants & adhesives', keywords: ['glue', 'lijm', 'pvc', 'cement', 'kleber'] },

  // Paint & coatings
  { code: 'EC000090', description: 'Wall paint', group: 'EG000050', groupDescription: 'Paint & coatings', keywords: ['paint', 'verf', 'farbe', 'muurverf', 'latex', 'emulsion'] },
  { code: 'EC000091', description: 'Primer', group: 'EG000050', groupDescription: 'Paint & coatings', keywords: ['primer', 'grondverf', 'grundierung', 'voorstrijk'] },

  // Wood & timber
  { code: 'EC000095', description: 'Timber beam', group: 'EG000055', groupDescription: 'Wood & timber', keywords: ['timber', 'hout', 'holz', 'beam', 'balk', 'plank', 'lat'] },
  { code: 'EC000096', description: 'Plywood / board', group: 'EG000055', groupDescription: 'Wood & timber', keywords: ['plywood', 'triplex', 'mdf', 'osb', 'multiplex', 'board'] },

  // Ventilation
  { code: 'EC000100', description: 'Ventilation duct', group: 'EG000060', groupDescription: 'Ventilation', keywords: ['duct', 'kanaal', 'ventilation', 'luchtkanaal', 'kanal'] },
  { code: 'EC000101', description: 'Extraction fan', group: 'EG000060', groupDescription: 'Ventilation', keywords: ['fan', 'ventilator', 'afzuiging', 'extractor', 'badkamer'] },
  { code: 'EC000102', description: 'Heat recovery unit', group: 'EG000060', groupDescription: 'Ventilation', keywords: ['hrv', 'wtw', 'heat recovery', 'warmteterugwinning', 'mvhr'] },
];
