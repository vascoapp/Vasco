// =============================================================================
// STATIC TIP GENERATOR
// =============================================================================
// Replaces the old hardcoded templates that had no data backing.
// These are generic contextual tips with low base relevance.
//
// R323: the whole tip table was hardcoded DUTCH while this generator is
// registered for every screen a contractor opens (today / invoices / savings /
// decisions). A German, French, Spanish, Italian or UK contractor read Dutch
// tip cards on their home tab. The table now holds gt() KEYS and the text is
// resolved per ctx.language at generate() time — the pattern `source` already
// used. Nothing here may become a bare string again: this is module scope, so
// it would be frozen in one language before a language is even known.
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import type { VascoInsight } from '../../components/shared/VascoInsightCard';
import { gt } from '../generatorTranslations';

interface StaticTip {
  roles: GeneratorContext['role'][];
  screens: GeneratorContext['screen'][];
  /** Non-text fields of the insight; every string field lives in `keys`. */
  insight: Omit<VascoInsight, 'id' | 'title' | 'message' | 'detail' | 'actionLabel'>;
  keys: { title: string; message: string; detail?: string; actionLabel?: string };
  tipId: string;
}

const STATIC_TIPS: StaticTip[] = [
  // Contractor tips
  {
    tipId: 'invoice-tip',
    roles: ['contractor'],
    screens: ['invoices'],
    insight: {
      category: 'financial',
      priority: 'low',
      icon: 'bulb',
      source: 'source_vasco_ai',
    },
    keys: { title: 'tip_invoice_title', message: 'tip_invoice_msg', detail: 'tip_invoice_detail' },
  },
  {
    tipId: 'bulk-savings',
    roles: ['contractor'],
    screens: ['savings'],
    insight: {
      category: 'opportunity',
      priority: 'low',
      icon: 'cart',
      source: 'source_procurement',
      // R323: the metric used to read "Potentiële besparing · €540/jaar" and
      // the message claimed "je bestelt gemiddeld 3x per week bij dezelfde
      // leverancier" — both INVENTED. This is the static-tip generator: it has
      // no purchase data at all (dataPoints: 0, confidence 0.4), so a number
      // that specific reads as measured when nothing measured it. The real
      // cohort figure is supplierPriceAnomalyGenerator's job — it has the data.
    },
    keys: { title: 'tip_bulk_title', message: 'tip_bulk_msg', actionLabel: 'tip_bulk_action' },
  },
  {
    tipId: 'decision-followup',
    roles: ['contractor'],
    screens: ['decisions'],
    insight: {
      category: 'tip',
      priority: 'low',
      icon: 'chatbubble',
      actionRoute: '/(contractor)/decisions',
      source: 'source_customer',
    },
    keys: { title: 'tip_decision_title', message: 'tip_decision_msg', actionLabel: 'tip_decision_action' },
  },
  // Site Lead tips
  {
    tipId: 'crew-utilization',
    roles: ['sitelead'],
    screens: ['today', 'overview', 'dispatch'],
    insight: {
      category: 'schedule',
      priority: 'medium',
      icon: 'people',
      source: 'source_capacity',
    },
    keys: { title: 'tip_crew_title', message: 'tip_crew_msg', actionLabel: 'tip_crew_action' },
  },
  {
    tipId: 'safety-check',
    roles: ['sitelead'],
    screens: ['today', 'overview', 'dispatch'],
    insight: {
      category: 'compliance',
      priority: 'high',
      icon: 'shield-checkmark',
      source: 'source_compliance',
    },
    keys: { title: 'tip_safety_title', message: 'tip_safety_msg', actionLabel: 'tip_safety_action' },
  },
  // CFO tips
  {
    tipId: 'cashflow-warning',
    roles: ['cfo'],
    screens: ['today', 'overview', 'cashflow'],
    insight: {
      category: 'financial',
      priority: 'high',
      icon: 'trending-down',
      source: 'source_cashflow',
    },
    keys: { title: 'tip_cashflow_title', message: 'tip_cashflow_msg', actionLabel: 'tip_cashflow_action' },
  },
  // COO tips
  {
    tipId: 'schedule-risk',
    roles: ['coo'],
    screens: ['today', 'financials', 'efficiency'],
    insight: {
      category: 'schedule',
      priority: 'high',
      icon: 'warning',
      source: 'source_scheduling',
    },
    keys: { title: 'tip_schedule_title', message: 'tip_schedule_msg', actionLabel: 'tip_schedule_action' },
  },
  // Director tips
  {
    tipId: 'portfolio-health',
    roles: ['director'],
    screens: ['today', 'overview', 'portfolio'],
    insight: {
      category: 'financial',
      priority: 'medium',
      icon: 'pie-chart',
      source: 'source_portfolio',
    },
    keys: { title: 'tip_portfolio_title', message: 'tip_portfolio_msg', actionLabel: 'tip_portfolio_action' },
  },
];

/**
 * Generate profile-aware dynamic tips when contractor data is available.
 * Falls back to static tips when profile has no relevant data.
 */
function generateDynamicTip(ctx: GeneratorContext): ScoredInsight | null {
  const profile = ctx.profile;
  const jobs = profile.jobCompletionHistory;
  const savings = profile.savingsProfile;
  const invoices = profile.invoicePatterns;
  const lang = ctx.language;

  // Dynamic tip: estimation accuracy insight from job history
  if (jobs.length >= 3) {
    const avgRatio = jobs.reduce((s, j) => s + (j.estimatedHours > 0 ? j.actualHours / j.estimatedHours : 1), 0) / jobs.length;
    if (avgRatio > 1.15) {
      const pct = Math.round((avgRatio - 1) * 100);
      return {
        id: 'dynamic-tip-underestimate',
        generatorId: 'static-tip',
        category: 'tip',
        priority: 'low',
        title: gt('tip_dyn_underest_title', lang),
        message: gt('tip_dyn_underest_msg', lang, { pct }),
        detail: gt('tip_dyn_based_on_jobs', lang, { count: jobs.length }),
        icon: 'bulb',
        source: gt('source_vasco_personal', lang),
        rootCauseTags: ['tip', 'personalized'],
        rawScore: 0,
        reasoning: {
          observation: gt('tip_dyn_underest_obs', lang, { pct }),
          evidence: gt('tip_dyn_based_on_jobs', lang, { count: jobs.length }),
          implication: gt('tip_dyn_underest_impl', lang),
          suggestion: gt('tip_dyn_underest_sugg', lang),
        },
        dataPoints: jobs.length,
        confidence: 0.65,
        freshness: 48,
      };
    }
  }

  // Dynamic tip: savings streak motivation
  if (savings.savingsStreak >= 3) {
    const streak = savings.savingsStreak;
    const tail = savings.topSavingsCategory
      ? gt('tip_dyn_streak_best', lang, { cat: savings.topSavingsCategory })
      : gt('tip_dyn_streak_keepgoing', lang);
    return {
      id: 'dynamic-tip-streak',
      generatorId: 'static-tip',
      category: 'opportunity',
      priority: 'low',
      title: gt('tip_dyn_streak_title', lang, { count: streak }),
      message: `${gt('tip_dyn_streak_msg', lang, { count: streak })} ${tail}`,
      icon: 'trophy',
      source: gt('source_vasco_personal', lang),
      rootCauseTags: ['tip', 'personalized'],
      rawScore: 0,
      reasoning: {
        observation: gt('tip_dyn_streak_obs', lang, { count: streak }),
        evidence: gt('tip_dyn_streak_evidence', lang),
        implication: gt('tip_dyn_streak_impl', lang),
        suggestion: gt('tip_dyn_streak_sugg', lang),
      },
      dataPoints: streak,
      confidence: 0.6,
      freshness: 48,
    };
  }

  // Dynamic tip: invoice payment advice
  if (invoices.totalInvoices > 5 && invoices.onTimeRate < 0.7) {
    const pct = Math.round(invoices.onTimeRate * 100);
    return {
      id: 'dynamic-tip-payment',
      generatorId: 'static-tip',
      category: 'financial',
      priority: 'low',
      title: gt('tip_dyn_payment_title', lang),
      message: gt('tip_dyn_payment_msg', lang, { pct }),
      icon: 'bulb',
      source: gt('source_vasco_personal', lang),
      actionLabel: gt('tip_dyn_payment_action', lang),
      actionRoute: '/(contractor)/facturen',
      rootCauseTags: ['tip', 'personalized'],
      rawScore: 0,
      reasoning: {
        observation: gt('tip_dyn_payment_obs', lang, { pct }),
        evidence: gt('tip_dyn_payment_evidence', lang, { count: invoices.totalInvoices }),
        implication: gt('tip_dyn_payment_impl', lang),
        suggestion: gt('tip_dyn_payment_sugg', lang),
      },
      dataPoints: invoices.totalInvoices,
      confidence: 0.7,
      freshness: 48,
    };
  }

  return null; // fall through to static tips
}

export const staticTipGenerator: InsightGenerator = {
  id: 'static-tip',
  screens: ['today', 'invoices', 'savings', 'decisions', 'meer', 'overview', 'dispatch',
    'costs', 'cashflow', 'returns', 'approvals', 'risks', 'performance',
    'financials', 'efficiency', 'market', 'emerging', 'portfolio', 'safety', 'quality', 'issues'],
  roles: ['contractor', 'sitelead', 'coo', 'cfo', 'director'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    // Try dynamic profile-aware tip first (contractor only)
    if (ctx.role === 'contractor') {
      const dynamic = generateDynamicTip(ctx);
      if (dynamic) return dynamic;
    }

    // Fall back to static tips
    const dayIndex = ctx.now.getDate();

    const matching = STATIC_TIPS.filter(
      t => t.roles.includes(ctx.role) && t.screens.includes(ctx.screen)
    );

    if (matching.length === 0) return null;

    const selected = matching[dayIndex % matching.length];
    const lang = ctx.language;
    const title = gt(selected.keys.title, lang);
    const message = gt(selected.keys.message, lang);
    const detail = selected.keys.detail ? gt(selected.keys.detail, lang) : undefined;

    return {
      ...selected.insight,
      title,
      message,
      detail,
      actionLabel: selected.keys.actionLabel ? gt(selected.keys.actionLabel, lang) : undefined,
      source: gt(selected.insight.source as string, lang),
      id: `static-${selected.tipId}`,
      generatorId: 'static-tip',
      rootCauseTags: ['tip', 'general'],
      rawScore: 0,
      reasoning: {
        observation: title,
        evidence: gt('tip_evidence_industry', lang),
        implication: message,
        suggestion: detail || gt('tip_suggestion_see_details', lang),
      },
      dataPoints: 0,
      confidence: 0.4,
      freshness: 48,
    };
  },
};
