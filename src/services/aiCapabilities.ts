// =============================================================================
// AI CAPABILITIES — which AI features the server can run right now
// =============================================================================
// Asks the `ai-capabilities` edge function (booleans only) and caches the
// answer for an hour, so photo → quote, the receipt scanner and scope drafting
// switch on by themselves the moment the operator sets ANTHROPIC_API_KEY —
// no build, no OTA. The build flags in config/ai.ts stay as an OVERRIDE
// (force-on for a dev build) and as the fallback when the server cannot be
// asked: unreachable means OFF, never "assume it works" — a tile that answers
// "konnte nicht generiert werden" after twelve seconds is worse than no tile.
// =============================================================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { LLM_GENERATION_ENABLED, EMBEDDINGS_ENABLED } from '../config/ai';

export interface AiCapabilities {
  /** Photo analysis (Claude Vision): photo → quote, receipt scanner. */
  vision: boolean;
  /** Text generation (Claude or Kimi): scope of work, phrasing. */
  text: boolean;
  /** Embeddings: semantic search. */
  embeddings: boolean;
}

const CACHE_KEY = '@vasco_ai_capabilities';
const TTL_MS = 60 * 60 * 1000;

/** What the BUILD allows on its own — the floor, and the offline answer. */
export const BUILD_CAPABILITIES: AiCapabilities = {
  vision: LLM_GENERATION_ENABLED,
  text: LLM_GENERATION_ENABLED,
  embeddings: EMBEDDINGS_ENABLED,
};

let memo: { at: number; caps: AiCapabilities } | null = null;
let inflight: Promise<AiCapabilities> | null = null;

function merge(server: Partial<AiCapabilities> | null | undefined): AiCapabilities {
  return {
    vision: BUILD_CAPABILITIES.vision || server?.vision === true,
    text: BUILD_CAPABILITIES.text || server?.text === true,
    embeddings: BUILD_CAPABILITIES.embeddings || server?.embeddings === true,
  };
}

export async function getAiCapabilities(opts: { force?: boolean } = {}): Promise<AiCapabilities> {
  const now = Date.now();
  if (!opts.force && memo && now - memo.at < TTL_MS) return memo.caps;
  if (!opts.force) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { at: number; caps: AiCapabilities };
        if (now - cached.at < TTL_MS) {
          memo = cached;
          return cached.caps;
        }
      }
    } catch {}
  }
  if (!isSupabaseConfigured) return BUILD_CAPABILITIES;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-capabilities', { body: {} });
      if (error || !data) return BUILD_CAPABILITIES;
      const caps = merge(data as Partial<AiCapabilities>);
      memo = { at: Date.now(), caps };
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memo)).catch(() => {});
      return caps;
    } catch {
      return BUILD_CAPABILITIES;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Test seam. */
export function __resetAiCapabilitiesForTests(): void {
  memo = null;
  inflight = null;
}

/**
 * Starts from the build flags (so a render never flashes a dark feature ON),
 * then updates once the server answers.
 */
export function useAiCapabilities(): AiCapabilities {
  const [caps, setCaps] = useState<AiCapabilities>(memo?.caps ?? BUILD_CAPABILITIES);
  useEffect(() => {
    let cancelled = false;
    getAiCapabilities().then((c) => { if (!cancelled) setCaps(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return caps;
}
