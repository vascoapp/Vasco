// =============================================================================
// VASCO CARD — Unified AI card (replaces 4 separate AI sections)
// =============================================================================
// One card. One section. Everything AI in one place.
// Collapsed: 1-2 line summary. Expanded: briefing + queue + insight + automations.
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Share, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
  onApproveQueueItem: (id: string) => void;
  onRejectQueueItem: (id: string) => void;
  onInsightAction?: (insight: ScoredInsight) => void;
}

export function VascoCard({
  briefing,
  queueItems,
  topInsight,
  automationsCount,
  complianceStatus,
  pendingDecisions,
  onApproveQueueItem,
  onRejectQueueItem,
  onInsightAction,
}: VascoCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true); // EVE pattern: show value first
  const router = useRouter();

  const findingsCount = briefing?.findings.length ?? 0;
  const queueCount = queueItems.length;
  const hasContent = findingsCount > 0 || queueCount > 0 || topInsight || automationsCount > 0;

  if (!hasContent) return null;

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
        <View style={s.flex1}>
          <Text style={s.title}>Vasco</Text>
          <Text style={s.summary} numberOfLines={1}>
            {queueCount > 0
              ? t('vasco.actionsReady', { defaultValue: '{{count}} actions ready', count: queueCount })
              : findingsCount > 0
                ? t('vasco.findingsCount', { defaultValue: '{{count}} findings', count: findingsCount })
                : t('vasco.allGood', 'Alles op orde')}
          </Text>
        </View>
        {/* Expo Router requires 'as any' for dynamic routes — tracked in expo-router#123 */}
        <Pressable onPress={() => router.push('/contractor/automations' as any)} hitSlop={8} accessibilityLabel={t('a11y.automationSettings', 'Automation settings')}>
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
              <Text style={s.sectionLabel}>{t('vasco.checkedOvernight', 'Vannacht gecontroleerd')}</Text>
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
                  <Text style={[s.findingText, s.flex1]} numberOfLines={1}>{f.title}</Text>
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
              <Text style={s.sectionLabel}>{t('vasco.readyForApproval', 'Klaar voor goedkeuring')}</Text>
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

          {/* Top insight with action */}
          {topInsight && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>{t('vasco.recommendation', 'Aanbeveling')}</Text>
              <Pressable
                style={s.insightRow}
                onPress={() => onInsightAction?.(topInsight)}
              >
                <Ionicons name={(topInsight.icon as IconName) || 'bulb'} size={16} color={Palette.hermesOrange} />
                <View style={s.flex1}>
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

function getQueueIcon(type: string): IconName {
  switch (type) {
    case 'draft_invoice': case 'batch_invoices': case 'invoice_regenerate': return 'receipt-outline';
    case 'draft_reminder': return 'notifications-outline';
    case 'draft_followup': case 'quote_expiry': return 'document-text-outline';
    case 'progress_note': return 'chatbubble-outline';
    case 'reorder_materials': return 'cart-outline';
    case 'cert_renewal': case 'permit_check': case 'permit_renewal': return 'shield-checkmark-outline';
    case 'job_handover': return 'folder-open-outline';
    case 'satisfaction_survey': return 'star-outline';
    case 'safety_checklist': return 'checkbox-outline';
    case 'supplier_comparison': case 'price_alert': return 'pricetag-outline';
    case 'tax_prep': return 'calculator-outline';
    case 'maintenance_due': return 'build-outline';
    case 'accounting_export': return 'cloud-upload-outline';
    case 'einvoice_submit': return 'document-attach-outline';
    default: return 'ellipse-outline';
  }
}

function EmbeddedApproval({ item, onApprove, onReject }: {
  item: QueueItem;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [approving, setApproving] = useState(false);

  // Types that share a message to the customer (editable before sending)
  const isShareable = [
    'draft_reminder', 'draft_followup', 'progress_note', 'quote_expiry',
    'satisfaction_survey', 'job_handover',
  ].includes(item.type);

  // Types that display an amount
  const isInvoiceType = [
    'draft_invoice', 'batch_invoices', 'invoice_regenerate', 'draft_reminder',
  ].includes(item.type);

  const handleApprove = async () => {
    if (approving) return; // Prevent double-tap
    setApproving(true);
    try {
      if (isShareable) {
        const template = item.preparedData?.template || item.description;
        const text = editText || template;
        try {
          await Share.share({ message: text, title: item.title });
        } catch {}
      }
      onApprove();
    } finally {
      setApproving(false);
    }
  };

  return (
    <View style={s.embeddedCard}>
      <View style={s.embeddedHeader}>
        <Ionicons
          name={getQueueIcon(item.type)}
          size={16}
          color={Palette.hermesOrange}
        />
        <View style={s.flex1}>
          <Text style={s.queueTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={s.queueDesc} numberOfLines={1}>{item.description}</Text>
        </View>
      </View>

      {/* Editable preview for shareable items (reminders, follow-ups, progress notes, etc.) */}
      {editing && isShareable && (
        <TextInput
          style={s.editInput}
          value={editText || item.preparedData?.template || ''}
          onChangeText={setEditText}
          multiline
          placeholder={t('vasco.editMessage', 'Pas bericht aan...')}
          placeholderTextColor={SemanticColors.textTertiary}
        />
      )}

      {/* Amount display for all invoice-type items */}
      {isInvoiceType && (item.preparedData?.amount || item.preparedData?.totalRevenue || item.preparedData?.newTotal) && (
        <Text style={s.embeddedAmount}>€{Number(item.preparedData.newTotal || item.preparedData.totalRevenue || item.preparedData.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
      )}

      {/* Impact line */}
      {item.estimatedImpact && (
        <Text style={s.embeddedImpact}>{item.estimatedImpact}</Text>
      )}

      {/* Action buttons */}
      <View style={s.embeddedActions}>
        {isShareable && (
          <Pressable style={s.editBtn} onPress={() => setEditing(!editing)}>
            <Ionicons name={editing ? 'checkmark' : 'create-outline'} size={14} color={Palette.hermesOrange} />
          </Pressable>
        )}
        <Pressable style={[s.approveBtn, approving && s.disabled]} onPress={handleApprove} disabled={approving} accessibilityLabel={t('a11y.approveAction', 'Approve action')}>
          {approving ? (
            <ActivityIndicator size="small" color={Palette.white} />
          ) : (
            <Ionicons name="checkmark" size={14} color={Palette.white} />
          )}
          <Text style={s.approveBtnText}>{item.actionLabel}</Text>
        </Pressable>
        <Pressable style={s.rejectBtn} onPress={onReject} accessibilityLabel={t('a11y.rejectAction', 'Reject action')}>
          <Ionicons name="close" size={14} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex1: {
    flex: 1,
  },
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
  disabled: {
    opacity: 0.6,
  },
});
