// =============================================================================
// CERT EXPIRY GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useExpiryCalendar } from '../../services/complianceService';
import { logPrediction } from '../calibration';
// gtv() === gt() for any key without a phrasing spec, so this swap is a
// strict superset: spec'd keys gain LLM wording, everything else is
// byte-identical. Whole-file rather than per-key on purpose — learnings
// #466: partial adoption inside one generator is the bug, not the fix.
import { gtv } from '../phrasing/phrasingStore';
import { MS_PER_DAY } from '../../utils/timeConstants';

export const certExpiryGenerator: InsightGenerator = {
  id: 'cert-expiry',
  screens: ['today', 'meer'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useCertExpiryInsight(ctx: GeneratorContext): ScoredInsight | null {
  const calendar = useExpiryCalendar(2); // next 2 months

  const expiringItems = calendar.flatMap(month =>
    month.items.map(item => ({ ...item, date: month.date }))
  );

  if (expiringItems.length === 0) return null;

  const soonest = expiringItems[0];
  const daysUntil = Math.ceil((new Date(soonest.date).getTime() - ctx.now.getTime()) / MS_PER_DAY);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'cert-expiry',
    predictedAt: new Date().toISOString(),
    prediction: `${expiringItems.length} certificaten verlopen binnen ${daysUntil} dagen`,
    predictedValue: daysUntil,
  });
  const priority = daysUntil <= 14 ? 'high' : daysUntil <= 30 ? 'medium' : 'low';

  return {
    id: `cert-expiry-${soonest.id}`,
    generatorId: 'cert-expiry',
    category: 'compliance',
    priority,
    title: daysUntil <= 7
      ? gtv('cert_expires_this_week', ctx.language, { name: soonest.name })
      : gtv('cert_expires_in_days', ctx.language, { name: soonest.name, days: daysUntil }),
    message: `${gtv('cert_renew_message', ctx.language, { type: soonest.type })}${expiringItems.length > 1 ? ` ${gtv('cert_more_expiring', ctx.language, { count: expiringItems.length - 1 })}` : ''}`,
    icon: 'document-text',
    actionLabel: 'Vernieuwen',
    actionRoute: '/(contractor)/certificaten',
    source: gtv('source_compliance', ctx.language),

    rootCauseTags: ['compliance', 'certification'],
    rawScore: 0,
    reasoning: {
      observation: `${expiringItems.length} certificaat/vergunning${expiringItems.length > 1 ? 'en' : ''} verloop${expiringItems.length > 1 ? 'en' : 't'} binnenkort`,
      evidence: `Op basis van je certificatenregister`,
      implication: daysUntil <= 14
        ? gtv('cert_implication_urgent', ctx.language)
        : gtv('cert_implication_plan', ctx.language),
      suggestion: `Start het vernieuwingsproces voor ${soonest.name} zo snel mogelijk`,
    },
    dataPoints: expiringItems.length,
    confidence: 0.95,
    freshness: 1,
    action: {
      type: 'renew_cert',
      label: gtv('action_renew_cert', ctx.language),
      params: { certName: soonest.name, certType: soonest.type, daysUntil },
      requiresApproval: false,
      estimatedImpact: daysUntil <= 14 ? gtv('cert_impact_prevent', ctx.language) : gtv('cert_impact_plan', ctx.language),
    },
  };
}
