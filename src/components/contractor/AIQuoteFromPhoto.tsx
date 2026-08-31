// =============================================================================
// AI Quote from Photo — REAL implementation
// =============================================================================
// Takes photo via expo-image-picker → compresses → sends to Supabase Edge
// Function → Claude Haiku Vision analyzes → returns structured quote items
//
// Cost controls:
// - Uses Haiku (cheapest vision model: ~$0.001/image)
// - Image compressed to 800px max + quality 0.6 (reduces tokens)
// - Max 1024 response tokens
// - Rate limited: 1 analysis per 30 seconds
// - Falls back to mock if no API key configured
// =============================================================================

import { useState, useRef } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { formatCurrency, formatCurrency0, type Country } from '../../i18n/formatting';
import { Spacing } from '../../theme/spacing';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getCurrentTrade, getCurrentCountry, getCurrentVatScheme, getCurrentUserId } from '../../lib/currentUser';
import { getEffectiveVatRate, type VatScheme, type BusinessProfile } from '../../domain/business';
import { hapticSuccess, hapticWarning } from '../../utils/haptics';
import { withTimeout } from '../../utils/withTimeout';
import { repriceQuoteLinesFromMoat } from '../../services/quoteMoatRepricing';
import { recordDelta, type DeltaSource } from '../../services/reasonCodeService';
import { normalizeComplexity } from '../../utils/complexity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DetectedItem {
  id: string;
  description: string;
  category: string;
  confidence: number;
  suggestedQuantity: number;
  unit: string;
  suggestedPrice: number;
  pricebookMatch?: string;
  selected: boolean;
  // Strong identifiers + material/labour split (edge fn) — power the EAN-based
  // scanned-price match and material-only repricing in quoteMoatRepricing (#2).
  ean?: string;
  articleNumber?: string;
  materialCostPerUnit?: number;
  laborCostPerUnit?: number;
  // Moat provenance (set by quoteMoatRepricing) — how this price was derived.
  moatSource?: 'ai' | 'cohort' | 'scan' | 'pricebook';
  cohortContractors?: number;
  scanSupplier?: string;
  needsReview?: boolean;
}

interface AIAnalysisResult {
  jobType: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedHours: number;
  detectedItems: DetectedItem[];
  notes: string[];
  warnings: string[];
}

interface AIQuoteFromPhotoProps {
  onCreateQuote: (items: DetectedItem[], jobType: string) => void;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

const RATE_LIMIT_MS = 30000; // 30 seconds between analyses
let lastAnalysisTime = 0;

// ---------------------------------------------------------------------------
// Mock fallback (when no API key)
// ---------------------------------------------------------------------------

const MOCK_RESULT: AIAnalysisResult = {
  jobType: 'Ruimte renovatie',
  complexity: 'medium',
  estimatedHours: 12,
  detectedItems: [
    { id: 'ai-1', description: 'Voorbereiding en afplakken', category: 'Voorbereiding', confidence: 90, suggestedQuantity: 1, unit: 'job', suggestedPrice: 150, selected: true },
    { id: 'ai-2', description: 'Materiaal en arbeid', category: 'Installatie', confidence: 85, suggestedQuantity: 20, unit: 'm²', suggestedPrice: 45, selected: true },
    { id: 'ai-3', description: 'Afwerking en oplevering', category: 'Afwerking', confidence: 80, suggestedQuantity: 1, unit: 'job', suggestedPrice: 200, selected: true },
    { id: 'ai-4', description: 'Afvoer restmateriaal', category: 'Opruiming', confidence: 75, suggestedQuantity: 1, unit: 'job', suggestedPrice: 100, selected: false },
  ],
  notes: ['Foto geanalyseerd — configureer ANTHROPIC_API_KEY voor echte AI-analyse'],
  warnings: ['Demo modus — prijzen zijn indicatief'],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_PHOTOS = 5;

interface CapturedPhoto {
  uri: string;
  base64: string;
}

export function AIQuoteFromPhoto({ onCreateQuote, onClose }: AIQuoteFromPhotoProps) {
  // Cohort figures are money — format for the contractor's country, not the
  // device locale. Resolved here rather than threaded as a prop, matching how
  // the rest of this component already reads getCurrentCountry().
  const cohortCountry = ((getCurrentCountry() as Country) ?? 'NL');
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [items, setItems] = useState<DetectedItem[]>([]);
  // Uncommitted price text, keyed by line id. Committed on blur — see commitPrice.
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // R66 round 35: photo cohort benchmark — closes the dormant
  // get_photo_analysis_cohort RPC (R243 wired BE + FE wrapper, but no
  // surface ever called it). Loads after the AI analysis lands so the
  // contractor sees "Based on 12 similar projects: ~14h / €1,800 median"
  // alongside their own AI-suggested estimate. RPC enforces k-anonymity
  // at ≥5 contractors before returning real numbers.
  const [photoCohort, setPhotoCohort] = useState<import('../../services/intelligenceCaptureService').PhotoAnalysisCohort | null>(null);

  // Learning-loop plumbing (P4). baselinesRef holds the pre-edit (post-moat)
  // qty/price per line so a contractor correction is captured as a delta
  // against what we showed them. editedRef dedupes so we record one delta per
  // line per session (matches TieredQuoteBuilder's contract).
  const baselinesRef = useRef<Map<string, { qty: number; price: number; source: DeltaSource }>>(new Map());
  const editedRef = useRef<Set<string>>(new Set());

  // Derive a primary photo for legacy single-photo render paths.
  const photo = photos[0]?.uri ?? null;

  const addPhoto = (p: CapturedPhoto) => {
    setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, p]));
    setError(null);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const atCap = photos.length >= MAX_PHOTOS;

  // Take photo via camera (cumulative — multi-photo)
  const takePhoto = async () => {
    if (atCap) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('photos.cameraAccess', 'Camera access required'), t('photos.cameraPermission', 'Give Vasco access to your camera to take photos.'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
      allowsEditing: false,
      exif: false,
    });

    if (!result.canceled && result.assets[0] && result.assets[0].base64) {
      addPhoto({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  // Pick from gallery — allow multi-select so contractor/customer can drop 3-5 angles in one go
  const pickFromGallery = async () => {
    if (atCap) return;
    const remaining = MAX_PHOTOS - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });

    if (!result.canceled) {
      for (const asset of result.assets) {
        if (!asset.base64) continue;
        setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, { uri: asset.uri, base64: asset.base64! }]));
      }
      setError(null);
    }
  };

  // Analyze photos via Supabase Edge Function → Claude Haiku Vision (multi-image)
  const analyzePhotos = async () => {
    const batch = photos.map((p) => p.base64);
    if (batch.length === 0) {
      setError('Voeg minstens één foto toe');
      return;
    }

    // Rate limit
    const now = Date.now();
    if (now - lastAnalysisTime < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastAnalysisTime)) / 1000);
      Alert.alert(t('aiQuote.pleaseWait', 'Please wait'), t('aiQuote.rateLimitMessage', 'You can scan again in {{seconds}} seconds.', { seconds: waitSec }));
      return;
    }
    lastAnalysisTime = now;

    setAnalyzing(true);
    setError(null);

    const isDemo = __DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

    // No backend configured: only demo/dev may show indicative mock data.
    // In production we must never fabricate line items into a customer quote.
    if (!isSupabaseConfigured) {
      if (isDemo) {
        setTimeout(() => {
          setAnalysis(MOCK_RESULT);
          setItems(MOCK_RESULT.detectedItems);
          setAnalyzing(false);
          hapticSuccess();
        }, 1500);
      } else {
        setError(t('aiQuote.unavailable', 'AI analysis is unavailable right now. Add items manually or try again later.'));
        setAnalysis(null);
        setItems([]);
        setAnalyzing(false);
      }
      return;
    }

    const trade = getCurrentTrade() || 'general';
    const country = getCurrentCountry() || 'NL';

    // Success path: reprice detected lines against the pricing moat (cohort +
    // own scanned prices) BEFORE display, seed delta baselines for the learning
    // loop, then persist analysis + load the cohort benchmark.
    const applyRealResult = async (data: any) => {
      const rawItems: DetectedItem[] = Array.isArray(data.detectedItems) ? data.detectedItems : [];
      const rawSelected = new Map(rawItems.map((i) => [i.id, i.selected !== false]));
      const { items: repriced, baselines } = await repriceQuoteLinesFromMoat(
        rawItems.map((i) => ({
          id: i.id, description: i.description, category: i.category, unit: i.unit,
          confidence: i.confidence, suggestedQuantity: i.suggestedQuantity, suggestedPrice: i.suggestedPrice,
          ean: i.ean, articleNumber: i.articleNumber,
          materialCostPerUnit: i.materialCostPerUnit, laborCostPerUnit: i.laborCostPerUnit,
        })),
        { trade, country, userId: getCurrentUserId() },
      );
      baselinesRef.current = baselines;
      editedRef.current = new Set();
      setAnalysis(data);
      setItems(repriced.map((r) => ({
        id: r.id,
        description: r.description,
        category: r.category ?? '',
        confidence: r.confidence ?? 100,
        suggestedQuantity: r.suggestedQuantity,
        unit: r.unit ?? 'stuk',
        suggestedPrice: r.suggestedPrice,
        // Confidence gate AND the AI's own optional flag both have to pass.
        selected: r.selected && (rawSelected.get(r.id) ?? true),
        moatSource: r.moatSource,
        cohortContractors: r.cohortContractors,
        scanSupplier: r.scanSupplier,
        needsReview: r.needsReview,
      })));
      hapticSuccess();
      // R238: persist for cross-quote learning + future agent queries.
      import('../../services/intelligenceCaptureService').then((m) =>
        m.persistPhotoAnalysis({
          trade,
          detectedRooms: data.detectedRooms ?? data.rooms ?? undefined,
          detectedMaterials: data.detectedItems ?? undefined,
          estimatedComplexity: data.estimatedComplexity ?? undefined,
          estimatedDurationHours: data.estimatedDurationHours ?? undefined,
          estimatedCostEur: data.estimatedTotal ?? undefined,
          rawResponse: data,
        }),
      ).catch(() => {});
      // R66 round 35: cohort benchmark lookup. Normalize the legacy FE `medium`
      // to the BE `simple|moderate|complex` vocabulary via the shared helper (#7).
      const beComplexity = normalizeComplexity(data.estimatedComplexity);
      import('../../services/intelligenceCaptureService').then((m) =>
        m.getPhotoAnalysisCohort(trade, country, beComplexity).then((c) => {
          if (c && c.contractorCount >= 5) setPhotoCohort(c);
        }),
      ).catch(() => {});
    };

    // One retry with a short backoff — a transient invoke/timeout used to fall
    // straight to fabricated mock line items. 45s hard ceiling per attempt so a
    // hung invoke can't leave the spinner stuck forever.
    let data: any = null;
    let fnError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await withTimeout(
          supabase.functions.invoke('analyze-photo', {
            body: { imagesBase64: batch, imageBase64: batch[0], trade, country },
          }),
          45000,
          'analyze-photo',
        );
        data = res.data; fnError = res.error;
      } catch (e) {
        fnError = e; data = null;
      }
      // Success = transport ok, payload present, and not the edge fn's JSON
      // parse-failure fallback (which carries `error` + an empty `fallback`).
      if (!fnError && data && !data.error) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
    }

    try {
      if (!fnError && data && !data.error) {
        try {
          await applyRealResult(data);
        } catch {
          // Repricing/persist hiccup — still show the real AI result unrepriced
          // rather than nothing. Never fall to mock here.
          setAnalysis(data);
          setItems(Array.isArray(data.detectedItems) ? data.detectedItems : []);
          hapticSuccess();
        }
      } else if (isDemo) {
        setAnalysis(data?.fallback || MOCK_RESULT);
        setItems((data?.fallback || MOCK_RESULT).detectedItems);
        setError(t('aiQuote.demoResults', 'AI analysis unavailable — showing demo results'));
        hapticWarning();
      } else {
        // Production: no fabricated line items. Explicit, recoverable error.
        setAnalysis(null);
        setItems([]);
        setError(t('aiQuote.analyzeFailed', "Couldn't analyze the photos. Try again or add items manually."));
        hapticWarning();
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleItem = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  // P4 — learning loop. A quantity correction on this (primary) path now feeds
  // quote_line_deltas, same as TieredQuoteBuilder. Fires once per line per
  // session, only once the edit is material (≥1 unit or ≥5% off the baseline we
  // showed). Best-effort + offline-queued inside recordDelta.
  const maybeRecordEdit = (item: DetectedItem, edit: { qty?: number; price?: number }) => {
    const baseline = baselinesRef.current.get(item.id);
    if (!baseline || editedRef.current.has(item.id)) return;

    const newQty = edit.qty ?? item.suggestedQuantity;
    const newPrice = edit.price ?? item.suggestedPrice;

    // Materiality gate, now applied to BOTH dimensions. A correction counts if
    // the quantity moved ≥1 unit or ≥5%, OR the price moved ≥5% (or ≥1 currency
    // unit on a cheap line). Without the price arm, a contractor could halve a
    // price and the moat would never hear about it.
    const qtyDiff = Math.abs(newQty - baseline.qty);
    const qtyMaterial = qtyDiff >= 1 || qtyDiff >= baseline.qty * 0.05;
    const priceDiff = Math.abs(newPrice - baseline.price);
    const priceMaterial = priceDiff >= 1 || priceDiff >= baseline.price * 0.05;
    if (!qtyMaterial && !priceMaterial) return;

    editedRef.current.add(item.id);
    recordDelta({
      lineItemId: item.id,
      description: item.description,
      originalQty: baseline.qty,
      newQty,
      originalUnitPrice: baseline.price,
      newUnitPrice: newPrice,
      source: baseline.source,
      trade: getCurrentTrade() || 'general',
      country: getCurrentCountry() || 'NL',
    }).catch(() => {});
  };

  const updateQuantity = (id: string, delta: number) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    const newQty = Math.max(0.5, current.suggestedQuantity + delta);
    // Capture the learning signal outside the state updater (no double-fire).
    maybeRecordEdit(current, { qty: newQty });
    setItems(items.map(item =>
      item.id === id ? { ...item, suggestedQuantity: newQty } : item
    ));
  };

  /**
   * Unit-price correction — the signal the loop was missing entirely.
   *
   * This screen had NO way to change a price: quantity had +/- buttons, price
   * was read-only. Two consequences, and the second is worse.
   *
   *  1. A contractor who saw a wrong price could not fix it here at all. On the
   *     primary quoting path, for the number they send a customer.
   *  2. recordDelta always sent `newUnitPrice: item.suggestedPrice` — the value
   *     we had just shown them — so every price delta written to
   *     quote_line_deltas was EXACTLY ZERO. predict-price and the cohort tuner
   *     read that table. The most valuable signal in the product was structurally
   *     absent while looking like it was being collected.
   *
   * Committed on blur rather than per keystroke: "12" on the way to "125" is not
   * a correction, and recording it would teach the moat a price the contractor
   * never meant.
   */
  const commitPrice = (id: string, raw: string) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    const parsed = Number(raw.replace(',', '.').replace(/[^0-9.]/g, ''));
    setPriceDraft((d) => { const n = { ...d }; delete n[id]; return n; });
    if (!Number.isFinite(parsed) || parsed <= 0) return;          // ignore junk
    if (Math.abs(parsed - current.suggestedPrice) < 0.01) return;  // no-op
    maybeRecordEdit(current, { price: parsed });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, suggestedPrice: parsed } : i)));
  };

  const selectedItems = items.filter(i => i.selected);
  const subtotal = selectedItems.reduce((sum, i) => sum + (i.suggestedPrice * i.suggestedQuantity), 0);
  // R66r50: country-aware VAT + KOR exemption. Was hardcoded 21% (NL only) —
  // DE 19% / FR/UK 20% / IT 22% / KOR 0% all rendered wrong.
  const vatRate = getEffectiveVatRate({
    country: (getCurrentCountry() as BusinessProfile['country']) ?? 'NL',
    vatScheme: getCurrentVatScheme() as VatScheme | undefined,
  });
  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;

  // ============================================
  // RENDER
  // ============================================

  // Empty state — no photos yet
  if (photos.length === 0) {
    return (
      <View testID="photo-to-quote" style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('aiQuote.title', 'AI quote')}</Text>
          {onClose && (
            <Pressable testID="ai-quote-close" onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('common.close', 'Close')}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
          )}
        </View>

        <View style={styles.emptyState}>
          <View style={styles.cameraCircle}>
            <Ionicons name="camera" size={48} color={Palette.hermesOrange} />
          </View>
          <Text style={styles.emptyTitle}>{t('aiQuote.addPhotosTitle', 'Add 3–5 photos of the job')}</Text>
          <Text style={styles.emptyDesc}>
            {t('aiQuote.addPhotosDesc', 'Multiple angles help Vasco detect materials, dimensions and work needed. Include a coin or tape measure for scale if you can.')}
          </Text>

          <Pressable style={styles.primaryBtn} onPress={takePhoto}>
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('aiQuote.takePhoto', 'Take photo')}</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={pickFromGallery}>
            <Ionicons name="images-outline" size={18} color={Palette.hermesOrange} />
            <Text style={styles.secondaryBtnText}>{t('aiQuote.pickGallery', 'Pick from gallery')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Staging state — photos added, waiting for user to tap Analyze
  if (!analysis && !analyzing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('aiQuote.readyToAnalyze', 'Ready to analyze')}</Text>
          {onClose && (
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('common.close', 'Close')}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
          )}
        </View>
        {/* Surfaces a hard analyze failure (production has no mock fallback) so
            the contractor can retry or add items manually instead of a dead end. */}
        {error && (
          <View style={[styles.errorBanner, { marginHorizontal: 20, marginTop: 8, marginBottom: 0 }]}>
            <Ionicons name="information-circle" size={16} color={SemanticColors.feedbackWarning} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <ScrollView style={styles.scrollView} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingVertical: Spacing.xs }}>
            {photos.map((p, i) => (
              <View key={p.uri + i} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.thumb} />
                <Pressable style={styles.thumbRemove} onPress={() => removePhoto(i)} accessibilityRole="button" accessibilityLabel={t('aiQuote.removePhoto', 'Remove photo')}>
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
            {!atCap && (
              <Pressable style={styles.thumbAdd} onPress={pickFromGallery} accessibilityRole="button" accessibilityLabel={t('aiQuote.addMore', 'Add more photos')}>
                <Ionicons name="add" size={28} color={Palette.hermesOrange} />
              </Pressable>
            )}
          </ScrollView>

          <Text style={{ fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary }}>
            {t('aiQuote.photosAdded', '{{count}} of {{max}} photos', { count: photos.length, max: MAX_PHOTOS })}
          </Text>

          <Pressable style={styles.primaryBtn} onPress={analyzePhotos}>
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('aiQuote.analyze', 'Analyze photos')}</Text>
          </Pressable>

          {!atCap && (
            <Pressable style={styles.secondaryBtn} onPress={takePhoto}>
              <Ionicons name="camera" size={16} color={Palette.hermesOrange} />
              <Text style={styles.secondaryBtnText}>{t('aiQuote.takeAnother', 'Take another angle')}</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    );
  }

  // Analyzing state
  if (analyzing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('aiQuote.analyzing', 'Analyzing...')}</Text>
          {onClose && (
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('common.close', 'Close')}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
          )}
        </View>
        <View style={styles.analyzingState}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.md }}>
            {photos.map((p, i) => (
              <Image key={p.uri + i} source={{ uri: p.uri }} style={styles.photoPreview} />
            ))}
          </ScrollView>
          <ActivityIndicator size="large" color={Palette.hermesOrange} />
          <Text style={styles.analyzingText}>{t('aiQuote.analyzingPhotos', 'Vasco is analyzing your photos...')}</Text>
          <Text style={styles.analyzingSubtext}>{t('aiQuote.analyzingSubtext', 'Detecting materials, quantities and prices')}</Text>
        </View>
      </View>
    );
  }

  // Results state
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{analysis?.jobType || t('aiQuote.title', 'AI quote')}</Text>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('common.close', 'Close')}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Photo preview */}
        <Image source={{ uri: photo }} style={styles.photoResult} />

        {/* Error banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="information-circle" size={16} color={SemanticColors.feedbackWarning} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('aiQuote.complexity', 'Complexity')}</Text>
            <Text style={styles.summaryValue}>{
              analysis?.complexity === 'simple' ? t('aiQuote.complexitySimple', 'Simple')
              : analysis?.complexity === 'complex' ? t('aiQuote.complexityComplex', 'Complex')
              : t('aiQuote.complexityModerate', 'Moderate')
            }</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('aiQuote.estimatedHours', 'Estimated hours')}</Text>
            <Text style={styles.summaryValue}>~{analysis?.estimatedHours || 0}{t('aiQuote.hourShort', 'h')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('aiQuote.items', 'Items')}</Text>
            <Text style={styles.summaryValue}>{selectedItems.length}/{items.length}</Text>
          </View>
        </View>

        {/* R66 round 35: cohort benchmark — only renders when k-anonymity ≥5 */}
        {photoCohort && photoCohort.contractorCount >= 5 && (
          <View style={styles.cohortCard}>
            <View style={styles.cohortHeader}>
              <Ionicons name="people-outline" size={16} color={Palette.hermesOrange} />
              <Text style={styles.cohortTitle}>
                {t('aiQuote.cohortTitle', 'Based on {{count}} similar projects', { count: photoCohort.sampleSize })}
              </Text>
            </View>
            <View style={styles.cohortRow}>
              {photoCohort.avgDurationHours != null && (
                <View style={styles.cohortItem}>
                  <Text style={styles.cohortLabel}>{t('aiQuote.cohortAvgDuration', 'Avg hours')}</Text>
                  <Text style={styles.cohortValue}>~{Math.round(photoCohort.avgDurationHours)}{t('aiQuote.hourShort', 'h')}</Text>
                </View>
              )}
              {photoCohort.medianCostEur != null && (
                <View style={styles.cohortItem}>
                  <Text style={styles.cohortLabel}>{t('aiQuote.cohortMedianCost', 'Median cost')}</Text>
                  <Text style={styles.cohortValue}>{formatCurrency0(photoCohort.medianCostEur, cohortCountry)}</Text>
                </View>
              )}
              {photoCohort.avgCostEur != null && (
                <View style={styles.cohortItem}>
                  <Text style={styles.cohortLabel}>{t('aiQuote.cohortAvgCost', 'Avg cost')}</Text>
                  <Text style={styles.cohortValue}>{formatCurrency0(photoCohort.avgCostEur, cohortCountry)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Detected items */}
        <Text style={styles.sectionTitle}>{t('aiQuote.detectedItems', 'Detected items')}</Text>
        {items.map(item => (
          <Pressable
            key={item.id}
            style={[styles.itemCard, !item.selected && styles.itemCardDeselected]}
            onPress={() => toggleItem(item.id)}
          >
            <Ionicons
              name={item.selected ? 'checkbox' : 'square-outline'}
              size={22}
              color={item.selected ? Palette.hermesOrange : SemanticColors.textTertiary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemDesc}>{item.description}</Text>
              <Text style={styles.itemCategory}>{item.category} · {t('aiQuote.confidenceLabel', '{{pct}}% confident', { pct: item.confidence })}</Text>
              {(item.needsReview || item.moatSource === 'cohort' || item.moatSource === 'scan' || item.moatSource === 'pricebook') && (
                <View style={styles.badgeRow}>
                  {item.needsReview && (
                    <View style={[styles.badge, styles.badgeReview]}>
                      <Ionicons name="alert-circle-outline" size={11} color={SemanticColors.feedbackWarning} />
                      <Text style={[styles.badgeText, { color: SemanticColors.feedbackWarning }]}>{t('aiQuote.verifyBadge', 'Verify')}</Text>
                    </View>
                  )}
                  {/* Pricebook wins outright, so it gets the most definite
                      wording: this is not an estimate, it is what they decided
                      to charge. Distinguishing the sources matters — a
                      contractor trusts "my pricebook" differently from "what
                      other contractors charge". */}
                  {item.moatSource === 'pricebook' && (
                    <View style={[styles.badge, styles.badgeMoat]}>
                      <Ionicons name="bookmark-outline" size={11} color={Palette.hermesOrange} />
                      <Text style={[styles.badgeText, { color: Palette.hermesOrange }]}>{t('aiQuote.pricebookBadge', 'From your pricebook')}</Text>
                    </View>
                  )}
                  {item.moatSource === 'scan' && (
                    <View style={[styles.badge, styles.badgeMoat]}>
                      <Ionicons name="pricetag-outline" size={11} color={Palette.hermesOrange} />
                      <Text style={[styles.badgeText, { color: Palette.hermesOrange }]}>{t('aiQuote.ownPriceBadge', 'Your price')}</Text>
                    </View>
                  )}
                  {item.moatSource === 'cohort' && (
                    <View style={[styles.badge, styles.badgeMoat]}>
                      <Ionicons name="people-outline" size={11} color={Palette.hermesOrange} />
                      <Text style={[styles.badgeText, { color: Palette.hermesOrange }]}>{t('aiQuote.cohortBadge', 'Cohort-tuned')}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={styles.itemRight}>
              <View style={styles.qtyRow}>
                <Pressable onPress={() => updateQuantity(item.id, -0.5)} style={styles.qtyBtn} accessibilityRole="button" accessibilityLabel={t('common.remove', 'Remove')}>
                  <Ionicons name="remove" size={14} color={SemanticColors.textPrimary} />
                </Pressable>
                <Text style={styles.qtyText}>{item.suggestedQuantity} {item.unit}</Text>
                <Pressable onPress={() => updateQuantity(item.id, 0.5)} style={styles.qtyBtn} accessibilityRole="button" accessibilityLabel={t('common.add', 'Add')}>
                  <Ionicons name="add" size={14} color={SemanticColors.textPrimary} />
                </Pressable>
              </View>
              {/* Unit price is EDITABLE. It is the number the contractor is most
                  likely to disagree with, and until now it was read-only — so a
                  wrong price could not be corrected on the path that produces
                  the quote, and the correction could never reach the moat. */}
              {/* The whole row is a Pressable that toggles the line on/off, so
                  the price input MUST claim the touch itself — otherwise tapping
                  to edit a price also deselects the line (or fails to focus,
                  depending on which responder wins). onStartShouldSetResponder
                  stops the gesture reaching the parent. */}
              <View
                style={styles.priceRow}
                onStartShouldSetResponder={() => true}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                <TextInput
                  style={styles.priceInput}
                  value={priceDraft[item.id] ?? String(item.suggestedPrice)}
                  onChangeText={(v: string) => setPriceDraft((d) => ({ ...d, [item.id]: v }))}
                  onBlur={() => commitPrice(item.id, priceDraft[item.id] ?? '')}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  accessibilityLabel={t('aiQuote.unitPriceLabel', 'Unit price for {{item}}', { item: item.description })}
                />
                <Text style={styles.perUnit}>/{item.unit}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatCurrency(item.suggestedPrice * item.suggestedQuantity)}</Text>
            </View>
          </Pressable>
        ))}

        {/* Notes */}
        {analysis?.notes && analysis.notes.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>{t('aiQuote.observations', 'Observations')}</Text>
            {analysis.notes.map((note, i) => (
              <View key={i} style={styles.noteRow}>
                <Ionicons name="eye-outline" size={14} color={SemanticColors.textSecondary} />
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Warnings */}
        {analysis?.warnings && analysis.warnings.length > 0 && (
          <View style={styles.warningsSection}>
            <Text style={styles.sectionTitle}>{t('aiQuote.warnings', 'Warnings')}</Text>
            {analysis.warnings.map((warning, i) => (
              <View key={i} style={styles.warningRow}>
                <Ionicons name="alert-circle-outline" size={14} color={SemanticColors.feedbackWarning} />
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('aiQuote.subtotal', 'Subtotal')}</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('aiQuote.vatRate', { defaultValue: 'VAT ({{rate}}%)', rate: vatRate })}</Text>
            <Text style={styles.totalValue}>{formatCurrency(vat)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalFinalLabel}>{t('aiQuote.total', 'Total')}</Text>
            <Text style={styles.totalFinalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.retakeBtn} onPress={() => { setPhotos([]); setAnalysis(null); setItems([]); setError(null); setPhotoCohort(null); }}>
            <Ionicons name="camera-reverse-outline" size={18} color={Palette.hermesOrange} />
            <Text style={styles.retakeBtnText}>{t('aiQuote.retake', 'Retake')}</Text>
          </Pressable>
          <Pressable
            style={[styles.createBtn, selectedItems.length === 0 && { opacity: 0.5 }]}
            onPress={() => {
              if (selectedItems.length > 0) {
                hapticSuccess();
                onCreateQuote(selectedItems, analysis?.jobType || t('aiQuote.title', 'AI quote'));
              }
            }}
            disabled={selectedItems.length === 0}
          >
            <Ionicons name="document-text-outline" size={18} color="#fff" />
            <Text style={styles.createBtnText}>Maak offerte ({selectedItems.length} items)</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, letterSpacing: -0.3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1, paddingHorizontal: 20 },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 16 },
  cameraCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: Palette.hermesOrange + '12', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: TYPE.sectionSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, textAlign: 'center' },
  emptyDesc: { fontSize: TYPE.bodySize, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary, textAlign: 'center', lineHeight: 22 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.lg, paddingVertical: 16, paddingHorizontal: 32 },
  primaryBtnText: { fontSize: TYPE.titleSize, fontFamily: 'Inter_600SemiBold', color: Palette.white },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  secondaryBtnText: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },

  // Analyzing
  analyzingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  photoPreview: { width: 200, height: 150, borderRadius: 16 },
  analyzingText: { fontSize: TYPE.titleSize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  analyzingSubtext: { fontSize: TYPE.captionSize, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },

  // Results
  photoResult: { width: '100%', height: 180, borderRadius: RADIUS.lg, marginBottom: 16 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SemanticColors.feedbackWarning + '10', borderRadius: RADIUS.md, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: 'Inter_400Regular', color: SemanticColors.feedbackWarning },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeReview: { backgroundColor: SemanticColors.feedbackWarning + '18' },
  badgeMoat: { backgroundColor: Palette.hermesOrange + '14' },
  badgeText: { fontSize: TYPE.tinySize, fontFamily: 'Inter_600SemiBold' },

  summaryRow: { flexDirection: 'row', backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 16, marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: TYPE.labelSize, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary },
  summaryValue: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, marginTop: 4 },
  cohortCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: Palette.hermesOrange + '30', padding: 14, marginBottom: 16 },
  cohortHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cohortTitle: { fontSize: TYPE.labelSize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  cohortRow: { flexDirection: 'row', gap: 12 },
  cohortItem: { flex: 1, alignItems: 'center' },
  cohortLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: SemanticColors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  cohortValue: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_800ExtraBold', color: Palette.hermesOrange, marginTop: 3 },

  sectionTitle: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, marginBottom: 10 },

  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 14, marginBottom: 8 },
  itemCardDeselected: { opacity: 0.5 },
  itemDesc: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  itemCategory: { fontSize: TYPE.labelSize, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 24, height: 24, borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: TYPE.captionSize, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary, minWidth: 50, textAlign: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  priceInput: {
    minWidth: 54,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    color: SemanticColors.textPrimary,
    fontSize: 13,
    textAlign: 'right',
  },
  perUnit: { color: SemanticColors.textSecondary, fontSize: 11 },
  itemPrice: { fontSize: TYPE.bodySize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },

  notesSection: { marginTop: 16 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  noteText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  warningsSection: { marginTop: 16 },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  warningText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: 'Inter_400Regular', color: SemanticColors.feedbackWarning },

  totalCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 16, marginTop: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: TYPE.bodySize, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary },
  totalValue: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  totalRowFinal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SemanticColors.borderDefault, paddingTop: 10, marginTop: 6 },
  totalFinalLabel: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary },
  totalFinalValue: { fontSize: TYPE.sectionSize, fontFamily: 'Archivo_800ExtraBold', color: Palette.hermesOrange },

  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  retakeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, paddingVertical: 16 },
  retakeBtnText: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
  createBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.lg, paddingVertical: 16 },
  createBtnText: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: Palette.white },

  thumbWrap: { position: 'relative', width: 84, height: 84, borderRadius: RADIUS.md, overflow: 'hidden' },
  thumb: { width: 84, height: 84, borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfaceSecondary },
  thumbRemove: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  thumbAdd: {
    width: 84, height: 84, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: Palette.hermesOrange, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
  },
});
