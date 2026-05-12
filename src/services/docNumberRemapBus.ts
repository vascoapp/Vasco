// =============================================================================
// DOC NUMBER REMAP BUS (R66r62)
// =============================================================================
// Closes R66.36: cross-device offline counter collision.
//
// When two devices are both offline, they previously each minted Q0008 from
// their local AsyncStorage counter. On reconnect, the second insert hit a
// 23505 unique-constraint violation on `documents.document_number` and the
// contractor saw a generic "could not save" error.
//
// New model:
//   1. While offline, `nextDocumentNumber` returns a placeholder like
//      `Q-OFF-A3F2B1` (clearly NOT in the BE sequence) — see `dataProvider.ts:offlineMintedDocNumber`.
//   2. The local Quote / Invoice row is created in AppState with that
//      placeholder as its `document_number`.
//   3. The offline write queue (`offlineWriteQueue.applyWrite`) detects
//      the `Q-OFF-`/`I-OFF-` prefix at flush time. It calls the canonical
//      `next_document_number` RPC, swaps the placeholder for the real
//      number in the queued payload, then performs the insert. No
//      collision possible — the BE RPC is the single source of truth.
//   4. Right after the insert succeeds, the queue emits a `DocNumberRemapEvent`
//      on this bus. AppState listens and rewrites the local Quote/Invoice
//      row's `document_number` so the contractor's UI shows the canonical
//      `Q0008` instead of the placeholder.
//
// In-process pub/sub. Mirrors `idRemapBus` (R54) which handles the parallel
// tempId→realId rekeying for FK side effects (ontology, embeddings).
// =============================================================================

import { logWarn } from '../utils/errorHandler';

export interface DocNumberRemapEvent {
  /** 'quote' or 'invoice' — which doc family the row belongs to. */
  docType: 'quote' | 'invoice';
  /** The placeholder number the FE minted while offline (`Q-OFF-...` / `I-OFF-...`). */
  placeholderNumber: string;
  /** The canonical number the BE RPC assigned at flush time. */
  realNumber: string;
}

type Listener = (e: DocNumberRemapEvent) => void;

const listeners = new Set<Listener>();

/** Subscribe to doc-number remap events. Returns unsubscribe. */
export function subscribeDocNumberRemap(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Emit a remap event. Listeners run synchronously; failures isolated. */
export function emitDocNumberRemap(event: DocNumberRemapEvent): void {
  for (const fn of listeners) {
    try {
      fn(event);
    } catch (err) {
      logWarn('docNumberRemapBus', `listener threw on ${event.docType} ${event.placeholderNumber}→${event.realNumber}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/** @internal Test-only — wipes all listeners. */
export function __resetForTests(): void {
  listeners.clear();
}
