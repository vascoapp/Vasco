// =============================================================================
// VASCO CARD — Unified AI card (replaces 4 separate AI sections)
// =============================================================================
// One card. One section. Everything AI in one place.
// Collapsed: smart summary with top priority. Expanded: briefing + queue + insight.
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Share, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { hapticSuccess, hapticError } from '../../utils/haptics';
import type { MorningBriefing } from '../../intelligence/backgroundJobScheduler';
import type { QueueItem } from '../../services/aiActionQueueService';
import { snoozeQueueItem, recordOutcome } from '../../services/aiActionQueueService';
import type { ScoredInsight } from '../../intelligence/generators/types';
import { formatAmount } from '../../utils/formatAmount';

type IconName = keyof typeof Ionicons.glyphMap;

interface VascoCardProps {
  briefing: MorningBriefing | null;
  queueItems: QueueItem[];
  topInsight: ScoredInsight | null;
  automationsCount: number;
  complianceStatus?: { valid: number; expiring: number; expired: number } | null;
  pendingDecisions?: number;
  onApproveQueueItem: (id: string, editedText?: string) => void;
  onRejectQueueItem: (id: string) => void;
  onInsightAction?: (insight: ScoredInsight) => void;
}

// ---------------------------------------------------------------------------
// Confidence badge helper
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const { t } = useTranslation();
  const pct = Math.round(confidence * 100);
  let dotColor: string;
  let label: string;
  if (confidence >= 0.8) {
    dotColor = SemanticColors.feedbackSuccess;
    label = t('ai.highConfidence', 'High confidence');
  } else if (confidence >= 0.6) {
    dotColor = Palette.hermesOrange;
    label = t('ai.mediumConfidence', 'Medium');
  } else {
    dotColor = SemanticColors.textTertiary;
    label = t('ai.learning', 'Learning');
  }
  return (
    <View style={s.confidenceBadge} accessibilityLabel={`${label}: ${pct}%`}>
      <View style={[s.confidenceDot, { backgroundColor: dotColor }]} />
      <Text style={[s.confidenceText, { color: dotColor }]}>{pct}%</Text>
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
  onApproveQueueItem,
  onRejectQueueItem,
  onInsightAction,
}: VascoCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true); // EVE pattern: show value first
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const router = useRouter();

  const findingsCount = briefing?.findings.length ?? 0;
  const queueCount = queueItems.length;
  const hasContent = findingsCount > 0 || queueCount > 0 || topInsight || automationsCount > 0;

  if (!hasContent && !briefing) {
    // First-run placeholder — without this, new users see a blank dashboard
    return (
      <Pressable
        onPress={() => router.push('/contractor/tiered-quote' as any)}
        style={s.emptyCard}
        accessibilityRole="button"
        accessibilityLabel={t('vasco.emptyCta', 'Create your first quote to see AI insights')}
      >
        <View style={s.emptyIconWrap}>
          <Ionicons name="sparkles" size={22} color={Palette.hermesOrange} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.emptyTitle}>{t('vasco.emptyTitle', 'Vasco is ready')}</Text>
          <Text style={s.emptyDesc}>{t('vasco.emptyDesc', 'Add your first quote or job and I\'ll start preparing actions here.')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
      </Pressable>
    );
  }

  // ── Smart collapsed summary: show top priority item ──
  const criticalFindings = briefing?.findings.filter(f => f.severity === 'critical') ?? [];
  const hasCritical = criticalFindings.length > 0;
  let collapsedSummary: string;
  if (hasCritical) {
    const topCritical = criticalFindings[0];
    const numericMatch = topCritical.description?.match(/€\s*([\d.,]+)/);
    const amountStr = numericMatch
      ? `${formatAmount(parseFloat(numericMatch[1].replace(/\./g, '').replace(',', '.')))} `
      : '';
    const totalActions = queueCount + findingsCount;
    collapsedSummary = `${amountStr}${topCritical.title.slice(0, 40)} — ${totalActions} actions ready`;
  } else if (queueCount > 0) {
    const topItem = queueItems[0];
    const moreCount = queueCount - 1;
    collapsedSummary = moreCount > 0
      ? `${topItem.title.slice(0, 35)} — ${moreCount} more`
      : topItem.title;
  } else if (findingsCount > 0) {
    collapsedSummary = t('vasco.findingsCount', { defaultValue: '{{count}} findings', count: findingsCount });
  } else {
    const checkedTime = briefing?.generatedAt
      ? new Date(briefing.generatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : '';
    collapsedSummary = checkedTime
      ? t('vasco.allClearAt', { defaultValue: 'All clear — checked at {{time}}', time: checkedTime })
      : t('vasco.allGood', 'All clear');
  }

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && !expanded && { opacity: 0.9 }]}
      onPress={() => setExpanded(!expanded)}
      accessibilityRole="button"
      accessibilityLabel={t('a11y.vascoCard', 'Vasco AI card')}
      accessibilityHint={expanded ? t('a11y.tapToCollapse', 'Tap to collapse') : t('a11y.tapToExpand', 'Tap to expand')}
    >
      {/* Header — always visible */}
      <View style={s.header}>
        <View style={s.iconCircle}>
          <Ionicons name="flash" size={16} color={Palette.hermesOrange} />
        </View>
        <View style={s.flex1}>
          <Text style={s.title}>Vasco</Text>
          <View style={s.summaryRow}>
            {hasCritical && (
              <Ionicons name="alert-circle" size={14} color={SemanticColors.feedbackError} />
            )}
            <Text style={[s.summary, s.flex1]} numberOfLines={1}>
              {collapsedSummary}
            </Text>
          </View>
        </View>
        {/* Expo Router requires 'as any' for dynamic routes — tracked in expo-router#123 */}
        <Pressable onPress={() => router.push('/contractor/automations' as any)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.automationSettings', 'Automation settings')}>
          <Ionicons name="settings-outline" size={16} color={SemanticColors.textTertiary} />
        </Pressable>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={SemanticColors.textTertiary} />
      </View>

      {/* Expanded content */}
      {expanded && (
        <View style={s.content}>
          {/* Personal summary + proactive alerts from morning briefing */}
          {briefing?.personalSummary && (
            <View style={s.section}>
              <Text style={s.personalSummary}>{briefing.personalSummary}</Text>
              {(briefing.proactiveAlerts ?? []).length > 0 && (
                <View style={s.alertsContainer}>
                  {(showAllAlerts ? briefing.proactiveAlerts : briefing.proactiveAlerts.slice(0, 2)).map((alert, idx) => (
                    <View key={idx} style={s.alertRow}>
                      <Ionicons name="arrow-forward-circle-outline" size={13} color={Palette.hermesOrange} />
                      <Text style={s.alertText}>{alert}</Text>
                    </View>
                  ))}
                  {briefing.proactiveAlerts.length > 2 && !showAllAlerts && (
                    <Pressable onPress={() => setShowAllAlerts(true)} style={s.showMoreBtn} accessibilityRole="button" accessibilityLabel={t('vasco.showMore', 'Show more alerts', { count: briefing.proactiveAlerts.length - 2 })}>
                      <Text style={s.showMoreText}>{t('vasco.showMore', 'Show {{count}} more', { count: briefing.proactiveAlerts.length - 2 })}</Text>
                      <Ionicons name="chevron-down" size={12} color={Palette.hermesOrange} />
                    </Pressable>
                  )}
                </View>
              )}
              {briefing.tradeContext && (
                <Text style={s.tradeContext}>{briefing.tradeContext}</Text>
              )}
            </View>
          )}

          {/* Morning briefing findings — each is actionable (EVE pattern) */}
          {briefing && findingsCount > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>{t('vasco.checkedOvernight', 'Vannacht gecontroleerd')}</Text>
              {briefing.findings.slice(0, showAllFindings ? findingsCount : 2).map(f => (
                <Pressable
                  key={f.id}
                  style={s.findingRow}
                  accessibilityRole="button"
                  accessibilityLabel={f.title}
                  accessibilityHint={t('a11y.opensDetails', 'Opens details')}
                  onPress={() => {
                    if (f.entityType === 'invoice') router.push(`/invoices/${f.entityId}` as any);
                    else if (f.entityType === 'quote') router.push(`/quotes/${f.entityId}` as any);
                    else if (f.entityType === 'job') router.push(`/contractor/job/${f.entityId}` as any);
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
              {findingsCount > 2 && !showAllFindings && (
                <Pressable onPress={() => setShowAllFindings(true)} style={s.showMoreBtn} accessibilityRole="button" accessibilityLabel={t('vasco.seeMore', { defaultValue: 'See {{count}} more', count: findingsCount - 2 })}>
                  <Text style={s.showMoreText}>{t('vasco.seeMore', { defaultValue: 'See {{count}} more', count: findingsCount - 2 })}</Text>
                  <Ionicons name="chevron-down" size={12} color={Palette.hermesOrange} />
                </Pressable>
              )}
              {showAllFindings && findingsCount > 2 && (
                <Pressable onPress={() => setShowAllFindings(false)} style={s.showMoreBtn} accessibilityRole="button" accessibilityLabel={t('vasco.showLess', 'Show less')}>
                  <Text style={s.showMoreText}>{t('vasco.showLess', 'Show less')}</Text>
                  <Ionicons name="chevron-up" size={12} color={Palette.hermesOrange} />
                </Pressable>
              )}
            </View>
          )}

          {/* AI action queue — embedded approval (EVE pattern) */}
          {queueCount > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>{t('vasco.readyForApproval', 'Klaar voor goedkeuring')}</Text>
              {queueItems.slice(0, showAllFindings ? queueCount : 2).map(item => (
                <EmbeddedApproval
                  key={item.id}
                  item={item}
                  onApprove={(editedText?: string) => { hapticSuccess(); onApproveQueueItem(item.id, editedText); }}
                  onReject={() => { hapticError(); onRejectQueueItem(item.id); }}
                  onSnooze={(hours: number) => { snoozeQueueItem(item.id, hours); }}
                />
              ))}
            </View>
          )}

          {/* Top insight with action + confidence badge */}
          {topInsight && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>{t('vasco.recommendation', 'Aanbeveling')}</Text>
              <Pressable
                style={s.insightRow}
                onPress={() => onInsightAction?.(topInsight)}
                accessibilityRole="button"
                accessibilityLabel={topInsight.title}
                accessibilityHint={t('a11y.opensRecommendation', 'Opens recommendation details')}
              >
                <Ionicons name={(topInsight.icon as IconName) || 'bulb'} size={16} color={Palette.hermesOrange} />
                <View style={s.flex1}>
                  <View style={s.insightTitleRow}>
                    <Text style={[s.insightTitle, s.flex1]} numberOfLines={1}>{topInsight.title}</Text>
                    <ConfidenceBadge confidence={topInsight.confidence} />
                  </View>
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
    case 'decision_reminder': return 'help-circle-outline';
    case 'maintenance_due': return 'build-outline';
    case 'accounting_export': return 'cloud-upload-outline';
    case 'einvoice_submit': return 'document-attach-outline';
    case 'customer_question': return 'chatbubbles-outline';
    default: return 'ellipse-outline';
  }
}

function EmbeddedApproval({ item, onApprove, onReject, onSnooze }: {
  item: QueueItem;
  onApprove: (editedText?: string) => void;
  onReject: () => void;
  onSnooze: (hours: number) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [approving, setApproving] = useState(false);

  // Customer-question items: contractor approves a draft reply that gets
  // written back to the portal. No Share sheet — the portal IS the channel.
  const isCustomerQuestion = item.type === 'customer_question';

  // Types that share a message to the customer (editable before sending)
  const isShareable = [
    'draft_reminder', 'draft_followup', 'progress_note', 'quote_expiry',
    'satisfaction_survey', 'job_handover', 'decision_reminder', 'reorder_materials',
  ].includes(item.type);

  // Types that display an amount
  const isInvoiceType = [
    'draft_invoice', 'batch_invoices', 'invoice_regenerate', 'draft_reminder',
  ].includes(item.type);

  // R66r49 #7: pack-sourced items get a "Stop reminding this customer"
  // option in the snooze sheet. Without this escape valve, contractors
  // disable the whole pack after one annoying repeat — losing the
  // automation value on every other customer too. Mute is for 90 days
  // and is per-customer/per-pack, not global.
  const packId = (item.preparedData as any)?.packId as string | undefined;
  const customerId = (item.preparedData as any)?.customerId as string | undefined;
  const isPackSourced = Boolean(packId && customerId);

  const handleSnooze = () => {
    const baseOptions = [
      { text: t('vasco.snooze1h', '1 hour'), onPress: () => onSnooze(1) },
      { text: t('vasco.snoozeTomorrow', 'Tomorrow'), onPress: () => onSnooze(24) },
      { text: t('vasco.snooze3d', '3 days'), onPress: () => onSnooze(72) },
    ];
    const muteOption = isPackSourced
      ? [{
          text: t('vasco.muteCustomer', 'Stop reminding this customer'),
          onPress: async () => {
            try {
              const { muteCustomerForPack } = await import('../../services/workflowPackService');
              await muteCustomerForPack(packId!, customerId!);
            } catch {}
            // Reject the current item too — the next evaluation tick
            // will skip this customer-pack pair for 90 days.
            onReject();
          },
        }]
      : [];
    Alert.alert(
      t('vasco.snooze', 'Remind later'),
      t('vasco.snoozeWhen', 'When should we remind you?'),
      [
        ...baseOptions,
        ...muteOption,
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      ]
    );
  };

  const handleApprove = async () => {
    if (approving) return; // Prevent double-tap
    setApproving(true);
    try {
      if (isCustomerQuestion) {
        // Reply goes back to the portal via DB — no Share sheet. Pass edited
        // text (or fall back to draft) up to the approve handler which writes
        // to customer_questions.approved_reply.
        const draft = (item.preparedData?.draftReply as string) || item.description;
        const reply = editText.trim() || draft;
        onApprove(reply);
        return;
      }
      if (isShareable) {
        const template = item.preparedData?.template || item.description;
        const text = editText || template;
        try {
          await Share.share({ message: text, title: item.title });
          // Show outcome feedback after sharing
          const itemId = item.id;
          setTimeout(() => {
            Alert.alert(
              t('vasco.didItWork', 'Quick feedback'),
              t('vasco.didCustomerRespond', 'Did the customer respond?'),
              [
                { text: t('vasco.yesResponded', 'Yes'), onPress: () => recordOutcome(itemId, 'positive') },
                { text: t('vasco.notYet', 'Not yet'), style: 'cancel' },
                { text: t('vasco.noResponse', 'No'), onPress: () => recordOutcome(itemId, 'negative') },
              ]
            );
          }, 2000);
        } catch {}
      }
      onApprove();
    } finally {
      setApproving(false);
    }
  };

  // "Why now?" reasoning from preparedData
  const reasoning = item.preparedData?.reasoning as string | undefined;

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

      {/* Customer intelligence context line */}
      {item.preparedData?.customerContext && (
        <View style={s.customerContextRow}>
          <Ionicons name="person-outline" size={11} color={SemanticColors.textTertiary} />
          <Text style={s.customerContext}>{item.preparedData.customerContext}</Text>
        </View>
      )}

      {/* "Why now?" reasoning line */}
      {reasoning && (
        <Text style={s.reasoningText} numberOfLines={2}>{reasoning}</Text>
      )}

      {/* Customer-question block: question + AI draft reply + edit */}
      {isCustomerQuestion && (
        <View style={s.cqBlock}>
          <Text style={s.cqQuestionLabel}>{t('vasco.cqAsked', 'Customer asked')}</Text>
          <Text style={s.cqQuestionText} numberOfLines={editing ? undefined : 3}>
            {(item.preparedData?.question as string) || ''}
          </Text>
          {editing ? (
            <TextInput
              style={s.editInput}
              value={editText || (item.preparedData?.draftReply as string) || ''}
              onChangeText={setEditText}
              multiline
              placeholder={t('vasco.editReply', 'Edit the reply…')}
              placeholderTextColor={SemanticColors.textTertiary}
            />
          ) : (
            <>
              <Text style={s.cqDraftLabel}>{t('vasco.cqDraftReply', 'Draft reply')}</Text>
              <Text style={s.cqDraftText}>{(item.preparedData?.draftReply as string) || ''}</Text>
            </>
          )}
        </View>
      )}

      {/* Editable preview for shareable items (reminders, follow-ups, progress notes, etc.) */}
      {editing && isShareable && !isCustomerQuestion && (
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
        <Text style={s.embeddedAmount}>{formatAmount(Number(item.preparedData.newTotal || item.preparedData.totalRevenue || item.preparedData.amount))}</Text>
      )}

      {/* Impact line */}
      {item.estimatedImpact && (
        <Text style={s.embeddedImpact}>{item.estimatedImpact}</Text>
      )}

      {/* Action buttons */}
      <View style={s.embeddedActions}>
        {(isShareable || isCustomerQuestion) && (
          <Pressable style={s.editBtn} onPress={() => setEditing(!editing)} accessibilityRole="button" accessibilityLabel={t('a11y.editMessage', 'Edit message')}>
            <Text style={s.editBtnText}>{editing ? t('vasco.done', 'Done') : t('vasco.edit', 'Edit')}</Text>
          </Pressable>
        )}
        {isShareable && item.preparedData?.customerPhone && (
          <Pressable
            style={s.whatsappBtn}
            accessibilityRole="button"
            accessibilityLabel="Send via WhatsApp"
            onPress={async () => {
              const { sendWhatsApp } = await import('../../services/whatsappService');
              await sendWhatsApp(item.preparedData!.customerPhone as string, editText || (item.preparedData?.template as string) || item.description);
              hapticSuccess();
              onApprove();
            }}
          >
            <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
          </Pressable>
        )}
        <Pressable style={[s.approveBtn, approving && s.disabled]} onPress={handleApprove} disabled={approving} accessibilityRole="button" accessibilityLabel={t('a11y.approveAction', 'Approve action')}>
          {approving ? (
            <ActivityIndicator size="small" color={Palette.white} />
          ) : (
            <Ionicons name="checkmark" size={14} color={Palette.white} />
          )}
          <Text style={s.approveBtnText}>{isCustomerQuestion ? t('vasco.cqSendReply', 'Send reply') : item.actionLabel}</Text>
        </Pressable>
        <Pressable style={s.snoozeBtn} onPress={handleSnooze} accessibilityRole="button" accessibilityLabel={t('vasco.snooze', 'Remind later')}>
          <Ionicons name="time-outline" size={14} color={SemanticColors.textTertiary} />
        </Pressable>
        <Pressable style={s.rejectBtn} onPress={onReject} accessibilityRole="button" accessibilityLabel={t('a11y.rejectAction', 'Reject action')}>
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
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm + 2,
    padding: GRID.md - 2,
  },
  iconCircle: {
    width: GRID.xl,
    height: GRID.xl,
    borderRadius: GRID.md,
    backgroundColor: Palette.hermesOrange + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    marginTop: 1,
  },
  summary: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },
  content: {
    paddingHorizontal: GRID.md - 2,
    paddingBottom: GRID.md - 2,
    gap: GRID.md - 4,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  section: {
    gap: GRID.sm - 2,
    paddingTop: GRID.sm + 2,
  },
  sectionLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Personal summary + proactive alerts
  personalSummary: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textPrimary,
    lineHeight: TYPE.captionSize + 5,
  },
  alertsContainer: {
    gap: GRID.xs - 1,
    marginTop: GRID.xs,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm - 2,
  },
  alertText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: Palette.hermesOrange,
    flex: 1,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs,
    paddingTop: GRID.xs,
  },
  showMoreText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  tradeContext: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.textTertiary,
    fontStyle: 'italic',
    marginTop: GRID.xs,
  },
  // Findings
  findingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
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
    padding: GRID.sm + 2,
    gap: GRID.sm - 2,
  },
  embeddedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  reasoningText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    fontStyle: 'italic',
    paddingLeft: GRID.lg,
  },
  embeddedAmount: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    paddingLeft: GRID.lg,
  },
  embeddedImpact: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: SemanticColors.feedbackSuccess,
    paddingLeft: GRID.lg,
  },
  embeddedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm - 2,
    paddingLeft: GRID.lg,
  },
  editInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: GRID.sm,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textPrimary,
    minHeight: 60,
    marginLeft: GRID.lg,
  },
  cqBlock: {
    marginLeft: GRID.lg,
    gap: GRID.xs,
  },
  cqQuestionLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cqQuestionText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  cqDraftLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: GRID.xs,
  },
  cqDraftText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textPrimary,
    backgroundColor: Palette.hermesOrange + '0D',
    borderRadius: RADIUS.sm,
    padding: GRID.sm,
  },
  editBtn: {
    backgroundColor: Palette.hermesOrange + '12',
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  whatsappBtn: {
    width: RADIUS.full,
    height: RADIUS.full,
    borderRadius: RADIUS.full / 2,
    backgroundColor: '#25D36612',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Queue (legacy — keeping for backward compat)
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
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
  customerContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingLeft: GRID.lg,
  },
  customerContext: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    fontStyle: 'italic',
    color: SemanticColors.textTertiary,
    flex: 1,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.xs,
    flex: 1,
    justifyContent: 'center',
  },
  approveBtnText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
  snoozeBtn: {
    width: RADIUS.full,
    height: RADIUS.full,
    borderRadius: RADIUS.full / 2,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    width: RADIUS.full,
    height: RADIUS.full,
    borderRadius: RADIUS.full / 2,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Insight
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: GRID.sm + 2,
  },
  insightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm - 2,
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
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.xs,
  },
  insightActionText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: Palette.hermesOrange,
  },
  // Confidence badge
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs - 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.full,
    paddingHorizontal: GRID.sm - 2,
    paddingVertical: 2,
  },
  confidenceDot: {
    width: GRID.sm - 2,
    height: GRID.sm - 2,
    borderRadius: (GRID.sm - 2) / 2,
  },
  confidenceText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.tinyFamily,
  },
  disabled: {
    opacity: 0.6,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm + 4,
    backgroundColor: Palette.white,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
  },
  emptyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.hermesOrange + '12',
  },
  emptyTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  emptyDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
});
