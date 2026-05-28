// =============================================================================
// LICENSE RENEWAL ACTION GENERATOR — Stage 3 of intelligence retrofit
// =============================================================================
// Surfaces actionable contractor-license renewal items in the EVE queue.
// Distinct from `cert-expiry` (worker certificates) and `cert-renewal-planner`
// (cert batch planning): this one looks at the CONTRACTOR's own licenses on
// businessProfile.licenses[] (R80).
//
// Triggers:
//   - Expired license → critical (work stoppage / legal exposure)
//   - License expires within 14d → high
//   - License expires within 30d → medium
//
// Picks the most-urgent license. Returns null when no licenses or all > 30d
// out — no noise for compliant contractors.
// =============================================================================

import { useMemo } from 'react';
import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { gt } from '../generatorTranslations';
import { logPrediction } from '../calibration';
import { MS_PER_DAY } from '../../utils/timeConstants';

const EXPIRES_SOON_DAYS = 30;
const EXPIRES_URGENT_DAYS = 14;

export function useLicenseRenewalActionInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { businessProfile } = useAppState();

  return useMemo(() => {
    const licenses = businessProfile?.licenses;
    if (!licenses || licenses.length === 0) return null;

    const nowMs = ctx.now.getTime();
    type Scored = { license: typeof licenses[number]; daysUntil: number };
    const scored: Scored[] = licenses.map((l) => ({
      license: l,
      daysUntil: Math.floor((new Date(l.expiryDate).getTime() - nowMs) / MS_PER_DAY),
    }));

    // Only relevant: expired OR within 30d.
    const relevant = scored.filter((s) => s.daysUntil <= EXPIRES_SOON_DAYS);
    if (relevant.length === 0) return null;

    // Most-urgent first (smallest daysUntil; negative = already expired).
    relevant.sort((a, b) => a.daysUntil - b.daysUntil);
    const top = relevant[0];
    const expiredCount = relevant.filter((s) => s.daysUntil < 0).length;
    const urgentCount = relevant.filter((s) => s.daysUntil >= 0 && s.daysUntil <= EXPIRES_URGENT_DAYS).length;

    logPrediction({
      generatorId: 'license-renewal-action',
      predictedAt: new Date().toISOString(),
      prediction: `${expiredCount} expired, ${urgentCount} urgent, ${relevant.length} total within 30d`,
      predictedValue: relevant.length,
    });

    const priority: ScoredInsight['priority'] =
      expiredCount > 0 ? 'critical'
      : top.daysUntil <= EXPIRES_URGENT_DAYS ? 'high'
      : 'medium';

    const licenseLabel = `${top.license.type}${top.license.state ? ' · ' + top.license.state : ''}`;
    const title = top.daysUntil < 0
      ? gt('license_renewal_title_expired', ctx.language, {
          type: licenseLabel,
          days: Math.abs(top.daysUntil),
        })
      : top.daysUntil <= EXPIRES_URGENT_DAYS
        ? gt('license_renewal_title_urgent', ctx.language, {
            type: licenseLabel,
            days: top.daysUntil,
          })
        : gt('license_renewal_title_soon', ctx.language, {
            type: licenseLabel,
            days: top.daysUntil,
          });

    const message = top.daysUntil < 0
      ? gt('license_renewal_msg_expired', ctx.language, { type: licenseLabel })
      : gt('license_renewal_msg_soon', ctx.language, {
          type: licenseLabel,
          days: top.daysUntil,
        });

    // Stable entityKey: same license → same queue slot regardless of when
    // this generator re-fires. Lets the EVE queue dedup on renewal.
    const entityKeyStable = `license:${top.license.type}_${top.license.state ?? top.license.number}`;

    return {
      id: `license-renewal-action-${entityKeyStable}`,
      generatorId: 'license-renewal-action',
      category: 'compliance',
      priority,
      title,
      message,
      icon: 'shield-checkmark-outline',
      actionLabel: gt('license_renewal_action', ctx.language),
      actionRoute: '/contractor/licenses' as any,
      source: gt('source_license_renewal', ctx.language),

      rootCauseTags: ['compliance', 'license', 'business-continuity'],
      rawScore: 0,
      reasoning: {
        observation: gt('license_renewal_obs', ctx.language, {
          count: relevant.length,
          expired: expiredCount,
        }),
        evidence: `${licenses.length} ${gt('license_renewal_evidence', ctx.language)}`,
        implication: expiredCount > 0
          ? gt('license_renewal_implication_expired', ctx.language)
          : gt('license_renewal_implication_soon', ctx.language),
        suggestion: gt('license_renewal_suggestion', ctx.language, {
          type: licenseLabel,
          authority: top.license.issuingAuthority ?? gt('license_renewal_authority_generic', ctx.language),
        }),
      },
      dataPoints: licenses.length,
      confidence: 0.95,
      freshness: 1,
      action: {
        type: 'renew_cert',
        label: gt('license_renewal_action', ctx.language),
        params: {
          licenseType: top.license.type,
          state: top.license.state,
          expiryDate: top.license.expiryDate,
          daysUntil: top.daysUntil,
        },
        requiresApproval: false,
        estimatedImpact: expiredCount > 0
          ? gt('license_renewal_impact_expired', ctx.language)
          : gt('license_renewal_impact_soon', ctx.language),
        route: '/contractor/licenses' as any,
      },
      enqueueHint: {
        type: 'license_renewal',
        entityKey: entityKeyStable,
        expiresInDays: top.daysUntil < 0 ? 1 : Math.min(14, Math.max(2, top.daysUntil)),
      },
    } as ScoredInsight;
  }, [businessProfile, ctx.now, ctx.language]);
}
