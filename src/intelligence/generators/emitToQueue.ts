// =============================================================================
// Generator → queue bridge
// =============================================================================
// Lets any generator push its insight into the AI Action Queue by emitting
// an `enqueueHint`. The default queue-populator (backgroundJobScheduler)
// picks these up and materializes QueueItems so the user sees approve/reject.
//
// Pattern for a generator:
//   return scoreInsight({
//     ...insight,
//     action: { type: 'send_reminder', params: {...}, requiresApproval: true },
//     enqueueHint: { type: 'draft_reminder', entityKey: `reminder-for-invoice:${inv.id}` },
//   });
// =============================================================================

import { addToQueue, type QueueItemType } from '../../services/aiActionQueueService';
import type { ScoredInsight } from './types';

export interface EnqueueHint {
  type: QueueItemType;
  entityKey?: string;
  actionLabel?: string;
  estimatedImpact?: string;
  expiresInDays?: number;
}

/** Called by the scheduler after each generator run — pushes hinted insights into the queue. */
export async function enqueueInsightsIfHinted(insights: ScoredInsight[]): Promise<number> {
  let added = 0;
  for (const ins of insights) {
    const hint = (ins as ScoredInsight & { enqueueHint?: EnqueueHint }).enqueueHint;
    if (!hint) continue;
    const expiresAt = hint.expiresInDays
      ? new Date(Date.now() + hint.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const id = await addToQueue({
      type: hint.type,
      title: ins.title,
      description: (ins as any).description ?? '',
      preparedData: { insightId: ins.id, ...(ins.action?.params ?? {}) },
      actionLabel: hint.actionLabel ?? ins.action?.label ?? 'Review',
      estimatedImpact: hint.estimatedImpact ?? ins.action?.estimatedImpact ?? '',
      expiresAt,
      entityKey: hint.entityKey,
      sourceGeneratorId: ins.generatorId,
    });
    if (id) added += 1;
  }
  return added;
}
