// =============================================================================
// VASCO ONTOLOGY — Connected entity graph with outcome propagation
// =============================================================================
// Layer 2 of the compound AI architecture.
// Creates a "digital twin" of the contractor's business where:
// - Every entity (job, customer, supplier, material) is a node
// - Relationships are typed edges (customer → job, job → invoice, etc.)
// - Outcomes propagate: completing a job updates customer reliability,
//   supplier scores, material benchmarks, and trade duration estimates
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordMetricSnapshot } from './learningStorage';
import { subscribeIdRemap, type IdRemapEvent } from '../services/idRemapBus';

const ONTOLOGY_KEY = '@vasco_ontology';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityType =
  | 'customer'
  | 'job'
  | 'quote'
  | 'invoice'
  | 'supplier'
  | 'material'
  | 'worker'
  | 'project'
  | 'certification'
  | 'lead'           // R81 pipeline — converts into a customer + quote on win
  | 'license';       // R80 compliance — contractor-level, gates quote sends in some countries
export type RelationType =
  | 'owns'           // customer → job
  | 'quoted_for'     // quote → job
  | 'invoiced_for'   // invoice → job
  | 'supplied_by'    // material → supplier
  | 'used_in'        // material → job
  | 'worked_on'      // worker → job
  | 'part_of'        // job → project
  | 'certified_by'  // worker → certification
  | 'paid_for'       // invoice → payment
  | 'converted_from' // customer → lead     (won lead becomes a customer)
  | 'sourced_quote'  // quote → lead         (quote drafted off a lead)
  | 'authorizes';    // license → job       (covers a regulated job type)

export interface OntologyEntity {
  id: string;
  type: EntityType;
  name: string;
  attributes: Record<string, any>;
  // Computed scores (updated by outcome propagation)
  scores: {
    reliability: number;    // 0-100: payment speed (customer), delivery (supplier), completion (worker)
    quality: number;        // 0-100: defect rate (supplier), satisfaction (customer), workmanship (worker)
    value: number;          // lifetime value (customer), total spend (supplier), revenue (job)
    frequency: number;      // interaction count
  };
  lastUpdated: string;
}

export interface OntologyRelation {
  id: string;
  fromId: string;
  fromType: EntityType;
  toId: string;
  toType: EntityType;
  relationType: RelationType;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface OntologyGraph {
  entities: Map<string, OntologyEntity>;
  relations: OntologyRelation[];
  version: number;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Graph management
// ---------------------------------------------------------------------------

let cachedGraph: OntologyGraph | null = null;

export async function loadOntology(): Promise<OntologyGraph> {
  if (cachedGraph) return cachedGraph;

  try {
    const raw = await AsyncStorage.getItem(ONTOLOGY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedGraph = {
        entities: new Map(Object.entries(parsed.entities ?? {})),
        relations: parsed.relations ?? [],
        version: parsed.version ?? 1,
        lastUpdated: parsed.lastUpdated ?? new Date().toISOString(),
      };
      return cachedGraph;
    }
  } catch {}

  cachedGraph = {
    entities: new Map(),
    relations: [],
    version: 1,
    lastUpdated: new Date().toISOString(),
  };
  return cachedGraph;
}

async function saveOntology(): Promise<void> {
  if (!cachedGraph) return;
  try {
    const serializable = {
      entities: Object.fromEntries(cachedGraph.entities),
      relations: cachedGraph.relations,
      version: cachedGraph.version,
      lastUpdated: new Date().toISOString(),
    };
    await AsyncStorage.setItem(ONTOLOGY_KEY, JSON.stringify(serializable));
  } catch {}
}

// ---------------------------------------------------------------------------
// Entity CRUD
// ---------------------------------------------------------------------------

export async function upsertEntity(entity: OntologyEntity): Promise<void> {
  const graph = await loadOntology();
  const existing = graph.entities.get(entity.id);
  if (existing) {
    // Merge attributes, keep scores
    graph.entities.set(entity.id, {
      ...existing,
      name: entity.name || existing.name,
      attributes: { ...existing.attributes, ...entity.attributes },
      lastUpdated: new Date().toISOString(),
    });
  } else {
    graph.entities.set(entity.id, entity);
  }
  await saveOntology();
}

export async function addRelation(relation: Omit<OntologyRelation, 'id' | 'createdAt'>): Promise<void> {
  const graph = await loadOntology();
  // Avoid duplicates
  const exists = graph.relations.some(r =>
    r.fromId === relation.fromId && r.toId === relation.toId && r.relationType === relation.relationType
  );
  if (!exists) {
    graph.relations.push({
      ...relation,
      id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    });
    await saveOntology();
  }
}

// ---------------------------------------------------------------------------
// R54: id-remap support
// ---------------------------------------------------------------------------
// When a temp-id-keyed entity / relation gets a real BE uuid via the
// offline queue flush, rekey our local copies so future lookups by real
// id resolve. Without this, addJob() offline + reconnect leaves the
// ontology with `entities['j-1234567890']` while AppState + BE have
// `id='job-uuid-abc'` — the entity becomes an orphan and any
// `getEntity(realId)` call misses.

/** Map BE table names → ontology entity types we manage. */
const TABLE_TO_ENTITY_TYPE: Record<string, EntityType> = {
  customers: 'customer',
  jobs: 'job',
  // Real DB table is `material_catalog` — that's the `table` the offline queue
  // emits on flush. 'materials' never matched an emitted event (latent/dead;
  // material ontology entities are currently name-keyed via dataCollector, not
  // row-id-keyed, so no active harm — but the key was wrong). Same mismatch that
  // actively broke offline material search indexing in semanticSearch.ts.
  material_catalog: 'material',
  suppliers: 'supplier',
  projects: 'project',
  documents: 'invoice', // ambiguous (quote|invoice); the entity stays under
                       // its original type — only id is rewritten.
  leads: 'lead',       // R81 pipeline
  workers: 'worker',   // R86 crew
};

/** Rewrite an entity id and all relations that reference it. Idempotent. */
export async function remapEntityId(tempId: string, realId: string): Promise<void> {
  if (!tempId || !realId || tempId === realId) return;
  const graph = await loadOntology();
  let touched = false;

  const ent = graph.entities.get(tempId);
  if (ent) {
    graph.entities.delete(tempId);
    // If a row already exists under realId (e.g. a refreshData() created it
    // first), merge with the temp-id entity's attributes — the temp version
    // is older but may have local-only fields.
    const existing = graph.entities.get(realId);
    graph.entities.set(realId, {
      ...ent,
      ...(existing ?? {}),
      id: realId,
      attributes: { ...ent.attributes, ...(existing?.attributes ?? {}) },
      lastUpdated: new Date().toISOString(),
    });
    touched = true;
  }

  for (const rel of graph.relations) {
    if (rel.fromId === tempId) {
      rel.fromId = realId;
      touched = true;
    }
    if (rel.toId === tempId) {
      rel.toId = realId;
      touched = true;
    }
  }

  if (touched) await saveOntology();
}

let _remapInitialized = false;
function initOntologyRemapListener(): void {
  if (_remapInitialized) return;
  _remapInitialized = true;
  subscribeIdRemap((e: IdRemapEvent) => {
    if (!TABLE_TO_ENTITY_TYPE[e.table]) return;
    void remapEntityId(e.tempId, e.realId);
  });
}

// Register at module load. Idempotent — multiple imports are safe.
initOntologyRemapListener();

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export async function getEntity(id: string): Promise<OntologyEntity | null> {
  const graph = await loadOntology();
  return graph.entities.get(id) ?? null;
}

export async function getRelatedEntities(entityId: string, relationType?: RelationType): Promise<OntologyEntity[]> {
  const graph = await loadOntology();
  const relatedIds = graph.relations
    .filter(r =>
      (r.fromId === entityId || r.toId === entityId) &&
      (!relationType || r.relationType === relationType)
    )
    .map(r => r.fromId === entityId ? r.toId : r.fromId);

  return relatedIds.map(id => graph.entities.get(id)).filter((e): e is OntologyEntity => !!e);
}

export async function getEntitiesByType(type: EntityType): Promise<OntologyEntity[]> {
  const graph = await loadOntology();
  return Array.from(graph.entities.values()).filter(e => e.type === type);
}

// ---------------------------------------------------------------------------
// OUTCOME PROPAGATION — the core moat mechanism
// ---------------------------------------------------------------------------
// When a job completes, the outcome ripples through the graph:
// 1. Customer reliability updates (paid on time?)
// 2. Supplier quality updates (materials good? delivered on time?)
// 3. Material price benchmarks update (actual vs quoted)
// 4. Worker productivity updates (hours vs estimated)
// 5. Trade duration benchmarks update
// ---------------------------------------------------------------------------

export async function propagateJobCompletion(jobId: string, outcome: {
  actualCost: number;
  estimatedCost: number;
  actualHours: number;
  estimatedHours: number;
  customerPaidOnTime: boolean;
  defectCount: number;
  customerSatisfaction?: number; // 1-5
}): Promise<void> {
  const graph = await loadOntology();
  const job = graph.entities.get(jobId);
  if (!job) return;

  // Update job entity
  job.attributes.completedAt = new Date().toISOString();
  job.attributes.actualCost = outcome.actualCost;
  job.attributes.actualHours = outcome.actualHours;
  job.scores.quality = outcome.defectCount === 0 ? 100 : Math.max(0, 100 - outcome.defectCount * 15);
  job.lastUpdated = new Date().toISOString();

  // Propagate to customer
  const customerRels = graph.relations.filter(r => r.toId === jobId && r.relationType === 'owns');
  for (const rel of customerRels) {
    const customer = graph.entities.get(rel.fromId);
    if (customer) {
      // Update reliability (weighted average with history)
      const prevReliability = customer.scores.reliability;
      const paymentScore = outcome.customerPaidOnTime ? 100 : 50;
      customer.scores.reliability = Math.round(prevReliability * 0.7 + paymentScore * 0.3);

      // Update satisfaction
      if (outcome.customerSatisfaction) {
        customer.scores.quality = Math.round(
          customer.scores.quality * 0.7 + (outcome.customerSatisfaction * 20) * 0.3
        );
      }

      // Update lifetime value
      customer.scores.value += outcome.actualCost;
      customer.scores.frequency++;
      customer.lastUpdated = new Date().toISOString();
    }
  }

  // Propagate to suppliers (via materials used in this job)
  const materialRels = graph.relations.filter(r => r.toId === jobId && r.relationType === 'used_in');
  for (const rel of materialRels) {
    const material = graph.entities.get(rel.fromId);
    if (material) {
      // Update actual price vs quoted
      material.attributes.lastActualPrice = rel.metadata.actualPrice;
      material.scores.frequency++;

      // Find supplier
      const supplierRels = graph.relations.filter(r => r.fromId === material.id && r.relationType === 'supplied_by');
      for (const sRel of supplierRels) {
        const supplier = graph.entities.get(sRel.toId);
        if (supplier) {
          supplier.scores.frequency++;
          supplier.scores.value += rel.metadata.actualPrice ?? 0;
          supplier.lastUpdated = new Date().toISOString();
        }
      }
    }
  }

  // Record metrics
  const marginPct = outcome.estimatedCost > 0
    ? Math.round(((outcome.estimatedCost - outcome.actualCost) / outcome.estimatedCost) * 100)
    : 0;
  recordMetricSnapshot('jobMargin', marginPct / 100).catch(() => {});
  recordMetricSnapshot('estimationAccuracy',
    outcome.estimatedHours > 0 ? Math.round((outcome.actualHours / outcome.estimatedHours) * 100) : 100
  ).catch(() => {});

  await saveOntology();
}

export async function propagatePayment(invoiceId: string, daysToPayment: number): Promise<void> {
  const graph = await loadOntology();

  // Find customer via invoice → job → customer chain
  const invoiceJobRels = graph.relations.filter(r => r.fromId === invoiceId && r.relationType === 'invoiced_for');
  for (const rel of invoiceJobRels) {
    const jobCustomerRels = graph.relations.filter(r => r.toId === rel.toId && r.relationType === 'owns');
    for (const cRel of jobCustomerRels) {
      const customer = graph.entities.get(cRel.fromId);
      if (customer) {
        // Update customer DSO
        const prevDSO = customer.attributes.avgDSO ?? 21;
        customer.attributes.avgDSO = Math.round(prevDSO * 0.7 + daysToPayment * 0.3);
        customer.scores.reliability = daysToPayment <= 30 ? Math.min(100, customer.scores.reliability + 5) : Math.max(0, customer.scores.reliability - 10);
        customer.lastUpdated = new Date().toISOString();
      }
    }
  }

  await saveOntology();
}

// ---------------------------------------------------------------------------
// Build ontology from app state — seed the entity graph from existing data
// ---------------------------------------------------------------------------

export async function buildOntologyFromAppState(data: {
  jobs: Array<{ id: string; title: string; customerId?: string | null; trade?: string; status?: string; quotedAmount?: number; agreedAmount?: number }>;
  customers: Array<{ id: string; name: string; email?: string; phone?: string }>;
  invoices: Array<{ id: string; customer?: string; job?: string; amount: number; status?: string }>;
  quotes: Array<{ id: string; customer?: string; job?: string; amount: number; status?: string }>;
}): Promise<void> {
  const graph = await loadOntology();

  // Seed customers
  for (const c of (data.customers ?? [])) {
    if (!graph.entities.has(c.id)) {
      graph.entities.set(c.id, {
        id: c.id,
        type: 'customer',
        name: c.name,
        attributes: { email: c.email, phone: c.phone },
        scores: { reliability: 50, quality: 50, value: 0, frequency: 0 },
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  // Seed jobs
  for (const j of (data.jobs ?? [])) {
    if (!graph.entities.has(j.id)) {
      graph.entities.set(j.id, {
        id: j.id,
        type: 'job',
        name: j.title,
        attributes: { trade: j.trade, status: j.status },
        scores: { reliability: 50, quality: 50, value: j.agreedAmount ?? j.quotedAmount ?? 0, frequency: 0 },
        lastUpdated: new Date().toISOString(),
      });
    }
    // Link customer → job
    if (j.customerId) {
      const exists = graph.relations.some(r =>
        r.fromId === j.customerId && r.toId === j.id && r.relationType === 'owns'
      );
      if (!exists) {
        graph.relations.push({
          id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fromId: j.customerId,
          fromType: 'customer',
          toId: j.id,
          toType: 'job',
          relationType: 'owns',
          metadata: {},
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // Seed invoices
  for (const inv of (data.invoices ?? [])) {
    if (!graph.entities.has(inv.id)) {
      graph.entities.set(inv.id, {
        id: inv.id,
        type: 'invoice',
        name: `Invoice ${inv.id}`,
        attributes: { amount: inv.amount, status: inv.status },
        scores: { reliability: 50, quality: 50, value: inv.amount, frequency: 0 },
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  // Seed quotes
  for (const q of (data.quotes ?? [])) {
    if (!graph.entities.has(q.id)) {
      graph.entities.set(q.id, {
        id: q.id,
        type: 'quote',
        name: `Quote ${q.id}`,
        attributes: { amount: q.amount, status: q.status },
        scores: { reliability: 50, quality: 50, value: q.amount, frequency: 0 },
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  await saveOntology();
}

// ---------------------------------------------------------------------------
// Graph statistics
// ---------------------------------------------------------------------------

export async function getOntologyStats(): Promise<{
  entityCount: number;
  relationCount: number;
  byType: Record<EntityType, number>;
  avgReliability: number;
  avgQuality: number;
}> {
  const graph = await loadOntology();
  const entities = Array.from(graph.entities.values());

  const byType: Record<string, number> = {};
  let totalReliability = 0;
  let totalQuality = 0;

  for (const e of entities) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    totalReliability += e.scores.reliability;
    totalQuality += e.scores.quality;
  }

  return {
    entityCount: entities.length,
    relationCount: graph.relations.length,
    byType: byType as Record<EntityType, number>,
    avgReliability: entities.length > 0 ? Math.round(totalReliability / entities.length) : 0,
    avgQuality: entities.length > 0 ? Math.round(totalQuality / entities.length) : 0,
  };
}
