// =============================================================================
// TODAY - Contractor Dashboard with Vasco AI Guidance
// =============================================================================
// Smart contractor dashboard with:
// - Vasco AI Guidance (weather, recommendations, alerts)
// - Today's schedule
// - Earnings overview
// - Audit findings
// - Quick actions
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { useAuth } from '../../src/context/AuthContext';

// Core services
import { useDaySchedule } from '../../src/services/smartSchedulerService';
import { useCashFlow } from '../../src/services/cashFlowService';

// AI services
import { useAuditFindings } from '../../src/services/auditorService';
import { useFinancialAuditStats } from '../../src/services/financialAuditorService';
import { useComplianceAlerts } from '../../src/services/complianceService';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// VASCO AI GUIDANCE
// ============================================

type VascoGuidanceType = 'weather' | 'schedule' | 'earnings' | 'compliance' | 'tip' | 'alert';

interface VascoGuidance {
  id: string;
  type: VascoGuidanceType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  icon: IconName;
  actionLabel?: string;
  actionRoute?: string;
  timestamp: string;
}

const MOCK_VASCO_GUIDANCE: VascoGuidance[] = [
  {
    id: 'vg-1',
    type: 'weather',
    priority: 'high',
    title: 'Regen verwacht',
    message: 'Tussen 14:00-17:00 wordt regen verwacht. Plan buitenwerk indien mogelijk voor de ochtend.',
    icon: 'rainy',
    timestamp: '08:15',
  },
  {
    id: 'vg-2',
    type: 'earnings',
    priority: 'medium',
    title: 'Factuur herinnering',
    message: 'Factuur #2024-089 (€2.450) is al 7 dagen onbetaald. Stuur een herinnering.',
    icon: 'receipt',
    actionLabel: 'Herinnering sturen',
    actionRoute: '/(contractor)/facturen',
    timestamp: '08:30',
  },
  {
    id: 'vg-3',
    type: 'compliance',
    priority: 'critical',
    title: 'VCA verloopt binnenkort',
    message: 'Je VCA certificaat verloopt over 12 dagen. Plan nu je herexamen.',
    icon: 'shield-checkmark',
    actionLabel: 'Bekijk certificaten',
    actionRoute: '/(contractor)/certificaten',
    timestamp: 'Gisteren',
  },
  {
    id: 'vg-4',
    type: 'tip',
    priority: 'low',
    title: 'Bespaar op materiaal',
    message: 'Koper buizen zijn 15% goedkoper bij Technische Unie deze week. Overweeg voorraad aan te vullen.',
    icon: 'bulb',
    actionLabel: 'Bekijk aanbiedingen',
    actionRoute: '/(contractor)/besparen',
    timestamp: 'Vandaag',
  },
  {
    id: 'vg-5',
    type: 'schedule',
    priority: 'medium',
    title: 'Klant niet thuis',
    message: 'Klant Van Dijk (14:00) heeft laten weten later thuis te zijn. Nieuwe tijd: 15:00.',
    icon: 'time',
    timestamp: '10 min geleden',
  },
];

// ============================================
// UI GUIDANCE & ONBOARDING
// ============================================

interface UIGuidanceTip {
  id: string;
  category: 'onboarding' | 'feature' | 'productivity' | 'achievement';
  title: string;
  description: string;
  icon: IconName;
  action?: { label: string; route: string };
  dismissible: boolean;
  priority: number; // Higher = more important
}

interface ProgressMilestone {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  completed: boolean;
  current?: boolean;
}

// Onboarding tips for new users
const ONBOARDING_TIPS: UIGuidanceTip[] = [
  {
    id: 'onboard-1',
    category: 'onboarding',
    title: 'Welkom bij Vasco!',
    description: 'Je persoonlijke assistent voor al je zakelijke taken. Swipe door de tips om te leren hoe je het meeste uit de app haalt.',
    icon: 'sparkles',
    dismissible: false,
    priority: 100,
  },
  {
    id: 'onboard-2',
    category: 'onboarding',
    title: 'Snelle offerte maken',
    description: 'Tik op "+ Offerte" om binnen 2 minuten een professionele offerte te maken met AI-ondersteuning.',
    icon: 'document-text',
    action: { label: 'Probeer nu', route: '/contractor/tiered-quote' },
    dismissible: true,
    priority: 90,
  },
  {
    id: 'onboard-3',
    category: 'onboarding',
    title: 'Certificaten beheren',
    description: 'Upload je VCA, NEN en andere certificaten. Vasco waarschuwt je automatisch voordat ze verlopen.',
    icon: 'shield-checkmark',
    action: { label: 'Uploaden', route: '/(contractor)/certificaten' },
    dismissible: true,
    priority: 85,
  },
  {
    id: 'onboard-4',
    category: 'onboarding',
    title: 'Bespaar op inkoop',
    description: 'Vergelijk prijzen bij meerdere leveranciers en bespaar gemiddeld 12% op je materiaalkosten.',
    icon: 'pricetag',
    action: { label: 'Bekijken', route: '/(contractor)/besparen' },
    dismissible: true,
    priority: 80,
  },
];

// Feature discovery tips
const FEATURE_TIPS: UIGuidanceTip[] = [
  {
    id: 'feat-1',
    category: 'feature',
    title: 'AI Offerte Generator',
    description: 'Laat Vasco automatisch een gedetailleerde offerte opstellen op basis van je beschrijving.',
    icon: 'flash',
    action: { label: 'Ontdek', route: '/contractor/tiered-quote' },
    dismissible: true,
    priority: 70,
  },
  {
    id: 'feat-2',
    category: 'feature',
    title: 'Foto naar Factuur',
    description: 'Maak een foto van je bonnetje en Vasco haalt automatisch de gegevens eruit voor je administratie.',
    icon: 'camera',
    dismissible: true,
    priority: 65,
  },
  {
    id: 'feat-3',
    category: 'feature',
    title: 'Slimme Herinneringen',
    description: 'Vasco stuurt automatisch betalingsherinneringen naar klanten met onbetaalde facturen.',
    icon: 'notifications',
    action: { label: 'Instellingen', route: '/(contractor)/facturen' },
    dismissible: true,
    priority: 60,
  },
];

// Progress milestones
const PROGRESS_MILESTONES: ProgressMilestone[] = [
  { id: 'p1', title: 'Account aangemaakt', description: 'Je bent begonnen!', icon: 'checkmark-circle', completed: true },
  { id: 'p2', title: 'Profiel compleet', description: 'Bedrijfsgegevens ingevuld', icon: 'person', completed: true },
  { id: 'p3', title: 'Eerste offerte', description: 'Maak je eerste offerte', icon: 'document-text', completed: false, current: true },
  { id: 'p4', title: 'Certificaten up-to-date', description: 'Upload je certificaten', icon: 'shield-checkmark', completed: false },
  { id: 'p5', title: 'Eerste factuur verstuurd', description: 'Stuur je eerste factuur', icon: 'receipt', completed: false },
];

// ============================================
// TYPES
// ============================================

interface JobItem {
  id: string;
  title: string;
  customer: string;
  address: string;
  time: string;
  duration: string;
  status: 'active' | 'upcoming' | 'completed';
}

interface AlertItem {
  id: string;
  type: 'warning' | 'success' | 'info';
  icon: IconName;
  text: string;
  action?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPriorityColor(priority: VascoGuidance['priority']): string {
  switch (priority) {
    case 'critical': return SemanticColors.feedbackError;
    case 'high': return SemanticColors.feedbackWarning;
    case 'medium': return Palette.hermesOrange;
    case 'low': return SemanticColors.textTertiary;
  }
}

function getPriorityBg(priority: VascoGuidance['priority']): string {
  switch (priority) {
    case 'critical': return SemanticColors.feedbackErrorBg;
    case 'high': return SemanticColors.feedbackWarningBg;
    case 'medium': return Palette.hermesOrange + '15';
    case 'low': return SemanticColors.surfaceSecondary;
  }
}

// ============================================
// UI GUIDANCE COMPONENTS
// ============================================

function OnboardingCarousel({ tips, onDismiss, onAction }: {
  tips: UIGuidanceTip[];
  onDismiss: (id: string) => void;
  onAction: (route: string) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const tip = tips[currentIndex];

  if (!tip) return null;

  return (
    <View style={styles.onboardingCarousel}>
      <View style={styles.onboardingHeader}>
        <View style={styles.onboardingIconContainer}>
          <Ionicons name={tip.icon} size={24} color={Palette.hermesOrange} />
        </View>
        <View style={styles.onboardingDots}>
          {tips.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.onboardingDot,
                idx === currentIndex && styles.onboardingDotActive
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

      <Text style={styles.onboardingTitle}>{tip.title}</Text>
      <Text style={styles.onboardingDescription}>{tip.description}</Text>

      <View style={styles.onboardingActions}>
        {currentIndex > 0 && (
          <Pressable
            style={styles.onboardingPrevButton}
            onPress={() => setCurrentIndex(currentIndex - 1)}
          >
            <Ionicons name="chevron-back" size={18} color={SemanticColors.textSecondary} />
            <Text style={styles.onboardingPrevText}>Vorige</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {tip.action ? (
          <Pressable
            style={styles.onboardingActionButton}
            onPress={() => onAction(tip.action!.route)}
          >
            <Text style={styles.onboardingActionText}>{tip.action.label}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        ) : currentIndex < tips.length - 1 ? (
          <Pressable
            style={styles.onboardingNextButton}
            onPress={() => setCurrentIndex(currentIndex + 1)}
          >
            <Text style={styles.onboardingNextText}>Volgende</Text>
            <Ionicons name="chevron-forward" size={18} color={Palette.hermesOrange} />
          </Pressable>
        ) : (
          <Pressable
            style={styles.onboardingActionButton}
            onPress={() => onDismiss(tip.id)}
          >
            <Text style={styles.onboardingActionText}>Aan de slag!</Text>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ProgressTracker({ milestones, onMilestonePress }: {
  milestones: ProgressMilestone[];
  onMilestonePress: (milestone: ProgressMilestone) => void;
}) {
  const completedCount = milestones.filter(m => m.completed).length;
  const progressPercent = (completedCount / milestones.length) * 100;

  return (
    <View style={styles.progressTracker}>
      <View style={styles.progressHeader}>
        <View style={styles.progressTitleRow}>
          <Ionicons name="trophy" size={18} color={Palette.hermesOrange} />
          <Text style={styles.progressTitle}>Je voortgang</Text>
        </View>
        <Text style={styles.progressPercent}>{Math.round(progressPercent)}%</Text>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.milestonesRow}>
        {milestones.map((milestone, index) => (
          <Pressable
            key={milestone.id}
            style={styles.milestoneItem}
            onPress={() => !milestone.completed && onMilestonePress(milestone)}
          >
            <View style={[
              styles.milestoneIcon,
              milestone.completed && styles.milestoneIconCompleted,
              milestone.current && styles.milestoneIconCurrent,
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
                styles.milestoneLine,
                milestone.completed && styles.milestoneLineCompleted
              ]} />
            )}
          </Pressable>
        ))}
      </View>

      {/* Current milestone callout */}
      {milestones.find(m => m.current) && (
        <View style={styles.currentMilestoneCard}>
          <Ionicons name="arrow-forward-circle" size={18} color={Palette.hermesOrange} />
          <View style={styles.currentMilestoneContent}>
            <Text style={styles.currentMilestoneTitle}>
              Volgende stap: {milestones.find(m => m.current)?.title}
            </Text>
            <Text style={styles.currentMilestoneDesc}>
              {milestones.find(m => m.current)?.description}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function FeatureDiscoveryCard({ tip, onAction, onDismiss }: {
  tip: UIGuidanceTip;
  onAction: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureCardHeader}>
        <View style={styles.featureNewBadge}>
          <Ionicons name="sparkles" size={10} color="#fff" />
          <Text style={styles.featureNewText}>NIEUW</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={18} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.featureCardContent}>
        <View style={styles.featureIconContainer}>
          <Ionicons name={tip.icon} size={28} color={Palette.hermesOrange} />
        </View>
        <View style={styles.featureTextContent}>
          <Text style={styles.featureTitle}>{tip.title}</Text>
          <Text style={styles.featureDescription}>{tip.description}</Text>
        </View>
      </View>

      {tip.action && (
        <Pressable style={styles.featureActionButton} onPress={onAction}>
          <Text style={styles.featureActionText}>{tip.action.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={Palette.hermesOrange} />
        </Pressable>
      )}
    </View>
  );
}

function ContextualCoachMark({ message, position, onDismiss }: {
  message: string;
  position: 'top' | 'bottom';
  onDismiss: () => void;
}) {
  return (
    <View style={[
      styles.coachMark,
      position === 'top' ? styles.coachMarkTop : styles.coachMarkBottom
    ]}>
      <View style={styles.coachMarkArrow} />
      <View style={styles.coachMarkContent}>
        <Ionicons name="bulb" size={16} color={Palette.hermesOrange} />
        <Text style={styles.coachMarkText}>{message}</Text>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

function WhatToDoNextCard({ suggestions, onSuggestionPress }: {
  suggestions: { id: string; icon: IconName; title: string; subtitle: string; route: string }[];
  onSuggestionPress: (route: string) => void;
}) {
  return (
    <View style={styles.whatNextCard}>
      <View style={styles.whatNextHeader}>
        <Ionicons name="compass" size={18} color={Palette.hermesOrange} />
        <Text style={styles.whatNextTitle}>Wat wil je doen?</Text>
      </View>

      <View style={styles.whatNextGrid}>
        {suggestions.map(suggestion => (
          <Pressable
            key={suggestion.id}
            style={styles.whatNextItem}
            onPress={() => onSuggestionPress(suggestion.route)}
          >
            <View style={styles.whatNextIconContainer}>
              <Ionicons name={suggestion.icon} size={22} color={Palette.hermesOrange} />
            </View>
            <Text style={styles.whatNextItemTitle}>{suggestion.title}</Text>
            <Text style={styles.whatNextItemSubtitle}>{suggestion.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ============================================
// EXISTING COMPONENTS
// ============================================

function VascoGuidanceCard({ guidance, onAction, onDismiss }: {
  guidance: VascoGuidance;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <View style={[styles.guidanceCard, { borderLeftColor: getPriorityColor(guidance.priority) }]}>
      <View style={styles.guidanceHeader}>
        <View style={[styles.guidanceIconContainer, { backgroundColor: getPriorityBg(guidance.priority) }]}>
          <Ionicons name={guidance.icon} size={18} color={getPriorityColor(guidance.priority)} />
        </View>
        <View style={styles.guidanceHeaderText}>
          <Text style={styles.guidanceTitle}>{guidance.title}</Text>
          <Text style={styles.guidanceTimestamp}>{guidance.timestamp}</Text>
        </View>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Ionicons name="close" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        )}
      </View>
      <Text style={styles.guidanceMessage}>{guidance.message}</Text>
      {guidance.actionLabel && (
        <Pressable style={styles.guidanceAction} onPress={onAction}>
          <Text style={styles.guidanceActionText}>{guidance.actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={Palette.hermesOrange} />
        </Pressable>
      )}
    </View>
  );
}

function MoneyCard({ outstanding, thisWeek, pendingCount }: {
  outstanding: number;
  thisWeek: number;
  pendingCount: number;
}) {
  const router = useRouter();

  return (
    <Pressable style={styles.moneyCard} onPress={() => router.push('/(contractor)/facturen')}>
      <View style={styles.moneyRow}>
        <View style={styles.moneyItem}>
          <Text style={styles.moneyLabel}>Openstaand</Text>
          <Text style={styles.moneyValue}>€{outstanding.toLocaleString('nl-NL')}</Text>
          <Text style={styles.moneySubtext}>{pendingCount} facturen</Text>
        </View>
        <View style={styles.moneyDivider} />
        <View style={styles.moneyItem}>
          <Text style={styles.moneyLabel}>Deze week</Text>
          <Text style={[styles.moneyValue, { color: SemanticColors.feedbackSuccess }]}>
            €{thisWeek.toLocaleString('nl-NL')}
          </Text>
          <Text style={styles.moneySubtext}>ontvangen</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

function JobCard({ job, onPress }: { job: JobItem; onPress: () => void }) {
  return (
    <Pressable style={styles.jobCard} onPress={onPress}>
      <View style={styles.jobCardHeader}>
        <View style={styles.jobTimeContainer}>
          <Text style={[
            styles.jobTime,
            job.status === 'active' && styles.jobTimeActive
          ]}>
            {job.time}
          </Text>
          <Text style={styles.jobDuration}>{job.duration}</Text>
        </View>
        {job.status === 'active' && (
          <View style={styles.jobActiveTag}>
            <View style={styles.jobActiveDot} />
            <Text style={styles.jobActiveText}>ACTIEF</Text>
          </View>
        )}
        {job.status === 'completed' && (
          <View style={styles.jobCompletedTag}>
            <Ionicons name="checkmark" size={12} color={SemanticColors.feedbackSuccess} />
            <Text style={styles.jobCompletedText}>KLAAR</Text>
          </View>
        )}
      </View>
      <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
      <Text style={styles.jobCustomer} numberOfLines={1}>{job.customer}</Text>
      <View style={styles.jobAddress}>
        <Ionicons name="location-outline" size={12} color={SemanticColors.textTertiary} />
        <Text style={styles.jobAddressText} numberOfLines={1}>{job.address}</Text>
      </View>
    </Pressable>
  );
}

function QuickActions() {
  const router = useRouter();

  const actions = [
    { icon: 'add' as IconName, label: 'Offerte', route: '/contractor/tiered-quote', primary: true },
    { icon: 'receipt-outline' as IconName, label: 'Factuur', route: '/(contractor)/facturen', primary: false },
    { icon: 'cart-outline' as IconName, label: 'Inkoop', route: '/(contractor)/besparen', primary: false },
    { icon: 'document-text-outline' as IconName, label: 'Certificaat', route: '/(contractor)/certificaten', primary: false },
  ];

  return (
    <View style={styles.quickActions}>
      {actions.map((action, index) => (
        <Pressable
          key={index}
          style={[
            styles.quickAction,
            action.primary && styles.quickActionPrimary
          ]}
          onPress={() => router.push(action.route as any)}
        >
          <Ionicons
            name={action.icon}
            size={20}
            color={action.primary ? '#fff' : SemanticColors.textPrimary}
          />
          <Text style={[
            styles.quickActionText,
            action.primary && styles.quickActionTextPrimary
          ]}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function AuditFindingBanner({ finding, onPress }: { finding: any; onPress: () => void }) {
  const getSeverityColor = () => {
    switch (finding.severity) {
      case 'critical': return SemanticColors.feedbackError;
      case 'high': return SemanticColors.feedbackWarning;
      default: return Palette.hermesOrange;
    }
  };

  return (
    <Pressable style={[styles.auditBanner, { borderLeftColor: getSeverityColor() }]} onPress={onPress}>
      <View style={styles.auditBannerIcon}>
        <Ionicons name="shield-checkmark" size={16} color={getSeverityColor()} />
      </View>
      <View style={styles.auditBannerContent}>
        <Text style={styles.auditBannerTitle} numberOfLines={1}>{finding.title}</Text>
        <Text style={styles.auditBannerText} numberOfLines={1}>{finding.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function TodayScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedGuidance, setDismissedGuidance] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  // UI Guidance state
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
  const [showProgressTracker, setShowProgressTracker] = useState(true);
  const [activeCoachMark, setActiveCoachMark] = useState<string | null>(null);

  // Get today's date
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Core services
  const daySchedule = useDaySchedule(today);
  const { summary: cashFlowSummary, invoices } = useCashFlow();

  // AI services
  const { findings: auditFindings } = useAuditFindings('contractor');
  const financialStats = useFinancialAuditStats();
  const { alerts: complianceAlerts } = useComplianceAlerts();

  // Filter dismissed guidance
  const activeGuidance = useMemo(
    () => MOCK_VASCO_GUIDANCE.filter(g => !dismissedGuidance.has(g.id)),
    [dismissedGuidance]
  );

  // Build today's jobs list
  const todayJobs = useMemo((): JobItem[] => {
    return daySchedule.jobs.map(job => ({
      id: job.id,
      title: job.projectName,
      customer: job.customerName,
      address: job.address || 'Adres niet beschikbaar',
      time: new Date(job.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
      duration: `${Math.round((new Date(job.endTime).getTime() - new Date(job.startTime).getTime()) / 3600000)}u`,
      status: job.status === 'in_progress' ? 'active' : job.status === 'completed' ? 'completed' : 'upcoming',
    }));
  }, [daySchedule.jobs]);

  // Critical findings
  const criticalFindings = useMemo(() => {
    return auditFindings.filter(f =>
      (f.severity === 'critical' || f.severity === 'high') &&
      f.status === 'new'
    ).slice(0, 2);
  }, [auditFindings]);

  // Calculate money stats
  const outstanding = cashFlowSummary.pendingIncome;
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
  const thisWeek = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount, 0) / 4;

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Goedemorgen';
    if (hour < 18) return 'Goedemiddag';
    return 'Goedenavond';
  }, []);

  const formattedDate = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  // UI Guidance - filter active tips
  const activeOnboardingTips = useMemo(() =>
    ONBOARDING_TIPS.filter(tip => !dismissedTips.has(tip.id)),
    [dismissedTips]
  );

  const activeFeatureTips = useMemo(() =>
    FEATURE_TIPS.filter(tip => !dismissedTips.has(tip.id)).slice(0, 1),
    [dismissedTips]
  );

  // What to do next suggestions
  const whatNextSuggestions = useMemo(() => [
    { id: 'wn-1', icon: 'add-circle' as IconName, title: 'Offerte maken', subtitle: 'Met AI-hulp', route: '/contractor/tiered-quote' },
    { id: 'wn-2', icon: 'receipt' as IconName, title: 'Factuur sturen', subtitle: 'In 30 seconden', route: '/(contractor)/facturen' },
    { id: 'wn-3', icon: 'pricetag' as IconName, title: 'Prijzen vergelijken', subtitle: 'Bespaar tot 15%', route: '/(contractor)/besparen' },
    { id: 'wn-4', icon: 'calendar' as IconName, title: 'Planning bekijken', subtitle: 'Deze week', route: '/(contractor)/planning' },
  ], []);

  const handleDismissGuidance = useCallback((id: string) => {
    setDismissedGuidance(prev => new Set(prev).add(id));
  }, []);

  const handleGuidanceAction = useCallback((guidance: VascoGuidance) => {
    if (guidance.actionRoute) {
      router.push(guidance.actionRoute as any);
    }
  }, [router]);

  const handleDismissOnboardingTip = useCallback((id: string) => {
    setDismissedTips(prev => new Set(prev).add(id));
    // If all tips dismissed, hide onboarding
    if (ONBOARDING_TIPS.every(t => t.id === id || dismissedTips.has(t.id))) {
      setShowOnboarding(false);
    }
  }, [dismissedTips]);

  const handleMilestonePress = useCallback((milestone: ProgressMilestone) => {
    // Navigate based on milestone
    switch (milestone.id) {
      case 'p3':
        router.push('/contractor/tiered-quote' as any);
        break;
      case 'p4':
        router.push('/(contractor)/certificaten' as any);
        break;
      case 'p5':
        router.push('/(contractor)/facturen' as any);
        break;
    }
  }, [router]);

  const handleFeatureAction = useCallback((route: string) => {
    router.push(route as any);
  }, [router]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        <Pressable style={styles.profileButton} onPress={() => router.push('/profile' as any)}>
          <Ionicons name="person-circle-outline" size={32} color={SemanticColors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />
        }
      >
        {/* Onboarding Carousel for new users */}
        {showOnboarding && activeOnboardingTips.length > 0 && (
          <OnboardingCarousel
            tips={activeOnboardingTips}
            onDismiss={handleDismissOnboardingTip}
            onAction={(route) => router.push(route as any)}
          />
        )}

        {/* Progress Tracker */}
        {showProgressTracker && !showOnboarding && (
          <ProgressTracker
            milestones={PROGRESS_MILESTONES}
            onMilestonePress={handleMilestonePress}
          />
        )}

        {/* Vasco AI Guidance Section */}
        {activeGuidance.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="sparkles" size={16} color={Palette.hermesOrange} />
                <Text style={styles.sectionTitle}>Vasco voor jou</Text>
              </View>
              <Text style={styles.sectionCount}>{activeGuidance.length} tips</Text>
            </View>
            <View style={styles.guidanceList}>
              {activeGuidance.slice(0, 3).map((guidance) => (
                <VascoGuidanceCard
                  key={guidance.id}
                  guidance={guidance}
                  onDismiss={() => handleDismissGuidance(guidance.id)}
                  onAction={() => handleGuidanceAction(guidance)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Audit Findings */}
        {criticalFindings.length > 0 && (
          <View style={styles.findingsSection}>
            {criticalFindings.map(finding => (
              <AuditFindingBanner
                key={finding.id}
                finding={finding}
                onPress={() => {}}
              />
            ))}
          </View>
        )}

        {/* Money Summary */}
        <MoneyCard
          outstanding={outstanding}
          thisWeek={thisWeek}
          pendingCount={pendingInvoices.length}
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* What to do next - show when no jobs today */}
        {todayJobs.length === 0 && (
          <WhatToDoNextCard
            suggestions={whatNextSuggestions}
            onSuggestionPress={handleFeatureAction}
          />
        )}

        {/* Feature Discovery */}
        {activeFeatureTips.length > 0 && !showOnboarding && (
          <View style={styles.section}>
            {activeFeatureTips.map(tip => (
              <FeatureDiscoveryCard
                key={tip.id}
                tip={tip}
                onAction={() => tip.action && handleFeatureAction(tip.action.route)}
                onDismiss={() => setDismissedTips(prev => new Set(prev).add(tip.id))}
              />
            ))}
          </View>
        )}

        {/* Today's Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vandaag</Text>
            <Text style={styles.sectionCount}>{todayJobs.length} afspraken</Text>
          </View>
          {todayJobs.length === 0 ? (
            <View style={styles.emptyJobs}>
              <Ionicons name="calendar-outline" size={32} color={SemanticColors.textTertiary} />
              <Text style={styles.emptyJobsText}>Geen afspraken vandaag</Text>
              <Text style={styles.emptyJobsSubtext}>Geniet van je vrije dag!</Text>
            </View>
          ) : (
            <View style={styles.jobsList}>
              {todayJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onPress={() => router.push(`/contractor/job/${job.id}` as any)}
                />
              ))}
            </View>
          )}
        </View>

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
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.sm,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  date: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Section
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Vasco Guidance
  guidanceList: {
    gap: Spacing.sm,
  },
  guidanceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  guidanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  guidanceIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceHeaderText: {
    flex: 1,
  },
  guidanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  guidanceTimestamp: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  guidanceMessage: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  guidanceAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 4,
  },
  guidanceActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // Audit Banner
  findingsSection: {
    gap: Spacing.xs,
  },
  auditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderLeftWidth: 3,
    gap: Spacing.sm,
  },
  auditBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: SemanticColors.feedbackWarningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditBannerContent: {
    flex: 1,
  },
  auditBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  auditBannerText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Money Card
  moneyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  moneyRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  moneyItem: {
    flex: 1,
  },
  moneyLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  moneyValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  moneySubtext: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  moneyDivider: {
    width: 1,
    height: 40,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.md,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  quickActionPrimary: {
    backgroundColor: Palette.hermesOrange,
    borderColor: Palette.hermesOrange,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  quickActionTextPrimary: {
    color: '#fff',
  },

  // Jobs List
  jobsList: {
    gap: Spacing.sm,
  },
  jobCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 4,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  jobTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jobTime: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textSecondary,
  },
  jobTimeActive: {
    color: SemanticColors.feedbackSuccess,
  },
  jobDuration: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  jobActiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  jobActiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
    letterSpacing: 0.5,
  },
  jobCompletedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobCompletedText: {
    fontSize: 10,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
    letterSpacing: 0.5,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  jobCustomer: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  jobAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  jobAddressText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    flex: 1,
  },
  emptyJobs: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.xs,
  },
  emptyJobsText: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  emptyJobsSubtext: {
    fontSize: 13,
    color: SemanticColors.textTertiary,
  },

  // ============================================
  // UI GUIDANCE STYLES
  // ============================================

  // Onboarding Carousel
  onboardingCarousel: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Palette.hermesOrange,
    gap: Spacing.md,
  },
  onboardingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onboardingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.hermesOrange + '15',
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
    backgroundColor: Palette.hermesOrange,
    width: 20,
  },
  onboardingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  onboardingDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },
  onboardingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  onboardingPrevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
  },
  onboardingPrevText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  onboardingNextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
  },
  onboardingNextText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  onboardingActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.hermesOrange,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  onboardingActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Progress Tracker
  progressTracker: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Palette.hermesOrange,
    borderRadius: 4,
  },
  milestonesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestoneIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: SemanticColors.borderDefault,
  },
  milestoneIconCompleted: {
    backgroundColor: SemanticColors.feedbackSuccess,
    borderColor: SemanticColors.feedbackSuccess,
  },
  milestoneIconCurrent: {
    borderColor: Palette.hermesOrange,
    borderWidth: 2,
  },
  milestoneLine: {
    width: 24,
    height: 2,
    backgroundColor: SemanticColors.borderDefault,
    marginLeft: 4,
  },
  milestoneLineCompleted: {
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  currentMilestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.hermesOrange + '10',
    padding: Spacing.sm,
    borderRadius: 8,
  },
  currentMilestoneContent: {
    flex: 1,
  },
  currentMilestoneTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  currentMilestoneDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Feature Discovery Card
  featureCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  featureCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featureNewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featureNewText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  featureCardContent: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextContent: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  featureDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  featureActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: Spacing.xs,
  },
  featureActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // Coach Mark
  coachMark: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 100,
  },
  coachMarkTop: {
    top: 100,
  },
  coachMarkBottom: {
    bottom: 100,
  },
  coachMarkArrow: {
    width: 12,
    height: 12,
    backgroundColor: Palette.charcoal,
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    top: -6,
    left: 24,
  },
  coachMarkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.charcoal,
    padding: Spacing.md,
    borderRadius: 12,
  },
  coachMarkText: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },

  // What to do next
  whatNextCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
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
    gap: Spacing.sm,
  },
  whatNextItem: {
    width: '48%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  whatNextIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.hermesOrange + '15',
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
  whatNextItemSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
});
