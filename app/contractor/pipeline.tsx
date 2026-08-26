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

import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { hapticSuccess, hapticWarning } from '../../src/utils/haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import { useAuth } from '../../src/context/AuthContext';
import { formatCurrency0, currencySymbol, type Country } from '../../src/i18n/formatting';
import { DKMenu, type DKMenuItem } from '../../src/components/shared/DKMenu';
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

// The Leads CRM was built for the US launch (R74–R89) and this formatter came
// with it: a hardcoded "$" and an en-US grouping locale. The screen is reachable
// by every contractor, so a Dutch pipeline reported its value as "$0" — and with
// en-US grouping a real figure would have read "$12,500" to someone who writes
// it "€ 12.500". Amount and symbol both follow the contractor's country now.
function formatLeadValue(n: number | undefined, country: Country): string {
  if (n == null) return '—';
  return formatCurrency0(Math.round(n), country);
}

// R90: column bounds snapshot for drag hit-testing. Captured via onLayout
// on each column View and stored by status key. Updated whenever the
// horizontal scroll position changes (so the user can drop into a column
// that wasn't visible when the drag started).
interface ColumnBounds {
  status: LeadStatus;
  x: number;       // left edge in horizontal-ScrollView content space
  width: number;
}

export default function PipelineScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { leads, addLead, updateLead, removeLead, moveLeadStatus } = useAppState();
  const { user } = useAuth();
  const country = (user?.country as Country) ?? 'NL';

  const grouped = useMemo(() => groupLeadsByStatus(leads), [leads]);
  const totalValue = useMemo(() => pipelineValue(leads), [leads]);
  const wr = useMemo(() => winRate(leads, 90), [leads]);

  const [editing, setEditing] = useState<Lead | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // R90: drag-to-move state. `dragging` holds the lead being dragged
  // (null when not dragging). `hoverStatus` is the column currently
  // under the finger — used to highlight the drop target.
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [hoverStatus, setHoverStatus] = useState<LeadStatus | null>(null);
  const dragPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // Column bounds snapshot — populated by onLayout on each column. Bounds
  // are in the horizontal-ScrollView's content coordinate space.
  const columnBoundsRef = useRef<Record<LeadStatus, ColumnBounds | null>>({
    new: null, contacted: null, estimate_sent: null, won: null, lost: null,
  });
  // Horizontal scroll offset of the Kanban container — needed to convert
  // finger pageX into content-space X for hit testing.
  const scrollXRef = useRef(0);

  const handleDragStart = (lead: Lead, startPageX: number, startPageY: number) => {
    setDragging(lead);
    setHoverStatus(lead.status);
    dragPos.setValue({ x: startPageX, y: startPageY });
    hapticWarning(); // medium-impact feedback on pickup
  };

  const handleDragMove = (pageX: number, pageY: number) => {
    dragPos.setValue({ x: pageX, y: pageY });
    // Hit-test: which column is the finger over?
    const contentX = pageX + scrollXRef.current;
    let hit: LeadStatus | null = null;
    for (const status of LEAD_STATUS_ORDER) {
      const b = columnBoundsRef.current[status];
      if (b && contentX >= b.x && contentX < b.x + b.width) {
        hit = status;
        break;
      }
    }
    if (hit !== hoverStatus) setHoverStatus(hit);
  };

  const handleDragEnd = () => {
    const lead = dragging;
    const target = hoverStatus;
    setDragging(null);
    setHoverStatus(null);
    if (lead && target && target !== lead.status) {
      moveLeadStatus(lead.id, target).catch(() => {});
      hapticSuccess();
    }
    dragPos.setValue({ x: 0, y: 0 });
  };

  // The fall-back picker — fires when a user long-presses but doesn't drag (or
  // the gesture fails). It was an `Alert.alert` spread from a `.map()`: four
  // destination columns plus cancel, of which Android renders THREE. So a lead
  // could not be moved to "Won" or "Lost" — the two that close it — from the
  // only control that works when the drag does not. #219/#221.
  const moveItemsFor = (lead: Lead): DKMenuItem[] =>
    LEAD_STATUS_ORDER.filter((s) => s !== lead.status).map((s) => ({
      key: s,
      label: LEAD_STATUS_LABELS[s],
      onPress: () => { moveLeadStatus(lead.id, s).catch(() => {}); hapticSuccess(); },
    }));

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
        <KpiTile label={t('pipeline.value', 'Value')} value={formatLeadValue(totalValue, country)} />
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
          scrollEnabled={!dragging}
          onScroll={(e) => { scrollXRef.current = e.nativeEvent.contentOffset.x; }}
          scrollEventThrottle={16}
        >
          {LEAD_STATUS_ORDER.map((status) => {
            const items = grouped[status];
            const tone = TONE_COLOR[LEAD_STATUS_TONE[status]];
            const isHover = hoverStatus === status && dragging !== null;
            return (
              <View
                key={status}
                style={[styles.column, isHover && styles.columnHover]}
                onLayout={(e: LayoutChangeEvent) => {
                  const { x, width } = e.nativeEvent.layout;
                  columnBoundsRef.current[status] = { status, x, width };
                }}
              >
                <View style={styles.columnHeader}>
                  <View style={[styles.statusDot, { backgroundColor: tone }]} />
                  <Text style={styles.columnTitle}>{LEAD_STATUS_LABELS[status]}</Text>
                  <Text style={styles.columnCount}>{items.length}</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={!dragging}>
                  {items.length === 0 ? (
                    <Text style={styles.columnEmpty}>—</Text>
                  ) : (
                    items.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        isDragging={dragging?.id === lead.id}
                        onTap={() => setEditing(lead)}
                        onDragStart={(x, y) => handleDragStart(lead, x, y)}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                        moveItems={moveItemsFor(lead)}
                      />
                    ))
                  )}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* R90: floating drag preview. Renders only while a card is being
          dragged. Positioned at the finger via Animated.ValueXY. The card
          underneath stays in place (greyed via isDragging prop) so the
          source position is visible but distinct from the floating one. */}
      {dragging ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dragPreview,
            {
              transform: [
                { translateX: Animated.subtract(dragPos.x, new Animated.Value(120)) },
                { translateY: Animated.subtract(dragPos.y, new Animated.Value(50)) },
              ],
            },
          ]}
        >
          <Text style={styles.cardName}>{dragging.customerName}</Text>
          {dragging.jobDescription ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{dragging.jobDescription}</Text>
          ) : null}
          <View style={styles.cardFoot}>
            <Text style={styles.cardValue}>{formatLeadValue(dragging.estimatedValue, country)}</Text>
            <Text style={styles.cardAge}>{daysSince(dragging.createdAt)}d</Text>
          </View>
        </Animated.View>
      ) : null}

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

// R90: draggable lead card. Long-press triggers drag mode; PanResponder
// then tracks finger position via the parent's callbacks. While dragging,
// the source card stays in place but renders dimmed (the floating preview
// follows the finger separately at the screen root).
//
// Why this shape: we want tap (edit lead) + long-press (start drag) on
// the same surface without conflicting. The PanResponder responds only
// after the long-press timer fires, so the surrounding ScrollView still
// owns vertical swipe gestures until the user holds the card.
function LeadCard({
  lead,
  isDragging,
  onTap,
  onDragStart,
  onDragMove,
  onDragEnd,
  moveItems,
}: {
  lead: Lead;
  isDragging: boolean;
  onTap: () => void;
  onDragStart: (pageX: number, pageY: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: () => void;
  moveItems: DKMenuItem[];
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const country = (user?.country as Country) ?? 'NL';
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartedRef = useRef(false);
  const movedRef = useRef(false);
  // Set by DKMenu's renderAnchor below; called by the long-press fallback.
  const openMenuRef = useRef<() => void>(() => {});

  const panResponder = useRef(
    PanResponder.create({
      // Start owning gestures on touch, but only "activate" (capture from
      // parent ScrollView) once the long-press timer has fired.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => dragStartedRef.current,
      onPanResponderGrant: (e) => {
        dragStartedRef.current = false;
        movedRef.current = false;
        const { pageX, pageY } = e.nativeEvent;
        longPressTimer.current = setTimeout(() => {
          if (!movedRef.current) {
            dragStartedRef.current = true;
            onDragStart(pageX, pageY);
          }
        }, 300);
      },
      onPanResponderMove: (e, gesture) => {
        // Tiny finger jitter before long-press → treat as a tap intent,
        // cancel the drag timer. Threshold accommodates most users.
        if (!dragStartedRef.current) {
          if (Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6) {
            movedRef.current = true;
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }
          return;
        }
        onDragMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderRelease: () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        if (dragStartedRef.current) {
          onDragEnd();
          dragStartedRef.current = false;
        } else if (!movedRef.current) {
          // No drag triggered + no jitter → treat as a tap.
          onTap();
        }
      },
      onPanResponderTerminate: () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        if (dragStartedRef.current) {
          onDragEnd();
          dragStartedRef.current = false;
        }
      },
    })
  ).current;

  // The menu is anchored on the card itself, so the popover lands over the
  // column the lead is in. `open` only exists inside renderAnchor, and the
  // long-press that needs it lives in a PanResponder created outside the
  // render — hence the ref. Writing a ref during render is idempotent and does
  // not participate in reconciliation.
  return (
    <DKMenu
      accessibilityLabel={`${t('pipeline.move', 'Move lead')} — ${lead.customerName}`}
      items={moveItems}
      renderAnchor={(open) => {
        openMenuRef.current = open;
        return (
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.card, isDragging && styles.cardSourceDimmed]}
            accessibilityRole="button"
            accessibilityLabel={`${lead.customerName}, long-press to drag, tap to edit`}
            accessibilityActions={[{ name: 'longpress', label: 'Move to another column' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'longpress') openMenuRef.current();
            }}
          >
            <Text style={styles.cardName}>{lead.customerName}</Text>
            {lead.jobDescription ? (
              <Text style={styles.cardDesc} numberOfLines={2}>
                {lead.jobDescription}
              </Text>
            ) : null}
            <View style={styles.cardFoot}>
              <Text style={styles.cardValue}>{formatLeadValue(lead.estimatedValue, country)}</Text>
              <Text style={styles.cardAge}>{daysSince(lead.createdAt)}d</Text>
            </View>
          </Animated.View>
        );
      }}
    />
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiTile}>
      {/* One third of the width, uppercase, letter-spaced — long localised
          labels overflow it and RN then breaks INSIDE the word: the Dutch
          "SCORINGSPERCENTAGE · 90D" rendered as "SCORINGSPE / RCENTAGE · 90D".
          Shrink to fit over two lines instead of hyphen-less mid-word
          splitting, so this holds for whichever locale has the longest word
          rather than being tuned to the one that happened to break. */}
      <Text
        style={styles.kpiLabel}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
      </Text>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
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

  const { user } = useAuth();
  const country = (user?.country as Country) ?? 'NL';

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
          <Field label={t('pipeline.valueField', { defaultValue: 'Estimated value ({{currency}})', currency: currencySymbol(country) })} value={estimatedValue} onChange={setValue} placeholder="385" keyboardType="numeric" />
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
    // 16pt of horizontal padding left ~82pt of content in a third-width tile,
    // which no readable size can fit a long compound label into. Half the
    // padding buys back the room the Dutch labels need.
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.sm,
  },
  kpiLabel: {
    fontSize: 10,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    // Was 1. On an 18-character uppercase word that is 18 extra points of
    // width spent on a label that already did not fit.
    letterSpacing: 0.4,
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
  // R90: highlight the column when the user's drag finger is over it.
  // Amber-tinted border + bg matches the DK Sunset Slate accent system.
  columnHover: {
    borderColor: DK.colors.accent,
    backgroundColor: `${DK.colors.accent}18`,
    shadowColor: DK.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
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
  // R90: dimmed source-position card while a copy follows the finger.
  cardSourceDimmed: {
    opacity: 0.35,
    borderStyle: 'dashed' as const,
  },
  // R90: floating clone that follows the finger during drag. Absolute-
  // positioned at the screen root; transform is driven by Animated.ValueXY.
  dragPreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 240,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: DK.colors.accent,
    padding: GRID.sm,
    shadowColor: DK.colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
    zIndex: 999,
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
