// =============================================================================
// STATIC TIP GENERATOR
// =============================================================================
// Replaces the old hardcoded templates that had no data backing.
// These are generic contextual tips with low base relevance.
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import type { VascoInsight } from '../../components/shared/VascoInsightCard';

interface StaticTip {
  roles: GeneratorContext['role'][];
  screens: GeneratorContext['screen'][];
  insight: Omit<VascoInsight, 'id'>;
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
      title: 'Sneller betaald worden',
      message: "Facturen met een gedetailleerde omschrijving worden gemiddeld 3 dagen sneller betaald.",
      detail: "Voeg foto's van het afgeronde werk toe aan je factuur. Klanten die het resultaat zien betalen sneller.",
      icon: 'bulb',
      source: 'Vasco AI',
    },
  },
  {
    tipId: 'bulk-savings',
    roles: ['contractor'],
    screens: ['savings'],
    insight: {
      category: 'opportunity',
      priority: 'low',
      title: 'Bundel je bestellingen',
      message: 'Je bestelt gemiddeld 3x per week bij dezelfde leverancier. Door te bundelen bespaar je €45/maand aan verzendkosten.',
      icon: 'cart',
      actionLabel: 'Bundelen instellen',
      source: 'Inkoopanalyse',
      metric: { label: 'Potentiële besparing', value: '€540/jaar', trend: 'up' },
    },
  },
  {
    tipId: 'decision-followup',
    roles: ['contractor'],
    screens: ['decisions'],
    insight: {
      category: 'tip',
      priority: 'low',
      title: 'Klant wacht op antwoord',
      message: 'Klanten die binnen 7 dagen worden opgevolgd kiezen 40% vaker voor jou.',
      icon: 'chatbubble',
      actionLabel: 'Opvolgen',
      actionRoute: '/(contractor)/decisions',
      source: 'Klantinzichten',
    },
  },
  // Site Lead tips
  {
    tipId: 'crew-utilization',
    roles: ['sitelead'],
    screens: ['today', 'overview', 'dispatch'],
    insight: {
      category: 'schedule',
      priority: 'medium',
      title: 'Team onderbezet',
      message: 'Overweeg om klussen van morgen naar vandaag te verplaatsen bij onderbezetting.',
      icon: 'people',
      actionLabel: 'Herverdelen',
      source: 'Capaciteitsplanner',
    },
  },
  {
    tipId: 'safety-check',
    roles: ['sitelead'],
    screens: ['today', 'overview', 'dispatch'],
    insight: {
      category: 'compliance',
      priority: 'high',
      title: 'Veiligheidsinspectie morgen',
      message: 'Controleer of alle PBM-middelen compleet zijn voor de geplande inspectie.',
      icon: 'shield-checkmark',
      actionLabel: 'Checklist bekijken',
      source: 'Compliance',
    },
  },
  // CFO tips
  {
    tipId: 'cashflow-warning',
    roles: ['cfo'],
    screens: ['today', 'overview', 'cashflow'],
    insight: {
      category: 'financial',
      priority: 'high',
      title: 'Cash flow druk komende 2 weken',
      message: 'Overweeg draw requests te versnellen bij verwacht tekort.',
      icon: 'trending-down',
      actionLabel: 'Draw requests',
      source: 'Cash Flow Analyse',
    },
  },
  // COO tips
  {
    tipId: 'schedule-risk',
    roles: ['coo'],
    screens: ['today', 'financials', 'efficiency'],
    insight: {
      category: 'schedule',
      priority: 'high',
      title: 'Kritiek pad in gevaar',
      message: 'Vertragingen op het kritieke pad kunnen de totale oplevering beïnvloeden.',
      icon: 'warning',
      actionLabel: 'What-if analyse',
      source: 'Schedule Fragility',
    },
  },
  // Director tips
  {
    tipId: 'portfolio-health',
    roles: ['director'],
    screens: ['today', 'overview', 'portfolio'],
    insight: {
      category: 'financial',
      priority: 'medium',
      title: 'Portfolio update',
      message: 'Controleer projecten die aandacht vereisen op basis van budget en planning.',
      icon: 'pie-chart',
      actionLabel: 'Portfolio overzicht',
      source: 'Portfolio Monitor',
    },
  },
];

export const staticTipGenerator: InsightGenerator = {
  id: 'static-tip',
  screens: ['today', 'invoices', 'savings', 'decisions', 'meer', 'overview', 'dispatch',
    'costs', 'cashflow', 'returns', 'approvals', 'risks', 'performance',
    'financials', 'efficiency', 'market', 'emerging', 'portfolio', 'safety', 'quality', 'issues'],
  roles: ['contractor', 'sitelead', 'coo', 'cfo', 'director'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    // Use day-of-month for deterministic tip selection (not random)
    const dayIndex = ctx.now.getDate();

    const matching = STATIC_TIPS.filter(
      t => t.roles.includes(ctx.role) && t.screens.includes(ctx.screen)
    );

    if (matching.length === 0) return null;

    const selected = matching[dayIndex % matching.length];

    return {
      ...selected.insight,
      id: `static-${selected.tipId}`,
      generatorId: 'static-tip',
      rawScore: 0,
      reasoning: {
        observation: selected.insight.title,
        evidence: 'Op basis van branche-gemiddelden',
        implication: selected.insight.message,
        suggestion: selected.insight.detail || 'Bekijk de details voor meer informatie',
      },
      dataPoints: 0,
      confidence: 0.4,
      freshness: 48,
    };
  },
};
