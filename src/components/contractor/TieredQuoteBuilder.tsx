// =============================================================================
// Tiered Quote Builder — 2-step: select services → preview with Vasco insights
// =============================================================================
// Step 1: Trade-tailored pricebook + quantity controls
// Step 2: Preview tiers + Vasco AI (calibration, pricing, tips) → send
// =============================================================================

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { toTrade, type Trade } from '../../config/tradeFeatures';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { DK } from '../../theme/draftkings';
import { formatCurrency, type Country, currencySymbol } from '../../i18n/formatting';
import { Spacing, SafeArea } from '../../theme/spacing';
import type { Customer } from '../../types/contractor';
import type { TieredQuote, QuoteTier, PricebookItem } from '../../types/contractor-features';
import { MS_PER_DAY } from '../../utils/timeConstants';
import { MOCK_PRICEBOOK } from '../../data/mockPricebook';
import { usePricebook } from '../../services/pricebookService';
import { DEMO_MODE } from '../../config/demo';
import { SimilarJobsSuggest } from '../shared/SimilarJobsSuggest';
import { intelligence } from '../../intelligence/intelligenceEngine';
import { useQuoteCalibration } from '../../services/estimationFeedbackService';
import { predictPrice, type PricePrediction } from '../../intelligence/predictions';
import { predictQuoteWin, type QuoteWinPrediction } from '../../intelligence/mlModels';
import { useAuth } from '../../context/AuthContext';
import { searchCatalog, type CatalogItem } from '../../integrations/suppliers';
import { AIQuoteFromPhoto } from './AIQuoteFromPhoto';
import { consumeHandoff } from '../../services/photoQuoteHandoffService';
import { applyCohortAdjustments, type CohortAdjustmentSummary } from '../../services/pricingMoatService';
import { recordDelta, annotateDelta, type DeltaSource, type ReasonCode } from '../../services/reasonCodeService';
import { ReasonCodeSheet } from './ReasonCodeSheet';
import {
  useCohortBenchmarks,
  useContractorCalibration,
  getLineEditDistribution,
  type LineEditDistribution,
} from '../../services/cohortBenchmarkService';
import {
  useQuoteSeasonal,
  acceptanceDeltaVsBest,
} from '../../services/seasonalityMoatService';
import { useTimeOfDayHint, dayPart, classifyNow } from '../../services/timeOfDayAcceptanceService';
import { getCurrentUserId } from '../../lib/currentUser';
import { useQuoteTemplates, localizeTemplate, type QuoteTemplate, TEMPLATE_CATEGORIES } from '../../services/quoteTemplateService';
import { hapticSuccess } from '../../utils/haptics';
import { useTranslation } from 'react-i18next';
// R62: SOW (scope-of-work) generator. Three-paragraph narrative
// (Includes/Excludes/Warranty) generated from line items + tone preset
// via the generate-sow edge fn. Lives in the preview/send step so
// contractors review the prose before tapping Send.
import { generateScopeOfWork, loadQuoteTonePreset, loadToneExamples } from '../../services/sowGeneratorService';
import { useAppState } from '../../state/AppState';
import { isSmallBusinessExempt, getStandardVatRate, getReducedVatRate } from '../../domain/business';
import { localDateKey } from '../../utils/dateKey';
type IconName = keyof typeof Ionicons.glyphMap;

// =============================================================================
// DEMO-ONLY starter catalogue.
// =============================================================================
// These prices were invented — €85/uur for a leak repair, €450 for a
// groepenkast — and were served to every contractor in every country as though
// they were that contractor's own price list, then used to draft real quotes.
// A price list nobody set is worse than an empty one: it looks authoritative
// and it is nothing but a guess about someone else's business.
//
// The real catalogue is `pricebookService` (what the contractor entered). This
// table now only populates the demo accounts, so the walkthrough still has
// something to show. Gated at the constant per learnings #103.
// =============================================================================
const TRADE_PRICEBOOK: Record<string, { id: string; name: string; basePrice: number; unit: string }[]> = DEMO_MODE ? {
  plumbing: [
    { id: 'plb-1', name: 'Lekkage reparatie', basePrice: 85, unit: 'uur' },
    { id: 'plb-2', name: 'CV-ketel onderhoud', basePrice: 120, unit: 'stuk' },
    { id: 'plb-3', name: 'Radiator plaatsen', basePrice: 95, unit: 'stuk' },
    { id: 'plb-4', name: 'Badkamer sanitair', basePrice: 75, unit: 'uur' },
    { id: 'plb-5', name: 'Rioolontstopping', basePrice: 110, unit: 'stuk' },
    { id: 'plb-6', name: 'Waterleiding aanleggen', basePrice: 65, unit: 'm' },
  ],
  electrical: [
    { id: 'elc-1', name: 'Groepenkast vervangen', basePrice: 450, unit: 'stuk' },
    { id: 'elc-2', name: 'Stopcontact plaatsen', basePrice: 45, unit: 'stuk' },
    { id: 'elc-3', name: 'Bekabeling trekken', basePrice: 35, unit: 'm' },
    { id: 'elc-4', name: 'Verlichting installatie', basePrice: 55, unit: 'punt' },
    { id: 'elc-5', name: 'Periodieke keuring', basePrice: 180, unit: 'stuk' },
    { id: 'elc-6', name: 'Laadpaal installatie', basePrice: 650, unit: 'stuk' },
  ],
  gas: [
    { id: 'gas-1', name: 'Gasleiding keuring', basePrice: 150, unit: 'stuk' },
    { id: 'gas-2', name: 'CV-installatie', basePrice: 95, unit: 'uur' },
    { id: 'gas-3', name: 'Warmtepomp plaatsen', basePrice: 850, unit: 'stuk' },
    { id: 'gas-4', name: 'Vloerverwarming', basePrice: 45, unit: 'm²' },
    { id: 'gas-5', name: 'Gaslek detectie', basePrice: 120, unit: 'stuk' },
  ],
  carpentry: [
    { id: 'crp-1', name: 'Kozijn plaatsen', basePrice: 180, unit: 'stuk' },
    { id: 'crp-2', name: 'Dakkapel bouwen', basePrice: 3500, unit: 'stuk' },
    { id: 'crp-3', name: 'Trap renovatie', basePrice: 85, unit: 'uur' },
    { id: 'crp-4', name: 'Houtrot reparatie', basePrice: 65, unit: 'uur' },
    { id: 'crp-5', name: 'Vloer leggen', basePrice: 35, unit: 'm²' },
  ],
  general: [
    { id: 'gen-1', name: 'Renovatie — arbeid', basePrice: 55, unit: 'uur' },
    { id: 'gen-2', name: 'Sloopwerk', basePrice: 45, unit: 'uur' },
    { id: 'gen-3', name: 'Stucwerk', basePrice: 30, unit: 'm²' },
    { id: 'gen-4', name: 'Tegelwerk', basePrice: 40, unit: 'm²' },
    { id: 'gen-5', name: 'Transport & afvoer', basePrice: 150, unit: 'rit' },
  ],
} : {};

// Small consumables a contractor forgets to put on the quote. Typed against the
// Trade union so it cannot rot again: it had 6 of 15 trades, so a roofer or a
// solar installer silently got the GENERAL builder's list (screws and plugs)
// via the `?? general` fallback below — degraded, and nothing said so.
const TRADE_SUGGESTIONS: Record<Trade, string[]> = {
  painting: ['Afplakband', 'Grondverf', 'Schuurpapier', 'Primer'],
  plumbing: ['Teflon tape', 'Afdichtingsring', 'Soldeer', 'Koppelingen'],
  electrical: ['Krimpkous', 'Lasklemmen', 'Kabelgoot', 'Zekeringen'],
  gas: ['Gaslekzoeker', 'Afdichtpasta', 'O-ringen', 'Koperen buis'],
  carpentry: ['Schroeven', 'Houtlijm', 'Schuurpapier', 'Beits'],
  roofing: ['Loodslabben', 'Dakvorsten', 'Nokvorstklemmen', 'Dakleer'],
  tiling: ['Tegelkruisjes', 'Voegmortel', 'Kitspuit', 'Tegellijm'],
  plastering: ['Hoekprofielen', 'Wapeningsgaas', 'Voorstrijk', 'Stucnet'],
  flooring: ['Ondervloer', 'Plinten', 'Overgangsprofielen', 'Kantstroken'],
  insulation: ['Dampremmende folie', 'Tape', 'Isolatiepluggen', 'Afdichtband'],
  solar: ['Montagerail', 'Eindklemmen', 'MC4-connectoren', 'Kabelgoot'],
  glazing: ['Beglazingsrubber', 'Kit', 'Glaslatten', 'Afstandhouders'],
  landscaping: ['Split', 'Worteldoek', 'Kantopsluiting', 'Voegzand'],
  general: ['Schroeven', 'Pluggen', 'Afdekfolie', 'Siliconenkit'],
  other: ['Schroeven', 'Pluggen', 'Afdekfolie', 'Siliconenkit'],
};

const TIER_CONFIG = {
  good: { name: 'Basis', tagline: 'Standaard uitvoering', color: SemanticColors.textSecondary, icon: 'checkmark-circle-outline' as const },
  better: { name: 'Standaard', tagline: 'Meest gekozen', color: Palette.hermesOrange, icon: 'star-outline' as const },
  best: { name: 'Premium', tagline: 'Beste kwaliteit', color: '#8B5CF6', icon: 'diamond-outline' as const },
};

interface TieredQuoteBuilderProps {
  customer?: Customer;
  /**
   * Start the quote already loaded from this template. The templates screen
   * passes it through the route: its own "Use template" button used to call
   * use(id) and then show an alert saying the template was loaded, which
   * loaded nothing and went nowhere — the only working apply was the one
   * inside this builder.
   */
  initialTemplateId?: string;
  onSend: (quote: Partial<TieredQuote>) => void;
  onClose: () => void;
}

export function TieredQuoteBuilder({ customer, initialTemplateId, onSend, onClose }: TieredQuoteBuilderProps) {
  const { t } = useTranslation();
  // Was a hardcoded Dutch TRADE_LABELS map, so a German contractor's quote
  // builder was headed "Loodgieterswerk" on an otherwise fully German screen —
  // and the same string became the pricebook item `description`, which travels
  // onto a quote line. `onboarding.trades.*` already carries every slug in all
  // six locales and is what makeEntityLabels reads.
  const tradeLabel = useCallback(
    (raw: string) => t(`onboarding.trades.${raw}`, raw),
    [t],
  );
  const { user } = useAuth();
  const trade = user?.trade ?? 'general';
  const country = user?.country ?? 'NL';
  // R66r59: NL contractors qualify for 9% reduced VAT on renovation/
  // maintenance labor on residential homes >2 years old. Toggle is hidden
  // for non-NL contractors (other EU6 countries don't have a relevant
  // reduced bracket for construction labor).
  const reducedRate = getReducedVatRate(country);
  const [useReducedVat, setUseReducedVat] = useState(false);
  const [step, setStep] = useState<'select' | 'preview'>('select');
  // The contractor's own catalogue. See the tradePricebook memo below for how
  // it takes precedence over the demo starter table.
  const { entries: myPricebook } = usePricebook();
  const [selectedServices, setSelectedServices] = useState<{ item: PricebookItem; quantity: number; unit: string }[]>([]);
  const [showPricebook, setShowPricebook] = useState(false);
  // Custom (non-pricebook) service entry — lets a contractor add a one-off
  // service with their own name/price/unit (e.g. location-specific pricing)
  // instead of being limited to the standard pricebook list.
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customUnit, setCustomUnit] = useState('stuk');
  const [showAIQuote, setShowAIQuote] = useState(false);
  const [calibrationApplied, setCalibrationApplied] = useState(false);
  const [scopeText, setScopeText] = useState('');
  const [aiDrafting, setAiDrafting] = useState(false);
  // R62: SOW generator state. `scopeText` above is the search keyword that
  // drives AI service lookup in the pricebook — distinct from this 3-paragraph
  // narrative (Includes/Excludes/Warranty) generated by the SOW edge fn.
  const [sowText, setSowText] = useState('');
  const [sowLoading, setSowLoading] = useState(false);
  const [sowError, setSowError] = useState<string | null>(null);
  // R64 (audit fix #2): track the last generated prose so we can detect
  // contractor edits and confirm before overwriting them on Regenerate.
  const lastGeneratedSowRef = useRef('');
  // R64 (audit fix #11): session-scoped cache for tone examples — avoid
  // re-querying 20 rows on every Generate tap. Cleared on user logout
  // (component unmounts on logout-driven AppState reset). Null = not
  // fetched yet, [] = fetched and below threshold.
  const toneExamplesRef = useRef<string[] | null>(null);
  const { businessProfile: bp } = useAppState();
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const { templates, use: useTemplate } = useQuoteTemplates();
  const [priceSuggestion, setPriceSuggestion] = useState<PricePrediction | null>(null);
  const [winPrediction, setWinPrediction] = useState<QuoteWinPrediction | null>(null);
  const [handoffBanner, setHandoffBanner] = useState<string | null>(null);
  const { benchmarks: cohort } = useCohortBenchmarks(trade, country);
  const { calibration } = useContractorCalibration(user?.id ?? null, trade, country);
  const { bundle: seasonalBundle } = useQuoteSeasonal(trade, country);
  const { hint: timeOfDayHint, buckets: timeOfDayBuckets } = useTimeOfDayHint(trade, country);
  const [lineHints, setLineHints] = useState<Record<string, LineEditDistribution | null>>({});
  const [cohortTuneSummary, setCohortTuneSummary] = useState<CohortAdjustmentSummary | null>(null);

  // R247: cohort line-content recommender. Suggests line items that other
  // contractors in this trade × country added but the current contractor
  // hasn't yet. K-anonymity + ≥10% adoption gates surface in the RPC.
  const [lineRecommendations, setLineRecommendations] = useState<Array<{
    description: string;
    suggestedUnitPrice: number;
    recommendationRate: number;
    contractorCount: number;
  }>>([]);

  useEffect(() => {
    if (step !== 'preview' || selectedServices.length === 0) {
      setLineRecommendations([]);
      return;
    }
    let cancelled = false;
    const existing = selectedServices.map((s) => s.item.description ?? s.item.name ?? '').filter(Boolean);
    import('../../services/quoteRecommenderService').then(async (m) => {
      const recs = await m.getLineRecommendations({
        trade, country, existingDescriptions: existing, limit: 3,
      });
      if (!cancelled) setLineRecommendations(recs.map((r) => ({
        description: r.description,
        suggestedUnitPrice: r.suggestedUnitPrice,
        recommendationRate: r.recommendationRate,
        contractorCount: r.contractorCount,
      })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [step, selectedServices, trade, country]);

  // Baseline tracking for reason-code capture: records the AI-suggested
  // quantity + source for each line so we can spot contractor edits against
  // that baseline and ask "why did you change this?"
  const baselinesRef = useRef<Map<string, { originalQty: number; originalUnitPrice: number; source: DeltaSource; sku?: string; description?: string }>>(new Map());
  const lastDeltaIdsRef = useRef<Map<string, string>>(new Map());
  const [reasonSheet, setReasonSheet] = useState<{
    visible: boolean;
    itemId?: string;
    label?: string;
    originalQty?: number;
    newQty?: number;
    deltaId?: string;
  }>({ visible: false });

  // Consume a photo-quote handoff if one was stashed by the Keuzes "Draft
  // quote from these photos" flow. Prefill selectedServices so the builder
  // opens already populated.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const h = await consumeHandoff();
      if (cancelled || !h || !h.result) return;
      const items = h.result.detectedItems ?? [];
      // R190: run AI-baseline lines through the cohort tuner before showing.
      // Each line gets cohort-typical qty/price adjustments capped at ±50%,
      // blended with the contractor's own calibration offset (half weight).
      const { lines: tuned, summary } = await applyCohortAdjustments(
        items
          .filter((i) => i.selected !== false)
          .map((i) => ({
            id: i.id,
            description: i.description,
            quantity: i.suggestedQuantity,
            unitPrice: i.suggestedPrice,
          })),
        { trade, country, userId: user?.id ?? null },
      );
      if (cancelled) return;
      if (summary.linesAdjusted > 0) setCohortTuneSummary(summary);
      // Rebuild the `mapped` shape TieredQuoteBuilder expects, with the tuned
      // qty/price as the baseline the contractor sees.
      const itemsById = new Map(items.map((i) => [i.id, i]));
      const mapped = tuned.map((t) => {
        const src = itemsById.get(t.id)!;
        return {
          item: {
            id: src.id,
            name: src.description,
            description: src.category,
            basePrice: t.unitPrice,
            unit: src.unit,
            category: src.category,
          } as PricebookItem,
          quantity: t.quantity,
          unit: src.unit,
        };
      });
      if (mapped.length > 0) {
        setSelectedServices((prev) => [...prev, ...mapped]);
        // Seed baselines using the values the contractor actually sees.
        // Source tag = 'cohort' when we applied an adjustment, 'photo_handoff'
        // otherwise — preserves delta-capture attribution correctly.
        for (let i = 0; i < mapped.length; i += 1) {
          const m = mapped[i];
          const wasAdjusted = tuned[i].adjustmentApplied;
          baselinesRef.current.set(m.item.id, {
            originalQty: m.quantity,
            originalUnitPrice: m.item.basePrice,
            source: wasAdjusted ? 'cohort' : 'photo_handoff',
            sku: m.item.id,
            description: m.item.name,
          });
        }
      }
      if (h.result.jobType) setScopeText(h.result.jobType);
      setHandoffBanner(h.customerName
        ? `Prefilled from ${h.photoUrls.length} photos sent by ${h.customerName}`
        : `Prefilled from ${h.photoUrls.length} customer photos`);
    })();
    return () => { cancelled = true; };
  }, []);

  // AI predictions
  useEffect(() => {
    predictPrice({ trade, country }).then(setPriceSuggestion).catch(() => {});
  }, [trade, country]);

  // R64 (audit fix #7+11): pre-load tone examples on mount so the
  // "Trained on your last N quotes" badge can render before the first
  // Generate tap. Cached in toneExamplesRef so handleGenerateSow doesn't
  // re-fetch. Force re-render via dummy state when the result lands.
  const [, setSowTonePreloaded] = useState(0);
  useEffect(() => {
    let active = true;
    if (toneExamplesRef.current === null) {
      loadToneExamples().then((ex) => {
        if (!active) return;
        toneExamplesRef.current = ex;
        setSowTonePreloaded((n) => n + 1);
      }).catch(() => {});
    }
    return () => { active = false; };
    // Empty deps — fire once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedServices.length > 0) {
      const total = selectedServices.reduce((s, sv) => s + sv.item.basePrice * sv.quantity, 0);
      predictQuoteWin({ trade, country, amount: total }).then(setWinPrediction).catch(() => {});
    }
  }, [selectedServices.length, trade, country]);

  // R189: Fetch per-line cohort edit distribution lazily on entering preview.
  // K-anonymity ≥5 enforced server-side, so a null result just means "not
  // enough data" and the row renders without a hint. Cache keyed by the first
  // 3 tokens of the description so similar lines share the lookup.
  useEffect(() => {
    if (step !== 'preview' || selectedServices.length === 0) return;
    const tokens = (desc: string) =>
      desc.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
    const keys = Array.from(new Set(selectedServices.map(sv => tokens(sv.item.name)))).filter(k => k && !(k in lineHints));
    if (keys.length === 0) return;
    let cancelled = false;
    Promise.all(
      keys.map(key =>
        getLineEditDistribution(trade, country, key)
          .then(res => [key, res] as const)
          .catch(() => [key, null] as const),
      ),
    ).then(rows => {
      if (cancelled) return;
      setLineHints(prev => {
        const next = { ...prev };
        for (const [k, v] of rows) next[k] = v;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [step, selectedServices, trade, country, lineHints]);

  // Calibration
  const calibrationLineItems = selectedServices.map(s => ({ description: s.item.name, estimate: s.item.basePrice * s.quantity }));
  const calibrations = useQuoteCalibration(calibrationLineItems);

  // The catalogue this quote is built from. One source, used both by the
  // service picker and by the AI scope→lines matcher below, so the builder can
  // never draft from a list the picker does not show.
  //
  // The contractor's own pricebook wins whenever they have one. Only a demo
  // account with an empty book falls through to the starter table; a real
  // contractor with an empty book gets an empty list and the "add custom
  // service" path, which is honest — we do not know what they charge.
  const tradePricebook = useMemo(() => {
    if (myPricebook.length > 0) {
      return myPricebook
        .filter(e => e.isActive)
        .map(e => ({ ...e, contractorId: '' })) as unknown as PricebookItem[];
    }

    const withVariants = MOCK_PRICEBOOK.filter(i => i.variants && i.variants.length > 0);
    if (trade === 'painting' && withVariants.length > 0) return withVariants;

    const tradeItems = TRADE_PRICEBOOK[trade] ?? TRADE_PRICEBOOK.general ?? [];
    return tradeItems.map(item => ({
      ...item,
      contractorId: '',
      description: tradeLabel(trade),
      category: trade,
      pricingType: 'fixed' as const,
    })) as unknown as PricebookItem[];
  }, [trade, myPricebook]);

  const fmt = (n: number) => formatCurrency(n);

  const calculateTiers = (): QuoteTier[] => {
    return (['good', 'better', 'best'] as const).map(tierKey => {
      const multiplier = tierKey === 'good' ? 1 : tierKey === 'better' ? 1.25 : 1.55;
      let subtotal = 0;
      const features: string[] = [];
      const lineItems = selectedServices.map(service => {
        const variant = service.item.variants?.find(v => v.tier === tierKey);
        const price = variant ? variant.price : Math.round(service.item.basePrice * multiplier);
        const total = price * service.quantity;
        subtotal += total;
        if (variant) variant.features.forEach(f => { if (!features.includes(f)) features.push(f); });
        return { pricebookItemId: service.item.id, description: service.item.name, quantity: service.quantity, unit: service.unit, unitPrice: price, total, includedInTier: true };
      });
      // R66 round 38: honor vatScheme. Pre-R38 every tier was computed at
      // 21% even for KOR / Kleinunternehmer contractors — quote totals went
      // out 21% inflated and the customer expected to pay BTW that the
      // contractor isn't legally allowed to charge.
      // R66r50: country-aware standard rate (was NL-hardcoded 21).
      // R66r59: contractor-opt-in reduced rate when applicable
      //   (NL 9% for renovation labor on homes >2 years old).
      const exempt = isSmallBusinessExempt(bp);
      const effectiveVatRate = exempt
        ? 0
        : (useReducedVat && reducedRate !== null ? reducedRate : getStandardVatRate(country));
      const vatAmount = subtotal * (effectiveVatRate / 100);
      return {
        tier: tierKey, name: TIER_CONFIG[tierKey].name, tagline: TIER_CONFIG[tierKey].tagline,
        lineItems, subtotal, vatRate: effectiveVatRate, vatAmount, total: subtotal + vatAmount,
        features: features.length > 0 ? features.slice(0, 5) : [
          tierKey === 'good' ? 'Standaard materiaal' : tierKey === 'better' ? 'Kwaliteitsmateriaal' : 'Premium materiaal',
          tierKey !== 'good' ? 'Garantie 2 jaar' : 'Garantie 1 jaar',
          tierKey === 'best' ? 'Gratis nacontrole' : '',
        ].filter(Boolean),
        isRecommended: tierKey === 'better',
      };
    });
  };

  const tiers = calculateTiers();

  const addService = (item: PricebookItem) => {
    const existing = selectedServices.find(s => s.item.id === item.id);
    if (existing) {
      setSelectedServices(selectedServices.map(s => s.item.id === item.id ? { ...s, quantity: s.quantity + 1 } : s));
    } else {
      setSelectedServices([...selectedServices, { item, quantity: 1, unit: item.unit || t('quotes.unitPiece', 'piece') }]);
    }
    setShowPricebook(false);
  };

  const removeService = (itemId: string) => setSelectedServices(selectedServices.filter(s => s.item.id !== itemId));

  // Editable unit price — a standard pricebook service's price can vary per
  // location/city, so let the contractor override it on the line. Mutates a
  // copy of the item so the pricebook default is untouched.
  const updatePrice = (itemId: string, price: number) => {
    setSelectedServices(prev => prev.map(s =>
      s.item.id === itemId ? { ...s, item: { ...s.item, basePrice: Math.max(0, price) } } : s));
  };

  // Add a fully custom service (name + price + unit) that isn't in the
  // pricebook. Reuses addService so quantity/edit/remove all work the same.
  const addCustomService = () => {
    const name = customName.trim();
    const price = parseFloat(customPrice.replace(',', '.'));
    if (!name || !price || price <= 0) {
      Alert.alert(
        t('quotes.customServiceInvalidTitle', 'Add a name and price'),
        t('quotes.customServiceInvalidBody', 'Enter a service name and a price greater than zero.'),
      );
      return;
    }
    const item = {
      id: `custom-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      contractorId: user?.id ?? 'demo',
      name,
      description: name,
      category: (trade === 'painting' ? 'painting' : 'repairs') as PricebookItem['category'],
      pricingType: 'per-unit' as const,
      basePrice: price,
      unit: customUnit.trim() || 'stuk',
    } as PricebookItem;
    addService(item);
    setCustomName(''); setCustomPrice(''); setCustomUnit('stuk');
  };

  const updateQuantity = (itemId: string, qty: number) => {
    if (qty <= 0) { removeService(itemId); return; }
    setSelectedServices(selectedServices.map(s => s.item.id === itemId ? { ...s, quantity: qty } : s));

    // Learning signal: if this line had a baseline and the quantity is now
    // noticeably different (±1 or ±5%), record a delta + prompt for the
    // reason. Only ask once per line per session to avoid nagging.
    const baseline = baselinesRef.current.get(itemId);
    if (!baseline) return;
    const changedMeaningfully =
      Math.abs(qty - baseline.originalQty) >= 1 ||
      Math.abs(qty - baseline.originalQty) / Math.max(1, baseline.originalQty) >= 0.05;
    if (!changedMeaningfully) return;
    if (lastDeltaIdsRef.current.has(itemId)) return; // already asked

    const svc = selectedServices.find(s => s.item.id === itemId);
    const label = svc?.item.name ?? baseline.description ?? itemId;

    recordDelta({
      lineItemId: itemId,
      sku: baseline.sku,
      description: baseline.description ?? label,
      originalQty: baseline.originalQty,
      newQty: qty,
      originalUnitPrice: baseline.originalUnitPrice,
      newUnitPrice: svc?.item.basePrice,
      source: baseline.source,
      trade,
      country,
    }).then((deltaId) => {
      lastDeltaIdsRef.current.set(itemId, deltaId);
      setReasonSheet({
        visible: true,
        itemId,
        label,
        originalQty: baseline.originalQty,
        newQty: qty,
        deltaId,
      });
    }).catch(() => {});
  };

  const loadTemplate = (template: QuoteTemplate) => {
    useTemplate(template.id);
    // R187: surface localized item descriptions in the quote so e.g. a French
    // contractor loading the "boiler maintenance" template gets French line
    // items, not the Dutch seed strings.
    const localized = localizeTemplate(template, t);
    const mapped = localized.displayItems.map((item, idx) => ({
      item: { id: `tpl-${template.id}-${idx}`, contractorId: '', name: item.description, description: `${localized.displayName}`, category: item.type === 'labour' ? 'labour' : 'materials', pricingType: 'fixed', basePrice: item.unitPrice, unit: item.unit } as unknown as PricebookItem,
      quantity: item.quantity, unit: item.unit,
    }));
    setSelectedServices(mapped);
    for (const m of mapped) {
      baselinesRef.current.set(m.item.id, {
        originalQty: m.quantity, originalUnitPrice: m.item.basePrice,
        source: 'template', sku: m.item.id, description: m.item.name,
      });
    }
    hapticSuccess();
  };

  // Apply a template chosen on the templates screen. Templates hydrate from
  // AsyncStorage, so the list is empty on the first render and this has to wait
  // for it rather than run on mount. The ref keeps it to once — re-running
  // would wipe edits the contractor made after it loaded.
  const appliedTemplateRef = useRef(false);
  useEffect(() => {
    if (!initialTemplateId || appliedTemplateRef.current) return;
    const tpl = templates.find((x) => x.id === initialTemplateId);
    if (!tpl) return;
    appliedTemplateRef.current = true;
    loadTemplate(tpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplateId, templates]);

  // Levenshtein distance for fuzzy matching misspelled scope words
  const levenshtein = (a: string, b: string): number => {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      }
    }
    return dp[m][n];
  };

  // Re-use a past job: user typed a description → pgvector matched a similar
  // completed job. Prefill the scope with that job's title so handleAIDraft
  // can do the rest of the work.
  const handlePickSimilarJob = (jobId: string) => {
    const existing = tradePricebook.find((pb) => pb.id === jobId);
    if (existing?.name) {
      setScopeText((prev) => prev ? `${prev} · ${existing.name}` : existing.name);
    }
  };

  // AI scope → line items: parse natural language into pricebook items
  const handleAIDraft = () => {
    if (!scopeText.trim() || aiDrafting) return;
    setAiDrafting(true);
    // Match scope words against trade pricebook items (fully case-insensitive)
    const words = scopeText.toLowerCase().split(/[\s,.\-;:]+/).filter(w => w.length > 2);
    // Draft from the same catalogue the picker shows — the contractor's own
    // pricebook when they have one. Previously this matched against the
    // invented TRADE_PRICEBOOK regardless, so the AI could put a service the
    // contractor does not offer, at a price they never set, onto a real quote.
    const tradeItems = tradePricebook;
    const allItems = tradeItems;
    const matched: { item: PricebookItem; quantity: number; unit: string; score: number }[] = [];
    const usedIds = new Set(selectedServices.map(s => s.item.id));

    for (const item of allItems) {
      if (usedIds.has(item.id)) continue;
      const itemWords = item.name.toLowerCase().split(/[\s\-]+/);
      // Exact substring match (case-insensitive)
      let score = words.filter(w => itemWords.some(iw => iw.includes(w) || w.includes(iw))).length;
      // Fuzzy match: if no exact match, check Levenshtein distance <= 2 for words with 4+ chars
      if (score === 0) {
        const fuzzyScore = words.filter(w =>
          w.length >= 4 && itemWords.some(iw => iw.length >= 4 && levenshtein(w, iw) <= 2)
        ).length;
        score = fuzzyScore * 0.5; // Lower weight for fuzzy matches
      }
      if (score > 0) {
        matched.push({
          // Used as-is: overwriting pricingType with 'fixed' turned a real
          // per-unit service (€20/m²) into a flat €20 line on the quote.
          item,
          quantity: 1,
          // A fixed-price service legitimately has no unit ("€95 to service the
          // boiler"), so fall back to the same translated default the picker uses.
          unit: item.unit || t('quotes.unitPiece', 'piece'),
          score,
        });
        usedIds.add(item.id);
      }
    }

    // Sort by score descending — best matches first
    matched.sort((a, b) => b.score - a.score);

    // If no matches AND no fallback items available, show user-friendly message
    if (matched.length === 0) {
      const availableFallbacks = tradeItems.filter(item => !usedIds.has(item.id));
      if (availableFallbacks.length === 0) {
        setTimeout(() => {
          setAiDrafting(false);
          Alert.alert(
            t('quotes.noMatches', 'No matches'),
            t('quotes.noServicesFoundFor', 'No services found for "{{scope}}". Add services manually via the price list.', { scope: scopeText }),
            [{ text: 'OK' }],
          );
        }, 600);
        return;
      }
      // Suggest top 3 items from trade pricebook as fallback
      for (const item of availableFallbacks.slice(0, 3)) {
        matched.push({
          // Used as-is: overwriting pricingType with 'fixed' turned a real
          // per-unit service (€20/m²) into a flat €20 line on the quote.
          item,
          quantity: 1,
          // A fixed-price service legitimately has no unit ("€95 to service the
          // boiler"), so fall back to the same translated default the picker uses.
          unit: item.unit || t('quotes.unitPiece', 'piece'),
          score: 0,
        });
      }
    }

    // Estimate quantities from scope text (look for numbers)
    const numbers = scopeText.match(/\d+/g);
    if (numbers && matched.length > 0) {
      const qty = parseInt(numbers[0], 10);
      if (qty > 0 && qty <= 100) matched[0].quantity = qty;
    }

    // Generate explanations for each suggested item
    const explanations: Record<string, string> = {};
    for (const m of matched) {
      const matchedWords = words.filter(w =>
        m.item.name.toLowerCase().split(/[\s\-]+/).some((iw: string) => iw.includes(w) || w.includes(iw))
      );
      const fuzzyWords = matchedWords.length === 0 ? words.filter(w =>
        w.length >= 4 && m.item.name.toLowerCase().split(/[\s\-]+/).some((iw: string) => iw.length >= 4 && levenshtein(w, iw) <= 2)
      ) : [];
      // "Standard rate" was a claim we could not support: the price comes from
      // the contractor's own pricebook, not from any industry standard. Naming
      // it as theirs is both true and more useful \u2014 it tells them which entry
      // to edit if the number is wrong.
      const rate = `${formatCurrency(m.item.basePrice, country)}/${m.unit}`;
      if (matchedWords.length > 0) {
        explanations[m.item.id] = t('quotes.aiMatchExact', 'Matched "{{words}}" from your description. Your price: {{rate}}.', { words: matchedWords.join(', '), rate });
      } else if (fuzzyWords.length > 0) {
        explanations[m.item.id] = t('quotes.aiMatchFuzzy', 'Close match for "{{words}}". Your price: {{rate}}.', { words: fuzzyWords.join(', '), rate });
      } else {
        explanations[m.item.id] = t('quotes.aiMatchFallback', 'From your pricebook \u2014 {{rate}}. Not matched to your description, so check it belongs here.', { rate });
      }
    }

    // Strip the score before adding to selectedServices
    const matchedClean = matched.map(({ score: _score, ...rest }) => rest);

    // Ask the ML duration predictor to refine the rough quantity for each new
    // line item. Fire-and-forget — falls back to the matched quantity on
    // any failure so the UX never stalls.
    import('../../services/mlPrefillService').then(async (mod) => {
      const refined = await Promise.all(matchedClean.map(async (svc) => {
        try {
          const hours = await mod.prefillDurationForLine({
            trade,
            description: svc.item.name,
            quantity: svc.quantity,
          });
          // Only override when the predictor came back with a reasonable value
          return hours > 0 && hours < 24 ? { ...svc, quantity: hours } : svc;
        } catch { return svc; }
      }));
      setSelectedServices(prev => [...prev, ...refined]);
      for (const m of refined) {
        baselinesRef.current.set(m.item.id, {
          originalQty: m.quantity, originalUnitPrice: m.item.basePrice,
          source: 'ai_draft', sku: m.item.id, description: m.item.name,
        });
      }
    }).catch(() => {
      setSelectedServices(prev => [...prev, ...matchedClean]);
      for (const m of matchedClean) {
        baselinesRef.current.set(m.item.id, {
          originalQty: m.quantity, originalUnitPrice: m.item.basePrice,
          source: 'ai_draft', sku: m.item.id, description: m.item.name,
        });
      }
    });

    setTimeout(() => {
      setAiExplanations(prev => ({ ...prev, ...explanations }));
      setScopeText('');
      setAiDrafting(false);
      hapticSuccess();
    }, 600); // Brief delay for AI feel
  };

  // R62: SOW generation. Pulls tone preset from business_settings, fans
  // out the standard tier line items + customer + trade context to the
  // generate-sow edge fn, persists the result locally for in-component
  // edit. Caller (parent screen) is responsible for writing sowText back
  // to documents.scope_text via updateDocument once the quote is sent —
  // we don't write here because the quote may not yet have a doc id.
  const handleGenerateSow = async () => {
    if (selectedServices.length === 0) return;
    // R64 (audit fix #2): if there's existing prose AND the contractor
    // has edited it since the last generation, confirm before overwrite.
    // Pure-regenerate (no edits) skips the prompt — most common case.
    if (sowText.trim() && sowText !== lastGeneratedSowRef.current) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          t('quotes.scopeRegenerateConfirmTitle', 'Replace your edits?'),
          t(
            'quotes.scopeRegenerateConfirmDesc',
            'You\'ve edited the scope. Regenerating will replace your text with a fresh AI version.',
          ),
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('quotes.scopeRegenerate', 'Regenerate'), style: 'destructive', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      });
      if (!confirmed) return;
    }
    setSowLoading(true);
    setSowError(null);
    try {
      // R63 / D3: tone preset + accepted-quote excerpts.
      // R64 (audit fix #11): tone examples cached per-session (ref, not
      // state — no re-render churn). First Generate fetches; later taps
      // reuse. Cleared with the component on logout-driven AppState reset.
      const tone = await loadQuoteTonePreset();
      let toneExamples: string[];
      if (toneExamplesRef.current !== null) {
        toneExamples = toneExamplesRef.current;
      } else {
        toneExamples = await loadToneExamples();
        toneExamplesRef.current = toneExamples;
      }
      const standardTier = tiers[1]; // 'better' / Standard tier
      const result = await generateScopeOfWork({
        lineItems: (standardTier.lineItems ?? []).map((l: { description: string; quantity?: number; unit?: string; unitPrice?: number }) => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
        })),
        trade: bp?.trade ?? undefined,
        jobTitle: scopeText.trim() || undefined,
        customerName: customer?.name,
        businessName: bp?.businessName ?? undefined,
        tone,
        toneExamples,
      });
      if (result.ok && result.scopeText) {
        setSowText(result.scopeText);
        // R64 (audit fix #2): remember pristine model output so the next
        // Regenerate can compare against contractor edits.
        lastGeneratedSowRef.current = result.scopeText;
        hapticSuccess();
      } else {
        setSowError(result.error ?? 'Could not generate scope');
      }
    } catch (err) {
      setSowError(err instanceof Error ? err.message : String(err));
    } finally {
      setSowLoading(false);
    }
  };

  const handleSend = () => {
    if (selectedServices.length === 0) return;
    // R66 round 26: soft customer prompt. R18 closed the data-corruption
    // hole (non-uuid customer args now NULL out customer_id), but the UX
    // gap remained — contractors could send a quote with no customer
    // attached and end up with orphan rows that need manual association
    // later. Prompt before sending if no customer is set; let them either
    // back out or proceed knowingly.
    const proceed = () => {
      const quote: Partial<TieredQuote> = {
        reference: `TQ-${Date.now()}`, title: 'Offerte', tiers,
        validUntil: localDateKey(new Date(Date.now() + 30 * MS_PER_DAY)),
        paymentTerms: '30% aanbetaling, 70% bij oplevering', status: 'sent',
        // R62: SOW narrative threaded as the quote description. Parent
        // screen persists this to documents.scope_text on save (R57's
        // updateDocument dual-route handles both uuid + docNumber forms).
        description: sowText.trim() || undefined,
      };
      intelligence.trackEvent({
        eventType: 'quote_sent', userId: getCurrentUserId(), sessionId: 'current',
        context: { platform: 'ios', appVersion: '1.0.0', dayOfWeek: new Date().getDay(), hourOfDay: new Date().getHours(), isWeekend: [0, 6].includes(new Date().getDay()), season: 'winter' },
        payload: { quoteReference: quote.reference, tierCount: 3, goodTotal: tiers[0].total, betterTotal: tiers[1].total, bestTotal: tiers[2].total, serviceCount: selectedServices.length, customerId: customer?.id },
        entities: customer ? [{ id: customer.id, type: 'customer', name: customer.name, confidence: 1.0 }] : [],
      });
      onSend(quote);
      // R64 (audit fix #3): reset SOW state — was bleeding across quotes
      // (contractor sends quote A, starts quote B with A's SOW still in the
      // builder). R66 round 26: moved into proceed() so both customer-attached
      // and "Send anyway" paths do the cleanup; previously only the
      // customer-attached path reset (Alert dispatched proceed asynchronously).
      setSowText('');
      setSowError(null);
    };

    if (!customer) {
      Alert.alert(
        t('tieredQuote.noCustomerTitle', 'No customer attached'),
        t('tieredQuote.noCustomerBody', 'This quote will be saved without a customer link. You can attach one from the customer list later.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('tieredQuote.sendAnyway', 'Send anyway'), onPress: proceed },
        ],
      );
      return;
    }
    proceed();
  };

  // =========================================================================
  // STEP 1: SELECT SERVICES
  // =========================================================================
  if (showPricebook) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Pressable onPress={() => setShowPricebook(false)} style={s.closeBtn}>
            <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{t('quotes.addServices', 'Add services')}</Text>
            <Text style={s.headerSub}>{tradeLabel(trade)}</Text>
          </View>
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Custom service — add a one-off service not in the pricebook */}
          <View style={s.customCard}>
            <Text style={s.customTitle}>{t('quotes.addCustomService', 'Add a custom service')}</Text>
            <TextInput
              style={s.customInput}
              value={customName}
              onChangeText={setCustomName}
              placeholder={t('quotes.customServiceName', 'Service name')}
              placeholderTextColor={SemanticColors.textTertiary}
            />
            <View style={s.customRow}>
              <TextInput
                style={[s.customInput, { flex: 1 }]}
                value={customPrice}
                onChangeText={setCustomPrice}
                placeholder={t('quotes.customServicePrice', 'Price ({{sym}})', { sym: currencySymbol(country) })}
                placeholderTextColor={SemanticColors.textTertiary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[s.customInput, { width: 96 }]}
                value={customUnit}
                onChangeText={setCustomUnit}
                placeholder={t('quotes.customServiceUnit', 'Unit')}
                placeholderTextColor={SemanticColors.textTertiary}
              />
            </View>
            <Pressable style={s.customAddBtn} onPress={addCustomService} accessibilityRole="button">
              <Ionicons name="add-circle" size={18} color={Palette.white} />
              <Text style={s.customAddBtnText}>{t('quotes.addService', 'Add service')}</Text>
            </Pressable>
          </View>
          <Text style={s.pbSectionLabel}>{t('quotes.orFromPricebook', 'Or pick from your pricebook')}</Text>
          {tradePricebook.map(item => {
            const isSelected = selectedServices.some(sv => sv.item.id === item.id);
            return (
              <Pressable key={item.id} style={[s.pbItem, isSelected && s.pbItemSelected]} onPress={() => addService(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pbName}>{item.name}</Text>
                  <Text style={s.pbPrice}>{fmt(item.basePrice)}/{item.unit || t('quotes.unitPiece', 'piece')}</Text>
                </View>
                <Ionicons name={isSelected ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={isSelected ? SemanticColors.feedbackSuccess : Palette.hermesOrange} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (step === 'select') {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={SemanticColors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{t('quotes.newQuote', 'New quote')}</Text>
            {customer && <Text style={s.headerSub}>{customer.name}</Text>}
          </View>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Handoff banner — customer sent photos, quote is prefilled */}
          {handoffBanner && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: GRID.xs, backgroundColor: Palette.hermesOrange + '10', borderRadius: RADIUS.md, padding: GRID.sm, marginBottom: GRID.sm }}>
              <Ionicons name="sparkles" size={14} color={Palette.hermesOrange} />
              <Text style={{ flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange }}>{handoffBanner}</Text>
              <Pressable onPress={() => setHandoffBanner(null)} hitSlop={8}>
                <Ionicons name="close" size={14} color={Palette.hermesOrange} />
              </Pressable>
            </View>
          )}

          {/* R190: cohort-tune badge — only surfaces when the moat actually
              adjusted something the contractor is about to see. */}
          {cohortTuneSummary && cohortTuneSummary.linesAdjusted > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: GRID.xs, backgroundColor: SemanticColors.feedbackSuccess + '12', borderRadius: RADIUS.md, padding: GRID.sm, marginBottom: GRID.sm }}>
              <Ionicons name="trending-up" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={{ flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.feedbackSuccess }}>
                {t('quotes.cohortTuned', 'Vasco tuned {{lines}} of {{total}} lines from {{contractors}} cohort decisions', {
                  lines: cohortTuneSummary.linesAdjusted,
                  total: cohortTuneSummary.totalLines,
                  contractors: cohortTuneSummary.totalCohortContractors,
                })}
              </Text>
              <Pressable onPress={() => setCohortTuneSummary(null)} hitSlop={8}>
                <Ionicons name="close" size={14} color={SemanticColors.feedbackSuccess} />
              </Pressable>
            </View>
          )}

          {/* R247: cohort line recommender — "contractors with similar quotes also added X" */}
          {lineRecommendations.length > 0 && (
            <View style={{ backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: GRID.sm, marginBottom: GRID.sm, gap: GRID.xs }}>
              <Text style={{ fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('quotes.cohortRecommendations', 'Contractors also added')}
              </Text>
              {lineRecommendations.map((rec, idx) => (
                <Pressable
                  key={`${rec.description}-${idx}`}
                  onPress={() => {
                    const newItem: any = {
                      item: { id: `cohort-${idx}-${Date.now()}`, name: rec.description, description: rec.description, unitPrice: rec.suggestedUnitPrice },
                      quantity: 1,
                      unit: 'piece',
                    };
                    setSelectedServices((prev) => [...prev, newItem]);
                    setLineRecommendations((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: GRID.xs, gap: GRID.sm }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={Palette.hermesOrange} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary }}>{rec.description}</Text>
                    <Text style={{ fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary }}>
                      {formatCurrency(rec.suggestedUnitPrice, country as Country)} · {Math.round(rec.recommendationRate * 100)}% van vergelijkbare offertes · {rec.contractorCount} aannemers
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* AI Draft — describe scope → get line items */}
          <View style={s.aiDraftSection}>
            <View style={s.aiDraftInputRow}>
              <Ionicons name="flash" size={16} color={Palette.hermesOrange} />
              <TextInput
                style={s.aiDraftInput}
                value={scopeText}
                onChangeText={setScopeText}
                placeholder={t('quotes.scopePlaceholder', 'Describe the job scope…')}
                placeholderTextColor={SemanticColors.textTertiary}
                returnKeyType="send"
                onSubmitEditing={handleAIDraft}
                editable={!aiDrafting}
              />
              {aiDrafting ? (
                <ActivityIndicator size="small" color={Palette.hermesOrange} />
              ) : scopeText.trim() ? (
                <Pressable onPress={handleAIDraft} hitSlop={8}>
                  <Ionicons name="arrow-forward-circle" size={24} color={Palette.hermesOrange} />
                </Pressable>
              ) : null}
            </View>
            <Pressable testID="ai-scan-row" style={s.aiScanRow} onPress={async () => {
              // R307: tier gate — photo-to-quote AI is paid-tier (same class
              // as ReceiptScanner R307 gate on inkoop). Was completely ungated.
              try {
                const { loadSubscription, canUseFeature } = await import('../../services/subscriptionService');
                const sub = await loadSubscription();
                const gate = canUseFeature(sub, 'hasInvoiceScanning');
                if (!gate.allowed) {
                  Alert.alert(
                    t('billing.upgradeRequired', 'Upgrade required'),
                    gate.reason ?? t('quotes.aiQuoteUpgradeRequired', 'AI photo-to-quote is part of the paid plan.'),
                  );
                  return;
                }
              } catch {}
              setShowAIQuote(true);
            }}>
              <Ionicons name="camera" size={16} color={Palette.hermesOrange} />
              <Text style={s.aiScanText}>{t('quotes.orScanPhoto', 'Or scan a photo')}</Text>
              <Ionicons name="chevron-forward" size={14} color={SemanticColors.textTertiary} />
            </Pressable>
            <SimilarJobsSuggest query={scopeText} onPickJob={handlePickSimilarJob} />
          </View>

          {/* Services section */}
          <View style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.sectionTitle}>{tradeLabel(trade)}</Text>
              <Pressable style={s.addBtn} onPress={() => setShowPricebook(true)}>
                <Ionicons name="add" size={16} color={Palette.hermesOrange} />
                <Text style={s.addBtnText}>{t('common.add', 'Add')}</Text>
              </Pressable>
            </View>

            {selectedServices.length > 0 ? (
              <View style={s.serviceList}>
                {selectedServices.map(sv => (
                  <View key={sv.item.id} style={s.serviceRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.serviceName}>{sv.item.name}</Text>
                      {/* Editable unit price — tap to adjust for this quote */}
                      <View style={s.priceEditRow}>
                        <Text style={s.servicePrice}>€</Text>
                        <TextInput
                          style={s.priceInput}
                          value={String(sv.item.basePrice)}
                          onChangeText={(txt) => updatePrice(sv.item.id, parseFloat(txt.replace(',', '.')) || 0)}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          accessibilityLabel={t('quotes.editPrice', 'Edit price')}
                        />
                        <Text style={s.servicePrice}>/{sv.unit}</Text>
                      </View>
                      {aiExplanations[sv.item.id] && (
                        <View style={s.aiExplanation}>
                          <Ionicons name="flash" size={10} color={Palette.hermesOrange} />
                          <Text style={s.aiExplanationText}>{aiExplanations[sv.item.id]}</Text>
                        </View>
                      )}
                    </View>
                    <View style={s.qtyRow}>
                      <Pressable style={s.qtyBtn} onPress={() => updateQuantity(sv.item.id, sv.quantity - 1)}>
                        <Ionicons name="remove" size={14} color={SemanticColors.textPrimary} />
                      </Pressable>
                      <Text style={s.qtyText}>{sv.quantity}</Text>
                      <Pressable style={s.qtyBtn} onPress={() => updateQuantity(sv.item.id, sv.quantity + 1)}>
                        <Ionicons name="add" size={14} color={SemanticColors.textPrimary} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <>
                {/* Templates */}
                {templates.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text style={s.templateLabel}>{t('quotes.orFromTemplate', 'Or start from template:')}</Text>
                    {templates.slice(0, 3).map(tpl => {
                      const ltpl = localizeTemplate(tpl, t);
                      return (
                        <Pressable key={tpl.id} style={s.templateRow} onPress={() => loadTemplate(tpl)}>
                          <Ionicons name="copy-outline" size={16} color={Palette.hermesOrange} />
                          <Text style={s.templateName}>{ltpl.displayName}</Text>
                          <Text style={s.templateMeta}>{t('quotes.lineCount', '{{count}} lines', { count: tpl.items.length })}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <Pressable style={s.emptyBox} onPress={() => setShowPricebook(true)}>
                  <Ionicons name="document-text-outline" size={28} color={SemanticColors.textTertiary} />
                  <Text style={s.emptyText}>{t('quotes.pickFromPricebook', 'Pick services from your pricebook')}</Text>
                </Pressable>
              </>
            )}

            {/* Trade-specific suggestions */}
            {selectedServices.length > 0 && (
              <View style={s.suggestRow}>
                <Ionicons name="bulb-outline" size={14} color={SemanticColors.textTertiary} />
                <Text style={s.suggestLabel}>{t('quotes.forgotten', 'Forgot something?')}</Text>
                {TRADE_SUGGESTIONS[toTrade(trade)].slice(0, 3).map(item => (
                  <View key={item} style={s.suggestChip}>
                    <Text style={s.suggestChipText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom: go to preview */}
        {selectedServices.length > 0 && (
          <View style={s.bottom}>
            <Text style={s.bottomSummary}>{t('quotes.bottomSummary', '{{count}} services · {{total}} (standard)', { count: selectedServices.length, total: fmt(tiers[1].total) })}</Text>
            <Pressable style={s.nextBtn} onPress={() => { hapticSuccess(); setStep('preview'); }}>
              <Text style={s.nextBtnText}>{t('quotes.reviewQuote', 'Review quote')}</Text>
              <Ionicons name="arrow-forward" size={18} color={Palette.white} />
            </Pressable>
          </View>
        )}

        {/* AI Quote Modal */}
        <Modal visible={showAIQuote} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAIQuote(false)}>
          <AIQuoteFromPhoto
            onCreateQuote={(items) => {
              const mapped = items.filter(i => i.selected).map(item => ({
                item: { id: item.id, name: item.description, description: item.category, basePrice: item.suggestedPrice, unit: item.unit, category: item.category } as PricebookItem,
                quantity: item.suggestedQuantity, unit: item.unit,
              }));
              setSelectedServices(prev => [...prev, ...mapped]);
              for (const m of mapped) {
                baselinesRef.current.set(m.item.id, {
                  originalQty: m.quantity, originalUnitPrice: m.item.basePrice,
                  source: 'ai_draft', sku: m.item.id, description: m.item.name,
                });
              }
              setShowAIQuote(false);
            }}
            onClose={() => setShowAIQuote(false)}
          />
        </Modal>

        {/* Reason-code sheet — fires after edits to AI-prefilled lines */}
        <ReasonCodeSheet
          visible={reasonSheet.visible}
          lineLabel={reasonSheet.label}
          originalQty={reasonSheet.originalQty}
          newQty={reasonSheet.newQty}
          onDismiss={() => setReasonSheet({ visible: false })}
          onPick={(code: ReasonCode, freeText?: string) => {
            if (reasonSheet.deltaId) {
              annotateDelta(reasonSheet.deltaId, code, freeText).catch(() => {});
            }
            setReasonSheet({ visible: false });
          }}
        />
      </View>
    );
  }

  // =========================================================================
  // STEP 2: PREVIEW — Vasco insights inline before sending
  // =========================================================================
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => setStep('select')} style={s.closeBtn}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('quotes.checkQuote', 'Check quote')}</Text>
          {customer && <Text style={s.headerSub}>{customer.name}</Text>}
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Vasco insights — inline in preview (not cluttering build step) */}
        <View style={s.vascoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="flash" size={16} color={Palette.hermesOrange} />
            <Text style={s.vascoTitle}>{t('quotes.vascoAdvice', 'Vasco advice')}</Text>
          </View>

          {/* Calibration */}
          {calibrations.length > 0 && !calibrationApplied && (
            <View style={s.vascoRow}>
              <Text style={s.vascoText}>
                {t('quotes.calibrationLine', 'Based on {{count}} prior jobs: hours {{adjustment}}', {
                  count: calibrations[0]?.basedOnJobCount || 0,
                  adjustment: calibrations.some(c => c.combinedMultiplier > 1)
                    ? `+${Math.round((Math.max(...calibrations.map(c => c.combinedMultiplier)) - 1) * 100)}%`
                    : t('quotes.onSchedule', 'on schedule'),
                })}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable style={s.vascoApply} onPress={() => {
                  setSelectedServices(prev => prev.map((sv, idx) => {
                    const cal = calibrations[idx];
                    return cal && cal.combinedMultiplier > 1 ? { ...sv, quantity: Math.ceil(sv.quantity * cal.combinedMultiplier) } : sv;
                  }));
                  setCalibrationApplied(true);
                }}>
                  <Text style={s.vascoApplyText}>{t('common.apply', 'Apply')}</Text>
                </Pressable>
                <Pressable style={s.vascoSkip} onPress={() => setCalibrationApplied(true)}>
                  <Text style={s.vascoSkipText}>{t('common.ignore', 'Ignore')}</Text>
                </Pressable>
              </View>
            </View>
          )}
          {calibrationApplied && calibrations.length > 0 && (
            <View style={s.vascoRow}>
              <Ionicons name="checkmark-circle" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={[s.vascoText, { color: SemanticColors.feedbackSuccess }]}>{t('quotes.calibrationApplied', 'Calibration applied')}</Text>
            </View>
          )}

          {/* Pricing advice */}
          {priceSuggestion && (priceSuggestion.suggestedPrice ?? 0) > 0 && (
            <View style={s.vascoRow}>
              <Text style={s.vascoText}>
                {t('quotes.priceAdvice', 'Recommended hourly rate: {{rate}} · Acceptance rate: {{rate2}}%', {
                  rate: fmt(priceSuggestion.suggestedPrice ?? 0),
                  rate2: Math.round((priceSuggestion.acceptanceRate ?? 0) * 100),
                })}
              </Text>
            </View>
          )}

          {/* Win probability + explanation */}
          {winPrediction && (
            <View style={s.vascoRow}>
              <Text style={s.vascoText}>
                {t('quotes.winChance', 'Win chance:')}{' '}
                <Text style={{ color: winPrediction.probability >= 0.7 ? SemanticColors.feedbackSuccess : winPrediction.probability >= 0.5 ? SemanticColors.feedbackWarning : SemanticColors.feedbackError, fontFamily: TYPE.titleFamily }}>
                  {Math.round(winPrediction.probability * 100)}%
                </Text>
              </Text>
              <Text style={s.vascoExplain}>{winPrediction.recommendation}</Text>
            </View>
          )}

          {/* Cross-contractor cohort benchmark (k-anonymity >=5 enforced server-side) */}
          {(() => {
            const tb = cohort?.tradeBenchmarks?.find(b => b.trade === trade && b.country === country);
            if (!tb || tb.sampleSize < 1) return null;
            return (
              <View style={s.vascoRow}>
                <Text style={s.vascoText}>
                  {t('quotes.cohortBenchmark', 'Similar {{trade}} jobs in {{country}}:', { trade, country })}{' '}
                  <Text style={{ fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary }}>
                    {fmt(tb.medianHourlyRate)}/u
                  </Text>
                  {tb.avgQuoteAcceptanceRate > 0 && (
                    <Text style={s.vascoText}>
                      {' · '}{Math.round(tb.avgQuoteAcceptanceRate * 100)}% {t('quotes.cohortAcceptance', 'accept')}
                    </Text>
                  )}
                </Text>
                <Text style={s.vascoExplain}>
                  {t('quotes.cohortSample', 'Based on {{count}} quotes from {{contractors}} contractors', {
                    count: tb.sampleSize,
                    contractors: cohort?.contractorsInCohort ?? 0,
                  })}
                </Text>
              </View>
            );
          })()}

          {/* Time-of-day acceptance hint (R260) + contextual now-tone (R262). */}
          {timeOfDayHint && (() => {
            const dows = [
              t('quotes.todSun', 'Sunday'),
              t('quotes.todMon', 'Monday'),
              t('quotes.todTue', 'Tuesday'),
              t('quotes.todWed', 'Wednesday'),
              t('quotes.todThu', 'Thursday'),
              t('quotes.todFri', 'Friday'),
              t('quotes.todSat', 'Saturday'),
            ];
            const bestPartKey = `quotes.todPart_${dayPart(timeOfDayHint.bestBucket.hourOfDay)}`;
            const bestPartFallback = dayPart(timeOfDayHint.bestBucket.hourOfDay);
            const bestDay = dows[timeOfDayHint.bestBucket.dayOfWeek] ?? '';
            const bestPart = t(bestPartKey, bestPartFallback);
            const bestLift = Math.round(timeOfDayHint.liftPoints * 100);

            const now = new Date();
            const nowTone = classifyNow(timeOfDayBuckets, now.getHours(), now.getDay());
            const liftVsNow = Math.round(nowTone.liftVsNow * 100);

            const headline = nowTone.tone === 'send_later' && liftVsNow > 0
              ? t('quotes.todHintWait', 'Waiting until {{day}} {{part}} → {{lift}}pp higher acceptance', {
                  day: bestDay, part: bestPart, lift: liftVsNow,
                })
              : nowTone.tone === 'send_now'
                ? t('quotes.todHintNow', 'Good time to send — {{day}} {{part}} is the peak slot', {
                    day: bestDay, part: bestPart,
                  })
                : t('quotes.todHint', 'Best time to send: {{day}} {{part}} — {{lift}}pp higher acceptance', {
                    day: bestDay, part: bestPart, lift: bestLift,
                  });

            return (
              <View style={s.vascoRow}>
                <Text style={s.vascoText}>{headline}</Text>
                <Text style={s.vascoExplain}>
                  {t('quotes.todSample', 'Across {{count}} quotes from peers in {{country}}', {
                    count: timeOfDayHint.totalSamples,
                    country,
                  })}
                </Text>
              </View>
            );
          })()}

          {/* Personalized calibration — your pricing vs cohort (R188). Only
              shown when >=5 own samples + cohort >= k-anonymity gate. */}
          {calibration && calibration.medianPriceVsCohortPct !== null && calibration.confidence >= 0.3 && (
            <View style={s.vascoRow}>
              {(() => {
                const pricePct = calibration.medianPriceVsCohortPct ?? 0;
                const acceptPp = calibration.acceptanceRateVsCohortPct ?? 0;
                const priceAbove = pricePct >= 0;
                const acceptAbove = acceptPp >= 0;
                const priceColor = Math.abs(pricePct) < 5
                  ? SemanticColors.textPrimary
                  : (priceAbove ? SemanticColors.feedbackWarning : SemanticColors.feedbackSuccess);
                return (
                  <>
                    <Text style={s.vascoText}>
                      {t('quotes.calibrationLead', 'Your pricing vs cohort:')}{' '}
                      <Text style={{ fontFamily: TYPE.titleFamily, color: priceColor }}>
                        {priceAbove ? '+' : ''}{pricePct.toFixed(0)}%
                      </Text>
                      {calibration.acceptanceRateVsCohortPct !== null && (
                        <Text style={s.vascoText}>
                          {' · '}
                          <Text style={{ fontFamily: TYPE.titleFamily, color: acceptAbove ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning }}>
                            {acceptAbove ? '+' : ''}{acceptPp.toFixed(0)}pp
                          </Text>
                          {' '}{t('quotes.calibrationAccept', 'acceptance')}
                        </Text>
                      )}
                    </Text>
                    <Text style={s.vascoExplain}>
                      {t('quotes.calibrationSample', 'Based on your last {{count}} quotes (confidence {{conf}}%)', {
                        count: calibration.sampleSize,
                        conf: Math.round(calibration.confidence * 100),
                      })}
                    </Text>
                  </>
                );
              })()}
            </View>
          )}

          {/* R198: Seasonality — show only when current-vs-best season
              acceptance delta is >=10pp (below that is statistical noise). */}
          {(() => {
            const delta = acceptanceDeltaVsBest(seasonalBundle);
            if (!delta || delta.deltaPp < 10) return null;
            return (
              <View style={s.vascoRow}>
                <Text style={s.vascoText}>
                  {t('quotes.seasonalityLead', '{{season}} acceptance is {{delta}}pp below {{best}}:', {
                    season: t(`quotes.season.${delta.current.season}`, delta.current.season),
                    delta: Math.round(delta.deltaPp),
                    best: t(`quotes.season.${delta.best.season}`, delta.best.season),
                  })}{' '}
                  <Text style={{ fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary }}>
                    {Math.round(delta.current.acceptanceRate * 100)}% vs {Math.round(delta.best.acceptanceRate * 100)}%
                  </Text>
                </Text>
              </View>
            );
          })()}
        </View>

        {/* R66r59: NL reduced VAT (9%) toggle. Visible only when the country
            has a reduced rate (currently NL only). Affects all three tier
            totals. Belastingdienst note shown when active. */}
        {reducedRate !== null && !isSmallBusinessExempt(bp) && (
          <Pressable
            style={[s.vatToggleRow, useReducedVat && s.vatToggleRowActive]}
            onPress={() => { setUseReducedVat(!useReducedVat); hapticSuccess(); }}
            accessibilityRole="switch"
            accessibilityState={{ checked: useReducedVat }}
            accessibilityLabel={t('quotes.reducedVatToggle', 'Use 9% reduced VAT for renovation labor on homes >2 years old')}
          >
            <View style={s.vatToggleIcon}>
              <Ionicons
                name={useReducedVat ? 'checkbox' : 'square-outline'}
                size={20}
                color={useReducedVat ? Palette.hermesOrange : SemanticColors.textTertiary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.vatToggleTitle}>
                {t('quotes.reducedVatTitle', '9% verlaagd BTW-tarief')}
              </Text>
              <Text style={s.vatToggleSubtitle}>
                {t('quotes.reducedVatSubtitle', 'Verbouwing/onderhoud aan woning ouder dan 2 jaar')}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Tier preview cards */}
        <Text style={s.sectionTitle}>{t('quotes.customerSeesOptions', 'Customer sees three options')}</Text>
        <View style={s.tiersRow}>
          {tiers.map(tier => {
            const cfg = TIER_CONFIG[tier.tier];
            return (
              <View key={tier.tier} style={[s.tierCard, tier.isRecommended && { borderColor: Palette.hermesOrange, borderWidth: 2 }]}>
                {tier.isRecommended && (
                  <View style={s.recRibbon}>
                    <Text style={s.recRibbonText}>{t('quotes.recommended', 'RECOMMENDED')}</Text>
                  </View>
                )}
                <View style={[s.tierIconCircle, { backgroundColor: cfg.color + '15' }]}>
                  <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <Text style={[s.tierName, { color: cfg.color }]}>{tier.name}</Text>
                <Text style={s.tierPrice}>{fmt(tier.total)}</Text>
                <Text style={s.tierVat}>{t('quotes.inclVat', 'incl. VAT')}</Text>
                {tier.features.map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, width: '100%' }}>
                    <Ionicons name="checkmark" size={12} color={SemanticColors.feedbackSuccess} />
                    <Text style={s.tierFeature} numberOfLines={1}>{f}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        {/* Upsell stat */}
        <View style={s.upsellRow}>
          <Ionicons name="trending-up" size={14} color={SemanticColors.feedbackSuccess} />
          <Text style={s.upsellText}>{t('quotes.upsellStat', '83% of customers pick Standard or Premium')}</Text>
        </View>

        {/* Line items summary */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('quotes.linesStandard', 'Lines (standard)')}</Text>
          <View style={s.serviceList}>
            {selectedServices.map(sv => {
              const hintKey = sv.item.name.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
              const hint = lineHints[hintKey];
              const hasHint =
                hint &&
                hint.contractorCount >= 5 &&
                (hint.medianQtyDeltaPct !== null || hint.medianUnitPriceDeltaPct !== null);
              return (
                <View key={sv.item.id} style={s.serviceRowCol}>
                  <View style={s.serviceRow}>
                    <Text style={s.serviceName}>{sv.item.name}</Text>
                    <Text style={s.servicePrice}>{sv.quantity} × {fmt(sv.item.basePrice * 1.25)}</Text>
                  </View>
                  {hasHint && (
                    <View style={s.lineHintRow}>
                      <Ionicons name="sparkles-outline" size={11} color={Palette.hermesOrange} />
                      <Text style={s.lineHintText}>
                        {hint!.medianQtyDeltaPct !== null && Math.abs(hint!.medianQtyDeltaPct) >= 1 && (
                          <>
                            {t('quotes.lineHintQty', 'Cohort typically adjusts qty')}{' '}
                            <Text style={{ fontFamily: TYPE.titleFamily }}>
                              {hint!.medianQtyDeltaPct! >= 0 ? '+' : ''}{hint!.medianQtyDeltaPct!.toFixed(0)}%
                            </Text>
                          </>
                        )}
                        {hint!.medianQtyDeltaPct !== null && Math.abs(hint!.medianQtyDeltaPct) >= 1 &&
                         hint!.medianUnitPriceDeltaPct !== null && Math.abs(hint!.medianUnitPriceDeltaPct) >= 1 && ' · '}
                        {hint!.medianUnitPriceDeltaPct !== null && Math.abs(hint!.medianUnitPriceDeltaPct) >= 1 && (
                          <>
                            {t('quotes.lineHintPrice', 'price')}{' '}
                            <Text style={{ fontFamily: TYPE.titleFamily }}>
                              {hint!.medianUnitPriceDeltaPct! >= 0 ? '+' : ''}{hint!.medianUnitPriceDeltaPct!.toFixed(0)}%
                            </Text>
                          </>
                        )}
                        {hint!.topReasonCode && hint!.topReasonShare !== null && hint!.topReasonShare >= 0.3 && (
                          <>
                            {' · '}
                            {t(`quotes.reasonCode.${hint!.topReasonCode}`, hint!.topReasonCode)}
                          </>
                        )}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* R62: SOW (scope-of-work) generator. Sits below the line items so
            contractors review the prose before the Send button. Plain-text
            display when generated; "Edit" toggle exposes a TextInput.
            Single Claude Haiku call per "Generate" tap — no auto-fire on
            keystroke. */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('quotes.scopeTitle', 'Scope of work')}</Text>
          {!sowText && !sowLoading && (
            <>
              {/* R64 (audit fix #9): explainer subtitle so contractors who
                  don't know what an SOW is can see what tapping does. */}
              <Text style={s.sowSubtitle}>
                {t(
                  'quotes.scopeSubtitle',
                  'AI-drafted prose: what\'s included, what\'s excluded, warranty terms. Editable before sending.',
                )}
              </Text>
              <Pressable
                onPress={handleGenerateSow}
                style={s.sowGenerateBtn}
                accessibilityRole="button"
                accessibilityLabel={t('quotes.scopeGenerate', 'Generate scope')}
              >
                <Ionicons name="sparkles-outline" size={16} color={Palette.hermesOrange} />
                <Text style={s.sowGenerateText}>{t('quotes.scopeGenerate', 'Generate scope')}</Text>
              </Pressable>
              {/* R64 (audit fix #7): tone-learning visibility — surfaces
                  the moat to contractors who reach 5+ accepted quotes.
                  Builds trust + makes the personalization explicit. */}
              {toneExamplesRef.current && toneExamplesRef.current.length > 0 && (
                <View style={s.sowToneBadge}>
                  <Ionicons name="ribbon-outline" size={11} color={SemanticColors.feedbackSuccess} />
                  <Text style={s.sowToneBadgeText}>
                    {t('quotes.scopeToneLearned', {
                      defaultValue: 'Trained on your last {{n}} accepted quotes',
                      n: toneExamplesRef.current.length,
                    })}
                  </Text>
                </View>
              )}
            </>
          )}
          {sowLoading && (
            <View style={s.sowLoadingRow}>
              <ActivityIndicator size="small" color={Palette.hermesOrange} />
              <Text style={s.sowLoadingText}>{t('quotes.scopeGenerating', 'Drafting scope…')}</Text>
            </View>
          )}
          {sowError && !sowLoading && (
            <Pressable onPress={handleGenerateSow} style={s.sowErrorRow}>
              <Ionicons name="refresh" size={14} color={SemanticColors.feedbackError} />
              <Text style={s.sowErrorText}>
                {t('quotes.scopeRetry', 'Could not generate scope. Tap to retry.')}
              </Text>
            </Pressable>
          )}
          {sowText && !sowLoading && (
            <View style={s.sowResultBox}>
              <TextInput
                value={sowText}
                onChangeText={setSowText}
                multiline
                style={s.sowTextInput}
                placeholder={t('quotes.scopePlaceholder', 'Scope text')}
                placeholderTextColor={SemanticColors.textTertiary}
                textAlignVertical="top"
              />
              <View style={s.sowActionsRow}>
                <Pressable onPress={handleGenerateSow} style={s.sowSecondaryBtn}>
                  <Ionicons name="refresh" size={13} color={SemanticColors.textSecondary} />
                  <Text style={s.sowSecondaryText}>
                    {t('quotes.scopeRegenerate', 'Regenerate')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setSowText(''); setSowError(null); }}
                  style={s.sowSecondaryBtn}
                  accessibilityLabel={t('quotes.scopeClear', 'Clear scope')}
                >
                  <Ionicons name="close" size={13} color={SemanticColors.textSecondary} />
                  <Text style={s.sowSecondaryText}>{t('quotes.scopeClear', 'Clear')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Send — R66r53: canonical DK CTA gradient pill */}
      <View style={s.bottom}>
        <Pressable onPress={handleSend} style={s.sendBtnWrap}>
          <LinearGradient
            colors={DK.effects.ctaGradient as unknown as readonly [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.sendBtn}
          >
            <Ionicons name="send" size={18} color={Palette.white} />
            <Text style={s.sendBtnText}>{t('quotes.sendQuote', 'Send quote')}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SemanticColors.borderDefault,
  },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: PAGE_BG, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  headerSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 1 },

  scroll: { flex: 1 },
  scrollContent: { padding: SafeArea.side, gap: GRID.lg, paddingBottom: 120 },

  // AI Scan — compact row
  aiDraftSection: { gap: 8 },
  aiDraftInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: Palette.hermesOrange + '30',
  },
  aiDraftInput: {
    flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary,
    paddingVertical: 0,
  },
  aiScanRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Palette.hermesOrange + '08', borderRadius: RADIUS.md, padding: 10,
  },
  aiScanText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  aiExplanation: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4, paddingRight: 8 },
  aiExplanationText: { flex: 1, fontSize: TYPE.tinySize, fontFamily: TYPE.captionFamily, color: Palette.hermesOrange, lineHeight: 14 },

  // Sections
  section: { gap: GRID.sm },
  sectionTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.hermesOrange + '10', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },

  // Service list
  serviceList: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  serviceRowCol: {
    flexDirection: 'column', padding: 14, gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SemanticColors.borderDefault,
  },
  serviceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  serviceName: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary, flex: 1 },
  servicePrice: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  priceEditRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  priceInput: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange, minWidth: 44, paddingVertical: 2, paddingHorizontal: 6, backgroundColor: SemanticColors.surfaceSecondary, borderRadius: RADIUS.sm },
  customCard: { backgroundColor: SemanticColors.surfaceSecondary, borderRadius: RADIUS.md, padding: GRID.md, gap: GRID.sm, marginBottom: GRID.md },
  customTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  customInput: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: SemanticColors.borderDefault },
  customRow: { flexDirection: 'row', gap: GRID.sm },
  customAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md, paddingVertical: 12 },
  customAddBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },
  pbSectionLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, marginBottom: GRID.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  lineHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lineHintText: { fontSize: TYPE.tinySize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, flex: 1 },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: SemanticColors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary, minWidth: 24, textAlign: 'center' },

  // Templates
  templateLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },
  templateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: 12,
  },
  templateName: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  templateMeta: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },

  // Empty
  emptyBox: { alignItems: 'center', gap: 8, padding: 32, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: SemanticColors.borderDefault, borderStyle: 'dashed' },
  emptyText: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textTertiary },

  // Suggestions
  suggestRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  suggestLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, marginRight: 4 },
  suggestChip: { backgroundColor: Palette.hermesOrange + '10', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 },
  suggestChipText: { fontSize: TYPE.tinySize, fontFamily: TYPE.captionFamily, color: Palette.hermesOrange },

  // Pricebook selector
  pbItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: 14, marginBottom: 6,
  },
  pbItemSelected: { borderWidth: 1, borderColor: SemanticColors.feedbackSuccess },
  pbName: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  pbPrice: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 1 },

  // Bottom bar
  bottom: {
    padding: SafeArea.side, paddingBottom: 34,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SemanticColors.borderDefault,
    gap: 6,
  },
  bottomSummary: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, textAlign: 'center' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md, paddingVertical: 14,
  },
  nextBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },

  sendBtnWrap: { borderRadius: RADIUS.full, ...DK.effects.ctaShadow },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: RADIUS.full, paddingVertical: 14,
  },
  sendBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },

  // R62/R64: SOW (scope-of-work) styles
  sowSubtitle: {
    fontSize: TYPE.captionSize, color: SemanticColors.textSecondary,
    fontFamily: TYPE.bodyFamily, lineHeight: 18,
    marginBottom: GRID.sm,
  },
  sowToneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, paddingVertical: 4, paddingHorizontal: 6,
    alignSelf: 'flex-start',
  },
  sowToneBadgeText: {
    fontSize: 11, color: SemanticColors.feedbackSuccess,
    fontFamily: TYPE.bodyFamily, fontStyle: 'italic',
  },
  sowGenerateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Palette.hermesOrange,
    borderRadius: RADIUS.md, backgroundColor: 'rgba(249, 115, 22, 0.08)',
  },
  sowGenerateText: {
    fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  sowLoadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12,
  },
  sowLoadingText: {
    fontSize: TYPE.captionSize, color: SemanticColors.textSecondary,
    fontFamily: TYPE.bodyFamily,
  },
  sowErrorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10,
  },
  sowErrorText: {
    fontSize: TYPE.captionSize, color: SemanticColors.feedbackError,
    fontFamily: TYPE.bodyFamily,
  },
  sowResultBox: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    padding: 12, gap: 10,
    borderWidth: 1, borderColor: SemanticColors.borderMuted,
  },
  sowTextInput: {
    fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary, lineHeight: 20,
    minHeight: 110, padding: 0,
  },
  sowActionsRow: {
    flexDirection: 'row', gap: GRID.sm,
    borderTopWidth: 1, borderTopColor: SemanticColors.borderMuted,
    paddingTop: 8,
  },
  sowSecondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  sowSecondaryText: {
    fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
  },

  // Vasco card — preview step
  vascoCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 14, gap: 8,
    borderLeftWidth: 3, borderLeftColor: Palette.hermesOrange,
  },
  vascoTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  vascoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  vascoText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, flex: 1 },
  vascoExplain: { fontSize: TYPE.tinySize, fontFamily: TYPE.captionFamily, color: Palette.hermesOrange, marginTop: 2 },
  vascoApply: { backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 5 },
  vascoApplyText: { fontSize: TYPE.tinySize, fontFamily: TYPE.titleFamily, color: Palette.white },
  vascoSkip: { backgroundColor: SemanticColors.surfaceSecondary, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 5 },
  vascoSkipText: { fontSize: TYPE.tinySize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },

  // Tier cards
  tiersRow: { flexDirection: 'row', gap: GRID.xs },
  tierCard: {
    flex: 1, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    padding: 10, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  recRibbon: {
    position: 'absolute', top: -1, left: -1, right: -1,
    backgroundColor: Palette.hermesOrange, paddingVertical: 3, alignItems: 'center',
    borderTopLeftRadius: RADIUS.md - 1, borderTopRightRadius: RADIUS.md - 1,
  },
  recRibbonText: { fontSize: TYPE.tinySize - 3, fontFamily: TYPE.titleFamily, color: Palette.white, letterSpacing: 0.5 },
  tierIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  tierName: { fontSize: TYPE.captionSize, fontFamily: TYPE.sectionFamily },
  tierPrice: { fontSize: TYPE.sectionSize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary, marginTop: 2 },
  tierVat: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textTertiary },
  tierFeature: { fontSize: TYPE.tinySize - 2, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, flex: 1 },

  upsellRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SemanticColors.feedbackSuccess + '10', borderRadius: RADIUS.md, padding: 10 },
  upsellText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.feedbackSuccess },

  // R66r59: NL 9% reduced-VAT opt-in row
  vatToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  vatToggleRowActive: {
    backgroundColor: Palette.hermesOrange + '10',
    borderColor: Palette.hermesOrange + '50',
  },
  vatToggleIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  vatToggleTitle: {
    fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  vatToggleSubtitle: {
    fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary, marginTop: 2,
  },
});
