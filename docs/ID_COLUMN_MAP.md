# ID Column Map — FE ↔ BE ↔ Supabase

Active as of R59 (2026-05-05). This document is the source of truth for how identifying columns flow through the stack. Update when adding a new entity or moat table.

## R59 update — id-shape helpers

`src/lib/idShape.ts` exports four helpers that are the single source of truth for distinguishing temp ids from BE-generated uuids:
- `isTempId(id)` — strict pattern match against the 8 known temp prefixes (returns false for synthetic ids like `j-rec-{ts}-{rand}` or `j-seed-1` that live outside the temp→real lifecycle)
- `isTempIdFast(id)` — single-regex equivalent for hot loops
- `isUuid(id)` — RFC 4122 v4 shape check
- `isMoatSafeId(id)` — `true` for real uuids OR stable display strings (docNumber). Used at moat-write sites that bypass the offline queue

Direct-to-BE moat writes (those that don't route through `offlineWriteQueue`) MUST gate against temp ids. Three patterns:
1. **Required FK that is the cohort key** (`job_outcomes.job_id`, `invoice_outcomes.invoice_id`, `accounting_loops.job_id`, `job_quality_signals.job_id`) — drop the write entirely with `if (isTempIdFast(jobId)) return;` because null breaks the cohort row's identity.
2. **Optional FK columns** (`photo_analyses.job_id`, `photo_analyses.quote_id`, `customer_portal_events.quote_id`, `accounting_loops.customer_id/quote_id/invoice_id`) — call `nullifyTempId(id)` so the row lands with a `null` FK; the analysis/event payload still has cohort value, and an idRemapBus listener (future) can re-link later.
3. **Storage paths or composite keys that embed the id** (`job-photos/{user_id}/{job_id}/{uuid}.jpg`) — refuse the upload (`if (isTempIdFast(jobId)) return null;`). Caller retries post-flush so the file lands under the real id.

The R54 `idRemapBus` already covers in-process cache rewrites (ontology, semanticSearch local cache, customer_embeddings); R59 extends this with `dataCollector` rewriting queued `business_events.entity_id` + `payload.*Id` fields when a remap fires.

## Why this exists

Every id column is a contract between three layers:
1. **FE in-memory state** — `Customer.id`, `Job.id`, etc. in `AppState.tsx`
2. **BE wrappers** — `dataProvider.ts` `dbCreate*`/`dbUpdate*` functions
3. **Supabase tables** — actual columns with FK + RLS constraints

Drift between layers caused entire categories of bugs (R49 FK rewrites, R52 stale embedding ids, R54 stranded ontology entities, R241/R275/R283 moat schema realignment). This map locks the invariants.

## Identifier flow

```
addX() in AppState.tsx
  ↓ generates tempId (`c-{ts}` / `j-{ts}` / etc.)
  ↓ optimistic UI update with tempId
  ↓ calls dbCreateX() in dataProvider.ts with payload (no id — BE generates)
  ↓ on BE success: row.id replaces tempId in AppState (`finalId = row.id`)
  ↓ on BE failure: queueWrite() with payload + tempId
  ↓
offlineWriteQueue.flushQueue() on next online tick
  ↓ insert hits BE → BE generates real uuid
  ↓ R49 captures temp→real mapping
  ↓ R49 rewrites FK references in subsequent queued rows (jobs.customer_id, etc.)
  ↓ R54 emits IdRemapEvent on idRemapBus with {table, tempId, realId, payload}
  ↓
Listeners on idRemapBus re-key their stranded rows under realId:
  - ontology.ts → entities Map + relations[] rewrites
  - semanticSearch.ts → @vasco_embeddings cache + Supabase embeddings.id update
  - embeddingService.ts → re-fires embedCustomer with realId + payload-derived text
```

## Per-entity contract

| Entity | FE state field | BE create fn | Supabase table | Owner column | Reset id key |
|---|---|---|---|---|---|
| Customer | `Customer.id` | `dbCreateCustomer` | `customers.id` (uuid) | `user_id` | `c-{ts}` |
| Job | `Job.id` | `dbCreateJob` | `jobs.id` (uuid) | `user_id` | `j-{ts}` |
| Quote | `Quote.id` | `createDocument` | `documents.id` (uuid, doc_type='quote') | `user_id` | `q-{ts}` (FE uses doc_number for display) |
| Invoice | `Invoice.id` | `createDocument` | `documents.id` (uuid, doc_type='invoice') | `user_id` | `inv-{ts}` |
| Material (catalog) | `Material.id` | `dbCreateMaterial` | `materials.id` (uuid) | `user_id` | `mat-{ts}` |
| Supplier | `Supplier.id` | `dbCreateSupplier` | `suppliers.id` (uuid) | `user_id` | `sup-{ts}` |
| Job Material (junction) | `JobMaterial.id` | `dbCreateJobMaterial` | `job_materials.id` (uuid) | `user_id` | `jm-{ts}` |
| Project | `Project.id` | `dbCreateProject` | `projects.id` (uuid) | `user_id` | `proj-{ts}` |

### R61 column additions (no new entity)

| Column | Owner table | Purpose |
|---|---|---|
| `documents.scope_text` | `documents` | AI-generated narrative SOW. Persisted via existing `updateDocument` (R57 dual-route handles uuid/docNumber). |
| `business_settings.quote_tone` | `business_settings` | Cold-start tone preset (`formal\|friendly\|detailed\|concise`). Read by `loadQuoteTonePreset`, written by `saveQuoteTonePreset`. |

## Moat / cohort tables (cross-cutting)

These tables aggregate signals across entities. Their FK columns must reference the **real BE uuid** of the source entity, never a temp id. R49 + R54 ensure this.

| Table | Owner column | Cohort key | FK to entity | Source emitter |
|---|---|---|---|---|
| `business_events` | `user_id` | `(user_id, trade, country)` | `entity_id` (string, polymorphic by `entity_type`) | `emitBusinessEvent` |
| `material_price_history` | `observed_by` (auth.uid) | `(trade, country, material_name)` | (no FK; uses material_name + supplier_name) | `emitMaterialPurchased` |
| `pricing_intelligence` | `user_id` | `(trade, country)` | `quote_id` → `documents.id` | `recordPricingData` |
| `customer_embeddings` | `user_id` | `customer_id` | `customer_id` → `customers.id` | `embedCustomer` |
| `embeddings` (jobs/materials) | `user_id` (null for cohort-shared) | `(item_type, id)` | `id` (prefixed: `job-{uuid}` / `mat-{uuid}`) | `indexJobForSearch` / `indexMaterialForSearch` |
| `eve_telemetry` | `user_id` | — | various | `logIntelligenceWriteFailure` |
| `account_deletion_requests` | `user_id` | — | — | profile.tsx delete flow |

### Critical invariants

1. **`material_price_history.observed_by` = `auth.uid()`**, not a tempId. Set by `emitMaterialPurchased(userId, {...})` which threads `getCurrentUserId()`.
2. **`customer_embeddings.customer_id` ↔ `customers.id`**. When `addCustomer` runs offline, embed fires with `tempId`; on flush the R54 listener re-fires `embedCustomer` with the BE uuid. Old row stays orphaned (cosmetic; cohort RPCs use the new row).
3. **`embeddings.id` = `{type}-{entity_id}`** (prefixed). Job index id = `job-{job.id}`. The R54 listener UPDATEs the id field on flush so the row migrates from `job-{tempId}` to `job-{realId}`.
4. **`pricing_intelligence.quote_id` ↔ `documents.id`**. Currently `addQuote` uses the FE `docNumber` as the key (R278 documented this; the document insert uses `document_number`, not the BE id). When a real BE uuid arrives, `pricing_intelligence` rows reference the docNumber, which stays stable. **Verify this** when wiring further pricing aggregations.
5. **Offline-created child references resolve via R49 FK rewrite**. Customer offline (`c-{ts}`) → Quote offline referencing it (`customer_id: c-{ts}`) → both queued → flush rewrites Quote's `customer_id` to BE uuid before sending.

## Tempid → real mapping (`offlineWriteQueue.applyWrite`)

The R49 logic strips/rewrites:
- The row's own `id` field on insert (BE generates) → captured into idMap
- All `string` values in `payload` recursively → if the string equals a known temp id, rewrite to its real counterpart
- `rowId` and `match` keys on update/delete → same rewrite

## Side-effect listeners (`idRemapBus` subscribers)

Each listener registers once at module load (idempotent):

| Module | Tables it handles | Side effect rewrites |
|---|---|---|
| `intelligence/ontology.ts` | `customers` / `jobs` / `materials` / `suppliers` / `projects` / `documents` | `entities` Map id + `relations[].fromId` / `.toId` |
| `intelligence/semanticSearch.ts` | `jobs` / `materials` | `@vasco_embeddings` cache id + `embeddings.id` Supabase column UPDATE |
| `services/embeddingService.ts` | `customers` | re-fires `embedCustomer({realId, text})` derived from `payload.name/email/phone/address` |

## Known orphans / dormant chains (audit findings)

| Function / column | Issue | Status |
|---|---|---|
| `dataProvider.createPriceObservation` | Generates random uuid for `material_id` (no catalog link). Zero non-internal callers. | **Dormant** — header comment added R54. Canonical path is `emitMaterialPurchased`. |
| `jobCostTrackingService.recordJobPriceObservations` | Reads from `MOCK_ACTUALS` only. Zero callers. | **Dormant** — chains into the above. |
| `subscriptionService.SubscriptionState.{clientCount,quotesUsedThisMonth,...}` | Counters never incremented. | **R52 fixed** — gates now derive from live AppState arrays. |
| `customer_embeddings` orphan rows under temp ids | Pre-R54 offline-created customers landed embeddings under `c-{ts}`. | R54 re-fires under realId; old rows benign (no RPC indexed by them). Cleanup migration optional. |

## Adding a new entity — checklist

When introducing a new id-bearing entity:

1. Pick a unique tempId prefix and add it to `offlineWriteQueue.TEMP_ID_PATTERNS`.
2. Add the entity's `dbCreateX` wrapper in `dataProvider.ts`.
3. In `AppState.tsx`, follow the `addCustomer` / `addJob` template:
   - generate tempId
   - optimistic update
   - try BE persist → swap to row.id; on fail → `queueWrite` with payload
   - run post-create housekeeping (ontology, embedding, milestones) on `finalId` regardless of branch
4. If the entity has side effects keyed by id (ontology entity / embedding row), add the table name to:
   - `ontology.TABLE_TO_ENTITY_TYPE` if it has a graph node
   - `semanticSearch.REMAP_PREFIX_BY_TABLE` if it gets indexed for search
5. Update this document.
