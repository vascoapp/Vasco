// =============================================================================
// VASCO GUIDANCE SERVICE - Role-aware, context-aware AI insights
// =============================================================================
// Now powered by the Learning Engine: 15+ data-driven generators,
// scored by engagement/relevance/freshness, personalized per contractor.
// =============================================================================

import type { VascoInsight } from '../components/shared/VascoInsightCard';
import { useMemo, useEffect, useState } from 'react';

// Learning Engine imports
import { useLearningProfile, incrementInsightsShown, setActiveRole } from '../intelligence/learningStorage';
import { useAllGenerators } from '../intelligence/generators';
import type { ScoredInsight, UserRole, ScreenContext, GeneratorLanguage, DataCounts } from '../intelligence/generators';
import appI18n from '../i18n/i18n';
import { toGeneratorLanguage } from '../intelligence/generatorTranslations';
import { scoreAndRankInsights, refreshCalibrationCache, refreshApprovalRateCache } from '../intelligence/insightScorer';
import { refreshRankingHint } from '../intelligence/ranking/rankingRefresh';
import { enqueueInsightsIfHinted } from '../intelligence/generators/emitToQueue';
import { useAppState } from '../state/AppState';

// Re-export types for consumers
export type { ScoredInsight } from '../intelligence/generators';

// =============================================================================
// HOOK: useVascoGuidance
// =============================================================================
// NEW: Load profile → run all generators → score → filter/cap → sort → return
// =============================================================================

export function useVascoGuidance(role: UserRole, screen: ScreenContext): ScoredInsight[] {
  // Set active role for role-aware storage (must be before useLearningProfile)
  setActiveRole(role);
  // Detect language from i18n
  // Read the APP's i18n instance directly, the way every other service does.
  //
  // This was `require('i18next')` inside a try/catch whose catch left the
  // language at a hardcoded 'nl'. The require does not resolve here, so the
  // catch fired on every render and EVERY generator string was Dutch — for
  // every contractor in every country. It was invisible for as long as the app
  // was walked in Dutch, because the wrong answer and the right answer were the
  // same string. Walking as a German contractor made it obvious: an otherwise
  // German Finanzen tab carrying "2 facturen achterstallig: 800 €".
  //
  // Normalised rather than cast, too: `i18n.language` can be 'en-US', a locale
  // this app genuinely ships, which is not a TranslationMap key.
  const currentLanguage: GeneratorLanguage = toGeneratorLanguage(appI18n.language);
  const { profile } = useLearningProfile();

  // Periodically update `now` so freshness/fatigue stay accurate in long sessions
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, []);

  // Load calibration scores + approval rate cache on mount
  useEffect(() => {
    refreshCalibrationCache();
    refreshApprovalRateCache();
  }, []);

  // Compute data counts for generator thresholds (suppress noise on low data)
  const { jobs, invoices, quotes, businessProfile } = useAppState();
  const dataCounts = useMemo<DataCounts>(() => ({
    jobCount: jobs?.length ?? 0,
    invoiceCount: invoices?.length ?? 0,
    quoteCount: quotes?.length ?? 0,
  }), [jobs?.length, invoices?.length, quotes?.length]);

  // Build generator context
  const ctx = useMemo(() => ({
    role,
    screen,
    profile,
    now,
    language: currentLanguage,
    country: (businessProfile?.country as any) ?? 'NL',
  }), [role, screen, profile, now, currentLanguage, businessProfile?.country]);

  // Run all generators (each is a hook internally), with data threshold filtering
  const rawInsights = useAllGenerators(ctx, dataCounts);

  // Score, rank, and cap insights (role-aware weights + diversity enforcement)
  const scoredInsights = useMemo(() => {
    const ranked = scoreAndRankInsights(rawInsights, screen, profile, now, role);

    // Stamp screen context onto each insight for interaction tracking
    for (const insight of ranked) {
      insight.shownOnScreen = screen;
    }

    // Track shown insights for daily budget
    if (ranked.length > 0) {
      incrementInsightsShown(ranked.length);
    }

    return ranked;
  }, [rawInsights, screen, profile, now, role]);

  // Situational ranking (tier 2). Fire-and-forget, and deliberately AFTER the
  // synchronous ranking above: this render uses whatever hint already exists,
  // and the refresh improves the NEXT one. Nothing here can block a card.
  //
  // `refreshRankingHint` no-ops when the situation digest is unchanged, when
  // there are fewer than three insights, when Supabase is not configured, and
  // on any error — so the steady state is one call per contractor per day, not
  // one per render. See rankingRefresh.ts.
  const rankingSignature = rawInsights.map((i) => i.generatorId).sort().join(',');
  useEffect(() => {
    if (!rawInsights.length) return;
    refreshRankingHint(
      rawInsights.map((i) => ({
        generatorId: i.generatorId,
        category: i.category,
        // Generator-assigned and semantic — what KIND of problem, how urgent
        // the rule thinks it is — all independent of rawScore.
        priority: i.priority,
        ageDays: Math.round((i.freshness ?? 0) / 24),
        confidence: i.confidence,
        // `magnitude` is deliberately NOT sent.
        //
        // The obvious thing is to bucket it from rawScore, and the first version
        // did. That is wrong twice over: rawScore is the SCORE the rules already
        // assigned, not the size of the underlying problem, so the label lies to
        // the model — and we then multiply that same rawScore by the answer the
        // model gives back, which is a feedback loop carrying no new information.
        //
        // A true magnitude would be the size of the thing itself (euros overdue,
        // days late) bucketed to small/medium/large. No generator exposes one
        // today, so the field stays empty rather than being faked.
      })),
      {
        country: (businessProfile?.country as string) ?? 'NL',
        trade: businessProfile?.trade as string | undefined,
      },
    ).catch(() => {});
    // Keyed on the generator SET, not the insight objects: a rawScore wobble
    // must not trigger a refresh, a different set of insights must.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankingSignature, businessProfile?.country, businessProfile?.trade]);

  // Side-effect: any insight with an enqueueHint flows into the AI action
  // queue so the user sees it as an actionable item in VascoCard, not just
  // a read-only banner.
  useEffect(() => {
    if (scoredInsights.length === 0) return;
    enqueueInsightsIfHinted(scoredInsights).catch(() => {});
  }, [scoredInsights]);

  return scoredInsights;
}

// =============================================================================
// HOOK: useInlineInsight - Single contextual tip for a specific screen section
// =============================================================================
// (Unchanged — this is separate from the generator pipeline)
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
  // --- WORKFLOW: Quote creation ---
  'contractor:quote-new:form': [
    { icon: 'bulb', message: 'Offertes met een duidelijke scope en materiaallijst worden 30% vaker geaccepteerd.' },
  ],
  'contractor:quote-new:pricing': [
    { icon: 'analytics', message: 'Vasco vergelijkt je prijs met eerdere offertes voor dit type klus.' },
  ],
  'contractor:quote-new:customer': [
    { icon: 'person', message: 'Vasco analyseert het betalingsgedrag van deze klant automatisch.' },
  ],
  // --- WORKFLOW: Invoice creation ---
  'contractor:invoice-new:select': [
    { icon: 'flash', message: 'Facturen die binnen 24 uur na oplevering worden verstuurd, worden 3 dagen sneller betaald.' },
  ],
  'contractor:invoice-create:total': [
    { icon: 'camera', message: 'Voeg foto\'s van het eindresultaat toe — klanten betalen sneller met visueel bewijs.' },
  ],
  'contractor:invoice-create:customer': [
    { icon: 'person', message: 'Vasco controleert het betalingsgedrag van deze klant automatisch.' },
  ],
  // --- WORKFLOW: Job detail ---
  'contractor:job-detail:overview': [
    { icon: 'analytics', message: 'Vasco analyseert je kosten en planning automatisch — bekijk de margetracker.' },
  ],
  'contractor:job-detail:materials': [
    { icon: 'cube', message: 'Bestel materialen op tijd om vertragingen te voorkomen.' },
  ],
  // --- WORKFLOW: Jobs list ---
  'contractor:jobs-list:active': [
    { icon: 'briefcase', message: 'Focus op klussen dicht bij oplevering voor snellere facturatie.' },
  ],
  'contractor:jobs-list:pipeline': [
    { icon: 'trending-up', message: 'Vasco voorspelt je pipeline-conversie op basis van historische data.' },
  ],
  // --- WORKFLOW: Quotes list ---
  'contractor:quotes:pipeline': [
    { icon: 'document-text', message: 'Conceptoffertes die snel worden verstuurd hebben een hogere acceptatieratio.' },
  ],
  // --- WORKFLOW: Invoices list ---
  'contractor:invoices:overdue': [
    { icon: 'warning', message: 'Verlopen facturen kosten werkkapitaal. Stuur vandaag een herinnering.' },
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
  // Site lead secondary screens
  'sitelead:daily-report:overview': [
    { icon: 'analytics', message: 'Consistent dagrapporten invullen verbetert Vasco\'s voorspellingen voor bezetting en voortgang met 40%.' },
  ],
  'sitelead:worker-certs:overview': [
    { icon: 'ribbon', message: 'Medewerkers met actuele certificeringen hebben 60% minder veiligheidsincidenten. Houd vernieuwingen bij.' },
  ],
  'sitelead:compliance:overview': [
    { icon: 'shield-checkmark', message: 'Vasco monitort automatisch certificaten en vergunningen. Items in rood vereisen directe actie.' },
  ],
  'sitelead:close-defect:overview': [
    { icon: 'construct', message: 'Gebreken die binnen 7 dagen worden opgelost kosten gemiddeld 35% minder dan gebreken die langer open staan.' },
  ],
  'sitelead:incident-report:overview': [
    { icon: 'warning', message: 'Elke melding verbetert het veiligheidspatroon. Bijna-ongelukken voorkomen 10x meer ernstige incidenten.' },
  ],
  // --- CFO ---
  'cfo:overview:overview': [
    { icon: 'bulb', message: 'De AI Financial Auditor controleert automatisch alle facturen op afwijkingen en besparingskansen.' },
  ],
  'cfo:costs:overview': [
    { icon: 'shield-checkmark', message: 'Vasco controleert automatisch alle facturen op dubbele betalingen en overbetaling.' },
  ],
  // --- CFO PROJECT HUB SCREENS ---
  'cfo:cfo-projects:overview': [
    { icon: 'analytics', message: 'Vasco analyseert je volledige portfolio — focus op projecten met de grootste afwijkingen.' },
  ],
  'cfo:cfo-costs:budget': [
    { icon: 'wallet', message: 'Projecten met CPI < 0.95 vereisen directe aandacht — kosten lopen sneller op dan verwacht.' },
  ],
  'cfo:cfo-costs:contingency': [
    { icon: 'umbrella', message: 'Contingency-verbruik dat vooruitloopt op projectvoortgang is een vroeg waarschuwingssignaal.' },
  ],
  'cfo:cfo-appraisal:overview': [
    { icon: 'trending-up', message: 'Projecten met IRR boven 20% presteren boven target — behoud de huidige strategie.' },
  ],
  'cfo:cfo-risks:overview': [
    { icon: 'shield', message: 'Risico\'s met een score ≥15 vereisen directe mitigatie — plan een review meeting deze week.' },
  ],
  'cfo:cfo-approvals:overview': [
    { icon: 'timer', message: 'Elke dag vertraging bij goedkeuringen kost gemiddeld 1 werkdag projectvertraging.' },
  ],
  // --- COO HUB SCREENS ---
  'coo:coo-schedule:overview': [
    { icon: 'analytics', message: 'De fragiliteitscore voorspelt vertragingsrisico 2 weken vooruit — hoe lager, hoe beter.' },
  ],
  // --- DIRECTOR HUB SCREENS ---
  'director:director-metrics:overview': [
    { icon: 'rocket', message: 'Vasco levert waarde door automatisering, foutpreventie en snellere incasso.' },
  ],
  'cfo:cashflow:overview': [
    { icon: 'bulb', message: 'Handovers die vastlopen vertragen betalingen. Controleer de handover status voor snellere incasso.' },
  ],
  'cfo:returns:overview': [
    { icon: 'trending-up', message: 'Projecten met actieve exit-timing analyses tonen gemiddeld 0.8% hogere IRR.' },
  ],
  // --- COO ---
  'coo:financials:overview': [
    { icon: 'analytics', message: 'Financiële afwijkingen worden automatisch gedetecteerd — focus op projecten met de grootste impact.' },
  ],
  'coo:efficiency:overview': [
    { icon: 'analytics', message: 'De fragiliteitscore voorspelt vertragingsrisico 2 weken vooruit — hoe lager, hoe beter.' },
  ],
  'coo:market:overview': [
    { icon: 'people', message: 'Vergunningsaanvragen die op tijd worden ingediend besparen gemiddeld £15K aan spoedprocedures.' },
  ],
  'coo:emerging:overview': [
    { icon: 'rocket', message: 'Leveranciers met een A/B rating leveren 95% op tijd. AI-voorspellingen helpen uitval te voorkomen.' },
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

type InlineRole = 'contractor' | 'sitelead' | 'coo' | 'cfo' | 'director';

export function useInlineInsight(role: InlineRole, screen: string, context: string): InlineInsightData | null {
  return useMemo(() => {
    const key = `${role}:${screen}:${context}`;
    const insights = INLINE_INSIGHTS[key];
    if (!insights || insights.length === 0) return null;
    // Return a consistent insight (not random) based on day of month
    const dayIndex = new Date().getDate() % insights.length;
    return insights[dayIndex];
  }, [role, screen, context]);
}
