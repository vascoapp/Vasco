// =============================================================================
// PROJECT BILLING — termijnen (instalments) + meerwerk (change orders)
// =============================================================================
// An aannemer bills a project in instalments and agrees extra work along the
// way. This screen is where both happen.
//
// Two things it deliberately makes visible rather than hiding:
//
// 1. What the customer pays NOW versus the invoice face value. Retentie is
//    withheld from payment, not deducted from the invoice -- VAT is charged on
//    the full amount -- so the row shows the full term and the withheld figure
//    beneath it rather than one blended number.
//
// 2. Whether the customer was warned that meerwerk carried a price increase.
//    Art. 7:755 BW makes that warning the condition for being allowed to
//    charge at all, so an approved change order without one is shown as a
//    blocker with the fix attached, not as a quiet disabled button.
// =============================================================================

import { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../../src/theme/tabStyles';
import { SafeArea } from '../../../src/theme/spacing';
import { useAppState } from '../../../src/state/AppState';
import { useAuth } from '../../../src/context/AuthContext';
import { formatCurrency, type Country, formatDateShortAuto } from '../../../src/i18n/formatting';
import { hapticSuccess } from '../../../src/utils/haptics';
import { FadeIn } from '../../../src/components/shared/FadeIn';
import {
  billingProgress,
  termAmount,
  parseRetentionPercent,
  retentionForTerm,
  payableNow,
  validateBillingSchedule,
  canInvoiceChangeOrder,
  canReleaseRetention,
  blockingErrorsForTerm,
  nextTermToInvoice,
  validateChangeOrders,
} from '../../../src/services/progressBillingService';
import type { ProjectBillingTerm, ProjectChangeOrder } from '../../../src/types/project';

type IconName = keyof typeof Ionicons.glyphMap;

const TERM_STATUS_KEY: Record<ProjectBillingTerm['status'], string> = {
  pending: 'projectBilling.statusPending',
  ready: 'projectBilling.statusReady',
  invoiced: 'projectBilling.statusInvoiced',
  paid: 'projectBilling.statusPaid',
};

const CO_STATUS_KEY: Record<ProjectChangeOrder['status'], string> = {
  draft: 'projectBilling.coStatusDraft',
  proposed: 'projectBilling.coStatusProposed',
  approved: 'projectBilling.coStatusApproved',
  rejected: 'projectBilling.coStatusRejected',
  invoiced: 'projectBilling.statusInvoiced',
};

export default function ProjectBillingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    projects, invoices, updateProject,
    addTermInvoice, addChangeOrderInvoice, addRetentionReleaseInvoice,
  } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  const money = useCallback((n: number) => formatCurrency(n, country), [country]);

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id]);

  const [showTermForm, setShowTermForm] = useState(false);
  const [termTitle, setTermTitle] = useState('');
  const [termPercent, setTermPercent] = useState('');
  const [editingTerm, setEditingTerm] = useState<ProjectBillingTerm | null>(null);
  const [showRetentionForm, setShowRetentionForm] = useState(false);
  const [retentionInput, setRetentionInput] = useState('');
  const [showCoForm, setShowCoForm] = useState(false);
  const [coTitle, setCoTitle] = useState('');
  const [coAmount, setCoAmount] = useState('');

  const progress = useMemo(
    () => (project ? billingProgress(project, invoices) : null),
    [project, invoices],
  );
  const scheduleErrors = useMemo(
    () => (project ? validateBillingSchedule(project) : []),
    [project],
  );
  const changeOrderErrors = useMemo(
    () => (project ? validateChangeOrders(project) : []),
    [project],
  );
  // Which instalment is up next, so the row can say so rather than making the
  // contractor work it out from the status column.
  const nextTerm = useMemo(
    () => (project ? nextTermToInvoice(project) : null),
    [project],
  );

  if (!project || !progress) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        </View>
      </View>
    );
  }

  const terms = [...(project.billingTerms ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const changeOrders = [...(project.changeOrders ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const saveTerm = () => {
    const pct = Number(termPercent.replace(',', '.'));
    if (!termTitle.trim() || !Number.isFinite(pct) || pct <= 0) return;
    const next: ProjectBillingTerm = {
      id: `bt-${Date.now()}`,
      title: termTitle.trim(),
      basis: 'percent',
      percent: pct,
      status: 'pending',
      sortOrder: terms.length + 1,
    };
    updateProject(project.id, { billingTerms: [...terms, next] });
    hapticSuccess();
    closeTermForm();
  };

  // Retention could only be set at project creation, so every project that
  // already existed was stuck at 0% and the held/release surface below could
  // never appear for it. This is where retention is consumed, so it is where
  // it should be changeable.
  const openRetentionForm = () => {
    // Seed with the current value rather than blank: reopening a 5% project
    // and seeing an empty box reads as "not set".
    const pct = Number(project.retentionPercent ?? 0);
    setRetentionInput(pct > 0 ? String(pct) : '');
    setShowRetentionForm(true);
  };

  const saveRetention = () => {
    updateProject(project.id, { retentionPercent: parseRetentionPercent(retentionInput) });
    hapticSuccess();
    setShowRetentionForm(false);
  };

  // Already-invoiced terms keep the figure they recorded — `retentionHeld` reads
  // `invoice.retentionAmount` rather than re-deriving it, deliberately, because
  // what was withheld is a historical fact. So a change here only reaches terms
  // not yet invoiced, and the form says so instead of leaving it to be guessed.
  const hasInvoicedTerms = terms.some(tm => tm.status === 'invoiced' || tm.status === 'paid');

  const saveChangeOrder = () => {
    const amt = Number(coAmount.replace(',', '.'));
    if (!coTitle.trim() || !Number.isFinite(amt) || amt === 0) return;
    const next: ProjectChangeOrder = {
      id: `co-${Date.now()}`,
      title: coTitle.trim(),
      amount: amt,
      status: 'draft',
      createdAt: new Date().toISOString(),
      sortOrder: changeOrders.length + 1,
    };
    updateProject(project.id, { changeOrders: [...changeOrders, next] });
    hapticSuccess();
    setCoTitle('');
    setCoAmount('');
    setShowCoForm(false);
  };

  const patchOrder = (orderId: string, patch: Partial<ProjectChangeOrder>) => {
    updateProject(project.id, {
      changeOrders: changeOrders.map((c) => (c.id === orderId ? { ...c, ...patch } : c)),
    });
    hapticSuccess();
  };

  // Invoiced terms are historical facts: an issued invoice cannot be re-priced
  // by editing the term behind it, so editing and deleting stop at that point.
  const termLocked = (term: ProjectBillingTerm) =>
    term.status === 'invoiced' || term.status === 'paid';

  const persistTerms = (next: ProjectBillingTerm[]) => {
    // Renumber so sortOrder stays dense and unique after a move or a delete --
    // duplicates would make the billing order undefined, which the validator
    // rejects.
    updateProject(project.id, {
      billingTerms: next.map((t, i) => ({ ...t, sortOrder: i + 1 })),
    });
    hapticSuccess();
  };

  const moveTerm = (index: number, delta: number) => {
    const next = [...terms];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    persistTerms(next);
  };

  const deleteTerm = (term: ProjectBillingTerm) => {
    Alert.alert(t('projectBilling.confirmDeleteTerm', 'Delete this instalment?'), term.title, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('projectBilling.deleteTerm', 'Delete'),
        style: 'destructive',
        onPress: () => persistTerms(terms.filter((x) => x.id !== term.id)),
      },
    ]);
  };

  // The add and edit forms share `termTitle`/`termPercent`, so anything left
  // behind by a cancelled edit would pre-fill the next "Add instalment".
  const closeTermForm = () => {
    setShowTermForm(false);
    setEditingTerm(null);
    setTermTitle('');
    setTermPercent('');
  };

  const saveEditedTerm = () => {
    if (!editingTerm) return;
    const pct = Number(termPercent.replace(',', '.'));
    if (!termTitle.trim() || !Number.isFinite(pct) || pct <= 0) return;
    persistTerms(
      terms.map((x) => (x.id === editingTerm.id ? { ...x, title: termTitle.trim(), percent: pct } : x)),
    );
    closeTermForm();
  };

  const releaseRetention = async () => {
    const gate = canReleaseRetention(project, progress.retentionHeld);
    if (!gate.allowed) {
      Alert.alert(t('projectBilling.releaseBlocked', 'Not releasable yet'), gate.reason);
      return;
    }
    try {
      await addRetentionReleaseInvoice(project.id);
      hapticSuccess();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), String(err instanceof Error ? err.message : err));
    }
  };

  const invoiceTerm = async (term: ProjectBillingTerm) => {
    // Only the errors that actually bear on THIS term. A dangling milestone
    // trigger on a different instalment is not a reason to refuse this one --
    // it used to be, which stranded the contractor until they fixed an
    // unrelated row.
    const blocking = blockingErrorsForTerm(scheduleErrors, term.id);
    if (blocking.length > 0) {
      Alert.alert(t('projectBilling.scheduleInvalid', 'Instalment schedule is invalid'), blocking[0].message);
      return;
    }
    try {
      await addTermInvoice(project.id, term.id);
      hapticSuccess();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), String(err instanceof Error ? err.message : err));
    }
  };

  const invoiceChangeOrder = async (order: ProjectChangeOrder) => {
    const gate = canInvoiceChangeOrder(order);
    if (!gate.allowed) {
      Alert.alert(
        gate.needsWarning
          ? t('projectBilling.warningMissing', 'Customer not warned about the price increase')
          : t('common.error', 'Error'),
        gate.reason,
      );
      return;
    }
    try {
      await addChangeOrderInvoice(project.id, order.id);
      hapticSuccess();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), String(err instanceof Error ? err.message : err));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('projectBilling.title', 'Instalments & change orders')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Contract vs project value: kept as two figures because meerwerk
            does not re-base the terms, and blending them would hide that. */}
        <FadeIn>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('projectBilling.contractValue', 'Contract value')}</Text>
              <Text style={styles.summaryValue}>{money(progress.contractValue)}</Text>
            </View>
            {progress.changeOrders !== 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('projectBilling.projectValue', 'Project value')}</Text>
                <Text style={styles.summaryValue}>{money(progress.projectValue)}</Text>
              </View>
            )}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, progress.percentInvoiced)}%` }]} />
            </View>
            <Text style={styles.summaryMeta}>
              {t('projectBilling.invoicedOf', {
                invoiced: money(progress.invoiced),
                total: money(progress.contractValue),
              })}
            </Text>
            {/* Always shown, including at 0%: gating this on a non-zero rate
                would hide the only control that can make it non-zero — which
                is exactly how retention stayed dark for every project. */}
            <Pressable
              style={styles.retentionRow}
              onPress={openRetentionForm}
              accessibilityRole="button"
              accessibilityLabel={t('projectBilling.editRetention', 'Edit retention %')}
            >
              <Ionicons name="options-outline" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.retentionRateText}>
                {t('projectBilling.retentionRate', 'Retention')}: {Number(project.retentionPercent ?? 0)}%
              </Text>
              <Text style={styles.retentionEditText}>
                {t('projectBilling.change', 'Change')}
              </Text>
            </Pressable>
            {progress.retentionHeld > 0 && (
              <View style={styles.retentionRow}>
                <Ionicons name="lock-closed-outline" size={14} color={Palette.hermesOrange} />
                <Text style={styles.retentionText}>
                  {t('projectBilling.retentionHeld', 'Retention held')}: {money(progress.retentionHeld)}
                </Text>
                {/* Shown whether or not it is releasable: a contractor should be
                    able to see WHY it is still held, so the blocked tap explains
                    rather than the button simply being absent. */}
                <Pressable style={styles.releaseBtn} onPress={releaseRetention} hitSlop={8}>
                  <Text style={styles.releaseBtnText}>
                    {t('projectBilling.releaseRetention', 'Release retention')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </FadeIn>

        {/* ── Instalments ─────────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('projectBilling.terms', 'Instalments')}</Text>
          <Pressable onPress={() => setShowTermForm(true)} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={22} color={Palette.hermesOrange} />
          </Pressable>
        </View>

        {scheduleErrors.length > 0 && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color={SemanticColors.feedbackError} />
            <Text style={styles.errorText}>{scheduleErrors[0].message}</Text>
          </View>
        )}

        {terms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('projectBilling.noTerms', 'No instalments yet')}</Text>
            <Text style={styles.emptyHint}>
              {t('projectBilling.noTermsHint', 'Without instalments this project is billed as a single invoice.')}
            </Text>
          </View>
        ) : (
          terms.map((term, index) => {
            const full = termAmount(project, term);
            const withheld = retentionForTerm(project, term);
            const now = payableNow(project, term);
            const billable = term.status === 'pending' || term.status === 'ready';
            return (
              <View key={term.id} style={[styles.row, nextTerm?.id === term.id && styles.rowNext]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{term.title}</Text>
                  <Text style={styles.rowMeta}>
                    {term.basis === 'percent' ? `${term.percent}% · ` : ''}
                    {t(TERM_STATUS_KEY[term.status], term.status)}
                    {nextTerm?.id === term.id ? ` · ${t('projectBilling.nextUp', 'Next up')}` : ''}
                  </Text>
                  {withheld > 0 && (
                    // The invoice is issued for `full`; this is what the
                    // customer actually transfers now.
                    <Text style={styles.rowRetention}>
                      {t('projectBilling.payableNow', 'Payable now')} {money(now)} —{' '}
                      {t('projectBilling.withheld', { amount: money(withheld) })}
                    </Text>
                  )}
                  {!termLocked(term) && (
                    <View style={styles.termControls}>
                      <Pressable
                        style={styles.termControlBtn}
                        hitSlop={8}
                        onPress={() => {
                          setEditingTerm(term);
                          setTermTitle(term.title);
                          setTermPercent(String(term.percent ?? ''));
                        }}
                      >
                        <Ionicons name="create-outline" size={16} color={SemanticColors.textSecondary} />
                      </Pressable>
                      <Pressable style={styles.termControlBtn} hitSlop={8} onPress={() => moveTerm(index, -1)}>
                        <Ionicons
                          name="arrow-up"
                          size={16}
                          color={index === 0 ? SemanticColors.textTertiary : SemanticColors.textSecondary}
                        />
                      </Pressable>
                      <Pressable style={styles.termControlBtn} hitSlop={8} onPress={() => moveTerm(index, 1)}>
                        <Ionicons
                          name="arrow-down"
                          size={16}
                          color={index === terms.length - 1 ? SemanticColors.textTertiary : SemanticColors.textSecondary}
                        />
                      </Pressable>
                      <Pressable style={styles.termControlBtn} hitSlop={8} onPress={() => deleteTerm(term)}>
                        <Ionicons name="trash-outline" size={16} color={SemanticColors.feedbackError} />
                      </Pressable>
                    </View>
                  )}
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowAmount}>{money(full)}</Text>
                  {billable && (
                    <Pressable style={styles.rowBtn} onPress={() => invoiceTerm(term)}>
                      <Text style={styles.rowBtnText}>{t('projectBilling.invoiceTerm', 'Invoice')}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* ── Change orders ───────────────────────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: GRID.lg }]}>
          <Text style={styles.sectionTitle}>{t('projectBilling.changeOrders', 'Change orders')}</Text>
          <Pressable onPress={() => setShowCoForm(true)} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={22} color={Palette.hermesOrange} />
          </Pressable>
        </View>

        {changeOrderErrors.length > 0 && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color={SemanticColors.feedbackError} />
            <Text style={styles.errorText}>{changeOrderErrors[0].message}</Text>
          </View>
        )}

        {changeOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('projectBilling.noChangeOrders', 'No change orders yet')}</Text>
          </View>
        ) : (
          changeOrders.map((order) => {
            const gate = canInvoiceChangeOrder(order);
            const isReduction = order.amount < 0;
            return (
              <View key={order.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{order.title}</Text>
                  <Text style={styles.rowMeta}>
                    {t(CO_STATUS_KEY[order.status], order.status)}
                    {isReduction ? ` · ${t('projectBilling.reduction', 'Reduction')}` : ''}
                    {order.warnedAt
                      ? ` · ${t('projectBilling.warnedOn', { date: formatDateShortAuto(new Date(order.warnedAt)) })}`
                      : ''}
                  </Text>

                  {/* The art. 7:755 blocker, shown with its fix rather than as
                      a silently disabled button. */}
                  {gate.needsWarning && (
                    <View style={styles.warnBox}>
                      <Text style={styles.warnTitle}>
                        {t('projectBilling.warningMissing', 'Customer not warned about the price increase')}
                      </Text>
                      <Text style={styles.warnHint}>
                        {t('projectBilling.warningMissingHint', '')}
                      </Text>
                      <Pressable
                        style={styles.warnBtn}
                        onPress={() =>
                          patchOrder(order.id, { warnedAt: new Date().toISOString(), warnedVia: 'app' })
                        }
                      >
                        <Text style={styles.warnBtnText}>
                          {t('projectBilling.recordWarning', 'Record warning')}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {(order.status === 'draft' || order.status === 'proposed') && (
                    <Pressable
                      style={styles.linkBtn}
                      onPress={() =>
                        patchOrder(order.id, { status: 'approved', approvedAt: new Date().toISOString() })
                      }
                    >
                      <Text style={styles.linkBtnText}>
                        {t('projectBilling.markApproved', 'Customer approved')}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowAmount, isReduction && { color: SemanticColors.feedbackSuccess }]}>
                    {money(order.amount)}
                  </Text>
                  {gate.allowed && (
                    <Pressable style={styles.rowBtn} onPress={() => invoiceChangeOrder(order)}>
                      <Text style={styles.rowBtnText}>{t('projectBilling.invoiceTerm', 'Invoice')}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add instalment */}
      <Modal
        visible={showTermForm || editingTerm !== null}
        transparent
        animationType="slide"
        onRequestClose={closeTermForm}
      >
        {/* KeyboardAvoidingView, or the sheet is unusable on a real device.
            `modalOverlay` is `justifyContent: 'flex-end'`, so the card sits on
            the screen bottom and iOS does NOT lift a Modal above the keyboard:
            focusing any field here covered BOTH inputs and the Save button
            completely. Verified on the sim 2026-08-27 with the software
            keyboard on — the whole sheet was behind it. Invisible when the
            simulator's hardware keyboard is attached, which is why walking the
            screen never caught it. Same fix expenses.tsx and customer-crm.tsx
            already carry. */}
        <Pressable style={styles.modalOverlay} onPress={closeTermForm}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {editingTerm
                ? t('projectBilling.editTerm', 'Edit instalment')
                : t('projectBilling.addTerm', 'Add instalment')}
            </Text>
            <TextInput
              style={styles.input}
              value={termTitle}
              onChangeText={setTermTitle}
              placeholder={t('projectBilling.termTitlePlaceholder', 'E.g. Start of work')}
              placeholderTextColor={SemanticColors.textTertiary}
            />
            <TextInput
              style={styles.input}
              value={termPercent}
              onChangeText={setTermPercent}
              keyboardType="decimal-pad"
              placeholder={t('projectBilling.percentLabel', 'Percentage')}
              placeholderTextColor={SemanticColors.textTertiary}
            />
            <Pressable style={styles.saveBtn} onPress={editingTerm ? saveEditedTerm : saveTerm}>
              <Text style={styles.saveBtnText}>{t('projectBilling.save', 'Save')}</Text>
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Retention rate */}
      <Modal
        visible={showRetentionForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRetentionForm(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowRetentionForm(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {t('projectBilling.editRetention', 'Edit retention %')}
            </Text>
            <TextInput
              style={styles.input}
              value={retentionInput}
              onChangeText={setRetentionInput}
              keyboardType="decimal-pad"
              placeholder={t('projectBilling.retentionRate', 'Retention')}
              placeholderTextColor={SemanticColors.textTertiary}
              accessibilityLabel={t('projectBilling.editRetention', 'Edit retention %')}
            />
            {hasInvoicedTerms ? (
              <Text style={styles.retentionNote}>
                {t(
                  'projectBilling.retentionAppliesForward',
                  'Applies to instalments not yet invoiced. What was already withheld does not change.',
                )}
              </Text>
            ) : null}
            <Pressable style={styles.saveBtn} onPress={saveRetention}>
              <Text style={styles.saveBtnText}>{t('projectBilling.save', 'Save')}</Text>
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Add change order */}
      <Modal visible={showCoForm} transparent animationType="slide" onRequestClose={() => setShowCoForm(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCoForm(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('projectBilling.addChangeOrder', 'Add change order')}</Text>
            <TextInput
              style={styles.input}
              value={coTitle}
              onChangeText={setCoTitle}
              placeholder={t('projectBilling.termTitlePlaceholder', 'E.g. Extra sockets')}
              placeholderTextColor={SemanticColors.textTertiary}
            />
            <TextInput
              style={styles.input}
              value={coAmount}
              onChangeText={setCoAmount}
              keyboardType="numbers-and-punctuation"
              placeholder={t('projectBilling.amountLabel', 'Amount')}
              placeholderTextColor={SemanticColors.textTertiary}
            />
            <Pressable style={styles.saveBtn} onPress={saveChangeOrder}>
              <Text style={styles.saveBtnText}>{t('projectBilling.save', 'Save')}</Text>
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: SafeArea.top, paddingHorizontal: GRID.md, paddingBottom: GRID.sm,
  },
  headerTitle: { fontSize: TYPE.titleSize, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  content: { paddingHorizontal: GRID.md },

  summaryCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    padding: GRID.md, marginBottom: GRID.md,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: GRID.xs },
  summaryLabel: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary },
  summaryValue: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  summaryMeta: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, marginTop: GRID.xs },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: SemanticColors.borderDefault, marginTop: GRID.sm, overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Palette.hermesOrange },
  retentionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: GRID.sm },
  retentionText: { fontSize: TYPE.captionSize, color: Palette.hermesOrange, flex: 1 },
  // flex:1 so the rate keeps its space and the "Change" affordance cannot
  // starve it — the truncation shape this app keeps reintroducing.
  retentionRateText: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, flex: 1 },
  retentionEditText: { fontSize: TYPE.captionSize, fontFamily: TYPE.labelFamily, color: Palette.hermesOrange },
  retentionNote: { fontSize: TYPE.labelSize, color: SemanticColors.textTertiary },
  releaseBtn: {
    paddingHorizontal: GRID.sm, paddingVertical: 4, borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '18',
  },
  releaseBtnText: { fontSize: TYPE.labelSize, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
  termControls: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, marginTop: GRID.xs },
  termControlBtn: { padding: 2 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: GRID.sm, marginTop: GRID.sm,
  },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    padding: GRID.md, marginBottom: GRID.sm,
  },
  rowNext: { borderLeftWidth: 3, borderLeftColor: Palette.hermesOrange },
  rowTitle: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  rowMeta: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, marginTop: 2 },
  rowRetention: { fontSize: TYPE.captionSize, color: Palette.hermesOrange, marginTop: 4 },
  rowRight: { alignItems: 'flex-end', gap: GRID.xs },
  rowAmount: { fontSize: TYPE.bodySize, fontFamily: 'Inter_700Bold', color: SemanticColors.textPrimary },
  rowBtn: {
    paddingHorizontal: GRID.sm, paddingVertical: 6, borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '18',
  },
  rowBtnText: { fontSize: TYPE.captionSize, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },

  linkBtn: { marginTop: GRID.xs },
  linkBtnText: { fontSize: TYPE.captionSize, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },

  warnBox: {
    marginTop: GRID.sm, padding: GRID.sm, borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.feedbackError + '12',
    borderLeftWidth: 3, borderLeftColor: SemanticColors.feedbackError,
  },
  warnTitle: { fontSize: TYPE.captionSize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.feedbackError },
  warnHint: { fontSize: TYPE.labelSize, color: SemanticColors.textSecondary, marginTop: 4 },
  warnBtn: { marginTop: GRID.xs },
  warnBtnText: { fontSize: TYPE.captionSize, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },

  emptyCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    padding: GRID.md, marginBottom: GRID.sm,
  },
  emptyTitle: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  emptyHint: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, marginTop: 4 },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    backgroundColor: SemanticColors.feedbackError + '12', borderRadius: RADIUS.sm,
    padding: GRID.sm, marginBottom: GRID.sm,
  },
  errorText: { flex: 1, fontSize: TYPE.captionSize, color: SemanticColors.feedbackError },

  modalOverlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: GRID.lg, gap: GRID.sm, paddingBottom: GRID.xl,
  },
  modalTitle: { fontSize: TYPE.sectionSize, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  input: {
    backgroundColor: PAGE_BG, borderRadius: RADIUS.md, padding: GRID.md,
    fontSize: TYPE.bodySize, color: SemanticColors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md,
    paddingVertical: GRID.md, alignItems: 'center', marginTop: GRID.xs,
  },
  saveBtnText: { fontSize: TYPE.bodySize, fontFamily: 'Inter_700Bold', color: Palette.white },
});
