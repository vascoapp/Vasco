// =============================================================================
// SITE LEAD DASHBOARD
// =============================================================================
// Site execution focus: Safety, Quality, Progress, Constraints
// Orange/terracotta color scheme for site-level operations
// 4-tab navigation for focused site management views
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import {
  mockProjects,
  mockSiteMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  formatCurrency,
  formatPercent,
  getCurrencyForCountry,
} from '../../modules/countryModules';

type IconName = keyof typeof Ionicons.glyphMap;
export type SiteLeadTabView = 'overview' | 'dispatch' | 'safety' | 'quality' | 'issues';
type TabView = SiteLeadTabView;

// =============================================================================
// SERVICETITAN-STYLE DISPATCH TYPES & DATA
// =============================================================================

type WorkerStatus = 'available' | 'traveling' | 'on-job' | 'break' | 'sick';
type JobStatus = 'unassigned' | 'scheduled' | 'in-progress' | 'completed';
type JobPriority = 'urgent' | 'high' | 'normal' | 'low';

interface DispatchWorker {
  id: string;
  name: string;
  initials: string;
  trade: string;
  status: WorkerStatus;
  currentJob?: string;
  skills: string[];
  rating: number;
  completedToday: number;
}

interface DispatchJob {
  id: string;
  title: string;
  customer: string;
  address: string;
  time: string;
  duration: number;
  status: JobStatus;
  priority: JobPriority;
  assignedTo?: string;
  requiredSkills: string[];
  jobType: string;
  notes?: string;
}

const MOCK_WORKERS: DispatchWorker[] = [
  { id: 'w1', name: 'Mohammed Al-Rashid', initials: 'MA', trade: 'Elektricien', status: 'on-job', currentJob: 'j2', skills: ['NEN-1010', 'Zonnepanelen'], rating: 4.9, completedToday: 2 },
  { id: 'w2', name: 'Pieter de Groot', initials: 'PG', trade: 'Loodgieter', status: 'traveling', currentJob: 'j3', skills: ['CV-installatie', 'Sanitair'], rating: 4.5, completedToday: 1 },
  { id: 'w3', name: 'Erik Jansen', initials: 'EJ', trade: 'Timmerman', status: 'available', skills: ['Kozijnen', 'Afbouw'], rating: 4.6, completedToday: 1 },
  { id: 'w4', name: 'Lisa Bakker', initials: 'LB', trade: 'Schilder', status: 'available', skills: ['Binnen', 'Buiten'], rating: 4.7, completedToday: 0 },
  { id: 'w5', name: 'Jan van Bergen', initials: 'JB', trade: 'Elektricien', status: 'sick', skills: ['NEN-1010'], rating: 4.8, completedToday: 0 },
  { id: 'w6', name: 'Sandra Visser', initials: 'SV', trade: 'Loodgieter', status: 'break', skills: ['Warmtepomp', 'CV-installatie'], rating: 4.4, completedToday: 2 },
];

const MOCK_JOBS: DispatchJob[] = [
  { id: 'j1', title: 'Meterkast vervangen', customer: 'Fam. Jansen', address: 'Prinsengracht 245', time: '08:00', duration: 180, status: 'unassigned', priority: 'urgent', requiredSkills: ['NEN-1010'], jobType: 'Elektra', notes: 'SPOED - Klant zonder stroom' },
  { id: 'j2', title: 'Zonnepanelen aansluiten', customer: 'Hr. Smit', address: 'Amstel 42', time: '09:00', duration: 240, status: 'in-progress', priority: 'high', assignedTo: 'w1', requiredSkills: ['Zonnepanelen'], jobType: 'Elektra' },
  { id: 'j3', title: 'Lekkage badkamer', customer: 'Mevr. De Vries', address: 'Damrak 89', time: '09:30', duration: 120, status: 'in-progress', priority: 'urgent', assignedTo: 'w2', requiredSkills: ['Sanitair'], jobType: 'Loodgieter', notes: 'Waterschade!' },
  { id: 'j4', title: 'CV-ketel onderhoud', customer: 'Van Dijk BV', address: 'Weesperstraat 120', time: '11:00', duration: 60, status: 'scheduled', priority: 'normal', assignedTo: 'w6', requiredSkills: ['CV-installatie'], jobType: 'Loodgieter' },
  { id: 'j5', title: 'Kozijnen plaatsen', customer: 'Renovatie Zuid', address: 'Beethovenstraat 45', time: '13:00', duration: 300, status: 'unassigned', priority: 'normal', requiredSkills: ['Kozijnen'], jobType: 'Timmerman' },
  { id: 'j6', title: 'Schilderwerk kantoor', customer: 'ABC Consulting', address: 'Zuidas 100', time: '14:00', duration: 360, status: 'unassigned', priority: 'low', requiredSkills: ['Binnen'], jobType: 'Schilder' },
];

// Role color - matches theme roleSiteLead token
const SITE_LEAD_COLOR = '#D2691E'; // Terracotta for Site Lead (per theme)

// =============================================================================
// UI GUIDANCE TYPES & DATA
// =============================================================================

interface UIGuidanceTip {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  action?: { label: string; tab?: TabView };
  dismissible: boolean;
}

interface ProgressMilestone {
  id: string;
  title: string;
  icon: IconName;
  completed: boolean;
  current?: boolean;
}

const SITELEAD_ONBOARDING_TIPS: UIGuidanceTip[] = [
  {
    id: 'sl-1',
    title: 'Welkom, Site Lead!',
    description: 'Beheer veiligheid, kwaliteit en voortgang van je bouwproject. Bekijk de belangrijkste metrics in één oogopslag.',
    icon: 'sparkles',
    dismissible: false,
  },
  {
    id: 'sl-2',
    title: 'Veiligheid eerst',
    description: 'Log incidenten, near-misses en voer toolbox talks uit. Houd je LTIR laag voor een veilige werkplek.',
    icon: 'shield-checkmark',
    action: { label: 'Naar Veiligheid', tab: 'safety' },
    dismissible: true,
  },
  {
    id: 'sl-3',
    title: 'Kwaliteitscontrole',
    description: 'Registreer gebreken met foto\'s en volg de afhandeling. Hoge closure rate = tevreden opdrachtgever.',
    icon: 'checkmark-done-circle',
    action: { label: 'Naar Kwaliteit', tab: 'quality' },
    dismissible: true,
  },
  {
    id: 'sl-4',
    title: 'RFI\'s & Risico\'s',
    description: 'Stel vragen aan ontwerpers, escaleer issues en beheer risico\'s voordat ze problemen worden.',
    icon: 'help-circle',
    action: { label: 'Naar Issues', tab: 'issues' },
    dismissible: true,
  },
];

const SITELEAD_MILESTONES: ProgressMilestone[] = [
  { id: 'pm-1', title: 'Dashboard bekeken', icon: 'checkmark-circle', completed: true },
  { id: 'pm-2', title: 'Project geselecteerd', icon: 'business', completed: true },
  { id: 'pm-3', title: 'Veiligheid bekeken', icon: 'shield-checkmark', completed: false, current: true },
  { id: 'pm-4', title: 'Incident gelogd', icon: 'warning', completed: false },
  { id: 'pm-5', title: 'Kwaliteit bekeken', icon: 'ribbon', completed: false },
];

const SITELEAD_QUICK_ACTIONS = [
  { id: 'qa-1', icon: 'people' as IconName, title: 'Dispatch', subtitle: 'Planning', tab: 'dispatch' as TabView },
  { id: 'qa-2', icon: 'shield-checkmark' as IconName, title: 'Veiligheid', subtitle: 'Incidenten', tab: 'safety' as TabView },
  { id: 'qa-3', icon: 'ribbon' as IconName, title: 'Kwaliteit', subtitle: 'Gebreken', tab: 'quality' as TabView },
  { id: 'qa-4', icon: 'warning' as IconName, title: 'Issues', subtitle: 'RFI & Risico', tab: 'issues' as TabView },
];

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface MetricTileProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  alert?: boolean;
}

function MetricTile({ label, value, subtitle, trend, alert }: MetricTileProps) {
  return (
    <View style={[styles.metricTile, alert && styles.metricTileAlert]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, alert && styles.metricValueAlert]}>
          {value}
        </Text>
        {trend && (
          <Ionicons
            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
            size={16}
            color={trend === 'up' ? Palette.success : trend === 'down' ? Palette.error : SemanticColors.textTertiary}
          />
        )}
      </View>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );
}

interface QuickActionProps {
  icon: IconName;
  label: string;
  badge?: number;
  onPress: () => void;
}

function QuickAction({ icon, label, badge, onPress }: QuickActionProps) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIconWrap}>
        <Ionicons name={icon} size={22} color={SITE_LEAD_COLOR} />
        {badge !== undefined && badge > 0 && (
          <View style={styles.quickActionBadge}>
            <Text style={styles.quickActionBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

interface StatusPillProps {
  label: string;
  count: number;
  color: string;
}

function StatusPill({ label, count, color }: StatusPillProps) {
  return (
    <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
      <Text style={[styles.statusPillCount, { color }]}>{count}</Text>
      <Text style={styles.statusPillLabel}>{label}</Text>
    </View>
  );
}

// =============================================================================
// UI GUIDANCE COMPONENTS
// =============================================================================

function OnboardingCarousel({ tips, currentIndex, onNext, onPrev, onDismiss, onAction }: {
  tips: UIGuidanceTip[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: (id: string) => void;
  onAction: (tab: TabView) => void;
}) {
  const tip = tips[currentIndex];
  if (!tip) return null;

  return (
    <View style={styles.onboardingCard}>
      <View style={styles.onboardingHeader}>
        <View style={styles.onboardingIconWrap}>
          <Ionicons name={tip.icon} size={24} color={SITE_LEAD_COLOR} />
        </View>
        <View style={styles.onboardingDots}>
          {tips.map((_, idx) => (
            <View
              key={idx}
              style={[styles.onboardingDot, idx === currentIndex && styles.onboardingDotActive]}
            />
          ))}
        </View>
        {tip.dismissible && (
          <Pressable onPress={() => onDismiss(tip.id)} hitSlop={8}>
            <Ionicons name="close" size={20} color={SemanticColors.textTertiary} />
          </Pressable>
        )}
      </View>

      <Text style={styles.onboardingTitle}>{tip.title}</Text>
      <Text style={styles.onboardingDesc}>{tip.description}</Text>

      <View style={styles.onboardingActions}>
        {currentIndex > 0 && (
          <Pressable style={styles.onboardingPrev} onPress={onPrev}>
            <Ionicons name="chevron-back" size={18} color={SemanticColors.textSecondary} />
            <Text style={styles.onboardingPrevText}>Vorige</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {tip.action ? (
          <Pressable style={styles.onboardingActionBtn} onPress={() => tip.action?.tab && onAction(tip.action.tab)}>
            <Text style={styles.onboardingActionText}>{tip.action.label}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        ) : currentIndex < tips.length - 1 ? (
          <Pressable style={styles.onboardingNext} onPress={onNext}>
            <Text style={styles.onboardingNextText}>Volgende</Text>
            <Ionicons name="chevron-forward" size={18} color={SITE_LEAD_COLOR} />
          </Pressable>
        ) : (
          <Pressable style={styles.onboardingActionBtn} onPress={() => onDismiss(tip.id)}>
            <Text style={styles.onboardingActionText}>Start</Text>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ProgressTracker({ milestones, onPress }: {
  milestones: ProgressMilestone[];
  onPress: (m: ProgressMilestone) => void;
}) {
  const completed = milestones.filter(m => m.completed).length;
  const percent = (completed / milestones.length) * 100;

  return (
    <View style={styles.progressTrackerCard}>
      <View style={styles.progressTrackerHeader}>
        <View style={styles.progressTrackerTitleRow}>
          <Ionicons name="trophy" size={18} color={SITE_LEAD_COLOR} />
          <Text style={styles.progressTrackerTitle}>Site Lead Training</Text>
        </View>
        <Text style={styles.progressTrackerPercent}>{Math.round(percent)}%</Text>
      </View>

      <View style={styles.progressTrackerBar}>
        <View style={[styles.progressTrackerFill, { width: `${percent}%` }]} />
      </View>

      <View style={styles.progressTrackerMilestones}>
        {milestones.map((m, idx) => (
          <Pressable key={m.id} style={styles.milestoneItem} onPress={() => !m.completed && onPress(m)}>
            <View style={[
              styles.milestoneIcon,
              m.completed && styles.milestoneIconDone,
              m.current && styles.milestoneIconCurrent,
            ]}>
              {m.completed ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Ionicons name={m.icon} size={12} color={m.current ? SITE_LEAD_COLOR : SemanticColors.textTertiary} />
              )}
            </View>
            {idx < milestones.length - 1 && (
              <View style={[styles.milestoneLine, m.completed && styles.milestoneLineDone]} />
            )}
          </Pressable>
        ))}
      </View>

      {milestones.find(m => m.current) && (
        <View style={styles.currentMilestone}>
          <Ionicons name="arrow-forward-circle" size={16} color={SITE_LEAD_COLOR} />
          <Text style={styles.currentMilestoneText}>
            Volgende: {milestones.find(m => m.current)?.title}
          </Text>
        </View>
      )}
    </View>
  );
}

function WhatNextCard({ actions, onAction }: {
  actions: typeof SITELEAD_QUICK_ACTIONS;
  onAction: (tab: TabView) => void;
}) {
  return (
    <View style={styles.whatNextCard}>
      <View style={styles.whatNextHeader}>
        <Ionicons name="compass" size={18} color={SITE_LEAD_COLOR} />
        <Text style={styles.whatNextTitle}>Wat wil je doen?</Text>
      </View>
      <View style={styles.whatNextGrid}>
        {actions.map(action => (
          <Pressable key={action.id} style={styles.whatNextItem} onPress={() => onAction(action.tab)}>
            <View style={styles.whatNextIconWrap}>
              <Ionicons name={action.icon} size={22} color={SITE_LEAD_COLOR} />
            </View>
            <Text style={styles.whatNextItemTitle}>{action.title}</Text>
            <Text style={styles.whatNextItemSub}>{action.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// SERVICETITAN DISPATCH COMPONENTS
// =============================================================================

function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  const config: Record<WorkerStatus, { bg: string; text: string; label: string; icon: IconName }> = {
    'available': { bg: SemanticColors.feedbackSuccessBg, text: SemanticColors.feedbackSuccess, label: 'Beschikbaar', icon: 'checkmark-circle' },
    'traveling': { bg: '#DBEAFE', text: '#2563EB', label: 'Onderweg', icon: 'car' },
    'on-job': { bg: SITE_LEAD_COLOR + '20', text: SITE_LEAD_COLOR, label: 'Bezig', icon: 'construct' },
    'break': { bg: '#FEF3C7', text: '#D97706', label: 'Pauze', icon: 'cafe' },
    'sick': { bg: SemanticColors.feedbackErrorBg, text: SemanticColors.feedbackError, label: 'Ziek', icon: 'medical' },
  };
  const c = config[status];
  return (
    <View style={[styles.workerStatusBadge, { backgroundColor: c.bg }]}>
      <Ionicons name={c.icon} size={12} color={c.text} />
      <Text style={[styles.workerStatusText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function DispatchWorkerCard({ worker, isSelected, onPress }: {
  worker: DispatchWorker;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.dispatchWorkerCard, isSelected && styles.dispatchWorkerCardSelected]} onPress={onPress}>
      <View style={styles.dispatchWorkerHeader}>
        <View style={[styles.dispatchWorkerAvatar, worker.status === 'on-job' && { borderColor: SITE_LEAD_COLOR, borderWidth: 2 }]}>
          <Text style={styles.dispatchWorkerInitials}>{worker.initials}</Text>
        </View>
        <View style={styles.dispatchWorkerInfo}>
          <Text style={styles.dispatchWorkerName}>{worker.name}</Text>
          <Text style={styles.dispatchWorkerTrade}>{worker.trade}</Text>
        </View>
        <View style={styles.dispatchWorkerRating}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={styles.dispatchWorkerRatingText}>{worker.rating}</Text>
        </View>
      </View>
      <WorkerStatusBadge status={worker.status} />
      <Text style={styles.dispatchWorkerCompleted}>{worker.completedToday} klus{worker.completedToday !== 1 ? 'sen' : ''} vandaag</Text>
    </Pressable>
  );
}

function DispatchJobCard({ job, workers, onAssign }: {
  job: DispatchJob;
  workers: DispatchWorker[];
  onAssign: () => void;
}) {
  const assignedWorker = workers.find(w => w.id === job.assignedTo);
  const priorityColors: Record<JobPriority, { bg: string; text: string }> = {
    'urgent': { bg: SemanticColors.feedbackErrorBg, text: SemanticColors.feedbackError },
    'high': { bg: SITE_LEAD_COLOR + '20', text: SITE_LEAD_COLOR },
    'normal': { bg: SemanticColors.surfaceSecondary, text: SemanticColors.textSecondary },
    'low': { bg: SemanticColors.feedbackInfoBg, text: SemanticColors.feedbackInfo },
  };
  const pColor = priorityColors[job.priority];

  return (
    <View style={[styles.dispatchJobCard, job.status === 'unassigned' && styles.dispatchJobCardUnassigned]}>
      <View style={styles.dispatchJobHeader}>
        <View style={styles.dispatchJobTime}>
          <Ionicons name="time" size={14} color={SemanticColors.textSecondary} />
          <Text style={styles.dispatchJobTimeText}>{job.time}</Text>
          <Text style={styles.dispatchJobDuration}>({Math.round(job.duration / 60)}u)</Text>
        </View>
        <View style={[styles.dispatchJobPriority, { backgroundColor: pColor.bg }]}>
          <Text style={[styles.dispatchJobPriorityText, { color: pColor.text }]}>
            {job.priority === 'urgent' ? 'SPOED' : job.priority === 'high' ? 'Hoog' : job.priority === 'normal' ? 'Normaal' : 'Laag'}
          </Text>
        </View>
      </View>

      <Text style={styles.dispatchJobTitle}>{job.title}</Text>
      <Text style={styles.dispatchJobType}>{job.jobType}</Text>

      <View style={styles.dispatchJobCustomer}>
        <Ionicons name="person" size={12} color={SemanticColors.textTertiary} />
        <Text style={styles.dispatchJobCustomerText}>{job.customer}</Text>
      </View>
      <View style={styles.dispatchJobAddress}>
        <Ionicons name="location" size={12} color={SemanticColors.textTertiary} />
        <Text style={styles.dispatchJobAddressText}>{job.address}</Text>
      </View>

      {job.notes && (
        <View style={styles.dispatchJobNotes}>
          <Ionicons name="alert-circle" size={12} color={SemanticColors.feedbackWarning} />
          <Text style={styles.dispatchJobNotesText}>{job.notes}</Text>
        </View>
      )}

      <View style={styles.dispatchJobActions}>
        {job.status === 'unassigned' ? (
          <Pressable style={styles.assignButton} onPress={onAssign}>
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.assignButtonText}>Toewijzen</Text>
          </Pressable>
        ) : (
          <View style={styles.assignedChip}>
            <Ionicons name="person" size={14} color={SITE_LEAD_COLOR} />
            <Text style={styles.assignedChipText}>{assignedWorker?.name || 'Toegewezen'}</Text>
          </View>
        )}
        <Pressable style={styles.jobActionBtn}>
          <Ionicons name="call" size={16} color={SemanticColors.textSecondary} />
        </Pressable>
        <Pressable style={styles.jobActionBtn}>
          <Ionicons name="navigate" size={16} color={SemanticColors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface SiteLeadDashboardProps {
  initialTab?: TabView;
  showTabBar?: boolean;
}

export function SiteLeadDashboard({ initialTab = 'overview', showTabBar = true }: SiteLeadDashboardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>(initialTab);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  // UI Guidance state
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
  const [milestones, setMilestones] = useState<ProgressMilestone[]>(SITELEAD_MILESTONES);

  // ServiceTitan Dispatch state
  const [dispatchWorkers, setDispatchWorkers] = useState<DispatchWorker[]>(MOCK_WORKERS);
  const [dispatchJobs, setDispatchJobs] = useState<DispatchJob[]>(MOCK_JOBS);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [dispatchFilter, setDispatchFilter] = useState<'all' | 'unassigned' | 'in-progress'>('all');

  // UI Guidance - filter active tips
  const activeTips = useMemo(() =>
    SITELEAD_ONBOARDING_TIPS.filter(t => !dismissedTips.has(t.id)),
    [dismissedTips]
  );

  const handleDismissTip = useCallback((id: string) => {
    setDismissedTips(prev => new Set(prev).add(id));
    if (SITELEAD_ONBOARDING_TIPS.every(t => t.id === id || dismissedTips.has(t.id))) {
      setShowOnboarding(false);
    }
  }, [dismissedTips]);

  const handleOnboardingAction = useCallback((tab: TabView) => {
    setActiveTab(tab);
    setShowOnboarding(false);
  }, []);

  const handleMilestonePress = useCallback((m: ProgressMilestone) => {
    // Navigate based on milestone
    if (m.id === 'pm-3') setActiveTab('safety');
    if (m.id === 'pm-5') setActiveTab('quality');
  }, []);

  const handleWhatNextAction = useCallback((tab: TabView) => {
    setActiveTab(tab);
  }, []);

  // Dispatch - filter jobs
  const filteredJobs = useMemo(() => {
    if (dispatchFilter === 'unassigned') return dispatchJobs.filter(j => j.status === 'unassigned');
    if (dispatchFilter === 'in-progress') return dispatchJobs.filter(j => j.status === 'in-progress');
    return dispatchJobs;
  }, [dispatchJobs, dispatchFilter]);

  // Dispatch - available workers count
  const availableWorkers = useMemo(() =>
    dispatchWorkers.filter(w => w.status === 'available').length,
    [dispatchWorkers]
  );

  // Dispatch - assign job to worker
  const handleAssignJob = useCallback((jobId: string) => {
    if (!selectedWorkerId) return;
    setDispatchJobs(jobs => jobs.map(j =>
      j.id === jobId ? { ...j, status: 'scheduled' as JobStatus, assignedTo: selectedWorkerId } : j
    ));
    setDispatchWorkers(workers => workers.map(w =>
      w.id === selectedWorkerId ? { ...w, status: 'traveling' as WorkerStatus, currentJob: jobId } : w
    ));
    setSelectedWorkerId(null);
  }, [selectedWorkerId]);

  // Derived data
  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const siteMetrics = useMemo(() => mockSiteMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(
    () => (selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP'),
    [selectedProject]
  );

  // Progress metrics
  const progressHealth = useMemo(() => {
    if (!siteMetrics) return null;
    const variance = siteMetrics.progressVariance;
    return {
      actual: siteMetrics.overallPercentComplete,
      planned: siteMetrics.plannedPercentComplete,
      variance,
      status: variance >= -2 ? 'on-track' : variance >= -5 ? 'at-risk' : 'behind',
    };
  }, [siteMetrics]);

  // Safety metrics
  const safetyHealth = useMemo(() => {
    if (!siteMetrics) return null;
    const score =
      siteMetrics.ltir < 0.5
        ? 'excellent'
        : siteMetrics.ltir < 1.0
          ? 'good'
          : siteMetrics.ltir < 2.0
            ? 'fair'
            : 'poor';
    return {
      ltir: siteMetrics.ltir,
      hoursWorked: siteMetrics.hoursWorked,
      incidents: siteMetrics.incidentsTotal,
      incidentsThisPeriod: siteMetrics.incidentsThisPeriod,
      nearMisses: siteMetrics.nearMissesThisPeriod,
      score,
    };
  }, [siteMetrics]);

  // Quality metrics
  const qualityHealth = useMemo(() => {
    if (!siteMetrics) return null;
    return {
      defectsOpen: siteMetrics.defectsOpenTotal,
      defectsClosed: siteMetrics.defectsClosedTotal,
      closureRate: siteMetrics.defectClosureRate,
      reworkCost: siteMetrics.reworkCostToDate,
    };
  }, [siteMetrics]);

  // Constraints metrics
  const constraintStatus = useMemo(() => {
    if (!siteMetrics) return null;
    return {
      openRfis: siteMetrics.openRfis,
      avgRfiResponse: siteMetrics.avgRfiResponseDays,
      openConstraints: siteMetrics.openConstraints,
      clearedThisWeek: siteMetrics.constraintsClearedThisWeek,
    };
  }, [siteMetrics]);

  // Risk counts
  const riskCounts = useMemo(() => {
    if (!selectedProject) return { high: 0, medium: 0, low: 0 };
    const activeRisks = selectedProject.risks.filter((r) => r.status !== 'closed');
    return {
      high: activeRisks.filter((r) => r.score >= 12).length,
      medium: activeRisks.filter((r) => r.score >= 6 && r.score < 12).length,
      low: activeRisks.filter((r) => r.score < 6).length,
    };
  }, [selectedProject]);

  const fmt = (amount: number) => formatCurrency(amount, currency);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Goedemorgen';
    if (hour < 18) return 'Goedemiddag';
    return 'Goedenavond';
  };

  const getSafetyColor = (score: string) => {
    switch (score) {
      case 'excellent':
      case 'good':
        return Palette.success;
      case 'fair':
        return Palette.warning;
      default:
        return Palette.error;
    }
  };

  const getProgressStatusColor = (status: string) => {
    switch (status) {
      case 'on-track':
        return Palette.success;
      case 'at-risk':
        return Palette.warning;
      default:
        return Palette.error;
    }
  };

  // Project selector component (reused across tabs)
  const ProjectSelector = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.projectRow}>
        {mockProjects.filter((p) => mockSiteMetrics[p.id]).map((project) => (
          <Pressable
            key={project.id}
            style={[
              styles.projectPill,
              selectedProjectId === project.id && styles.projectPillActive,
            ]}
            onPress={() => setSelectedProjectId(project.id)}
          >
            <Text style={styles.projectCountry}>{project.country}</Text>
            <Text
              style={[
                styles.projectName,
                selectedProjectId === project.id && styles.projectNameActive,
              ]}
              numberOfLines={1}
            >
              {project.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  if (!selectedProject || !siteMetrics || !progressHealth || !safetyHealth || !qualityHealth || !constraintStatus) {
    return (
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Site Lead Dashboard</Text>
        <Text style={styles.emptyText}>Selecteer een project om te beginnen</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Site Overzicht</Text>
            <Text style={styles.headerSubtitle}>{selectedProject.name}</Text>
          </View>
          <View style={[styles.headerAccent, { backgroundColor: SITE_LEAD_COLOR }]} />
        </View>

        {/* Status Pills */}
        <View style={styles.headerMetrics}>
          <View style={[styles.headerStatusPill, progressHealth.status === 'on-track' && styles.statusPillGood]}>
            <Text style={styles.headerStatusValue}>{progressHealth.actual}%</Text>
            <Text style={styles.headerStatusLabel}>Progress</Text>
          </View>
          <View style={[styles.headerStatusPill, safetyHealth.score === 'excellent' || safetyHealth.score === 'good' ? styles.statusPillGood : styles.statusPillWarning]}>
            <Text style={styles.headerStatusValue}>{safetyHealth.ltir.toFixed(2)}</Text>
            <Text style={styles.headerStatusLabel}>LTIR</Text>
          </View>
          <View style={[styles.headerStatusPill, qualityHealth.defectsOpen > 20 && styles.statusPillDanger]}>
            <Text style={styles.headerStatusValue}>{qualityHealth.defectsOpen}</Text>
            <Text style={styles.headerStatusLabel}>Open Defects</Text>
          </View>
        </View>
      </View>

      {/* Internal tab bar removed - using bottom navigation instead */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* UI Guidance - Onboarding Carousel */}
            {showOnboarding && activeTips.length > 0 && (
              <OnboardingCarousel
                tips={activeTips}
                currentIndex={onboardingIndex}
                onNext={() => setOnboardingIndex(i => Math.min(i + 1, activeTips.length - 1))}
                onPrev={() => setOnboardingIndex(i => Math.max(i - 1, 0))}
                onDismiss={handleDismissTip}
                onAction={handleOnboardingAction}
              />
            )}

            {/* UI Guidance - Progress Tracker */}
            {!showOnboarding && (
              <ProgressTracker
                milestones={milestones}
                onPress={handleMilestonePress}
              />
            )}

            {/* UI Guidance - What to do next */}
            {!showOnboarding && (
              <WhatNextCard
                actions={SITELEAD_QUICK_ACTIONS}
                onAction={handleWhatNextAction}
              />
            )}

            {/* Quick Actions */}
            <View style={styles.quickActionsRow}>
              <QuickAction
                icon="people"
                label="Dispatch"
                badge={dispatchJobs.filter(j => j.status === 'unassigned').length || undefined}
                onPress={() => setActiveTab('dispatch')}
              />
              <QuickAction
                icon="shield-checkmark"
                label="Veiligheid"
                badge={safetyHealth.incidentsThisPeriod}
                onPress={() => setActiveTab('safety')}
              />
              <QuickAction
                icon="alert-circle"
                label="Escalatie"
                badge={riskCounts.high}
                onPress={() => setActiveTab('issues')}
              />
              <QuickAction
                icon="chatbubbles"
                label="RFI's"
                badge={constraintStatus.openRfis > 10 ? constraintStatus.openRfis : undefined}
                onPress={() => setActiveTab('issues')}
              />
            </View>

            {/* Project Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Project</Text>
              <ProjectSelector />
            </View>

            {/* Progress Banner */}
            <View
              style={[
                styles.progressBanner,
                { backgroundColor: getProgressStatusColor(progressHealth.status) + '15' },
              ]}
            >
              <View style={styles.progressBannerLeft}>
                <Text style={styles.progressBannerStatus}>
                  {progressHealth.status === 'on-track'
                    ? 'Op Schema'
                    : progressHealth.status === 'at-risk'
                      ? 'Risico'
                      : 'Achter Schema'}
                </Text>
                <Text style={styles.progressBannerVariance}>
                  {progressHealth.variance > 0 ? '+' : ''}
                  {progressHealth.variance}% t.o.v. plan
                </Text>
              </View>
              <View
                style={[
                  styles.progressCircle,
                  { borderColor: getProgressStatusColor(progressHealth.status) },
                ]}
              >
                <Text style={styles.progressCircleValue}>{progressHealth.actual}%</Text>
              </View>
            </View>

            {/* Summary Metrics Grid - Unique metrics not shown elsewhere */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Key Metrics</Text>
              <View style={styles.metricsGrid}>
                <MetricTile
                  label="Actieve werkfronten"
                  value={selectedProject.scheduleActivities.filter(a => a.status === 'in-progress').length}
                  subtitle="lopend"
                />
                <MetricTile
                  label="Beperkingen opgelost"
                  value={constraintStatus.clearedThisWeek}
                  subtitle="deze week"
                  trend="up"
                />
                <MetricTile
                  label="High Risks"
                  value={riskCounts.high}
                  alert={riskCounts.high > 0}
                />
                <MetricTile
                  label="Gem. RFI respons"
                  value={`${constraintStatus.avgRfiResponse}d`}
                  alert={constraintStatus.avgRfiResponse > 3}
                />
              </View>
            </View>

            {/* Site Management Hub */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Site Management</Text>
              <View style={styles.hubGrid}>
                <Pressable style={styles.hubCard} onPress={() => setActiveTab('dispatch')}>
                  <View style={[styles.hubIconWrap, { backgroundColor: SITE_LEAD_COLOR + '15' }]}>
                    <Ionicons name="people" size={24} color={SITE_LEAD_COLOR} />
                  </View>
                  <Text style={styles.hubCardTitle}>Dispatch</Text>
                  <Text style={styles.hubCardSubtitle}>Technici & klussen</Text>
                </Pressable>

                <Pressable style={styles.hubCard} onPress={() => setActiveTab('safety')}>
                  <View style={[styles.hubIconWrap, { backgroundColor: Palette.error + '15' }]}>
                    <Ionicons name="shield-checkmark" size={24} color={Palette.error} />
                  </View>
                  <Text style={styles.hubCardTitle}>Veiligheid</Text>
                  <Text style={styles.hubCardSubtitle}>Incidenten & inspectie</Text>
                </Pressable>

                <Pressable style={styles.hubCard} onPress={() => setActiveTab('quality')}>
                  <View style={[styles.hubIconWrap, { backgroundColor: Palette.warning + '15' }]}>
                    <Ionicons name="checkmark-done-circle" size={24} color={Palette.warning} />
                  </View>
                  <Text style={styles.hubCardTitle}>Kwaliteit</Text>
                  <Text style={styles.hubCardSubtitle}>Gebreken & snaglijst</Text>
                </Pressable>

                <Pressable style={styles.hubCard} onPress={() => setActiveTab('issues')}>
                  <View style={[styles.hubIconWrap, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
                    <Ionicons name="help-circle" size={24} color={SemanticColors.feedbackInfo} />
                  </View>
                  <Text style={styles.hubCardTitle}>RFI's</Text>
                  <Text style={styles.hubCardSubtitle}>Informatieverzoeken</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* SAFETY TAB */}
        {activeTab === 'safety' && (
          <>
            <ProjectSelector />

            {/* Safety Score Banner */}
            <View style={[styles.safetyBanner, { backgroundColor: getSafetyColor(safetyHealth.score) + '15' }]}>
              <View style={styles.safetyBannerLeft}>
                <Text style={styles.safetyBannerLabel}>Safety Score</Text>
                <Text style={[styles.safetyBannerScore, { color: getSafetyColor(safetyHealth.score) }]}>
                  {safetyHealth.score.toUpperCase()}
                </Text>
              </View>
              <View style={styles.safetyBannerRight}>
                <Text style={styles.ltirLabel}>LTIR</Text>
                <Text style={[styles.ltirValue, { color: getSafetyColor(safetyHealth.score) }]}>
                  {safetyHealth.ltir.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Safety Metrics */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Safety Metrics</Text>
              <View style={styles.metricsGrid}>
                <MetricTile
                  label="Gewerkte uren"
                  value={safetyHealth.hoursWorked.toLocaleString()}
                  subtitle="totaal"
                />
                <MetricTile
                  label="Incidenten"
                  value={safetyHealth.incidents}
                  subtitle="totaal"
                  alert={safetyHealth.incidents > 0}
                />
                <MetricTile
                  label="Deze periode"
                  value={safetyHealth.incidentsThisPeriod}
                  subtitle="incidenten"
                  alert={safetyHealth.incidentsThisPeriod > 0}
                />
                <MetricTile
                  label="Near misses"
                  value={safetyHealth.nearMisses}
                  subtitle="deze week"
                />
              </View>
            </View>

            {/* Safety Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Safety Actions</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: Palette.error + '15' }]}>
                    <Ionicons name="warning" size={18} color={Palette.error} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Report Incident</Text>
                    <Text style={styles.actionSubtitle}>Log safety incident or near miss</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: SITE_LEAD_COLOR + '15' }]}>
                    <Ionicons name="clipboard" size={18} color={SITE_LEAD_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Safety Inspection</Text>
                    <Text style={styles.actionSubtitle}>Conduct site safety walk</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: Palette.success + '15' }]}>
                    <Ionicons name="people" size={18} color={Palette.success} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Toolbox Talk</Text>
                    <Text style={styles.actionSubtitle}>Record safety briefing</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* QUALITY TAB */}
        {activeTab === 'quality' && (
          <>
            <ProjectSelector />

            {/* Quality Status Banner */}
            <View style={styles.qualityBanner}>
              <View style={styles.qualityBannerItem}>
                <Text style={styles.qualityBannerValue}>{qualityHealth.defectsOpen}</Text>
                <Text style={styles.qualityBannerLabel}>Open</Text>
              </View>
              <View style={styles.qualityBannerDivider} />
              <View style={styles.qualityBannerItem}>
                <Text style={[styles.qualityBannerValue, { color: Palette.success }]}>
                  {qualityHealth.defectsClosed}
                </Text>
                <Text style={styles.qualityBannerLabel}>Closed</Text>
              </View>
              <View style={styles.qualityBannerDivider} />
              <View style={styles.qualityBannerItem}>
                <Text style={[styles.qualityBannerValue, { color: SITE_LEAD_COLOR }]}>
                  {formatPercent(qualityHealth.closureRate)}
                </Text>
                <Text style={styles.qualityBannerLabel}>Closure Rate</Text>
              </View>
            </View>

            {/* Quality Details - Complementary data not in banner */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quality Details</Text>
              <View style={styles.metricsGrid}>
                <MetricTile
                  label="Herstelkosten"
                  value={fmt(qualityHealth.reworkCost)}
                  subtitle="totaal"
                />
                <MetricTile
                  label="Closure trend"
                  value={qualityHealth.closureRate >= 0.8 ? 'Good' : 'Needs focus'}
                  trend={qualityHealth.closureRate >= 0.8 ? 'up' : 'down'}
                />
              </View>
            </View>

            {/* Quality Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quality Actions</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: Palette.warning + '15' }]}>
                    <Ionicons name="bug" size={18} color={Palette.warning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Log Defect</Text>
                    <Text style={styles.actionSubtitle}>Record quality issue with photos</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: Palette.success + '15' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={Palette.success} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Close Defect</Text>
                    <Text style={styles.actionSubtitle}>Mark defects as resolved</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: SITE_LEAD_COLOR + '15' }]}>
                    <Ionicons name="list" size={18} color={SITE_LEAD_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Snag List</Text>
                    <Text style={styles.actionSubtitle}>View all open items</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* ISSUES TAB */}
        {activeTab === 'issues' && (
          <>
            <ProjectSelector />

            {/* Constraints & RFI Summary */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Beperkingen & RFI's</Text>
              <View style={styles.metricsGrid}>
                <MetricTile
                  label="Open RFI's"
                  value={constraintStatus.openRfis}
                  alert={constraintStatus.openRfis > 15}
                />
                <MetricTile
                  label="Gem. responstijd"
                  value={`${constraintStatus.avgRfiResponse}d`}
                  subtitle={constraintStatus.avgRfiResponse > 3 ? 'boven target' : 'binnen target'}
                  alert={constraintStatus.avgRfiResponse > 3}
                />
                <MetricTile
                  label="Open beperkingen"
                  value={constraintStatus.openConstraints}
                />
                <MetricTile
                  label="Opgelost"
                  value={constraintStatus.clearedThisWeek}
                  subtitle="deze week"
                  trend="up"
                />
              </View>
            </View>

            {/* Risks Overview */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Risico Overzicht</Text>
              <View style={styles.riskStatusRow}>
                <StatusPill label="Hoog" count={riskCounts.high} color={Palette.error} />
                <StatusPill label="Middel" count={riskCounts.medium} color={Palette.warning} />
                <StatusPill label="Laag" count={riskCounts.low} color={Palette.success} />
              </View>

              {/* High priority risks list */}
              {selectedProject.risks
                .filter((r) => r.status !== 'closed' && r.score >= 12)
                .slice(0, 3)
                .map((risk) => (
                  <Pressable key={risk.id} style={styles.riskItem}>
                    <View style={styles.riskScoreBadge}>
                      <Text style={styles.riskScoreText}>{risk.score}</Text>
                    </View>
                    <View style={styles.riskContent}>
                      <Text style={styles.riskCategory}>{risk.category}</Text>
                      <Text style={styles.riskDescription} numberOfLines={2}>
                        {risk.description}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                  </Pressable>
                ))}
            </View>

            {/* Issues Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Issue Actions</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: SITE_LEAD_COLOR + '15' }]}>
                    <Ionicons name="help-circle" size={18} color={SITE_LEAD_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Create RFI</Text>
                    <Text style={styles.actionSubtitle}>Request for information</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: Palette.error + '15' }]}>
                    <Ionicons name="flag" size={18} color={Palette.error} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Escalate Issue</Text>
                    <Text style={styles.actionSubtitle}>Flag blocker for attention</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: Palette.warning + '15' }]}>
                    <Ionicons name="warning" size={18} color={Palette.warning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Log Risk</Text>
                    <Text style={styles.actionSubtitle}>Add to risk register</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* DISPATCH TAB - ServiceTitan-style */}
        {activeTab === 'dispatch' && (
          <>
            {/* Dispatch Header Stats */}
            <View style={styles.dispatchHeader}>
              <View style={styles.dispatchStat}>
                <Text style={styles.dispatchStatValue}>{filteredJobs.length}</Text>
                <Text style={styles.dispatchStatLabel}>Klussen</Text>
              </View>
              <View style={styles.dispatchStatDivider} />
              <View style={styles.dispatchStat}>
                <Text style={[styles.dispatchStatValue, { color: Palette.success }]}>{availableWorkers}</Text>
                <Text style={styles.dispatchStatLabel}>Beschikbaar</Text>
              </View>
              <View style={styles.dispatchStatDivider} />
              <View style={styles.dispatchStat}>
                <Text style={[styles.dispatchStatValue, { color: Palette.error }]}>
                  {dispatchJobs.filter(j => j.priority === 'urgent').length}
                </Text>
                <Text style={styles.dispatchStatLabel}>Spoed</Text>
              </View>
            </View>

            {/* Filter Chips */}
            <View style={styles.dispatchFilters}>
              <Pressable
                style={[styles.dispatchFilterChip, dispatchFilter === 'all' && styles.dispatchFilterChipActive]}
                onPress={() => setDispatchFilter('all')}
              >
                <Text style={[styles.dispatchFilterText, dispatchFilter === 'all' && styles.dispatchFilterTextActive]}>
                  Alle ({dispatchJobs.length})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.dispatchFilterChip, dispatchFilter === 'unassigned' && styles.dispatchFilterChipActive]}
                onPress={() => setDispatchFilter('unassigned')}
              >
                <Text style={[styles.dispatchFilterText, dispatchFilter === 'unassigned' && styles.dispatchFilterTextActive]}>
                  Niet toegewezen ({dispatchJobs.filter(j => j.status === 'unassigned').length})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.dispatchFilterChip, dispatchFilter === 'in-progress' && styles.dispatchFilterChipActive]}
                onPress={() => setDispatchFilter('in-progress')}
              >
                <Text style={[styles.dispatchFilterText, dispatchFilter === 'in-progress' && styles.dispatchFilterTextActive]}>
                  In uitvoering ({dispatchJobs.filter(j => j.status === 'in-progress').length})
                </Text>
              </Pressable>
            </View>

            {/* Workers Section */}
            <View style={styles.dispatchSection}>
              <View style={styles.dispatchSectionHeader}>
                <Ionicons name="people" size={18} color={SITE_LEAD_COLOR} />
                <Text style={styles.dispatchSectionTitle}>Technici</Text>
                {selectedWorkerId && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>1 geselecteerd</Text>
                  </View>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.workersRow}>
                  {dispatchWorkers.map(worker => (
                    <DispatchWorkerCard
                      key={worker.id}
                      worker={worker}
                      isSelected={selectedWorkerId === worker.id}
                      onPress={() => setSelectedWorkerId(
                        selectedWorkerId === worker.id ? null :
                        worker.status === 'available' ? worker.id : null
                      )}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Jobs Section */}
            <View style={styles.dispatchSection}>
              <View style={styles.dispatchSectionHeader}>
                <Ionicons name="construct" size={18} color={SITE_LEAD_COLOR} />
                <Text style={styles.dispatchSectionTitle}>Klussen Vandaag</Text>
              </View>
              {selectedWorkerId && (
                <View style={styles.assignHint}>
                  <Ionicons name="information-circle" size={16} color={SITE_LEAD_COLOR} />
                  <Text style={styles.assignHintText}>
                    Tap "Toewijzen" om de klus aan {dispatchWorkers.find(w => w.id === selectedWorkerId)?.name} te geven
                  </Text>
                </View>
              )}
              <View style={styles.jobsList}>
                {filteredJobs.map(job => (
                  <DispatchJobCard
                    key={job.id}
                    job={job}
                    workers={dispatchWorkers}
                    onAssign={() => handleAssignJob(job.id)}
                  />
                ))}
              </View>
            </View>

            {/* Quick Dispatch Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dispatch Acties</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: SITE_LEAD_COLOR + '15' }]}>
                    <Ionicons name="add-circle" size={18} color={SITE_LEAD_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Nieuwe Klus</Text>
                    <Text style={styles.actionSubtitle}>Voeg werk toe aan de planning</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: Palette.success + '15' }]}>
                    <Ionicons name="calendar" size={18} color={Palette.success} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Week Planning</Text>
                    <Text style={styles.actionSubtitle}>Bekijk de hele week</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: Palette.warning + '15' }]}>
                    <Ionicons name="map" size={18} color={Palette.warning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Route Optimalisatie</Text>
                    <Text style={styles.actionSubtitle}>Minimaliseer reistijd</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },

  // Header
  header: {
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  headerAccent: {
    width: 6,
    height: 36,
    borderRadius: 3,
  },
  headerMetrics: {
    flexDirection: 'row',
    gap: 8,
  },
  headerStatusPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  statusPillGood: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  statusPillWarning: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  statusPillDanger: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  headerStatusValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerStatusLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabActive: {
    backgroundColor: SITE_LEAD_COLOR,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },

  // Scroll Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  // Section
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAction: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  quickActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SITE_LEAD_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Palette.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },

  // Project Selector
  projectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  projectPill: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    minWidth: 100,
  },
  projectPillActive: {
    borderColor: SITE_LEAD_COLOR,
    backgroundColor: SITE_LEAD_COLOR + '10',
  },
  projectCountry: {
    fontSize: 10,
    fontWeight: '700',
    color: SITE_LEAD_COLOR,
  },
  projectName: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  projectNameActive: {
    color: SemanticColors.textPrimary,
  },

  // Cards
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Progress Banner
  progressBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
  },
  progressBannerLeft: {},
  progressBannerStatus: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  progressBannerVariance: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
  },
  metricTileAlert: {
    backgroundColor: Palette.error + '10',
  },
  metricLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginBottom: 6,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  metricValueAlert: {
    color: Palette.error,
  },
  metricSubtitle: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },

  // Hub Grid
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  hubCard: {
    width: '48%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  hubIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  hubCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  hubCardSubtitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Safety Banner
  safetyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 14,
  },
  safetyBannerLeft: {},
  safetyBannerLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  safetyBannerScore: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  safetyBannerRight: {
    alignItems: 'center',
  },
  ltirLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  ltirValue: {
    fontSize: 32,
    fontWeight: '700',
  },

  // Quality Banner
  qualityBanner: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  qualityBannerItem: {
    flex: 1,
    alignItems: 'center',
  },
  qualityBannerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  qualityBannerLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  qualityBannerDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.sm,
  },

  // Actions List
  actionsList: {
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  actionSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Status Pills
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  statusPillCount: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusPillLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Risk Items
  riskStatusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  riskScoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskScoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.error,
  },
  riskContent: {
    flex: 1,
  },
  riskCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: SITE_LEAD_COLOR,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  riskDescription: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },

  // Empty State
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
    padding: 20,
  },

  // ==========================================================================
  // UI GUIDANCE STYLES
  // ==========================================================================

  // Onboarding Card
  onboardingCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: SITE_LEAD_COLOR,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  onboardingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onboardingIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SITE_LEAD_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingDots: {
    flexDirection: 'row',
    gap: 6,
  },
  onboardingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.borderDefault,
  },
  onboardingDotActive: {
    backgroundColor: SITE_LEAD_COLOR,
    width: 20,
  },
  onboardingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  onboardingDesc: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },
  onboardingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  onboardingPrev: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
  },
  onboardingPrevText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  onboardingNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
  },
  onboardingNextText: {
    fontSize: 14,
    fontWeight: '600',
    color: SITE_LEAD_COLOR,
  },
  onboardingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SITE_LEAD_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  onboardingActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Progress Tracker Card
  progressTrackerCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  progressTrackerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrackerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrackerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  progressTrackerPercent: {
    fontSize: 16,
    fontWeight: '700',
    color: SITE_LEAD_COLOR,
  },
  progressTrackerBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressTrackerFill: {
    height: '100%',
    backgroundColor: SITE_LEAD_COLOR,
    borderRadius: 4,
  },
  progressTrackerMilestones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestoneIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
  },
  milestoneIconDone: {
    backgroundColor: Palette.success,
    borderColor: Palette.success,
  },
  milestoneIconCurrent: {
    borderColor: SITE_LEAD_COLOR,
    borderWidth: 2,
  },
  milestoneLine: {
    width: 16,
    height: 2,
    backgroundColor: SemanticColors.borderDefault,
    marginLeft: 4,
  },
  milestoneLineDone: {
    backgroundColor: Palette.success,
  },
  currentMilestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SITE_LEAD_COLOR + '10',
    padding: Spacing.sm,
    borderRadius: 8,
  },
  currentMilestoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // What Next Card
  whatNextCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  whatNextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whatNextTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  whatNextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  whatNextItem: {
    width: '48%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  whatNextIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SITE_LEAD_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  whatNextItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  whatNextItemSub: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },

  // ==========================================================================
  // SERVICETITAN DISPATCH STYLES
  // ==========================================================================

  // Dispatch Header Stats
  dispatchHeader: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  dispatchStat: {
    flex: 1,
    alignItems: 'center',
  },
  dispatchStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  dispatchStatLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  dispatchStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.sm,
  },

  // Filter Chips
  dispatchFilters: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dispatchFilterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  dispatchFilterChipActive: {
    backgroundColor: SITE_LEAD_COLOR,
    borderColor: SITE_LEAD_COLOR,
  },
  dispatchFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  dispatchFilterTextActive: {
    color: '#fff',
  },

  // Dispatch Section
  dispatchSection: {
    gap: Spacing.sm,
  },
  dispatchSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dispatchSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  selectedBadge: {
    backgroundColor: SITE_LEAD_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  // Workers Row
  workersRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },

  // Assign Hint
  assignHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SITE_LEAD_COLOR + '15',
    padding: Spacing.sm,
    borderRadius: 10,
  },
  assignHintText: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
    flex: 1,
  },

  // Jobs List
  jobsList: {
    gap: 12,
  },

  // Worker Status Badge
  workerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  workerStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Dispatch Worker Card
  dispatchWorkerCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: 14,
    width: 160,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  dispatchWorkerCardSelected: {
    borderColor: SITE_LEAD_COLOR,
    borderWidth: 2,
    backgroundColor: SITE_LEAD_COLOR + '08',
  },
  dispatchWorkerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dispatchWorkerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SITE_LEAD_COLOR + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchWorkerInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: SITE_LEAD_COLOR,
  },
  dispatchWorkerInfo: {
    flex: 1,
  },
  dispatchWorkerName: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  dispatchWorkerTrade: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  dispatchWorkerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dispatchWorkerRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  dispatchWorkerCompleted: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Dispatch Job Card
  dispatchJobCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  dispatchJobCardUnassigned: {
    borderColor: Palette.warning + '60',
    backgroundColor: Palette.warning + '05',
  },
  dispatchJobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dispatchJobTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dispatchJobTimeText: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  dispatchJobDuration: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginLeft: 4,
  },
  dispatchJobPriority: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  dispatchJobPriorityText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dispatchJobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  dispatchJobType: {
    fontSize: 12,
    color: SITE_LEAD_COLOR,
    fontWeight: '600',
  },
  dispatchJobCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dispatchJobCustomerText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  dispatchJobAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dispatchJobAddressText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  dispatchJobNotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.feedbackWarningBg,
    padding: 8,
    borderRadius: 8,
  },
  dispatchJobNotesText: {
    fontSize: 12,
    color: SemanticColors.feedbackWarning,
    fontWeight: '500',
    flex: 1,
  },
  dispatchJobActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SITE_LEAD_COLOR,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  assignedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SITE_LEAD_COLOR + '15',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    flex: 1,
  },
  assignedChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: SITE_LEAD_COLOR,
    flex: 1,
  },
  jobActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
