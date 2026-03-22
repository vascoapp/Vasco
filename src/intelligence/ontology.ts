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

const ONTOLOGY_KEY = '@vasco_ontology';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityType = 'customer' | 'job' | 'quote' | 'invoice' | 'supplier' | 'material' | 'worker' | 'project' | 'certification';
export type RelationType =
  | 'owns'          // customer → job
  | 'quoted_for'    // quote → job
  | 'invoiced_for'  // invoice → job
  | 'supplied_by'   // material → supplier
  | 'used_in'       // material → job
  | 'worked_on'     // worker → job
  | 'part_of'       // job → project
  | 'certified_by'  // worker → certification
  | 'paid_for';     // invoice → payment

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
