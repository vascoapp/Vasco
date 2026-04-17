// =============================================================================
// PHOTO-TO-QUOTE TYPES
// =============================================================================
// Shared types for the entity ontology + implied materials graph.
// See docs/photo-to-quote-spec for product context.
// =============================================================================

export type Locale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
export type Country = 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK';
export type TradeId =
  | 'plumbing' | 'electrical' | 'painting' | 'tiling'
  | 'carpentry' | 'roofing' | 'gas-hvac' | 'plastering' | 'flooring';

export interface ImpliedMaterial {
  sku: string;
  displayName: Partial<Record<Locale, string>>;
  quantityPer: number;      // e.g. 1 kit per 1 tray, 0.5 bag per 1 tray
  unit: 'kit' | 'm' | 'm2' | 'each' | 'bag' | 'l' | 'roll';
  wasteFactor: number;      // 1.00 = no waste, 1.15 = 15% waste
  regionalWasteFactor?: Partial<Record<Country, number>>; // overrides per country
  vatCategory?: 'standard' | 'reduced'; // EU reduced rate on construction, varies
}

export interface TradeEntity {
  id: string;
  trade: TradeId;
  displayName: Partial<Record<Locale, string>>;

  /** Plain-English cues used in the Vision prompt. */
  visualCues: string[];

  /** Materials implied by presence of this entity. */
  impliedMaterials: ImpliedMaterial[];

  /** Labor hours this entity adds to the quote. */
  impliedLabor: { hours: number; confidence: number };

  /** Typical real-world dimensions when no scale anchor is detectable. */
  typicalDimensionsMm?: { w?: number; l?: number; h?: number };

  /** Country-specific size/code variants, useful for both prompt and UI. */
  regionalVariants?: Partial<Record<Country, { typicalSize?: string; code?: string; note?: string }>>;

  /** If this entity is a catch-all (e.g. "pipe we can't identify"), flag it. */
  ambiguous?: boolean;
}

/** What the Edge Function returns after vision + dictionary expansion. */
export interface PhotoQuoteDraft {
  overallConfidence: number;  // 0-1
  scaleCalibrated: boolean;
  detectedEntities: DetectedEntity[];
  lineItems: QuoteLineDraft[];
  laborHours: number;
  clarificationsNeeded: Array<{ question: string; entityId?: string }>;
  skippedObservations: Array<{ note: string; photoIndex: number }>;
}

export interface DetectedEntity {
  entityId: string;
  displayName: string;
  confidence: number;             // 0-1
  photoIndex: number;
  estimatedDimensions_mm?: { w?: number; l?: number; h?: number } | null;
  detectedCount: number;
}

export interface QuoteLineDraft {
  sku: string;
  displayName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  sourceEntityIds: string[];
  wasteFactorUsed: number;
  priceSource: string;
  confidence: number;
}
