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

// Vasco Guidance
import { useVascoGuidance, useInlineInsight } from '../../services/vascoGuidanceService';
import { VascoInsightList, InlineInsight } from '../shared/VascoInsightCard';
import type { VascoInsight } from '../shared/VascoInsightCard';
import { ContractorDashboardHeader } from '../contractor/ContractorDashboardHeader';


type IconName = keyof typeof Ionicons.glyphMap;
export type SiteLeadTabView = 'overview' | 'dispatch' | 'safety' | 'quality';
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

// =============================================================================
// WORK TEAM PROGRESS TRACKING
// =============================================================================

type TeamStatus = 'on-track' | 'at-risk' | 'behind' | 'completed';

interface WorkTeam {
  id: string;
  name: string;
  trade: string;
  tradeIcon: IconName;
  lead: string;
  members: number;
  task: string;
  location: string;
  progress: number; // 0-100
  plannedProgress: number; // 0-100
  status: TeamStatus;
  startTime: string;
  estimatedEnd: string;
  blockers?: string;
}

const MOCK_WORK_TEAMS: WorkTeam[] = [
  {
    id: 'wt-1',
    name: 'Elektra Team A',
    trade: 'Elektricien',
    tradeIcon: 'flash',
    lead: 'Mohammed Al-Rashid',
    members: 3,
    task: 'Bekabeling 2e verdieping',
    location: 'Blok A - Verdieping 2',
    progress: 72,
    plannedProgress: 65,
    status: 'on-track',
    startTime: '07:30',
    estimatedEnd: '16:00',
  },
  {
    id: 'wt-2',
    name: 'Loodgieter Team',
    trade: 'Loodgieter',
    tradeIcon: 'water',
    lead: 'Pieter de Groot',
    members: 2,
    task: 'Sanitair installatie badkamers',
    location: 'Blok B - Verdieping 1',
    progress: 45,
    plannedProgress: 60,
    status: 'behind',
    startTime: '08:00',
    estimatedEnd: '17:00',
    blockers: 'Wacht op materiaallevering',
  },
  {
    id: 'wt-3',
    name: 'Timmerwerk',
    trade: 'Timmerman',
    tradeIcon: 'hammer',
    lead: 'Erik Jansen',
    members: 4,
    task: 'Kozijnen plaatsen begane grond',
    location: 'Blok A - Begane grond',
    progress: 88,
    plannedProgress: 85,
    status: 'on-track',
    startTime: '07:00',
    estimatedEnd: '14:30',
  },
  {
    id: 'wt-4',
    name: 'Schilders',
    trade: 'Schilder',
    tradeIcon: 'color-palette',
    lead: 'Lisa Bakker',
    members: 2,
    task: 'Binnenschilderwerk kantoren',
    location: 'Blok C - Verdieping 3',
    progress: 30,
    plannedProgress: 35,
    status: 'at-risk',
    startTime: '08:30',
    estimatedEnd: '17:30',
    blockers: 'Ventilatie nog niet afgerond',
  },
  {
    id: 'wt-5',
    name: 'Metselwerk',
    trade: 'Metselaar',
    tradeIcon: 'cube',
    lead: 'Jan van Bergen',
    members: 3,
    task: 'Gevelstenen buitenmuur',
    location: 'Blok B - Buitenzijde',
    progress: 100,
    plannedProgress: 100,
    status: 'completed',
    startTime: '06:30',
    estimatedEnd: '15:00',
  },
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
    title: 'Planning & Dispatch',
    description: 'Beheer werkplanning, wijs technici toe aan klussen en optimaliseer routes.',
    icon: 'calendar',
    action: { label: 'Naar Planning', tab: 'dispatch' },
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
  { id: 'qa-1', icon: 'shield-checkmark' as IconName, title: 'Veiligheid', subtitle: 'Incidenten', tab: 'safety' as TabView },
  { id: 'qa-2', icon: 'ribbon' as IconName, title: 'Kwaliteit', subtitle: 'Gebreken', tab: 'quality' as TabView },
  { id: 'qa-3', icon: 'calendar' as IconName, title: 'Planning', subtitle: 'Dispatch', tab: 'dispatch' as TabView },
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
            color={trend === 'up' ? SemanticColors.feedbackSuccess : trend === 'down' ? SemanticColors.feedbackError : SemanticColors.textTertiary}
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

  // Vasco AI Guidance
  const [dismissedGuidance, setDismissedGuidance] = useState<Set<string>>(new Set());
  const [snoozedGuidance, setSnoozedGuidance] = useState<Set<string>>(new Set());
  const allGuidance = useVascoGuidance('sitelead', activeTab as any);
  const activeGuidance = useMemo(
    () => allGuidance.filter(g => !dismissedGuidance.has(g.id) && !snoozedGuidance.has(g.id)),
    [allGuidance, dismissedGuidance, snoozedGuidance]
  );
  const overviewInsight = useInlineInsight('sitelead', 'overview', 'overview');
  const dispatchInsight = useInlineInsight('sitelead', 'dispatch', 'overview');
  const safetyInsight = useInlineInsight('sitelead', 'safety', 'overview');
  const qualityInsight = useInlineInsight('sitelead', 'quality', 'overview');

  const handleDismissGuidance = useCallback((id: string) => {
    setDismissedGuidance(prev => new Set(prev).add(id));
  }, []);
  const handleSnoozeGuidance = useCallback((id: string) => {
    setSnoozedGuidance(prev => new Set(prev).add(id));
  }, []);
  const handleGuidanceAction = useCallback((insight: VascoInsight) => {
    if (insight.actionRoute) router.push(insight.actionRoute as any);
  }, [router]);

  // ServiceTitan Dispatch state
  const [dispatchWorkers, setDispatchWorkers] = useState<DispatchWorker[]>(MOCK_WORKERS);
  const [dispatchJobs, setDispatchJobs] = useState<DispatchJob[]>(MOCK_JOBS);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [dispatchFilter, setDispatchFilter] = useState<'all' | 'unassigned' | 'in-progress'>('all');

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

  const headerConfig = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return {
          title: 'Site Overzicht',
          pills: [
            { value: `${progressHealth?.actual ?? 0}%`, label: 'Progress', good: progressHealth?.status === 'on-track' },
            { value: (safetyHealth?.ltir ?? 0).toFixed(2), label: 'LTIR', good: safetyHealth?.score === 'excellent' || safetyHealth?.score === 'good' },
            { value: String(qualityHealth?.defectsOpen ?? 0), label: 'Open Defects', danger: (qualityHealth?.defectsOpen ?? 0) > 20 },
          ],
        };
      case 'dispatch':
        return {
          title: 'Planning',
          pills: [
            { value: String(MOCK_WORKERS.filter(w => w.status === 'available').length), label: 'Beschikbaar', good: true },
            { value: String(MOCK_JOBS.filter(j => j.status === 'in-progress').length), label: 'Actief' },
            { value: String(MOCK_JOBS.filter(j => j.status === 'unassigned').length), label: 'Niet toegewezen', danger: MOCK_JOBS.filter(j => j.status === 'unassigned').length > 0 },
          ],
        };
      case 'safety':
        return {
          title: 'Veiligheid',
          pills: [
            { value: (safetyHealth?.ltir ?? 0).toFixed(2), label: 'LTIR', good: safetyHealth?.score === 'excellent' || safetyHealth?.score === 'good' },
            { value: String(qualityHealth?.defectsOpen ?? 0), label: 'Open Defects', danger: (qualityHealth?.defectsOpen ?? 0) > 20 },
            { value: String(riskCounts.high), label: 'Hoog Risico', danger: riskCounts.high > 0 },
          ],
        };
      case 'quality':
        return {
          title: 'Kwaliteit',
          pills: [
            { value: String(qualityHealth?.defectsOpen ?? 0), label: 'Open', danger: (qualityHealth?.defectsOpen ?? 0) > 20 },
            { value: `${qualityHealth?.closureRate ?? 0}%`, label: 'Closure Rate', good: (qualityHealth?.closureRate ?? 0) > 80 },
            { value: String((qualityHealth?.defectsOpen ?? 0) + (qualityHealth?.defectsClosed ?? 0)), label: 'Totaal' },
          ],
        };
      // issues tab removed - merged into safety/veiligheid
      default:
        return { title: 'Site Overzicht', pills: [] as { value: string; label: string; good?: boolean; danger?: boolean }[] };
    }
  }, [activeTab, progressHealth, safetyHealth, qualityHealth, constraintStatus, riskCounts]);

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
        return SemanticColors.feedbackSuccess;
      case 'fair':
        return SemanticColors.feedbackWarning;
      default:
        return SemanticColors.feedbackError;
    }
  };

  const getProgressStatusColor = (status: string) => {
    switch (status) {
      case 'on-track':
        return SemanticColors.feedbackSuccess;
      case 'at-risk':
        return SemanticColors.feedbackWarning;
      default:
        return SemanticColors.feedbackError;
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
            <Text style={styles.headerTitle}>{headerConfig.title}</Text>
            <Text style={styles.headerSubtitle}>{selectedProject.name}</Text>
          </View>
          <View style={[styles.headerAccent, { backgroundColor: SITE_LEAD_COLOR }]} />
        </View>
        <View style={styles.headerMetrics}>
          {headerConfig.pills.map((pill, idx) => (
            <View key={idx} style={[styles.headerStatusPill, pill.good && styles.statusPillGood, pill.danger && styles.statusPillDanger]}>
              <Text style={styles.headerStatusValue}>{pill.value}</Text>
              <Text style={styles.headerStatusLabel}>{pill.label}</Text>
            </View>
          ))}
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
            {/* KPI Header */}
            <ContractorDashboardHeader
              kpis={[
                { icon: 'people', value: String(MOCK_WORKERS.filter(w => w.status !== 'sick').length), label: 'Beschikbaar', color: SITE_LEAD_COLOR },
                { icon: 'construct', value: String(MOCK_JOBS.filter(j => j.status === 'in-progress').length), label: 'Actief' },
                { icon: 'alert-circle', value: String(MOCK_JOBS.filter(j => j.priority === 'urgent').length), label: 'Urgent', color: SemanticColors.feedbackError },
              ]}
            />
            <VascoInsightList
              insights={activeGuidance}
              title="Vasco AI Guidance"
              compact
              maxVisible={2}
              onDismiss={handleDismissGuidance}
              onAction={handleGuidanceAction}
              onSnooze={handleSnoozeGuidance}
            />
            {overviewInsight && (
              <InlineInsight icon={overviewInsight.icon as IconName} message={overviewInsight.message} />
            )}

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

            {/* Tool Link Cards */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tools</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/ai-assistant' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SITE_LEAD_COLOR + '15' }]}>
                    <Ionicons name="sparkles" size={18} color={SITE_LEAD_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>AI Assistent</Text>
                    <Text style={styles.actionSubtitle}>Slimme hulp bij dagelijkse taken</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/team' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
                    <Ionicons name="people" size={18} color={SemanticColors.feedbackSuccess} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Teambeheer</Text>
                    <Text style={styles.actionSubtitle}>Beheer teamleden en rollen</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/documents' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
                    <Ionicons name="document-text" size={18} color={SemanticColors.feedbackInfo} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Documenten</Text>
                    <Text style={styles.actionSubtitle}>Documenten opslaan en delen</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>

          </>
        )}

        {/* SAFETY TAB */}
        {activeTab === 'safety' && (
          <>
            {/* KPI Header */}
            <ContractorDashboardHeader
              kpis={[
                { icon: 'shield-checkmark', value: safetyHealth.ltir.toFixed(2), label: 'LTIR', color: safetyHealth.score === 'excellent' || safetyHealth.score === 'good' ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning },
                { icon: 'warning', value: String(safetyHealth.incidentsThisPeriod), label: 'Incidenten', color: safetyHealth.incidentsThisPeriod > 0 ? SemanticColors.feedbackError : undefined },
                { icon: 'eye', value: String(safetyHealth.nearMisses), label: 'Near-misses' },
              ]}
            />
            {safetyInsight && (
              <InlineInsight icon={safetyInsight.icon as IconName} message={safetyInsight.message} />
            )}

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

            {/* Safety Metrics - Incident Bars */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Incident Overzicht</Text>
              <View style={styles.safetyGaugeBars}>
                {[
                  { label: 'Gewerkte uren', value: safetyHealth.hoursWorked.toLocaleString(), pct: 100, color: SITE_LEAD_COLOR },
                  { label: 'Incidenten (totaal)', value: String(safetyHealth.incidents), pct: safetyHealth.incidents > 0 ? Math.max((safetyHealth.incidents / 10) * 100, 15) : 0, color: SemanticColors.feedbackError },
                  { label: 'Deze periode', value: String(safetyHealth.incidentsThisPeriod), pct: safetyHealth.incidentsThisPeriod > 0 ? Math.max((safetyHealth.incidentsThisPeriod / 5) * 100, 10) : 0, color: SemanticColors.feedbackWarning },
                  { label: 'Near-misses', value: String(safetyHealth.nearMisses), pct: safetyHealth.nearMisses > 0 ? Math.max((safetyHealth.nearMisses / 5) * 100, 10) : 0, color: Palette.hermesOrange },
                ].map((item) => (
                  <View key={item.label} style={styles.safetyBarRow}>
                    <View style={styles.safetyBarLabelRow}>
                      <Text style={styles.safetyBarLabel}>{item.label}</Text>
                      <Text style={[styles.safetyBarValue, { color: item.color }]}>{item.value}</Text>
                    </View>
                    <View style={styles.safetyBarTrack}>
                      <View style={[styles.safetyBarFill, { width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Veiligheid Tools */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Veiligheid Tools</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackError + '15' }]}>
                    <Ionicons name="warning" size={18} color={SemanticColors.feedbackError} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Incident Melden</Text>
                    <Text style={styles.actionSubtitle}>Meld veiligheidsincident of bijna-ongeluk</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: SITE_LEAD_COLOR + '15' }]}>
                    <Ionicons name="clipboard" size={18} color={SITE_LEAD_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Veiligheidsinspectie</Text>
                    <Text style={styles.actionSubtitle}>Voer site veiligheidsronde uit</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
                    <Ionicons name="people" size={18} color={SemanticColors.feedbackSuccess} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Toolbox Talk</Text>
                    <Text style={styles.actionSubtitle}>Registreer veiligheidsbriefing</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/(contractor)/certificaten' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="ribbon" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Certificaten</Text>
                    <Text style={styles.actionSubtitle}>VCA, NEN beheren</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/compliance' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
                    <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackInfo} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Compliance</Text>
                    <Text style={styles.actionSubtitle}>Nalevingsstatus</Text>
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
            {/* KPI Header */}
            <ContractorDashboardHeader
              kpis={[
                { icon: 'ribbon', value: String(qualityHealth.defectsOpen), label: 'Open Defects', color: qualityHealth.defectsOpen > 20 ? SemanticColors.feedbackWarning : SemanticColors.feedbackSuccess },
                { icon: 'checkmark-circle', value: `${qualityHealth.closureRate}%`, label: 'Closure Rate' },
                { icon: 'construct', value: `€${qualityHealth.reworkCost.toLocaleString('nl-NL')}`, label: 'Rework' },
              ]}
            />
            {qualityInsight && (
              <InlineInsight icon={qualityInsight.icon as IconName} message={qualityInsight.message} />
            )}

            <ProjectSelector />

            {/* Defect Resolution Flow */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Defect Resolution</Text>
                <Text style={[styles.cardHeaderStat, { color: SITE_LEAD_COLOR }]}>
                  {qualityHealth.defectsOpen + qualityHealth.defectsClosed} total
                </Text>
              </View>
              {/* Pipeline Bar: Open → Closed */}
              <View style={styles.defectPipelineBar}>
                {qualityHealth.defectsClosed > 0 && (
                  <View style={[styles.defectPipelineSegment, {
                    flex: qualityHealth.defectsClosed,
                    backgroundColor: SemanticColors.feedbackSuccess,
                  }]} />
                )}
                {qualityHealth.defectsOpen > 0 && (
                  <View style={[styles.defectPipelineSegment, {
                    flex: qualityHealth.defectsOpen,
                    backgroundColor: SemanticColors.feedbackWarning,
                  }]} />
                )}
              </View>
              <View style={styles.defectPipelineLegend}>
                <View style={styles.defectPipelineLegendItem}>
                  <View style={[styles.defectPipelineDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                  <Text style={styles.defectPipelineLegendText}>Gesloten</Text>
                  <Text style={styles.defectPipelineLegendCount}>{qualityHealth.defectsClosed}</Text>
                </View>
                <View style={styles.defectPipelineLegendItem}>
                  <View style={[styles.defectPipelineDot, { backgroundColor: SemanticColors.feedbackWarning }]} />
                  <Text style={styles.defectPipelineLegendText}>Open</Text>
                  <Text style={styles.defectPipelineLegendCount}>{qualityHealth.defectsOpen}</Text>
                </View>
              </View>
            </View>

            {/* Quality Scorecard */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Kwaliteit Scorecard</Text>
              <View style={styles.qualityScorecardRow}>
                {/* Closure Rate Ring */}
                <View style={[styles.closureRateRing, {
                  borderColor: qualityHealth.closureRate >= 0.8 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning,
                }]}>
                  <Text style={[styles.closureRateValue, {
                    color: qualityHealth.closureRate >= 0.8 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning,
                  }]}>
                    {formatPercent(qualityHealth.closureRate)}
                  </Text>
                  <Text style={styles.closureRateLabel}>Closure</Text>
                </View>
                {/* Detail Stats */}
                <View style={styles.qualityScorecardStats}>
                  <View style={styles.qualityScorecardStatRow}>
                    <Ionicons name="construct" size={14} color={SemanticColors.feedbackWarning} />
                    <Text style={styles.qualityScorecardLabel}>Herstelkosten</Text>
                    <Text style={styles.qualityScorecardValue}>{fmt(qualityHealth.reworkCost)}</Text>
                  </View>
                  <View style={styles.qualityScorecardStatRow}>
                    <Ionicons name="trending-up" size={14} color={qualityHealth.closureRate >= 0.8 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError} />
                    <Text style={styles.qualityScorecardLabel}>Trend</Text>
                    <Text style={[styles.qualityScorecardValue, {
                      color: qualityHealth.closureRate >= 0.8 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError,
                    }]}>
                      {qualityHealth.closureRate >= 0.8 ? 'Goed' : 'Aandacht nodig'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Quality Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quality Actions</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="bug" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Log Defect</Text>
                    <Text style={styles.actionSubtitle}>Record quality issue with photos</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
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
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/warranty' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Garantie</Text>
                    <Text style={styles.actionSubtitle}>Garantiebeheer</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/receipts' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
                    <Ionicons name="camera" size={18} color={SemanticColors.feedbackInfo} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Bon Scanner</Text>
                    <Text style={styles.actionSubtitle}>Scan bonnen</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* DISPATCH TAB (Planning) - ServiceTitan-style */}
        {activeTab === 'dispatch' && (
          <>
            {/* KPI Header */}
            <ContractorDashboardHeader
              kpis={[
                { icon: 'people', value: `${availableWorkers}/${dispatchWorkers.length}`, label: 'Beschikbaar', color: SITE_LEAD_COLOR },
                { icon: 'construct', value: String(dispatchJobs.filter(j => j.status === 'unassigned').length), label: 'Niet Toegewezen' },
                { icon: 'checkmark-done', value: String(dispatchJobs.filter(j => j.status === 'completed').length), label: 'Klaar' },
              ]}
            />
            {dispatchInsight && (
              <InlineInsight icon={dispatchInsight.icon as IconName} message={dispatchInsight.message} />
            )}

            {/* Werkploeg Voortgang - moved from Overview */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: SITE_LEAD_COLOR + '15', alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm }}>
                  <Ionicons name="people" size={16} color={SITE_LEAD_COLOR} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Werkploeg Voortgang</Text>
                  <Text style={{ fontSize: 12, color: SemanticColors.textTertiary }}>
                    {MOCK_WORK_TEAMS.filter(t => t.status !== 'completed').length} actief · {MOCK_WORK_TEAMS.filter(t => t.status === 'completed').length} afgerond
                  </Text>
                </View>
              </View>

              {/* Summary strip */}
              <View style={{ flexDirection: 'row', marginBottom: Spacing.md, gap: Spacing.sm }}>
                {[
                  { label: 'Op schema', count: MOCK_WORK_TEAMS.filter(t => t.status === 'on-track').length, color: SemanticColors.feedbackSuccess },
                  { label: 'Risico', count: MOCK_WORK_TEAMS.filter(t => t.status === 'at-risk').length, color: SemanticColors.feedbackWarning },
                  { label: 'Achter', count: MOCK_WORK_TEAMS.filter(t => t.status === 'behind').length, color: SemanticColors.feedbackError },
                  { label: 'Klaar', count: MOCK_WORK_TEAMS.filter(t => t.status === 'completed').length, color: SemanticColors.textTertiary },
                ].map((item) => (
                  <View key={item.label} style={{ flex: 1, backgroundColor: item.color + '12', borderRadius: 8, paddingVertical: 6, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: item.color }}>{item.count}</Text>
                    <Text style={{ fontSize: 10, color: SemanticColors.textTertiary }}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* Team cards */}
              {MOCK_WORK_TEAMS.map((team) => {
                const deviation = team.progress - team.plannedProgress;
                const statusColor = team.status === 'on-track' ? SemanticColors.feedbackSuccess
                  : team.status === 'at-risk' ? SemanticColors.feedbackWarning
                  : team.status === 'behind' ? SemanticColors.feedbackError
                  : SemanticColors.textTertiary;

                return (
                  <View key={team.id} style={{
                    backgroundColor: SemanticColors.surfaceSecondary,
                    borderRadius: 10,
                    padding: Spacing.sm,
                    marginBottom: Spacing.xs,
                    borderLeftWidth: 3,
                    borderLeftColor: statusColor,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: statusColor + '20', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                        <Ionicons name={team.tradeIcon} size={14} color={statusColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary }}>{team.name}</Text>
                        <Text style={{ fontSize: 11, color: SemanticColors.textTertiary }}>
                          {team.lead} · {team.members} personen · {team.location}
                        </Text>
                      </View>
                      {team.status === 'completed' ? (
                        <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
                      ) : (
                        <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>
                          {deviation >= 0 ? '+' : ''}{deviation}%
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: SemanticColors.textSecondary, marginBottom: 6 }}>
                      {team.task}
                    </Text>
                    <View style={{ marginBottom: 4 }}>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: SemanticColors.surfacePrimary, overflow: 'hidden' }}>
                        <View style={{
                          height: '100%',
                          borderRadius: 3,
                          width: `${team.progress}%`,
                          backgroundColor: statusColor,
                        }} />
                      </View>
                      {team.status !== 'completed' && (
                        <View style={{
                          position: 'absolute',
                          left: `${team.plannedProgress}%`,
                          top: -2,
                          width: 2,
                          height: 10,
                          backgroundColor: SemanticColors.textTertiary,
                          borderRadius: 1,
                        }} />
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: SemanticColors.textTertiary }}>
                        {team.progress}% (plan: {team.plannedProgress}%)
                      </Text>
                      <Text style={{ fontSize: 11, color: SemanticColors.textTertiary }}>
                        {team.startTime} - {team.estimatedEnd}
                      </Text>
                    </View>
                    {team.blockers && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: SemanticColors.borderMuted }}>
                        <Ionicons name="alert-circle" size={12} color={SemanticColors.feedbackWarning} />
                        <Text style={{ fontSize: 11, color: SemanticColors.feedbackWarning, marginLeft: 4, flex: 1 }}>
                          {team.blockers}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Dispatch Header Stats */}
            <View style={styles.dispatchHeader}>
              <View style={styles.dispatchStat}>
                <Text style={styles.dispatchStatValue}>{filteredJobs.length}</Text>
                <Text style={styles.dispatchStatLabel}>Klussen</Text>
              </View>
              <View style={styles.dispatchStatDivider} />
              <View style={styles.dispatchStat}>
                <Text style={[styles.dispatchStatValue, { color: SemanticColors.feedbackSuccess }]}>{availableWorkers}</Text>
                <Text style={styles.dispatchStatLabel}>Beschikbaar</Text>
              </View>
              <View style={styles.dispatchStatDivider} />
              <View style={styles.dispatchStat}>
                <Text style={[styles.dispatchStatValue, { color: SemanticColors.feedbackError }]}>
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
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/planning' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
                    <Ionicons name="calendar" size={18} color={SemanticColors.feedbackSuccess} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Week Planning</Text>
                    <Text style={styles.actionSubtitle}>Bekijk de hele week</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/route' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="map" size={18} color={SemanticColors.feedbackWarning} />
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
    backgroundColor: SemanticColors.feedbackError,
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
    backgroundColor: SemanticColors.feedbackError + '10',
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
    color: SemanticColors.feedbackError,
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
    backgroundColor: SemanticColors.feedbackError + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskScoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.feedbackError,
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
    backgroundColor: SemanticColors.feedbackSuccess,
    borderColor: SemanticColors.feedbackSuccess,
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
    backgroundColor: SemanticColors.feedbackSuccess,
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
    borderColor: SemanticColors.feedbackWarning + '60',
    backgroundColor: SemanticColors.feedbackWarning + '05',
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

  // Card Header Row
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderStat: {
    fontSize: 13,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
  },

  // Safety Gauge
  safetyGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  safetyGaugeRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  safetyGaugeValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  safetyGaugeLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  safetyGaugeBars: {
    flex: 1,
    gap: 8,
  },
  safetyBarRow: {
    gap: 2,
  },
  safetyBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  safetyBarLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  safetyBarValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  safetyBarTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'hidden',
  },
  safetyBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },

  // Defect Pipeline
  defectPipelineBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  defectPipelineSegment: {
    height: '100%',
  },
  defectPipelineLegend: {
    gap: Spacing.xs,
  },
  defectPipelineLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  defectPipelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  defectPipelineLegendText: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  defectPipelineLegendCount: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Quality Scorecard
  qualityScorecardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  closureRateRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  closureRateValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  closureRateLabel: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
  },
  qualityScorecardStats: {
    flex: 1,
    gap: Spacing.sm,
  },
  qualityScorecardStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualityScorecardLabel: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  qualityScorecardValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // RFI Response Time
  rfiResponseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  rfiResponseGauge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rfiResponseActual: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  rfiResponseLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  rfiResponseBars: {
    flex: 1,
    gap: Spacing.sm,
  },
  rfiResponseBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rfiResponseBarLabel: {
    width: 50,
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  rfiResponseBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'hidden',
  },
  rfiResponseBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  rfiResponseBarValue: {
    width: 24,
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'right',
  },

  // Constraint Rows
  constraintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  constraintIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  constraintLabel: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  constraintValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

});
