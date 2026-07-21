// =============================================================================
// CUSTOMER DETAIL — Transaction history, quotes, invoices, lifetime value
// R270: smart-reply chips above the action buttons (Google-Inbox style).
// =============================================================================

import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Modal, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../../src/theme/tabStyles';
import { SafeArea } from '../../../src/theme/spacing';
import { useAppState } from '../../../src/state/AppState';
import { useAuth } from '../../../src/context/AuthContext';
import { formatCurrency, type Country } from '../../../src/i18n/formatting';
import { FadeIn } from '../../../src/components/shared/FadeIn';
import { generateSmartReplies, type SmartReply } from '../../../src/services/customerSmartReplyService';
import { useCustomerInbox, type InboundChannel } from '../../../src/services/customerInboxService';
import { recordImpression, recordTap, primeCache as primeReplyCache } from '../../../src/services/smartReplyLearningService';
import { hapticSuccess } from '../../../src/utils/haptics';

type IconName = keyof typeof Ionicons.glyphMap;

export default function CustomerDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { customers, jobs, quotes, invoices } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;

  // Status enums must render in the app locale, not as raw English
  // ('completed', 'accepted', 'overdue' leaked straight onto the cards).
  // Missing keys (e.g. job 'cancelled') fall back to a humanised label.
  const humanize = (v: string) => v.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const jobStatusLabel = (raw: string) => {
    const key = ({ 'in-progress': 'inProgress', in_progress: 'inProgress', quoted: 'quote' } as Record<string, string>)[raw] ?? raw;
    return t(`jobs.status.${key}`, humanize(raw));
  };
  const quoteStatusLabel = (raw: string) => t(`quotes.status.${raw}`, humanize(raw));
  const invoiceStatusLabel = (raw: string) => t(`invoices.status.${raw}`, humanize(raw));

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

  // R271: customer inbox — captured inbound messages feed smart replies
  const inbox = useCustomerInbox(id);
  const [inboxModalOpen, setInboxModalOpen] = useState(false);
  const [inboxDraft, setInboxDraft] = useState('');
  const [inboxChannel, setInboxChannel] = useState<InboundChannel>('whatsapp');

  // Prime the smart-reply learning cache once on mount so getChipMultiplier
  // has stats before the first scoring pass.
  useEffect(() => { primeReplyCache().catch(() => {}); }, []);

  // R270: Google-style smart replies — surface 3 context-aware snippets.
  // R271: lastInboundMessage now reads from the customer inbox.
  const smartReplies = useMemo<SmartReply[]>(() => {
    if (!customer) return [];
    const sortByDate = (arr: any[], key: string) =>
      [...arr].sort((a, b) => new Date(b[key] ?? 0).getTime() - new Date(a[key] ?? 0).getTime());
    const latestQ = sortByDate(customerQuotes, 'sentAt')[0] ?? sortByDate(customerQuotes, 'createdAt')[0];
    const latestI = sortByDate(customerInvoices, 'sentAt')[0] ?? sortByDate(customerInvoices, 'createdAt')[0];
    const latestJ = sortByDate(customerJobs, 'updatedAt')[0] ?? sortByDate(customerJobs, 'createdAt')[0];
    return generateSmartReplies({
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      latestQuote: latestQ ? {
        id: latestQ.id, status: latestQ.status,
        sentAt: latestQ.sentAt ?? latestQ.createdAt,
        amount: latestQ.amount,
      } : undefined,
      latestInvoice: latestI ? {
        id: latestI.id, status: latestI.status,
        sentAt: latestI.sentAt ?? latestI.createdAt,
        dueInDays: latestI.dueInDays,
        amount: latestI.amount,
      } : undefined,
      latestJob: latestJ ? {
        id: latestJ.id, title: latestJ.title, status: latestJ.status,
        completedAt: latestJ.completedAt,
      } : undefined,
      isNewCustomer: customerJobs.length === 0 && customerQuotes.length === 0,
      lastInboundMessage: inbox.latest?.body,
    });
  }, [customer, customerQuotes, customerInvoices, customerJobs, inbox.latest]);

  // R271: record impressions whenever new chips are about to render.
  useEffect(() => {
    smartReplies.forEach((r) => { recordImpression(r.id).catch(() => {}); });
  }, [smartReplies]);

  const sendSmartReply = (reply: SmartReply) => {
    hapticSuccess();
    // R271: track the tap so the learning loop can dampen unused suggestions.
    recordTap(reply.id).catch(() => {});
    const body = encodeURIComponent(reply.body);
    if (reply.channel === 'whatsapp' && customer?.phone) {
      Linking.openURL(`whatsapp://send?phone=${customer.phone.replace(/\s/g, '')}&text=${body}`).catch(() => {});
    } else if (reply.channel === 'sms' && customer?.phone) {
      Linking.openURL(`sms:${customer.phone}?body=${body}`).catch(() => {});
    } else if (reply.channel === 'email' && customer?.email) {
      Linking.openURL(`mailto:${customer.email}?body=${body}`).catch(() => {});
    }
  };

  const saveInboundMessage = async () => {
    const body = inboxDraft.trim();
    if (!body) return;
    await inbox.add(body, inboxChannel);
    setInboxDraft('');
    setInboxModalOpen(false);
    hapticSuccess();
  };

  if (!customer) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>{t('customer.notFound', 'Customer not found')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
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
              <Text style={s.kpiValue}>{formatCurrency(totalSpent, country)}</Text>
              <Text style={s.kpiLabel}>{t('customer.spent', 'Spent')}</Text>
            </View>
            <View style={s.kpiDivider} />
            <View style={s.kpi}>
              <Text style={s.kpiValue}>{customerJobs.length}</Text>
              <Text style={s.kpiLabel}>{t('customer.jobs', 'Jobs')}</Text>
            </View>
            <View style={s.kpiDivider} />
            <View style={s.kpi}>
              <Text style={s.kpiValue}>{customerQuotes.length}</Text>
              <Text style={s.kpiLabel}>{t('customer.quotes', 'Quotes')}</Text>
            </View>
            <View style={s.kpiDivider} />
            <View style={s.kpi}>
              <Text style={s.kpiValue}>{customerInvoices.length}</Text>
              <Text style={s.kpiLabel}>{t('customer.invoices', 'Invoices')}</Text>
            </View>
          </View>
        </FadeIn>

        {/* R271: Inbound message inbox — captured customer messages feed
             smart-reply context. Shows latest inbound + "Capture" CTA. */}
        <FadeIn delay={30}>
          <View style={s.inboxHeader}>
            <Ionicons name="chatbox-ellipses-outline" size={12} color={SemanticColors.textTertiary} />
            <Text style={s.inboxHeaderText}>{t('inbox.fromCustomer', 'From customer').toUpperCase()}</Text>
            <Pressable
              onPress={() => setInboxModalOpen(true)}
              hitSlop={8}
              style={{ marginLeft: 'auto' }}
              accessibilityRole="button"
              accessibilityLabel={t('inbox.capture', 'Capture inbound message')}
            >
              <Text style={s.inboxCapture}>+ {t('inbox.capture', 'Capture').toUpperCase()}</Text>
            </Pressable>
          </View>
          {inbox.latest ? (
            <View style={s.inboxBubble}>
              <Text style={s.inboxBody} numberOfLines={4}>{inbox.latest.body}</Text>
              <View style={s.inboxMeta}>
                <Ionicons
                  name={inbox.latest.channel === 'whatsapp' ? 'logo-whatsapp' : inbox.latest.channel === 'email' ? 'mail-outline' : inbox.latest.channel === 'sms' ? 'chatbubble-outline' : inbox.latest.channel === 'phone' ? 'call-outline' : 'ellipsis-horizontal'}
                  size={11}
                  color={SemanticColors.textTertiary}
                />
                <Text style={s.inboxMetaText}>
                  {new Date(inbox.latest.capturedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  {inbox.messages.length > 1 ? ` · +${inbox.messages.length - 1} more` : ''}
                </Text>
                <Pressable
                  onPress={() => inbox.latest && inbox.remove(inbox.latest.id)}
                  hitSlop={6}
                  style={{ marginLeft: 'auto' }}
                  accessibilityRole="button"
                  accessibilityLabel={t('inbox.delete', 'Delete')}
                >
                  <Ionicons name="close" size={14} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={s.inboxEmpty}>
              <Text style={s.inboxEmptyText}>{t('inbox.empty', 'No customer messages yet. Tap Capture when they reach out.')}</Text>
            </View>
          )}
        </FadeIn>

        {/* R270: Smart-reply chips — Google-Inbox style 1-tap replies.
             Single ingress to message-templates lives here too — no other
             entry points elsewhere. */}
        {smartReplies.length > 0 && (
          <FadeIn delay={40}>
            <View style={s.smartReplyHeader}>
              <Ionicons name="sparkles" size={12} color={Palette.hermesOrange} />
              <Text style={s.smartReplyHeaderText}>{t('smartReply.suggested', 'Suggested replies').toUpperCase()}</Text>
              <Pressable
                onPress={() => router.push('/contractor/message-templates' as any)}
                hitSlop={8}
                style={{ marginLeft: 'auto' }}
                accessibilityRole="button"
                accessibilityLabel={t('smartReply.customize', 'Customize')}
              >
                <Text style={s.smartReplyCustomize}>{t('smartReply.customize', 'Customize').toUpperCase()}</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.smartReplyRow}>
              {smartReplies.map((r) => (
                <Pressable
                  key={r.id}
                  style={({ pressed }) => [s.smartReplyChip, pressed && { opacity: 0.85 }]}
                  onPress={() => sendSmartReply(r)}
                  accessibilityRole="button"
                  accessibilityLabel={r.body}
                  accessibilityHint={r.reason}
                >
                  <Ionicons
                    name={r.channel === 'whatsapp' ? 'logo-whatsapp' : r.channel === 'sms' ? 'chatbubble-outline' : 'mail-outline'}
                    size={14}
                    color={Palette.hermesOrange}
                  />
                  <Text style={s.smartReplyChipText} numberOfLines={2}>{r.body}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </FadeIn>
        )}

        {/* Quick actions */}
        <FadeIn delay={50}>
          <View style={s.actions}>
            <Pressable style={s.actionBtn} onPress={() => router.push('/contractor/tiered-quote' as any)}>
              <Ionicons name="document-text-outline" size={20} color={Palette.hermesOrange} />
              <Text style={s.actionBtnText}>{t('customer.quote', 'Offerte')}</Text>
            </Pressable>
            <Pressable style={s.actionBtn} onPress={() => { if (customer.phone) { Linking.openURL(`tel:${customer.phone}`); } }}>
              <Ionicons name="call-outline" size={20} color={Palette.hermesOrange} />
              <Text style={s.actionBtnText}>{t('customer.call', 'Call')}</Text>
            </Pressable>
            <Pressable style={s.actionBtn} onPress={() => { if (customer.email) { Linking.openURL(`mailto:${customer.email}`); } }}>
              <Ionicons name="mail-outline" size={20} color={Palette.hermesOrange} />
              <Text style={s.actionBtnText}>{t('customer.email', 'E-mail')}</Text>
            </Pressable>
          </View>
        </FadeIn>

        {/* Jobs */}
        {customerJobs.length > 0 && (
          <FadeIn delay={100}>
            <Text style={s.sectionTitle}>{t('customer.jobs', 'Jobs')} ({customerJobs.length})</Text>
            {customerJobs.map((job: any) => (
              <Pressable key={job.id} style={s.card} onPress={() => router.push(`/contractor/job/${job.id}` as any)}>
                <View style={[s.accent, { backgroundColor: job.status === 'completed' ? SemanticColors.feedbackSuccess : Palette.hermesOrange }]} />
                <View style={s.cardContent}>
                  <Text style={s.cardTitle} numberOfLines={1}>{job.title}</Text>
                  <Text style={s.cardMeta}>{jobStatusLabel(String(job.status))} · {formatCurrency(job.quotedAmount ?? 0, country)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </FadeIn>
        )}

        {/* Quotes */}
        {customerQuotes.length > 0 && (
          <FadeIn delay={150}>
            <Text style={s.sectionTitle}>{t('customer.quotes', 'Quotes')} ({customerQuotes.length})</Text>
            {customerQuotes.map((q: any) => (
              <Pressable key={q.id} style={s.card} onPress={() => router.push(`/quotes/${q.id}` as any)}>
                <View style={[s.accent, { backgroundColor: q.status === 'accepted' ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary }]} />
                <View style={s.cardContent}>
                  <Text style={s.cardTitle} numberOfLines={1}>{q.id} — {q.job || t('customer.quote', 'Quote')}</Text>
                  <Text style={s.cardMeta}>{quoteStatusLabel(String(q.status))} · {formatCurrency(q.amount ?? 0, country)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </FadeIn>
        )}

        {/* Invoices */}
        {customerInvoices.length > 0 && (
          <FadeIn delay={200}>
            <Text style={s.sectionTitle}>{t('customer.invoices', 'Invoices')} ({customerInvoices.length})</Text>
            {customerInvoices.map((inv: any) => (
              <Pressable key={inv.id} style={s.card} onPress={() => router.push(`/invoices/${inv.id}` as any)}>
                <View style={[s.accent, { backgroundColor: inv.status === 'paid' ? SemanticColors.feedbackSuccess : inv.status === 'overdue' ? SemanticColors.feedbackError : Palette.hermesOrange }]} />
                <View style={s.cardContent}>
                  <Text style={s.cardTitle} numberOfLines={1}>{inv.id}</Text>
                  <Text style={s.cardMeta}>{invoiceStatusLabel(String(inv.status))} · {formatCurrency(inv.amount ?? 0, country)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </FadeIn>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* R271: capture-inbound modal */}
      <Modal visible={inboxModalOpen} transparent animationType="slide" onRequestClose={() => setInboxModalOpen(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setInboxModalOpen(false)}>
          <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('inbox.captureTitle', 'What did the customer say?')}</Text>
            <View style={s.channelChips}>
              {(['whatsapp','sms','email','phone','other'] as InboundChannel[]).map((ch) => (
                <Pressable
                  key={ch}
                  style={[s.channelChip, inboxChannel === ch && s.channelChipActive]}
                  onPress={() => setInboxChannel(ch)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: inboxChannel === ch }}
                >
                  <Text style={[s.channelChipText, inboxChannel === ch && s.channelChipTextActive]}>
                    {t(`inbox.ch.${ch}`, ch)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={s.inboxInput}
              value={inboxDraft}
              onChangeText={setInboxDraft}
              placeholder={t('inbox.placeholder', 'Paste or type the message…')}
              placeholderTextColor={SemanticColors.textTertiary}
              multiline
              autoFocus
              maxLength={1000}
            />
            <Pressable
              style={[s.modalSubmit, !inboxDraft.trim() && { opacity: 0.5 }]}
              onPress={saveInboundMessage}
              disabled={!inboxDraft.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('inbox.save', 'Save')}
            >
              <Text style={s.modalSubmitText}>{t('inbox.save', 'Save').toUpperCase()}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12 },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
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
  // R270: smart-reply chip strip
  smartReplyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SafeArea.side,
    marginTop: GRID.md,
    marginBottom: GRID.xs,
  },
  smartReplyHeaderText: {
    fontSize: 10,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
    letterSpacing: 1.2,
  },
  smartReplyCustomize: {
    fontSize: 10,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
    letterSpacing: 1.2,
  },
  smartReplyRow: {
    flexDirection: 'row',
    gap: GRID.xs,
    paddingHorizontal: SafeArea.side,
    paddingBottom: GRID.xs,
  },
  smartReplyChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '40',
    borderRadius: RADIUS.lg,
    paddingHorizontal: GRID.sm,
    paddingVertical: 8,
    maxWidth: 240,
  },
  smartReplyChipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
    lineHeight: 16,
  },
  // R271: inbox section
  inboxHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SafeArea.side, marginTop: GRID.md, marginBottom: GRID.xs,
  },
  inboxHeaderText: { fontSize: 10, fontFamily: TYPE.labelFamily, color: SemanticColors.textTertiary, letterSpacing: 1.2 },
  inboxCapture: { fontSize: 10, fontFamily: TYPE.labelFamily, color: Palette.hermesOrange, letterSpacing: 1.2 },
  inboxBubble: {
    marginHorizontal: SafeArea.side,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderLeftWidth: 3, borderLeftColor: SemanticColors.feedbackInfo,
    borderRadius: RADIUS.md, padding: GRID.sm, gap: 6,
  },
  inboxBody: { fontSize: 13, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary, lineHeight: 18 },
  inboxMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inboxMetaText: { fontSize: 10, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },
  inboxEmpty: {
    marginHorizontal: SafeArea.side,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md, padding: GRID.sm,
    borderWidth: 1, borderColor: SemanticColors.borderDefault, borderStyle: 'dashed',
  },
  inboxEmptyText: { fontSize: 12, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary, textAlign: 'center' },
  // R271: capture-inbound modal
  modalOverlay: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: PAGE_BG, padding: GRID.lg, gap: GRID.sm,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: GRID.xl + 12,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: SemanticColors.textTertiary,
    alignSelf: 'center', marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  channelChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  channelChip: {
    paddingHorizontal: GRID.sm, paddingVertical: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  channelChipActive: { backgroundColor: Palette.hermesOrange + '22', borderColor: Palette.hermesOrange },
  channelChipText: { fontSize: 11, fontFamily: TYPE.labelFamily, color: SemanticColors.textSecondary, letterSpacing: 0.5 },
  channelChipTextActive: { color: Palette.hermesOrange },
  inboxInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md, padding: GRID.sm,
    minHeight: 100, textAlignVertical: 'top',
    color: SemanticColors.textPrimary, fontSize: 14, fontFamily: TYPE.bodyFamily,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  modalSubmit: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  modalSubmitText: { color: '#FFFFFF', fontFamily: TYPE.titleFamily, fontSize: 13, letterSpacing: 1.2 },
  actionBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking, marginTop: GRID.sm },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  accent: { width: 4, alignSelf: 'stretch' },
  cardContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  cardTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  cardMeta: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
});
