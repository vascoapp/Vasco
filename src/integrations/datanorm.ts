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
import { canonicalMaterialKey } from '../services/materialNormalization';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logWarn } from '../utils/errorHandler';

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
 * Feed parsed DATANORM articles into the contractor's price history.
 *
 * The SERVER decides what is new (`import_catalog_prices`, migration
 * 20261001000002): a price row is written only where it differs from the
 * contractor's newest one for that supplier + article, and the catalogue row
 * and the price row of a batch land in one transaction.
 *
 * It used to be decided here, from "the price each article was last imported
 * at" kept in AsyncStorage (#363 → #366 → C4). A wholesaler list is 100k+
 * articles ≈ 3 MB of that map against Android's ~6 MB AsyncStorage TOTAL —
 * a full store fails every setItem, the offline queue's included — and it
 * lived on one phone, so another device wrote the whole list again. Each
 * article also cost ~5 requests (catalogue lookup + insert, price insert, a
 * `material_purchased` event nothing reads; a list price is not a purchase):
 * half a million round trips for one list.
 */
// The old local map, removed on the next import to give the space back.
const IMPORTED_KEY_PREFIX = '@vasco_datanorm_imported';

/** Articles per request: ~150 KB of JSON, well under the server's 5,000 cap. */
export const CATALOG_BATCH = 1000;

async function dropLocalImportState(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(IMPORTED_KEY_PREFIX));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch (e) {
    logWarn('datanorm', `old import state not removed: ${e}`);
  }
}

export async function importDatanormToMoat(
  articles: DatanormArticle[],
  supplierId: string,
  options?: {
    supplierName?: string;
    trade?: string;
    country?: string;
  },
): Promise<{ imported: number; skipped: number; failed: number }> {
  const supplierName = options?.supplierName ?? supplierId;
  const trade = options?.trade ?? 'general';
  // No market, no rows — it was filed under NL (sweep D6). The screen asks
  // for the country before importing; this is the backstop.
  const country = options?.country;
  if (!country) return { imported: 0, skipped: 0, failed: articles.length };

  await dropLocalImportState();

  // Rows the server could never take are skipped here, so "failed" means only
  // "did not land — import again".
  let skipped = 0;
  const items: Array<{ a: string; n: string; u: string; p: number; k: string }> = [];
  for (const article of articles) {
    // DATANORM prices are EUR net (see DatanormArticle.unitPrice). Four
    // decimals: a price per 100 divided down can have more, and a JSON number
    // in exponent form ("1e-7") is not a price the server accepts.
    const price = Number.isFinite(article.unitPrice) ? Number(article.unitPrice.toFixed(4)) : 0;
    if (!article.articleNumber || !(price > 0)) {
      skipped++;
      continue;
    }
    const name = article.extendedDescription
      ? `${article.description} — ${article.extendedDescription}`
      : article.description;
    items.push({
      a: article.articleNumber,
      n: name,
      u: article.unit,
      p: price,
      // The same key every other price row gets: supplier-namespaced article
      // number, so the price watch pairs this year's list with last year's.
      k: canonicalMaterialKey({ description: name, articleNumber: article.articleNumber, supplierId, unit: article.unit }).key,
    });
  }

  let imported = 0;
  let failed = 0;
  // No backend: nothing can land. Not "imported".
  if (!isSupabaseConfigured) return { imported: 0, skipped, failed: items.length };

  let failedInARow = 0;
  for (let i = 0; i < items.length; i += CATALOG_BATCH) {
    const batch = items.slice(i, i + CATALOG_BATCH);
    // A session that expired or a network that is gone fails every batch: a
    // 100k list would sit behind the spinner for 100 failing requests. Two in
    // a row → the rest is "not saved, import again" (review 2026-10-01).
    if (failedInARow >= 2) {
      failed += batch.length;
      continue;
    }
    try {
      const { data, error } = await (supabase.rpc as any)('import_catalog_prices', {
        p_supplier_id: supplierId,
        p_supplier_name: supplierName,
        p_trade: trade,
        p_country: country,
        p_currency: 'EUR',
        p_items: batch,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row || typeof row.imported !== 'number') throw error ?? new Error('no result');
      imported += row.imported;
      skipped += row.skipped;
      failedInARow = 0;
    } catch (e) {
      failedInARow++;
      // The batch is one transaction: nothing of it landed, and importing the
      // file again writes exactly what is still missing.
      logWarn('datanorm', `batch ${i / CATALOG_BATCH} not saved: ${e}`);
      failed += batch.length;
    }
  }

  return { imported, skipped, failed };
}
