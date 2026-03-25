// =============================================================================
// JOB DETAIL — Full Job View for Contractors
// =============================================================================
// Pro-grade job detail with orange accents, shadow cards, route planner,
// client contact, notes, material predictions, and upsell opportunities
// =============================================================================

import { useState, useMemo, useRef, useCallback } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Palette } from '../../../src/theme/colors';
import { SafeArea } from '../../../src/theme/spacing';
import { hapticSuccess } from '../../../src/utils/haptics';
import { useClockIn } from '../../../src/services/clockInService';
import { smartSchedulerService, LIFECYCLE_ORDER, LIFECYCLE_LABELS, LIFECYCLE_COLORS, LIFECYCLE_NEXT_ACTION, useJobLifecyclePipeline } from '../../../src/services/smartSchedulerService';
import type { JobLifecycleStatus } from '../../../src/services/smartSchedulerService';
import { useJobCostVariance } from '../../../src/services/jobCostTrackingService';
import { useAppState } from '../../../src/state/AppState';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// MOCK DATA for enriched job details
// TODO: Replace with real data from API/AppState. Strings below are placeholder
// Dutch text for demo purposes — will be replaced when connected to real backend.
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

const MOCK_CONTACTS: Record<string, ClientContact> = {
  'cust_t1': { name: 'Familie Smit', phone: '+31 6 12345678', email: 'smit@email.nl' },
  'cust_t2': { name: 'M. van der Berg', phone: '+31 6 87654321', email: 'mvdberg@email.nl' },
  'cust_t3': { name: 'Bakkerij Jansen', phone: '+31 6 11223344', email: 'info@jansen.nl' },
  'cust_1': { name: 'Familie de Vries', phone: '+31 6 99887766', email: 'devries@email.nl' },
  'cust_2': { name: 'Bakkerij Jansen', phone: '+31 6 11223344', email: 'info@jansen.nl' },
  'cust_3': { name: 'Peter van den Berg', phone: '+31 6 55443322', email: 'peter@vdberg.nl' },
  'cust_4': { name: 'Sandra Bakker', phone: '+31 6 66778899', email: 'sandra@bakker.nl' },
};

// TODO: Replace with real upsell suggestions from ontology service
const MOCK_UPSELLS: Record<string, UpsellItem[]> = {
  'job_today_1': [
    { id: 'u1', title: 'Thermostaat upgrade', description: 'Slimme thermostaat bij CV-onderhoud', potentialRevenue: 285, confidence: 78, icon: 'thermometer' },
    { id: 'u2', title: 'Onderhoudscontract', description: 'Jaarlijks onderhoud aanbieden', potentialRevenue: 120, confidence: 85, icon: 'shield-checkmark' },
  ],
  'job_today_2': [
    { id: 'u3', title: 'Waterdicht maken', description: 'Preventief afdichten na lekkagereparatie', potentialRevenue: 450, confidence: 72, icon: 'water' },
  ],
  'job_today_3': [
    { id: 'u4', title: 'Inductiekookplaat', description: 'Elektrische aansluiting voor inductie', potentialRevenue: 380, confidence: 65, icon: 'flash' },
    { id: 'u5', title: 'LED verlichting', description: 'Keukenverlichting vervangen', potentialRevenue: 220, confidence: 70, icon: 'bulb' },
  ],
};

const MOCK_MATERIALS: Record<string, MaterialPrediction[]> = {
  'job_today_1': [
    { id: 'm1', name: 'CV-filter 3/4"', quantity: '2 stuks', inStock: true, reorderNeeded: false, estimatedCost: 12.50, supplier: 'Breman' },
    { id: 'm2', name: 'O-ringen set', quantity: '1 set', inStock: true, reorderNeeded: false, estimatedCost: 8.90, supplier: 'Bouwmaat' },
    { id: 'm3', name: 'Expansievat 8L', quantity: '1 stuk', inStock: false, reorderNeeded: true, estimatedCost: 45.00, supplier: 'Technische Unie' },
  ],
  'job_today_2': [
    { id: 'm4', name: 'PVC buis 40mm', quantity: '2m', inStock: true, reorderNeeded: false, estimatedCost: 6.80, supplier: 'Bouwmaat' },
    { id: 'm5', name: 'Siliconenkit sanitair', quantity: '1 tube', inStock: true, reorderNeeded: true, estimatedCost: 9.50, supplier: 'Bouwmaat' },
    { id: 'm6', name: 'Manchet 40/50', quantity: '2 stuks', inStock: false, reorderNeeded: true, estimatedCost: 4.20, supplier: 'Technische Unie' },
  ],
  'job_today_3': [
    { id: 'm7', name: 'Meetinstrument', quantity: '1 stuk', inStock: true, reorderNeeded: false, estimatedCost: 0, supplier: '-' },
  ],
};

// ============================================
// MAIN SCREEN
// ============================================

export default function JobDetailPage() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const timer = useClockIn();
  const clockedIn = timer.active && timer.jobId === id;
  const [photoCount, setPhotoCount] = useState(0);
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

  const job = useMemo(() => smartSchedulerService.getJob(id || ''), [id]);
  const { advance, recordHours } = useJobLifecyclePipeline();
  const costVariance = useJobCostVariance(id || '');
  const { addInvoiceFromJob, jobs, invoices, quotes } = useAppState();

  // Build audit trail from real data
  const auditTrail = useMemo(() => {
    const appJob = jobs.find((j: any) => j.id === id);
    if (!appJob) return [];
    const events: { icon: IconName; label: string; date: string; color: string }[] = [];
    if (appJob.createdAt) events.push({ icon: 'add-circle-outline', label: 'Job created', date: appJob.createdAt, color: '#94A3B8' });
    if (appJob.quoteId) {
      const q = quotes.find((qu: any) => qu.id === appJob.quoteId);
      if (q?.lastUpdated) events.push({ icon: 'document-text-outline', label: 'Quote sent', date: q.lastUpdated, color: '#F59E0B' });
    }
    if (appJob.scheduledDate) events.push({ icon: 'calendar-outline', label: 'Scheduled', date: appJob.scheduledDate, color: '#8B5CF6' });
    if (appJob.status === 'in-progress' || appJob.status === 'completed' || appJob.status === 'invoiced' || appJob.status === 'paid')
      events.push({ icon: 'play-circle-outline', label: 'Work started', date: appJob.updatedAt || appJob.createdAt, color: '#E35205' });
    if (appJob.completedAt) events.push({ icon: 'checkmark-circle-outline', label: 'Completed', date: appJob.completedAt, color: '#16A34A' });
    if (appJob.invoiceId) {
      const inv = invoices.find((i: any) => i.id === appJob.invoiceId || i.job === appJob.title);
      if (inv) events.push({ icon: 'receipt-outline', label: `Invoiced €${(inv.amount || 0).toLocaleString()}`, date: inv.lastUpdated || inv.dueDate || '', color: '#0EA5E9' });
      if (inv?.status === 'paid') events.push({ icon: 'cash-outline', label: 'Paid', date: inv.lastUpdated || '', color: '#059669' });
    }
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }, [id, jobs, invoices, quotes]);

  // Show cost section for jobs that are bezig or later
  const showCostSection = job && ['bezig', 'gereed', 'gefactureerd', 'betaald'].includes(job.lifecycleStatus);

  if (!job) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('jobs.notFound', 'Job not found')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color="#CCC" />
          <Text style={styles.emptyText}>{t('jobs.notFoundDesc', 'This job could not be found')}</Text>
        </View>
      </View>
    );
  }

  const contact = MOCK_CONTACTS[job.customerId] || { name: job.customerName, phone: '+31 6 00000000', email: 'info@klant.nl' };
  const upsells = MOCK_UPSELLS[job.id] || [];
  const materials = MOCK_MATERIALS[job.id] || [];
  const reorderItems = materials.filter(m => m.reorderNeeded);

  const startTime = new Date(job.startTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(job.endTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const getStatusLabel = () => {
    switch (job.status) {
      case 'in_progress': return t('jobs.statusInProgress', 'In progress');
      case 'completed': return t('jobs.statusCompleted', 'Completed');
      case 'cancelled': return t('jobs.statusCancelled', 'Cancelled');
      default: return t('jobs.statusScheduled', 'Scheduled');
    }
  };
  const getStatusColor = () => {
    switch (job.status) {
      case 'in_progress': return '#16A34A';
      case 'completed': return '#3B82F6';
      case 'cancelled': return '#DC2626';
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
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{job.projectName}</Text>
        <Pressable style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#777" />
        </Pressable>
      </View>

      {/* Orange accent line */}
      <View style={styles.headerAccent} />

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
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '14' }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusLabel()}</Text>
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{getTypeLabel()}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{job.projectName}</Text>
          <View style={styles.heroDetails}>
            <View style={styles.heroDetailItem}>
              <View style={styles.heroDetailIcon}>
                <Ionicons name="time" size={14} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.heroDetailText}>{startTime} – {endTime}</Text>
              <View style={styles.durationChip}>
                <Text style={styles.durationText}>{job.duration} min</Text>
              </View>
            </View>
            <View style={styles.heroDetailItem}>
              <View style={styles.heroDetailIcon}>
                <Ionicons name="location" size={14} color={Palette.hermesOrange} />
              </View>
              <Text style={styles.heroDetailText} numberOfLines={2}>{job.address}</Text>
            </View>
            {job.travelTime && (
              <View style={styles.heroDetailItem}>
                <View style={styles.heroDetailIcon}>
                  <Ionicons name="car" size={14} color={Palette.hermesOrange} />
                </View>
                <Text style={styles.heroDetailText}>{job.travelTime} {t('jobs.minTravelTime', 'min travel')}</Text>
              </View>
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
                ? '#16A34A'
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
                    <View style={[styles.pipelineLine, isDone && { backgroundColor: '#16A34A' }]} />
                  )}
                </View>
              );
            })}
          </View>
          <Text style={[styles.pipelineLabel, { color: LIFECYCLE_COLORS[job.lifecycleStatus] }]}>
            {LIFECYCLE_LABELS[job.lifecycleStatus]}
          </Text>
        </View>

        {/* Volgende stap action */}
        {LIFECYCLE_NEXT_ACTION[job.lifecycleStatus] && (
          <Pressable
            style={styles.nextStepButton}
            onPress={() => {
              Alert.alert(
                t('jobs.updateStatus', 'Update status'),
                t('jobs.updateStatusDesc', { defaultValue: 'Change status to "{{status}}"?', status: LIFECYCLE_LABELS[LIFECYCLE_ORDER[LIFECYCLE_ORDER.indexOf(job.lifecycleStatus) + 1]] }),
                [
                  { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                  { text: t('common.confirm', 'Confirm'), onPress: () => {
                    advance(job.id);
                    if (job.lifecycleStatus === 'gereed') {
                      router.push('/(contractor)/facturen' as any);
                    }
                  }},
                ]
              );
            }}
          >
            <Ionicons name="arrow-forward-circle" size={18} color="#fff" />
            <Text style={styles.nextStepText}>{LIFECYCLE_NEXT_ACTION[job.lifecycleStatus]}</Text>
          </Pressable>
        )}

        {/* ============================================ */}
        {/* 2. CLIENT CONTACT                           */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('jobs.client', 'Client')}</Text>
          <View style={styles.card}>
            <View style={styles.contactRow}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {contact.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactDetail}>{contact.phone}</Text>
              </View>
            </View>
            <View style={styles.contactActions}>
              <Pressable
                style={styles.contactAction}
                onPress={() => Linking.openURL(`tel:${contact.phone}`)}
              >
                <View style={[styles.contactActionIcon, { backgroundColor: '#16A34A14' }]}>
                  <Ionicons name="call" size={16} color="#16A34A" />
                </View>
                <Text style={styles.contactActionLabel}>{t('jobs.call', 'Call')}</Text>
              </Pressable>
              <Pressable
                style={styles.contactAction}
                onPress={() => Linking.openURL(`https://wa.me/${contact.phone.replace(/\s+/g, '').replace('+', '')}`)}
              >
                <View style={[styles.contactActionIcon, { backgroundColor: '#25D36614' }]}>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                </View>
                <Text style={styles.contactActionLabel}>WhatsApp</Text>
              </Pressable>
              <Pressable
                style={styles.contactAction}
                onPress={() => Linking.openURL(`mailto:${contact.email}`)}
              >
                <View style={[styles.contactActionIcon, { backgroundColor: Palette.hermesOrange + '14' }]}>
                  <Ionicons name="mail" size={16} color={Palette.hermesOrange} />
                </View>
                <Text style={styles.contactActionLabel}>{t('jobs.email', 'Email')}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* 3. ROUTE PLANNER                            */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('jobs.route', 'Route')}</Text>
          <Pressable
            style={styles.routeCard}
            onPress={() => {
              const address = encodeURIComponent(job.address);
              Linking.openURL(`https://maps.apple.com/?daddr=${address}`);
            }}
          >
            <View style={styles.routeAccent} />
            <View style={styles.routeContent}>
              <View style={styles.routeIconWrap}>
                <Ionicons name="navigate" size={20} color={Palette.hermesOrange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeAddress} numberOfLines={2}>{job.address}</Text>
                {job.travelTime && (
                  <Text style={styles.routeEta}>~{job.travelTime} {t('jobs.minDrive', 'min drive')}</Text>
                )}
              </View>
              <View style={styles.routeOpenBtn}>
                <Ionicons name="open-outline" size={16} color={Palette.hermesOrange} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* ============================================ */}
        {/* 4. JOB NOTES                                */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('jobs.notes', 'Notes')}</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.notesInput}
              placeholder={t('jobs.notesPlaceholder', 'Type your notes here...')}
              placeholderTextColor="#CCC"
              multiline
              value={notes || job.notes || ''}
              onChangeText={setNotes}
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
                    backgroundColor: mat.inStock ? '#16A34A' : '#DC2626',
                  }]} />
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName}>{mat.name}</Text>
                    <Text style={styles.materialDetail}>{mat.quantity} · {mat.supplier}</Text>
                  </View>
                  {mat.reorderNeeded && !orderedMaterials.has(mat.id) ? (
                    <Pressable
                      style={styles.reorderBtn}
                      onPress={() => {
                        setOrderedMaterials(prev => new Set(prev).add(mat.id));
                        Alert.alert(t('jobs.ordered', 'Ordered'), t('jobs.orderedDesc', { defaultValue: '{{name}} has been ordered from {{supplier}}.', name: mat.name, supplier: mat.supplier }));
                      }}
                    >
                      <Ionicons name="cart" size={13} color="#fff" />
                      <Text style={styles.reorderBtnText}>{t('jobs.order', 'Order')}</Text>
                    </Pressable>
                  ) : mat.reorderNeeded && orderedMaterials.has(mat.id) ? (
                    <View style={[styles.reorderBtn, { backgroundColor: '#16A34A' }]}>
                      <Ionicons name="checkmark" size={13} color="#fff" />
                      <Text style={styles.reorderBtnText}>{t('jobs.ordered', 'Ordered')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.materialCost}>€{mat.estimatedCost.toFixed(2)}</Text>
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
                  <Text style={styles.costColValue}>{'\u20AC'}{costVariance.estimatedTotal.toLocaleString(undefined)}</Text>
                </View>
                <View style={styles.costCol}>
                  <Text style={styles.costColHeader}>{t('jobs.actual', 'Actual')}</Text>
                  <Text style={styles.costColValue}>{'\u20AC'}{costVariance.actualTotal.toLocaleString(undefined)}</Text>
                </View>
                <View style={styles.costCol}>
                  <Text style={styles.costColHeader}>{t('jobs.variance', 'Variance')}</Text>
                  <Text style={[
                    styles.costColValue,
                    { color: costVariance.marginDelta <= 0 ? '#16A34A' : '#DC2626' }
                  ]}>
                    {costVariance.marginDelta > 0 ? '+' : ''}{'\u20AC'}{costVariance.marginDelta.toLocaleString(undefined)}
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
                      backgroundColor: costVariance.marginDelta <= 0 ? '#16A34A' : costVariance.marginPercent > 10 ? '#DC2626' : '#F59E0B',
                    }
                  ]} />
                </View>
                <Text style={[
                  styles.marginBarLabel,
                  { color: costVariance.marginDelta <= 0 ? '#16A34A' : '#DC2626' }
                ]}>
                  {costVariance.marginDelta <= 0 ? t('jobs.underBudget', 'Under budget') : `${costVariance.marginPercent.toFixed(0)}% ${t('jobs.over', 'over')}`}
                </Text>
              </View>
            </View>
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
                <Text style={styles.upsellBadgeText}>€{upsells.reduce((s, u) => s + u.potentialRevenue, 0)}</Text>
              </View>
            </View>
            {upsells.map((item) => (
              <Pressable
                key={item.id}
                style={styles.upsellCard}
                onPress={() => Alert.alert(
                  item.title,
                  `${item.description}\n\n${t('jobs.estRevenue', 'Est. revenue')}: €${item.potentialRevenue}\n${t('jobs.confidence', 'Confidence')}: ${item.confidence}%`,
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
                  <Text style={styles.upsellDesc} numberOfLines={1}>{item.description}</Text>
                </View>
                <View style={styles.upsellRight}>
                  <Text style={styles.upsellAmount}>€{item.potentialRevenue}</Text>
                  <View style={styles.confidenceBar}>
                    <View style={[styles.confidenceFill, { width: `${item.confidence}%` }]} />
                  </View>
                  <Text style={styles.upsellConfidence}>{item.confidence}%</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* ============================================ */}
        {/* 7. AUDIT TRAIL — Job lifecycle timeline     */}
        {/* ============================================ */}
        {auditTrail.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Timeline</Text>
            <View style={styles.timelineContainer}>
              {auditTrail.map((event, idx) => (
                <View key={idx} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: event.color }]}>
                      <Ionicons name={event.icon} size={12} color="#fff" />
                    </View>
                    {idx < auditTrail.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineLabel}>{event.label}</Text>
                    <Text style={styles.timelineDate}>
                      {event.date.length > 10
                        ? new Date(event.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                        : event.date}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ============================================ */}
        {/* 8. QUICK ACTIONS                            */}
        {/* ============================================ */}
        <View style={styles.actionsRow}>
          {!jobCompleted && (
            <Pressable
              style={[styles.actionPrimary, clockedIn && { backgroundColor: '#DC2626' }]}
              onPress={async () => {
                hapticSuccess();
                if (clockedIn) {
                  const { hours } = await timer.clockOut();
                  recordHours(job.id, Math.round(hours * 10) / 10);
                  Alert.alert(t('jobs.clockedOut', 'Clocked out'), t('jobs.clockedOutDesc', 'You have been clocked out. Hours saved.'));
                } else {
                  await timer.clockIn(job.id, job.projectName || job.customerName || '');
                  Alert.alert(t('jobs.clockedIn', 'Clocked in'), t('jobs.clockedInDesc', 'You are now clocked in on this job.'));
                }
              }}
            >
              <Ionicons name={clockedIn ? 'stop' : 'play'} size={18} color="#fff" />
              <Text style={styles.actionPrimaryText}>{clockedIn ? t('jobs.clockOut', 'Clock out') : t('jobs.clockIn', 'Clock in')}</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.actionSecondary}
            onPress={() => {
              hapticSuccess();
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowGallery(prev => !prev);
              if (!showGallery) {
                setPhotoCount(prev => prev + 1);
                Alert.alert(t('jobs.photoSaved', 'Photo saved'), t('jobs.photoSavedDesc', { defaultValue: 'Photo {{count}} added to evidence.', count: photoCount + 1 }));
              }
            }}
          >
            <Ionicons name="camera" size={18} color={Palette.hermesOrange} />
            <Text style={styles.actionSecondaryText}>{t('jobs.photo', 'Photo')}{photoCount > 0 ? ` (${photoCount})` : ''}</Text>
          </Pressable>
          {!jobCompleted ? (
            <Pressable
              style={styles.actionSecondary}
              onPress={() => {
                Alert.alert(t('jobs.completeJob', 'Complete job'), t('jobs.completeJobConfirm', 'Are you sure you want to complete this job?'), [
                  { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                  { text: t('jobs.complete', 'Complete'), onPress: () => {
                    hapticSuccess();
                    if (clockedIn) timer.clockOut();
                    setJobCompleted(true);
                  }},
                ]);
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              <Text style={styles.actionSecondaryText}>{t('jobs.done', 'Done')}</Text>
            </Pressable>
          ) : (
            <View style={[styles.actionSecondary, { backgroundColor: '#16A34A14' }]}>
              <Ionicons name="checkmark-done" size={18} color="#16A34A" />
              <Text style={[styles.actionSecondaryText, { color: '#16A34A' }]}>{t('jobs.statusCompleted', 'Completed')}</Text>
            </View>
          )}
        </View>

        {/* ============================================ */}
        {/* 7b. FACTUREER BUTTON (gereed jobs)          */}
        {/* ============================================ */}
        {job.lifecycleStatus === 'gereed' && (
          <Pressable
            style={styles.factureerButton}
            onPress={async () => {
              hapticSuccess();
              try {
                await addInvoiceFromJob(job.id);
              } catch (_) { /* ignore if fails */ }
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
              <Text style={{ fontSize: 13, color: '#16A34A', fontWeight: '600', marginBottom: 4 }}>
                {t('jobs.photosCaptured', { defaultValue: '{{count}} photos captured', count: photoCount })}
              </Text>
            )}
            <View style={styles.galleryGrid}>
              {Array.from({ length: Math.min(photoCount, 6) }).map((_, idx) => (
                <View key={idx} style={styles.galleryItem}>
                  <View style={[styles.galleryThumb, { backgroundColor: idx < Math.ceil(photoCount / 2) ? '#E8E4DF' : '#D4EDDA' }]}>
                    <Ionicons name="image" size={24} color={idx < Math.ceil(photoCount / 2) ? '#999' : '#16A34A'} />
                  </View>
                  <View style={[styles.galleryLabel, { backgroundColor: idx < Math.ceil(photoCount / 2) ? '#F5F5F5' : '#16A34A14' }]}>
                    <Text style={[styles.galleryLabelText, { color: idx < Math.ceil(photoCount / 2) ? '#777' : '#16A34A' }]}>
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

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: SafeArea.top,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
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
    marginHorizontal: 16,
    borderRadius: 2,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },

  // Hero card
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  heroTop: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
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
    borderRadius: 8,
    backgroundColor: Palette.hermesOrange + '0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDetailText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  durationChip: {
    backgroundColor: Palette.pastelOrange + '30',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },

  // Section
  section: { gap: 8 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.8,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },

  // Contact
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  contactDetail: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  contactAction: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
  },
  contactActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
  },

  // Route
  routeCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
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
    gap: 12,
    padding: 16,
  },
  routeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  routeEta: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
  },
  routeOpenBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Notes
  notesInput: {
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 20,
  },

  // Materials
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  materialDetail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  materialCost: {
    fontSize: 13,
    fontWeight: '700',
    color: '#777',
    fontVariant: ['tabular-nums'] as any,
  },
  reorderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Palette.hermesOrange + '10',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reorderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
  },
  reorderBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  reorderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // Vasco guidance
  vascoGuidance: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  vascoGuidanceAccent: {
    width: 4,
    backgroundColor: Palette.hermesOrange,
  },
  vascoGuidanceContent: {
    flex: 1,
    padding: 12,
    gap: 6,
  },
  vascoGuidanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vascoGuidanceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.hermesOrange,
    letterSpacing: 0.3,
  },
  vascoGuidanceText: {
    fontSize: 13,
    color: '#777',
    lineHeight: 18,
  },

  // Upsell
  upsellBadge: {
    backgroundColor: Palette.pastelOrange + '30',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  upsellBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },
  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  upsellIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellInfo: { flex: 1 },
  upsellTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  upsellDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  upsellRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  upsellAmount: {
    fontSize: 15,
    fontWeight: '800',
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
    color: '#BBB',
    fontWeight: '600',
  },

  // Pipeline Stepper
  pipelineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  pipelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pipelineDot: {
    width: 12,
    height: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineDotActive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  pipelineLine: {
    width: 16,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 2,
  },
  pipelineLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Next Step Button
  nextStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 12,
    paddingVertical: 12,
  },
  nextStepText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // Cost Variance (P2)
  costGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  costCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  costColHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.3,
  },
  costColValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    fontVariant: ['tabular-nums'] as any,
  },
  marginBarContainer: {
    marginTop: 12,
    gap: 4,
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
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Quick actions
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: Palette.hermesOrange,
  },
  actionPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  actionSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  actionSecondaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
  },

  // Factureer button
  factureerButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
  },
  factureerButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
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
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  galleryLabel: {
    position: 'absolute' as const,
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  galleryLabelText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  galleryAddItem: {
    width: '30%' as any,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Palette.hermesOrange + '30',
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  galleryAddText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Palette.hermesOrange,
    textAlign: 'center' as const,
  },

  // Audit Trail / Timeline
  timelineContainer: {
    paddingLeft: 4,
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
    paddingBottom: 12,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1A1A1A',
  },
  timelineDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
});
