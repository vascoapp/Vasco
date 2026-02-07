// =============================================================================
// SITE LEAD - ServiceTitan-Style Field Operations Dashboard
// =============================================================================
// AI-powered site management with:
// - Vasco Guidance (weather, alerts, recommendations)
// - ServiceTitan-style dispatch board with visual timeline
// - Real-time worker status tracking (available, traveling, on-job, break)
// - Job lifecycle management (unassigned → dispatched → in-progress → completed)
// - Skill-based technician matching for job assignment
// - Contractor shift scheduling & availability
// - Handover tracking
// - Schedule fragility/overrun detection
// - Quick hire/replace for sick contractors
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { FinancialKPIGrid } from '../../src/components/shared/FinancialKPIGrid';
import type { KPITile } from '../../src/components/shared/FinancialKPIGrid';
import { WorkCardList } from '../../src/components/shared/WorkCardList';
import type { WorkCard } from '../../src/components/shared/WorkCardList';

// Services
import { useAuditFindings } from '../../src/services/auditorService';
import { useCapacityForecast, useCapacityAlerts, useOverrunPrediction } from '../../src/services/capacityPlanningService';
import { useFragilityAlerts, useScheduleFragilityStats } from '../../src/services/scheduleFragilityService';
import { useTeamMembers, useTeamStats } from '../../src/services/teamManagementService';
import { useEvidencePacksForJob } from '../../src/services/evidencePackService';

// Mock data for demo
import {
  MOCK_WORKERS,
  MOCK_DISPATCH_JOBS,
  MOCK_ALERTS,
} from '../../src/data/mockSiteLead';
import type { Worker, DispatchJob, ScheduleAlert } from '../../src/types/sitelead';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type IconName = keyof typeof Ionicons.glyphMap;
type TabView = 'overview' | 'dispatch' | 'schedule' | 'team' | 'handover';

// ============================================
// SERVICETITAN-STYLE TYPES
// ============================================

type WorkerStatus = 'available' | 'traveling' | 'on-job' | 'break' | 'off-duty' | 'sick';
type JobStatus = 'unassigned' | 'scheduled' | 'dispatched' | 'traveling' | 'in-progress' | 'completed' | 'cancelled';
type JobPriority = 'urgent' | 'high' | 'normal' | 'low';

interface DispatchWorker {
  id: string;
  name: string;
  initials: string;
  trade: string;
  phone: string;
  status: WorkerStatus;
  currentJob?: string;
  currentLocation?: string;
  skills: string[];
  certifications: string[];
  rating: number;
  completedToday: number;
  eta?: string; // ETA to complete current job
  avatar?: string;
}

interface DispatchJobItem {
  id: string;
  title: string;
  customer: string;
  address: string;
  scheduledTime: string; // "08:00" or "14:30"
  estimatedDuration: number; // in minutes
  status: JobStatus;
  priority: JobPriority;
  assignedTo?: string; // worker id
  requiredSkills: string[];
  requiredCertifications: string[];
  description: string;
  customerPhone: string;
  notes?: string;
  jobType: string; // "Elektra", "Loodgieter", etc.
}

// ============================================
// MOCK DATA - SERVICETITAN STYLE
// ============================================

const MOCK_DISPATCH_WORKERS: DispatchWorker[] = [
  {
    id: 'w1',
    name: 'Mohammed Al-Rashid',
    initials: 'MA',
    trade: 'Elektricien',
    phone: '06-34567890',
    status: 'on-job',
    currentJob: 'j2',
    currentLocation: 'Amstel 42',
    skills: ['NEN-1010', 'NEN-3140', 'Zonnepanelen', 'Domotica'],
    certifications: ['VCA VOL', 'NEN-1010', 'NEN-3140'],
    rating: 4.9,
    completedToday: 2,
    eta: '11:30',
  },
  {
    id: 'w2',
    name: 'Pieter de Groot',
    initials: 'PG',
    trade: 'Loodgieter',
    phone: '06-23456789',
    status: 'traveling',
    currentJob: 'j3',
    currentLocation: 'Onderweg naar Centrum',
    skills: ['Riolering', 'CV-installatie', 'Sanitair'],
    certifications: ['VCA Basis', 'Uneto-VNI'],
    rating: 4.5,
    completedToday: 1,
    eta: '09:45',
  },
  {
    id: 'w3',
    name: 'Erik Jansen',
    initials: 'EJ',
    trade: 'Timmerman',
    phone: '06-45678901',
    status: 'available',
    skills: ['Afbouw', 'Kozijnen', 'Trappen'],
    certifications: ['VCA Basis'],
    rating: 4.6,
    completedToday: 1,
  },
  {
    id: 'w4',
    name: 'Lisa Bakker',
    initials: 'LB',
    trade: 'Schilder',
    phone: '06-56789012',
    status: 'available',
    skills: ['Binnen', 'Buiten', 'Behang'],
    certifications: ['VCA Basis'],
    rating: 4.7,
    completedToday: 0,
  },
  {
    id: 'w5',
    name: 'Jan van Bergen',
    initials: 'JB',
    trade: 'Elektricien',
    phone: '06-12345678',
    status: 'sick',
    skills: ['NEN-1010', 'NEN-3140', 'Domotica'],
    certifications: ['VCA Basis', 'NEN-1010'],
    rating: 4.8,
    completedToday: 0,
  },
  {
    id: 'w6',
    name: 'Sandra Visser',
    initials: 'SV',
    trade: 'Loodgieter',
    phone: '06-67890123',
    status: 'break',
    currentLocation: 'Pauze - Noord locatie',
    skills: ['Riolering', 'CV-installatie', 'Warmtepomp'],
    certifications: ['VCA VOL', 'F-gassen'],
    rating: 4.4,
    completedToday: 2,
  },
];

const MOCK_DISPATCH_JOB_ITEMS: DispatchJobItem[] = [
  {
    id: 'j1',
    title: 'Meterkast vervangen',
    customer: 'Fam. Jansen',
    address: 'Prinsengracht 245, Amsterdam',
    scheduledTime: '08:00',
    estimatedDuration: 180,
    status: 'unassigned',
    priority: 'urgent',
    requiredSkills: ['NEN-1010', 'NEN-3140'],
    requiredCertifications: ['NEN-1010'],
    description: 'Complete meterkast renovatie, oude groepenkast vervangen',
    customerPhone: '020-1234567',
    jobType: 'Elektra',
    notes: 'Klant werkt thuis, bel 30 min van tevoren',
  },
  {
    id: 'j2',
    title: 'Zonnepanelen aansluiten',
    customer: 'Hr. Smit',
    address: 'Amstel 42, Amsterdam',
    scheduledTime: '09:00',
    estimatedDuration: 240,
    status: 'in-progress',
    priority: 'high',
    assignedTo: 'w1',
    requiredSkills: ['Zonnepanelen', 'NEN-1010'],
    requiredCertifications: ['VCA VOL'],
    description: '12 panelen aansluiten op omvormer en meterkast',
    customerPhone: '020-2345678',
    jobType: 'Elektra',
  },
  {
    id: 'j3',
    title: 'Lekkage badkamer',
    customer: 'Mevr. De Vries',
    address: 'Damrak 89, Amsterdam',
    scheduledTime: '09:30',
    estimatedDuration: 120,
    status: 'traveling',
    priority: 'urgent',
    assignedTo: 'w2',
    requiredSkills: ['Sanitair', 'Riolering'],
    requiredCertifications: ['VCA Basis'],
    description: 'Acute lekkage onder douche, waterschade dreigt',
    customerPhone: '020-3456789',
    jobType: 'Loodgieter',
    notes: 'SPOED - Waterschade dreigt!',
  },
  {
    id: 'j4',
    title: 'CV-ketel onderhoud',
    customer: 'Van Dijk BV',
    address: 'Weesperstraat 120, Amsterdam',
    scheduledTime: '11:00',
    estimatedDuration: 60,
    status: 'scheduled',
    priority: 'normal',
    assignedTo: 'w6',
    requiredSkills: ['CV-installatie'],
    requiredCertifications: ['VCA Basis'],
    description: 'Jaarlijks onderhoud CV-ketel kantoorpand',
    customerPhone: '020-4567890',
    jobType: 'Loodgieter',
  },
  {
    id: 'j5',
    title: 'Kozijnen plaatsen',
    customer: 'Renovatie Zuid',
    address: 'Beethovenstraat 45, Amsterdam',
    scheduledTime: '13:00',
    estimatedDuration: 300,
    status: 'unassigned',
    priority: 'normal',
    requiredSkills: ['Kozijnen'],
    requiredCertifications: ['VCA Basis'],
    description: '3 kunststof kozijnen plaatsen, begane grond',
    customerPhone: '020-5678901',
    jobType: 'Timmerman',
  },
  {
    id: 'j6',
    title: 'Schilderwerk trappenhuis',
    customer: 'VvE Centrum',
    address: 'Rokin 55, Amsterdam',
    scheduledTime: '14:00',
    estimatedDuration: 360,
    status: 'unassigned',
    priority: 'low',
    requiredSkills: ['Binnen'],
    requiredCertifications: ['VCA Basis'],
    description: 'Trappenhuis 4 verdiepingen wit schilderen',
    customerPhone: '020-6789012',
    jobType: 'Schilder',
  },
  {
    id: 'j7',
    title: 'Stopcontacten bijplaatsen',
    customer: 'Restaurant Oost',
    address: 'Linnaeusstraat 89, Amsterdam',
    scheduledTime: '16:00',
    estimatedDuration: 90,
    status: 'scheduled',
    priority: 'normal',
    requiredSkills: ['NEN-1010'],
    requiredCertifications: ['NEN-1010'],
    description: '4 extra stopcontacten in keuken voor apparatuur',
    customerPhone: '020-7890123',
    jobType: 'Elektra',
  },
];

// ============================================
// VASCO AI GUIDANCE DATA (Mock)
// ============================================

interface VascoGuidance {
  id: string;
  type: 'weather' | 'schedule' | 'safety' | 'efficiency' | 'resource';
  priority: 'high' | 'medium' | 'low';
  icon: IconName;
  title: string;
  message: string;
  action?: { label: string; route?: string };
  timestamp: string;
}

const MOCK_VASCO_GUIDANCE: VascoGuidance[] = [
  {
    id: 'vg-1',
    type: 'weather',
    priority: 'high',
    icon: 'rainy',
    title: 'Regen verwacht vanaf 14:00',
    message: 'Plan buitenwerk vóór 14:00. Verwachte buien tot 18:00 met 15mm neerslag.',
    action: { label: 'Herplan' },
    timestamp: new Date().toISOString(),
  },
  {
    id: 'vg-2',
    type: 'schedule',
    priority: 'high',
    icon: 'warning',
    title: 'Jan van Bergen is ziek gemeld',
    message: 'Elektra werk bij Bouwproject Noord heeft vervanging nodig. 2 beschikbare monteurs met juiste certificaten.',
    action: { label: 'Vervanger kiezen' },
    timestamp: new Date().toISOString(),
  },
  {
    id: 'vg-3',
    type: 'efficiency',
    priority: 'medium',
    icon: 'flash',
    title: 'Overrun risico: Loodgieter werk',
    message: 'Klus bij Amstel 42 loopt 2u achter. Overweeg extra monteur voor deadline.',
    action: { label: 'Bekijk details' },
    timestamp: new Date().toISOString(),
  },
  {
    id: 'vg-4',
    type: 'resource',
    priority: 'medium',
    icon: 'cube',
    title: 'Materiaal levering vertraagd',
    message: 'PVC buizen voor project Zuid komen morgen i.p.v. vandaag. Plan aangepast.',
    timestamp: new Date().toISOString(),
  },
];

// ============================================
// UI GUIDANCE & ONBOARDING (Site Lead)
// ============================================

interface UIGuidanceTip {
  id: string;
  category: 'onboarding' | 'feature' | 'productivity' | 'achievement';
  title: string;
  description: string;
  icon: IconName;
  action?: { label: string; tabOrRoute: string };
  dismissible: boolean;
  priority: number;
}

interface ProgressMilestone {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  completed: boolean;
  current?: boolean;
}

// Onboarding tips for site leads
const SITELEAD_ONBOARDING_TIPS: UIGuidanceTip[] = [
  {
    id: 'sl-onboard-1',
    category: 'onboarding',
    title: 'Welkom, Site Lead!',
    description: 'Vasco helpt je om je team efficiënt aan te sturen. Leer hoe je het dispatch board, planning en handovers beheert.',
    icon: 'sparkles',
    dismissible: false,
    priority: 100,
  },
  {
    id: 'sl-onboard-2',
    category: 'onboarding',
    title: 'Dispatch Board',
    description: 'Bekijk real-time waar je monteurs zijn en wijs klussen toe met één tik. AI matcht automatisch de beste monteur.',
    icon: 'send',
    action: { label: 'Naar Dispatch', tabOrRoute: 'dispatch' },
    dismissible: true,
    priority: 95,
  },
  {
    id: 'sl-onboard-3',
    category: 'onboarding',
    title: 'Zieke medewerker?',
    description: 'Tik op een zieke monteur om direct beschikbare vervangers met de juiste certificaten te zien.',
    icon: 'swap-horizontal',
    action: { label: 'Bekijk Planning', tabOrRoute: 'schedule' },
    dismissible: true,
    priority: 90,
  },
  {
    id: 'sl-onboard-4',
    category: 'onboarding',
    title: 'Handovers Voltooien',
    description: 'Controleer of alle handover documenten compleet zijn voordat je werk goedkeurt. Geen verrassingen achteraf.',
    icon: 'document-text',
    action: { label: 'Bekijk Handovers', tabOrRoute: 'handover' },
    dismissible: true,
    priority: 85,
  },
];

// Feature discovery tips for site leads
const SITELEAD_FEATURE_TIPS: UIGuidanceTip[] = [
  {
    id: 'sl-feat-1',
    category: 'feature',
    title: 'Skill-based Matching',
    description: 'Bij het toewijzen van klussen toont Vasco automatisch welke monteurs de vereiste certificaten hebben.',
    icon: 'shield-checkmark',
    action: { label: 'Probeer nu', tabOrRoute: 'dispatch' },
    dismissible: true,
    priority: 70,
  },
  {
    id: 'sl-feat-2',
    category: 'feature',
    title: 'Live Status Tracking',
    description: 'Zie in real-time of monteurs beschikbaar, onderweg, bezig of op pauze zijn.',
    icon: 'pulse',
    dismissible: true,
    priority: 65,
  },
  {
    id: 'sl-feat-3',
    category: 'feature',
    title: 'Dag Timeline',
    description: 'Bekijk alle geplande klussen op een visuele tijdlijn. Spot direct gaten en overbelasting.',
    icon: 'time',
    action: { label: 'Bekijk Timeline', tabOrRoute: 'dispatch' },
    dismissible: true,
    priority: 60,
  },
];

// Progress milestones for site leads
const SITELEAD_MILESTONES: ProgressMilestone[] = [
  { id: 'slm-1', title: 'Dashboard bekeken', description: 'Je bent begonnen!', icon: 'checkmark-circle', completed: true },
  { id: 'slm-2', title: 'Team status bekeken', description: 'Bekijk je team', icon: 'people', completed: true },
  { id: 'slm-3', title: 'Eerste toewijzing', description: 'Wijs een klus toe', icon: 'send', completed: false, current: true },
  { id: 'slm-4', title: 'Vervanger geregeld', description: 'Regel een vervanger', icon: 'swap-horizontal', completed: false },
  { id: 'slm-5', title: 'Handover goedgekeurd', description: 'Keur een handover goed', icon: 'document-text', completed: false },
];

// What to do next suggestions for site leads
const SITELEAD_WHAT_NEXT = [
  { id: 'wn-1', icon: 'alert-circle' as IconName, title: 'Spoed klussen', subtitle: 'Wijs nu toe', action: 'dispatch' },
  { id: 'wn-2', icon: 'medical' as IconName, title: 'Zieke vervangers', subtitle: 'Regel backup', action: 'schedule' },
  { id: 'wn-3', icon: 'document-text' as IconName, title: 'Handovers', subtitle: 'Controleren', action: 'handover' },
  { id: 'wn-4', icon: 'people' as IconName, title: 'Team bekijken', subtitle: 'Status check', action: 'team' },
];

// ============================================
// SHIFT/AVAILABILITY DATA (Mock)
// ============================================

interface ShiftSlot {
  id: string;
  timeSlot: 'morning' | 'afternoon' | 'evening';
  label: string;
  startTime: string;
  endTime: string;
}

interface ContractorShift {
  contractorId: string;
  name: string;
  trade: string;
  phone: string;
  avatar?: string;
  shifts: {
    date: string;
    slots: {
      morning: 'available' | 'assigned' | 'sick' | 'off';
      afternoon: 'available' | 'assigned' | 'sick' | 'off';
      evening: 'available' | 'assigned' | 'sick' | 'off';
    };
    assignedJob?: string;
  }[];
  skills: string[];
  rating: number;
  certifications: string[];
}

const SHIFT_SLOTS: ShiftSlot[] = [
  { id: 'morning', timeSlot: 'morning', label: 'Ochtend', startTime: '07:00', endTime: '12:00' },
  { id: 'afternoon', timeSlot: 'afternoon', label: 'Middag', startTime: '12:00', endTime: '17:00' },
  { id: 'evening', timeSlot: 'evening', label: 'Avond', startTime: '17:00', endTime: '21:00' },
];

const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

const MOCK_CONTRACTOR_SHIFTS: ContractorShift[] = [
  {
    contractorId: 'c1',
    name: 'Jan van Bergen',
    trade: 'Elektricien',
    phone: '06-12345678',
    shifts: [
      { date: today, slots: { morning: 'sick', afternoon: 'sick', evening: 'off' } },
      { date: tomorrow, slots: { morning: 'available', afternoon: 'available', evening: 'off' } },
    ],
    skills: ['NEN-1010', 'NEN-3140', 'Domotica'],
    rating: 4.8,
    certifications: ['VCA Basis', 'NEN-1010'],
  },
  {
    contractorId: 'c2',
    name: 'Pieter de Groot',
    trade: 'Loodgieter',
    phone: '06-23456789',
    shifts: [
      { date: today, slots: { morning: 'assigned', afternoon: 'assigned', evening: 'off' }, assignedJob: 'Amstel 42' },
      { date: tomorrow, slots: { morning: 'assigned', afternoon: 'available', evening: 'off' }, assignedJob: 'Zuid Project' },
    ],
    skills: ['Riolering', 'CV-installatie', 'Sanitair'],
    rating: 4.5,
    certifications: ['VCA Basis', 'Uneto-VNI'],
  },
  {
    contractorId: 'c3',
    name: 'Mohammed Al-Rashid',
    trade: 'Elektricien',
    phone: '06-34567890',
    shifts: [
      { date: today, slots: { morning: 'available', afternoon: 'available', evening: 'available' } },
      { date: tomorrow, slots: { morning: 'available', afternoon: 'assigned', evening: 'off' }, assignedJob: 'Noord Project' },
    ],
    skills: ['NEN-1010', 'NEN-3140', 'Zonnepanelen'],
    rating: 4.9,
    certifications: ['VCA VOL', 'NEN-1010', 'NEN-3140'],
  },
  {
    contractorId: 'c4',
    name: 'Erik Jansen',
    trade: 'Timmerman',
    phone: '06-45678901',
    shifts: [
      { date: today, slots: { morning: 'assigned', afternoon: 'available', evening: 'off' }, assignedJob: 'Centrum' },
      { date: tomorrow, slots: { morning: 'off', afternoon: 'off', evening: 'off' } },
    ],
    skills: ['Afbouw', 'Kozijnen', 'Trappen'],
    rating: 4.6,
    certifications: ['VCA Basis'],
  },
  {
    contractorId: 'c5',
    name: 'Lisa Bakker',
    trade: 'Schilder',
    phone: '06-56789012',
    shifts: [
      { date: today, slots: { morning: 'available', afternoon: 'available', evening: 'off' } },
      { date: tomorrow, slots: { morning: 'available', afternoon: 'available', evening: 'off' } },
    ],
    skills: ['Binnen', 'Buiten', 'Behang'],
    rating: 4.7,
    certifications: ['VCA Basis'],
  },
];

// ============================================
// HANDOVER DATA (Mock)
// ============================================

interface HandoverItem {
  id: string;
  jobId: string;
  jobTitle: string;
  customer: string;
  status: 'pending' | 'ready' | 'completed';
  completionPercent: number;
  missingItems: string[];
  dueDate: string;
}

const MOCK_HANDOVERS: HandoverItem[] = [
  {
    id: 'h1',
    jobId: 'j1',
    jobTitle: 'Keukenrenovatie Van Dijk',
    customer: 'Fam. Van Dijk',
    status: 'ready',
    completionPercent: 100,
    missingItems: [],
    dueDate: today,
  },
  {
    id: 'h2',
    jobId: 'j2',
    jobTitle: 'Badkamer installatie',
    customer: 'Hr. Smit',
    status: 'pending',
    completionPercent: 80,
    missingItems: ['Foto\'s eindresultaat', 'Handtekening klant'],
    dueDate: today,
  },
  {
    id: 'h3',
    jobId: 'j3',
    jobTitle: 'Elektra uitbreiding kantoor',
    customer: 'ABC Consulting',
    status: 'pending',
    completionPercent: 60,
    missingItems: ['NEN-1010 keuringsrapport', 'Foto\'s meterkast', 'Handtekening'],
    dueDate: tomorrow,
  },
];

// ============================================
// UI GUIDANCE COMPONENTS (Site Lead)
// ============================================

function SiteLeadOnboardingCarousel({ tips, currentIndex, onNext, onPrev, onDismiss, onAction }: {
  tips: UIGuidanceTip[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: (id: string) => void;
  onAction: (tabOrRoute: string) => void;
}) {
  const tip = tips[currentIndex];
  if (!tip) return null;

  return (
    <View style={styles.slOnboardingCarousel}>
      <View style={styles.slOnboardingHeader}>
        <View style={styles.slOnboardingIconContainer}>
          <Ionicons name={tip.icon} size={24} color={Palette.hermesOrange} />
        </View>
        <View style={styles.slOnboardingDots}>
          {tips.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.slOnboardingDot,
                idx === currentIndex && styles.slOnboardingDotActive
              ]}
            />
          ))}
        </View>
        {tip.dismissible && (
          <Pressable onPress={() => onDismiss(tip.id)} hitSlop={8}>
            <Ionicons name="close" size={20} color={SemanticColors.textTertiary} />
          </Pressable>
        )}
      </View>

      <Text style={styles.slOnboardingTitle}>{tip.title}</Text>
      <Text style={styles.slOnboardingDescription}>{tip.description}</Text>

      <View style={styles.slOnboardingActions}>
        {currentIndex > 0 && (
          <Pressable style={styles.slOnboardingPrevButton} onPress={onPrev}>
            <Ionicons name="chevron-back" size={18} color={SemanticColors.textSecondary} />
            <Text style={styles.slOnboardingPrevText}>Vorige</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {tip.action ? (
          <Pressable
            style={styles.slOnboardingActionButton}
            onPress={() => onAction(tip.action!.tabOrRoute)}
          >
            <Text style={styles.slOnboardingActionText}>{tip.action.label}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        ) : currentIndex < tips.length - 1 ? (
          <Pressable style={styles.slOnboardingNextButton} onPress={onNext}>
            <Text style={styles.slOnboardingNextText}>Volgende</Text>
            <Ionicons name="chevron-forward" size={18} color={Palette.hermesOrange} />
          </Pressable>
        ) : (
          <Pressable
            style={styles.slOnboardingActionButton}
            onPress={() => onDismiss(tip.id)}
          >
            <Text style={styles.slOnboardingActionText}>Aan de slag!</Text>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SiteLeadProgressTracker({ milestones, onMilestonePress }: {
  milestones: ProgressMilestone[];
  onMilestonePress: (milestone: ProgressMilestone) => void;
}) {
  const completedCount = milestones.filter(m => m.completed).length;
  const progressPercent = (completedCount / milestones.length) * 100;

  return (
    <View style={styles.slProgressTracker}>
      <View style={styles.slProgressHeader}>
        <View style={styles.slProgressTitleRow}>
          <Ionicons name="trophy" size={18} color={Palette.hermesOrange} />
          <Text style={styles.slProgressTitle}>Site Lead Training</Text>
        </View>
        <Text style={styles.slProgressPercent}>{Math.round(progressPercent)}%</Text>
      </View>

      <View style={styles.slProgressBarContainer}>
        <View style={[styles.slProgressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.slMilestonesRow}>
        {milestones.map((milestone, index) => (
          <Pressable
            key={milestone.id}
            style={styles.slMilestoneItem}
            onPress={() => !milestone.completed && onMilestonePress(milestone)}
          >
            <View style={[
              styles.slMilestoneIcon,
              milestone.completed && styles.slMilestoneIconCompleted,
              milestone.current && styles.slMilestoneIconCurrent,
            ]}>
              {milestone.completed ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Ionicons
                  name={milestone.icon}
                  size={14}
                  color={milestone.current ? Palette.hermesOrange : SemanticColors.textTertiary}
                />
              )}
            </View>
            {index < milestones.length - 1 && (
              <View style={[
                styles.slMilestoneLine,
                milestone.completed && styles.slMilestoneLineCompleted
              ]} />
            )}
          </Pressable>
        ))}
      </View>

      {milestones.find(m => m.current) && (
        <View style={styles.slCurrentMilestoneCard}>
          <Ionicons name="arrow-forward-circle" size={18} color={Palette.hermesOrange} />
          <View style={styles.slCurrentMilestoneContent}>
            <Text style={styles.slCurrentMilestoneTitle}>
              Volgende: {milestones.find(m => m.current)?.title}
            </Text>
            <Text style={styles.slCurrentMilestoneDesc}>
              {milestones.find(m => m.current)?.description}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function SiteLeadFeatureCard({ tip, onAction, onDismiss }: {
  tip: UIGuidanceTip;
  onAction: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.slFeatureCard}>
      <View style={styles.slFeatureCardHeader}>
        <View style={styles.slFeatureNewBadge}>
          <Ionicons name="sparkles" size={10} color="#fff" />
          <Text style={styles.slFeatureNewText}>TIP</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={18} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.slFeatureCardContent}>
        <View style={styles.slFeatureIconContainer}>
          <Ionicons name={tip.icon} size={28} color={Palette.hermesOrange} />
        </View>
        <View style={styles.slFeatureTextContent}>
          <Text style={styles.slFeatureTitle}>{tip.title}</Text>
          <Text style={styles.slFeatureDescription}>{tip.description}</Text>
        </View>
      </View>

      {tip.action && (
        <Pressable style={styles.slFeatureActionButton} onPress={onAction}>
          <Text style={styles.slFeatureActionText}>{tip.action.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={Palette.hermesOrange} />
        </Pressable>
      )}
    </View>
  );
}

function SiteLeadWhatNextCard({ suggestions, onSuggestionPress }: {
  suggestions: { id: string; icon: IconName; title: string; subtitle: string; action: string }[];
  onSuggestionPress: (action: string) => void;
}) {
  return (
    <View style={styles.slWhatNextCard}>
      <View style={styles.slWhatNextHeader}>
        <Ionicons name="compass" size={18} color={Palette.hermesOrange} />
        <Text style={styles.slWhatNextTitle}>Wat wil je doen?</Text>
      </View>

      <View style={styles.slWhatNextGrid}>
        {suggestions.map(suggestion => (
          <Pressable
            key={suggestion.id}
            style={styles.slWhatNextItem}
            onPress={() => onSuggestionPress(suggestion.action)}
          >
            <View style={styles.slWhatNextIconContainer}>
              <Ionicons name={suggestion.icon} size={22} color={Palette.hermesOrange} />
            </View>
            <Text style={styles.slWhatNextItemTitle}>{suggestion.title}</Text>
            <Text style={styles.slWhatNextItemSubtitle}>{suggestion.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ============================================
// SERVICETITAN-STYLE COMPONENTS
// ============================================

// Worker Status Badge with live indicator
function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  const statusConfig: Record<WorkerStatus, { bg: string; text: string; label: string; icon: IconName; pulse?: boolean }> = {
    'available': { bg: SemanticColors.feedbackSuccessBg, text: SemanticColors.feedbackSuccess, label: 'Beschikbaar', icon: 'checkmark-circle' },
    'traveling': { bg: '#DBEAFE', text: '#2563EB', label: 'Onderweg', icon: 'car', pulse: true },
    'on-job': { bg: Palette.hermesOrange + '20', text: Palette.hermesOrange, label: 'Bezig', icon: 'construct', pulse: true },
    'break': { bg: '#FEF3C7', text: '#D97706', label: 'Pauze', icon: 'cafe' },
    'off-duty': { bg: SemanticColors.surfaceSecondary, text: SemanticColors.textTertiary, label: 'Vrij', icon: 'moon' },
    'sick': { bg: SemanticColors.feedbackErrorBg, text: SemanticColors.feedbackError, label: 'Ziek', icon: 'medical' },
  };
  const config = statusConfig[status];

  return (
    <View style={[styles.workerStatusBadge, { backgroundColor: config.bg }]}>
      {config.pulse && <View style={[styles.statusPulse, { backgroundColor: config.text }]} />}
      <Ionicons name={config.icon} size={12} color={config.text} />
      <Text style={[styles.workerStatusText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

// Job Priority Badge
function JobPriorityBadge({ priority }: { priority: JobPriority }) {
  const priorityConfig: Record<JobPriority, { bg: string; text: string; label: string }> = {
    'urgent': { bg: SemanticColors.feedbackErrorBg, text: SemanticColors.feedbackError, label: 'SPOED' },
    'high': { bg: Palette.hermesOrange + '20', text: Palette.hermesOrange, label: 'Hoog' },
    'normal': { bg: SemanticColors.surfaceSecondary, text: SemanticColors.textSecondary, label: 'Normaal' },
    'low': { bg: SemanticColors.feedbackInfoBg, text: SemanticColors.feedbackInfo, label: 'Laag' },
  };
  const config = priorityConfig[priority];

  return (
    <View style={[styles.priorityBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.priorityText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

// Job Status Badge
function JobStatusBadge({ status }: { status: JobStatus }) {
  const statusConfig: Record<JobStatus, { bg: string; text: string; label: string; icon: IconName }> = {
    'unassigned': { bg: SemanticColors.feedbackWarningBg, text: SemanticColors.feedbackWarning, label: 'Niet toegewezen', icon: 'help-circle' },
    'scheduled': { bg: SemanticColors.feedbackInfoBg, text: SemanticColors.feedbackInfo, label: 'Gepland', icon: 'calendar' },
    'dispatched': { bg: '#DBEAFE', text: '#2563EB', label: 'Uitgezet', icon: 'send' },
    'traveling': { bg: '#DBEAFE', text: '#2563EB', label: 'Onderweg', icon: 'car' },
    'in-progress': { bg: Palette.hermesOrange + '20', text: Palette.hermesOrange, label: 'Bezig', icon: 'construct' },
    'completed': { bg: SemanticColors.feedbackSuccessBg, text: SemanticColors.feedbackSuccess, label: 'Afgerond', icon: 'checkmark-circle' },
    'cancelled': { bg: SemanticColors.surfaceSecondary, text: SemanticColors.textTertiary, label: 'Geannuleerd', icon: 'close-circle' },
  };
  const config = statusConfig[status];

  return (
    <View style={[styles.jobStatusBadge, { backgroundColor: config.bg }]}>
      <Ionicons name={config.icon} size={12} color={config.text} />
      <Text style={[styles.jobStatusText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

// Dispatch Worker Card (left sidebar in dispatch view)
function DispatchWorkerCard({ worker, isSelected, onPress }: {
  worker: DispatchWorker;
  isSelected: boolean;
  onPress: () => void;
}) {
  const isActive = worker.status === 'on-job' || worker.status === 'traveling';

  return (
    <Pressable
      style={[
        styles.dispatchWorkerCard,
        isSelected && styles.dispatchWorkerCardSelected,
        worker.status === 'sick' && styles.dispatchWorkerCardSick,
      ]}
      onPress={onPress}
    >
      <View style={styles.dispatchWorkerHeader}>
        <View style={[
          styles.dispatchWorkerAvatar,
          isActive && { borderColor: Palette.hermesOrange, borderWidth: 2 }
        ]}>
          <Text style={styles.dispatchWorkerInitials}>{worker.initials}</Text>
          {isActive && <View style={styles.activeIndicator} />}
        </View>
        <View style={styles.dispatchWorkerInfo}>
          <Text style={styles.dispatchWorkerName}>{worker.name}</Text>
          <Text style={styles.dispatchWorkerTrade}>{worker.trade}</Text>
        </View>
        <View style={styles.dispatchWorkerMeta}>
          <View style={styles.ratingMini}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={styles.ratingMiniText}>{worker.rating}</Text>
          </View>
          <Text style={styles.completedCount}>{worker.completedToday} klus{worker.completedToday !== 1 ? 'sen' : ''}</Text>
        </View>
      </View>

      <WorkerStatusBadge status={worker.status} />

      {worker.currentLocation && (
        <View style={styles.workerLocationRow}>
          <Ionicons name="location" size={12} color={SemanticColors.textTertiary} />
          <Text style={styles.workerLocationText} numberOfLines={1}>{worker.currentLocation}</Text>
          {worker.eta && (
            <Text style={styles.workerEta}>ETA {worker.eta}</Text>
          )}
        </View>
      )}

      {/* Skills preview */}
      <View style={styles.skillsPreview}>
        {worker.certifications.slice(0, 2).map(cert => (
          <View key={cert} style={styles.skillChip}>
            <Text style={styles.skillChipText}>{cert}</Text>
          </View>
        ))}
        {worker.certifications.length > 2 && (
          <Text style={styles.moreSkills}>+{worker.certifications.length - 2}</Text>
        )}
      </View>
    </Pressable>
  );
}

// Dispatch Job Card
function DispatchJobCard({ job, onPress, onQuickAssign }: {
  job: DispatchJobItem;
  onPress: () => void;
  onQuickAssign: () => void;
}) {
  const isUnassigned = job.status === 'unassigned';
  const isUrgent = job.priority === 'urgent';

  return (
    <Pressable
      style={[
        styles.dispatchJobCard,
        isUrgent && styles.dispatchJobCardUrgent,
        isUnassigned && styles.dispatchJobCardUnassigned,
      ]}
      onPress={onPress}
    >
      <View style={styles.dispatchJobHeader}>
        <View style={styles.dispatchJobTime}>
          <Ionicons name="time" size={14} color={SemanticColors.textSecondary} />
          <Text style={styles.dispatchJobTimeText}>{job.scheduledTime}</Text>
          <Text style={styles.dispatchJobDuration}>({Math.round(job.estimatedDuration / 60)}u)</Text>
        </View>
        <View style={styles.dispatchJobBadges}>
          <JobPriorityBadge priority={job.priority} />
          <JobStatusBadge status={job.status} />
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
        <Text style={styles.dispatchJobAddressText} numberOfLines={1}>{job.address}</Text>
      </View>

      {job.notes && (
        <View style={styles.dispatchJobNotes}>
          <Ionicons name="alert-circle" size={12} color={SemanticColors.feedbackWarning} />
          <Text style={styles.dispatchJobNotesText} numberOfLines={1}>{job.notes}</Text>
        </View>
      )}

      {/* Required skills */}
      <View style={styles.requiredSkillsRow}>
        <Text style={styles.requiredSkillsLabel}>Vereist:</Text>
        {job.requiredCertifications.slice(0, 2).map(cert => (
          <View key={cert} style={styles.requiredSkillChip}>
            <Text style={styles.requiredSkillChipText}>{cert}</Text>
          </View>
        ))}
      </View>

      {/* Action buttons */}
      <View style={styles.dispatchJobActions}>
        {isUnassigned ? (
          <Pressable style={styles.quickAssignButton} onPress={onQuickAssign}>
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.quickAssignButtonText}>Toewijzen</Text>
          </Pressable>
        ) : (
          <View style={styles.assignedWorkerChip}>
            <Ionicons name="person" size={12} color={Palette.hermesOrange} />
            <Text style={styles.assignedWorkerText}>
              {MOCK_DISPATCH_WORKERS.find(w => w.id === job.assignedTo)?.name || 'Toegewezen'}
            </Text>
          </View>
        )}
        <Pressable style={styles.jobActionButton} onPress={() => {}}>
          <Ionicons name="call" size={16} color={SemanticColors.textSecondary} />
        </Pressable>
        <Pressable style={styles.jobActionButton} onPress={() => {}}>
          <Ionicons name="navigate" size={16} color={SemanticColors.textSecondary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// Job Timeline (visual timeline showing jobs throughout the day)
function JobTimeline({ jobs, selectedWorkerId }: { jobs: DispatchJobItem[]; selectedWorkerId?: string }) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 - 18:00
  const filteredJobs = selectedWorkerId
    ? jobs.filter(j => j.assignedTo === selectedWorkerId)
    : jobs;

  const getJobPosition = (job: DispatchJobItem) => {
    const [hours, mins] = job.scheduledTime.split(':').map(Number);
    const startMinutes = (hours - 7) * 60 + mins;
    const widthPerMinute = (SCREEN_WIDTH - 80) / (12 * 60);
    return {
      left: startMinutes * widthPerMinute,
      width: Math.max(job.estimatedDuration * widthPerMinute, 60),
    };
  };

  const getJobColor = (job: DispatchJobItem) => {
    if (job.status === 'in-progress') return Palette.hermesOrange;
    if (job.status === 'traveling') return '#2563EB';
    if (job.status === 'completed') return SemanticColors.feedbackSuccess;
    if (job.priority === 'urgent') return SemanticColors.feedbackError;
    return SemanticColors.feedbackInfo;
  };

  return (
    <View style={styles.jobTimeline}>
      {/* Time markers */}
      <View style={styles.timelineHeader}>
        {hours.map(hour => (
          <View key={hour} style={styles.timeMarker}>
            <Text style={styles.timeMarkerText}>{hour}:00</Text>
          </View>
        ))}
      </View>

      {/* Current time indicator */}
      <View style={styles.timelineTrack}>
        <View style={[styles.currentTimeIndicator, { left: '25%' }]}>
          <View style={styles.currentTimeDot} />
          <View style={styles.currentTimeLine} />
        </View>

        {/* Job blocks */}
        {filteredJobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').map(job => {
          const pos = getJobPosition(job);
          const color = getJobColor(job);
          return (
            <View
              key={job.id}
              style={[
                styles.timelineJobBlock,
                { left: pos.left, width: pos.width, backgroundColor: color + '30', borderColor: color },
              ]}
            >
              <Text style={[styles.timelineJobText, { color }]} numberOfLines={1}>
                {job.title}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Quick Assign Modal - ServiceTitan style with skill matching
function QuickAssignModal({ visible, job, workers, onAssign, onClose }: {
  visible: boolean;
  job: DispatchJobItem | null;
  workers: DispatchWorker[];
  onAssign: (workerId: string) => void;
  onClose: () => void;
}) {
  // Score workers based on skill match
  const scoredWorkers = useMemo(() => {
    if (!job) return [];

    return workers
      .filter(w => w.status === 'available' || w.status === 'break')
      .map(w => {
        let score = 0;
        let matchedSkills: string[] = [];
        let matchedCerts: string[] = [];

        // Check certifications (more important)
        job.requiredCertifications.forEach(cert => {
          if (w.certifications.includes(cert)) {
            score += 30;
            matchedCerts.push(cert);
          }
        });

        // Check skills
        job.requiredSkills.forEach(skill => {
          if (w.skills.includes(skill)) {
            score += 20;
            matchedSkills.push(skill);
          }
        });

        // Trade match bonus
        if (w.trade.toLowerCase().includes(job.jobType.toLowerCase()) ||
            job.jobType.toLowerCase().includes(w.trade.toLowerCase())) {
          score += 25;
        }

        // Rating bonus
        score += w.rating * 5;

        // Availability bonus (available > break)
        if (w.status === 'available') score += 10;

        return { worker: w, score, matchedSkills, matchedCerts };
      })
      .sort((a, b) => b.score - a.score);
  }, [job, workers]);

  if (!job) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose}>
            <Text style={styles.modalCancel}>Annuleer</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Monteur Toewijzen</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Job summary */}
        <View style={styles.assignJobSummary}>
          <View style={styles.assignJobInfo}>
            <Text style={styles.assignJobTitle}>{job.title}</Text>
            <Text style={styles.assignJobCustomer}>{job.customer}</Text>
            <View style={styles.assignJobMeta}>
              <Ionicons name="time" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.assignJobMetaText}>{job.scheduledTime} • {Math.round(job.estimatedDuration / 60)}u</Text>
            </View>
          </View>
          <JobPriorityBadge priority={job.priority} />
        </View>

        {/* Required qualifications */}
        <View style={styles.requiredSection}>
          <Text style={styles.requiredSectionTitle}>Vereiste certificaten</Text>
          <View style={styles.requiredChips}>
            {job.requiredCertifications.map(cert => (
              <View key={cert} style={styles.requiredCertChip}>
                <Ionicons name="shield-checkmark" size={12} color={SemanticColors.feedbackInfo} />
                <Text style={styles.requiredCertText}>{cert}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.modalSectionTitle}>
          <Ionicons name="sparkles" size={14} color={Palette.hermesOrange} /> Aanbevolen Monteurs
        </Text>

        <ScrollView style={styles.modalScroll}>
          {scoredWorkers.length > 0 ? (
            scoredWorkers.map(({ worker, score, matchedCerts }, index) => (
              <Pressable
                key={worker.id}
                style={[
                  styles.recommendedWorkerCard,
                  index === 0 && styles.recommendedWorkerCardTop,
                ]}
                onPress={() => onAssign(worker.id)}
              >
                <View style={styles.recommendedWorkerLeft}>
                  <View style={styles.recommendedWorkerAvatar}>
                    <Text style={styles.recommendedWorkerInitials}>{worker.initials}</Text>
                    {index === 0 && (
                      <View style={styles.topMatchBadge}>
                        <Ionicons name="star" size={8} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.recommendedWorkerInfo}>
                    <View style={styles.recommendedWorkerNameRow}>
                      <Text style={styles.recommendedWorkerName}>{worker.name}</Text>
                      {index === 0 && <Text style={styles.bestMatchLabel}>Beste match</Text>}
                    </View>
                    <Text style={styles.recommendedWorkerTrade}>{worker.trade}</Text>
                    <View style={styles.matchedCertsRow}>
                      {matchedCerts.map(cert => (
                        <View key={cert} style={styles.matchedCertBadge}>
                          <Ionicons name="checkmark" size={10} color={SemanticColors.feedbackSuccess} />
                          <Text style={styles.matchedCertText}>{cert}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                <View style={styles.recommendedWorkerRight}>
                  <View style={styles.matchScoreBadge}>
                    <Text style={styles.matchScoreText}>{Math.round(score)}%</Text>
                  </View>
                  <WorkerStatusBadge status={worker.status} />
                </View>
              </Pressable>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle" size={40} color={SemanticColors.feedbackWarning} />
              <Text style={styles.emptyStateText}>Geen beschikbare monteurs met juiste certificaten</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// Job Detail Modal
function JobDetailModal({ visible, job, workers, onClose, onUpdateStatus, onReassign }: {
  visible: boolean;
  job: DispatchJobItem | null;
  workers: DispatchWorker[];
  onClose: () => void;
  onUpdateStatus: (status: JobStatus) => void;
  onReassign: () => void;
}) {
  if (!job) return null;

  const assignedWorker = workers.find(w => w.id === job.assignedTo);
  const statusFlow: JobStatus[] = ['scheduled', 'dispatched', 'traveling', 'in-progress', 'completed'];
  const currentIndex = statusFlow.indexOf(job.status);
  const nextStatus = currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose}>
            <Text style={styles.modalCancel}>Sluiten</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Klus Details</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.modalScroll}>
          {/* Job header */}
          <View style={styles.jobDetailHeader}>
            <View style={styles.jobDetailBadges}>
              <JobPriorityBadge priority={job.priority} />
              <JobStatusBadge status={job.status} />
            </View>
            <Text style={styles.jobDetailTitle}>{job.title}</Text>
            <Text style={styles.jobDetailType}>{job.jobType}</Text>
          </View>

          {/* Time info */}
          <View style={styles.jobDetailSection}>
            <View style={styles.jobDetailRow}>
              <Ionicons name="time" size={18} color={SemanticColors.textSecondary} />
              <View style={styles.jobDetailRowContent}>
                <Text style={styles.jobDetailLabel}>Gepland</Text>
                <Text style={styles.jobDetailValue}>{job.scheduledTime} • {Math.round(job.estimatedDuration / 60)} uur</Text>
              </View>
            </View>
          </View>

          {/* Customer info */}
          <View style={styles.jobDetailSection}>
            <View style={styles.jobDetailRow}>
              <Ionicons name="person" size={18} color={SemanticColors.textSecondary} />
              <View style={styles.jobDetailRowContent}>
                <Text style={styles.jobDetailLabel}>Klant</Text>
                <Text style={styles.jobDetailValue}>{job.customer}</Text>
              </View>
              <Pressable style={styles.callButton}>
                <Ionicons name="call" size={18} color={Palette.hermesOrange} />
              </Pressable>
            </View>
            <View style={styles.jobDetailRow}>
              <Ionicons name="location" size={18} color={SemanticColors.textSecondary} />
              <View style={styles.jobDetailRowContent}>
                <Text style={styles.jobDetailLabel}>Adres</Text>
                <Text style={styles.jobDetailValue}>{job.address}</Text>
              </View>
              <Pressable style={styles.callButton}>
                <Ionicons name="navigate" size={18} color={Palette.hermesOrange} />
              </Pressable>
            </View>
          </View>

          {/* Description */}
          <View style={styles.jobDetailSection}>
            <Text style={styles.jobDetailSectionTitle}>Omschrijving</Text>
            <Text style={styles.jobDetailDescription}>{job.description}</Text>
            {job.notes && (
              <View style={styles.jobDetailNotes}>
                <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackWarning} />
                <Text style={styles.jobDetailNotesText}>{job.notes}</Text>
              </View>
            )}
          </View>

          {/* Assigned worker */}
          <View style={styles.jobDetailSection}>
            <Text style={styles.jobDetailSectionTitle}>Toegewezen Monteur</Text>
            {assignedWorker ? (
              <View style={styles.assignedWorkerDetail}>
                <View style={styles.assignedWorkerAvatar}>
                  <Text style={styles.assignedWorkerInitials}>{assignedWorker.initials}</Text>
                </View>
                <View style={styles.assignedWorkerInfo}>
                  <Text style={styles.assignedWorkerName}>{assignedWorker.name}</Text>
                  <Text style={styles.assignedWorkerTrade}>{assignedWorker.trade}</Text>
                  <WorkerStatusBadge status={assignedWorker.status} />
                </View>
                <Pressable style={styles.reassignButton} onPress={onReassign}>
                  <Ionicons name="swap-horizontal" size={16} color={Palette.hermesOrange} />
                  <Text style={styles.reassignButtonText}>Herplannen</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.noWorkerAssigned} onPress={onReassign}>
                <Ionicons name="person-add" size={24} color={SemanticColors.textTertiary} />
                <Text style={styles.noWorkerText}>Geen monteur toegewezen</Text>
                <Text style={styles.tapToAssign}>Tik om toe te wijzen</Text>
              </Pressable>
            )}
          </View>

          {/* Status update buttons */}
          {job.status !== 'completed' && job.status !== 'cancelled' && (
            <View style={styles.statusActions}>
              {nextStatus && (
                <Pressable
                  style={styles.updateStatusButton}
                  onPress={() => onUpdateStatus(nextStatus)}
                >
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                  <Text style={styles.updateStatusButtonText}>
                    Naar {nextStatus === 'dispatched' ? 'Uitgezet' :
                          nextStatus === 'traveling' ? 'Onderweg' :
                          nextStatus === 'in-progress' ? 'Bezig' :
                          nextStatus === 'completed' ? 'Afgerond' : nextStatus}
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={styles.cancelJobButton}
                onPress={() => onUpdateStatus('cancelled')}
              >
                <Ionicons name="close-circle" size={18} color={SemanticColors.feedbackError} />
                <Text style={styles.cancelJobButtonText}>Annuleer klus</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ============================================
// EXISTING COMPONENTS (from before)
// ============================================

function VascoGuidanceCard({ guidance, onAction, onDismiss }: {
  guidance: VascoGuidance;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  const priorityColors = {
    high: { bg: SemanticColors.feedbackErrorBg, border: SemanticColors.feedbackError, icon: SemanticColors.feedbackError },
    medium: { bg: '#FEF3C7', border: '#F59E0B', icon: '#D97706' },
    low: { bg: SemanticColors.feedbackInfoBg, border: SemanticColors.feedbackInfo, icon: SemanticColors.feedbackInfo },
  };
  const colors = priorityColors[guidance.priority];

  return (
    <View style={[styles.guidanceCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={styles.guidanceHeader}>
        <View style={[styles.guidanceIconContainer, { backgroundColor: colors.icon + '20' }]}>
          <Ionicons name={guidance.icon} size={20} color={colors.icon} />
        </View>
        <View style={styles.guidanceContent}>
          <Text style={[styles.guidanceTitle, { color: colors.icon }]}>{guidance.title}</Text>
          <Text style={styles.guidanceMessage}>{guidance.message}</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={20} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>
      {guidance.action && (
        <Pressable style={[styles.guidanceAction, { borderColor: colors.icon }]} onPress={onAction}>
          <Text style={[styles.guidanceActionText, { color: colors.icon }]}>{guidance.action.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.icon} />
        </Pressable>
      )}
    </View>
  );
}

function ShiftGrid({ contractors, selectedDate, onSlotPress }: {
  contractors: ContractorShift[];
  selectedDate: string;
  onSlotPress: (contractor: ContractorShift, slot: ShiftSlot['timeSlot']) => void;
}) {
  const getSlotColor = (status: string) => {
    switch (status) {
      case 'available': return { bg: SemanticColors.feedbackSuccessBg, text: SemanticColors.feedbackSuccess };
      case 'assigned': return { bg: Palette.hermesOrange + '20', text: Palette.hermesOrange };
      case 'sick': return { bg: SemanticColors.feedbackErrorBg, text: SemanticColors.feedbackError };
      case 'off': return { bg: SemanticColors.surfaceSecondary, text: SemanticColors.textTertiary };
      default: return { bg: SemanticColors.surfaceSecondary, text: SemanticColors.textTertiary };
    }
  };

  return (
    <View style={styles.shiftGrid}>
      {/* Header */}
      <View style={styles.shiftGridHeader}>
        <View style={styles.shiftGridNameCol}>
          <Text style={styles.shiftGridHeaderText}>Medewerker</Text>
        </View>
        {SHIFT_SLOTS.map(slot => (
          <View key={slot.id} style={styles.shiftGridSlotCol}>
            <Text style={styles.shiftGridHeaderText}>{slot.label}</Text>
            <Text style={styles.shiftGridHeaderTime}>{slot.startTime}</Text>
          </View>
        ))}
      </View>

      {/* Rows */}
      {contractors.map(contractor => {
        const dayShift = contractor.shifts.find(s => s.date === selectedDate);
        const slots = dayShift?.slots || { morning: 'off', afternoon: 'off', evening: 'off' };

        return (
          <View key={contractor.contractorId} style={styles.shiftGridRow}>
            <View style={styles.shiftGridNameCol}>
              <View style={styles.contractorInfo}>
                <View style={styles.contractorAvatar}>
                  <Text style={styles.contractorAvatarText}>
                    {contractor.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.contractorName} numberOfLines={1}>{contractor.name}</Text>
                  <Text style={styles.contractorTrade}>{contractor.trade}</Text>
                </View>
              </View>
            </View>
            {(['morning', 'afternoon', 'evening'] as const).map(slotTime => {
              const status = slots[slotTime];
              const colors = getSlotColor(status);
              return (
                <Pressable
                  key={slotTime}
                  style={[styles.shiftGridSlotCol, styles.shiftSlotCell, { backgroundColor: colors.bg }]}
                  onPress={() => onSlotPress(contractor, slotTime)}
                >
                  {status === 'available' && <Ionicons name="checkmark" size={18} color={colors.text} />}
                  {status === 'assigned' && <Ionicons name="construct" size={16} color={colors.text} />}
                  {status === 'sick' && <Ionicons name="medical" size={16} color={colors.text} />}
                  {status === 'off' && <Text style={[styles.shiftSlotText, { color: colors.text }]}>—</Text>}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function ContractorQuickCard({ contractor, onHire }: {
  contractor: ContractorShift;
  onHire: () => void;
}) {
  return (
    <View style={styles.quickCard}>
      <View style={styles.contractorAvatar}>
        <Text style={styles.contractorAvatarText}>
          {contractor.name.split(' ').map(n => n[0]).join('')}
        </Text>
      </View>
      <View style={styles.quickCardInfo}>
        <Text style={styles.quickCardName}>{contractor.name}</Text>
        <Text style={styles.quickCardTrade}>{contractor.trade}</Text>
        <View style={styles.quickCardCerts}>
          {contractor.certifications.slice(0, 2).map(cert => (
            <View key={cert} style={styles.certBadge}>
              <Text style={styles.certBadgeText}>{cert}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.quickCardRight}>
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={styles.ratingText}>{contractor.rating}</Text>
        </View>
        <Pressable style={styles.hireButton} onPress={onHire}>
          <Text style={styles.hireButtonText}>Inzetten</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HandoverCard({ item, onPress }: { item: HandoverItem; onPress: () => void }) {
  const statusConfig = {
    pending: { color: SemanticColors.feedbackWarning, label: 'Incompleet', icon: 'alert-circle' as IconName },
    ready: { color: SemanticColors.feedbackSuccess, label: 'Klaar', icon: 'checkmark-circle' as IconName },
    completed: { color: SemanticColors.textTertiary, label: 'Afgerond', icon: 'checkmark-done' as IconName },
  };
  const status = statusConfig[item.status];

  return (
    <Pressable style={styles.handoverCard} onPress={onPress}>
      <View style={styles.handoverHeader}>
        <View style={styles.handoverInfo}>
          <Text style={styles.handoverTitle}>{item.jobTitle}</Text>
          <Text style={styles.handoverCustomer}>{item.customer}</Text>
        </View>
        <View style={[styles.handoverStatus, { backgroundColor: status.color + '20' }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[styles.handoverStatusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.handoverProgress}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${item.completionPercent}%`, backgroundColor: status.color }]} />
        </View>
        <Text style={styles.progressText}>{item.completionPercent}%</Text>
      </View>

      {/* Missing Items */}
      {item.missingItems.length > 0 && (
        <View style={styles.missingItems}>
          <Text style={styles.missingLabel}>Ontbreekt:</Text>
          {item.missingItems.map((missing, idx) => (
            <View key={idx} style={styles.missingItem}>
              <Ionicons name="ellipse" size={6} color={SemanticColors.feedbackWarning} />
              <Text style={styles.missingItemText}>{missing}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function ScheduleAlertCard({ alert }: { alert: any }) {
  return (
    <View style={[styles.scheduleAlert, { borderLeftColor: alert.severity === 'high' ? SemanticColors.feedbackError : SemanticColors.feedbackWarning }]}>
      <Ionicons
        name={alert.severity === 'high' ? 'warning' : 'time'}
        size={18}
        color={alert.severity === 'high' ? SemanticColors.feedbackError : SemanticColors.feedbackWarning}
      />
      <View style={styles.scheduleAlertContent}>
        <Text style={styles.scheduleAlertTitle}>{alert.title || alert.activityName}</Text>
        <Text style={styles.scheduleAlertMessage}>{alert.description || alert.reason}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
    </View>
  );
}

function TabButton({ label, icon, isActive, onPress, badge }: {
  label: string;
  icon: IconName;
  isActive: boolean;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable style={[styles.tabButton, isActive && styles.tabButtonActive]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={isActive ? '#fff' : SemanticColors.textSecondary} />
      <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>{label}</Text>
      {badge && badge > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function ReplaceContractorModal({ visible, sickContractor, availableReplacements, onSelect, onClose }: {
  visible: boolean;
  sickContractor: ContractorShift | null;
  availableReplacements: ContractorShift[];
  onSelect: (contractor: ContractorShift) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose}>
            <Text style={styles.modalCancel}>Annuleer</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Vervanger Kiezen</Text>
          <View style={{ width: 60 }} />
        </View>

        {sickContractor && (
          <View style={styles.sickContractorInfo}>
            <Ionicons name="medical" size={24} color={SemanticColors.feedbackError} />
            <View>
              <Text style={styles.sickContractorName}>{sickContractor.name} is ziek</Text>
              <Text style={styles.sickContractorTrade}>Zoek vervanger voor {sickContractor.trade}</Text>
            </View>
          </View>
        )}

        <Text style={styles.modalSectionTitle}>Beschikbare Vervangers</Text>

        <ScrollView style={styles.modalScroll}>
          {availableReplacements.length > 0 ? (
            availableReplacements.map(contractor => (
              <ContractorQuickCard
                key={contractor.contractorId}
                contractor={contractor}
                onHire={() => onSelect(contractor)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={40} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyStateText}>Geen beschikbare vervangers met juiste certificaten</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function SiteLeadScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedGuidance, setDismissedGuidance] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedSickContractor, setSelectedSickContractor] = useState<ContractorShift | null>(null);

  // ServiceTitan-style dispatch state
  const [dispatchWorkers, setDispatchWorkers] = useState<DispatchWorker[]>(MOCK_DISPATCH_WORKERS);
  const [dispatchJobs, setDispatchJobs] = useState<DispatchJobItem[]>(MOCK_DISPATCH_JOB_ITEMS);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [showQuickAssignModal, setShowQuickAssignModal] = useState(false);
  const [showJobDetailModal, setShowJobDetailModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<DispatchJobItem | null>(null);

  // UI Guidance state
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
  const [showProgressTracker, setShowProgressTracker] = useState(true);
  const [milestones, setMilestones] = useState<ProgressMilestone[]>(SITELEAD_MILESTONES);

  // Services
  const { findings: auditFindings } = useAuditFindings('sitelead');
  const fragilityStats = useScheduleFragilityStats();

  // Mock data
  const [contractors] = useState<ContractorShift[]>(MOCK_CONTRACTOR_SHIFTS);
  const [handovers] = useState<HandoverItem[]>(MOCK_HANDOVERS);
  const [jobs] = useState<DispatchJob[]>(MOCK_DISPATCH_JOBS);

  // Dispatch stats
  const unassignedJobs = dispatchJobs.filter(j => j.status === 'unassigned').length;
  const urgentJobs = dispatchJobs.filter(j => j.priority === 'urgent' && j.status !== 'completed').length;
  const activeWorkers = dispatchWorkers.filter(w => w.status === 'on-job' || w.status === 'traveling').length;
  const availableWorkers = dispatchWorkers.filter(w => w.status === 'available').length;

  // Visible guidance
  const visibleGuidance = MOCK_VASCO_GUIDANCE.filter(g => !dismissedGuidance.includes(g.id));

  // Stats
  const sickCount = contractors.filter(c => {
    const dayShift = c.shifts.find(s => s.date === selectedDate);
    return dayShift?.slots.morning === 'sick' || dayShift?.slots.afternoon === 'sick';
  }).length;

  const availableCount = contractors.filter(c => {
    const dayShift = c.shifts.find(s => s.date === selectedDate);
    return dayShift?.slots.morning === 'available' || dayShift?.slots.afternoon === 'available';
  }).length;

  const pendingHandovers = handovers.filter(h => h.status === 'pending').length;
  const readyHandovers = handovers.filter(h => h.status === 'ready').length;

  // Find available replacements for sick contractor
  const availableReplacements = useMemo(() => {
    if (!selectedSickContractor) return [];
    return contractors.filter(c => {
      if (c.contractorId === selectedSickContractor.contractorId) return false;
      const dayShift = c.shifts.find(s => s.date === selectedDate);
      const isAvailable = dayShift?.slots.morning === 'available' || dayShift?.slots.afternoon === 'available';
      // Match by trade
      const sameTrade = c.trade === selectedSickContractor.trade;
      return isAvailable && sameTrade;
    });
  }, [selectedSickContractor, contractors, selectedDate]);

  // Handlers
  const handleDismissGuidance = (id: string) => {
    setDismissedGuidance([...dismissedGuidance, id]);
  };

  const handleGuidanceAction = (guidance: VascoGuidance) => {
    if (guidance.type === 'schedule' && guidance.title.includes('ziek')) {
      // Find the sick contractor
      const sick = contractors.find(c => {
        const dayShift = c.shifts.find(s => s.date === selectedDate);
        return dayShift?.slots.morning === 'sick';
      });
      if (sick) {
        setSelectedSickContractor(sick);
        setShowReplaceModal(true);
      }
    }
  };

  const handleSlotPress = (contractor: ContractorShift, slot: ShiftSlot['timeSlot']) => {
    const dayShift = contractor.shifts.find(s => s.date === selectedDate);
    const status = dayShift?.slots[slot];

    if (status === 'sick') {
      setSelectedSickContractor(contractor);
      setShowReplaceModal(true);
    } else if (status === 'available') {
      Alert.alert(
        `${contractor.name} toewijzen?`,
        `Wijs ${contractor.name} toe aan een klus voor ${slot === 'morning' ? 'ochtend' : slot === 'afternoon' ? 'middag' : 'avond'}?`,
        [
          { text: 'Annuleer', style: 'cancel' },
          { text: 'Kies klus', onPress: () => Alert.alert('Demo', 'Kluslijst zou hier openen') },
        ]
      );
    } else if (status === 'assigned') {
      Alert.alert(
        contractor.name,
        `Toegewezen aan: ${dayShift?.assignedJob || 'Onbekend'}\n\nTel: ${contractor.phone}`,
        [
          { text: 'OK' },
          { text: 'Bellen', onPress: () => {} },
        ]
      );
    }
  };

  const handleSelectReplacement = (replacement: ContractorShift) => {
    Alert.alert(
      'Vervanger ingezet',
      `${replacement.name} is ingezet als vervanger voor ${selectedSickContractor?.name}`,
      [{ text: 'OK' }]
    );
    setShowReplaceModal(false);
    setSelectedSickContractor(null);
  };

  // ServiceTitan-style dispatch handlers
  const handleQuickAssign = (job: DispatchJobItem) => {
    setSelectedJob(job);
    setShowQuickAssignModal(true);
  };

  const handleAssignWorker = (workerId: string) => {
    if (!selectedJob) return;

    setDispatchJobs(prev =>
      prev.map(j =>
        j.id === selectedJob.id
          ? { ...j, status: 'scheduled' as JobStatus, assignedTo: workerId }
          : j
      )
    );

    const worker = dispatchWorkers.find(w => w.id === workerId);
    Alert.alert(
      'Monteur toegewezen',
      `${worker?.name} is toegewezen aan "${selectedJob.title}"`,
      [{ text: 'OK' }]
    );

    setShowQuickAssignModal(false);
    setSelectedJob(null);
  };

  const handleJobPress = (job: DispatchJobItem) => {
    setSelectedJob(job);
    setShowJobDetailModal(true);
  };

  const handleUpdateJobStatus = (status: JobStatus) => {
    if (!selectedJob) return;

    setDispatchJobs(prev =>
      prev.map(j =>
        j.id === selectedJob.id
          ? { ...j, status }
          : j
      )
    );

    // Update worker status based on job status
    if (selectedJob.assignedTo) {
      setDispatchWorkers(prev =>
        prev.map(w => {
          if (w.id !== selectedJob.assignedTo) return w;
          if (status === 'traveling') return { ...w, status: 'traveling' as WorkerStatus, currentJob: selectedJob.id };
          if (status === 'in-progress') return { ...w, status: 'on-job' as WorkerStatus, currentJob: selectedJob.id };
          if (status === 'completed') return { ...w, status: 'available' as WorkerStatus, currentJob: undefined, completedToday: w.completedToday + 1 };
          return w;
        })
      );
    }

    setShowJobDetailModal(false);
    setSelectedJob(null);
  };

  const handleReassignJob = () => {
    setShowJobDetailModal(false);
    setShowQuickAssignModal(true);
  };

  // UI Guidance handlers
  const activeOnboardingTips = useMemo(() =>
    SITELEAD_ONBOARDING_TIPS.filter(tip => !dismissedTips.has(tip.id)),
    [dismissedTips]
  );

  const activeFeatureTips = useMemo(() =>
    SITELEAD_FEATURE_TIPS.filter(tip => !dismissedTips.has(tip.id)).slice(0, 1),
    [dismissedTips]
  );

  const handleDismissOnboardingTip = useCallback((id: string) => {
    setDismissedTips(prev => new Set(prev).add(id));
    if (SITELEAD_ONBOARDING_TIPS.every(t => t.id === id || dismissedTips.has(t.id))) {
      setShowOnboarding(false);
    }
  }, [dismissedTips]);

  const handleOnboardingAction = useCallback((tabOrRoute: string) => {
    // Switch to the relevant tab
    if (['dispatch', 'schedule', 'team', 'handover', 'overview'].includes(tabOrRoute)) {
      setActiveTab(tabOrRoute as TabView);
      setShowOnboarding(false);
    }
  }, []);

  const handleMilestonePress = useCallback((milestone: ProgressMilestone) => {
    switch (milestone.id) {
      case 'slm-3':
        setActiveTab('dispatch');
        break;
      case 'slm-4':
        setActiveTab('schedule');
        break;
      case 'slm-5':
        setActiveTab('handover');
        break;
    }
  }, []);

  const handleWhatNextPress = useCallback((action: string) => {
    if (['dispatch', 'schedule', 'team', 'handover', 'overview'].includes(action)) {
      setActiveTab(action as TabView);
    }
  }, []);

  const handleFeatureAction = useCallback((tabOrRoute: string) => {
    if (['dispatch', 'schedule', 'team', 'handover', 'overview'].includes(tabOrRoute)) {
      setActiveTab(tabOrRoute as TabView);
    }
  }, []);

  // Update milestone when job is assigned
  const updateMilestoneOnAssign = useCallback(() => {
    setMilestones(prev => prev.map(m =>
      m.id === 'slm-3' ? { ...m, completed: true, current: false } :
      m.id === 'slm-4' ? { ...m, current: true } : m
    ));
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const formattedDate = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Site Lead</Text>
          <Text style={styles.headerDate}>{formattedDate}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={22} color={SemanticColors.textPrimary} />
            {visibleGuidance.filter(g => g.priority === 'high').length > 0 && (
              <View style={styles.notificationBadge} />
            )}
          </Pressable>
          <Pressable style={styles.addButton}>
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Vasco AI Guidance - Top Banner */}
      {visibleGuidance.length > 0 && activeTab === 'overview' && (
        <View style={styles.guidanceContainer}>
          <View style={styles.guidanceLabel}>
            <Ionicons name="sparkles" size={16} color={Palette.hermesOrange} />
            <Text style={styles.guidanceLabelText}>Vasco Guidance</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guidanceScroll}>
            {visibleGuidance.map(guidance => (
              <VascoGuidanceCard
                key={guidance.id}
                guidance={guidance}
                onAction={() => handleGuidanceAction(guidance)}
                onDismiss={() => handleDismissGuidance(guidance.id)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, sickCount > 0 && { color: SemanticColors.feedbackError }]}>{sickCount}</Text>
          <Text style={styles.statLabel}>Ziek</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>{availableCount}</Text>
          <Text style={styles.statLabel}>Beschikbaar</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Palette.hermesOrange }]}>{jobs.filter(j => j.status === 'in-progress').length}</Text>
          <Text style={styles.statLabel}>Bezig</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, pendingHandovers > 0 && { color: SemanticColors.feedbackWarning }]}>{pendingHandovers}</Text>
          <Text style={styles.statLabel}>Handover</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          <TabButton
            label="Overzicht"
            icon="grid"
            isActive={activeTab === 'overview'}
            onPress={() => setActiveTab('overview')}
          />
          <TabButton
            label="Dispatch"
            icon="send"
            isActive={activeTab === 'dispatch'}
            onPress={() => setActiveTab('dispatch')}
            badge={unassignedJobs}
          />
          <TabButton
            label="Planning"
            icon="calendar"
            isActive={activeTab === 'schedule'}
            onPress={() => setActiveTab('schedule')}
            badge={sickCount}
          />
          <TabButton
            label="Team"
            icon="people"
            isActive={activeTab === 'team'}
            onPress={() => setActiveTab('team')}
          />
          <TabButton
            label="Handover"
            icon="document-text"
            isActive={activeTab === 'handover'}
            onPress={() => setActiveTab('handover')}
            badge={pendingHandovers}
          />
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {activeTab === 'overview' && (
          <>
            {/* Schedule Issues/Overruns */}
            {auditFindings.filter(f => f.categoryId === 'critical-path-risk').length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="warning" size={14} color={SemanticColors.feedbackError} /> Schedule Alerts
                </Text>
                {auditFindings
                  .filter(f => f.categoryId === 'critical-path-risk')
                  .slice(0, 3)
                  .map(alert => (
                    <ScheduleAlertCard key={alert.id} alert={alert} />
                  ))
                }
              </View>
            )}

            {/* Sick Contractors - Quick Action */}
            {sickCount > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="medical" size={14} color={SemanticColors.feedbackError} /> Zieke Medewerkers
                </Text>
                {contractors
                  .filter(c => {
                    const dayShift = c.shifts.find(s => s.date === selectedDate);
                    return dayShift?.slots.morning === 'sick';
                  })
                  .map(contractor => (
                    <Pressable
                      key={contractor.contractorId}
                      style={styles.sickCard}
                      onPress={() => {
                        setSelectedSickContractor(contractor);
                        setShowReplaceModal(true);
                      }}
                    >
                      <View style={styles.sickCardLeft}>
                        <Ionicons name="medical" size={18} color={SemanticColors.feedbackError} />
                        <View>
                          <Text style={styles.sickCardName}>{contractor.name}</Text>
                          <Text style={styles.sickCardTrade}>{contractor.trade}</Text>
                        </View>
                      </View>
                      <View style={styles.findReplacementButton}>
                        <Text style={styles.findReplacementText}>Zoek vervanger</Text>
                        <Ionicons name="chevron-forward" size={16} color={Palette.hermesOrange} />
                      </View>
                    </Pressable>
                  ))
                }
              </View>
            )}

            {/* Team Status Strip — "Wie is waar?" */}
            <View style={styles.section}>
              <Text style={styles.overviewSectionLabel}>WIE IS WAAR?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamStripScroll}>
                {dispatchWorkers.map(worker => {
                  const statusColor = worker.status === 'available' ? SemanticColors.feedbackSuccess
                    : worker.status === 'on-job' ? Palette.hermesOrange
                    : worker.status === 'traveling' ? '#2563EB'
                    : worker.status === 'break' ? SemanticColors.feedbackWarning
                    : worker.status === 'sick' ? SemanticColors.feedbackError
                    : SemanticColors.textTertiary;
                  const statusLabel = worker.status === 'available' ? 'Beschikbaar'
                    : worker.status === 'on-job' ? 'Bezig'
                    : worker.status === 'traveling' ? 'Onderweg'
                    : worker.status === 'break' ? 'Pauze'
                    : worker.status === 'sick' ? 'Ziek'
                    : 'Vrij';

                  return (
                    <Pressable
                      key={worker.id}
                      style={[
                        styles.teamStripCard,
                        worker.status === 'sick' && { borderColor: SemanticColors.feedbackError, backgroundColor: SemanticColors.feedbackErrorBg },
                      ]}
                      onPress={() => {
                        if (worker.status === 'available') {
                          setSelectedWorkerId(worker.id);
                          setActiveTab('dispatch');
                        } else {
                          Alert.alert(
                            worker.name,
                            `${worker.trade} — ${statusLabel}\n${worker.currentLocation || ''}\n\nTel: ${worker.phone}`,
                            [
                              { text: 'OK' },
                              { text: 'Dispatch', onPress: () => { setSelectedWorkerId(worker.id); setActiveTab('dispatch'); } },
                            ]
                          );
                        }
                      }}
                    >
                      <View style={[styles.teamStripAvatar, { borderColor: statusColor }]}>
                        <Text style={styles.teamStripInitials}>{worker.initials}</Text>
                      </View>
                      <Text style={styles.teamStripName} numberOfLines={1}>{worker.name.split(' ')[0]}</Text>
                      <Text style={styles.teamStripTrade} numberOfLines={1}>{worker.trade}</Text>
                      <View style={[styles.teamStripBadge, { backgroundColor: statusColor + '20' }]}>
                        <View style={[styles.teamStripDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.teamStripStatus, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Operations KPI Grid */}
            <View style={styles.section}>
              <Text style={styles.overviewSectionLabel}>OPERATIES</Text>
              <FinancialKPIGrid
                accentColor={Palette.hermesOrange}
                tiles={[
                  {
                    label: 'Actieve klussen',
                    value: String(dispatchJobs.filter(j => j.status === 'in-progress' || j.status === 'traveling').length),
                    status: urgentJobs > 0 ? 'amber' : 'green',
                    budgetLabel: `${dispatchJobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length} totaal vandaag`,
                  },
                  {
                    label: 'Monteurs beschikbaar',
                    value: `${availableWorkers}/${dispatchWorkers.length}`,
                    status: availableWorkers === 0 ? 'red' : availableWorkers <= 1 ? 'amber' : 'green',
                    budgetLabel: `${activeWorkers} actief bezig`,
                  },
                  {
                    label: 'Niet toegewezen',
                    value: String(unassignedJobs),
                    status: unassignedJobs > 0 ? 'red' : 'green',
                    budgetLabel: urgentJobs > 0 ? `${urgentJobs} spoed!` : 'Alles gepland',
                    onPress: unassignedJobs > 0 ? () => setActiveTab('dispatch') : undefined,
                  },
                  {
                    label: 'Handovers vandaag',
                    value: String(pendingHandovers + readyHandovers),
                    status: pendingHandovers > 0 ? 'amber' : 'green',
                    budgetLabel: `${readyHandovers} gereed, ${pendingHandovers} wachtend`,
                    onPress: () => setActiveTab('handover'),
                  },
                ] as KPITile[]}
              />
            </View>

            {/* Klussen Vandaag — Work Card List */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.overviewSectionLabel}>KLUSSEN VANDAAG</Text>
                <Pressable onPress={() => setActiveTab('dispatch')}>
                  <Text style={styles.seeAllLink}>Alle klussen</Text>
                </Pressable>
              </View>
              <WorkCardList
                jobs={dispatchJobs
                  .filter(j => j.status !== 'completed' && j.status !== 'cancelled')
                  .sort((a, b) => {
                    // Urgent first
                    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
                    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
                    // Then by status: in-progress > traveling > unassigned > scheduled
                    const statusOrder: Record<string, number> = { 'in-progress': 0, 'traveling': 1, 'unassigned': 2, 'scheduled': 3, 'dispatched': 4 };
                    return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
                  })
                  .map(j => ({
                    id: j.id,
                    time: j.scheduledTime,
                    title: j.title,
                    assignedTo: j.assignedTo ? dispatchWorkers.find(w => w.id === j.assignedTo)?.name : undefined,
                    status: j.status === 'dispatched' ? 'scheduled' as const : j.status as WorkCard['status'],
                    priority: j.priority,
                    jobType: j.jobType,
                  }))}
                maxVisible={5}
                onJobPress={(card) => {
                  const job = dispatchJobs.find(j => j.id === card.id);
                  if (job) handleJobPress(job);
                }}
                onQuickAssign={(card) => {
                  const job = dispatchJobs.find(j => j.id === card.id);
                  if (job) handleQuickAssign(job);
                }}
              />
            </View>

            {/* Dagplanning Mini-Timeline */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.overviewSectionLabel}>DAGPLANNING</Text>
                <Pressable onPress={() => setActiveTab('dispatch')}>
                  <Text style={styles.seeAllLink}>Dispatch</Text>
                </Pressable>
              </View>
              <JobTimeline jobs={dispatchJobs} />
            </View>

            {/* Quick Actions Grid */}
            <View style={styles.section}>
              <Text style={styles.overviewSectionLabel}>SNELLE ACTIES</Text>
              <View style={styles.quickActionsGrid}>
                <Pressable style={styles.quickActionBtn} onPress={() => {
                  Alert.alert('Nieuwe klus', 'Maak een nieuwe klus aan en wijs toe aan een monteur');
                }}>
                  <View style={[styles.quickActionIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
                    <Ionicons name="add-circle" size={22} color={Palette.hermesOrange} />
                  </View>
                  <Text style={styles.quickActionLabel}>Nieuwe klus</Text>
                </Pressable>
                <Pressable style={styles.quickActionBtn} onPress={() => {
                  Alert.alert('Monteur bellen', 'Selecteer een monteur om te bellen');
                }}>
                  <View style={[styles.quickActionIcon, { backgroundColor: '#2563EB15' }]}>
                    <Ionicons name="call" size={22} color="#2563EB" />
                  </View>
                  <Text style={styles.quickActionLabel}>Monteur bellen</Text>
                </Pressable>
                <Pressable style={styles.quickActionBtn} onPress={() => setActiveTab('handover')}>
                  <View style={[styles.quickActionIcon, { backgroundColor: SemanticColors.feedbackSuccessBg }]}>
                    <Ionicons name="swap-horizontal" size={22} color={SemanticColors.feedbackSuccess} />
                  </View>
                  <Text style={styles.quickActionLabel}>Handover</Text>
                  {pendingHandovers > 0 && (
                    <View style={styles.quickActionBadge}>
                      <Text style={styles.quickActionBadgeText}>{pendingHandovers}</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable style={styles.quickActionBtn} onPress={() => {
                  Alert.alert('Rapport', 'Dagrapport genereren voor vandaag');
                }}>
                  <View style={[styles.quickActionIcon, { backgroundColor: SemanticColors.feedbackInfoBg }]}>
                    <Ionicons name="document-text" size={22} color={SemanticColors.feedbackInfo} />
                  </View>
                  <Text style={styles.quickActionLabel}>Rapport</Text>
                </Pressable>
              </View>
            </View>

            {/* Pending Handovers */}
            {pendingHandovers > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.overviewSectionLabel}>HANDOVERS</Text>
                  <Pressable onPress={() => setActiveTab('handover')}>
                    <Text style={styles.seeAllLink}>Alles ({handovers.length})</Text>
                  </Pressable>
                </View>
                {handovers
                  .filter(h => h.status !== 'completed')
                  .slice(0, 2)
                  .map(item => (
                    <HandoverCard
                      key={item.id}
                      item={item}
                      onPress={() => Alert.alert('Handover', `Open handover voor ${item.jobTitle}`)}
                    />
                  ))
                }
              </View>
            )}
          </>
        )}

        {activeTab === 'dispatch' && (
          <>
            {/* ServiceTitan-style Dispatch Board */}

            {/* Dispatch Stats */}
            <View style={styles.dispatchStats}>
              <View style={[styles.dispatchStatItem, urgentJobs > 0 && styles.dispatchStatItemUrgent]}>
                <Ionicons name="alert-circle" size={20} color={urgentJobs > 0 ? SemanticColors.feedbackError : SemanticColors.textTertiary} />
                <Text style={[styles.dispatchStatValue, urgentJobs > 0 && { color: SemanticColors.feedbackError }]}>{urgentJobs}</Text>
                <Text style={styles.dispatchStatLabel}>Spoed</Text>
              </View>
              <View style={[styles.dispatchStatItem, unassignedJobs > 0 && styles.dispatchStatItemWarning]}>
                <Ionicons name="help-circle" size={20} color={unassignedJobs > 0 ? SemanticColors.feedbackWarning : SemanticColors.textTertiary} />
                <Text style={[styles.dispatchStatValue, unassignedJobs > 0 && { color: SemanticColors.feedbackWarning }]}>{unassignedJobs}</Text>
                <Text style={styles.dispatchStatLabel}>Niet toegewezen</Text>
              </View>
              <View style={styles.dispatchStatItem}>
                <Ionicons name="construct" size={20} color={Palette.hermesOrange} />
                <Text style={[styles.dispatchStatValue, { color: Palette.hermesOrange }]}>{activeWorkers}</Text>
                <Text style={styles.dispatchStatLabel}>Actief</Text>
              </View>
              <View style={styles.dispatchStatItem}>
                <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
                <Text style={[styles.dispatchStatValue, { color: SemanticColors.feedbackSuccess }]}>{availableWorkers}</Text>
                <Text style={styles.dispatchStatLabel}>Beschikbaar</Text>
              </View>
            </View>

            {/* Timeline View */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dagplanning Timeline</Text>
              <JobTimeline jobs={dispatchJobs} selectedWorkerId={selectedWorkerId || undefined} />
            </View>

            {/* Workers List */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Monteurs ({dispatchWorkers.length})</Text>
                {selectedWorkerId && (
                  <Pressable onPress={() => setSelectedWorkerId(null)}>
                    <Text style={styles.clearFilterLink}>Filter wissen</Text>
                  </Pressable>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workersScroll}>
                {dispatchWorkers.map(worker => (
                  <DispatchWorkerCard
                    key={worker.id}
                    worker={worker}
                    isSelected={selectedWorkerId === worker.id}
                    onPress={() => setSelectedWorkerId(selectedWorkerId === worker.id ? null : worker.id)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Jobs List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Klussen Vandaag ({selectedWorkerId
                  ? dispatchJobs.filter(j => j.assignedTo === selectedWorkerId).length
                  : dispatchJobs.length})
              </Text>

              {/* Unassigned jobs first if not filtered */}
              {!selectedWorkerId && unassignedJobs > 0 && (
                <View style={styles.unassignedSection}>
                  <View style={styles.unassignedHeader}>
                    <Ionicons name="alert-circle" size={16} color={SemanticColors.feedbackWarning} />
                    <Text style={styles.unassignedTitle}>Niet toegewezen ({unassignedJobs})</Text>
                  </View>
                  {dispatchJobs
                    .filter(j => j.status === 'unassigned')
                    .sort((a, b) => (a.priority === 'urgent' ? -1 : b.priority === 'urgent' ? 1 : 0))
                    .map(job => (
                      <DispatchJobCard
                        key={job.id}
                        job={job}
                        onPress={() => handleJobPress(job)}
                        onQuickAssign={() => handleQuickAssign(job)}
                      />
                    ))
                  }
                </View>
              )}

              {/* All other jobs or filtered jobs */}
              {dispatchJobs
                .filter(j => {
                  if (selectedWorkerId) return j.assignedTo === selectedWorkerId;
                  return j.status !== 'unassigned';
                })
                .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
                .map(job => (
                  <DispatchJobCard
                    key={job.id}
                    job={job}
                    onPress={() => handleJobPress(job)}
                    onQuickAssign={() => handleQuickAssign(job)}
                  />
                ))
              }
            </View>
          </>
        )}

        {activeTab === 'schedule' && (
          <>
            {/* Date Selector */}
            <View style={styles.dateSelector}>
              <Pressable
                style={[styles.dateOption, selectedDate === today && styles.dateOptionActive]}
                onPress={() => setSelectedDate(today)}
              >
                <Text style={[styles.dateOptionText, selectedDate === today && styles.dateOptionTextActive]}>Vandaag</Text>
              </Pressable>
              <Pressable
                style={[styles.dateOption, selectedDate === tomorrow && styles.dateOptionActive]}
                onPress={() => setSelectedDate(tomorrow)}
              >
                <Text style={[styles.dateOptionText, selectedDate === tomorrow && styles.dateOptionTextActive]}>Morgen</Text>
              </Pressable>
            </View>

            {/* Full Shift Grid */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Beschikbaarheid & Planning</Text>
              <ShiftGrid
                contractors={contractors}
                selectedDate={selectedDate}
                onSlotPress={handleSlotPress}
              />
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                <Text style={styles.legendText}>Beschikbaar</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Palette.hermesOrange }]} />
                <Text style={styles.legendText}>Toegewezen</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SemanticColors.feedbackError }]} />
                <Text style={styles.legendText}>Ziek</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SemanticColors.textTertiary }]} />
                <Text style={styles.legendText}>Vrij</Text>
              </View>
            </View>
          </>
        )}

        {activeTab === 'team' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Team Overzicht</Text>
              {contractors.map(contractor => {
                const dayShift = contractor.shifts.find(s => s.date === selectedDate);
                const currentStatus = dayShift?.slots.morning === 'sick' ? 'sick' :
                  dayShift?.slots.morning === 'assigned' ? 'assigned' :
                  dayShift?.slots.morning === 'available' ? 'available' : 'off';

                return (
                  <ContractorQuickCard
                    key={contractor.contractorId}
                    contractor={contractor}
                    onHire={() => {
                      if (currentStatus === 'available') {
                        Alert.alert('Inzetten', `Wijs ${contractor.name} toe aan een klus`);
                      }
                    }}
                  />
                );
              })}
            </View>
          </>
        )}

        {activeTab === 'handover' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Handovers</Text>
              {handovers.map(item => (
                <HandoverCard
                  key={item.id}
                  item={item}
                  onPress={() => Alert.alert('Handover', `Open handover details voor ${item.jobTitle}`)}
                />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Replace Contractor Modal */}
      <ReplaceContractorModal
        visible={showReplaceModal}
        sickContractor={selectedSickContractor}
        availableReplacements={availableReplacements}
        onSelect={handleSelectReplacement}
        onClose={() => {
          setShowReplaceModal(false);
          setSelectedSickContractor(null);
        }}
      />

      {/* ServiceTitan-style Quick Assign Modal */}
      <QuickAssignModal
        visible={showQuickAssignModal}
        job={selectedJob}
        workers={dispatchWorkers}
        onAssign={handleAssignWorker}
        onClose={() => {
          setShowQuickAssignModal(false);
          setSelectedJob(null);
        }}
      />

      {/* Job Detail Modal */}
      <JobDetailModal
        visible={showJobDetailModal}
        job={selectedJob}
        workers={dispatchWorkers}
        onClose={() => {
          setShowJobDetailModal(false);
          setSelectedJob(null);
        }}
        onUpdateStatus={handleUpdateJobStatus}
        onReassign={handleReassignJob}
      />
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 56,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerDate: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.feedbackError,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Vasco Guidance
  guidanceContainer: {
    paddingBottom: Spacing.sm,
  },
  guidanceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  guidanceLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.hermesOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  guidanceScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  guidanceCard: {
    width: 300,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  guidanceHeader: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  guidanceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceContent: {
    flex: 1,
  },
  guidanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  guidanceMessage: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  guidanceAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  guidanceActionText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: SemanticColors.borderDefault,
  },

  // Tabs
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tabScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabButtonActive: {
    backgroundColor: Palette.hermesOrange,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: SemanticColors.feedbackError,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // Overview Section Label (Fabrico-style uppercase)
  overviewSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Team Status Strip
  teamStripScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  teamStripCard: {
    width: 90,
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    gap: 4,
  },
  teamStripAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  teamStripInitials: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  teamStripName: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  teamStripTrade: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
  teamStripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  teamStripDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  teamStripStatus: {
    fontSize: 9,
    fontWeight: '600',
  },

  // Quick Actions Grid (Overview)
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionBtn: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    position: 'relative',
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  quickActionBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: SemanticColors.feedbackError,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  // Shift Grid
  shiftGrid: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  shiftGridHeader: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingVertical: Spacing.sm,
  },
  shiftGridNameCol: {
    width: 140,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
  },
  shiftGridSlotCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftGridHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  shiftGridHeaderTime: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  shiftGridRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
    paddingVertical: Spacing.xs,
  },
  shiftSlotCell: {
    height: 40,
    marginHorizontal: 2,
    borderRadius: 6,
  },
  shiftSlotText: {
    fontSize: 12,
  },
  contractorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  contractorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contractorAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  contractorName: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  contractorTrade: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Sick Card
  sickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: 12,
    padding: Spacing.md,
  },
  sickCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sickCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  sickCardTrade: {
    fontSize: 12,
    color: SemanticColors.feedbackError,
    opacity: 0.8,
  },
  findReplacementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  findReplacementText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // Schedule Alert
  scheduleAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: Spacing.md,
    borderLeftWidth: 3,
  },
  scheduleAlertContent: {
    flex: 1,
  },
  scheduleAlertTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  scheduleAlertMessage: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Handover Card
  handoverCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  handoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  handoverInfo: {
    flex: 1,
  },
  handoverTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  handoverCustomer: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  handoverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  handoverStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  handoverProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    width: 36,
    textAlign: 'right',
  },
  missingItems: {
    gap: 4,
  },
  missingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.feedbackWarning,
  },
  missingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missingItemText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Quick Card
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  quickCardInfo: {
    flex: 1,
  },
  quickCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  quickCardTrade: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  quickCardCerts: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  certBadge: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  certBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.feedbackInfo,
  },
  quickCardRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  hireButton: {
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  hireButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // Date Selector
  dateSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dateOption: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
  },
  dateOptionActive: {
    backgroundColor: Palette.hermesOrange,
  },
  dateOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  dateOptionTextActive: {
    color: '#fff',
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  modalCancel: {
    fontSize: 16,
    color: SemanticColors.textSecondary,
    width: 60,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    padding: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  sickContractorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: SemanticColors.feedbackErrorBg,
    margin: Spacing.md,
    borderRadius: 12,
  },
  sickContractorName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  sickContractorTrade: {
    fontSize: 13,
    color: SemanticColors.feedbackError,
    opacity: 0.8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyStateText: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },

  // ============================================
  // SERVICETITAN-STYLE DISPATCH STYLES
  // ============================================

  // Worker Status Badge
  workerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  workerStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Priority Badge
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Job Status Badge
  jobStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Dispatch Stats
  dispatchStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  dispatchStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  dispatchStatItemUrgent: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  dispatchStatItemWarning: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  dispatchStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  dispatchStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Dispatch Worker Card
  dispatchWorkerCard: {
    width: 200,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  dispatchWorkerCardSelected: {
    borderColor: Palette.hermesOrange,
    borderWidth: 2,
  },
  dispatchWorkerCardSick: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderColor: SemanticColors.feedbackError,
  },
  dispatchWorkerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dispatchWorkerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dispatchWorkerInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Palette.hermesOrange,
    borderWidth: 2,
    borderColor: SemanticColors.surfacePrimary,
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
    color: SemanticColors.textSecondary,
  },
  dispatchWorkerMeta: {
    alignItems: 'flex-end',
  },
  ratingMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingMiniText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  completedCount: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  workerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workerLocationText: {
    flex: 1,
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  workerEta: {
    fontSize: 10,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  skillsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  skillChip: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skillChipText: {
    fontSize: 9,
    fontWeight: '600',
    color: SemanticColors.feedbackInfo,
  },
  moreSkills: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    alignSelf: 'center',
  },

  // Workers horizontal scroll
  workersScroll: {
    paddingVertical: Spacing.xs,
  },
  clearFilterLink: {
    fontSize: 13,
    color: Palette.hermesOrange,
    fontWeight: '600',
  },

  // Dispatch Job Card
  dispatchJobCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.xs,
  },
  dispatchJobCardUrgent: {
    borderColor: SemanticColors.feedbackError,
    borderWidth: 2,
  },
  dispatchJobCardUnassigned: {
    borderColor: SemanticColors.feedbackWarning,
    borderLeftWidth: 4,
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
  },
  dispatchJobBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  dispatchJobTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  dispatchJobType: {
    fontSize: 12,
    color: Palette.hermesOrange,
    fontWeight: '500',
  },
  dispatchJobCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dispatchJobCustomerText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  dispatchJobAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dispatchJobAddressText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    flex: 1,
  },
  dispatchJobNotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackWarningBg,
    padding: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  dispatchJobNotesText: {
    fontSize: 11,
    color: SemanticColors.feedbackWarning,
    flex: 1,
  },
  requiredSkillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  requiredSkillsLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  requiredSkillChip: {
    backgroundColor: SemanticColors.feedbackInfoBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredSkillChipText: {
    fontSize: 10,
    fontWeight: '500',
    color: SemanticColors.feedbackInfo,
  },
  dispatchJobActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  quickAssignButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Palette.hermesOrange,
    paddingVertical: 10,
    borderRadius: 8,
  },
  quickAssignButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  assignedWorkerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.hermesOrange + '15',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  assignedWorkerText: {
    fontSize: 13,
    fontWeight: '500',
    color: Palette.hermesOrange,
  },
  jobActionButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Unassigned section
  unassignedSection: {
    marginBottom: Spacing.md,
  },
  unassignedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  unassignedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.feedbackWarning,
  },

  // Job Timeline
  jobTimeline: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  timelineHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  timeMarker: {
    flex: 1,
  },
  timeMarkerText: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  timelineTrack: {
    height: 50,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  currentTimeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    alignItems: 'center',
    zIndex: 10,
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.feedbackError,
    marginTop: -4,
  },
  currentTimeLine: {
    flex: 1,
    width: 2,
    backgroundColor: SemanticColors.feedbackError,
  },
  timelineJobBlock: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    borderRadius: 6,
    borderWidth: 2,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  timelineJobText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Quick Assign Modal
  assignJobSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    margin: Spacing.md,
    borderRadius: 12,
  },
  assignJobInfo: {
    flex: 1,
  },
  assignJobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  assignJobCustomer: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  assignJobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  assignJobMetaText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  requiredSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  requiredSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.xs,
  },
  requiredChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  requiredCertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackInfoBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  requiredCertText: {
    fontSize: 12,
    fontWeight: '500',
    color: SemanticColors.feedbackInfo,
  },

  // Recommended Worker Card
  recommendedWorkerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  recommendedWorkerCardTop: {
    borderColor: Palette.hermesOrange,
    borderWidth: 2,
    backgroundColor: Palette.hermesOrange + '08',
  },
  recommendedWorkerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  recommendedWorkerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  recommendedWorkerInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  topMatchBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: SemanticColors.surfacePrimary,
  },
  recommendedWorkerInfo: {
    flex: 1,
  },
  recommendedWorkerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendedWorkerName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  bestMatchLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Palette.hermesOrange,
    backgroundColor: Palette.hermesOrange + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedWorkerTrade: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  matchedCertsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  matchedCertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchedCertText: {
    fontSize: 10,
    fontWeight: '500',
    color: SemanticColors.feedbackSuccess,
  },
  recommendedWorkerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  matchScoreBadge: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchScoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },

  // Job Detail Modal
  jobDetailHeader: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  jobDetailBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  jobDetailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  jobDetailType: {
    fontSize: 14,
    color: Palette.hermesOrange,
    fontWeight: '500',
    marginTop: 4,
  },
  jobDetailSection: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  jobDetailSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: Spacing.sm,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  jobDetailRowContent: {
    flex: 1,
  },
  jobDetailLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  jobDetailValue: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
    fontWeight: '500',
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobDetailDescription: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
    lineHeight: 20,
  },
  jobDetailNotes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: SemanticColors.feedbackWarningBg,
    padding: Spacing.sm,
    borderRadius: 8,
    marginTop: Spacing.sm,
  },
  jobDetailNotesText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.feedbackWarning,
  },
  assignedWorkerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  assignedWorkerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignedWorkerInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  assignedWorkerInfo: {
    flex: 1,
    gap: 4,
  },
  assignedWorkerName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  assignedWorkerTrade: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  reassignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Palette.hermesOrange + '15',
    borderRadius: 8,
  },
  reassignButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  noWorkerAssigned: {
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    gap: 8,
  },
  noWorkerText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  tapToAssign: {
    fontSize: 12,
    color: Palette.hermesOrange,
    fontWeight: '600',
  },
  statusActions: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  updateStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange,
    paddingVertical: 14,
    borderRadius: 10,
  },
  updateStatusButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  cancelJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingVertical: 14,
    borderRadius: 10,
  },
  cancelJobButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },

  // ============================================
  // UI GUIDANCE STYLES (Site Lead)
  // ============================================

  // Onboarding Carousel
  slOnboardingCarousel: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Palette.hermesOrange,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  slOnboardingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slOnboardingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slOnboardingDots: {
    flexDirection: 'row',
    gap: 6,
  },
  slOnboardingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.borderDefault,
  },
  slOnboardingDotActive: {
    backgroundColor: Palette.hermesOrange,
    width: 20,
  },
  slOnboardingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  slOnboardingDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },
  slOnboardingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  slOnboardingPrevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
  },
  slOnboardingPrevText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  slOnboardingNextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
  },
  slOnboardingNextText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  slOnboardingActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.hermesOrange,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  slOnboardingActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Progress Tracker
  slProgressTracker: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  slProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slProgressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slProgressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  slProgressPercent: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },
  slProgressBarContainer: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  slProgressBarFill: {
    height: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 4,
  },
  slMilestonesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slMilestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slMilestoneIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
  },
  slMilestoneIconCompleted: {
    backgroundColor: SemanticColors.feedbackSuccess,
    borderColor: SemanticColors.feedbackSuccess,
  },
  slMilestoneIconCurrent: {
    borderColor: Palette.hermesOrange,
    borderWidth: 2,
  },
  slMilestoneLine: {
    width: 20,
    height: 2,
    backgroundColor: SemanticColors.borderDefault,
    marginLeft: 4,
  },
  slMilestoneLineCompleted: {
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  slCurrentMilestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.hermesOrange + '10',
    padding: Spacing.sm,
    borderRadius: 8,
  },
  slCurrentMilestoneContent: {
    flex: 1,
  },
  slCurrentMilestoneTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  slCurrentMilestoneDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Feature Card
  slFeatureCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  slFeatureCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slFeatureNewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  slFeatureNewText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  slFeatureCardContent: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  slFeatureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slFeatureTextContent: {
    flex: 1,
    gap: 4,
  },
  slFeatureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  slFeatureDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  slFeatureActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: Spacing.xs,
  },
  slFeatureActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // What to do next
  slWhatNextCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  slWhatNextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slWhatNextTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  slWhatNextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  slWhatNextItem: {
    width: '48%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  slWhatNextIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  slWhatNextItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  slWhatNextItemSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
});
