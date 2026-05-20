// =============================================================================
// PIPELINE — Sales-pipeline Kanban (R81 US Phase 4)
// =============================================================================
// 5-column lead pipeline mirroring Housecall Pro / Jobber UX. Horizontally
// scrolling so all stages stay visible. Long-press a lead card to move it
// to another column; tap to edit.
//
// Net-new screen for US contractors per us-market-research.md — EU
// contractors mostly run reactive quoting and won't see this in any tab
// today, but the screen is country-agnostic so DE/FR/etc. can adopt it
// later via a settings flag.
//
// Data: reads/writes leads array via AppState.addLead/updateLead/moveLeadStatus.
// Empty state encourages either manual lead entry or web-form embed.
// =============================================================================

import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../src/state/AppState';
import {
  groupLeadsByStatus,
  pipelineValue,
  winRate,
  LEAD_STATUS_ORDER,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONE,
  type Lead,
  type LeadStatus,
  type LeadSource,
} from '../../src/domain/lead';
import { SemanticColors } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { DK } from '../../src/theme/draftkings';

const TONE_COLOR: Record<'neutral' | 'info' | 'amber' | 'success' | 'danger', string> = {
  neutral: DK.colors.textMuted,
  info: '#3B82F6',
  amber: DK.colors.highlight,
  success: '#22C55E',
  danger: '#EF4444',
};

const SOURCES: { id: LeadSource; label: string }[] = [
  { id: 'website_form', label: 'Website form' },
  { id: 'phone_inbound', label: 'Phone call' },
  { id: 'referral', label: 'Referral' },
  { id: 'social', label: 'Social / DM' },
  { id: 'google_lsa', label: 'Google LSA' },
  { id: 'angi', label: 'Angi' },
  { id: 'thumbtack', label: 'Thumbtack' },
  { id: 'manual', label: 'Manual' },
  { id: 'rejected_estimate', label: 'Rejected estimate' },
  { id: 'other', label: 'Other' },
];

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function formatUsd(n?: number): string {
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export default function PipelineScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { leads, addLead, updateLead, removeLead, moveLeadStatus } = useAppState();

  const grouped = useMemo(() => groupLeadsByStatus(leads), [leads]);
  const totalValue = useMemo(() => pipelineValue(leads), [leads]);
  const wr = useMemo(() => winRate(leads, 90), [leads]);

  const [editing, setEditing] = useState<Lead | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const handleStatusMove = (lead: Lead) => {
    Alert.alert(
      t('pipeline.move', 'Move lead'),
      `${lead.customerName} — ${LEAD_STATUS_LABELS[lead.status]}`,
      [
        ...LEAD_STATUS_ORDER.filter((s) => s !== lead.status).map((s) => ({
          text: LEAD_STATUS_LABELS[s],
          onPress: () => moveLeadStatus(lead.id, s),
        })),
        { text: t('common.cancel', 'Cancel'), style: 'cancel' as const },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('pipeline.title', 'Pipeline')}</Text>
        <Pressable onPress={() => setShowAdd(true)} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="add" size={26} color={DK.colors.accent} />
        </Pressable>
      </View>

      {/* KPI strip */}
      <View style={styles.kpiStrip}>
        <KpiTile label={t('pipeline.openLeads', 'Open leads')} value={String(leads.filter((l) => l.status !== 'lost' && l.status !== 'won').length)} />
        <KpiTile label={t('pipeline.value', 'Value')} value={formatUsd(totalValue)} />
        <KpiTile label={t('pipeline.winRate', 'Win rate · 90d')} value={`${wr}%`} />
      </View>

      {leads.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trending-up-outline" size={48} color={SemanticColors.textTertiary} />
          <Text style={styles.emptyTitle}>{t('pipeline.empty', 'No leads yet')}</Text>
          <Text style={styles.emptyBody}>
            {t('pipeline.emptyBody', 'Track every inbound inquiry so none falls through the cracks. Add a lead manually, or wire up a website-form widget (coming soon).')}
          </Text>
          <Pressable style={styles.emptyCta} onPress={() => setShowAdd(true)}>
            <Ionicons name="add-circle" size={20} color={DK.colors.accent} />
            <Text style={styles.emptyCtaText}>{t('pipeline.addLead', 'Add lead')}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kanban}
        >
          {LEAD_STATUS_ORDER.map((status) => {
            const items = grouped[status];
            const tone = TONE_COLOR[LEAD_STATUS_TONE[status]];
            return (
              <View key={status} style={styles.column}>
                <View style={styles.columnHeader}>
                  <View style={[styles.statusDot, { backgroundColor: tone }]} />
                  <Text style={styles.columnTitle}>{LEAD_STATUS_LABELS[status]}</Text>
                  <Text style={styles.columnCount}>{items.length}</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {items.length === 0 ? (
                    <Text style={styles.columnEmpty}>—</Text>
                  ) : (
                    items.map((lead) => (
                      <Pressable
                        key={lead.id}
                        style={styles.card}
                        onPress={() => setEditing(lead)}
                        onLongPress={() => handleStatusMove(lead)}
                      >
                        <Text style={styles.cardName}>{lead.customerName}</Text>
                        {lead.jobDescription ? (
                          <Text style={styles.cardDesc} numberOfLines={2}>
                            {lead.jobDescription}
                          </Text>
                        ) : null}
                        <View style={styles.cardFoot}>
                          <Text style={styles.cardValue}>{formatUsd(lead.estimatedValue)}</Text>
                          <Text style={styles.cardAge}>{daysSince(lead.createdAt)}d</Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}

      <LeadModal
        visible={showAdd || editing !== null}
        original={editing ?? undefined}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSave={async (data, originalLead) => {
          if (originalLead) {
            await updateLead(originalLead.id, data);
          } else {
            await addLead({
              status: 'new',
              source: 'manual',
              customerName: data.customerName ?? '',
              customerPhone: data.customerPhone,
              customerEmail: data.customerEmail,
              jobDescription: data.jobDescription,
              estimatedValue: data.estimatedValue,
              notes: data.notes,
            });
          }
          setShowAdd(false);
          setEditing(null);
        }}
        onDelete={editing ? () => {
          Alert.alert(
            t('pipeline.deleteLead', 'Delete lead'),
            `${editing.customerName}?`,
            [
              { text: t('common.cancel', 'Cancel'), style: 'cancel' },
              {
                text: t('common.delete', 'Delete'),
                style: 'destructive',
                onPress: async () => {
                  await removeLead(editing.id);
                  setEditing(null);
                },
              },
            ],
          );
        } : undefined}
      />
    </SafeAreaView>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiTile}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

interface LeadModalProps {
  visible: boolean;
  original?: Lead;
  onClose: () => void;
  onSave: (data: Partial<Lead>, original?: Lead) => Promise<void>;
  onDelete?: () => void;
}

function LeadModal({ visible, original, onClose, onSave, onDelete }: LeadModalProps) {
  const { t } = useTranslation();
  const [customerName, setName] = useState(original?.customerName ?? '');
  const [customerPhone, setPhone] = useState(original?.customerPhone ?? '');
  const [customerEmail, setEmail] = useState(original?.customerEmail ?? '');
  const [jobDescription, setDesc] = useState(original?.jobDescription ?? '');
  const [estimatedValue, setValue] = useState(original?.estimatedValue?.toString() ?? '');
  const [notes, setNotes] = useState(original?.notes ?? '');

  const canSave = customerName.trim().length > 0;

  const handleSave = () => {
    onSave({
      customerName: customerName.trim(),
      customerPhone: customerPhone || undefined,
      customerEmail: customerEmail || undefined,
      jobDescription: jobDescription || undefined,
      estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      notes: notes || undefined,
    }, original);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <Ionicons name="close" size={26} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {original ? t('pipeline.editLead', 'Edit lead') : t('pipeline.addLead', 'Add lead')}
          </Text>
          <Pressable disabled={!canSave} onPress={handleSave}>
            <Text style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}>
              {t('common.save', 'Save')}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: GRID.lg }}>
          <Field label={t('pipeline.customer', 'Customer name *')} value={customerName} onChange={setName} placeholder="Jane Doe" />
          <Field label={t('pipeline.phone', 'Phone')} value={customerPhone} onChange={setPhone} placeholder="+1 555 0123" keyboardType="phone-pad" />
          <Field label={t('pipeline.email', 'Email')} value={customerEmail} onChange={setEmail} placeholder="jane@example.com" keyboardType="email-address" />
          <Field label={t('pipeline.job', 'Job description')} value={jobDescription} onChange={setDesc} placeholder="HVAC service call" multiline />
          <Field label={t('pipeline.value', 'Estimated value ($)')} value={estimatedValue} onChange={setValue} placeholder="385" keyboardType="numeric" />
          <Field label={t('pipeline.notes', 'Notes')} value={notes} onChange={setNotes} placeholder="Customer prefers afternoon" multiline />

          {original && onDelete ? (
            <Pressable onPress={onDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color="#FECACA" />
              <Text style={styles.deleteBtnText}>{t('pipeline.deleteLead', 'Delete lead')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({
  label, value, onChange, placeholder, keyboardType, multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: GRID.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={SemanticColors.textTertiary}
        style={[styles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  backBtn: { padding: GRID.xs },
  headerTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  saveBtn: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.accent,
    paddingHorizontal: GRID.sm,
  },
  saveBtnDisabled: { opacity: 0.4 },
  kpiStrip: {
    flexDirection: 'row',
    gap: GRID.sm,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
  },
  kpiTile: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
  },
  kpiLabel: {
    fontSize: 10,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  kpiValue: {
    fontSize: 22,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  kanban: {
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    gap: GRID.md,
  },
  column: {
    width: 240,
    backgroundColor: DK.colors.panel2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: GRID.sm,
    maxHeight: 600,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingHorizontal: 4,
    paddingBottom: GRID.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    marginBottom: GRID.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  columnTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  columnCount: {
    fontSize: 12,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  columnEmpty: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
    paddingVertical: GRID.md,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: GRID.sm,
    marginBottom: GRID.xs,
  },
  cardName: {
    fontSize: 14,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: GRID.xs,
    paddingTop: GRID.xs,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  cardValue: {
    fontSize: 13,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.highlight,
  },
  cardAge: {
    fontSize: 11,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: GRID.xl,
    gap: GRID.md,
  },
  emptyTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  emptyBody: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingHorizontal: GRID.lg,
    paddingVertical: GRID.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: `${DK.colors.accent}66`,
    backgroundColor: `${DK.colors.accent}11`,
  },
  emptyCtaText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.accent,
  },
  label: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: GRID.xs,
  },
  input: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  deleteBtn: {
    marginTop: GRID.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#7F1D1D22',
  },
  deleteBtnText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: '#FECACA',
  },
});
