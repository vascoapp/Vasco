// =============================================================================
// LEAD FOLLOWUP GENERATOR — Stage 3 of intelligence retrofit
// =============================================================================
// Surfaces stale-lead nudges in the EVE queue. Reads from AppState.leads
// (populated by R81 + the Stage 1 idRemap sync). Uses Stage 2 source-cohort
// stats to prioritize high-converting sources.
//
// Triggers:
//   - 'new' status leads not contacted within 24h → high-priority nudge
//   - 'contacted' status leads with no follow-up in 72h → medium
//   - 'estimate_sent' status leads stale for 7d+ → medium (re-engagement)
// Highest-value stale lead wins when multiple match.
// =============================================================================

import { useMemo } from 'react';
import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { gt } from '../generatorTranslations';
import { logPrediction } from '../calibration';
import { computeOwnLeadSourceStats } from '../../services/leadSourceStatsService';
import { MS_PER_DAY } from '../../utils/timeConstants';

const STALE_HOURS_NEW = 24;
const STALE_HOURS_CONTACTED = 72;
const STALE_DAYS_ESTIMATE = 7;

export function useLeadFollowupInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { leads } = useAppState();
  const nowMs = ctx.now.getTime();

  return useMemo(() => {
    if (!leads || leads.length === 0) return null;

    // Bucket leads by which threshold applies + how stale they are.
    type Stale = { lead: typeof leads[number]; hoursStale: number; bucket: 'new' | 'contacted' | 'estimate_sent' };
    const stale: Stale[] = [];
    for (const l of leads) {
      const updatedMs = new Date(l.updatedAt ?? l.createdAt).getTime();
      const hoursSince = (nowMs - updatedMs) / 3_600_000;
      if (l.status === 'new' && hoursSince >= STALE_HOURS_NEW) {
        stale.push({ lead: l, hoursStale: hoursSince, bucket: 'new' });
      } else if (l.status === 'contacted' && hoursSince >= STALE_HOURS_CONTACTED) {
        stale.push({ lead: l, hoursStale: hoursSince, bucket: 'contacted' });
      } else if (l.status === 'estimate_sent' && hoursSince >= STALE_DAYS_ESTIMATE * 24) {
        stale.push({ lead: l, hoursStale: hoursSince, bucket: 'estimate_sent' });
      }
    }
    if (stale.length === 0) return null;

    // Rank: highest value × highest staleness first. Ties broken by 'new'
    // bucket priority (untouched lead is more urgent than a quoted one).
    stale.sort((a, b) => {
      const vA = (a.lead.estimatedValue ?? 0) * Math.log(1 + a.hoursStale);
      const vB = (b.lead.estimatedValue ?? 0) * Math.log(1 + b.hoursStale);
      if (vB !== vA) return vB - vA;
      const bucketOrder = { new: 0, contacted: 1, estimate_sent: 2 } as const;
      return bucketOrder[a.bucket] - bucketOrder[b.bucket];
    });
    const top = stale[0];

    // Source-cohort context: does the contractor's own data on this source
    // suggest it's worth chasing harder? Surfaced as a soft hint when the
    // own-stats sample size is non-trivial.
    const ownSourceStats = computeOwnLeadSourceStats(leads, { source: top.lead.source });
    const sourceHint = ownSourceStats.conversionRate != null
      ? ` (${top.lead.source} converts at ${Math.round(ownSourceStats.conversionRate * 100)}% for you)`
      : '';

    logPrediction({
      generatorId: 'lead-followup',
      predictedAt: new Date().toISOString(),
      prediction: `${stale.length} stale leads, top: ${top.lead.customerName} (${Math.round(top.hoursStale)}h)`,
      predictedValue: stale.length,
    });

    const priority: ScoredInsight['priority'] =
      top.bucket === 'new' && top.hoursStale >= 48 ? 'high'
      : stale.length >= 3 ? 'high'
      : top.bucket === 'estimate_sent' && top.hoursStale >= 14 * 24 ? 'medium'
      : 'medium';

    const customerLabel = top.lead.customerName || gt('lead_followup_customer_unknown', ctx.language);
    const valueLabel = top.lead.estimatedValue
      ? ` · €${Math.round(top.lead.estimatedValue)}`
      : '';
    const hoursLabel = top.hoursStale >= 48
      ? `${Math.round(top.hoursStale / 24)}d`
      : `${Math.round(top.hoursStale)}h`;

    const title = stale.length > 1
      ? gt('lead_followup_title_multi', ctx.language, { count: stale.length, name: customerLabel })
      : gt('lead_followup_title_single', ctx.language, { name: customerLabel, hours: hoursLabel });

    const message = top.bucket === 'new'
      ? gt('lead_followup_msg_new', ctx.language, { hours: hoursLabel, value: valueLabel })
      : top.bucket === 'contacted'
        ? gt('lead_followup_msg_contacted', ctx.language, { hours: hoursLabel, value: valueLabel })
        : gt('lead_followup_msg_estimate', ctx.language, { hours: hoursLabel, value: valueLabel });

    return {
      id: `lead-followup-${top.lead.id}`,
      generatorId: 'lead-followup',
      category: 'opportunity',
      priority,
      title,
      message: message + sourceHint,
      icon: 'people-outline',
      actionLabel: gt('lead_followup_action', ctx.language),
      actionRoute: '/contractor/pipeline' as any,
      source: gt('source_lead_followup', ctx.language),

      rootCauseTags: ['leads', 'sales-velocity'],
      rawScore: 0,
      reasoning: {
        observation: `${stale.length} ${gt('lead_followup_obs_stale', ctx.language)}`,
        evidence: `${customerLabel}${valueLabel} — ${hoursLabel} ${gt('lead_followup_evidence_idle', ctx.language)}`,
        implication: gt('lead_followup_implication', ctx.language),
        suggestion: gt('lead_followup_suggestion', ctx.language, { name: customerLabel }),
      },
      dataPoints: stale.length,
      confidence: 0.85,
      freshness: top.hoursStale,
      action: {
        type: 'send_followup',
        label: gt('lead_followup_action', ctx.language),
        params: { leadId: top.lead.id, source: top.lead.source },
        requiresApproval: false,
        estimatedImpact: ownSourceStats.conversionRate != null
          ? gt('lead_followup_impact_with_stats', ctx.language, { rate: Math.round(ownSourceStats.conversionRate * 100) })
          : gt('lead_followup_impact_generic', ctx.language),
        route: '/contractor/pipeline' as any,
      },
      enqueueHint: {
        type: 'lead_followup',
        // Stable per-lead so EVE doesn't re-queue while the same lead stays stale.
        entityKey: `lead-followup:${top.lead.id}`,
        expiresInDays: 3,
      },
    } as ScoredInsight;
  }, [leads, nowMs, ctx.language]);
}
