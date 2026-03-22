// =============================================================================
// CUSTOMER VIEW — Quote portal + decision submission
// =============================================================================
// Customer picks a tier, makes decisions, accepts/requests changes.
// ALL interactions captured for data moat (AsyncStorage + Supabase-ready).
// =============================================================================

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { useAppState } from '../../src/state/AppState';
type IconName = keyof typeof Ionicons.glyphMap;

// Data moat: every customer interaction captured → AsyncStorage + Supabase-ready
interface CustomerInteraction {
  id: string;
  quoteId: string;
  customerId: string;
  type: 'view' | 'tier_select' | 'accept' | 'reject' | 'change_request' | 'decision';
  data: Record<string, any>;
  timestamp: string;
}

async function recordInteraction(interaction: Omit<CustomerInteraction, 'id' | 'timestamp'>) {
  const entry: CustomerInteraction = {
    ...interaction,
    id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  // Save to AsyncStorage (offline-first, capped at 500 entries)
  try {
    const raw = await AsyncStorage.getItem('@vasco_customer_interactions');
    const all: CustomerInteraction[] = raw ? JSON.parse(raw) : [];
    all.push(entry);
    await AsyncStorage.setItem('@vasco_customer_interactions', JSON.stringify(all.slice(-500)));
  } catch {}
  // TODO: When Supabase active, upsert to customer_interactions table
  return entry;
}

// Mock quote — in production, loaded from deep link / Supabase
const MOCK_QUOTE = {
  id: 'q-demo-001',
  reference: 'Q-2026-0055',
  businessName: 'Van der Berg Installaties',
  businessPhone: '+31 6 12345678',
  businessEmail: 'info@vdbinstallaties.nl',
  customerId: 'cust-001',
  customerName: 'Familie de Groot',
  title: 'Warmtepomp installatie — woonkamer + slaapkamers',
  validUntil: '2026-04-20',
  tiers: [
    { id: 'goed' as const, label: 'Goed', description: 'Standaard installatie', total: 3200, features: ['Lucht-water warmtepomp 5kW', 'Basis installatie', '2 jaar garantie'] },
    { id: 'beter' as const, label: 'Beter', description: 'Aanbevolen', total: 4340, features: ['Lucht-water warmtepomp 7kW', 'Volledige installatie + isolatie', '5 jaar garantie', 'Smart thermostat'], recommended: true },
    { id: 'best' as const, label: 'Best', description: 'Premium pakket', total: 5800, features: ['Lucht-water warmtepomp 9kW', 'Premium installatie + vloerverwarming', '10 jaar garantie', 'Smart thermostat + app', 'Jaarlijks onderhoud 2 jaar'] },
  ],
  decisions: [
    { id: 'd1', question: 'Kleur buitenunit', options: ['Wit', 'Antraciet', 'Zwart'], required: true },
    { id: 'd2', question: 'Thermostaat locatie', options: ['Woonkamer', 'Gang', 'Keuken'], required: true },
    { id: 'd3', question: 'Extra radiatoren nodig?', options: ['Nee', 'Ja, 1 extra', 'Ja, 2 extra'], required: false },
  ],
  paymentTerms: '50% aanbetaling, 50% bij oplevering',
  estimatedDuration: '2 werkdagen',
};

export default function CustomerViewScreen() {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [changeMessage, setChangeMessage] = useState('');
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [viewRecorded, setViewRecorded] = useState(false);

  const fmt = (n: number) => `€${n.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;

  // Record page view for data moat
  useEffect(() => {
    if (!viewRecorded) {
      recordInteraction({ quoteId: MOCK_QUOTE.id, customerId: MOCK_QUOTE.customerId, type: 'view', data: { reference: MOCK_QUOTE.reference } });
      setViewRecorded(true);
    }
  }, [viewRecorded]);

  const handleTierSelect = (tierId: string) => {
    setSelectedTier(tierId);
    // Data moat: capture which tier customer is considering
    recordInteraction({
      quoteId: MOCK_QUOTE.id, customerId: MOCK_QUOTE.customerId, type: 'tier_select',
      data: { tierId, tierTotal: MOCK_QUOTE.tiers.find(t => t.id === tierId)?.total },
    });
  };

  const handleDecision = (decisionId: string, value: string) => {
    setDecisions(prev => ({ ...prev, [decisionId]: value }));
    // Data moat: capture every decision
    recordInteraction({
      quoteId: MOCK_QUOTE.id, customerId: MOCK_QUOTE.customerId, type: 'decision',
      data: { decisionId, value, question: MOCK_QUOTE.decisions.find(d => d.id === decisionId)?.question },
    });
  };

  const handleAccept = () => {
    if (!selectedTier) {
      Alert.alert('Kies een pakket', 'Selecteer eerst een pakket om door te gaan.');
      return;
    }
    const requiredUnanswered = MOCK_QUOTE.decisions.filter(d => d.required && !decisions[d.id]);
    if (requiredUnanswered.length > 0) {
      Alert.alert('Keuzes nodig', `Beantwoord eerst: ${requiredUnanswered.map(d => d.question).join(', ')}`);
      return;
    }
    hapticSuccess();
    // Data moat: capture acceptance with all selections
    recordInteraction({
      quoteId: MOCK_QUOTE.id, customerId: MOCK_QUOTE.customerId, type: 'accept',
      data: { tierId: selectedTier, tierTotal: MOCK_QUOTE.tiers.find(t => t.id === selectedTier)?.total, decisions, allDecisionsCompleted: Object.keys(decisions).length === MOCK_QUOTE.decisions.length },
    });
    setAccepted(true);
  };

  const handleChangeRequest = () => {
    if (!changeMessage.trim()) return;
    hapticSuccess();
    recordInteraction({
      quoteId: MOCK_QUOTE.id, customerId: MOCK_QUOTE.customerId, type: 'change_request',
      data: { message: changeMessage, selectedTier, decisions },
    });
    Alert.alert('Verstuurd', 'Uw wijzigingsverzoek is verstuurd. De installateur neemt contact met u op.');
    setShowChangeForm(false);
    setChangeMessage('');
  };

  if (accepted) {
    return (
      <View style={s.container}>
        <View style={s.successState}>
          <Ionicons name="checkmark-circle" size={64} color={SemanticColors.feedbackSuccess} />
          <Text style={s.successTitle}>Offerte geaccepteerd!</Text>
          <Text style={s.successRef}>Referentie: {MOCK_QUOTE.reference}</Text>
          <Text style={s.successDesc}>{MOCK_QUOTE.businessName} neemt binnenkort contact op om een datum te plannen.</Text>
          <Pressable style={s.successBtn} onPress={() => router.back()}>
            <Text style={s.successBtnText}>Sluiten</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Offerte</Text>
          <Text style={s.headerSub}>{MOCK_QUOTE.reference}</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Business + greeting */}
        <View style={s.bizCard}>
          <View style={s.bizBar} />
          <Text style={s.bizName}>{MOCK_QUOTE.businessName}</Text>
          <Text style={s.greeting}>Beste {MOCK_QUOTE.customerName},</Text>
          <Text style={s.greetingDesc}>Hierbij onze offerte voor: {MOCK_QUOTE.title}</Text>
        </View>

        {/* Tier selection */}
        <Text style={s.sectionTitle}>Kies uw pakket</Text>
        {MOCK_QUOTE.tiers.map(tier => (
          <Pressable
            key={tier.id}
            style={[s.tierCard, (tier as any).recommended && s.tierRecommended, selectedTier === tier.id && s.tierSelected]}
            onPress={() => handleTierSelect(tier.id)}
          >
            {(tier as any).recommended && (
              <View style={s.recBadge}><Text style={s.recBadgeText}>Aanbevolen</Text></View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={s.tierLabel}>{tier.label}</Text>
                <Text style={s.tierDesc}>{tier.description}</Text>
              </View>
              <Text style={s.tierPrice}>{fmt(tier.total)}</Text>
            </View>
            {tier.features.map((f, i) => (
              <View key={i} style={s.featureRow}>
                <Ionicons name="checkmark" size={14} color={SemanticColors.feedbackSuccess} />
                <Text style={s.featureText}>{f}</Text>
              </View>
            ))}
            {selectedTier === tier.id && (
              <View style={s.selectedCheck}>
                <Ionicons name="checkmark-circle" size={22} color={Palette.hermesOrange} />
              </View>
            )}
          </Pressable>
        ))}

        {/* Customer decisions — inline */}
        {MOCK_QUOTE.decisions.length > 0 && (
          <View style={s.decisionSection}>
            <Text style={s.sectionTitle}>Uw keuzes</Text>
            <Text style={s.sectionDesc}>Maak uw keuzes zodat we direct aan de slag kunnen</Text>
            {MOCK_QUOTE.decisions.map(d => (
              <View key={d.id} style={s.decisionCard}>
                <Text style={s.decisionQ}>
                  {d.question}{d.required ? ' *' : ''}
                </Text>
                <View style={s.optionRow}>
                  {d.options.map(opt => (
                    <Pressable
                      key={opt}
                      style={[s.optionChip, decisions[d.id] === opt && s.optionChipSelected]}
                      onPress={() => handleDecision(d.id, opt)}
                    >
                      <Text style={[s.optionText, decisions[d.id] === opt && s.optionTextSelected]}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Details */}
        <View style={s.detailsCard}>
          <View style={s.detailRow}>
            <Ionicons name="time-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={s.detailText}>Geschatte duur: {MOCK_QUOTE.estimatedDuration}</Text>
          </View>
          <View style={s.detailRow}>
            <Ionicons name="card-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={s.detailText}>{MOCK_QUOTE.paymentTerms}</Text>
          </View>
          <View style={s.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={s.detailText}>Geldig tot {new Date(MOCK_QUOTE.validUntil).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
        </View>

        {/* Actions */}
        <Pressable style={[s.acceptBtn, !selectedTier && { opacity: 0.5 }]} onPress={handleAccept}>
          <Ionicons name="checkmark-circle" size={20} color={Palette.white} />
          <Text style={s.acceptBtnText}>Offerte accepteren</Text>
        </Pressable>

        <Pressable style={s.changeBtn} onPress={() => setShowChangeForm(!showChangeForm)}>
          <Ionicons name="chatbubble-outline" size={18} color={Palette.hermesOrange} />
          <Text style={s.changeBtnText}>Wijziging aanvragen</Text>
        </Pressable>

        {showChangeForm && (
          <View style={s.changeForm}>
            <TextInput
              style={s.changeInput}
              value={changeMessage}
              onChangeText={setChangeMessage}
              placeholder="Beschrijf uw gewenste wijziging..."
              placeholderTextColor={SemanticColors.textTertiary}
              multiline
            />
            <Pressable style={s.sendChangeBtn} onPress={handleChangeRequest}>
              <Text style={s.sendChangeBtnText}>Verstuur verzoek</Text>
            </Pressable>
          </View>
        )}

        {/* Contact */}
        <View style={s.contactCard}>
          <Text style={s.contactTitle}>Vragen?</Text>
          <Text style={s.contactText}>{MOCK_QUOTE.businessPhone} · {MOCK_QUOTE.businessEmail}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: GRID.sm,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  headerSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: Palette.hermesOrange, marginTop: 1 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.md, paddingBottom: 40 },

  // Business card
  bizCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 20, overflow: 'hidden' },
  bizBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: Palette.hermesOrange },
  bizName: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, marginBottom: GRID.md },
  greeting: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  greetingDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 4 },

  sectionTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  sectionDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: -4 },

  // Tier cards
  tierCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 16, gap: 8, borderWidth: 1.5, borderColor: SemanticColors.borderDefault },
  tierRecommended: { borderColor: Palette.hermesOrange },
  tierSelected: { borderColor: Palette.hermesOrange, backgroundColor: Palette.hermesOrange + '06' },
  recBadge: { position: 'absolute', top: -1, right: 16, backgroundColor: Palette.hermesOrange, paddingHorizontal: 10, paddingVertical: 3, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  recBadgeText: { fontSize: 10, fontFamily: TYPE.titleFamily, color: Palette.white },
  tierLabel: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  tierDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  tierPrice: { fontSize: 22, fontFamily: TYPE.displayFamily, color: Palette.hermesOrange },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textPrimary },
  selectedCheck: { position: 'absolute', top: 12, right: 12 },

  // Decision section
  decisionSection: { gap: GRID.sm },
  decisionCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: 14, gap: 8 },
  decisionQ: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { backgroundColor: SemanticColors.surfaceSecondary, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: 'transparent' },
  optionChipSelected: { borderColor: Palette.hermesOrange, backgroundColor: Palette.hermesOrange + '08' },
  optionText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textPrimary },
  optionTextSelected: { color: Palette.hermesOrange, fontFamily: TYPE.titleFamily },

  // Details
  detailsCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 14, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },

  // Buttons
  acceptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: SemanticColors.feedbackSuccess, borderRadius: RADIUS.md, paddingVertical: 16 },
  acceptBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },
  changeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Palette.hermesOrange, borderRadius: RADIUS.md, paddingVertical: 14 },
  changeBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },
  changeForm: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: 14, gap: 10 },
  changeInput: { backgroundColor: PAGE_BG, borderRadius: RADIUS.sm, padding: 10, fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  sendChangeBtn: { backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' },
  sendChangeBtnText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.white },

  // Contact
  contactCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', gap: 4 },
  contactTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  contactText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },

  // Success
  successState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  successTitle: { fontSize: TYPE.displaySize, fontFamily: TYPE.displayFamily, color: SemanticColors.textPrimary },
  successRef: { fontSize: TYPE.bodySize, fontFamily: TYPE.captionFamily, color: Palette.hermesOrange },
  successDesc: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, textAlign: 'center' },
  successBtn: { backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  successBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },
});
