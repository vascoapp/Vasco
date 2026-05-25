// =============================================================================
// AI CHAT — Office-manager natural-language interface (R87 US Phase 5)
// =============================================================================
// Contractor types commands ("invoice Joe for $500", "what did I make last
// month"). Claude Haiku (via aiCommandService) parses intent + returns a
// human response. This screen dispatches actionable intents to AppState
// mutators where possible.
//
// Scope (R95): 10 intents (create_invoice, schedule_job, query_revenue,
// list_overdue, send_reminder, cancel_job, query_job_status,
// find_customer, weekly_summary, unknown). Actionable ones don't auto-
// execute customer-facing things — they prep + route to the relevant
// screen for review (EVE Legal AI pattern: AI prepares, contractor
// approves).
// =============================================================================

import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../src/state/AppState';
import { sendAiCommand } from '../../src/services/aiCommandService';
import { routeForIntent } from '../../src/services/aiCommandRouter';
import { SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { DK } from '../../src/theme/draftkings';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  // For assistant messages with an actionable intent: render an inline
  // "Open" button that routes to the relevant screen.
  routeOnTap?: { path: string; label: string };
}

const SUGGESTIONS = [
  'How was my week?',
  'Show overdue invoices',
  'Invoice John for $500',
  'Status of active jobs',
];

export default function AiChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { customers, invoices, jobs, quotes } = useAppState();

  // R118: welcome greeting now i18n-wired. Lazy initial state captures
  // the t() value at first render — chat history won't retroactively
  // re-translate, which is the desired behaviour for spoken messages.
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: t('aiChat.welcome', "Hi! I'm your office manager. Ask me to invoice a customer, schedule a job, or check your numbers."),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Light context bundle so Claude can reference real names + numbers.
  // Sent on every call — small enough (top 20 customers + a few scalars).
  const aiContext = useMemo(() => {
    const now = Date.now();
    const cutoff90 = now - 90 * 24 * 60 * 60 * 1000;
    const cutoff7 = now - 7 * 24 * 60 * 60 * 1000;
    const recent = invoices.filter((inv) => new Date(inv.lastUpdated ?? inv.createdAt ?? 0).getTime() >= cutoff90);
    const recentInvoiceTotal = Math.round(recent.reduce((s, i) => s + (i.amount ?? 0), 0));
    const overdueCount = invoices.filter((inv) => inv.status === 'overdue').length;

    // R95 — active jobs (in-progress / scheduled) + weekly rollup.
    const activeJobs = jobs
      .filter((j) => j.status !== 'completed' && j.status !== 'cancelled')
      .slice(0, 10)
      .map((j) => {
        const cust = customers.find((c) => c.id === j.customerId);
        return { id: j.id, customer: cust?.name ?? 'Unknown', status: j.status };
      });
    const weeklyInvoices = invoices.filter((inv) => new Date(inv.lastUpdated ?? inv.createdAt ?? 0).getTime() >= cutoff7);
    const weeklyRevenue = Math.round(weeklyInvoices.reduce((s, i) => s + (i.amount ?? 0), 0));
    const weeklyJobsCompleted = jobs.filter((j) =>
      j.status === 'completed' && new Date(j.completedAt ?? j.updatedAt ?? 0).getTime() >= cutoff7,
    ).length;
    const weeklyQuotesSent = quotes.filter((q) =>
      q.status === 'sent' && new Date(q.sentAt ?? q.lastUpdated ?? 0).getTime() >= cutoff7,
    ).length;

    return {
      customers: customers.slice(0, 20).map((c) => ({ id: c.id, name: c.name })),
      recentInvoiceTotal,
      overdueCount,
      activeJobs,
      weeklyRevenue,
      weeklyJobsCompleted,
      weeklyQuotesSent,
    };
  }, [customers, invoices, jobs, quotes]);

  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || sending) return;

    try {
      const {
        loadSubscription,
        canUseAiInsight,
      } = await import('../../src/services/subscriptionService');
      const sub = await loadSubscription();
      const gate = canUseAiInsight(sub);
      if (!gate.allowed) {
        Alert.alert(
          t('billing.upgradeRequired', 'Upgrade required'),
          gate.reason,
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            { text: t('billing.viewPlans', 'View plans'), onPress: () => router.push('/contractor/profile' as any) },
          ],
        );
        return;
      }
    } catch {}

    const userMsg: ChatMessage = { id: `m-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    const resp = await sendAiCommand(text, aiContext);
    setSending(false);

    if (!resp.ok) {
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}-err`,
          role: 'assistant',
          text: t('aiChat.parseError', "Sorry — I had trouble parsing that. Try rephrasing."),
        },
      ]);
      return;
    }

    const result = resp.result;
    const route = routeForIntent(result);
    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}-ai`,
        role: 'assistant',
        text: result.humanResponse,
        routeOnTap: route,
      },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const { loadSubscription, recordAiInsightUsage } = await import('../../src/services/subscriptionService');
      const sub = await loadSubscription();
      await recordAiInsightUsage(sub);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('aiChat.title', 'Office manager')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: GRID.lg, paddingBottom: GRID.xl * 2 }}
        >
          {messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={styles.bubbleText}>{m.text}</Text>
              {m.routeOnTap ? (
                <Pressable style={styles.routeBtn} onPress={() => router.push(m.routeOnTap!.path as never)}>
                  <Text style={styles.routeBtnText}>{m.routeOnTap.label}</Text>
                  <Ionicons name="arrow-forward" size={14} color={DK.colors.accent} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {sending ? (
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <Text style={[styles.bubbleText, { color: SemanticColors.textTertiary }]}>Thinking…</Text>
            </View>
          ) : null}
        </ScrollView>

        {messages.length === 1 ? (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={styles.suggestionChip} onPress={() => handleSend(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('aiChat.placeholder', 'Ask anything…')}
            placeholderTextColor={SemanticColors.textTertiary}
            style={styles.input}
            multiline
            onSubmitEditing={() => handleSend()}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            disabled={!input.trim() || sending}
            onPress={() => handleSend()}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault,
  },
  backBtn: { padding: GRID.xs },
  headerTitle: {
    fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    borderRadius: RADIUS.lg,
    marginBottom: GRID.sm,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: DK.colors.accent,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  bubbleText: {
    fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary, lineHeight: 20,
  },
  routeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: GRID.xs, paddingVertical: GRID.xs,
  },
  routeBtnText: {
    fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily,
    color: DK.colors.accent, letterSpacing: 0.4,
  },
  suggestions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GRID.sm,
    paddingHorizontal: GRID.lg, paddingVertical: GRID.sm,
  },
  suggestionChip: {
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: `${DK.colors.accent}55`,
    backgroundColor: `${DK.colors.accent}15`,
  },
  suggestionText: {
    fontSize: TYPE.captionSize, color: DK.colors.accent,
    fontFamily: TYPE.labelFamily,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: GRID.md, gap: GRID.sm,
    borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: SemanticColors.borderDefault,
    paddingHorizontal: GRID.md, paddingTop: GRID.sm, paddingBottom: GRID.sm,
    fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: DK.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
