// =============================================================================
// Tiered Quote Builder — 2-step: select services → preview with Vasco insights
// =============================================================================
// Step 1: Trade-tailored pricebook + quantity controls
// Step 2: Preview tiers + Vasco AI (calibration, pricing, tips) → send
// =============================================================================

import { useEffect, useState, useMemo } from 'react';
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
import { intelligence } from '../../intelligence/intelligenceEngine';
import { useQuoteCalibration } from '../../services/estimationFeedbackService';
import { predictPrice, type PricePrediction } from '../../intelligence/predictions';
import { predictQuoteWin, type QuoteWinPrediction } from '../../intelligence/mlModels';
import { useAuth } from '../../context/AuthContext';
import { searchCatalog, type CatalogItem } from '../../integrations/suppliers';
import { AIQuoteFromPhoto } from './AIQuoteFromPhoto';
import { useQuoteTemplates, type QuoteTemplate, TEMPLATE_CATEGORIES } from '../../services/quoteTemplateService';
import { hapticSuccess } from '../../utils/haptics';

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

  // AI predictions
  useEffect(() => {
    predictPrice({ trade, country }).then(setPriceSuggestion).catch(() => {});
  }, [trade, country]);

  useEffect(() => {
    if (selectedServices.length > 0) {
      const total = selectedServices.reduce((s, sv) => s + sv.item.basePrice * sv.quantity, 0);
      predictQuoteWin({ trade, amount: total }).then(setWinPrediction).catch(() => {});
    }
  }, [selectedServices.length, trade]);

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
    if (qty <= 0) removeService(itemId);
    else setSelectedServices(selectedServices.map(s => s.item.id === itemId ? { ...s, quantity: qty } : s));
  };

  const loadTemplate = (template: QuoteTemplate) => {
    useTemplate(template.id);
    const mapped = template.items.map((item, idx) => ({
      item: { id: `tpl-${template.id}-${idx}`, contractorId: '', name: item.description, description: `${template.name}`, category: item.type === 'labour' ? 'labour' : 'materials', pricingType: 'fixed', basePrice: item.unitPrice, unit: item.unit } as unknown as PricebookItem,
      quantity: item.quantity, unit: item.unit,
    }));
    setSelectedServices(mapped);
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
            'Geen overeenkomsten',
            `Geen diensten gevonden voor "${scopeText}". Voeg diensten handmatig toe via de prijslijst.`,
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

    setTimeout(() => {
      setSelectedServices(prev => [...prev, ...matchedClean]);
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
      eventType: 'quote_sent', userId: 'current-user', sessionId: 'current',
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
            <Ionicons name="arrow-back" size={22} color={SemanticColors.textPrimary} />
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
          </View>

          {/* Services section */}
          <View style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.sectionTitle}>{TRADE_LABELS[trade] ?? 'Diensten'}</Text>
              <Pressable style={s.addBtn} onPress={() => setShowPricebook(true)}>
                <Ionicons name="add" size={16} color={Palette.hermesOrange} />
                <Text style={s.addBtnText}>Toevoegen</Text>
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
              setShowAIQuote(false);
            }}
            onClose={() => setShowAIQuote(false)}
          />
        </Modal>
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
          <Ionicons name="arrow-back" size={22} color={SemanticColors.textPrimary} />
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
        </View>

        {/* Tier preview cards */}
        <Text style={s.sectionTitle}>Klant ziet drie opties</Text>
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
            {selectedServices.map(sv => (
              <View key={sv.item.id} style={s.serviceRow}>
                <Text style={s.serviceName}>{sv.item.name}</Text>
                <Text style={s.servicePrice}>{sv.quantity} × {fmt(sv.item.basePrice * 1.25)}</Text>
              </View>
            ))}
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
  serviceRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SemanticColors.borderDefault,
  },
  serviceName: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  servicePrice: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },

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
  recRibbonText: { fontSize: 8, fontFamily: TYPE.titleFamily, color: Palette.white, letterSpacing: 0.5 },
  tierIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  tierName: { fontSize: TYPE.captionSize, fontFamily: TYPE.sectionFamily },
  tierPrice: { fontSize: TYPE.sectionSize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary, marginTop: 2 },
  tierVat: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textTertiary },
  tierFeature: { fontSize: 9, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, flex: 1 },

  upsellRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SemanticColors.feedbackSuccess + '10', borderRadius: RADIUS.md, padding: 10 },
  upsellText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.feedbackSuccess },
});
