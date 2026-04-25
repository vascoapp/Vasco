// =============================================================================
// PHOTO QUOTE HANDOFF — pass an AI-analyzed photo result into TieredQuoteBuilder
// =============================================================================
// Used when the contractor approves customer-submitted photos in the Keuzes
// (decisions) tab and hits "Draft quote from these photos". We call the
// analyze-photo Edge Function with URLs, stash the result in AsyncStorage,
// then navigate to the tiered-quote builder which reads + clears the handoff
// on mount.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const HANDOFF_KEY = '@vasco_photo_quote_handoff';

export interface PhotoQuoteHandoff {
  trackerId?: string;
  submissionId?: string;
  customerName?: string;
  photoUrls: string[];
  result: {
    jobType?: string;
    complexity?: string;
    estimatedHours?: number;
    detectedItems?: Array<{
      id: string;
      description: string;
      category: string;
      confidence: number;
      suggestedQuantity: number;
      unit: string;
      suggestedPrice: number;
      selected: boolean;
    }>;
    notes?: string[];
    warnings?: string[];
  } | null;
  createdAt: string;
}

/** Call the Edge Function with URLs and return a draft quote result. */
export async function analyzePhotoUrls(
  photoUrls: string[],
  opts: { trade?: string; country?: string } = {},
): Promise<PhotoQuoteHandoff['result']> {
  if (!isSupabaseConfigured || photoUrls.length === 0) return null;
  try {
    const { data, error } = await supabase.functions.invoke('analyze-photo', {
      body: {
        imageUrls: photoUrls,
        trade: opts.trade ?? 'general',
        country: opts.country ?? 'NL',
        mode: 'quote',
      },
    });
    if (error || !data) return null;
    if ((data as any).error) return (data as any).fallback ?? null;
    // R239+: persist for cross-quote learning
    import('./intelligenceCaptureService').then((m) =>
      m.persistPhotoAnalysis({
        trade: opts.trade ?? 'general',
        detectedMaterials: (data as any).detectedItems,
        estimatedComplexity: (data as any).estimatedComplexity,
        estimatedDurationHours: (data as any).estimatedDurationHours,
        estimatedCostEur: (data as any).estimatedTotal,
        rawResponse: data as any,
      }),
    ).catch(() => {});
    return data as any;
  } catch {
    return null;
  }
}

/** Stash a handoff for the TieredQuoteBuilder to pick up on its next mount. */
export async function stashHandoff(h: Omit<PhotoQuoteHandoff, 'createdAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({ ...h, createdAt: new Date().toISOString() }),
    );
  } catch {}
}

/** Read + clear any pending handoff. Returns null when none or stale (>1h). */
export async function consumeHandoff(): Promise<PhotoQuoteHandoff | null> {
  try {
    const raw = await AsyncStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(HANDOFF_KEY);
    const parsed = JSON.parse(raw) as PhotoQuoteHandoff;
    const ageMs = Date.now() - new Date(parsed.createdAt).getTime();
    if (ageMs > 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}
