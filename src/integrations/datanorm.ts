// =============================================================================
// DATANORM INTEGRATION — German wholesale pricing file parser
// =============================================================================
// DATANORM is a flat-text file format (v4/v5) used by all German construction
// wholesalers (Richter+Frenzel, Thermaflex, Buderus, etc.) to distribute
// product catalogues and pricing.
// Reference: https://github.com/halo/datanorm
// Record types: A (article), B (description), P (price/EAN)
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { emitMaterialPurchased } from '../intelligence/dataCollector';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const IMPORTED_KEY = '@vasco_datanorm_imported';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DatanormArticle {
  articleNumber: string;
  description: string;
  extendedDescription?: string;
  brand?: string;
  category?: string;
  unitPrice: number;       // in EUR, net
  unit: string;            // e.g. "STK", "MTR", "PAK"
  packageSize: number;
  eanCode?: string;
  discountGroup?: string;
  manufacturerNumber?: string;
}

// ---------------------------------------------------------------------------
// Internal: record parsing helpers
// ---------------------------------------------------------------------------

/**
 * DATANORM v4 layout (pipe-delimited, fixed-ish fields):
 * Type A — article master record
 *   Field 0: record type "A"
 *   Field 1: article number
 *   Field 2: short description (line 1)
 *   Field 3: short description (line 2, optional)
 *   Field 4: price unit (e.g. "C" = 100 units)
 *   Field 5: unit price in cents (integer)
 *   Field 6: discount group
 *   Field 7: main product group
 *   Field 8: unit of measure
 *
 * Type B — extended description
 *   Field 0: "B"
 *   Field 1: article number
 *   Field 2: long description text
 *   Field 3: brand / manufacturer name
 *
 * Type P — price / EAN record
 *   Field 0: "P"
 *   Field 1: article number
 *   Field 2: EAN code
 *   Field 3: manufacturer article number
 *   Field 4: alternative price (optional)
 */

function parsePriceUnit(code: string): number {
  // Price unit multiplier: how many units the price refers to
  switch (code.toUpperCase().trim()) {
    case 'C': return 100;
    case 'M': return 1000;
    case '':
    case '1':
    case 'E':
    default: return 1;
  }
}

function parsePrice(raw: string, priceUnitCode: string): number {
  const cents = parseInt(raw, 10);
  if (isNaN(cents)) return 0;
  const divisor = parsePriceUnit(priceUnitCode);
  return cents / 100 / divisor; // cents → EUR, then per-unit
}

// ---------------------------------------------------------------------------
// DATANORM v4 parser
// ---------------------------------------------------------------------------

export function parseDateanormV4(text: string): DatanormArticle[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Intermediate maps keyed by article number
  const articles = new Map<string, DatanormArticle>();
  const bRecords = new Map<string, { description?: string; brand?: string }>();
  const pRecords = new Map<string, { eanCode?: string; manufacturerNumber?: string }>();

  for (const line of lines) {
    const fields = line.split(';');
    const recordType = (fields[0] ?? '').trim().toUpperCase();

    if (recordType === 'A' && fields.length >= 6) {
      const articleNumber = (fields[1] ?? '').trim();
      if (!articleNumber) continue;

      const desc1 = (fields[2] ?? '').trim();
      const desc2 = (fields[3] ?? '').trim();
      const priceUnitCode = (fields[4] ?? '').trim();
      const rawPrice = (fields[5] ?? '').trim();
      const discountGroup = (fields[6] ?? '').trim();
      const category = (fields[7] ?? '').trim();
      const unit = (fields[8] ?? 'STK').trim();

      articles.set(articleNumber, {
        articleNumber,
        description: desc2 ? `${desc1} ${desc2}` : desc1,
        unitPrice: parsePrice(rawPrice, priceUnitCode),
        unit: unit || 'STK',
        packageSize: parsePriceUnit(priceUnitCode),
        discountGroup: discountGroup || undefined,
        category: category || undefined,
      });
    } else if (recordType === 'B' && fields.length >= 3) {
      const articleNumber = (fields[1] ?? '').trim();
      if (!articleNumber) continue;
      bRecords.set(articleNumber, {
        description: (fields[2] ?? '').trim() || undefined,
        brand: (fields[3] ?? '').trim() || undefined,
      });
    } else if (recordType === 'P' && fields.length >= 3) {
      const articleNumber = (fields[1] ?? '').trim();
      if (!articleNumber) continue;
      pRecords.set(articleNumber, {
        eanCode: (fields[2] ?? '').trim() || undefined,
        manufacturerNumber: (fields[3] ?? '').trim() || undefined,
      });
    }
  }

  // Merge B and P records into A records
  for (const [artNr, article] of articles) {
    const b = bRecords.get(artNr);
    if (b) {
      if (b.description) article.extendedDescription = b.description;
      if (b.brand) article.brand = b.brand;
    }
    const p = pRecords.get(artNr);
    if (p) {
      if (p.eanCode) article.eanCode = p.eanCode;
      if (p.manufacturerNumber) article.manufacturerNumber = p.manufacturerNumber;
    }
  }

  return Array.from(articles.values());
}

// ---------------------------------------------------------------------------
// DATANORM v5 parser (extended format)
// ---------------------------------------------------------------------------

/**
 * DATANORM v5 extends v4 with:
 *   - Header record (type "V") with version info
 *   - Type A has additional fields: ETIM class code (field 9), package qty (field 10)
 *   - Type T (text block) for long descriptions, replaces some B records
 *   - Type R (reference/cross-ref to related articles)
 *
 * We parse the same core fields as v4 plus the extras.
 */

export function parseDateanormV5(text: string): DatanormArticle[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const articles = new Map<string, DatanormArticle>();
  const bRecords = new Map<string, { description?: string; brand?: string }>();
  const pRecords = new Map<string, { eanCode?: string; manufacturerNumber?: string }>();
  const tRecords = new Map<string, string>();

  for (const line of lines) {
    const fields = line.split(';');
    const recordType = (fields[0] ?? '').trim().toUpperCase();

    if (recordType === 'V') {
      // Version header — skip
      continue;
    }

    if (recordType === 'A' && fields.length >= 6) {
      const articleNumber = (fields[1] ?? '').trim();
      if (!articleNumber) continue;

      const desc1 = (fields[2] ?? '').trim();
      const desc2 = (fields[3] ?? '').trim();
      const priceUnitCode = (fields[4] ?? '').trim();
      const rawPrice = (fields[5] ?? '').trim();
      const discountGroup = (fields[6] ?? '').trim();
      const category = (fields[7] ?? '').trim();
      const unit = (fields[8] ?? 'STK').trim();
      // v5 extras
      const packageSize = parseInt(fields[10] ?? '', 10);

      articles.set(articleNumber, {
        articleNumber,
        description: desc2 ? `${desc1} ${desc2}` : desc1,
        unitPrice: parsePrice(rawPrice, priceUnitCode),
        unit: unit || 'STK',
        packageSize: !isNaN(packageSize) && packageSize > 0 ? packageSize : parsePriceUnit(priceUnitCode),
        discountGroup: discountGroup || undefined,
        category: category || undefined,
      });
    } else if (recordType === 'B' && fields.length >= 3) {
      const articleNumber = (fields[1] ?? '').trim();
      if (!articleNumber) continue;
      bRecords.set(articleNumber, {
        description: (fields[2] ?? '').trim() || undefined,
        brand: (fields[3] ?? '').trim() || undefined,
      });
    } else if (recordType === 'P' && fields.length >= 3) {
      const articleNumber = (fields[1] ?? '').trim();
      if (!articleNumber) continue;
      pRecords.set(articleNumber, {
        eanCode: (fields[2] ?? '').trim() || undefined,
        manufacturerNumber: (fields[3] ?? '').trim() || undefined,
      });
    } else if (recordType === 'T' && fields.length >= 3) {
      const articleNumber = (fields[1] ?? '').trim();
      const textContent = (fields[2] ?? '').trim();
      if (articleNumber && textContent) {
        const existing = tRecords.get(articleNumber) ?? '';
        tRecords.set(articleNumber, existing ? `${existing} ${textContent}` : textContent);
      }
    }
    // Type R (cross-reference) — skip for now
  }

  // Merge B, P, T records
  for (const [artNr, article] of articles) {
    const b = bRecords.get(artNr);
    if (b) {
      if (b.description) article.extendedDescription = b.description;
      if (b.brand) article.brand = b.brand;
    }
    const p = pRecords.get(artNr);
    if (p) {
      if (p.eanCode) article.eanCode = p.eanCode;
      if (p.manufacturerNumber) article.manufacturerNumber = p.manufacturerNumber;
    }
    const t = tRecords.get(artNr);
    if (t) {
      // T record text supplements or replaces B description
      article.extendedDescription = article.extendedDescription
        ? `${article.extendedDescription} ${t}`
        : t;
    }
  }

  return Array.from(articles.values());
}

// ---------------------------------------------------------------------------
// Import into Vasco pricing intelligence
// ---------------------------------------------------------------------------

/**
 * Feed parsed DATANORM articles into the Vasco pricing database.
 * Each article is emitted as a material_purchased event so the intelligence
 * engine can track supplier prices.
 */
async function loadImportedArticles(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(IMPORTED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

async function saveImportedArticles(set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(IMPORTED_KEY, JSON.stringify([...set]));
  } catch {
    // Non-critical — worst case we re-import duplicates next time
  }
}

// R12.3: write each imported article to material_catalog so it surfaces in
// the AddJobMaterialModal picker. Idempotent: if the (user_id, manufacturer_code)
// row already exists, swallow the unique-violation. Best-effort — failure here
// doesn't abort the moat write.
async function upsertMaterialCatalogRow(args: {
  name: string;
  manufacturerCode: string;
  unit: string;
  category: string;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Check existence first (manufacturer_code isn't a unique index, so we
    // emulate upsert manually to keep this safe across users).
    const { data: existing } = await (supabase
      .from('material_catalog' as any) as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('manufacturer_code', args.manufacturerCode)
      .maybeSingle();
    if (existing?.id) return; // already in catalog, skip
    await (supabase.from('material_catalog' as any) as any).insert({
      user_id: user.id,
      name: args.name.slice(0, 200),
      manufacturer_code: args.manufacturerCode,
      base_unit: args.unit || 'piece',
      category: args.category || 'general',
    });
  } catch {
    // Non-critical — moat write already succeeded
  }
}

export async function importDatanormToMoat(
  articles: DatanormArticle[],
  supplierId: string,
  options?: {
    supplierName?: string;
    trade?: string;
    country?: string;
    userId?: string;
  },
): Promise<{ imported: number; skipped: number }> {
  const userId = options?.userId ?? 'datanorm-import';
  const supplierName = options?.supplierName ?? supplierId;
  const trade = options?.trade ?? 'general';
  const country = options?.country ?? 'NL';

  // Load previously imported article numbers for deduplication
  const alreadyImported = await loadImportedArticles();

  let imported = 0;
  let skipped = 0;

  for (const article of articles) {
    if (!article.articleNumber || article.unitPrice <= 0) {
      skipped++;
      continue;
    }

    // Deduplicate: skip articles already imported from any supplier
    const dedupeKey = `${supplierId}:${article.articleNumber}`;
    if (alreadyImported.has(dedupeKey)) {
      skipped++;
      continue;
    }

    try {
      const fullName = article.extendedDescription
        ? `${article.description} — ${article.extendedDescription}`
        : article.description;
      await emitMaterialPurchased(userId, {
        materialName: fullName,
        supplierId,
        supplierName,
        price: article.unitPrice,
        quantity: article.packageSize || 1,
        unit: article.unit,
        trade,
        country,
        // R283: catalog imports must self-attribute as 'catalog' (was
        // previously falling through to the hardcoded 'invoice_scan'
        // default in dataCollector, polluting OCR sample stats).
        source: 'catalog',
      });
      // R12.3: also upsert into material_catalog so the imported article
      // appears in AddJobMaterialModal's picker. Was previously writing
      // only to material_price_history (the moat), so contractors saw a
      // "X imported" toast but nothing in their picker — DATANORM imports
      // were dormant for the German market they're built for.
      await upsertMaterialCatalogRow({
        name: fullName,
        manufacturerCode: article.articleNumber,
        unit: article.unit,
        category: trade,
      });
      alreadyImported.add(dedupeKey);
      imported++;
    } catch {
      skipped++;
    }
  }

  // Persist updated set
  await saveImportedArticles(alreadyImported);

  return { imported, skipped };
}
