// =============================================================================
// WORKER CAPACITY GENERATOR — Stage 3 of intelligence retrofit
// =============================================================================
// Flags overbooked workers + idle workers from the active job roster. Only
// fires for contractors with a real crew (workers.length >= 2 — solo
// contractors who only added themselves get no signal).
//
// Heuristic (FE-only — no cohort RPC needed):
//   - Active job = status in (lead, quoted, scheduled, in_progress, active)
//   - "Overbooked" = active job count >= OVERBOOK_THRESHOLD
//   - "Idle" = isActive worker with zero active jobs over the past 7d
// Surfaces the most-overbooked worker first. Idle warning fires only when
// no overbooked condition is present (overbooked is the higher-stakes signal).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { gt } from '../generatorTranslations';
import { logPrediction } from '../calibration';
import { getCrewUtilizationCohort, type CrewUtilizationCohort } from '../../services/cohortBenchmarkService';

const OVERBOOK_THRESHOLD = 5;   // 5+ active jobs flags a worker as overbooked
const IDLE_DAYS_THRESHOLD = 7;  // 7+ days without an active job flags idle

// Statuses that count as "the worker is still on the hook".
const ACTIVE_JOB_STATUSES = new Set([
  'lead',
  'quoted',
  'scheduled',
  'in_progress',
  'active',
]);

export function useWorkerCapacityInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { workers, jobs, businessProfile } = useAppState();
  // Stage 5: cohort jobs-per-worker stat. Loads once on mount per trade.
  // Returns null until the cohort RPC has been deployed AND has ≥5
  // contractors in the same trade. Workers data is owner-private, but the
  // RPC is SECURITY DEFINER so this works.
  const [cohort, setCohort] = useState<CrewUtilizationCohort | null>(null);
  useEffect(() => {
    let cancelled = false;
    getCrewUtilizationCohort({
      trade: businessProfile?.trade,
      country: businessProfile?.country,
    })
      .then((r) => {
        if (!cancelled) setCohort(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [businessProfile?.trade, businessProfile?.country]);

  return useMemo(() => {
    // Skip solo contractors entirely — the signal is noise for them.
    if (!workers || workers.length < 2) return null;
    const activeWorkers = workers.filter((w) => w.isActive !== false);
    if (activeWorkers.length === 0) return null;

    // Group active jobs by assignedWorkerId so we can score each worker.
    const activeJobs = (jobs ?? []).filter((j: any) => ACTIVE_JOB_STATUSES.has(j.status));
    const jobsByWorker = new Map<string, typeof activeJobs>();
    for (const j of activeJobs) {
      const wid = (j as any).assignedWorkerId;
      if (!wid) continue;
      const list = jobsByWorker.get(wid) ?? [];
      list.push(j);
      jobsByWorker.set(wid, list);
    }

    // Score each worker.
    const scored = activeWorkers.map((w) => {
      const list = jobsByWorker.get(w.id) ?? [];
      const mostRecentMs = list
        .map((j: any) => new Date((j as any).scheduledDate ?? (j as any).updatedAt ?? (j as any).createdAt).getTime())
        .filter((n) => Number.isFinite(n))
        .reduce((max, n) => Math.max(max, n), 0);
      const daysSinceLast = mostRecentMs === 0
        ? Infinity
        : (ctx.now.getTime() - mostRecentMs) / 86_400_000;
      return { worker: w, activeJobCount: list.length, daysSinceLast };
    });

    // Look for overbooked first.
    const overbooked = scored
      .filter((s) => s.activeJobCount >= OVERBOOK_THRESHOLD)
      .sort((a, b) => b.activeJobCount - a.activeJobCount);
    const idle = scored
      .filter((s) => s.activeJobCount === 0 && s.daysSinceLast >= IDLE_DAYS_THRESHOLD)
      .sort((a, b) => b.daysSinceLast - a.daysSinceLast);

    if (overbooked.length === 0 && idle.length === 0) return null;

    logPrediction({
      generatorId: 'worker-capacity',
      predictedAt: new Date().toISOString(),
      prediction: `${overbooked.length} overbooked, ${idle.length} idle`,
      predictedValue: overbooked.length + idle.length,
    });

    if (overbooked.length > 0) {
      const top = overbooked[0];
      // Stage 5: when cohort gate passed, append a comparative phrase to
      // the message — concrete, defensible, "your peers run X jobs/worker".
      const cohortHint = cohort?.kAnonymityPassed && cohort.medianJobsPerWorker
        ? ' ' + gt('worker_capacity_cohort_hint', ctx.language, {
            count: top.activeJobCount,
            median: cohort.medianJobsPerWorker.toFixed(1),
          })
        : '';
      const priority: ScoredInsight['priority'] =
        top.activeJobCount >= OVERBOOK_THRESHOLD + 3 ? 'high'
        : overbooked.length >= 2 ? 'high'
        : cohort?.kAnonymityPassed && cohort.p75JobsPerWorker
          && top.activeJobCount > cohort.p75JobsPerWorker * 1.5 ? 'high'
        : 'medium';
      return {
        id: `worker-capacity-overbook-${top.worker.id}`,
        generatorId: 'worker-capacity',
        category: 'alert',
        priority,
        title: gt('worker_capacity_overbook_title', ctx.language, {
          name: top.worker.name,
          count: top.activeJobCount,
        }),
        message: gt('worker_capacity_overbook_msg', ctx.language, {
          name: top.worker.name,
          count: top.activeJobCount,
        }) + cohortHint,
        icon: 'people',
        actionLabel: gt('worker_capacity_action_reassign', ctx.language),
        actionRoute: '/contractor/crew' as any,
        source: gt('source_worker_capacity', ctx.language),

        rootCauseTags: ['capacity', 'crew', 'schedule'],
        rawScore: 0,
        reasoning: {
          observation: gt('worker_capacity_overbook_obs', ctx.language, {
            count: top.activeJobCount,
            name: top.worker.name,
          }),
          evidence: `${activeWorkers.length} ${gt('worker_capacity_evidence_workers', ctx.language)}, ${activeJobs.length} ${gt('worker_capacity_evidence_jobs', ctx.language)}`,
          implication: gt('worker_capacity_overbook_implication', ctx.language),
          suggestion: gt('worker_capacity_overbook_suggestion', ctx.language, {
            name: top.worker.name,
          }),
        },
        dataPoints: activeJobs.length,
        confidence: 0.8,
        freshness: 0,
        action: {
          type: 'custom',
          label: gt('worker_capacity_action_reassign', ctx.language),
          params: { workerId: top.worker.id, activeJobCount: top.activeJobCount },
          requiresApproval: false,
          estimatedImpact: gt('worker_capacity_overbook_impact', ctx.language),
          route: '/contractor/crew' as any,
        },
        enqueueHint: {
          type: 'worker_overbooked',
          entityKey: `worker-overbook:${top.worker.id}`,
          expiresInDays: 2,
        },
      } as ScoredInsight;
    }

    // Idle case
    const topIdle = idle[0];
    const idleDays = Number.isFinite(topIdle.daysSinceLast) ? Math.round(topIdle.daysSinceLast) : 30;
    return {
      id: `worker-capacity-idle-${topIdle.worker.id}`,
      generatorId: 'worker-capacity',
      category: 'opportunity',
      priority: 'low',
      title: gt('worker_capacity_idle_title', ctx.language, {
        name: topIdle.worker.name,
        days: idleDays,
      }),
      message: gt('worker_capacity_idle_msg', ctx.language, {
        name: topIdle.worker.name,
        days: idleDays,
      }),
      icon: 'person-remove-outline',
      actionLabel: gt('worker_capacity_action_assign', ctx.language),
      actionRoute: '/contractor/crew' as any,
      source: gt('source_worker_capacity', ctx.language),

      rootCauseTags: ['capacity', 'crew', 'utilization'],
      rawScore: 0,
      reasoning: {
        observation: gt('worker_capacity_idle_obs', ctx.language, {
          name: topIdle.worker.name,
          days: idleDays,
        }),
        evidence: `${activeWorkers.length} ${gt('worker_capacity_evidence_workers', ctx.language)}`,
        implication: gt('worker_capacity_idle_implication', ctx.language),
        suggestion: gt('worker_capacity_idle_suggestion', ctx.language, {
          name: topIdle.worker.name,
        }),
      },
      dataPoints: activeJobs.length,
      confidence: 0.7,
      freshness: idleDays * 24,
      action: {
        type: 'custom',
        label: gt('worker_capacity_action_assign', ctx.language),
        params: { workerId: topIdle.worker.id, daysIdle: idleDays },
        requiresApproval: false,
        estimatedImpact: gt('worker_capacity_idle_impact', ctx.language),
        route: '/contractor/crew' as any,
      },
      enqueueHint: {
        type: 'worker_idle',
        entityKey: `worker-idle:${topIdle.worker.id}`,
        expiresInDays: 5,
      },
    } as ScoredInsight;
  }, [workers, jobs, ctx.now, ctx.language, cohort]);
}
