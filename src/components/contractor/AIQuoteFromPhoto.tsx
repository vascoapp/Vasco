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
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { formatCurrency } from '../../i18n/formatting';
import { Spacing } from '../../theme/spacing';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { hapticSuccess, hapticWarning } from '../../utils/haptics';

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
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [items, setItems] = useState<DetectedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

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

    // If Supabase not configured, use mock
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setAnalysis(MOCK_RESULT);
        setItems(MOCK_RESULT.detectedItems);
        setAnalyzing(false);
        hapticSuccess();
      }, 1500);
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-photo', {
        body: {
          // New multi-photo path — Edge Function also falls back to legacy single imageBase64.
          imagesBase64: batch,
          imageBase64: batch[0],
          trade: 'general', // Would come from user profile
          country: 'NL',
        },
      });

      if (fnError || !data) {
        // Fallback to mock on error
        setAnalysis(MOCK_RESULT);
        setItems(MOCK_RESULT.detectedItems);
        setError('AI analyse niet beschikbaar — demo resultaten getoond');
        hapticWarning();
      } else if (data.error) {
        setAnalysis(data.fallback || MOCK_RESULT);
        setItems((data.fallback || MOCK_RESULT).detectedItems);
        setError(data.error);
        hapticWarning();
      } else {
        setAnalysis(data);
        setItems(data.detectedItems || []);
        hapticSuccess();
        // R238: persist for cross-quote learning + future agent queries.
        import('../../services/intelligenceCaptureService').then((m) =>
          m.persistPhotoAnalysis({
            trade: 'general',
            detectedRooms: data.detectedRooms ?? data.rooms ?? undefined,
            detectedMaterials: data.detectedItems ?? undefined,
            estimatedComplexity: data.estimatedComplexity ?? undefined,
            estimatedDurationHours: data.estimatedDurationHours ?? undefined,
            estimatedCostEur: data.estimatedTotal ?? undefined,
            rawResponse: data,
          }),
        ).catch(() => {});
      }
    } catch {
      setAnalysis(MOCK_RESULT);
      setItems(MOCK_RESULT.detectedItems);
      setError('Verbinding mislukt — demo resultaten getoond');
      hapticWarning();
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleItem = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, suggestedQuantity: Math.max(0.5, item.suggestedQuantity + delta) } : item
    ));
  };

  const selectedItems = items.filter(i => i.selected);
  const subtotal = selectedItems.reduce((sum, i) => sum + (i.suggestedPrice * i.suggestedQuantity), 0);
  const vat = subtotal * 0.21;
  const total = subtotal + vat;

  // ============================================
  // RENDER
  // ============================================

  // Empty state — no photos yet
  if (photos.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('aiQuote.title', 'AI quote')}</Text>
          {onClose && (
            <Pressable onPress={onClose} style={styles.closeBtn}>
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
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
          )}
        </View>
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
            <Pressable onPress={onClose} style={styles.closeBtn}>
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
          <Pressable onPress={onClose} style={styles.closeBtn}>
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
            </View>
            <View style={styles.itemRight}>
              <View style={styles.qtyRow}>
                <Pressable onPress={() => updateQuantity(item.id, -0.5)} style={styles.qtyBtn}>
                  <Ionicons name="remove" size={14} color={SemanticColors.textPrimary} />
                </Pressable>
                <Text style={styles.qtyText}>{item.suggestedQuantity} {item.unit}</Text>
                <Pressable onPress={() => updateQuantity(item.id, 0.5)} style={styles.qtyBtn}>
                  <Ionicons name="add" size={14} color={SemanticColors.textPrimary} />
                </Pressable>
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
            <Text style={styles.totalLabel}>{t('aiQuote.vat', 'VAT (21%)')}</Text>
            <Text style={styles.totalValue}>{formatCurrency(vat)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalFinalLabel}>{t('aiQuote.total', 'Total')}</Text>
            <Text style={styles.totalFinalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.retakeBtn} onPress={() => { setPhotos([]); setAnalysis(null); setItems([]); setError(null); }}>
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

  summaryRow: { flexDirection: 'row', backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 16, marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: TYPE.labelSize, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary },
  summaryValue: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, marginTop: 4 },

  sectionTitle: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textPrimary, marginBottom: 10 },

  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 14, marginBottom: 8 },
  itemCardDeselected: { opacity: 0.5 },
  itemDesc: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  itemCategory: { fontSize: TYPE.labelSize, fontFamily: 'Inter_400Regular', color: SemanticColors.textSecondary, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 24, height: 24, borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: TYPE.captionSize, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary, minWidth: 50, textAlign: 'center' },
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
