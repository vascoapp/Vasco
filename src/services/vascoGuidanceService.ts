// =============================================================================
// VASCO GUIDANCE SERVICE - Role-aware, context-aware AI insights
// =============================================================================
// Generates actionable guidance for every screen and role.
// Pulls from real services (compliance, financial auditor, schedule fragility)
// and supplements with contextual advice.
// =============================================================================

import type { VascoInsight, InsightCategory, InsightPriority } from '../components/shared/VascoInsightCard';
import { useComplianceAlerts } from './complianceService';
import { useFinancialAuditStats } from './financialAuditorService';
import { useAuditFindings } from './auditorService';
import { useCashFlow } from './cashFlowService';
import { useSavingsAggregation } from './savingsAggregatorService';
import { usePredictiveSavingsSummary } from './predictiveSavingsService';
import { useLaborCosts } from './laborCostService';
import { useProjectProfitability } from './projectProfitabilityService';
import { useCrossServiceIntelligence } from './crossServiceIntelligenceService';
import { useCompetitiveIntelligence } from './competitiveIntelligenceService';
import { useMemo } from 'react';

type UserRole = 'contractor' | 'sitelead' | 'coo' | 'cfo' | 'director';
type ScreenContext =
  | 'today'
  | 'invoices'
  | 'savings'
  | 'decisions'
  | 'schedule'
  | 'dispatch'
  | 'costs'
  | 'cashflow'
  | 'returns'
  | 'approvals'
  | 'risks'
  | 'performance'
  | 'permits'
  | 'procurement'
  | 'portfolio'
  | 'meer'
  | 'overview'
  | 'safety'
  | 'quality'
  | 'issues';

// =============================================================================
// CONTEXTUAL GUIDANCE TEMPLATES
// =============================================================================

interface GuidanceTemplate {
  roles: UserRole[];
  screens: ScreenContext[];
  generate: () => VascoInsight | null;
}

const CONTEXTUAL_TEMPLATES: GuidanceTemplate[] = [
  // --- CONTRACTOR ---
  {
    roles: ['contractor'],
    screens: ['today'],
    generate: () => ({
      id: 'ctx-weather',
      category: 'weather',
      priority: 'high',
      title: 'Regen verwacht',
      message: 'Tussen 14:00-17:00 wordt regen verwacht. Plan buitenwerk indien mogelijk voor de ochtend.',
      detail: 'Buienradar voorspelt 8mm neerslag. Overweeg om de dakwerkzaamheden bij Klantnaam te verplaatsen naar morgenochtend.',
      icon: 'rainy',
      source: 'Weer',
      timestamp: '08:15',
    }),
  },
  {
    roles: ['contractor'],
    screens: ['today', 'schedule'],
    generate: () => ({
      id: 'ctx-schedule-gap',
      category: 'schedule',
      priority: 'low',
      title: 'Gat in je planning',
      message: 'Je hebt een vrij blok van 2 uur tussen 12:00-14:00. Ideaal voor een kleinere klus.',
      detail: 'Vasco heeft 3 openstaande offertes in de buurt gevonden die in dit tijdblok passen. Wil je ze bekijken?',
      icon: 'time',
      actionLabel: 'Bekijk klussen',
      actionRoute: '/(contractor)/besparen',
      source: 'Planner',
      timestamp: 'Nu',
    }),
  },
  {
    roles: ['contractor'],
    screens: ['invoices'],
    generate: () => ({
      id: 'ctx-invoice-tip',
      category: 'financial',
      priority: 'medium',
      title: 'Sneller betaald worden',
      message: 'Facturen met een gedetailleerde omschrijving worden gemiddeld 3 dagen sneller betaald.',
      detail: 'Voeg foto\'s van het afgeronde werk toe aan je factuur. Klanten die het resultaat zien betalen sneller en geven vaker een positieve review.',
      icon: 'bulb',
      source: 'Vasco AI',
    }),
  },
  {
    roles: ['contractor'],
    screens: ['savings'],
    generate: () => ({
      id: 'ctx-bulk-savings',
      category: 'opportunity',
      priority: 'medium',
      title: 'Bundel je bestellingen',
      message: 'Je bestelt gemiddeld 3x per week bij dezelfde leverancier. Door te bundelen bespaar je €45/maand aan verzendkosten.',
      detail: 'Stel een wekelijkse besteldag in en Vasco verzamelt automatisch je benodigde materialen. Leveranciers geven vaak korting op grotere orders.',
      icon: 'cart',
      actionLabel: 'Bundelen instellen',
      source: 'Inkoopanalyse',
      metric: { label: 'Potentiële besparing', value: '€540/jaar', trend: 'up' },
    }),
  },
  {
    roles: ['contractor'],
    screens: ['decisions'],
    generate: () => ({
      id: 'ctx-decision-followup',
      category: 'tip',
      priority: 'medium',
      title: 'Klant wacht op antwoord',
      message: 'De offerte voor Familie De Jong is 5 dagen geleden verstuurd. Klanten die binnen 7 dagen worden opgevolgd kiezen 40% vaker voor jou.',
      detail: 'Stuur een vriendelijk bericht via WhatsApp om te vragen of ze nog vragen hebben. Dit voelt persoonlijk en verhoogt je slagingspercentage.',
      icon: 'chatbubble',
      actionLabel: 'Opvolgen',
      actionRoute: '/(contractor)/decisions',
      source: 'Klantinzichten',
    }),
  },

  // --- SITE LEAD ---
  {
    roles: ['sitelead'],
    screens: ['today', 'overview', 'dispatch'],
    generate: () => ({
      id: 'ctx-crew-utilization',
      category: 'schedule',
      priority: 'medium',
      title: 'Team onderbezet',
      message: 'Team Alpha heeft 60% bezetting vandaag. Overweeg om de keukenklus van morgen naar vandaag te verplaatsen.',
      detail: 'Jan de Vries en Pieter Bakker zijn beschikbaar na 14:00. De klus bij Familie Mulder kan vandaag al starten.',
      icon: 'people',
      actionLabel: 'Herverdelen',
      source: 'Capaciteitsplanner',
    }),
  },
  {
    roles: ['sitelead'],
    screens: ['today', 'overview', 'dispatch'],
    generate: () => ({
      id: 'ctx-safety-check',
      category: 'compliance',
      priority: 'high',
      title: 'Veiligheidsinspectie morgen',
      message: 'Er staat een veiligheidsinspectie gepland voor morgen. Controleer of alle PBM-middelen compleet zijn.',
      detail: 'Inspecteur H. van Dam komt om 10:00. Zorg dat toolboxtalken zijn bijgewerkt en alle werkvergunningen zichtbaar hangen.',
      icon: 'shield-checkmark',
      actionLabel: 'Checklist bekijken',
      source: 'Compliance',
    }),
  },
  {
    roles: ['sitelead'],
    screens: ['safety'],
    generate: () => ({
      id: 'ctx-safety-incident-trend',
      category: 'compliance',
      priority: 'medium',
      title: 'Incident trend daalt',
      message: 'Het aantal veiligheidsincidenten is deze maand 25% lager dan vorige maand. Blijf toolboxtalken consistent uitvoeren.',
      detail: 'De verbetering komt voornamelijk door betere PBM-naleving en dagelijkse veiligheidsbriefings. Houd dit vast.',
      icon: 'trending-down',
      source: 'Veiligheidsmonitor',
      metric: { label: 'Incidenten trend', value: '-25%', trend: 'up' },
    }),
  },
  {
    roles: ['sitelead'],
    screens: ['quality'],
    generate: () => ({
      id: 'ctx-quality-snag',
      category: 'alert',
      priority: 'medium',
      title: 'Oplopende punchlist',
      message: '14 openstaande snag items, waarvan 5 ouder dan 7 dagen. Snelle afhandeling voorkomt vertraging bij oplevering.',
      detail: 'De meeste items betreffen afwerking in blok C. Plan een gerichte snag-run in met het afbouwteam.',
      icon: 'construct',
      actionLabel: 'Punchlist bekijken',
      source: 'Kwaliteitscontrole',
    }),
  },
  {
    roles: ['sitelead'],
    screens: ['issues'],
    generate: () => ({
      id: 'ctx-rfi-aging',
      category: 'alert',
      priority: 'high',
      title: 'RFI\'s lopen op',
      message: '3 RFI\'s wachten langer dan 48 uur op antwoord. Onbeantwoorde RFI\'s vertragen het werk gemiddeld 3 dagen.',
      detail: 'Escaleer de openstaande RFI\'s naar de projectmanager en architect om doorlooptijd te verkorten.',
      icon: 'chatbubbles',
      actionLabel: 'RFI\'s bekijken',
      source: 'Issuetracker',
    }),
  },

  // --- CFO ---
  {
    roles: ['cfo'],
    screens: ['today', 'overview', 'cashflow'],
    generate: () => ({
      id: 'ctx-cashflow-warning',
      category: 'financial',
      priority: 'high',
      title: 'Cash flow druk komende 2 weken',
      message: 'Er staan £2.1M aan betalingen gepland, maar slechts £1.4M aan inkomsten verwacht. Overweeg draw requests te versnellen.',
      detail: 'De grootste uitstroom is £800K aan onderaannemersfacturen op 15 feb. Door 2 draw requests te versnellen kunt u het tekort overbruggen.',
      icon: 'trending-down',
      actionLabel: 'Draw requests',
      source: 'Cash Flow Analyse',
      metric: { label: 'Verwacht tekort', value: '£700K', trend: 'down' },
    }),
  },
  {
    roles: ['cfo'],
    screens: ['today', 'overview'],
    generate: () => ({
      id: 'ctx-cfo-duplicate-payments',
      category: 'financial',
      priority: 'medium',
      title: 'Mogelijke dubbele betalingen',
      message: 'De AI Auditor heeft 2 facturen geïdentificeerd die mogelijk duplicaten zijn. Totaalwaarde: £24.500.',
      detail: 'Factuur #INV-2847 en #INV-2851 van BuildRight Ltd tonen dezelfde bedragen en vergelijkbare omschrijvingen. Controleer voor goedkeuring.',
      icon: 'copy',
      actionLabel: 'Controleren',
      source: 'Financieel Auditor',
      metric: { label: 'Risicobedrag', value: '£24.5K', trend: 'down' },
    }),
  },
  {
    roles: ['cfo'],
    screens: ['costs'],
    generate: () => ({
      id: 'ctx-cost-overrun',
      category: 'alert',
      priority: 'high',
      title: 'Budget overschrijding gedetecteerd',
      message: 'Project Riverside toont een CPI van 0.87 — kosten stijgen sneller dan gepland. Vroeg ingrijpen bespaart tot 15% van het restbudget.',
      detail: 'De overschrijding zit voornamelijk in de MEP fase door vertragingen bij de elektra-aannemer. Overweeg een gesprek met de leverancier of alternatieve inschakeling.',
      icon: 'alert-circle',
      actionLabel: 'Kostenanalyse',
      source: 'Financieel Auditor',
    }),
  },
  {
    roles: ['cfo'],
    screens: ['returns'],
    generate: () => ({
      id: 'ctx-irr-improvement',
      category: 'opportunity',
      priority: 'low',
      title: 'IRR verbetering mogelijk',
      message: 'Door de exit timing van Project Oak Gardens 3 maanden te vervroegen stijgt de portfolio IRR met 0.8 procentpunt.',
      icon: 'trending-up',
      source: 'Portfolio Analyse',
      metric: { label: 'Potentiële IRR uplift', value: '+0.8%', trend: 'up' },
    }),
  },

  // --- COO ---
  {
    roles: ['coo'],
    screens: ['today', 'overview', 'schedule'],
    generate: () => ({
      id: 'ctx-schedule-risk',
      category: 'schedule',
      priority: 'high',
      title: 'Kritiek pad in gevaar',
      message: 'De funderingsfase loopt 3 dagen achter. Dit raakt het kritieke pad en kan de totale oplevering met 2 weken vertragen.',
      detail: 'Overweeg weekendwerk in te plannen of een extra team bij te schakelen. De geschatte extra kosten zijn £12K, tegenover £85K aan vertragingsboetes.',
      icon: 'warning',
      actionLabel: 'What-if analyse',
      source: 'Schedule Fragility',
      metric: { label: 'Vertraging risico', value: '2 weken', trend: 'down' },
    }),
  },
  {
    roles: ['coo'],
    screens: ['today', 'overview'],
    generate: () => ({
      id: 'ctx-coo-resource-conflict',
      category: 'schedule',
      priority: 'medium',
      title: 'Resource conflict gedetecteerd',
      message: 'MEP-team is dubbel ingepland op 2 projecten volgende week. Herschikking nodig om vertraging te voorkomen.',
      detail: 'Het elektra-team is zowel bij Meridian Tower als Thames View ingepland voor week 7. Prioriteer op basis van kritiek pad impact.',
      icon: 'git-branch',
      actionLabel: 'Planning bekijken',
      source: 'Resourceplanner',
    }),
  },
  {
    roles: ['coo'],
    screens: ['procurement'],
    generate: () => ({
      id: 'ctx-supplier-drift',
      category: 'alert',
      priority: 'medium',
      title: 'Leverancier prestatie daalt',
      message: 'BuildSupply Co. scoort nu een C-rating (was B). Levertijden zijn 40% langer geworden de afgelopen maand.',
      detail: 'Er zijn 3 alternatieve leveranciers beschikbaar met betere scores. Een overstap kan de levertijd met 5 dagen verkorten.',
      icon: 'arrow-down-circle',
      actionLabel: 'Alternatieven bekijken',
      source: 'Leveranciersanalyse',
    }),
  },
  {
    roles: ['coo'],
    screens: ['permits'],
    generate: () => ({
      id: 'ctx-permit-deadline',
      category: 'compliance',
      priority: 'critical',
      title: 'Vergunning deadline nadert',
      message: 'De bouwvergunning voor Phase 2 moet binnen 5 werkdagen worden ingediend. Mist u deze deadline, dan is een spoedprocedure nodig (+£15K).',
      icon: 'document-text',
      actionLabel: 'Vergunning bekijken',
      source: 'Vergunningen',
    }),
  },

  // --- DIRECTOR ---
  {
    roles: ['director'],
    screens: ['today', 'overview', 'portfolio'],
    generate: () => ({
      id: 'ctx-portfolio-health',
      category: 'financial',
      priority: 'medium',
      title: 'Portfolio update',
      message: '4 van 6 projecten zijn op schema. 2 projecten vereisen aandacht: Riverside (budget) en Oak Gardens (vergunningen).',
      detail: 'Riverside heeft een kostenoverschrijding van 13% in de MEP fase. Oak Gardens wacht op een gemeentelijke vergunning die 2 weken vertraagd is.',
      icon: 'pie-chart',
      actionLabel: 'Portfolio overzicht',
      source: 'Portfolio Monitor',
    }),
  },
  {
    roles: ['director'],
    screens: ['today', 'overview', 'portfolio'],
    generate: () => ({
      id: 'ctx-director-market-watch',
      category: 'tip',
      priority: 'low',
      title: 'Marktupdate bouw NL/UK',
      message: 'Bouwkosten UK +3.2% QoQ. NL materiaalkosten stabiel. Overweeg versnelling van inkoop voor Q2 projecten.',
      detail: 'Vooral staal en beton laten stijgende trends zien in de UK markt. Nederlandse leveranciers bieden momenteel competitievere prijzen.',
      icon: 'globe',
      source: 'Marktanalyse',
      metric: { label: 'Kostenstijging UK', value: '+3.2%', trend: 'down' },
    }),
  },
  {
    roles: ['director'],
    screens: ['approvals'],
    generate: () => ({
      id: 'ctx-approval-aging',
      category: 'alert',
      priority: 'high',
      title: 'Goedkeuringen lopen op',
      message: '3 goedkeuringsverzoeken wachten langer dan 48 uur. Langdurig wachten vertraagt projectvoortgang en frustreert teams.',
      detail: 'De hoogste urgentie heeft de MEP contractwijziging (£340K) die al 5 dagen wacht. Het projectteam heeft een deadline aanstaande vrijdag.',
      icon: 'timer',
      actionLabel: 'Goedkeuren',
      source: 'Goedkeuringswachtrij',
    }),
  },
  {
    roles: ['director'],
    screens: ['risks'],
    generate: () => ({
      id: 'ctx-risk-emerging',
      category: 'alert',
      priority: 'medium',
      title: 'Nieuw risico geïdentificeerd',
      message: 'Stijgende staalprijzen (+8% deze maand) kunnen het budget van 3 projecten beïnvloeden. Overweeg voorinkoop of hedging.',
      icon: 'pulse',
      source: 'Risicomonitor',
      metric: { label: 'Staalprijs stijging', value: '+8%', trend: 'down' },
    }),
  },
  {
    roles: ['director'],
    screens: ['performance'],
    generate: () => ({
      id: 'ctx-platform-roi',
      category: 'tip',
      priority: 'low',
      title: 'Platform ROI groeit',
      message: 'Vasco heeft deze maand £48K aan waarde geleverd: €28.5K admin tijdsbesparing, £12.4K snellere incasso, £7.1K foutpreventie.',
      icon: 'rocket',
      source: 'Platform Analytics',
      metric: { label: 'Maandelijkse ROI', value: '£48K', trend: 'up' },
    }),
  },
];

// =============================================================================
// HOOK: useVascoGuidance
// =============================================================================

export function useVascoGuidance(role: UserRole, screen: ScreenContext): VascoInsight[] {
  // Pull real data from services
  const { alerts: complianceAlerts } = useComplianceAlerts();
  const financialStats = useFinancialAuditStats();
  const { findings: auditFindings } = useAuditFindings(role);
  const { invoices } = useCashFlow();

  // Pull from new AI cost-saving services
  const savings = useSavingsAggregation();
  const predictive = usePredictiveSavingsSummary();
  const labor = useLaborCosts();
  const profitability = useProjectProfitability();
  const crossIntel = useCrossServiceIntelligence();
  const competitive = useCompetitiveIntelligence();

  return useMemo(() => {
    const insights: VascoInsight[] = [];

    // 1. Real compliance alerts → insights
    complianceAlerts.forEach(alert => {
      if (alert.severity === 'critical' || alert.severity === 'high') {
        insights.push({
          id: `compliance-${alert.id}`,
          category: 'compliance',
          priority: alert.severity === 'critical' ? 'critical' : 'high',
          title: alert.title || 'Compliance waarschuwing',
          message: alert.description || 'Actie vereist voor compliance.',
          icon: 'shield-checkmark',
          actionLabel: 'Bekijk details',
          actionRoute: role === 'contractor' ? '/(contractor)/certificaten' : undefined,
          source: 'Compliance Monitor',
          timestamp: 'Nu',
        });
      }
    });

    // 2. Real financial audit findings → insights
    if (financialStats && (financialStats.criticalFindings > 0 || financialStats.highFindings > 0)) {
      const totalFindingCount = financialStats.criticalFindings + financialStats.highFindings;
      insights.push({
        id: 'financial-audit-alert',
        category: 'financial',
        priority: financialStats.criticalFindings > 0 ? 'critical' : 'high',
        title: 'Financiële controle bevinding',
        message: `${totalFindingCount} bevindingen die aandacht vereisen. ${financialStats.criticalFindings > 0 ? `${financialStats.criticalFindings} kritiek.` : ''}`,
        detail: `${financialStats.invoicesVerified} facturen gecontroleerd. ${financialStats.potentialSavings > 0 ? `Potentiële besparing: €${financialStats.potentialSavings.toLocaleString('nl-NL')}.` : ''}`,
        icon: 'alert-circle',
        actionLabel: 'Bekijk bevindingen',
        actionRoute: role === 'contractor' ? '/(contractor)/facturen' : undefined,
        source: 'Financieel Auditor',
        metric: financialStats.potentialSavings > 0 ? {
          label: 'Potentiële besparing',
          value: `€${financialStats.potentialSavings.toLocaleString('nl-NL')}`,
          trend: 'up',
        } : undefined,
      });
    }

    // 3. Overdue invoices → insights (contractor-specific)
    if (role === 'contractor') {
      const overdueInvoices = invoices.filter(i => i.status === 'overdue');
      if (overdueInvoices.length > 0) {
        const totalOverdue = overdueInvoices.reduce((sum, i) => sum + i.amount, 0);
        insights.push({
          id: 'overdue-invoices',
          category: 'financial',
          priority: 'medium',
          title: `${overdueInvoices.length} verlopen facturen`,
          message: `€${totalOverdue.toLocaleString('nl-NL')} staat nog open. Stuur een herinnering om sneller betaald te worden.`,
          detail: `De oudste factuur is ${overdueInvoices.length > 0 ? 'meer dan een week' : 'enkele dagen'} verlopen. Automatische herinneringen verhogen de incasso met 35%.`,
          icon: 'receipt',
          actionLabel: 'Herinneringen sturen',
          actionRoute: '/(contractor)/facturen',
          source: 'Facturatie',
          metric: { label: 'Openstaand', value: `€${totalOverdue.toLocaleString('nl-NL')}`, trend: 'down' },
        });
      }
    }

    // 4. NEW: Savings-powered insights (contractor)
    if (role === 'contractor' && (screen === 'today' || screen === 'savings')) {
      // Predictive savings with urgent opportunities
      const urgentPredictions = predictive.opportunities.filter(p => p.urgency === 'high');
      if (urgentPredictions.length > 0) {
        const top = urgentPredictions[0];
        insights.push({
          id: `predictive-${top.id}`,
          category: 'opportunity',
          priority: 'medium',
          title: top.title,
          message: top.description,
          icon: top.icon as VascoInsight['icon'],
          actionLabel: top.actionLabel,
          actionRoute: '/(contractor)/besparen',
          source: 'Besparingsanalyse',
          metric: { label: 'Potentieel', value: `€${top.potentialSaving}`, trend: 'up' },
        });
      }
    }

    // 5. NEW: Labor cost warnings (contractor today/decisions)
    if (role === 'contractor' && (screen === 'today' || screen === 'decisions')) {
      if (labor.idleTime.idlePercent > 10) {
        insights.push({
          id: 'labor-idle-warning',
          category: 'tip',
          priority: 'low',
          title: `${labor.idleTime.idlePercent}% leegloop deze maand`,
          message: `${labor.idleTime.totalIdleHours} uur niet-productief. ${labor.idleTime.suggestion}`,
          icon: 'time',
          source: 'Arbeidsanalyse',
          metric: { label: 'Verloren waarde', value: `€${labor.idleTime.idleCost}`, trend: 'down' },
        });
      }
    }

    // 6. Profitability insights (CFO/Director overview — strategic view)
    if ((role === 'cfo' || role === 'director') && screen === 'overview') {
      const atRisk = profitability.insights.find(i => i.type === 'warning');
      if (atRisk) {
        insights.push({
          id: `profit-${atRisk.id}`,
          category: 'alert',
          priority: 'medium',
          title: atRisk.title,
          message: atRisk.description,
          icon: atRisk.icon as VascoInsight['icon'],
          source: 'Winstgevendheid',
          metric: { label: 'Impact', value: `€${atRisk.impact.toLocaleString('nl-NL')}`, trend: 'down' },
        });
      }
    }

    // 7. NEW: Cross-service intelligence (all contractor screens)
    if (role === 'contractor') {
      const topCross = crossIntel.insights
        .filter(i => i.priority === 'high')
        .find(i => {
          if (screen === 'invoices') return i.sources.some(s => s.includes('cashFlow') || s.includes('invoice'));
          if (screen === 'savings') return i.sources.some(s => s.includes('supplier') || s.includes('pricing'));
          if (screen === 'decisions') return i.sources.some(s => s.includes('customer') || s.includes('quote'));
          return false;
        });
      if (topCross) {
        insights.push({
          id: `cross-${topCross.id}`,
          category: 'tip',
          priority: 'medium',
          title: topCross.title,
          message: topCross.description,
          icon: topCross.icon as VascoInsight['icon'],
          actionLabel: topCross.actionLabel,
          source: 'Cross-analyse',
          metric: topCross.impact.unit.includes('€')
            ? { label: 'Impact', value: `€${topCross.impact.value.toLocaleString('nl-NL')}`, trend: topCross.impact.direction === 'positive' ? 'up' : 'down' }
            : undefined,
        });
      }
    }

    // 8. Competitive insights (contractor invoices only — shelved from decisions)
    if (role === 'contractor' && screen === 'invoices') {
      if (competitive.topLossReason && competitive.topLossReason !== 'Geen data') {
        insights.push({
          id: 'competitive-loss-reason',
          category: 'tip',
          priority: 'low',
          title: `Meest verloren op: ${competitive.topLossReason}`,
          message: competitive.monthlyInsight,
          icon: 'podium',
          source: 'Concurrentie-analyse',
          metric: { label: 'Win-rate', value: `${competitive.overallWinRate}%`, trend: competitive.winRateTrend === 'up' ? 'up' : 'down' },
        });
      }
    }

    // 9. Contextual templates for this role + screen
    CONTEXTUAL_TEMPLATES.forEach(template => {
      if (template.roles.includes(role) && template.screens.includes(screen)) {
        const insight = template.generate();
        if (insight && !insights.find(i => i.id === insight.id)) {
          insights.push(insight);
        }
      }
    });

    // Sort by priority
    const priorityOrder: Record<InsightPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return insights;
  }, [complianceAlerts, financialStats, auditFindings, invoices, savings, predictive, labor, profitability, crossIntel, competitive, role, screen]);
}

// =============================================================================
// HOOK: useInlineInsight - Single contextual tip for a specific screen section
// =============================================================================

interface InlineInsightData {
  icon: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
}

const INLINE_INSIGHTS: Record<string, InlineInsightData[]> = {
  'contractor:invoices:empty': [
    { icon: 'bulb', message: 'Maak je eerste factuur direct na een klus — hoe sneller je factureert, hoe sneller je betaald wordt.' },
  ],
  'contractor:invoices:list': [
    { icon: 'bulb', message: 'Facturen met foto\'s van het eindresultaat worden 3 dagen sneller betaald.', actionLabel: 'Tips', actionRoute: '/(contractor)/facturen' },
  ],
  'contractor:quotes:empty': [
    { icon: 'flash', message: 'Gebruik de AI offerte generator om in 2 minuten een professionele offerte te maken.', actionLabel: 'Probeer', actionRoute: '/contractor/tiered-quote' },
  ],
  'contractor:quotes:list': [
    { icon: 'trending-up', message: 'Offertes met 3 prijsniveaus (goed/beter/best) worden 25% vaker geaccepteerd.' },
  ],
  'contractor:schedule:empty': [
    { icon: 'calendar', message: 'Plan je klussen in Vasco en krijg automatisch route-optimalisatie en reistijdschattingen.' },
  ],
  'contractor:savings:overview': [
    { icon: 'pricetag', message: 'Vergelijk automatisch prijzen bij meerdere leveranciers — gemiddelde besparing: 12%.' },
    { icon: 'analytics', message: 'De TCO-calculator vergelijkt de totale levenscycluskosten — vaak is mid-tier 40% goedkoper per jaar.' },
  ],
  'contractor:savings:predictive': [
    { icon: 'bulb', message: 'Vasco voorspelt prijsdalingen op basis van historische data en seizoenspatronen.' },
  ],
  'contractor:savings:negotiation': [
    { icon: 'business', message: 'Je leveranciersuitgaven zijn geconcentreerd — gebruik je volume als onderhandelingshefboom.' },
  ],
  'contractor:meer:overview': [
    { icon: 'sparkles', message: 'Ontdek alle tools die Vasco biedt — van AI-offertes tot slimme planning en leveranciersvergelijking.' },
  ],
  // --- SITE LEAD ---
  'sitelead:overview:overview': [
    { icon: 'people', message: 'Vasco volgt alle werkploegen real-time. Het Loodgieter Team loopt achter op schema \u2014 materiaallevering vertraagd. Overweeg extra personeel in te zetten of de planning aan te passen.' },
  ],
  'sitelead:dispatch:overview': [
    { icon: 'people', message: 'Teams met een dagelijkse briefing scoren 18% hoger op klanttevredenheid.' },
  ],
  'sitelead:safety:overview': [
    { icon: 'shield-checkmark', message: 'Dagelijkse toolboxtalken verlagen incidenten met 35%. Plan ze in voor elke ploeg.' },
  ],
  'sitelead:quality:overview': [
    { icon: 'checkmark-done', message: 'Projecten met foto-documentatie bij elke inspectie hebben 40% minder nawerk.' },
  ],
  'sitelead:issues:overview': [
    { icon: 'chatbubbles', message: 'RFI\'s die binnen 48 uur worden beantwoord voorkomen gemiddeld 3 dagen vertraging.' },
  ],
  // --- CFO ---
  'cfo:overview:overview': [
    { icon: 'bulb', message: 'De AI Financial Auditor controleert automatisch alle facturen op afwijkingen en besparingskansen.' },
  ],
  'cfo:costs:overview': [
    { icon: 'shield-checkmark', message: 'Vasco controleert automatisch alle facturen op dubbele betalingen en overbetaling.' },
  ],
  'cfo:cashflow:overview': [
    { icon: 'bulb', message: 'Handovers die vastlopen vertragen betalingen. Controleer de handover status voor snellere incasso.' },
  ],
  'cfo:returns:overview': [
    { icon: 'trending-up', message: 'Projecten met actieve exit-timing analyses tonen gemiddeld 0.8% hogere IRR.' },
  ],
  // --- COO ---
  'coo:overview:overview': [
    { icon: 'analytics', message: 'Vasco monitort alle projecten real-time en waarschuwt bij afwijkingen van het kritieke pad.' },
  ],
  'coo:schedule:overview': [
    { icon: 'analytics', message: 'De fragiliteitscore voorspelt vertragingsrisico 2 weken vooruit — hoe lager, hoe beter.' },
  ],
  'coo:permits:overview': [
    { icon: 'document-text', message: 'Vergunningsaanvragen die op tijd worden ingediend besparen gemiddeld £15K aan spoedprocedures.' },
  ],
  'coo:procurement:overview': [
    { icon: 'shield', message: 'Leveranciers met een A/B rating leveren 95% op tijd. Overweeg alternatieven voor C/D-leveranciers.' },
  ],
  // --- DIRECTOR ---
  'director:overview:overview': [
    { icon: 'pie-chart', message: 'Vasco analyseert uw volledige portfolio en identificeert risico\'s voordat ze escaleren.' },
  ],
  'director:approvals:overview': [
    { icon: 'timer', message: 'Goedkeuringen die langer dan 48 uur wachten vertragen projecten gemiddeld 5 werkdagen.' },
  ],
  'director:risks:overview': [
    { icon: 'warning', message: 'Projecten met actieve risicomonitoring tonen 30% minder onverwachte kostenoverschrijdingen.' },
  ],
  'director:portfolio:overview': [
    { icon: 'pie-chart', message: 'Projecten met actieve what-if analyses tonen 23% minder onverwachte kostenoverschrijdingen.' },
  ],
  'director:performance:overview': [
    { icon: 'rocket', message: 'Het Vasco platform bespaart gemiddeld 12 uur per week aan administratieve taken per project.' },
  ],
};

export function useInlineInsight(role: UserRole, screen: string, context: string): InlineInsightData | null {
  return useMemo(() => {
    const key = `${role}:${screen}:${context}`;
    const insights = INLINE_INSIGHTS[key];
    if (!insights || insights.length === 0) return null;
    // Return a consistent insight (not random) based on day of month
    const dayIndex = new Date().getDate() % insights.length;
    return insights[dayIndex];
  }, [role, screen, context]);
}
