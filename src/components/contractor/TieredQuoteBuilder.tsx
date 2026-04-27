// =============================================================================
// Tiered Quote Builder — 2-step: select services → preview with Vasco insights
// =============================================================================
// Step 1: Trade-tailored pricebook + quantity controls
// Step 2: Preview tiers + Vasco AI (calibration, pricing, tips) → send
// =============================================================================

import { useEffect, useState, useMemo, useRef } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { formatCurrency } from '../../i18n/formatting';
import { Spacing, SafeArea } from '../../theme/spacing';
import type { Customer } from '../../types/contractor';
import type { TieredQuote, QuoteTier, PricebookItem } from '../../types/contractor-features';
import { MS_PER_DAY } from '../../utils/timeConstants';
import { MOCK_PRICEBOOK } from '../../data/mockPricebook';
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
import { useTimeOfDayHint, dayPart } from '../../services/timeOfDayAcceptanceService';
import { getCurrentUserId } from '../../lib/currentUser';
import { useQuoteTemplates, type QuoteTemplate, TEMPLATE_CATEGORIES } from '../../services/quoteTemplateService';
import { hapticSuccess } from '../../utils/haptics';
import { useTranslation } from 'react-i18next';
type IconName = keyof typeof Ionicons.glyphMap;

// =============================================================================
// Trade-specific pricebook items — shown when MOCK_PRICEBOOK doesn't have trade items
// =============================================================================
const TRADE_PRICEBOOK: Record<string, { id: string; name: string; basePrice: number; unit: string }[]> = {
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
};

const TRADE_LABELS: Record<string, string> = {
  painting: 'Schilderwerk',
  plumbing: 'Loodgieterswerk',
  electrical: 'Elektra',
  gas: 'Installatie',
  carpentry: 'Timmerwerk',
  general: 'Bouw & Renovatie',
};

const TRADE_SUGGESTIONS: Record<string, string[]> = {
  painting: ['Afplakband', 'Grondverf', 'Schuurpapier', 'Primer'],
  plumbing: ['Teflon tape', 'Afdichtingsring', 'Soldeer', 'Koppelingen'],
  electrical: ['Krimpkous', 'Lasklemmen', 'Kabelgoot', 'Zekeringen'],
  gas: ['Gaslekzoeker', 'Afdichtpasta', 'O-ringen', 'Koperen buis'],
  carpentry: ['Schroeven', 'Houtlijm', 'Schuurpapier', 'Beits'],
  general: ['Schroeven', 'Pluggen', 'Afdekfolie', 'Siliconenkit'],
};

const TIER_CONFIG = {
  good: { name: 'Basis', tagline: 'Standaard uitvoering', color: SemanticColors.textSecondary, icon: 'checkmark-circle-outline' as const },
  better: { name: 'Standaard', tagline: 'Meest gekozen', color: Palette.hermesOrange, icon: 'star-outline' as const },
  best: { name: 'Premium', tagline: 'Beste kwaliteit', color: '#8B5CF6', icon: 'diamond-outline' as const },
};

interface TieredQuoteBuilderProps {
  customer?: Customer;
  onSend: (quote: Partial<TieredQuote>) => void;
  onClose: () => void;
}

export function TieredQuoteBuilder({ customer, onSend, onClose }: TieredQuoteBuilderProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const trade = user?.trade ?? 'general';
  const country = user?.country ?? 'NL';
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [selectedServices, setSelectedServices] = useState<{ item: PricebookItem; quantity: number; unit: string }[]>([]);
  const [showPricebook, setShowPricebook] = useState(false);
  const [showAIQuote, setShowAIQuote] = useState(false);
  const [calibrationApplied, setCalibrationApplied] = useState(false);
  const [scopeText, setScopeText] = useState('');
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const { templates, use: useTemplate } = useQuoteTemplates();
  const [priceSuggestion, setPriceSuggestion] = useState<PricePrediction | null>(null);
  const [winPrediction, setWinPrediction] = useState<QuoteWinPrediction | null>(null);
  const [handoffBanner, setHandoffBanner] = useState<string | null>(null);
  const { benchmarks: cohort } = useCohortBenchmarks(trade, country);
  const { calibration } = useContractorCalibration(user?.id ?? null, trade, country);
  const { bundle: seasonalBundle } = useQuoteSeasonal(trade, country);
  const { hint: timeOfDayHint } = useTimeOfDayHint(trade, country);
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

  // Build trade-specific pricebook
  const tradePricebook = useMemo(() => {
    // First try MOCK_PRICEBOOK (has variants for painting)
    const fromMock = MOCK_PRICEBOOK.filter(i => i.variants && i.variants.length > 0);
    if (trade === 'painting' && fromMock.length > 0) return fromMock;

    // For other trades, build from TRADE_PRICEBOOK
    const tradeItems = TRADE_PRICEBOOK[trade] ?? TRADE_PRICEBOOK.general;
    return tradeItems.map(item => ({
      ...item,
      contractorId: '',
      description: `${TRADE_LABELS[trade] ?? trade}`,
      category: trade,
      pricingType: 'fixed' as const,
    })) as unknown as PricebookItem[];
  }, [trade]);

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
      const vatAmount = subtotal * 0.21;
      return {
        tier: tierKey, name: TIER_CONFIG[tierKey].name, tagline: TIER_CONFIG[tierKey].tagline,
        lineItems, subtotal, vatRate: 21, vatAmount, total: subtotal + vatAmount,
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
      setSelectedServices([...selectedServices, { item, quantity: 1, unit: item.unit || 'stuk' }]);
    }
    setShowPricebook(false);
  };

  const removeService = (itemId: string) => setSelectedServices(selectedServices.filter(s => s.item.id !== itemId));
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
    const mapped = template.items.map((item, idx) => ({
      item: { id: `tpl-${template.id}-${idx}`, contractorId: '', name: item.description, description: `${template.name}`, category: item.type === 'labour' ? 'labour' : 'materials', pricingType: 'fixed', basePrice: item.unitPrice, unit: item.unit } as unknown as PricebookItem,
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
    const existing = MOCK_PRICEBOOK.find((pb) => pb.id === jobId);
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
    const tradeItems = TRADE_PRICEBOOK[trade] ?? TRADE_PRICEBOOK.general;
    const allItems = [...tradeItems, ...(TRADE_PRICEBOOK.general ?? [])];
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
          item: { ...item, contractorId: '', description: TRADE_LABELS[trade] ?? trade, category: trade, pricingType: 'fixed' as const } as unknown as PricebookItem,
          quantity: 1,
          unit: item.unit,
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
          item: { ...item, contractorId: '', description: TRADE_LABELS[trade] ?? trade, category: trade, pricingType: 'fixed' as const } as unknown as PricebookItem,
          quantity: 1,
          unit: item.unit,
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
      if (matchedWords.length > 0) {
        explanations[m.item.id] = `Matched "${matchedWords.join(', ')}" from your description. ${TRADE_LABELS[trade] || trade} standard rate: \u20AC${m.item.basePrice}/${m.unit}.`;
      } else if (fuzzyWords.length > 0) {
        explanations[m.item.id] = `Fuzzy match for "${fuzzyWords.join(', ')}". ${TRADE_LABELS[trade] || trade} standard rate: \u20AC${m.item.basePrice}/${m.unit}.`;
      } else {
        explanations[m.item.id] = `Common ${TRADE_LABELS[trade] || trade} service \u2014 suggested based on typical ${trade} job scope.`;
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

  const handleSend = () => {
    if (selectedServices.length === 0) return;
    const quote: Partial<TieredQuote> = {
      reference: `TQ-${Date.now()}`, title: 'Offerte', tiers,
      validUntil: new Date(Date.now() + 30 * MS_PER_DAY).toISOString().split('T')[0],
      paymentTerms: '30% aanbetaling, 70% bij oplevering', status: 'sent',
    };
    intelligence.trackEvent({
      eventType: 'quote_sent', userId: getCurrentUserId(), sessionId: 'current',
      context: { platform: 'ios', appVersion: '1.0.0', dayOfWeek: new Date().getDay(), hourOfDay: new Date().getHours(), isWeekend: [0, 6].includes(new Date().getDay()), season: 'winter' },
      payload: { quoteReference: quote.reference, tierCount: 3, goodTotal: tiers[0].total, betterTotal: tiers[1].total, bestTotal: tiers[2].total, serviceCount: selectedServices.length, customerId: customer?.id },
      entities: customer ? [{ id: customer.id, type: 'customer', name: customer.name, confidence: 1.0 }] : [],
    });
    onSend(quote);
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
            <Text style={s.headerTitle}>Diensten toevoegen</Text>
            <Text style={s.headerSub}>{TRADE_LABELS[trade] ?? 'Diensten'}</Text>
          </View>
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          {tradePricebook.map(item => {
            const isSelected = selectedServices.some(sv => sv.item.id === item.id);
            return (
              <Pressable key={item.id} style={[s.pbItem, isSelected && s.pbItemSelected]} onPress={() => addService(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pbName}>{item.name}</Text>
                  <Text style={s.pbPrice}>{fmt(item.basePrice)}/{item.unit || 'stuk'}</Text>
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
            <Text style={s.headerTitle}>Nieuwe offerte</Text>
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
                      €{rec.suggestedUnitPrice.toFixed(2)} · {Math.round(rec.recommendationRate * 100)}% van vergelijkbare offertes · {rec.contractorCount} aannemers
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
                placeholder="Describe the job scope..."
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
            <Pressable style={s.aiScanRow} onPress={() => setShowAIQuote(true)}>
              <Ionicons name="camera" size={16} color={Palette.hermesOrange} />
              <Text style={s.aiScanText}>Or scan a photo</Text>
              <Ionicons name="chevron-forward" size={14} color={SemanticColors.textTertiary} />
            </Pressable>
            <SimilarJobsSuggest query={scopeText} onPickJob={handlePickSimilarJob} />
          </View>

          {/* Services section */}
          <View style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.sectionTitle}>{TRADE_LABELS[trade] ?? 'Diensten'}</Text>
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
                      <Text style={s.servicePrice}>{fmt(sv.item.basePrice)}/{sv.unit}</Text>
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
                    <Text style={s.templateLabel}>Of start van sjabloon:</Text>
                    {templates.slice(0, 3).map(tpl => (
                      <Pressable key={tpl.id} style={s.templateRow} onPress={() => loadTemplate(tpl)}>
                        <Ionicons name="copy-outline" size={16} color={Palette.hermesOrange} />
                        <Text style={s.templateName}>{tpl.name}</Text>
                        <Text style={s.templateMeta}>{tpl.items.length} regels</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <Pressable style={s.emptyBox} onPress={() => setShowPricebook(true)}>
                  <Ionicons name="document-text-outline" size={28} color={SemanticColors.textTertiary} />
                  <Text style={s.emptyText}>Kies diensten uit je prijslijst</Text>
                </Pressable>
              </>
            )}

            {/* Trade-specific suggestions */}
            {selectedServices.length > 0 && (
              <View style={s.suggestRow}>
                <Ionicons name="bulb-outline" size={14} color={SemanticColors.textTertiary} />
                <Text style={s.suggestLabel}>Vergeten?</Text>
                {(TRADE_SUGGESTIONS[trade] ?? TRADE_SUGGESTIONS.general).slice(0, 3).map(item => (
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
            <Text style={s.bottomSummary}>{selectedServices.length} diensten · {fmt(tiers[1].total)} (standaard)</Text>
            <Pressable style={s.nextBtn} onPress={() => { hapticSuccess(); setStep('preview'); }}>
              <Text style={s.nextBtnText}>Bekijk offerte</Text>
              <Ionicons name="arrow-forward" size={18} color={Palette.white} />
            </Pressable>
          </View>
        )}

        {/* AI Quote Modal */}
        <Modal visible={showAIQuote} animationType="slide" presentationStyle="pageSheet">
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
          <Text style={s.headerTitle}>Offerte controleren</Text>
          {customer && <Text style={s.headerSub}>{customer.name}</Text>}
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Vasco insights — inline in preview (not cluttering build step) */}
        <View style={s.vascoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="flash" size={16} color={Palette.hermesOrange} />
            <Text style={s.vascoTitle}>Vasco advies</Text>
          </View>

          {/* Calibration */}
          {calibrations.length > 0 && !calibrationApplied && (
            <View style={s.vascoRow}>
              <Text style={s.vascoText}>
                Op basis van {calibrations[0]?.basedOnJobCount || 0} eerdere klussen: uren{' '}
                {calibrations.some(c => c.combinedMultiplier > 1)
                  ? `+${Math.round((Math.max(...calibrations.map(c => c.combinedMultiplier)) - 1) * 100)}%`
                  : 'op schema'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable style={s.vascoApply} onPress={() => {
                  setSelectedServices(prev => prev.map((sv, idx) => {
                    const cal = calibrations[idx];
                    return cal && cal.combinedMultiplier > 1 ? { ...sv, quantity: Math.ceil(sv.quantity * cal.combinedMultiplier) } : sv;
                  }));
                  setCalibrationApplied(true);
                }}>
                  <Text style={s.vascoApplyText}>Toepassen</Text>
                </Pressable>
                <Pressable style={s.vascoSkip} onPress={() => setCalibrationApplied(true)}>
                  <Text style={s.vascoSkipText}>Negeer</Text>
                </Pressable>
              </View>
            </View>
          )}
          {calibrationApplied && calibrations.length > 0 && (
            <View style={s.vascoRow}>
              <Ionicons name="checkmark-circle" size={14} color={SemanticColors.feedbackSuccess} />
              <Text style={[s.vascoText, { color: SemanticColors.feedbackSuccess }]}>Kalibratie toegepast</Text>
            </View>
          )}

          {/* Pricing advice */}
          {priceSuggestion && (priceSuggestion.suggestedPrice ?? 0) > 0 && (
            <View style={s.vascoRow}>
              <Text style={s.vascoText}>
                Aanbevolen uurprijs: {fmt(priceSuggestion.suggestedPrice ?? 0)} · Acceptatiekans: {Math.round((priceSuggestion.acceptanceRate ?? 0) * 100)}%
              </Text>
            </View>
          )}

          {/* Win probability + explanation */}
          {winPrediction && (
            <View style={s.vascoRow}>
              <Text style={s.vascoText}>
                Win-kans:{' '}
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

          {/* Time-of-day acceptance hint (R260). k-anonymity gated server-side. */}
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
            const partKey = `quotes.todPart_${dayPart(timeOfDayHint.bestBucket.hourOfDay)}`;
            const partFallback = dayPart(timeOfDayHint.bestBucket.hourOfDay);
            return (
              <View style={s.vascoRow}>
                <Text style={s.vascoText}>
                  {t('quotes.todHint', 'Best time to send: {{day}} {{part}} — {{lift}}pp higher acceptance', {
                    day: dows[timeOfDayHint.bestBucket.dayOfWeek] ?? '',
                    part: t(partKey, partFallback),
                    lift: Math.round(timeOfDayHint.liftPoints * 100),
                  })}
                </Text>
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

        {/* Tier preview cards */}
        <Text style={s.sectionTitle}>{t('quotes.customerSeesOptions', 'Customer sees three options')}</Text>
        <View style={s.tiersRow}>
          {tiers.map(tier => {
            const cfg = TIER_CONFIG[tier.tier];
            return (
              <View key={tier.tier} style={[s.tierCard, tier.isRecommended && { borderColor: Palette.hermesOrange, borderWidth: 2 }]}>
                {tier.isRecommended && (
                  <View style={s.recRibbon}>
                    <Text style={s.recRibbonText}>AANBEVOLEN</Text>
                  </View>
                )}
                <View style={[s.tierIconCircle, { backgroundColor: cfg.color + '15' }]}>
                  <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <Text style={[s.tierName, { color: cfg.color }]}>{tier.name}</Text>
                <Text style={s.tierPrice}>{fmt(tier.total)}</Text>
                <Text style={s.tierVat}>incl. btw</Text>
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
          <Text style={s.upsellText}>83% van klanten kiest Standaard of Premium</Text>
        </View>

        {/* Line items summary */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Regels (standaard)</Text>
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
      </ScrollView>

      {/* Send */}
      <View style={s.bottom}>
        <Pressable style={s.sendBtn} onPress={handleSend}>
          <Ionicons name="send" size={18} color={Palette.white} />
          <Text style={s.sendBtnText}>Offerte versturen</Text>
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

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md, paddingVertical: 14,
  },
  sendBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },

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
});
