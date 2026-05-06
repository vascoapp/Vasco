// =============================================================================
// ID REMAP BUS (R54)
// =============================================================================
// When a queued offline insert flushes, the BE generates a fresh uuid and
// the offline queue captures a temp→real id mapping (R49). But that
// mapping only rewrites FK references in *queued operations*. It does NOT
// reach side effects that fired synchronously alongside the original
// insert: ontology entities + relations keyed by tempId, embeddings (local
// AsyncStorage cache + Supabase `embeddings` rows) keyed by tempId,
// customer embeddings keyed under tempId in customer_embeddings.
//
// After a reconnect-flush, those side effects are stranded under a temp
// id that no longer exists in the canonical table. Semantic search by
// real id misses; ontology relations dangle; the cohort moat builds on
// orphaned rows.
//
// This bus closes the loop. `flushQueue` emits an `IdRemapEvent` after
// every successful insert that had a temp id. Listeners (ontology,
// semanticSearch, embeddingService) re-key their stranded rows under the
// new real id. In-process pub/sub — no React, no AsyncStorage, no
// circular imports.
// =============================================================================

import { logWarn } from '../utils/errorHandler';

export interface IdRemapEvent {
  /** Source table — same string the offline queue uses (`customers`, `jobs`, `materials`, `suppliers`, `job_materials`, `documents`, `projects`). */
  table: string;
  /** Temp id that was generated client-side (`c-{ts}` / `j-{ts}` / etc.). */
  tempId: string;
  /** BE-generated uuid returned by the insert. */
  realId: string;
  /** Original insert payload (with the temp id stripped). Listeners can
   *  derive embedding text / ontology attributes from it without having
   *  to look the row up again. */
  payload?: unknown;
}

type Listener = (e: IdRemapEvent) => void;

const listeners = new Set<Listener>();

/** Subscribe to remap events. Returns an unsubscribe function. */
export function subscribeIdRemap(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Emit a remap event. Listeners run synchronously; failures are caught
 *  per-listener so one bad subscriber can't break the others. */
export function emitIdRemap(event: IdRemapEvent): void {
  for (const fn of listeners) {
    try {
      fn(event);
    } catch (err) {
      logWarn('idRemapBus', `listener threw on ${event.table} ${event.tempId}→${event.realId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/** @internal Test-only — wipes all listeners. Production code never calls this. */
export function __resetForTests(): void {
  listeners.clear();
}
