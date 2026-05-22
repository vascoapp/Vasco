// =============================================================================
// CUSTOMER VIEW — Quote portal + decision submission
// =============================================================================
// Customer picks a tier, makes decisions, accepts/requests changes.
// ALL interactions captured for data moat (AsyncStorage + Supabase-ready).
// =============================================================================

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { useAppState } from '../../src/state/AppState';
import { useAuth } from '../../src/context/AuthContext';
import { isSupabaseConfigured, supabase } from '../../src/lib/supabase';
import { formatCurrency } from '../../src/i18n/formatting';
import type { Country } from '../../src/i18n/formatting';
import { DEMO_MODE } from '../../src/config/demo';
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
  // Best-effort Supabase upsert for the data moat
  if (isSupabaseConfigured) {
    try {
      await (supabase.from('customer_interactions' as any) as any).insert({
        id: entry.id,
        quote_id: entry.quoteId,
        customer_id: entry.customerId,
        type: entry.type,
        data: entry.data,
        created_at: entry.timestamp,
      });
    } catch {}
  }
  return entry;
}

// R38: was used as preview fixture AND as field fallback when real quote
// rows lacked optional fields (businessName, title, tiers). Field-level
// fallback meant real customers in edge cases saw "Van der Berg Installaties"
// / "Warmtepomp installatie" stitched into their actual quote. Now used
// only as preview fixture in DEMO_MODE (no quoteId path); production builds
// fall through to the empty-quote shape below.
const EMPTY_QUOTE: typeof DEMO_QUOTE = {
  id: '', reference: '', businessName: '', businessPhone: '', businessEmail: '',
  customerId: '', customerName: '', title: '', validUntil: '',
  tiers: [], decisions: [], paymentTerms: '', estimatedDuration: '',
};
const DEMO_QUOTE = {
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
  const { t } = useTranslation();
  const router = useRouter();
  const { quoteId, t: tokenParam } = useLocalSearchParams<{ quoteId?: string; t?: string }>();
  const { quotes, customers, convertQuoteToJob } = useAppState();
  const [remoteQuote, setRemoteQuote] = useState<typeof DEMO_QUOTE | null>(null);

  // If the URL carries a signed token, fetch the quote via the public Edge
  // Function. This is how external customers (not authed) see their own quote.
  useEffect(() => {
    if (!quoteId || !tokenParam) return;
    let cancelled = false;
    import('../../src/services/publicQuotePortalService').then(async (mod) => {
      const result = await mod.fetchQuoteByToken(String(quoteId), String(tokenParam));
      if (cancelled || !result.ok || !result.quote) return;
      const q = result.quote;
      setRemoteQuote({
        id: q.id,
        reference: q.reference,
        // R38: was `?? DEMO_QUOTE.businessName` — real customers in edge
        // cases saw "Van der Berg Installaties" stitched into their actual
        // quote when the BE returned a row missing business_name. Now ''
        // honestly so the UI renders empty / hides the field.
        businessName: q.business?.business_name ?? '',
        businessPhone: q.business?.phone ?? '',
        businessEmail: q.business?.email ?? '',
        customerId: '',
        customerName: q.customer?.name ?? '',
        title: (q.metadata as any)?.title ?? '',
        validUntil: (q.metadata as any)?.validUntil ?? '',
        tiers: (q.metadata as any)?.tiers ?? [
          { id: 'only' as const, label: 'Offerte', description: '', total: q.total, features: q.lines.map((l) => l.description) },
        ],
        decisions: [],
        paymentTerms: (q.metadata as any)?.paymentTerms ?? '',
        estimatedDuration: (q.metadata as any)?.estimatedDuration ?? '',
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [quoteId, tokenParam]);

  // R38: load real quote from AppState if quoteId provided. Was returning
  // DEMO_QUOTE as both field-fallback AND no-quoteId fallback so non-DEMO
  // customers could see "Van der Berg Installaties / Familie de Groot /
  // Warmtepomp installatie" pieces stitched into their real quote (or as
  // the entire quote if quoteId was missing). Production now falls through
  // to EMPTY_QUOTE; DEMO_MODE preserves the preview fixture for dev.
  const quote: typeof DEMO_QUOTE = (() => {
    if (remoteQuote) return remoteQuote;
    if (quoteId) {
      const real = quotes.find(q => q.id === quoteId);
      if (real) {
        const cust = customers.find(c => c.id === real.customerId);
        return {
          id: real.id,
          reference: (real as any).reference ?? real.id,
          businessName: (real as any).businessName ?? '',
          businessPhone: (real as any).businessPhone ?? '',
          businessEmail: (real as any).businessEmail ?? '',
          customerId: real.customerId ?? '',
          customerName: cust?.name ?? (real as any).customerName ?? '',
          title: (real as any).title ?? (real as any).description ?? '',
          validUntil: (real as any).validUntil ?? '',
          tiers: (real as any).tiers ?? [],
          decisions: (real as any).decisions ?? [],
          paymentTerms: (real as any).paymentTerms ?? '',
          estimatedDuration: (real as any).estimatedDuration ?? '',
        };
      }
    }
    return DEMO_MODE ? DEMO_QUOTE : EMPTY_QUOTE;
  })();

  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [changeMessage, setChangeMessage] = useState('');
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [viewRecorded, setViewRecorded] = useState(false);

  const { user } = useAuth();
  const fmt = (n: number) => formatCurrency(n, (user?.country ?? 'NL') as Country);

  // Record page view for data moat
  useEffect(() => {
    if (!viewRecorded) {
      recordInteraction({ quoteId: quote.id, customerId: quote.customerId, type: 'view', data: { reference: quote.reference } });
      setViewRecorded(true);
    }
  }, [viewRecorded]);

  const handleTierSelect = (tierId: string) => {
    setSelectedTier(tierId);
    // Data moat: capture which tier customer is considering
    recordInteraction({
      quoteId: quote.id, customerId: quote.customerId, type: 'tier_select',
      data: { tierId, tierTotal: quote.tiers.find(t => t.id === tierId)?.total },
    });
  };

  const handleDecision = (decisionId: string, value: string) => {
    setDecisions(prev => ({ ...prev, [decisionId]: value }));
    // Data moat: capture every decision
    recordInteraction({
      quoteId: quote.id, customerId: quote.customerId, type: 'decision',
      data: { decisionId, value, question: quote.decisions.find(d => d.id === decisionId)?.question },
    });
    // Close the customer↔contractor loop: submit into the shared
    // decision_submissions table so the contractor's Decisions screen
    // surfaces the new value in realtime.
    import('../../src/services/decisionSyncService').then((mod) =>
      mod.submitDecision({
        trackerId: quote.id,
        itemId: decisionId,
        submittedBy: 'customer',
        value,
        submittedAt: new Date().toISOString(),
      }).catch(() => {}),
    ).catch(() => {});
  };

  const handleAccept = async () => {
    if (!selectedTier) {
      Alert.alert(t('customerView.pickTierTitle', 'Pick a package'), t('customerView.pickTierDesc', 'Select a package first to continue.'));
      return;
    }
    const requiredUnanswered = quote.decisions.filter(d => d.required && !decisions[d.id]);
    if (requiredUnanswered.length > 0) {
      Alert.alert(t('customerView.choicesNeeded', 'Choices needed'), t('customerView.answerFirst', 'Answer first: {{questions}}', { questions: requiredUnanswered.map(d => d.question).join(', ') }));
      return;
    }
    hapticSuccess();
    // Data moat: capture acceptance with all selections
    await recordInteraction({
      quoteId: quote.id, customerId: quote.customerId, type: 'accept',
      data: { tierId: selectedTier, tierTotal: quote.tiers.find(t => t.id === selectedTier)?.total, decisions, allDecisionsCompleted: Object.keys(decisions).length === quote.decisions.length },
    });
    // Golden path: auto-create a job from the accepted quote (if this is a real quote from AppState)
    if (quoteId) {
      try {
        await convertQuoteToJob(quote.id);
      } catch {
        // Non-blocking — user still sees the success state
      }
    }
    setAccepted(true);
  };

  const handleChangeRequest = () => {
    if (!changeMessage.trim()) return;
    hapticSuccess();
    recordInteraction({
      quoteId: quote.id, customerId: quote.customerId, type: 'change_request',
      data: { message: changeMessage, selectedTier, decisions },
    });
    Alert.alert(t('customerView.sentTitle', 'Sent'), t('customerView.changeRequestSent', 'Your change request has been sent. The contractor will contact you.'));
    setShowChangeForm(false);
    setChangeMessage('');
  };

  if (accepted) {
    return (
      <View style={s.container}>
        <View style={s.successState}>
          <Ionicons name="checkmark-circle" size={64} color={SemanticColors.feedbackSuccess} />
          <Text style={s.successTitle}>{t('customerView.acceptedTitle', 'Quote accepted!')}</Text>
          <Text style={s.successRef}>{t('customerView.reference', 'Reference')}: {quote.reference}</Text>
          <Text style={s.successDesc}>{t('customerView.acceptedDesc', '{{business}} will be in touch shortly to schedule.', { business: quote.businessName })}</Text>
          <Pressable style={s.successBtn} onPress={() => router.back()}>
            <Text style={s.successBtnText}>{t('common.close', 'Close')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('customerView.quote', 'Quote')}</Text>
          <Text style={s.headerSub}>{quote.reference}</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Business + greeting */}
        <View style={s.bizCard}>
          <View style={s.bizBar} />
          <Text style={s.bizName}>{quote.businessName}</Text>
          <Text style={s.greeting}>{t('customerView.dear', 'Dear {{name}},', { name: quote.customerName })}</Text>
          <Text style={s.greetingDesc}>{t('customerView.quoteFor', 'Our quote for: {{title}}', { title: quote.title })}</Text>
        </View>

        {/* Tier selection */}
        <Text style={s.sectionTitle}>{t('customerView.pickPackage', 'Pick your package')}</Text>
        {quote.tiers.map(tier => (
          <Pressable
            key={tier.id}
            style={[s.tierCard, (tier as any).recommended && s.tierRecommended, selectedTier === tier.id && s.tierSelected]}
            onPress={() => handleTierSelect(tier.id)}
          >
            {(tier as any).recommended && (
              <View style={s.recBadge}><Text style={s.recBadgeText}>{t('customerView.recommended', 'Recommended')}</Text></View>
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
        {quote.decisions.length > 0 && (
          <View style={s.decisionSection}>
            <Text style={s.sectionTitle}>{t('customerView.yourChoices', 'Your choices')}</Text>
            <Text style={s.sectionDesc}>{t('customerView.yourChoicesDesc', 'Make your choices so we can start right away')}</Text>
            {quote.decisions.map(d => (
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

        {/* Customer Payment Preference (shown when customer selected a payment method) */}
        {decisions['payment_method'] && (
          <View style={s.paymentPrefCard}>
            <View style={s.paymentPrefHeader}>
              <Ionicons name="card" size={18} color={Palette.hermesOrange} />
              <Text style={s.paymentPrefTitle}>{t('customerView.paymentPref', 'Customer payment preference')}</Text>
            </View>
            <Text style={s.paymentPrefValue}>
              {t('customerView.paymentPrefValue', 'Customer prefers: {{method}}', { method: decisions['payment_method'] })}
            </Text>
          </View>
        )}

        {/* Details */}
        <View style={s.detailsCard}>
          <View style={s.detailRow}>
            <Ionicons name="time-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={s.detailText}>{t('customerView.estimatedDuration', 'Estimated duration')}: {quote.estimatedDuration}</Text>
          </View>
          <View style={s.detailRow}>
            <Ionicons name="card-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={s.detailText}>{quote.paymentTerms}</Text>
          </View>
          <View style={s.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={s.detailText}>{t('customerView.validUntil', 'Valid until {{date}}', { date: new Date(quote.validUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) })}</Text>
          </View>
        </View>

        {/* Actions */}
        <Pressable style={[s.acceptBtn, !selectedTier && { opacity: 0.5 }]} onPress={handleAccept}>
          <Ionicons name="checkmark-circle" size={20} color={Palette.white} />
          <Text style={s.acceptBtnText}>{t('customerView.acceptQuote', 'Accept quote')}</Text>
        </Pressable>

        <Pressable style={s.changeBtn} onPress={() => setShowChangeForm(!showChangeForm)}>
          <Ionicons name="chatbubble-outline" size={18} color={Palette.hermesOrange} />
          <Text style={s.changeBtnText}>{t('customerView.requestChange', 'Request a change')}</Text>
        </Pressable>

        {showChangeForm && (
          <View style={s.changeForm}>
            <TextInput
              style={s.changeInput}
              value={changeMessage}
              onChangeText={setChangeMessage}
              placeholder={t('customerView.describeChange', 'Describe the change you want…')}
              placeholderTextColor={SemanticColors.textTertiary}
              multiline
            />
            <Pressable style={s.sendChangeBtn} onPress={handleChangeRequest}>
              <Text style={s.sendChangeBtnText}>{t('customerView.sendRequest', 'Send request')}</Text>
            </Pressable>
          </View>
        )}

        {/* Contact */}
        <View style={s.contactCard}>
          <Text style={s.contactTitle}>{t('customerView.questions', 'Questions?')}</Text>
          <Text style={s.contactText}>{quote.businessPhone} · {quote.businessEmail}</Text>
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
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
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

  // Payment Preference
  paymentPrefCard: { backgroundColor: Palette.hermesOrange + '08', borderRadius: RADIUS.lg, padding: 14, gap: 8, borderWidth: 1.5, borderColor: Palette.hermesOrange + '30' },
  paymentPrefHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  paymentPrefTitle: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },
  paymentPrefValue: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },

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
