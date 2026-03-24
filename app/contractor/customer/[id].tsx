// =============================================================================
// CUSTOMER DETAIL — Transaction history, quotes, invoices, lifetime value
// =============================================================================

import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../../src/theme/tabStyles';
import { SafeArea } from '../../../src/theme/spacing';
import { useAppState } from '../../../src/state/AppState';
import { FadeIn } from '../../../src/components/shared/FadeIn';

type IconName = keyof typeof Ionicons.glyphMap;

export default function CustomerDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { customers, jobs, quotes, invoices } = useAppState();

  const customer = useMemo(() => customers.find(c => c.id === id), [customers, id]);
  const customerJobs = useMemo(() => jobs.filter((j: any) => j.customerId === id), [jobs, id]);
  const customerQuotes = useMemo(() => quotes.filter((q: any) => q.customer === id || q.customer === customer?.name), [quotes, id, customer]);
  const customerInvoices = useMemo(() => invoices.filter((i: any) => i.customer === id || i.customer === customer?.name), [invoices, id, customer]);

  const totalSpent = useMemo(() =>
    customerInvoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.amount ?? 0), 0),
    [customerInvoices]
  );
  const totalQuoted = useMemo(() =>
    customerQuotes.reduce((s: number, q: any) => s + (q.amount ?? 0), 0),
    [customerQuotes]
  );

  if (!customer) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Klant niet gevonden</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerTitle}>{customer.name}</Text>
          <Text style={s.headerSub}>{[customer.email, customer.phone].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* KPI row */}
        <FadeIn delay={0}>
          <View style={s.kpiRow}>
            <View style={s.kpi}>
              <Text style={s.kpiValue}>€{totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
              <Text style={s.kpiLabel}>Besteed</Text>
            </View>
            <View style={s.kpiDivider} />
            <View style={s.kpi}>
              <Text style={s.kpiValue}>{customerJobs.length}</Text>
              <Text style={s.kpiLabel}>Klussen</Text>
            </View>
            <View style={s.kpiDivider} />
            <View style={s.kpi}>
              <Text style={s.kpiValue}>{customerQuotes.length}</Text>
              <Text style={s.kpiLabel}>Offertes</Text>
            </View>
            <View style={s.kpiDivider} />
            <View style={s.kpi}>
              <Text style={s.kpiValue}>{customerInvoices.length}</Text>
              <Text style={s.kpiLabel}>Facturen</Text>
            </View>
          </View>
        </FadeIn>

        {/* Quick actions */}
        <FadeIn delay={50}>
          <View style={s.actions}>
            <Pressable style={s.actionBtn} onPress={() => router.push('/contractor/tiered-quote' as any)}>
              <Ionicons name="document-text-outline" size={20} color={Palette.hermesOrange} />
              <Text style={s.actionBtnText}>Offerte</Text>
            </Pressable>
            <Pressable style={s.actionBtn} onPress={() => { if (customer.phone) { Linking.openURL(`tel:${customer.phone}`); } }}>
              <Ionicons name="call-outline" size={20} color={Palette.hermesOrange} />
              <Text style={s.actionBtnText}>Bellen</Text>
            </Pressable>
            <Pressable style={s.actionBtn} onPress={() => { if (customer.email) { Linking.openURL(`mailto:${customer.email}`); } }}>
              <Ionicons name="mail-outline" size={20} color={Palette.hermesOrange} />
              <Text style={s.actionBtnText}>E-mail</Text>
            </Pressable>
          </View>
        </FadeIn>

        {/* Jobs */}
        {customerJobs.length > 0 && (
          <FadeIn delay={100}>
            <Text style={s.sectionTitle}>Klussen ({customerJobs.length})</Text>
            {customerJobs.map((job: any) => (
              <Pressable key={job.id} style={s.card} onPress={() => router.push(`/quotes/${job.id}` as any)}>
                <View style={[s.accent, { backgroundColor: job.status === 'completed' ? SemanticColors.feedbackSuccess : Palette.hermesOrange }]} />
                <View style={s.cardContent}>
                  <Text style={s.cardTitle} numberOfLines={1}>{job.title}</Text>
                  <Text style={s.cardMeta}>{job.status} · €{(job.quotedAmount ?? 0).toLocaleString(undefined)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </FadeIn>
        )}

        {/* Quotes */}
        {customerQuotes.length > 0 && (
          <FadeIn delay={150}>
            <Text style={s.sectionTitle}>Offertes ({customerQuotes.length})</Text>
            {customerQuotes.map((q: any) => (
              <Pressable key={q.id} style={s.card} onPress={() => router.push(`/quotes/${q.id}` as any)}>
                <View style={[s.accent, { backgroundColor: q.status === 'accepted' ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary }]} />
                <View style={s.cardContent}>
                  <Text style={s.cardTitle} numberOfLines={1}>{q.id} — {q.job || 'Offerte'}</Text>
                  <Text style={s.cardMeta}>{q.status} · €{(q.amount ?? 0).toLocaleString(undefined)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </FadeIn>
        )}

        {/* Invoices */}
        {customerInvoices.length > 0 && (
          <FadeIn delay={200}>
            <Text style={s.sectionTitle}>Facturen ({customerInvoices.length})</Text>
            {customerInvoices.map((inv: any) => (
              <Pressable key={inv.id} style={s.card} onPress={() => router.push(`/invoices/${inv.id}` as any)}>
                <View style={[s.accent, { backgroundColor: inv.status === 'paid' ? SemanticColors.feedbackSuccess : inv.status === 'overdue' ? SemanticColors.feedbackError : Palette.hermesOrange }]} />
                <View style={s.cardContent}>
                  <Text style={s.cardTitle} numberOfLines={1}>{inv.id}</Text>
                  <Text style={s.cardMeta}>{inv.status} · €{(inv.amount ?? 0).toLocaleString(undefined)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </FadeIn>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12 },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  headerSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.md },
  kpiRow: { flexDirection: 'row', backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 16 },
  kpi: { flex: 1, alignItems: 'center' },
  kpiValue: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  kpiLabel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  kpiDivider: { width: 1, height: 28, backgroundColor: SemanticColors.borderDefault },
  actions: { flexDirection: 'row', gap: GRID.sm },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.sm, backgroundColor: Palette.hermesOrange + '10', borderRadius: RADIUS.lg, paddingVertical: 12 },
  actionBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking, marginTop: GRID.sm },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  accent: { width: 4, alignSelf: 'stretch' },
  cardContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  cardTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  cardMeta: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
});
