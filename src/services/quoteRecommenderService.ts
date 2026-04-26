// =============================================================================
// QUOTE LINE RECOMMENDER (R246)
// =============================================================================
// Wraps the get_quote_line_recommendations RPC. Used by TieredQuoteBuilder
// to surface "contractors with similar quotes also added X line item Y%
// of the time" while the contractor is composing.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface LineRecommendation {
  description: string;
  suggestedUnitPrice: number;
  recommendationRate: number;        // 0-1, fraction of similar quotes
  contractorCount: number;
  sampleSize: number;
}

export async function getLineRecommendations(input: {
  trade: string;
  country: string;
  existingDescriptions: string[];
  limit?: number;
}): Promise<LineRecommendation[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('get_quote_line_recommendations', {
      p_trade: input.trade,
      p_country: input.country,
      p_existing_descriptions: input.existingDescriptions,
      p_limit: input.limit ?? 5,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map((r) => ({
      description: String(r.recommended_description),
      suggestedUnitPrice: Number(r.recommended_unit_price) || 0,
      recommendationRate: Number(r.recommendation_rate) || 0,
      contractorCount: Number(r.contractor_count) || 0,
      sampleSize: Number(r.sample_size) || 0,
    }));
  } catch {
    return [];
  }
}
