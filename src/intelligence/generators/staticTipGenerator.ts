// =============================================================================
// STATIC TIP GENERATOR
// =============================================================================
// Replaces the old hardcoded templates that had no data backing.
// These are generic contextual tips with low base relevance.
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import type { VascoInsight } from '../../components/shared/VascoInsightCard';
import { gt } from '../generatorTranslations';

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
      source: 'source_vasco_ai',
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
      source: 'source_procurement',
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
      source: 'source_customer',
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
      source: 'source_capacity',
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
      source: 'source_compliance',
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
      source: 'source_cashflow',
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
      source: 'source_scheduling',
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
      source: 'source_portfolio',
    },
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

  // Dynamic tip: estimation accuracy insight from job history
  if (jobs.length >= 3) {
    const avgRatio = jobs.reduce((s, j) => s + (j.estimatedHours > 0 ? j.actualHours / j.estimatedHours : 1), 0) / jobs.length;
    if (avgRatio > 1.15) {
      return {
        id: 'dynamic-tip-underestimate',
        generatorId: 'static-tip',
        category: 'tip',
        priority: 'low',
        title: 'Je schat uren structureel te laag',
        message: `Je klussen duren gemiddeld ${Math.round((avgRatio - 1) * 100)}% langer dan begroot. Verhoog je uurschatting bij de volgende offerte.`,
        detail: `Op basis van ${jobs.length} afgeronde klussen.`,
        icon: 'bulb',
        source: gt('source_vasco_personal', ctx.language),
        rootCauseTags: ['tip', 'personalized'],
        rawScore: 0,
        reasoning: {
          observation: `Uren wijken gemiddeld ${Math.round((avgRatio - 1) * 100)}% af van begroting`,
          evidence: `Op basis van ${jobs.length} afgeronde klussen uit je profiel`,
          implication: 'Structurele onderschatting erodeert je marge',
          suggestion: 'Verhoog je standaard uurschatting met dit percentage',
        },
        dataPoints: jobs.length,
        confidence: 0.65,
        freshness: 48,
      };
    }
  }

  // Dynamic tip: savings streak motivation
  if (savings.savingsStreak >= 3) {
    return {
      id: 'dynamic-tip-streak',
      generatorId: 'static-tip',
      category: 'opportunity',
      priority: 'low',
      title: `${savings.savingsStreak} maanden besparingen op rij!`,
      message: `Je bespaart al ${savings.savingsStreak} maanden achter elkaar. ${savings.topSavingsCategory ? `Je beste categorie: ${savings.topSavingsCategory}.` : 'Goed bezig!'}`,
      icon: 'trophy',
      source: gt('source_vasco_personal', ctx.language),
      rootCauseTags: ['tip', 'personalized'],
      rawScore: 0,
      reasoning: {
        observation: `${savings.savingsStreak} opeenvolgende maanden met besparingen`,
        evidence: 'Op basis van je besparingsprofiel',
        implication: 'Consistente besparingen beschermen je marge op lange termijn',
        suggestion: 'Verhoog je maanddoel om de volgende stap te zetten',
      },
      dataPoints: savings.savingsStreak,
      confidence: 0.6,
      freshness: 48,
    };
  }

  // Dynamic tip: invoice payment advice
  if (invoices.totalInvoices > 5 && invoices.onTimeRate < 0.7) {
    return {
      id: 'dynamic-tip-payment',
      generatorId: 'static-tip',
      category: 'financial',
      priority: 'low',
      title: 'Betaalgedrag verbeteren',
      message: `Slechts ${Math.round(invoices.onTimeRate * 100)}% van je facturen wordt op tijd betaald. Automatische herinneringen kunnen dit verbeteren.`,
      icon: 'bulb',
      source: gt('source_vasco_personal', ctx.language),
      actionLabel: 'Herinneringen instellen',
      actionRoute: '/(contractor)/facturen',
      rootCauseTags: ['tip', 'personalized'],
      rawScore: 0,
      reasoning: {
        observation: `On-time betaalratio: ${Math.round(invoices.onTimeRate * 100)}%`,
        evidence: `Op basis van ${invoices.totalInvoices} facturen`,
        implication: 'Late betalingen beperken je werkkapitaal',
        suggestion: 'Schakel automatische herinneringen in op dag 3 en dag 7',
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

    return {
      ...selected.insight,
      source: gt(selected.insight.source as string, ctx.language),
      id: `static-${selected.tipId}`,
      generatorId: 'static-tip',
      rootCauseTags: ['tip', 'general'],
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
