// =============================================================================
// PROJECT DETAIL — View/manage a multi-trade project
// =============================================================================

import { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../../src/theme/tabStyles';
import { SafeArea } from '../../../src/theme/spacing';
import { useAppState } from '../../../src/state/AppState';
import { useAuth } from '../../../src/context/AuthContext';
import { formatCurrency, formatCurrency0, type Country } from '../../../src/i18n/formatting';
import { makeEntityLabels } from '../../../src/i18n/entityLabels';
import { hapticSuccess } from '../../../src/utils/haptics';
import { FadeIn } from '../../../src/components/shared/FadeIn';
import type { ProjectStatus, ProjectMilestone } from '../../../src/types/project';
import { billingProgress } from '../../../src/services/progressBillingService';
import {
  sequenceByMilestoneId,
  defaultDependsOn,
  candidatePredecessors,
  removeMilestoneFromChain,
} from '../../../src/services/projectSequenceService';
import {
  PROJECT_TEMPLATES,
  buildMilestonesFromTemplate,
  type ProjectTemplate,
} from '../../../src/services/projectTemplateService';

type IconName = keyof typeof Ionicons.glyphMap;

const STATUS_KEYS: { key: ProjectStatus; i18nKey: string; icon: IconName }[] = [
  { key: 'planning', i18nKey: 'project.statusPlanning', icon: 'document-text-outline' },
  { key: 'active', i18nKey: 'project.statusActive', icon: 'hammer-outline' },
  { key: 'on_hold', i18nKey: 'project.statusOnHold', icon: 'pause-circle-outline' },
  { key: 'completed', i18nKey: 'project.statusCompleted', icon: 'checkmark-circle-outline' },
];

export default function ProjectDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects, updateProject, jobs, invoices, customers, getProjectPnL, addJobToProject } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  // The job rows printed the raw JobStatus enum ('completed', 'in-progress')
  // and a hardcoded € formatted in the DEVICE locale, on an aannemer P&L
  // screen. Same class as the R322 werk/customer-detail fixes.
  const { jobStatusLabel, tradeLabel } = makeEntityLabels(t);
  const [refreshing, setRefreshing] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<
    { mode: 'new' } | { mode: 'edit'; milestone: ProjectMilestone } | null
  >(null);

  const project = useMemo(() => projects.find(p => p.id === id), [projects, id]);
  const pnl = useMemo(() => project ? getProjectPnL(project.id) : null, [project]);
  const billing = useMemo(
    () => (project ? billingProgress(project, invoices) : null),
    [project, invoices],
  );
  const projectJobs = useMemo(() => project ? jobs.filter(j => project.jobIds.includes(j.id)) : [], [project, jobs]);
  const unassignedJobs = useMemo(() => jobs.filter(j => !projects.some(p => p.jobIds.includes(j.id))), [jobs, projects]);
  const customer = useMemo(() => project ? customers.find(c => c.id === project.customerId) : null, [project, customers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  // All three writes go through updateProject({ milestones }), which already
  // persists to BE, queues offline, and cascades milestone completion into
  // billing-term readiness. No new mutator needed.
  const writeMilestones = (next: ProjectMilestone[]) => {
    if (!project) return;
    updateProject(project.id, { milestones: next });
  };

  const toggleMilestone = (milestoneId: string) => {
    if (!project) return;
    hapticSuccess();
    writeMilestones(
      project.milestones.map(m => (m.id === milestoneId ? { ...m, completed: !m.completed } : m)),
    );
  };

  const saveMilestone = (draft: ProjectMilestone) => {
    if (!project) return;
    const exists = project.milestones.some(m => m.id === draft.id);
    writeMilestones(
      exists
        ? project.milestones.map(m => (m.id === draft.id ? draft : m))
        : [...project.milestones, draft],
    );
    setEditingMilestone(null);
  };

  // Every project that existed before templates has `milestones: []`, and the
  // create screen's picker only reaches NEW ones. Without this, the entire
  // installed base could only be planned one milestone at a time by hand.
  //
  // Offered as inline rows, NOT an Alert: RN's Android Alert keeps only the
  // first three buttons ("At most three buttons (neutral, negative, positive).
  // Ignore rest." — Alert.js), so four templates plus a cancel would have
  // silently dropped the whole-home sequence AND the cancel on Android, and
  // reordered the survivors into button slots.
  const applyTemplate = (tpl: ProjectTemplate) => {
    if (!project) return;
    hapticSuccess();
    writeMilestones(
      buildMilestonesFromTemplate({ template: tpl, translate: (k, f) => t(k, f) }),
    );
  };

  // What is blocked, by what, and has the end date moved. Derived on every
  // render from `dependsOn` — never written back into `weekNumber`, which has
  // to survive as the plan for a slip to be visible against at all.
  const sequence = useMemo(
    () => (project ? sequenceByMilestoneId({ project }) : new Map()),
    [project],
  );

  const deleteMilestone = (milestoneId: string) => {
    if (!project) return;
    // A billing term may be triggered by this milestone. Deleting it would
    // leave that term waiting on something that no longer exists, so say so
    // rather than silently stranding the money.
    const linkedTerm = (project.billingTerms ?? []).find(term => term.milestoneId === milestoneId);
    // Successors pointing at it lose their handover. The sequence service
    // already ignores unknown ids, so nothing breaks — but say which trades
    // stop waiting, because that is a change to the plan the aannemer staffs.
    const successors = project.milestones.filter(m => (m.dependsOn ?? []).includes(milestoneId));
    const warnings = [
      linkedTerm
        ? t('project.deleteMilestoneLinked', {
            defaultValue: 'The billing term "{{term}}" is triggered by this milestone and will no longer have a trigger.',
            term: linkedTerm.title,
          })
        : null,
      successors.length
        ? t('project.deleteMilestoneSuccessors', {
            defaultValue: '{{titles}} will no longer wait for it.',
            titles: successors.map(m => m.title).join(', '),
            count: successors.length,
          })
        : null,
    ].filter(Boolean) as string[];
    Alert.alert(
      t('project.deleteMilestoneConfirm', 'Delete this milestone?'),
      warnings.length ? warnings.join('\n\n') : undefined,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: () => {
            // Drops the id from every other milestone's `dependsOn` too — a
            // re-created id must not silently reconnect a broken chain.
            writeMilestones(removeMilestoneFromChain(project.milestones, milestoneId));
            setEditingMilestone(null);
          },
        },
      ],
    );
  };

  const handleStatusChange = () => {
    if (!project) return;
    Alert.alert(t('project.changeStatus'), undefined,
      STATUS_KEYS.map(opt => ({
        text: t(opt.i18nKey),
        onPress: () => { hapticSuccess(); updateProject(project.id, { status: opt.key }); },
      }))
    );
  };

  const handleAssignJob = () => {
    if (!project || unassignedJobs.length === 0) {
      Alert.alert(t('project.noJobs'), t('project.allJobsAssigned'));
      return;
    }
    Alert.alert(t('project.addJob'), t('project.selectJob'),
      unassignedJobs.slice(0, 5).map(j => ({
        text: j.title,
        onPress: () => { hapticSuccess(); addJobToProject(project.id, j.id); },
      }))
    );
  };

  if (!project) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('project.notFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{project.title}</Text>
          <Text style={styles.headerSub}>{customer?.name ?? t('project.noCustomer')}</Text>
        </View>
        <Pressable onPress={handleStatusChange} style={styles.statusBtn}>
          <Text style={styles.statusBtnText}>
            {t(STATUS_KEYS.find(o => o.key === project.status)?.i18nKey ?? '') || project.status}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* P&L Card */}
        {pnl && (
          <FadeIn delay={0}>
            <View style={styles.pnlCard}>
              <Text style={styles.sectionTitle}>{t('project.financialOverview')}</Text>
              <View style={styles.pnlRow}>
                <View style={styles.pnlItem}>
                  <Text style={styles.pnlValue}>{formatCurrency0(project.totalBudget, country)}</Text>
                  <Text style={styles.pnlLabel}>{t('project.budget')}</Text>
                </View>
                <View style={styles.pnlDivider} />
                <View style={styles.pnlItem}>
                  <Text style={styles.pnlValue}>{formatCurrency0(pnl.revenue, country)}</Text>
                  <Text style={styles.pnlLabel}>{t('project.revenue')}</Text>
                </View>
                <View style={styles.pnlDivider} />
                <View style={styles.pnlItem}>
                  <Text style={[styles.pnlValue, { color: pnl.grossProfit >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
                    {formatCurrency0(pnl.grossProfit, country)}
                  </Text>
                  <Text style={styles.pnlLabel}>{t('project.profit')}</Text>
                </View>
              </View>
              <View style={styles.pnlRow}>
                <View style={styles.pnlItem}>
                  <Text style={styles.pnlValue}>{formatCurrency0(pnl.materialCosts, country)}</Text>
                  <Text style={styles.pnlLabel}>{t('project.material')}</Text>
                </View>
                <View style={styles.pnlDivider} />
                <View style={styles.pnlItem}>
                  <Text style={styles.pnlValue}>{formatCurrency0(pnl.laborCosts, country)}</Text>
                  <Text style={styles.pnlLabel}>{t('project.labor')}</Text>
                </View>
                <View style={styles.pnlDivider} />
                <View style={styles.pnlItem}>
                  {/* Margin is grossProfit/revenue, and getProjectPnL returns 0
                      when revenue is 0 — so this printed a flat orange "0%"
                      beside "Winst € -201", which reads as break-even on a
                      project that is €201 down. With nothing invoiced there is
                      no margin to report, so show a dash. The projects LIST
                      already guards exactly this way; the detail did not. */}
                  <Text style={[styles.pnlValue, {
                    color: pnl.revenue <= 0
                      ? SemanticColors.textSecondary
                      : pnl.grossMargin > 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError,
                  }]}>
                    {pnl.revenue > 0 ? `${pnl.grossMargin}%` : '—'}
                  </Text>
                  <Text style={styles.pnlLabel}>{t('project.margin')}</Text>
                </View>
              </View>
            </View>
          </FadeIn>
        )}

        {/* Jobs section */}
        <FadeIn delay={100}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('project.jobsCount', { count: projectJobs.length })}</Text>
              <Pressable onPress={handleAssignJob} hitSlop={8}>
                <Ionicons name="add-circle" size={24} color={Palette.hermesOrange} />
              </Pressable>
            </View>

            {projectJobs.length === 0 ? (
              <Text style={styles.emptyText}>{t('project.noJobsAdded')}</Text>
            ) : (
              projectJobs.map(job => (
                <Pressable
                  key={job.id}
                  style={styles.jobCard}
                  onPress={() => router.push(`/quotes/${job.id}` as any)}
                >
                  <View style={[styles.jobAccent, { backgroundColor: Palette.hermesOrange }]} />
                  <View style={{ flex: 1, padding: 12 }}>
                    <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                    <Text style={styles.jobMeta}>{jobStatusLabel(job.status)} · {formatCurrency(job.quotedAmount ?? 0, country)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} style={{ marginRight: 12 }} />
                </Pressable>
              ))
            )}
          </View>
        </FadeIn>

        {/* R246: Site-lead actions for aannemer running this project. */}
        {/* Billing. Top-level on the project rather than inside the financial
            card: for an aannemer, raising the next termijn is the reason they
            open a project, not a sub-detail of a P&L readout. */}
        {billing && (
        <FadeIn delay={120}>
          <Pressable
            style={styles.billingCta}
            onPress={() => router.push(`/contractor/project-billing/${project.id}` as any)}
          >
            <Ionicons name="cash-outline" size={20} color={Palette.hermesOrange} />
            <View style={{ flex: 1 }}>
              <Text style={styles.billingCtaTitle}>
                {t('projectBilling.title', 'Instalments & change orders')}
              </Text>
              <Text style={styles.billingCtaSub}>
                {t('projectBilling.invoicedOf', {
                  // Derived, not `project.totalInvoiced`: nothing maintains that
                  // column, so it reads 0 however many instalments have been
                  // billed. Same computation the billing screen uses, so the two
                  // screens cannot disagree.
                  invoiced: formatCurrency0(billing.invoiced, country),
                  total: formatCurrency0(billing.contractValue, country),
                })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textSecondary} />
          </Pressable>
        </FadeIn>
        )}

        {/* Wires the existing site-lead drill-downs into the contractor view. */}
        <FadeIn delay={150}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('project.siteOps', 'Site operations')}</Text>
            <View style={styles.siteOpsGrid}>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/dispatch?projectId=${project.id}` as any)}>
                <Ionicons name="people" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.dispatch', 'Dispatch')}</Text>
              </Pressable>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/daily-report?projectId=${project.id}` as any)}>
                <Ionicons name="document-text" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.dailyReport', 'Daily report')}</Text>
              </Pressable>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/log-defect?projectId=${project.id}` as any)}>
                <Ionicons name="alert-circle" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.defects', 'Defects')}</Text>
              </Pressable>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/inspection?projectId=${project.id}` as any)}>
                <Ionicons name="checkmark-done" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.inspection', 'Inspection')}</Text>
              </Pressable>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/incident-report?projectId=${project.id}` as any)}>
                <Ionicons name="warning" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.incident', 'Incident')}</Text>
              </Pressable>
              <Pressable style={styles.siteOpsTile} onPress={() => router.push(`/sitelead/safety-docs?projectId=${project.id}` as any)}>
                <Ionicons name="shield-checkmark" size={20} color={Palette.hermesOrange} />
                <Text style={styles.siteOpsLabel}>{t('siteOps.safety', 'Safety')}</Text>
              </Pressable>
            </View>
          </View>
        </FadeIn>

        {/* Milestones placeholder */}
        <FadeIn delay={200}>
          {/* The milestone list was READ-ONLY and every project is created with
              `milestones: []` — nothing in the app could add one, so the trade/
              week plan was empty for every project that has ever existed and
              the week-view staffing strip (7ad78bc) could never fire. Ticking
              one also flips any billing term that names it to `ready`, which
              updateProject already handles. */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('project.milestones')}</Text>
              <Pressable
                onPress={() => setEditingMilestone({ mode: 'new' })}
                style={styles.addMilestoneBtn}
                accessibilityRole="button"
                accessibilityLabel={t('project.addMilestone', 'Add milestone')}
              >
                <Ionicons name="add" size={20} color={Palette.hermesOrange} />
              </Pressable>
            </View>
            {project.milestones.length === 0 ? (
              <>
                <Text style={styles.emptyText}>{t('project.noMilestones')}</Text>
                {/* Template first: a whole sequence in one tap beats seven
                    trips through the editor, and the order is already known.
                    The step count is shown up front because tapping writes
                    7–11 milestones at once. */}
                <Text style={styles.templateLabel}>
                  {t('projectTemplate.pick', 'Start from a trade sequence')}
                </Text>
                {PROJECT_TEMPLATES.map(tpl => (
                  <Pressable
                    key={tpl.id}
                    style={styles.templateRow}
                    onPress={() => applyTemplate(tpl)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="layers-outline" size={18} color={Palette.hermesOrange} />
                    <View style={styles.templateRowMain}>
                      <Text style={styles.milestoneCtaText}>
                        {t(`projectTemplate.name.${tpl.nameKey}`, tpl.nameKey)}
                      </Text>
                      <Text style={styles.templateRowCount}>
                        {t('projectTemplate.stepCount', {
                          defaultValue: '{{count}} milestones, editable afterwards',
                          count: tpl.steps.length,
                        })}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                <Pressable style={styles.milestoneCta} onPress={() => setEditingMilestone({ mode: 'new' })}>
                  <Ionicons name="flag-outline" size={18} color={Palette.hermesOrange} />
                  <Text style={styles.milestoneCtaText}>{t('project.planTrades', 'Plan the trade sequence')}</Text>
                </Pressable>
              </>
            ) : (
              [...project.milestones]
                .sort((a, b) => a.weekNumber - b.weekNumber)
                .map(m => {
                  const seq = sequence.get(m.id);
                  const waiting = seq?.blockedBy?.[0];
                  return (
                  <View key={m.id} style={styles.milestoneRow}>
                    {/* Tapping the tick is the whole point of the list — it is
                        what marks a trade handed over. */}
                    <Pressable
                      onPress={() => toggleMilestone(m.id)}
                      hitSlop={8}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: m.completed }}
                      accessibilityLabel={m.title}
                    >
                      <Ionicons
                        name={m.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={m.completed ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
                      />
                    </Pressable>
                    <Pressable style={styles.milestoneMain} onPress={() => setEditingMilestone({ mode: 'edit', milestone: m })}>
                      <Text style={[styles.milestoneText, m.completed && styles.milestoneComplete]}>{m.title}</Text>
                      {m.trade ? <Text style={styles.milestoneTrade}>{tradeLabel(m.trade)}</Text> : null}
                      {/* "Cannot start yet" is a different claim from "nobody
                          booked", and it is the one that changes what the
                          aannemer should do about it. */}
                      {waiting ? (
                        <Text style={styles.milestoneBlocked} numberOfLines={1}>
                          {t('sequence.waitingOn', { defaultValue: 'Waiting on {{milestone}}', milestone: waiting.title })}
                        </Text>
                      ) : null}
                    </Pressable>
                    <View style={styles.milestoneWeekCol}>
                      <Text style={[styles.milestoneWeek, seq?.slipWeeks ? styles.milestoneWeekPlanned : null]}>
                        {t('project.week')} {m.weekNumber}
                      </Text>
                      {seq?.slipWeeks ? (
                        <Text style={styles.milestoneProjected}>
                          {t('sequence.projectedWeek', { defaultValue: 'now wk {{week}}', week: seq.projectedWeek })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  );
                })
            )}
          </View>
        </FadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <MilestoneModal
        state={editingMilestone}
        allMilestones={project.milestones}
        onClose={() => setEditingMilestone(null)}
        onSave={saveMilestone}
        onDelete={deleteMilestone}
      />
    </View>
  );
}

// =============================================================================
// MILESTONE EDITOR
// =============================================================================

const MILESTONE_TRADES = [
  'demolition', 'plumbing', 'electrical', 'gas', 'carpentry', 'tiling',
  'plastering', 'flooring', 'painting', 'roofing', 'insulation', 'glazing',
] as const;

interface MilestoneModalProps {
  state: { mode: 'new' } | { mode: 'edit'; milestone: ProjectMilestone } | null;
  allMilestones: ProjectMilestone[];
  onClose: () => void;
  onSave: (m: ProjectMilestone) => void;
  onDelete: (id: string) => void;
}

function MilestoneModal({ state, allMilestones, onClose, onSave, onDelete }: MilestoneModalProps) {
  const { t } = useTranslation();
  const { tradeLabel } = makeEntityLabels(t);
  const existing = state?.mode === 'edit' ? state.milestone : undefined;

  const [title, setTitle] = useState('');
  const [trade, setTrade] = useState<string | undefined>(undefined);
  const [week, setWeek] = useState(1);
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  // Once the aannemer picks the handover themselves, stop re-guessing it from
  // the week. Overwriting a deliberate choice on the next +/- tap would be the
  // form arguing with the user.
  const depsTouched = useRef(false);

  // Re-seed the form each time the modal opens for a different milestone.
  // `key` on the Modal would remount instead, but that loses the slide
  // animation; this keeps the fields in step with what was tapped.
  const openedFor = state?.mode === 'edit' ? state.milestone.id : state?.mode ?? null;
  const seededRef = useRef<string | null>(null);
  if (state && seededRef.current !== openedFor) {
    seededRef.current = openedFor;
    const seedWeek = existing?.weekNumber ?? Math.max(1, allMilestones.length + 1);
    setTitle(existing?.title ?? '');
    setTrade(existing?.trade);
    setWeek(seedWeek);
    depsTouched.current = !!existing;
    // A renovation is a chain far more often than a graph, so a new milestone
    // defaults to waiting on the last one planned before it. The aannemer then
    // only edits the exceptions instead of drawing the whole sequence.
    setDependsOn(existing?.dependsOn ?? defaultDependsOn(allMilestones, seedWeek));
  }
  if (!state && seededRef.current !== null) seededRef.current = null;

  const setWeekAndMaybeRelink = (next: number) => {
    const w = Math.max(1, next);
    setWeek(w);
    if (!depsTouched.current) setDependsOn(defaultDependsOn(allMilestones, w, existing?.id));
  };

  // A milestone already behind this one cannot also come before it — the rule
  // and its tests live in the service, because it is easy to state and easy to
  // get backwards, and a screen test cannot see which way round it is.
  const candidates = candidatePredecessors(allMilestones, existing?.id);

  const canSave = title.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSave({
      id: existing?.id ?? `ms-${Date.now()}`,
      title: title.trim(),
      trade,
      weekNumber: Math.max(1, Math.round(week)),
      completed: existing?.completed ?? false,
      jobIds: existing?.jobIds ?? [],
      dependsOn,
    });
  };

  return (
    <Modal visible={state !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHead}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.modalCancel}>{t('common.cancel', 'Cancel')}</Text>
          </Pressable>
          <Text style={styles.modalTitle}>
            {existing ? t('project.editMilestone', 'Edit milestone') : t('project.addMilestone', 'Add milestone')}
          </Text>
          <Pressable onPress={submit} disabled={!canSave} hitSlop={8}>
            <Text style={[styles.modalSave, !canSave && styles.modalSaveOff]}>{t('common.save', 'Save')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: GRID.lg }} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>{t('project.milestoneTitle', 'What happens')}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('project.milestoneTitlePlaceholder', 'e.g. Rough-in complete')}
            placeholderTextColor={SemanticColors.textTertiary}
            style={styles.input}
            autoFocus={!existing}
          />

          <Text style={styles.fieldLabel}>{t('project.milestoneWeek', 'Week of the project')}</Text>
          <View style={styles.weekRow}>
            <Pressable
              onPress={() => setWeekAndMaybeRelink(week - 1)}
              style={styles.weekBtn}
              accessibilityRole="button"
              accessibilityLabel={t('project.weekEarlier', 'One week earlier')}
            >
              <Ionicons name="remove" size={20} color={SemanticColors.textPrimary} />
            </Pressable>
            <Text style={styles.weekValue}>{t('project.week')} {week}</Text>
            <Pressable
              onPress={() => setWeekAndMaybeRelink(week + 1)}
              style={styles.weekBtn}
              accessibilityRole="button"
              accessibilityLabel={t('project.weekLater', 'One week later')}
            >
              <Ionicons name="add" size={20} color={SemanticColors.textPrimary} />
            </Pressable>
          </View>

          {/* Trade is what the week view checks staffing against — a milestone
              with no trade is deliberately never reported as a staffing gap,
              so leaving it blank is a real choice, not an unfinished form. */}
          <Text style={styles.fieldLabel}>{t('project.milestoneTrade', 'Which trade')}</Text>
          <View style={styles.tradeWrap}>
            {MILESTONE_TRADES.map(slug => (
              <Pressable
                key={slug}
                onPress={() => setTrade(trade === slug ? undefined : slug)}
                style={[styles.tradeChip, trade === slug && styles.tradeChipOn]}
              >
                <Text style={[styles.tradeChipText, trade === slug && styles.tradeChipTextOn]}>
                  {tradeLabel(slug)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldHint}>{t('project.milestoneTradeHint', 'Used to warn you when the week arrives with nobody of that trade booked.')}</Text>

          {/* The handover. `weekNumber` alone cannot say this: it is an
              absolute offset, so when the plumber runs over, the tiler's
              milestone still claims its original week. */}
          {candidates.length > 0 ? (
            <>
              <Text style={styles.fieldLabel}>{t('sequence.waitsFor', 'Waits for')}</Text>
              <View style={styles.depList}>
                {candidates.map(c => {
                  const on = dependsOn.includes(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        depsTouched.current = true;
                        setDependsOn(prev => (on ? prev.filter(x => x !== c.id) : [...prev, c.id]));
                      }}
                      style={[styles.depRow, on && styles.depRowOn]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={c.title}
                    >
                      <Ionicons
                        name={on ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={on ? Palette.hermesOrange : SemanticColors.textTertiary}
                      />
                      <Text style={[styles.depTitle, on && styles.depTitleOn]} numberOfLines={1}>{c.title}</Text>
                      <Text style={styles.depWeek}>{t('project.week')} {c.weekNumber}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.fieldHint}>{t('sequence.waitsForHint', 'When these run late, this milestone is reported as blocked instead of just unstaffed.')}</Text>
            </>
          ) : null}

          {existing ? (
            <Pressable style={styles.deleteBtn} onPress={() => onDelete(existing.id)}>
              <Ionicons name="trash-outline" size={18} color={SemanticColors.feedbackError} />
              <Text style={styles.deleteBtnText}>{t('project.deleteMilestone', 'Delete milestone')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  billingCta: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    padding: GRID.md, marginBottom: GRID.md,
  },
  billingCtaTitle: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  billingCtaSub: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, marginTop: 2 },
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12,
  },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSub: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  statusBtn: { backgroundColor: Palette.hermesOrange + '15', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6 },
  statusBtnText: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: Palette.hermesOrange },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: GRID.md },
  sectionTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, letterSpacing: TYPE.sectionTracking },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: GRID.sm },
  emptyText: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textTertiary },
  pnlCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 16, gap: 12 },
  pnlRow: { flexDirection: 'row', alignItems: 'center' },
  pnlItem: { flex: 1, alignItems: 'center' },
  pnlValue: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  pnlLabel: { fontSize: TYPE.tinySize, fontFamily: TYPE.tinyFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  pnlDivider: { width: 1, height: 28, backgroundColor: SemanticColors.borderDefault },
  jobCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  jobAccent: { width: 4, alignSelf: 'stretch' },
  jobTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  jobMeta: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addMilestoneBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.hermesOrange + '1A',
  },
  milestoneCta: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm, marginTop: GRID.sm,
    paddingVertical: 10, paddingHorizontal: GRID.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: Palette.hermesOrange + '44',
  },
  milestoneCtaText: { fontSize: TYPE.bodySize, fontFamily: TYPE.labelFamily, color: Palette.hermesOrange },
  templateLabel: {
    fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary, marginTop: GRID.sm,
  },
  templateRow: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    paddingVertical: 10, paddingHorizontal: GRID.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: Palette.hermesOrange + '44',
  },
  // flex:1 so a long sequence name wraps instead of starving — the truncation
  // pattern this app keeps reintroducing.
  templateRowMain: { flex: 1 },
  templateRowCount: {
    fontSize: TYPE.labelSize, fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary, marginTop: 1,
  },
  milestoneMain: { flex: 1 },
  milestoneTrade: { fontSize: TYPE.labelSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary, marginTop: 1 },
  milestoneBlocked: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.feedbackWarning, marginTop: 2 },
  milestoneWeekCol: { alignItems: 'flex-end' },
  // The plan stays legible next to the forecast — a slip is only visible as the
  // distance between the two, so neither may replace the other.
  milestoneWeekPlanned: { textDecorationLine: 'line-through', color: SemanticColors.textTertiary },
  milestoneProjected: { fontSize: TYPE.tinySize, fontFamily: TYPE.labelFamily, color: SemanticColors.feedbackWarning, marginTop: 1 },
  depList: { gap: GRID.xs },
  depRow: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.sm,
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    borderWidth: 1, borderColor: 'transparent',
  },
  depRowOn: { borderColor: Palette.hermesOrange },
  depTitle: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  depTitleOn: { color: SemanticColors.textPrimary },
  depWeek: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textTertiary },
  modalRoot: { flex: 1, backgroundColor: PAGE_BG },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GRID.lg, paddingVertical: GRID.md,
    borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault,
  },
  modalTitle: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  modalCancel: { fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  modalSave: { fontSize: TYPE.bodySize, fontFamily: TYPE.labelFamily, color: Palette.hermesOrange },
  modalSaveOff: { color: SemanticColors.textTertiary },
  fieldLabel: {
    fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: GRID.xs, marginTop: GRID.md,
  },
  fieldHint: { fontSize: TYPE.labelSize, color: SemanticColors.textTertiary, marginTop: GRID.xs, lineHeight: 16 },
  input: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
    paddingHorizontal: GRID.md, paddingVertical: 12,
    fontSize: TYPE.bodySize, color: SemanticColors.textPrimary,
  },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.md },
  weekBtn: {
    width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: SemanticColors.surfacePrimary, borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  weekValue: { flex: 1, textAlign: 'center', fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  tradeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID.xs },
  tradeChip: {
    paddingHorizontal: GRID.md, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.surfacePrimary, borderWidth: 1, borderColor: SemanticColors.borderDefault,
  },
  tradeChipOn: { backgroundColor: Palette.hermesOrange, borderColor: Palette.hermesOrange },
  tradeChipText: { fontSize: TYPE.labelSize, color: SemanticColors.textSecondary },
  tradeChipTextOn: { color: '#fff', fontFamily: TYPE.labelFamily },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GRID.sm,
    marginTop: GRID.xl, paddingVertical: 12, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: SemanticColors.feedbackError + '55',
  },
  deleteBtnText: { fontSize: TYPE.bodySize, fontFamily: TYPE.labelFamily, color: SemanticColors.feedbackError },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  milestoneText: { flex: 1, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textPrimary },
  milestoneComplete: { textDecorationLine: 'line-through', color: SemanticColors.textTertiary },
  milestoneWeek: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textSecondary },
  siteOpsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID.sm },
  siteOpsTile: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  siteOpsLabel: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textPrimary, textAlign: 'center' },
});
