// =============================================================================
// EVE 3-AGENT DASHBOARD (R40)
// =============================================================================
// Closes EVE-gap-2 from session status report. Lightweight per-agent surface
// showing pending counts, taglines, and tap-through to the queue filtered by
// agent type. Approve / reject still happens through the canonical
// useAIQueue hook so behavior matches Vandaag + AI tab exactly.
// =============================================================================

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../src/theme/draftkings';
import { SafeArea } from '../../src/theme/spacing';
import { DKLabel } from '../../src/components/shared/DKLabel';
import { useAIQueue, type QueueItem } from '../../src/services/aiActionQueueService';
import { executeApprovedQueueItem } from '../../src/services/queueItemExecutor';
import { EVE_AGENTS, type EveAgentType } from '../../src/services/eveAgentService';

type IconName = keyof typeof Ionicons.glyphMap;

function parseEveAgent(sourceGeneratorId?: string): EveAgentType | null {
  if (!sourceGeneratorId?.startsWith('eve-')) return null;
  const t = sourceGeneratorId.slice(4);
  if (t === 'agent' || t === 'auditor' || t === 'analyst') return t;
  return null;
}

export default function EveDashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const aiQueue = useAIQueue();
  const [selectedAgent, setSelectedAgent] = useState<EveAgentType | null>(null);

  // Bucket queue items by EVE agent attribution. Items without `eve-*` source
  // generator id (workflow packs, customer questions, manual nudges) are not
  // shown here — they appear on the canonical Vandaag + AI tab queue.
  const byAgent = useMemo(() => {
    const buckets: Record<EveAgentType, QueueItem[]> = { agent: [], auditor: [], analyst: [] };
    for (const item of aiQueue.items) {
      const agent = parseEveAgent(item.sourceGeneratorId);
      if (agent) buckets[agent].push(item);
    }
    return buckets;
  }, [aiQueue.items]);

  const filteredItems = selectedAgent ? byAgent[selectedAgent] : [];

  const handleApprove = async (item: QueueItem) => {
    const approved = await aiQueue.approve(item.id);
    if (approved) await executeApprovedQueueItem(approved, { router }, { alreadyShared: false });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={DK.colors.text} />
        </Pressable>
        <View>
          <DKLabel style={styles.overline}>{t('eve.overline', 'YOUR AI WORKFORCE')}</DKLabel>
          <Text style={styles.title}>EVE</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 3 agent cards */}
        {(['agent', 'auditor', 'analyst'] as EveAgentType[]).map((type) => {
          const config = EVE_AGENTS[type];
          const count = byAgent[type].length;
          const isSelected = selectedAgent === type;
          return (
            <Pressable
              key={type}
              style={[styles.agentCard, isSelected && { borderColor: config.color, borderWidth: 2 }]}
              onPress={() => setSelectedAgent(isSelected ? null : type)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${config.name}, ${count} pending actions`}
            >
              <View style={[styles.agentIcon, { backgroundColor: config.color + '22', borderColor: config.color + '88' }]}>
                <Ionicons name={config.icon as IconName} size={22} color={config.color} />
              </View>
              <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{config.name}</Text>
                <Text style={styles.agentTagline}>{config.tagline}</Text>
              </View>
              <View style={[styles.agentCount, { backgroundColor: config.color + '14', borderColor: config.color + '55' }]}>
                <Text style={[styles.agentCountText, { color: config.color }]}>{count}</Text>
              </View>
            </Pressable>
          );
        })}

        {/* Filtered queue items for selected agent */}
        {selectedAgent && (
          <View style={styles.itemsSection}>
            <DKLabel style={styles.itemsHeading}>
              {t('eve.pendingFor', { defaultValue: 'PENDING — {{name}}', name: EVE_AGENTS[selectedAgent].name })}
            </DKLabel>
            {filteredItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {t('eve.empty', { defaultValue: '{{name}} is up to date — no pending actions.', name: EVE_AGENTS[selectedAgent].name })}
                </Text>
              </View>
            ) : (
              filteredItems.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                    {item.estimatedImpact ? (
                      <Text style={styles.itemImpact} numberOfLines={1}>{item.estimatedImpact}</Text>
                    ) : null}
                    {item.description ? (
                      <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => aiQueue.reject(item.id)}
                    hitSlop={6}
                    style={styles.rejectBtn}
                    accessibilityLabel={t('common.reject', 'Reject')}
                  >
                    <Ionicons name="close" size={14} color={DK.colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleApprove(item)}
                    style={({ pressed }) => [styles.approveBtn, pressed && { opacity: 0.85 }]}
                    accessibilityLabel={item.actionLabel || t('common.approve', 'Approve')}
                  >
                    <DKLabel style={styles.approveText} numberOfLines={1}>{item.actionLabel || 'OK'}</DKLabel>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* Description card when no agent selected */}
        {!selectedAgent && (
          <View style={styles.aboutCard}>
            <DKLabel style={styles.aboutHeading}>{t('eve.aboutHeading', 'ABOUT EVE')}</DKLabel>
            <Text style={styles.aboutBody}>
              {t('eve.aboutBody', 'EVE prepares work proactively across three specialised agents. Tap an agent above to review their pending suggestions — every approval is one tap.')}
            </Text>
            {(['agent', 'auditor', 'analyst'] as EveAgentType[]).map((type) => (
              <View key={type} style={styles.aboutRow}>
                <Ionicons name={EVE_AGENTS[type].icon as IconName} size={14} color={EVE_AGENTS[type].color} />
                <Text style={styles.aboutRowText} numberOfLines={3}>{EVE_AGENTS[type].description}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DK.colors.panel,
    borderWidth: 1, borderColor: DK.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  overline: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.textMuted, letterSpacing: 1.8 },
  title: { fontFamily: DK.type.display900, fontSize: 32, color: DK.colors.text, letterSpacing: -0.8, marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, paddingTop: 12, gap: 12 },
  agentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: DK.colors.panel, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: DK.colors.border,
  },
  agentIcon: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  agentInfo: { flex: 1, minWidth: 0 },
  agentName: { fontFamily: DK.type.display800, fontSize: 16, color: DK.colors.text },
  agentTagline: { fontFamily: DK.type.body500, fontSize: 12, color: DK.colors.textMuted, marginTop: 2 },
  agentCount: {
    minWidth: 36, height: 28, paddingHorizontal: 10,
    borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  agentCountText: { fontFamily: DK.type.display800, fontSize: 14 },
  itemsSection: { marginTop: 8, gap: 8 },
  itemsHeading: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.textMuted, letterSpacing: 1.6, marginTop: 8, marginBottom: 4 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: DK.colors.panel2, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: DK.colors.border,
  },
  itemTitle: { fontFamily: DK.type.display700, fontSize: 13, color: DK.colors.text },
  itemImpact: { fontFamily: DK.type.body500, fontSize: 11, color: DK.colors.highlight, marginTop: 2 },
  itemDesc: { fontFamily: DK.type.body400, fontSize: 11, color: DK.colors.textMuted, marginTop: 2 },
  rejectBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: DK.colors.bg, borderWidth: 1, borderColor: DK.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  approveBtn: {
    paddingHorizontal: 14, height: 32, borderRadius: 16,
    backgroundColor: DK.colors.accent,
    alignItems: 'center', justifyContent: 'center',
    maxWidth: 130,
  },
  approveText: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.bg, letterSpacing: 1.0 },
  emptyCard: {
    backgroundColor: DK.colors.panel2, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: DK.colors.border, borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: { fontFamily: DK.type.body500, fontSize: 13, color: DK.colors.textMuted, textAlign: 'center' },
  aboutCard: {
    backgroundColor: DK.colors.panel2, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: DK.colors.border, gap: 10, marginTop: 8,
  },
  aboutHeading: { fontFamily: DK.type.display800, fontSize: 11, color: DK.colors.textMuted, letterSpacing: 1.6 },
  aboutBody: { fontFamily: DK.type.body500, fontSize: 13, color: DK.colors.text, lineHeight: 18 },
  aboutRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  aboutRowText: { flex: 1, fontFamily: DK.type.body400, fontSize: 11, color: DK.colors.textMuted, lineHeight: 16 },
});
