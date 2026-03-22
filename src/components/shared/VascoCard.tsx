// =============================================================================
// VASCO CARD — Unified AI card (replaces 4 separate AI sections)
// =============================================================================
// One card. One section. Everything AI in one place.
// Collapsed: 1-2 line summary. Expanded: briefing + queue + insight + automations.
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SemanticColors, Palette } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { hapticSuccess } from '../../utils/haptics';
import type { MorningBriefing } from '../../intelligence/backgroundJobScheduler';
import type { QueueItem } from '../../services/aiActionQueueService';
import type { ScoredInsight } from '../../intelligence/generators/types';

type IconName = keyof typeof Ionicons.glyphMap;

interface VascoCardProps {
  briefing: MorningBriefing | null;
  queueItems: QueueItem[];
  topInsight: ScoredInsight | null;
  automationsCount: number;
  complianceStatus?: { valid: number; expiring: number; expired: number } | null;
  pendingDecisions?: number;
  overdueInvoices?: number;
  onApproveQueueItem: (id: string) => void;
  onRejectQueueItem: (id: string) => void;
  onInsightAction?: (insight: ScoredInsight) => void;
  onOverduePress?: () => void;
}

// ---------------------------------------------------------------------------
// Overdue Reminder — preview + edit before sending (EVE pattern)
// Uses forward-referenced `s` styles (StyleSheet defined below)
// ---------------------------------------------------------------------------

function OverdueReminder({ count, onSend }: { count: number; onSend?: () => void }) {
  const [editing, setEditing] = useState(false);
  const defaultMsg = `Beste klant,\n\nHierbij een vriendelijke herinnering voor ${count} openstaande factuur${count > 1 ? 'en' : ''}.\n\nMet vriendelijke groet`;
  const [text, setText] = useState(defaultMsg);

  const handleSend = async () => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
        alert('Herinnering gekopieerd naar klembord');
      } else {
        await Share.share({ message: text, title: 'Betaalherinnering' });
      }
    } catch {}
    setEditing(false);
  };

  if (!editing) {
    return (
      <Pressable style={s.overdueRow} onPress={() => setEditing(true)}>
        <View style={s.overdueIcon}>
          <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.overdueTitle}>{count} {count === 1 ? 'factuur' : 'facturen'} achterstallig</Text>
          <Text style={s.overdueDesc}>Tik om herinnering te bekijken</Text>
        </View>
        <Ionicons name="create-outline" size={14} color={SemanticColors.feedbackError} />
      </Pressable>
    );
  }

  return (
    <View style={s.overdueExpanded}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackError} />
        <Text style={s.overdueTitle}>{count} {count === 1 ? 'factuur' : 'facturen'} achterstallig</Text>
      </View>
      <TextInput
        style={s.overdueInput}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Bewerk het bericht..."
        placeholderTextColor={SemanticColors.textTertiary}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable style={s.overdueSendBtn} onPress={handleSend}>
          <Ionicons name="send" size={14} color={Palette.white} />
          <Text style={s.overdueSendText}>Verstuur</Text>
        </Pressable>
        <Pressable style={s.overdueCancelBtn} onPress={() => setEditing(false)}>
          <Text style={s.overdueCancelText}>Annuleer</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function VascoCard({
  briefing,
  queueItems,
  topInsight,
  automationsCount,
  complianceStatus,
  pendingDecisions,
  overdueInvoices,
  onApproveQueueItem,
  onRejectQueueItem,
  onInsightAction,
  onOverduePress,
}: VascoCardProps) {
  const [expanded, setExpanded] = useState(true); // EVE pattern: show value first
  const router = useRouter();

  const findingsCount = briefing?.findings.length ?? 0;
  const queueCount = queueItems.length;
  const hasContent = findingsCount > 0 || queueCount > 0 || topInsight || automationsCount > 0 || (overdueInvoices ?? 0) > 0;

  if (!hasContent) return null;

  // Summary line
  const summaryParts: string[] = [];
  if (findingsCount > 0) summaryParts.push(`${findingsCount} bevindingen`);
  if (queueCount > 0) summaryParts.push(`${queueCount} klaar`);
  if (automationsCount > 0) summaryParts.push(`${automationsCount} actief`);

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && !expanded && { opacity: 0.9 }]}
      onPress={() => setExpanded(!expanded)}
    >
      {/* Header — always visible */}
      <View style={s.header}>
        <View style={s.iconCircle}>
          <Ionicons name="flash" size={16} color={Palette.hermesOrange} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Vasco</Text>
          <Text style={s.summary} numberOfLines={1}>
            {queueCount > 0 ? `${queueCount} ${queueCount === 1 ? 'actie' : 'acties'} klaar` : findingsCount > 0 ? `${findingsCount} ${findingsCount === 1 ? 'bevinding' : 'bevindingen'}` : 'Alles op orde'}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/contractor/automations' as any)} hitSlop={8}>
          <Ionicons name="settings-outline" size={16} color={SemanticColors.textTertiary} />
        </Pressable>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={SemanticColors.textTertiary} />
      </View>

      {/* Expanded content */}
      {expanded && (
        <View style={s.content}>
          {/* Morning briefing findings — each is actionable (EVE pattern) */}
          {briefing && findingsCount > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Vannacht gecontroleerd</Text>
              {briefing.findings.slice(0, 3).map(f => (
                <Pressable
                  key={f.id}
                  style={s.findingRow}
                  onPress={() => {
                    if (f.entityType === 'invoice') router.push(`/invoices/${f.entityId}` as any);
                    else if (f.entityType === 'quote') router.push(`/quotes/${f.entityId}` as any);
                    else if (f.entityType === 'job') router.push(`/quotes/${f.entityId}` as any);
                  }}
                >
                  <Ionicons
                    name={f.severity === 'critical' ? 'alert-circle' : f.severity === 'warning' ? 'warning-outline' : 'information-circle-outline'}
                    size={14}
                    color={f.severity === 'critical' ? SemanticColors.feedbackError : f.severity === 'warning' ? Palette.hermesOrange : SemanticColors.textTertiary}
                  />
                  <Text style={[s.findingText, { flex: 1 }]} numberOfLines={1}>{f.title}</Text>
                  {f.suggestedAction && (
                    <Text style={s.findingAction} numberOfLines={1}>{f.suggestedAction}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* AI action queue — embedded approval (EVE pattern) */}
          {queueCount > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Klaar voor goedkeuring</Text>
              {queueItems.slice(0, 3).map(item => (
                <EmbeddedApproval
                  key={item.id}
                  item={item}
                  onApprove={() => { hapticSuccess(); onApproveQueueItem(item.id); }}
                  onReject={() => onRejectQueueItem(item.id)}
                />
              ))}
            </View>
          )}

          {/* Overdue invoices — editable reminder */}
          {(overdueInvoices ?? 0) > 0 && (
            <OverdueReminder count={overdueInvoices!} onSend={onOverduePress} />
          )}

          {/* Top insight with action */}
          {topInsight && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Aanbeveling</Text>
              <Pressable
                style={s.insightRow}
                onPress={() => onInsightAction?.(topInsight)}
              >
                <Ionicons name={(topInsight.icon as IconName) || 'bulb'} size={16} color={Palette.hermesOrange} />
                <View style={{ flex: 1 }}>
                  <Text style={s.insightTitle} numberOfLines={1}>{topInsight.title}</Text>
                  <Text style={s.insightDesc} numberOfLines={2}>{topInsight.message}</Text>
                </View>
                {(topInsight as any).action && (
                  <View style={s.insightAction}>
                    <Text style={s.insightActionText}>{(topInsight as any).action.label}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Embedded Approval — mini-form per queue item (EVE pattern)
// ---------------------------------------------------------------------------

function EmbeddedApproval({ item, onApprove, onReject }: {
  item: QueueItem;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const handleApprove = async () => {
    if (item.type === 'draft_reminder' || item.type === 'draft_followup') {
      // For reminders/follow-ups: share the prepared text
      const template = item.preparedData?.template || item.description;
      const text = editText || template;
      try {
        await Share.share({ message: text, title: item.title });
      } catch {}
    }
    onApprove();
  };

  return (
    <View style={s.embeddedCard}>
      <View style={s.embeddedHeader}>
        <Ionicons
          name={item.type === 'draft_invoice' ? 'receipt-outline' : item.type === 'draft_reminder' ? 'notifications-outline' : 'document-text-outline'}
          size={16}
          color={Palette.hermesOrange}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.queueTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={s.queueDesc} numberOfLines={1}>{item.description}</Text>
        </View>
      </View>

      {/* Editable preview for reminders/follow-ups */}
      {editing && (item.type === 'draft_reminder' || item.type === 'draft_followup') && (
        <TextInput
          style={s.editInput}
          value={editText || item.preparedData?.template || ''}
          onChangeText={setEditText}
          multiline
          placeholder="Pas bericht aan..."
          placeholderTextColor={SemanticColors.textTertiary}
        />
      )}

      {/* Amount display for invoices */}
      {item.type === 'draft_invoice' && item.preparedData?.amount && (
        <Text style={s.embeddedAmount}>€{Number(item.preparedData.amount).toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</Text>
      )}

      {/* Impact line */}
      {item.estimatedImpact && (
        <Text style={s.embeddedImpact}>{item.estimatedImpact}</Text>
      )}

      {/* Action buttons */}
      <View style={s.embeddedActions}>
        {(item.type === 'draft_reminder' || item.type === 'draft_followup') && (
          <Pressable style={s.editBtn} onPress={() => setEditing(!editing)}>
            <Ionicons name={editing ? 'checkmark' : 'create-outline'} size={14} color={Palette.hermesOrange} />
          </Pressable>
        )}
        <Pressable style={s.approveBtn} onPress={handleApprove}>
          <Ionicons name="checkmark" size={14} color={Palette.white} />
          <Text style={s.approveBtnText}>{item.actionLabel}</Text>
        </Pressable>
        <Pressable style={s.rejectBtn} onPress={onReject}>
          <Ionicons name="close" size={14} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.hermesOrange + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  summary: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  section: {
    gap: 6,
    paddingTop: 10,
  },
  sectionLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Findings
  findingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  findingText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textPrimary,
  },
  findingAction: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: Palette.hermesOrange,
  },
  // Embedded approval card
  embeddedCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 10,
    gap: 6,
  },
  embeddedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  embeddedAmount: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    paddingLeft: 24,
  },
  embeddedImpact: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.feedbackSuccess,
    paddingLeft: 24,
  },
  embeddedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 24,
  },
  editInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: 8,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textPrimary,
    minHeight: 60,
    marginLeft: 24,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Queue (legacy — keeping for backward compat)
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  queueDesc: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flex: 1,
    justifyContent: 'center',
  },
  approveBtnText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
  rejectBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Overdue invoices
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SemanticColors.feedbackError + '08',
    borderRadius: RADIUS.md,
    padding: 10,
  },
  overdueIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SemanticColors.feedbackError + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackError,
  },
  overdueDesc: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },
  // Overdue expanded
  overdueExpanded: {
    backgroundColor: SemanticColors.feedbackError + '08',
    borderRadius: RADIUS.md,
    padding: 10,
    gap: 8,
  },
  overdueInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: 10,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  overdueSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackError,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
    justifyContent: 'center',
  },
  overdueSendText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
  overdueCancelBtn: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueCancelText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  // Insight
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  insightTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  insightDesc: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  insightAction: {
    backgroundColor: Palette.hermesOrange + '15',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  insightActionText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: Palette.hermesOrange,
  },
});
