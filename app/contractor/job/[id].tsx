// =============================================================================
// JOB DETAIL — Full Job View for Contractors
// =============================================================================
// Pro-grade job detail with orange accents, shadow cards, route planner,
// client contact, notes, material predictions, and upsell opportunities
// =============================================================================

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Linking,
  RefreshControl,
  LayoutAnimation,
  KeyboardAvoidingView,
  Platform,
  Share,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Palette, SemanticColors } from '../../../src/theme/colors';
import { SafeArea } from '../../../src/theme/spacing';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../../src/theme/tabStyles';
import { hapticSuccess } from '../../../src/utils/haptics';
import { useClockIn } from '../../../src/services/clockInService';
import { smartSchedulerService, LIFECYCLE_ORDER, LIFECYCLE_COLORS, LIFECYCLE_TO_DOMAIN_STATUS, lifecycleLabel, lifecycleNextAction, useJobLifecyclePipeline, toLifecycleStatus } from '../../../src/services/smartSchedulerService';
import type { JobLifecycleStatus } from '../../../src/services/smartSchedulerService';
import { useJobCostVariance } from '../../../src/services/jobCostTrackingService';
import { getCohortCostVariance, type CohortCostVariance } from '../../../src/services/costVarianceMoatService';
import { usePostcodeCohort } from '../../../src/services/cohortBenchmarkService';
import { useAppState } from '../../../src/state/AppState';
import { openDirections, formatDestination } from '../../../src/utils/directions';
import { PhotoGallery, type PhotoItem } from '../../../src/components/contractor/PhotoGallery';
import { showPhotoPicker } from '../../../src/utils/photoPicker';
import JobComments from '../../../src/components/contractor/JobComments';
import { addActivityEntry } from '../../../src/services/jobCommentsService';
import { evaluateCompletion } from '../../../src/services/jobCompletionChecklist';
import { listJobPhotos } from '../../../src/services/jobPhotoService';
import { SignaturePad } from '../../../src/components/shared/SignaturePad';
import { DKMenu } from '../../../src/components/shared/DKMenu';
import { DK } from '../../../src/theme/draftkings';
import { useAuth } from '../../../src/context/AuthContext';
import { tradeMismatch } from '../../../src/services/crewAssignment';
import { makeEntityLabels } from '../../../src/i18n/entityLabels';
import { formatCurrency, formatCurrency0, formatTime } from '../../../src/i18n/formatting';
import type { Country } from '../../../src/i18n/formatting';
import { wasShareDismissed } from '../../../src/utils/shareOutcome';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// R41: enrichment types — UpsellItem / MaterialPrediction below are kept
// as type definitions for the day a real upsell engine ships. Today
// EMPTY_UPSELLS = []  (no fake "Add scaffolding rental for €120" rows
// shown to every contractor).
// ============================================

interface ClientContact {
  name: string;
  phone: string;
  email: string;
  avatar?: string;
}

interface UpsellItem {
  id: string;
  title: string;
  description: string;
  potentialRevenue: number;
  confidence: number;
  icon: IconName;
}

interface MaterialPrediction {
  id: string;
  name: string;
  quantity: string;
  inStock: boolean;
  reorderNeeded: boolean;
  estimatedCost: number;
  supplier: string;
}

// Contacts now sourced from AppState customers

// Upsells: empty until ontology service provides real suggestions
const EMPTY_UPSELLS: UpsellItem[] = [];

// Materials now sourced from AppState jobMaterials

// ============================================
// MAIN SCREEN
// ============================================

export default function JobDetailPage() {
  const { t } = useTranslation();
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  const router = useRouter();
  const [notes, setNotes] = useState('');
  /** Site contact being edited; null = picker closed. */
  const [editingSite, setEditingSite] = useState<{ contact: string; phone: string } | null>(null);
  const timer = useClockIn();
  const clockedIn = timer.active && timer.jobId === id;
  // R304: when reached via R286 executor's draft_invoice route with
  // ?action=create-invoice, auto-trigger the invoice creation flow on mount.
  const autoTriggeredInvoiceRef = useRef(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [jobPhotos, setJobPhotos] = useState<PhotoItem[]>([]);

  // Load real photo count from jobPhotoService on mount + every time we come back from /photos.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!id) return;
        const photos = await listJobPhotos(String(id));
        if (!cancelled) setPhotoCount(photos.length);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [id]);
  const [jobCompleted, setJobCompleted] = useState(false);
  const [orderedMaterials, setOrderedMaterials] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      hapticSuccess();
    }, 800);
  }, []);

  const { addInvoiceFromJob, jobs, invoices, quotes, customers, jobMaterials: jobMaterialsMap, materials: materialCatalog, suppliers, businessProfile, updateJob, updateJobStatus, removeJob, workers } = useAppState();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  // Shared enum→label map: trade is stored as a slug on some rows and as a
  // display name on others, so the assignment guard must normalise before
  // comparing, or it fires on correct assignments.
  const { tradeLabel } = useMemo(() => makeEntityLabels(t), [t]);
  const [signatureModal, setSignatureModal] = useState<{ visible: boolean; onSigned?: () => void }>({ visible: false });

  // R66r57: fetch signature audit-trail rows. Refreshes whenever a new
  // signature is captured (signatureModal closes after save).
  const [signatureRows, setSignatureRows] = useState<Array<{
    id: string;
    signer_name: string;
    signer_role: string;
    signed_at: string;
  }>>([]);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    import('../../../src/services/signatureService').then(({ listSignaturesForJob }) =>
      listSignaturesForJob(id).then((rows) => {
        if (!cancelled) setSignatureRows(rows);
      }).catch(() => {}),
    ).catch(() => {});
    return () => { cancelled = true; };
  }, [id, signatureModal.visible]);

  // R304: auto-trigger invoice creation when reached via R286 executor with
  // ?action=create-invoice (draft_invoice queue items). One-shot guarded by
  // ref so the effect doesn't loop on re-renders.
  useEffect(() => {
    if (action !== 'create-invoice' || !id || autoTriggeredInvoiceRef.current) return;
    autoTriggeredInvoiceRef.current = true;
    (async () => {
      try {
        await addInvoiceFromJob(id);
        router.replace('/(contractor)/facturen' as any);
      } catch (err) {
        // Arriving here means the queue card said "draft the invoice" and the
        // draft could not be made. Staying on the job screen in silence looks
        // like the tap did nothing; say why, then let them fix it here.
        Alert.alert(
          t('jobs.invoiceFailedTitle', 'Could not create the invoice'),
          err instanceof Error ? err.message : String(err),
        );
      }
    })();
  }, [action, id, addInvoiceFromJob, router]);
  const { advance, recordHours } = useJobLifecyclePipeline();
  const costVariance = useJobCostVariance(id || '');
  // R206: cohort cost-variance baseline for the contractor's trade/country.
  // Purely informational — shown as a caption below the per-job margin bar.
  const [cohortCostVar, setCohortCostVar] = useState<CohortCostVariance | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tr = businessProfile?.trade ?? 'general';
    const co = businessProfile?.country ?? 'NL';
    getCohortCostVariance(tr, co).then(b => { if (!cancelled) setCohortCostVar(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [businessProfile?.trade, businessProfile?.country]);
  // R265: postcode-level cohort benchmark for the job's address
  const jobPostcode = (jobs.find((j: any) => j.id === id) as any)?.address?.postcode ?? null;
  const { cohort: postcodeCohort } = usePostcodeCohort(
    businessProfile?.trade ?? 'general',
    businessProfile?.country ?? 'NL',
    jobPostcode,
  );
  const job = useMemo(() => {
    const fromScheduler = smartSchedulerService.getJob(id || '');
    if (fromScheduler) return fromScheduler;
    // Fallback: build a ScheduledJob-compatible object from AppState
    const appJob = jobs.find((j: any) => j.id === id);
    if (!appJob) return null;
    const cust = customers.find((c: any) => c.id === appJob.customerId);
    return {
      id: appJob.id,
      projectName: appJob.title,
      customerName: cust?.name || '',
      customerId: appJob.customerId,
      address: appJob.address?.street || '',
      // The full object, kept so directions can use postcode + city. The
      // display string above is street-only, which reads fine next to a
      // customer name but would navigate a van to the wrong Kerkstraat.
      addressFull: appJob.address,
      type: appJob.trade || 'general',
      startTime: appJob.scheduledDate ? `${appJob.scheduledDate}T${appJob.scheduledStartTime || '09:00'}` : new Date().toISOString(),
      endTime: appJob.scheduledDate ? `${appJob.scheduledDate}T${appJob.scheduledEndTime || '17:00'}` : new Date().toISOString(),
      // ScheduledJob.duration is MINUTES (see smartSchedulerService), but
      // Job.estimatedDuration is HOURS. Assigning hours straight in made a
      // 24-hour job render as "24 min" here while Werk showed "24u".
      duration: (appJob.estimatedDuration || 2) * 60,
      travelTime: 15,
      // Everything that was not in-progress or completed collapsed to
      // 'confirmed', and getStatusLabel's default renders that as "Scheduled" —
      // so a LEAD was badged GEPLANT while the lifecycle stepper directly below
      // it correctly read "Lead". Carry the real status; the label maps it.
      status: appJob.status === 'in-progress' ? 'in_progress' as const
        : appJob.status === 'completed' ? 'completed' as const
        : appJob.status === 'cancelled' ? 'cancelled' as const
        : appJob.status === 'lead' ? 'lead' as const
        : 'confirmed' as const,
      // A job with no scheduledDate has no slot. Both startTime and endTime
      // fell back to `new Date()`, so an unscheduled lead rendered a
      // zero-length window ("11:39 – 11:39") beside a "3 Std." estimate.
      isScheduled: Boolean(appJob.scheduledDate),
      priority: appJob.priority || 'normal',
      // Was hardcoded ''. The Notes box below wrote to local state that nothing
      // ever saved, and `jobs` has NO `notes` column — the same shape as the
      // invoice notes bug fixed in R66 round 13 ("a full notes UI with no
      // backing column — every save was lost on cold start"), still live here.
      //
      // Stored in `jobs.specifications`: an existing text column that nothing
      // read and nothing wrote, already handled by BOTH mappers, whose only
      // sample value was "Color: Flexa Pure White. Finish: Matte. Customer
      // supplying paint." — job notes in all but name. Reusing it keeps this a
      // JS-only fix; renaming the column to `notes` is a cosmetic migration.
      notes: appJob.specifications ?? '',
      siteContact: appJob.siteContact ?? '',
      sitePhone: appJob.sitePhone ?? '',
      // Map the English domain status to the Dutch lifecycle enum. The old
      // `as any` let 'in-progress' through, which is absent from
      // LIFECYCLE_ORDER -> indexOf === -1 -> "Voortgang -14%".
      lifecycleStatus: toLifecycleStatus(appJob.status) ?? 'ingepland',
      quotedAmount: appJob.quotedAmount || 0,
    } as any;
  }, [id, jobs, customers]);

  // Seed the notes editor from the persisted value once the job hydrates.
  // Keyed on the job id, not the text, so a save does not fight the typist.
  useEffect(() => {
    setNotes(job?.notes ?? '');
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // R66 round 17: removed dead `auditTrail` useMemo. Built a 6-event
  // timeline (Job created / Quote sent / Scheduled / Work started /
  // Completed / Invoiced / Paid) with hardcoded English labels — but the
  // result was never read by the JSX render path (single-occurrence
  // identifier in the file). Pure compute waste + 6 fake-localization-debt
  // strings that misled audits. If a real audit-trail UI ships later, the
  // labels need to flow through t() and the strings should target the
  // gobd_audit_log entries (R15) rather than synthesizing from job state.

  // Show cost section for jobs that are bezig or later
  const showCostSection = job && ['bezig', 'gereed', 'gefactureerd', 'betaald'].includes(job.lifecycleStatus);

  if (!job) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('jobs.notFound', 'Job not found')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={SemanticColors.textDisabled} />
          <Text style={styles.emptyText}>{t('jobs.notFoundDesc', 'This job could not be found')}</Text>
        </View>
      </View>
    );
  }

  const appJob = jobs.find((j: any) => j.id === id);
  const cust = customers.find((c: any) => c.id === (appJob?.customerId || job.customerId));
  const contact = cust
    ? { name: cust.name, phone: cust.phone || '', email: cust.email || '' }
    : { name: job.customerName || '', phone: '', email: '' };
  // The one writer this screen never had. `updateJob` already persists
  // customerId through the standard mapper, so linking is a single field write
  // — the gap was purely that no control existed to make it.
  const linkedCustomerId = appJob?.customerId ?? job.customerId ?? null;
  // R295: the ETA is asked, never assumed — this used to send a hardcoded
  // "15 min" to the customer regardless of distance (no GPS: expo-location is
  // not installed). The windows live in one place so the menu and any future
  // caller cannot drift.
  const ETA_CHOICES = [
    { mins: 10, key: 'jobs.eta10' },
    { mins: 20, key: 'jobs.eta20' },
    { mins: 30, key: 'jobs.eta30' },
    { mins: 45, key: 'jobs.eta45' },
  ];
  const sendOnMyWay = async (etaLabel: string) => {
    try {
      const { renderTemplate } = await import('../../../src/services/whatsappTemplateService');
      const locale = ((businessProfile as any)?.language ?? 'en') as any;
      const text = renderTemplate('on_my_way', locale, {
        customer: contact.name || '',
        eta: etaLabel,
        business: (businessProfile as any)?.businessName ?? 'Vasco',
      });
      // `Share.share` RESOLVES with `dismissedAction` — it does not throw — so
      // backing out of the sheet used to buzz success as though the customer
      // had been told the contractor is on the way. Nothing is persisted here,
      // so this was a false signal rather than a false record, but it is the
      // same class that has bitten this repo three times.
      const res = await Share.share({ message: text, title: t('jobs.onMyWay', 'On my way') });
      if (wasShareDismissed(res)) return;
      hapticSuccess();
    } catch {}
  };
  const customerMenuItems = [
    {
      key: '__none__',
      label: t('jobs.noCustomer', 'No customer'),
      selected: !linkedCustomerId,
      emphasis: true,
      onPress: () => { if (id) updateJob(id, { customerId: null }); },
    },
    ...(customers as { id: string; name: string; phone?: string }[]).map((c) => ({
      key: c.id,
      label: c.name,
      detail: c.phone,
      selected: linkedCustomerId === c.id,
      onPress: () => { if (id) updateJob(id, { customerId: c.id }); },
    })),
  ];
  const upsells = EMPTY_UPSELLS;
  const rawJobMaterials = jobMaterialsMap[id || ''] || [];
  const materials: MaterialPrediction[] = rawJobMaterials.map((jm: any) => {
    // Resolve id → human name via the catalog; the raw materialId ('mat-cvfilter')
    // used to render straight as the title. Fallback humanises the id rather than
    // leaking it. Supplier resolves from the suppliers list; when unknown we omit
    // it instead of showing a fake 'Supplier'.
    const catMat = materialCatalog.find((m: any) => m.id === jm.materialId);
    const catSup = jm.supplierId ? suppliers.find((s: any) => s.id === jm.supplierId) : undefined;
    return {
      id: jm.id,
      name: catMat?.name || String(jm.materialId).replace(/^mat[-_]/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      quantity: `${jm.quantity} ${jm.unit}`,
      inStock: jm.status !== 'planned',
      reorderNeeded: jm.status === 'planned',
      estimatedCost: jm.totalPrice || (jm.unitPrice ? jm.unitPrice * jm.quantity : 0),
      supplier: catSup?.name || '',
    };
  });
  const reorderItems = materials.filter(m => m.reorderNeeded);

  // App locale, not device locale — see src/i18n/formatting.formatTime.
  const startTime = formatTime(new Date(job.startTime), country);
  const endTime = formatTime(new Date(job.endTime), country);

  // Duration of THIS SLOT, mirroring the Werk list. `job.duration` is the
  // whole job's estimate ((estimatedDuration || 2) * 60), so a 24h bathroom
  // renovation chipped "24u" next to the slot "13:30 – 17:00".
  const slotMins = (() => {
    const s = new Date(job.startTime).getTime();
    const e = new Date(job.endTime).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return 0;
    return Math.round((e - s) / 60000);
  })();
  const durationMins = slotMins > 0 ? slotMins : (job.duration ?? 0);

  const getStatusLabel = () => {
    switch (job.status) {
      case 'in_progress': return t('jobs.statusInProgress', 'In progress');
      case 'completed': return t('jobs.statusCompleted', 'Completed');
      case 'cancelled': return t('jobs.statusCancelled', 'Cancelled');
      case 'lead': return t('jobs.statusLead', 'Lead');
      default: return t('jobs.statusScheduled', 'Scheduled');
    }
  };
  const getStatusColor = () => {
    switch (job.status) {
      case 'in_progress': return SemanticColors.feedbackSuccess;
      case 'completed': return '#3B82F6';
      case 'cancelled': return SemanticColors.feedbackError;
      case 'lead': return SemanticColors.textSecondary;
      default: return Palette.hermesOrange;
    }
  };

  const getTypeLabel = () => {
    switch (job.type) {
      case 'quote_visit': return t('jobs.typeQuoteVisit', 'Quote visit');
      case 'follow_up': return t('jobs.typeFollowUp', 'Follow-up');
      case 'personal': return t('jobs.typePersonal', 'Personal');
      default: return t('jobs.typeJob', 'Job');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{job.projectName}</Text>
        {/* This button had NO onPress at all — a labelled, tappable overflow
            control in the header of the most-visited screen that did nothing
            when pressed, in every locale, since it was added. Found by tapping
            it on the sim 2026-08-26. Deleting a job was also reachable from
            the Aufträge LIST only, so the menu it now opens carries the one
            action this screen genuinely lacked. */}
        <DKMenu
          accessibilityLabel={t('common.moreOptions', 'More options')}
          items={[
            {
              key: 'delete',
              label: t('common.delete', 'Delete'),
              icon: 'trash-outline',
              emphasis: true,
              onPress: () => {
                Alert.alert(
                  t('jobs.deleteJob', 'Delete job?'),
                  job.projectName,
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    {
                      text: t('common.delete', 'Delete'),
                      style: 'destructive',
                      onPress: () => { removeJob(job.id); router.back(); },
                    },
                  ],
                );
              },
            },
          ]}
          renderAnchor={(open) => (
            <Pressable onPress={open} style={styles.moreBtn} accessibilityRole="button" accessibilityLabel={t('common.moreOptions', 'More options')}>
              <Ionicons name="ellipsis-horizontal" size={20} color={SemanticColors.textTertiary} />
            </Pressable>
          )}
        />
      </View>

      {/* Status-colored accent line */}
      <View style={[styles.headerAccent, { backgroundColor: getStatusColor() }]} />

      {/* Timer — prominent at top */}
      <View style={styles.timerSection}>
        <View style={styles.timerCard}>
          <View style={styles.timerLeft}>
            <Ionicons name="time" size={20} color={clockedIn ? Palette.hermesOrange : SemanticColors.textTertiary} />
            <View>
              <Text style={styles.timerLabel}>{clockedIn ? t('jobs.clockedInLabel', 'Clocked in') : t('jobs.timerLabel', 'Timer')}</Text>
              <Text style={[styles.timerDisplay, clockedIn && { color: Palette.hermesOrange }]}>
                {clockedIn ? timer.timerDisplay : '00:00:00'}
              </Text>
            </View>
          </View>
          <Pressable
            style={[styles.timerBtn, clockedIn && styles.timerBtnStop]}
            accessibilityRole="button"
            accessibilityLabel={clockedIn ? t('jobs.clockOut', 'Clock out') : t('jobs.clockIn', 'Clock in')}
            onPress={async () => {
              hapticSuccess();
              if (clockedIn) {
                const { hours } = await timer.clockOut();
                recordHours(job.id, Math.round(hours * 10) / 10);
                // R17.1: was hardcoded English ("Clocked out (Nh)" / "Clocked in").
                // Activity log entries get persisted as-is, so non-English
                // contractors saw English in their job history. Now uses t().
                addActivityEntry(id || '', 'timer_stopped', t('jobs.activityClockedOut', { defaultValue: 'Clocked out ({{hours}}h)', hours: Math.round(hours * 10) / 10 })).catch(() => {});
                Alert.alert(t('jobs.clockedOut', 'Clocked out'), t('jobs.clockedOutDesc', 'You have been clocked out. Hours saved.'));
              } else {
                await timer.clockIn(job.id, job.projectName || job.customerName || '');
                addActivityEntry(id || '', 'timer_started', t('jobs.activityClockedIn', 'Clocked in')).catch(() => {});
                // R25: queue on_my_way customer-facing notice (closes R3
                // deferral — was manual-button only). Approve → opens Share
                // sheet with prefilled WhatsApp/SMS-ready text.
                if (appJob?.customerId) {
                  const _cust = customers.find((c: any) => c.id === appJob.customerId);
                  const { queueOnMyWay } = await import('../../../src/services/aiActionQueueService');
                  queueOnMyWay({
                    jobId: job.id,
                    jobTitle: job.projectName || job.customerName || '',
                    customerId: appJob.customerId,
                    customerName: _cust?.name,
                    customerPhone: _cust?.phone,
                  }).catch(() => {});
                }
              }
            }}
          >
            <Ionicons name={clockedIn ? 'stop' : 'play'} size={18} color={Palette.white} />
            <Text style={styles.timerBtnText}>{clockedIn ? t('jobs.stop', 'Stop') : t('jobs.start', 'Start')}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />
        }
      >
        {/* ============================================ */}
        {/* 1. JOB STATUS HERO                          */}
        {/* ============================================ */}
        <View style={[styles.heroCard, { borderTopWidth: 3, borderTopColor: getStatusColor() }]}>
          <View style={styles.heroTop}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusLabel()}</Text>
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{getTypeLabel()}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{job.projectName}</Text>
          {contact.name ? (
            <View style={styles.heroCustomerRow}>
              <Ionicons name="person" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.heroCustomerName}>{contact.name}</Text>
            </View>
          ) : null}
          <View style={styles.heroDetails}>
            <View style={styles.heroDetailItem}>
              <View style={styles.heroDetailIcon}>
                <Ionicons name="time" size={14} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.heroDetailText}>
                {(job as { isScheduled?: boolean }).isScheduled
                  ? `${startTime} – ${endTime}`
                  : t('jobs.notScheduled', 'Not scheduled')}
              </Text>
              <View style={styles.durationChip}>
                {/* Format hours+minutes like the Werk list does, so the same
                    job reads identically on both screens. The Dutch "u" was
                    hardcoded for all 6 locales and the minutes were not
                    zero-padded (65 min -> "1u5", reading as 1u50). */}
                <Text style={styles.durationText}>
                  {durationMins >= 60
                    ? (durationMins % 60 > 0
                        ? t('common.durationHm', {
                            defaultValue: '{{h}}h{{m}}',
                            h: Math.floor(durationMins / 60),
                            m: String(durationMins % 60).padStart(2, '0'),
                          })
                        : t('common.durationH', { defaultValue: '{{h}}h', h: Math.floor(durationMins / 60) }))
                    : t('common.durationMin', { defaultValue: '{{m}} min', m: durationMins })}
                </Text>
              </View>
            </View>
            {/* Only render when there IS an address — jobs without one showed a
                bare pin icon with empty text next to it. */}
            {job.address ? (
              <View style={styles.heroDetailItem}>
                <View style={styles.heroDetailIcon}>
                  <Ionicons name="location" size={14} color={Palette.hermesOrange} />
                </View>
                <Text style={styles.heroDetailText} numberOfLines={2}>{job.address}</Text>
                {/* Hidden when there is nothing to navigate to, rather than
                    offering a button that silently does nothing. */}
                {formatDestination((job as any).addressFull) ? (
                  <Pressable
                    style={styles.directionsBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('jobs.directions', 'Directions')}
                    onPress={() => { hapticSuccess(); openDirections((job as any).addressFull); }}
                  >
                    <Ionicons name="navigate" size={13} color={Palette.hermesOrange} />
                    <Text style={styles.directionsBtnText}>{t('jobs.directions', 'Directions')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {/* Site contact. `siteContact`/`sitePhone` have existed in the
                schema, both mappers and the DB since 20260213 and were written
                by exactly one mock fixture — while eveLiveActionService already
                PREFERS `sitePhone` over the customer's number for outbound
                contact, because on a renovation the useful number is the site
                lead's, not the office's.
                Shown even when empty: gating it on a value would hide the only
                control that can set one. */}
            <Pressable
              style={styles.heroDetailItem}
              onPress={() => setEditingSite({ contact: job.siteContact ?? '', phone: job.sitePhone ?? '' })}
              accessibilityRole="button"
              accessibilityLabel={t('jobs.siteContact', 'Site contact')}
            >
              <View style={styles.heroDetailIcon}>
                <Ionicons name="person-circle-outline" size={14} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.heroDetailText} numberOfLines={1}>
                {job.siteContact || job.sitePhone
                  ? [job.siteContact, job.sitePhone].filter(Boolean).join(' · ')
                  : t('jobs.addSiteContact', 'Add site contact')}
              </Text>
              {job.sitePhone ? (
                <Pressable
                  style={styles.directionsBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('jobs.callSite', 'Call site')}
                  onPress={() => { hapticSuccess(); Linking.openURL(`tel:${job.sitePhone}`); }}
                >
                  <Ionicons name="call" size={13} color={Palette.hermesOrange} />
                  <Text style={styles.directionsBtnText}>{t('jobs.callSite', 'Call site')}</Text>
                </Pressable>
              ) : null}
            </Pressable>
            {job.travelTime && (
              <View style={styles.heroDetailItem}>
                <View style={styles.heroDetailIcon}>
                  <Ionicons name="car" size={14} color={Palette.hermesOrange} />
                </View>
                <Text style={styles.heroDetailText}>{job.travelTime} {t('jobs.minTravelTime', 'min travel')}</Text>
              </View>
            )}

            {/* R94: worker assignment row. Hidden when crew is empty
                (solo contractors don't see clutter). Closes the R86 crew
                dispatch loop — workers were CRUD-only before this.

                This was an `Alert.alert` carrying unassign + every active
                crew member + cancel. Android's Alert renders THREE buttons
                and silently drops the rest, so a contractor with three or
                more people on the books could not reach most of their own
                crew — the exact defect [[drag-schedule-is-not-drag]] fixed
                on the schedule board and #219 found again in the timesheet.
                Picking one of N is a DKMenu. */}
            {workers.filter((w) => w.isActive).length > 0 && (
              <DKMenu
                accessibilityLabel={t('jobs.assignToLabel', 'Assign job to a crew member')}
                items={[
                  ...(appJob?.assignedWorkerId
                    ? [{
                        key: '__unassign__',
                        label: t('jobs.unassign', 'Unassign'),
                        emphasis: true,
                        onPress: () => updateJob(id as string, { assignedWorkerId: undefined }),
                      }]
                    : []),
                  // Same trade guard as the planner, so the two assignment
                  // paths cannot disagree about the same person and job.
                  // A warning, never a block.
                  ...workers.filter((w) => w.isActive).map((w) => ({
                    key: w.id,
                    label: w.name,
                    detail: (w as any).trade ? tradeLabel((w as any).trade) : undefined,
                    selected: appJob?.assignedWorkerId === w.id,
                    onPress: () => {
                      const assign = () => updateJob(id as string, { assignedWorkerId: w.id });
                      const mismatch = tradeMismatch(w as any, appJob as any, tradeLabel);
                      if (!mismatch) { assign(); return; }
                      Alert.alert(
                        t('schedule.tradeMismatchTitle'),
                        t('schedule.tradeMismatchBody', {
                          worker: mismatch.workerName,
                          workerTrade: mismatch.workerTrade,
                          jobTrade: mismatch.jobTrade,
                        }),
                        [
                          { text: t('schedule.pickSomeoneElse'), style: 'cancel' as const },
                          { text: t('schedule.assignAnyway'), onPress: assign },
                        ],
                      );
                    },
                  })),
                ]}
                renderAnchor={(open) => (
                  <Pressable
                    style={styles.heroDetailItem}
                    onPress={open}
                    accessibilityRole="button"
                    accessibilityLabel={t('jobs.assignToLabel', 'Assign job to a crew member')}
                  >
                    <View style={styles.heroDetailIcon}>
                      <Ionicons name="person" size={14} color={Palette.hermesOrange} />
                    </View>
                    <Text style={styles.heroDetailText}>
                      {appJob?.assignedWorkerId
                        ? (workers.find((w) => w.id === appJob.assignedWorkerId)?.name ?? t('jobs.unknownWorker', 'Unknown worker'))
                        : t('jobs.unassigned', 'Unassigned — tap to assign')}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={SemanticColors.textTertiary} />
                  </Pressable>
                )}
              />
            )}
          </View>

          {/* Pipeline Stepper */}
          <View style={styles.pipelineStepper}>
            {LIFECYCLE_ORDER.map((step, idx) => {
              const currentIdx = LIFECYCLE_ORDER.indexOf(job.lifecycleStatus);
              const isActive = idx === currentIdx;
              const isDone = idx < currentIdx;
              const dotColor = isActive
                ? LIFECYCLE_COLORS[step]
                : isDone
                ? SemanticColors.feedbackSuccess
                : '#E0E0E0';
              return (
                <View key={step} style={styles.pipelineStep}>
                  <View style={[
                    styles.pipelineDot,
                    { backgroundColor: dotColor },
                    isActive && styles.pipelineDotActive,
                  ]}>
                    {isDone && <Ionicons name="checkmark" size={8} color="#fff" />}
                  </View>
                  {idx < LIFECYCLE_ORDER.length - 1 && (
                    <View style={[styles.pipelineLine, isDone && { backgroundColor: SemanticColors.feedbackSuccess }]} />
                  )}
                </View>
              );
            })}
          </View>
          <Text style={[styles.pipelineLabel, { color: LIFECYCLE_COLORS[job.lifecycleStatus as JobLifecycleStatus] }]}>
            {lifecycleLabel(job.lifecycleStatus as JobLifecycleStatus, t)}
          </Text>

          {/* Job completion progress */}
          {(() => {
            const currentIdx = LIFECYCLE_ORDER.indexOf(job.lifecycleStatus);
            const totalSteps = LIFECYCLE_ORDER.length;
            // Clamp: indexOf returns -1 for an unrecognised status, which used
            // to render as "-14%" and a negative bar width. The mapper above is
            // the real fix; this keeps a future enum drift from being ugly.
            const rawPct = totalSteps > 1 ? Math.round((currentIdx / (totalSteps - 1)) * 100) : 0;
            const progressPct = Math.max(0, Math.min(100, rawPct));
            return (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>{t('jobs.progress', 'Progress')}</Text>
                  <Text style={[styles.progressPct, { color: progressPct >= 100 ? SemanticColors.feedbackSuccess : Palette.hermesOrange }]}>
                    {progressPct}%
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: progressPct >= 100 ? SemanticColors.feedbackSuccess : Palette.hermesOrange }]} />
                </View>
              </View>
            );
          })()}
        </View>

        {/* Volgende stap action */}
        {lifecycleNextAction(job.lifecycleStatus as JobLifecycleStatus, t) && (
          <Pressable
            style={styles.nextStepButton}
            accessibilityRole="button"
            accessibilityLabel={lifecycleNextAction(job.lifecycleStatus as JobLifecycleStatus, t) || t('jobs.advanceStatus', 'Advance status')}
            onPress={() => {
              const invoicingStep = job.lifecycleStatus === 'gereed';
              Alert.alert(
                invoicingStep
                  ? t('jobs.invoiceThisJob', 'Invoice this job')
                  : t('jobs.updateStatus', 'Update status'),
                invoicingStep
                  // Say what the button does. It used to ask "change status to
                  // Invoiced?" and then do exactly that and nothing else — no
                  // invoice was created by this path at all.
                  ? t('jobs.invoiceThisJobDesc', 'Creates a draft invoice from this job, with what the job recorded, and marks the job invoiced.')
                  : t('jobs.updateStatusDesc', { defaultValue: 'Change status to "{{status}}"?', status: lifecycleLabel(LIFECYCLE_ORDER[LIFECYCLE_ORDER.indexOf(job.lifecycleStatus) + 1], t) }),
                [
                  { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                  { text: t('common.confirm', 'Confirm'), onPress: async () => {
                    // R22: gate via validator (closes R2 deferral). Advance
                    // is the user-driven status-transition path; warnings
                    // here surface as a confirm alert before the change.
                    const nextStatus = LIFECYCLE_ORDER[LIFECYCLE_ORDER.indexOf(job.lifecycleStatus as any) + 1];
                    const { gateJobStatusChange } = await import('../../../src/services/jobStatusGate');
                    const ok = await gateJobStatusChange(job.lifecycleStatus, nextStatus, job);
                    if (!ok) return;
                    // Write through AppState, NOT smartScheduler's advance().
                    //
                    // advance() -> smartSchedulerService.advanceLifecycle()
                    // looks the job up in the service's OWN Map, which is
                    // seeded from MOCK_JOBS. Real jobs come from AppState and
                    // are absent from that Map, so the lookup returned
                    // undefined and the call was a silent no-op: confirming
                    // "Status wijzigen naar Gereed" changed nothing — the
                    // badge stayed BEZIG, the stepper never moved. Verified on
                    // the simulator before this fix.
                    //
                    // This screen renders lifecycleStatus from
                    // toLifecycleStatus(appJob.status), i.e. AppState, so
                    // AppState is the store that has to change.
                    // A finished job's next step IS the invoice. Create it
                    // first: addInvoiceFromJob links it to the job and moves
                    // the job to "invoiced" itself, so advancing the status
                    // here as well would be a second, unbacked write — and if
                    // the invoice cannot be made, the job must NOT claim it
                    // was invoiced.
                    if (invoicingStep) {
                      try {
                        const newInvoiceId = await addInvoiceFromJob(job.id);
                        router.push(`/invoices/${newInvoiceId}` as any);
                      } catch (err) {
                        Alert.alert(
                          t('jobs.invoiceFailedTitle', 'Could not create the invoice'),
                          err instanceof Error ? err.message : String(err),
                        );
                      }
                      return;
                    }
                    const nextDomainStatus = LIFECYCLE_TO_DOMAIN_STATUS[nextStatus];
                    if (nextDomainStatus) {
                      const { warnings } = updateJobStatus(job.id, nextDomainStatus as any);
                      if (warnings.length > 0) {
                        Alert.alert(
                          t('jobs.statusChangedWithWarnings', 'Status updated with warnings'),
                          warnings.join('\n'),
                        );
                      }
                    }
                  }},
                ]
              );
            }}
          >
            <Ionicons name="arrow-forward-circle" size={18} color="#fff" />
            <Text style={styles.nextStepText}>{lifecycleNextAction(job.lifecycleStatus as JobLifecycleStatus, t)}</Text>
          </Pressable>
        )}

        {/* ============================================ */}
        {/* 2. CLIENT CONTACT                           */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('jobs.client', 'Client')}</Text>
          <View style={styles.card}>
            {/* A job whose customer is null used to render an empty avatar over
                an empty name over three buttons that opened `tel:`, `wa.me/`
                and `mailto:` with nothing after them. The new-job sheet grew a
                picker, but jobs made before it — or attached to the wrong
                customer — had NO way back: `job.customerId` had readers
                everywhere and the only writer was at creation (#208). Picking
                one of N is a balloon menu, never a chip strip (CLAUDE.md). */}
            {cust ? (
              <>
                <View style={styles.contactRow}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>
                      {contact.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {!!contact.phone && <Text style={styles.contactDetail}>{contact.phone}</Text>}
                  </View>
                  <DKMenu
                    accessibilityLabel={t('jobs.selectCustomer', 'Select customer')}
                    items={customerMenuItems}
                    renderAnchor={(open) => (
                      <Pressable
                        onPress={open}
                        style={styles.contactChange}
                        accessibilityRole="button"
                        accessibilityLabel={t('jobs.changeCustomer', 'Change')}
                      >
                        <Text style={styles.contactChangeText}>{t('jobs.changeCustomer', 'Change')}</Text>
                      </Pressable>
                    )}
                  />
                </View>
                <View style={styles.contactActions}>
                  {/* Only offer a channel we actually have an address for. An
                      enabled button that dials an empty `tel:` is #212's shape:
                      a control claiming a capability the data does not carry. */}
                  {!!contact.phone && (
                    <Pressable
                      style={styles.contactAction}
                      onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('jobs.call', 'Call')} ${contact.name}`}
                    >
                      <View style={[styles.contactActionIcon, { backgroundColor: SemanticColors.feedbackSuccess + '14' }]}>
                        <Ionicons name="call" size={16} color={SemanticColors.feedbackSuccess} />
                      </View>
                      <Text style={styles.contactActionLabel}>{t('jobs.call', 'Call')}</Text>
                    </Pressable>
                  )}
                  {!!contact.phone && (
                    <Pressable
                      style={styles.contactAction}
                      onPress={() => Linking.openURL(`https://wa.me/${contact.phone.replace(/\s+/g, '').replace('+', '')}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`WhatsApp ${contact.name}`}
                    >
                      <View style={[styles.contactActionIcon, { backgroundColor: '#25D36614' }]}>
                        <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                      </View>
                      <Text style={styles.contactActionLabel}>WhatsApp</Text>
                    </Pressable>
                  )}
                  {!!contact.email && (
                    <Pressable
                      style={styles.contactAction}
                      onPress={() => Linking.openURL(`mailto:${contact.email}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('jobs.email', 'Email')} ${contact.name}`}
                    >
                      <View style={[styles.contactActionIcon, { backgroundColor: Palette.hermesOrange + '14' }]}>
                        <Ionicons name="mail" size={16} color={Palette.hermesOrange} />
                      </View>
                      <Text style={styles.contactActionLabel}>{t('jobs.email', 'Email')}</Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.contactEmpty}>
                <Text style={styles.contactEmptyText}>
                  {t('jobs.noCustomerLinkedDesc', 'This job is not linked to a customer, so it cannot be invoiced and the customer sees nothing about it.')}
                </Text>
                <DKMenu
                  accessibilityLabel={t('jobs.selectCustomer', 'Select customer')}
                  items={customerMenuItems}
                  renderAnchor={(open) => (
                    <Pressable
                      onPress={open}
                      style={styles.linkCustomerBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t('jobs.linkCustomer', 'Link a customer')}
                    >
                      <Ionicons name="person-add-outline" size={16} color={DK.colors.accent} />
                      <Text style={styles.linkCustomerText}>{t('jobs.linkCustomer', 'Link a customer')}</Text>
                    </Pressable>
                  )}
                />
              </View>
            )}
          </View>
        </View>

        {/* R267: Route section removed — duplicate of Notes/Activity per user feedback */}

        {/* ============================================ */}
        {/* 4. JOB NOTES                                */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('jobs.notes', 'Notes')}</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.notesInput}
              placeholder={t('jobs.notesPlaceholder', 'Type your notes here...')}
              placeholderTextColor={SemanticColors.textDisabled}
              multiline
              value={notes}
              onChangeText={setNotes}
              // Saved on blur rather than per keystroke: `updateJob` writes
              // through to the BE, and one round-trip per character would
              // queue a write for every letter typed on site.
              onBlur={() => {
                if (notes !== (job.notes ?? '')) updateJob(job.id, { specifications: notes });
              }}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* ============================================ */}
        {/* 5. MATERIAL PREDICTION (Vasco)              */}
        {/* ============================================ */}
        {materials.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>{t('jobs.materials', 'Materials')}</Text>
              {reorderItems.length > 0 && (
                <View style={styles.reorderBadge}>
                  <View style={styles.reorderDot} />
                  <Text style={styles.reorderBadgeText}>{reorderItems.length} {t('jobs.reorder', 'reorder')}</Text>
                </View>
              )}
            </View>
            <View style={styles.card}>
              {materials.map((mat, idx) => (
                <View key={mat.id} style={[styles.materialRow, idx < materials.length - 1 && styles.materialBorder]}>
                  <View style={[styles.materialIndicator, {
                    backgroundColor: mat.inStock ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError,
                  }]} />
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName}>{mat.name}</Text>
                    <Text style={styles.materialDetail}>{[mat.quantity, mat.supplier].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {mat.reorderNeeded && !orderedMaterials.has(mat.id) ? (
                    <Pressable
                      style={styles.reorderBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('jobs.order', 'Order')} ${mat.name}`}
                      onPress={() => {
                        setOrderedMaterials(prev => new Set(prev).add(mat.id));
                        Alert.alert(
                          t('jobs.ordered', 'Ordered'),
                          mat.supplier
                            ? t('jobs.orderedDesc', { defaultValue: '{{name}} has been ordered from {{supplier}}.', name: mat.name, supplier: mat.supplier })
                            : t('jobs.orderedDescNoSupplier', { defaultValue: '{{name}} has been ordered.', name: mat.name }),
                        );
                      }}
                    >
                      <Ionicons name="cart" size={13} color="#fff" />
                      <Text style={styles.reorderBtnText}>{t('jobs.order', 'Order')}</Text>
                    </Pressable>
                  ) : mat.reorderNeeded && orderedMaterials.has(mat.id) ? (
                    <View style={[styles.reorderBtn, { backgroundColor: SemanticColors.feedbackSuccess }]}>
                      <Ionicons name="checkmark" size={13} color="#fff" />
                      <Text style={styles.reorderBtnText}>{t('jobs.ordered', 'Ordered')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.materialCost}>{formatCurrency(mat.estimatedCost, country)}</Text>
                  )}
                </View>
              ))}
            </View>
            {/* Vasco guidance */}
            {reorderItems.length > 0 && (
              <View style={styles.vascoGuidance}>
                <View style={styles.vascoGuidanceAccent} />
                <View style={styles.vascoGuidanceContent}>
                  <View style={styles.vascoGuidanceHeader}>
                    <Ionicons name="sparkles" size={13} color={Palette.hermesOrange} />
                    <Text style={styles.vascoGuidanceTitle}>Vasco</Text>
                  </View>
                  <Text style={styles.vascoGuidanceText}>
                    {t('jobs.vascoMaterialPrediction', {
                      defaultValue: 'Vasco predicts you need {{items}} for this job. Order now to prevent delays.',
                      items: reorderItems.map(m => m.name).join(` ${t('common.and', 'and')} `),
                    })}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ============================================ */}
        {/* 5b. KOSTEN VS OFFERTE (P2)                  */}
        {/* ============================================ */}
        {showCostSection && costVariance && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('jobs.costVsQuote', 'Cost vs Quote')}</Text>
            <View style={styles.card}>
              <View style={styles.costGrid}>
                <View style={styles.costCol}>
                  <Text style={styles.costColHeader}>{t('quotes.quote', 'Quote')}</Text>
                  <Text style={styles.costColValue}>{formatCurrency0(costVariance.estimatedTotal, country)}</Text>
                </View>
                <View style={styles.costCol}>
                  <Text style={styles.costColHeader}>{t('jobs.actual', 'Actual')}</Text>
                  <Text style={styles.costColValue}>{formatCurrency0(costVariance.actualTotal, country)}</Text>
                </View>
                <View style={styles.costCol}>
                  <Text style={styles.costColHeader}>{t('jobs.variance', 'Variance')}</Text>
                  <Text style={[
                    styles.costColValue,
                    { color: costVariance.marginDelta <= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }
                  ]}>
                    {costVariance.marginDelta > 0 ? '+' : ''}{formatCurrency0(costVariance.marginDelta, country)}
                  </Text>
                </View>
              </View>
              {/* Margin bar */}
              <View style={styles.marginBarContainer}>
                <View style={styles.marginBarBg}>
                  <View style={[
                    styles.marginBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, 100 - Math.abs(costVariance.marginPercent)))}%`,
                      backgroundColor: costVariance.marginDelta <= 0 ? SemanticColors.feedbackSuccess : costVariance.marginPercent > 10 ? SemanticColors.feedbackError : '#F59E0B',
                    }
                  ]} />
                </View>
                <Text style={[
                  styles.marginBarLabel,
                  { color: costVariance.marginDelta <= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }
                ]}>
                  {costVariance.marginDelta <= 0 ? t('jobs.underBudget', 'Under budget') : `${costVariance.marginPercent.toFixed(0)}% ${t('jobs.over', 'over')}`}
                </Text>
              </View>
              {/* R206: cohort baseline — only when k-anonymity threshold clears */}
              {cohortCostVar && cohortCostVar.medianRatio !== null && cohortCostVar.contractorCount >= 5 && (
                <Text style={{
                  fontSize: TYPE.captionSize,
                  fontFamily: TYPE.captionFamily,
                  color: SemanticColors.textSecondary,
                  marginTop: GRID.xs,
                }}>
                  {t('jobs.cohortCostBaseline', 'Cohort typical: {{ratio}}% of quote · {{overrun}}% jobs overrun', {
                    ratio: Math.round(cohortCostVar.medianRatio * 100),
                    overrun: Math.round((cohortCostVar.overrunRate ?? 0) * 100),
                  })}
                </Text>
              )}
              {/* R265: postcode-level cohort — only when the job's postcode area has ≥5 contractors */}
              {postcodeCohort && postcodeCohort.contractorCount >= 5 && postcodeCohort.medianUnitPrice !== null && (
                <Text style={{
                  fontSize: TYPE.captionSize,
                  fontFamily: TYPE.captionFamily,
                  color: SemanticColors.textSecondary,
                  marginTop: GRID.xs,
                }}>
                  {t('jobs.postcodeCohort', 'Postcode area: {{price}}/h median · {{accept}}% accept · {{n}} quotes', {
                    price: formatCurrency0(postcodeCohort.medianUnitPrice, country),
                    accept: Math.round((postcodeCohort.acceptanceRate ?? 0) * 100),
                    n: postcodeCohort.sampleSize,
                  })}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ============================================ */}
        {/* 5c. PHOTO GALLERY                            */}
        {/* ============================================ */}
        <View style={styles.section}>
          <PhotoGallery
            photos={jobPhotos}
            jobTitle={job.projectName}
            onAddPhoto={() => {
              showPhotoPicker((photo) => {
                const newPhoto: PhotoItem = {
                  uri: photo.uri,
                  date: new Date().toISOString(),
                  label: jobPhotos.length === 0 ? 'before' : jobCompleted ? 'after' : 'progress',
                };
                setJobPhotos(prev => [...prev, newPhoto]);
                setPhotoCount(prev => prev + 1);
                hapticSuccess();
              });
            }}
          />
        </View>

        {/* ============================================ */}
        {/* 5d. SIGNATURE AUDIT TRAIL (R66r57)            */}
        {/* ============================================ */}
        {/* Reads signatures table rows. Empty for jobs that haven't been
            signed yet. Shows up to 5 most-recent (typically just 1, but
            multi-signature handovers — site lead + customer + inspector —
            stack). */}
        {signatureRows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {t('jobs.signaturesSectionLabel', 'Signatures')}
            </Text>
            {signatureRows.slice(0, 5).map((row) => (
              <View key={row.id} style={styles.signatureRow}>
                <Ionicons name="checkmark-done" size={16} color={SemanticColors.feedbackSuccess} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.signatureRowName}>{row.signer_name}</Text>
                  <Text style={styles.signatureRowMeta}>
                    {new Date(row.signed_at).toLocaleString()} · {row.signer_role}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ============================================ */}
        {/* 6. UPSELL OPPORTUNITIES                     */}
        {/* ============================================ */}
        {upsells.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>{t('jobs.upsellOpportunities', 'Upsell opportunities')}</Text>
              <View style={styles.upsellBadge}>
                <Text style={styles.upsellBadgeText}>{formatCurrency0(upsells.reduce((s, u) => s + u.potentialRevenue, 0), country)}</Text>
              </View>
            </View>
            {upsells.map((item) => (
              <Pressable
                key={item.id}
                style={styles.upsellCard}
                onPress={() => Alert.alert(
                  item.title,
                  `${item.description}\n\n${t('jobs.estRevenue', 'Est. revenue')}: ${formatCurrency(item.potentialRevenue, country)}\n${t('jobs.confidence', 'Confidence')}: ${item.confidence}%`,
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    { text: t('jobs.offer', 'Offer'), onPress: () => Alert.alert(t('jobs.offered', 'Offered'), t('jobs.offeredDesc', { defaultValue: '{{title}} has been noted as a suggestion.', title: item.title })) },
                  ]
                )}
              >
                <View style={styles.upsellIconWrap}>
                  <Ionicons name={item.icon} size={18} color={Palette.hermesOrange} />
                </View>
                <View style={styles.upsellInfo}>
                  <Text style={styles.upsellTitle}>{item.title}</Text>
                  <Text style={styles.upsellDesc} numberOfLines={1} ellipsizeMode="tail">{item.description}</Text>
                </View>
                <View style={styles.upsellRight}>
                  <Text style={styles.upsellAmount}>{formatCurrency0(item.potentialRevenue, country)}</Text>
                  <View style={styles.confidenceBar}>
                    <View style={[styles.confidenceFill, { width: `${item.confidence}%` }]} />
                  </View>
                  <Text style={styles.upsellConfidence}>{item.confidence}%</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* R267: Timeline section removed — Activity feed below covers same lifecycle */}

        {/* ============================================ */}
        {/* 7c. ACTIVITY & COMMENTS                     */}
        {/* ============================================ */}
        {id && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('jobs.activity', 'Activity')}</Text>
            <JobComments jobId={id} />
          </View>
        )}

        {/* ============================================ */}
        {/* 8. QUICK ACTIONS                            */}
        {/* ============================================ */}
        <View style={styles.actionsBlock}>
          {!jobCompleted && (
            <Pressable
              style={[styles.actionPrimary, clockedIn && { backgroundColor: SemanticColors.feedbackError }]}
              accessibilityRole="button"
              accessibilityLabel={clockedIn ? t('jobs.clockOut', 'Clock out') : t('jobs.clockIn', 'Clock in')}
              onPress={async () => {
                hapticSuccess();
                if (clockedIn) {
                  const { hours } = await timer.clockOut();
                  recordHours(job.id, Math.round(hours * 10) / 10);
                  addActivityEntry(id || '', 'timer_stopped', t('jobs.activityClockedOut', { defaultValue: 'Clocked out ({{hours}}h)', hours: Math.round(hours * 10) / 10 })).catch(() => {});
                  Alert.alert(t('jobs.clockedOut', 'Clocked out'), t('jobs.clockedOutDesc', 'You have been clocked out. Hours saved.'));
                } else {
                  await timer.clockIn(job.id, job.projectName || job.customerName || '');
                  addActivityEntry(id || '', 'timer_started', t('jobs.activityClockedIn', 'Clocked in')).catch(() => {});
                  // R25: queue on_my_way notice (closes R3 deferral). Same
                  // pattern as the timer-row clock-in handler above.
                  if (appJob?.customerId) {
                    const _cust = customers.find((c: any) => c.id === appJob.customerId);
                    const { queueOnMyWay } = await import('../../../src/services/aiActionQueueService');
                    queueOnMyWay({
                      jobId: job.id,
                      jobTitle: job.projectName || job.customerName || '',
                      customerId: appJob.customerId,
                      customerName: _cust?.name,
                      customerPhone: _cust?.phone,
                    }).catch(() => {});
                  }
                  Alert.alert(t('jobs.clockedIn', 'Clocked in'), t('jobs.clockedInDesc', 'You are now clocked in on this job.'));
                }
              }}
            >
              <Ionicons name={clockedIn ? 'stop' : 'play'} size={18} color="#fff" />
              <Text style={styles.actionPrimaryText}>{clockedIn ? t('jobs.clockOut', 'Clock out') : t('jobs.clockIn', 'Clock in')}</Text>
            </Pressable>
          )}
          {/* Secondary actions get their own row. Sharing one row with the
              primary gave each of them ~54pt — narrower than any of their
              labels in any locale, so "Formulier invullen" / "Remplir le
              formulaire" wrapped to three lines and clipped. The captions are
              short NOUNS (jobs.quick*); the full action sentence stays on
              accessibilityLabel, so screen readers lose nothing. */}
          <View style={styles.actionsSecondaryRow}>
          <Pressable
            style={styles.actionSecondary}
            accessibilityRole="button"
            accessibilityLabel={`${t('jobs.photo', 'Take photo')}${photoCount > 0 ? `, ${photoCount} photos taken` : ''}`}
            onPress={() => {
              hapticSuccess();
              router.push(`/contractor/job/${job.id}/photos` as any);
            }}
          >
            <Ionicons name="camera" size={18} color={Palette.hermesOrange} />
            <Text style={styles.actionSecondaryText} numberOfLines={2}>{t('jobs.quickPhoto', 'Photo')}{photoCount > 0 ? ` (${photoCount})` : ''}</Text>
          </Pressable>
          {/* Job form. Sits with Photo rather than behind completion: the
              checklist is what you work THROUGH on site, not something you
              fill in afterwards from memory. */}
          <Pressable
            style={styles.actionSecondary}
            accessibilityRole="button"
            accessibilityLabel={t('jobForms.fillIn', 'Fill in form')}
            onPress={() => {
              hapticSuccess();
              router.push(`/contractor/job-form/${job.id}` as any);
            }}
          >
            <Ionicons name="clipboard-outline" size={18} color={Palette.hermesOrange} />
            <Text style={styles.actionSecondaryText} numberOfLines={2}>{t('jobs.quickForm', 'Form')}</Text>
          </Pressable>
          {jobCompleted && (
            <Pressable
              style={styles.actionSecondary}
              accessibilityRole="button"
              accessibilityLabel={t('jobs.qualityFeedback', 'Add quality feedback')}
              onPress={() => {
                hapticSuccess();
                router.push(`/contractor/job-quality/${job.id}` as any);
              }}
            >
              <Ionicons name="star-outline" size={18} color={Palette.hermesOrange} />
              <Text style={styles.actionSecondaryText} numberOfLines={2}>{t('jobs.quickFeedback', 'Feedback')}</Text>
            </Pressable>
          )}
          {!jobCompleted && (contact.phone || contact.email) && (
            // Four ETA windows + cancel in an `Alert.alert`: Android shows
            // three, so "45 min" — the one you need when you are actually
            // late — was unreachable, and so, possibly, was cancel. #219.
            <DKMenu
              accessibilityLabel={t('jobs.onMyWay', 'Send on-my-way to customer')}
              items={ETA_CHOICES.map(({ mins, key }) => ({
                key: String(mins),
                // The already-translated eta10/20/30/45 keys — German writes
                // "10 Min.", and the label must not be re-derived here.
                label: t(key, `${mins} min`),
                // The template slot stays untranslated minutes: it is what the
                // CUSTOMER reads, rendered by whatsappTemplateService in the
                // customer's own template locale.
                onPress: () => { void sendOnMyWay(`${mins} min`); },
              }))}
              renderAnchor={(open) => (
                <Pressable
                  style={styles.actionSecondary}
                  accessibilityRole="button"
                  accessibilityLabel={t('jobs.onMyWay', 'Send on-my-way to customer')}
                  onPress={open}
                >
                  <Ionicons name="navigate" size={18} color={Palette.hermesOrange} />
                  <Text style={styles.actionSecondaryText} numberOfLines={2}>{t('jobs.quickOnMyWay', 'On my way')}</Text>
                </Pressable>
              )}
            />
          )}
          {!jobCompleted ? (
            <Pressable
              style={styles.actionSecondary}
              accessibilityRole="button"
              accessibilityLabel={t('jobs.done', 'Mark job as done')}
              onPress={async () => {
                // Pre-flight: per-trade completion checklist
                let checklistWarning = '';
                let needsSignoff = false;
                try {
                  const photos = await listJobPhotos(job.id).catch(() => []);
                  const result = evaluateCompletion({
                    job: job as any,
                    photos: photos as any,
                    signedOff: Boolean(job.customerSignoffAt),
                  });
                  if (!result.canComplete) {
                    // R16.2: render the localized labelKey instead of the
                    // hardcoded English `label`. Was previously English-only
                    // even for Dutch/German contractors closing a job.
                    const missing = result.items
                      .filter((i) => i.required && !i.satisfied)
                      .map((i) => `• ${t(i.labelKey, i.label)}`)
                      .join('\n');
                    checklistWarning = `\n\n${t('jobs.missingItems', 'Missing for trade compliance')}:\n${missing}`;
                    needsSignoff = result.items.some((i) => i.id === 'customer_signoff' && i.required && !i.satisfied);
                  }
                } catch {}
                const doComplete = async () => {
                  hapticSuccess();
                  if (clockedIn) {
                    const { hours } = await timer.clockOut();
                    if (hours > 0) {
                      recordHours(job.id, Math.round(hours * 10) / 10);
                    }
                  }
                  // Actually mark the job completed. Previously this only set
                  // the local `jobCompleted` flag: the button flipped to
                  // "Completed" and the clocked hours were recorded, but the
                  // job's STATUS was never changed — so navigating away and
                  // back (or a cold start) showed "Done" again and Werk still
                  // listed the job as active. `updateJob` was destructured
                  // here and used for worker assignment and signatures, just
                  // never for completion.
                  //
                  // updateJobStatus (not updateJob) is the right call: it runs
                  // the transition validator, stamps completedAt, records the
                  // job outcome, and queues the draft-invoice action — the
                  // whole post-completion chain that was being skipped.
                  const { warnings } = updateJobStatus(job.id, 'completed');
                  if (warnings.length > 0) {
                    Alert.alert(
                      t('jobs.completedWithWarnings', 'Completed with warnings'),
                      warnings.join('\n'),
                    );
                  }
                  setJobCompleted(true);
                };
                // R267: digital-signature now has 3 paths — capture in-app,
                // request from customer remotely, or skip when not required.
                const requestRemoteSignature = async () => {
                  try {
                    const customerLabel = job.customerName || t('jobs.customer', 'customer');
                    const messageBody = t(
                      'jobs.signatureRequestBody',
                      'Hi {{customer}}, please sign off on the completed work for "{{job}}": vascobuild.com/sign/{{ref}}',
                      { customer: customerLabel, job: job.projectName || 'the project', ref: id },
                    );
                    await Share.share({
                      message: messageBody,
                      title: t('jobs.signatureRequestTitle', 'Sign-off request'),
                    });
                    addActivityEntry(id || '', 'signature_requested', t('jobs.activitySignatureRequested', { defaultValue: 'Sign-off link sent to {{customer}}', customer: customerLabel })).catch(() => {});
                  } catch {}
                };
                // Four buttons — cancel, capture, request, complete — when a
                // sign-off was outstanding. Android renders THREE and drops
                // the rest, and the one that fell off the end was
                // **Complete**: the primary action of the button the
                // contractor had just pressed. Split into two ≤3-button
                // steps so every path survives on both platforms, and so the
                // checklist warning stays attached to the confirmation it
                // belongs to rather than becoming a menu with no message.
                const askHowToSignOff = () => {
                  Alert.alert(
                    t('jobs.customerSignature', 'Customer signature'),
                    t('jobs.signOffHow', 'How do you want the sign-off?'),
                    [
                      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                      {
                        text: t('jobs.captureSignature', 'Capture signature'),
                        onPress: () => setSignatureModal({ visible: true, onSigned: doComplete }),
                      },
                      {
                        text: t('jobs.requestSignature', 'Request from customer'),
                        onPress: requestRemoteSignature,
                      },
                    ],
                  );
                };
                Alert.alert(
                  t('jobs.completeJob', 'Complete job'),
                  t('jobs.completeJobConfirm', 'Are you sure you want to complete this job?') + checklistWarning,
                  [
                    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    ...(needsSignoff ? [{
                      text: t('jobs.signOffFirst', 'Get sign-off first'),
                      onPress: askHowToSignOff,
                    }] : []),
                    { text: t('jobs.complete', 'Complete'), onPress: doComplete },
                  ],
                );
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.actionSecondaryText} numberOfLines={2}>{t('jobs.quickDone', 'Done')}</Text>
            </Pressable>
          ) : (
            <View style={[styles.actionSecondary, { backgroundColor: SemanticColors.feedbackSuccess + '14' }]}>
              <Ionicons name="checkmark-done" size={18} color={SemanticColors.feedbackSuccess} />
              <Text style={[styles.actionSecondaryText, { color: SemanticColors.feedbackSuccess }]} numberOfLines={2}>{t('jobs.statusCompleted', 'Completed')}</Text>
            </View>
          )}
          </View>
        </View>

        {/* ============================================ */}
        {/* 7b. FACTUREER BUTTON (gereed jobs)          */}
        {/* ============================================ */}
        {/* The FACTUREER button lived here as a second control with the same
            condition as the lifecycle CTA above, which now does the whole
            action (create + link + advance + open the invoice). Two buttons
            for one job on one screen is how they drifted apart in the first
            place. Kept as the path from the AI queue's ?action=create-invoice
            deep link only when the job somehow still has no invoice. */}
        {job.lifecycleStatus === 'gereed' && !job.invoiceId && (
          <Pressable
            style={styles.factureerButton}
            accessibilityRole="button"
            accessibilityLabel={t('jobs.invoiceThisJob', 'Invoice this job')}
            onPress={async () => {
              hapticSuccess();
              // Was: catch and navigate anyway. So when addInvoiceFromJob threw
              // — which it did for every job with no agreed price — the
              // contractor tapped "invoice this job", arrived at the invoice
              // list, and found no invoice and no explanation. The throw
              // carries the reason; show it and stay put.
              try {
                await addInvoiceFromJob(job.id);
              } catch (err) {
                Alert.alert(
                  t('jobs.invoiceFailedTitle', 'Could not create the invoice'),
                  err instanceof Error ? err.message : String(err),
                );
                return;
              }
              router.push('/(contractor)/facturen' as any);
            }}
          >
            <Ionicons name="receipt" size={18} color="#fff" />
            <Text style={styles.factureerButtonText}>{t('jobs.invoiceThisJob', 'Invoice this job')}</Text>
          </Pressable>
        )}

        {/* ============================================ */}
        {/* 8. EVIDENCE PHOTO GALLERY                   */}
        {/* ============================================ */}
        {showGallery && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('jobs.evidencePhotos', 'Evidence photos')}</Text>
            {photoCount > 0 && (
              <Text style={{ fontSize: TYPE.captionSize, color: SemanticColors.feedbackSuccess, fontFamily: TYPE.titleFamily, marginBottom: GRID.xs }}>
                {t('jobs.photosCaptured', { defaultValue: '{{count}} photos captured', count: photoCount })}
              </Text>
            )}
            <View style={styles.galleryGrid}>
              {Array.from({ length: Math.min(photoCount, 6) }).map((_, idx) => (
                <View key={idx} style={styles.galleryItem}>
                  <View style={[styles.galleryThumb, { backgroundColor: idx < Math.ceil(photoCount / 2) ? '#E8E4DF' : '#D4EDDA' }]}>
                    <Ionicons name="image" size={24} color={idx < Math.ceil(photoCount / 2) ? SemanticColors.textTertiary : SemanticColors.feedbackSuccess} />
                  </View>
                  <View style={[styles.galleryLabel, { backgroundColor: idx < Math.ceil(photoCount / 2) ? '#F5F5F5' : SemanticColors.feedbackSuccess + '14' }]}>
                    <Text style={[styles.galleryLabelText, { color: idx < Math.ceil(photoCount / 2) ? SemanticColors.textTertiary : SemanticColors.feedbackSuccess }]}>
                      {idx < Math.ceil(photoCount / 2) ? t('jobs.before', 'Before') : t('jobs.after', 'After')}
                    </Text>
                  </View>
                </View>
              ))}
              <Pressable
                style={styles.galleryAddItem}
                onPress={() => {
                  Alert.alert(
                    t('jobs.takePhoto', 'Take Photo'),
                    t('jobs.photoSourcePrompt', 'Choose a photo source'),
                    [
                      { text: t('jobs.camera', 'Camera'), onPress: () => {
                        hapticSuccess();
                        setPhotoCount(prev => prev + 1);
                        Alert.alert(t('jobs.photoAdded', 'Photo added'), t('jobs.photoAddedDesc', { defaultValue: 'Photo {{count}} captured and saved.', count: photoCount + 1 }));
                      }},
                      { text: t('jobs.photoLibrary', 'Photo Library'), onPress: () => {
                        hapticSuccess();
                        setPhotoCount(prev => prev + 1);
                        Alert.alert(t('jobs.photoAdded', 'Photo added'), t('jobs.photoAddedDesc', { defaultValue: 'Photo {{count}} captured and saved.', count: photoCount + 1 }));
                      }},
                      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                    ]
                  );
                }}
              >
                <Ionicons name="camera" size={28} color={Palette.hermesOrange} />
                <Text style={styles.galleryAddText}>{t('jobs.takePhoto', 'Take Photo')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      <Modal
        visible={editingSite !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingSite(null)}
      >
        <View style={styles.signatureBackdrop}>
          {/* Verified on the sim: focusing the name field left only a sliver of
              this sheet above the keyboard — both inputs and Save/Cancel were
              hidden. A site contact could not be entered. */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end' }}>
          <View style={styles.signatureSheet}>
            <Text style={styles.signatureTitle}>{t('jobs.siteContact', 'Site contact')}</Text>
            <Text style={styles.signatureSubtitle}>
              {t('jobs.siteContactDesc', 'Who is on site and the number to reach them on. Used instead of the customer number when Vasco contacts the job.')}
            </Text>
            <TextInput
              style={styles.siteInput}
              placeholder={t('jobs.siteContactPlaceholder', 'Name or role, e.g. building concierge')}
              placeholderTextColor={SemanticColors.textDisabled}
              value={editingSite?.contact ?? ''}
              onChangeText={(v) => setEditingSite((s) => (s ? { ...s, contact: v } : s))}
            />
            <TextInput
              style={styles.siteInput}
              placeholder={t('jobs.sitePhonePlaceholder', 'Phone number on site')}
              placeholderTextColor={SemanticColors.textDisabled}
              value={editingSite?.phone ?? ''}
              onChangeText={(v) => setEditingSite((s) => (s ? { ...s, phone: v } : s))}
              keyboardType="phone-pad"
            />
            <Pressable
              style={styles.siteSaveBtn}
              onPress={() => {
                if (!editingSite) return;
                hapticSuccess();
                // Empty clears the field rather than storing "". mappers.ts
                // uses `'siteContact' in updates`, so an explicit undefined
                // does reach the patch as null here (unlike updateProject).
                updateJob(job.id, {
                  siteContact: editingSite.contact.trim() || undefined,
                  sitePhone: editingSite.phone.trim() || undefined,
                });
                setEditingSite(null);
              }}
            >
              <Text style={styles.siteSaveText}>{t('common.save', 'Save')}</Text>
            </Pressable>
            <Pressable style={styles.signatureCancel} onPress={() => setEditingSite(null)}>
              <Text style={styles.signatureCancelText}>{t('common.cancel', 'Cancel')}</Text>
            </Pressable>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={signatureModal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setSignatureModal({ visible: false })}
      >
        <View style={styles.signatureBackdrop}>
          <View style={styles.signatureSheet}>
            <Text style={styles.signatureTitle}>{t('jobs.customerSignature', 'Customer signature')}</Text>
            <Text style={styles.signatureSubtitle}>{t('jobs.customerSignatureDesc', 'Ask the customer to sign below to confirm the work is completed.')}</Text>
            <SignaturePad
              label={contact.name}
              onSave={(svg) => {
                try {
                  // R301: now properly typed — columns exist on BE jobs schema
                  updateJob(job.id, { customerSignoffAt: new Date().toISOString(), signatureSvg: svg });
                  // R66r55: also write a row to the signatures audit-trail
                  // table. Async + fire-and-forget — the job-row write is
                  // still the displayed signature, this is the immutable
                  // legal record (server-stamped signed_at, signer name,
                  // device user-agent). Failure here doesn't block the UI.
                  import('../../../src/services/signatureService').then(({ recordContractorSignature }) =>
                    recordContractorSignature({
                      jobId: job.id,
                      signerName: contact.name || 'Customer',
                      signerRole: 'customer',
                      signatureSvg: svg,
                    }).catch(() => {}),
                  ).catch(() => {});
                } catch {}
                const cb = signatureModal.onSigned;
                setSignatureModal({ visible: false });
                if (cb) cb();
              }}
            />
            <Pressable
              onPress={() => setSignatureModal({ visible: false })}
              style={styles.signatureCancel}
              accessibilityRole="button"
            >
              <Text style={styles.signatureCancelText}>{t('common.cancel', 'Cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  directionsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '18',
    flexShrink: 0,
  },
  directionsBtnText: { fontSize: TYPE.labelSize, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: GRID.md,
    paddingTop: SafeArea.top,
    paddingBottom: GRID.md - 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    flex: 1,
    textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1.2 },
  moreBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAccent: {
    height: 3,
    backgroundColor: Palette.hermesOrange,
    marginHorizontal: GRID.md,
    borderRadius: 2,
  },
  // Timer section — prominent at top
  timerSection: {
    paddingHorizontal: GRID.md,
    paddingTop: GRID.md,
  },
  timerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  timerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm + 4,
  },
  timerLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  timerDisplay: {
    fontSize: 28,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: -1,
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm + 2,
  },
  timerBtnStop: {
    backgroundColor: SemanticColors.feedbackError,
  },
  timerBtnText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },

  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: GRID.md,
    paddingTop: GRID.md,
    gap: GRID.lg,
    // Without this the last section ended flush against the home indicator,
    // with nothing to scroll past — and once the comment keyboard opened, the
    // action buttons were clipped mid-glyph.
    paddingBottom: SafeArea.bottom + GRID.lg,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.md - 4,
  },
  emptyText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
  },

  // Hero card
  heroCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg + 2,
    padding: RADIUS.lg + 2,
    gap: GRID.md - 4,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  heroTop: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: PAGE_BG,
  },
  typeText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
  },
  heroTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.sectionTracking,
  },
  heroCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -2,
  },
  heroCustomerName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  heroDetails: {
    gap: 10,
  },
  heroDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroDetailIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange + '0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDetailText: {
    flex: 1,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  durationChip: {
    backgroundColor: Palette.pastelOrange + '30',
    paddingHorizontal: GRID.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  durationText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
  },

  // Progress
  progressSection: {
    gap: GRID.xs,
    marginTop: GRID.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  progressPct: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
  },
  progressTrack: {
    height: 6,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },

  // Section
  section: { gap: GRID.sm },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.sectionTracking,
  },

  // R66r57: signature audit-trail row
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: GRID.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  signatureRowName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.textPrimary,
  },
  signatureRowMeta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: SemanticColors.textTertiary,
  },

  // Card
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },

  // Contact
  contactChange: {
    paddingHorizontal: GRID.sm, paddingVertical: 6,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: DK.colors.border,
  },
  contactChangeText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted },
  contactEmpty: { gap: GRID.sm },
  contactEmptyText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, lineHeight: 18 },
  linkCustomerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: GRID.xs, paddingVertical: GRID.sm, paddingHorizontal: GRID.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: DK.colors.accent,
  },
  linkCustomerText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: DK.colors.accent },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 20,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.surfacePrimary,
  },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  contactDetail: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  contactAction: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "#0B0E11",
    borderRadius: RADIUS.md,
  },
  contactActionIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactActionLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: '#555',
  },

  // Route
  routeCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  routeAccent: {
    width: 4,
    backgroundColor: Palette.hermesOrange,
  },
  routeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md - 4,
    padding: GRID.md,
  },
  routeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeAddress: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    lineHeight: 20,
  },
  routeEta: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 3,
  },
  routeOpenBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Notes
  notesInput: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 20,
  },

  // Materials
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md - 4,
    paddingVertical: 10,
  },
  materialBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  materialIndicator: {
    width: 3,
    height: 28,
    borderRadius: 2,
  },
  materialInfo: { flex: 1 },
  materialName: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  materialDetail: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  materialCost: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textTertiary,
    fontVariant: ['tabular-nums'] as any,
  },
  reorderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Palette.hermesOrange + '10',
    paddingHorizontal: GRID.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  reorderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
  },
  reorderBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: GRID.md - 4,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  reorderBtnText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.surfacePrimary,
  },

  // Vasco guidance
  vascoGuidance: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  vascoGuidanceAccent: {
    width: 4,
    backgroundColor: Palette.hermesOrange,
  },
  vascoGuidanceContent: {
    flex: 1,
    padding: GRID.md - 4,
    gap: 6,
  },
  vascoGuidanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vascoGuidanceTitle: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
    letterSpacing: 0.3,
  },
  vascoGuidanceText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    lineHeight: 18,
  },

  // Upsell
  upsellBadge: {
    backgroundColor: Palette.pastelOrange + '30',
    paddingHorizontal: GRID.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  upsellBadgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.hermesOrange,
  },
  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md - 4,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 14,
  },
  upsellIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellInfo: { flex: 1 },
  upsellTitle: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  upsellDesc: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  upsellRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  upsellAmount: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.displayFamily,
    color: Palette.hermesOrange,
    fontVariant: ['tabular-nums'] as any,
  },
  confidenceBar: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: Palette.pastelOrange,
    borderRadius: 2,
  },
  upsellConfidence: {
    fontSize: 10,
    color: SemanticColors.textDisabled,
    fontFamily: TYPE.titleFamily,
  },

  // Pipeline Stepper
  pipelineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: GRID.sm,
  },
  pipelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pipelineDot: {
    width: 12,
    height: 12,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineDotActive: {
    width: 16,
    height: 16,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: SemanticColors.surfacePrimary,
  },
  pipelineLine: {
    width: GRID.md,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 2,
  },
  pipelineLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.sectionFamily,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Next Step Button
  nextStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingVertical: GRID.md - 4,
  },
  nextStepText: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.surfacePrimary,
  },

  // Cost Variance (P2)
  costGrid: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  costCol: {
    flex: 1,
    alignItems: 'center',
    gap: GRID.xs,
  },
  costColHeader: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
    letterSpacing: 0.3,
  },
  costColValue: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  marginBarContainer: {
    marginTop: GRID.md - 4,
    gap: GRID.xs,
  },
  marginBarBg: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  marginBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  marginBarLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    textAlign: 'right',
  },

  // Quick actions
  actionsBlock: {
    gap: 10,
  },
  actionsSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    backgroundColor: Palette.hermesOrange,
  },
  actionPrimaryText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.surfacePrimary,
  },
  actionSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  actionSecondaryText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
    // Was a hardcoded '#555' — near-invisible on the dark panel these buttons
    // sit on, and a design-system violation besides.
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },

  // Factureer button
  factureerButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: GRID.sm,
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    backgroundColor: '#8B5CF6',
  },
  factureerButtonText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.surfacePrimary,
  },

  // Photo Gallery
  galleryGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  galleryItem: {
    width: '30%' as any,
    aspectRatio: 1,
    position: 'relative' as const,
  },
  galleryThumb: {
    flex: 1,
    borderRadius: RADIUS.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  galleryLabel: {
    position: 'absolute' as const,
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: GRID.xs,
  },
  galleryLabelText: {
    fontSize: 10,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: 0.3,
  },
  galleryAddItem: {
    width: '30%' as any,
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: Palette.hermesOrange + '30',
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: GRID.xs,
  },
  galleryAddText: {
    fontSize: 10,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
    textAlign: 'center' as const,
  },

  // Audit Trail / Timeline
  timelineContainer: {
    paddingLeft: GRID.xs,
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row' as const,
    minHeight: 44,
  },
  timelineLeft: {
    width: 28,
    alignItems: 'center' as const,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: GRID.md - 4,
  },
  timelineLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  timelineDate: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  signatureBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  signatureSheet: {
    // Was Palette.white — a light sheet in a dark app, and `signatureTitle`
    // uses SemanticColors.textPrimary, which IS white here. Both sheets that
    // share this style rendered their heading white-on-white: "Ansprechpartner"
    // and "Kundenunterschrift" were invisible. The keyboard used to hide the
    // sheet entirely, which is why nobody saw it. SignaturePad brings its own
    // white canvas (SignaturePad.tsx:102), so signing is unaffected.
    // ui-playbook §1: a light background is a defect even when it looks fine.
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: GRID.lg,
    gap: GRID.md,
    paddingBottom: GRID.xl,
  },
  signatureTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  signatureSubtitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
  },
  siteInput: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
    marginTop: GRID.sm,
  },
  siteSaveBtn: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: GRID.md,
  },
  siteSaveText: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: Palette.white },
  signatureCancel: {
    alignSelf: 'center',
    paddingVertical: GRID.sm,
    paddingHorizontal: GRID.lg,
  },
  signatureCancelText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
});
