// =============================================================================
// SITE LEAD DASHBOARD — Redesigned
// =============================================================================
// Clean terracotta/sand palette, light header with greeting + location
// No project selector (site leads see one site only)
// Tabs: Overzicht | Planning | Veiligheid | Kwaliteit
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing, SafeArea } from '../../theme/spacing';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { useNotifications } from '../../services/notificationService';
import { hapticSuccess } from '../../utils/haptics';
import { useAuth } from '../../context/AuthContext';
import { useDefects, useDailyReports } from '../../services/siteLeadDataService';
import {
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
import { ProgressRing } from '../shared/ProgressRing';
import { FadeIn } from '../shared/FadeIn';
import { recordScreenVisit } from '../../intelligence/learningStorage';
import { ContractorDashboardHeader } from '../contractor/ContractorDashboardHeader';
import { VascoCard } from '../shared/VascoCard';
import { getActionStats } from '../../intelligence/actionExecutor';

type IconName = keyof typeof Ionicons.glyphMap;
export type SiteLeadTabView = 'overview' | 'dispatch' | 'safety' | 'more';
type TabView = SiteLeadTabView;

// =============================================================================
// PLANNING DATA — Zones, Assignments, Teams
// =============================================================================

type AssignmentStatus = 'gepland' | 'actief' | 'gereed' | 'geblokkeerd';

interface SiteZone {
  id: string;
  name: string;
  phase: 'ruwbouw' | 'installatie' | 'afbouw' | 'oplevering';
  color: string;
}

interface TeamDayAssignment {
  id: string;
  teamId: string;
  zoneId: string;
  task: string;
  startTime: string;
  endTime: string;
  progress: number;
  status: AssignmentStatus;
  blockedBy?: string;
  blockerNote?: string;
}

const SITE_ZONES: SiteZone[] = [
  { id: 'z-abg', name: 'Blok A - BG', phase: 'afbouw', color: SemanticColors.feedbackSuccess },
  { id: 'z-av2', name: 'Blok A - Verd. 2', phase: 'installatie', color: Palette.hermesOrange },
  { id: 'z-bv1', name: 'Blok B - Verd. 1', phase: 'installatie', color: Palette.hermesOrange },
  { id: 'z-bbuit', name: 'Blok B - Buiten', phase: 'ruwbouw', color: Palette.hermesOrange },
  { id: 'z-cv3', name: 'Blok C - Verd. 3', phase: 'afbouw', color: Palette.hermesOrange },
];

const MOCK_ASSIGNMENTS: TeamDayAssignment[] = [
  { id: 'a-1', teamId: 'wt-1', zoneId: 'z-av2', task: 'Bekabeling', startTime: '08:00', endTime: '12:00', progress: 72, status: 'actief' },
  { id: 'a-2', teamId: 'wt-1', zoneId: 'z-bv1', task: 'Groepen aansluiten', startTime: '13:00', endTime: '16:00', progress: 0, status: 'gepland' },
  { id: 'a-3', teamId: 'wt-2', zoneId: 'z-bv1', task: 'Sanitair installatie', startTime: '08:00', endTime: '15:00', progress: 45, status: 'actief', blockerNote: 'Achter op schema' },
  { id: 'a-4', teamId: 'wt-3', zoneId: 'z-abg', task: 'Kozijnen plaatsen', startTime: '07:00', endTime: '16:00', progress: 88, status: 'actief' },
  { id: 'a-5', teamId: 'wt-4', zoneId: 'z-abg', task: 'Binnenschilderwerk', startTime: '', endTime: '', progress: 0, status: 'geblokkeerd', blockedBy: 'a-4', blockerNote: 'Wacht op Timmerwerk — kozijnen moeten eerst klaar' },
  { id: 'a-6', teamId: 'wt-5', zoneId: 'z-bbuit', task: 'Gevelstenen', startTime: '07:00', endTime: '12:00', progress: 100, status: 'gereed' },
];

// Date helpers for planning tab
const DAY_LABELS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const FULL_DAY_LABELS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d: Date): boolean { return isSameDay(d, new Date()); }
function formatDateHeader(d: Date): string {
  return `${FULL_DAY_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}
function getWeekDays(base: Date): Date[] {
  const day = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((day === 0 ? 7 : day) - 1));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
function navigateDay(current: Date, dir: -1 | 1): Date {
  const next = new Date(current);
  next.setDate(current.getDate() + dir);
  return next;
}

// =============================================================================
// WORK TEAM DATA
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
  progress: number;
  plannedProgress: number;
  status: TeamStatus;
  startTime: string;
  estimatedEnd: string;
  blockers?: string;
}

const MOCK_WORK_TEAMS: WorkTeam[] = [
  { id: 'wt-1', name: 'Elektra Team A', trade: 'Elektricien', tradeIcon: 'flash', lead: 'Mohammed Al-Rashid', members: 3, task: 'Bekabeling 2e verdieping', location: 'Blok A - Verdieping 2', progress: 72, plannedProgress: 65, status: 'on-track', startTime: '07:30', estimatedEnd: '16:00' },
  { id: 'wt-2', name: 'Loodgieter Team', trade: 'Loodgieter', tradeIcon: 'water', lead: 'Pieter de Groot', members: 2, task: 'Sanitair installatie badkamers', location: 'Blok B - Verdieping 1', progress: 45, plannedProgress: 60, status: 'behind', startTime: '08:00', estimatedEnd: '17:00', blockers: 'Wacht op materiaallevering' },
  { id: 'wt-3', name: 'Timmerwerk', trade: 'Timmerman', tradeIcon: 'hammer', lead: 'Erik Jansen', members: 4, task: 'Kozijnen plaatsen begane grond', location: 'Blok A - Begane grond', progress: 88, plannedProgress: 85, status: 'on-track', startTime: '07:00', estimatedEnd: '14:30' },
  { id: 'wt-4', name: 'Schilders', trade: 'Schilder', tradeIcon: 'color-palette', lead: 'Lisa Bakker', members: 2, task: 'Binnenschilderwerk kantoren', location: 'Blok C - Verdieping 3', progress: 30, plannedProgress: 35, status: 'at-risk', startTime: '08:30', estimatedEnd: '17:30', blockers: 'Ventilatie nog niet afgerond' },
  { id: 'wt-5', name: 'Metselwerk', trade: 'Metselaar', tradeIcon: 'cube', lead: 'Jan van Bergen', members: 3, task: 'Gevelstenen buitenmuur', location: 'Blok B - Buitenzijde', progress: 100, plannedProgress: 100, status: 'completed', startTime: '06:30', estimatedEnd: '15:00' },
];


// =============================================================================
// PLANNING TAB — Team Schedule type + PlanningTeamCard
// =============================================================================

type PlanningTeamStatus = 'blocked' | 'behind' | 'at-risk' | 'on-track' | 'completed';

interface TeamScheduleEntry {
  team: WorkTeam;
  assignments: TeamDayAssignment[];
  zones: SiteZone[];
  combinedProgress: number;
  timeRange: string;
  planningStatus: PlanningTeamStatus;
}

function derivePlanningStatus(team: WorkTeam, assignments: TeamDayAssignment[]): PlanningTeamStatus {
  if (assignments.some(a => a.status === 'geblokkeerd')) return 'blocked';
  if (team.status === 'behind') return 'behind';
  if (team.status === 'at-risk') return 'at-risk';
  if (team.status === 'completed' || assignments.every(a => a.status === 'gereed')) return 'completed';
  return 'on-track';
}

const PLANNING_STATUS_ORDER: Record<PlanningTeamStatus, number> = {
  blocked: 0, behind: 1, 'at-risk': 2, 'on-track': 3, completed: 4,
};

const ACCENT_COLORS: Record<PlanningTeamStatus, string> = {
  blocked: SemanticColors.feedbackError,
  behind: SemanticColors.feedbackWarning,
  'at-risk': SemanticColors.textTertiary,
  'on-track': Palette.hermesOrange,
  completed: SemanticColors.feedbackSuccess,
};

function PlanningTeamCard({ entry, onPress }: { entry: TeamScheduleEntry; onPress: () => void }) {
  const { team, assignments, zones, combinedProgress, timeRange, planningStatus } = entry;
  const accent = ACCENT_COLORS[planningStatus];
  const isCompleted = planningStatus === 'completed';
  const isBlocked = planningStatus === 'blocked';
  const blocker = assignments.find(a => a.status === 'geblokkeerd');
  const delayNote = !isBlocked && assignments.find(a => a.status === 'actief' && a.blockerNote);

  return (
    <Pressable
      style={[pStyles.card, isCompleted && { opacity: 0.6 }]}
      onPress={onPress}
    >
      {/* 4px accent bar */}
      <View style={[pStyles.accentBar, { backgroundColor: accent }]} />

      <View style={pStyles.cardContent}>
        {/* Header row: icon + name/lead + member count | time pill */}
        <View style={pStyles.cardHeader}>
          <View style={[pStyles.tradeIcon, { backgroundColor: accent + '15' }]}>
            <Ionicons name={team.tradeIcon} size={16} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[pStyles.teamName, isCompleted && { color: SemanticColors.textSecondary }]} numberOfLines={1}>{team.name}</Text>
              {isCompleted && <Ionicons name="checkmark-circle" size={14} color={SemanticColors.feedbackSuccess} />}
            </View>
            <Text style={pStyles.teamLead} numberOfLines={1}>{team.lead} · {team.members} pers.</Text>
          </View>
          {timeRange ? (
            <View style={pStyles.timePill}>
              <Ionicons name="time-outline" size={11} color={SemanticColors.textSecondary} />
              <Text style={pStyles.timePillText}>{timeRange}</Text>
            </View>
          ) : null}
        </View>

        {/* Task + zone tags */}
        <Text style={pStyles.taskText} numberOfLines={1}>{team.task}</Text>
        <View style={pStyles.zoneTags}>
          {zones.map(z => (
            <View key={z.id} style={[pStyles.zoneTag, { backgroundColor: z.color + '15' }]}>
              <View style={[pStyles.zoneTagDot, { backgroundColor: z.color }]} />
              <Text style={[pStyles.zoneTagText, { color: z.color }]} numberOfLines={1}>{z.name}</Text>
            </View>
          ))}
        </View>

        {/* Progress bar with inline % */}
        {!isBlocked && (
          <View style={pStyles.progressRow}>
            <View style={pStyles.progressTrack}>
              <View style={[pStyles.progressFill, { width: `${combinedProgress}%`, backgroundColor: accent }]} />
            </View>
            <Text style={[pStyles.progressText, { color: accent }]}>{combinedProgress}%</Text>
          </View>
        )}

        {/* Blocker strip */}
        {isBlocked && blocker?.blockerNote && (
          <View style={pStyles.blockerStrip}>
            <View style={pStyles.blockerIconCircle}>
              <Ionicons name="lock-closed" size={12} color={SemanticColors.feedbackError} />
            </View>
            <Text style={pStyles.blockerText} numberOfLines={1}>{blocker.blockerNote}</Text>
          </View>
        )}

        {/* Delay strip */}
        {delayNote && (
          <View style={pStyles.delayStrip}>
            <Ionicons name="alert-circle" size={13} color={SemanticColors.feedbackWarning} />
            <Text style={pStyles.delayText} numberOfLines={1}>{delayNote.blockerNote}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface SiteLeadDashboardProps {
  initialTab?: TabView;
  showTabBar?: boolean;
}

export function SiteLeadDashboard({ initialTab = 'overview' }: SiteLeadDashboardProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab] = useState<TabView>(initialTab);
  const [refreshing, setRefreshing] = useState(false);
  const [actionStats, setActionStats] = useState<{ total: number; successful: number; positiveOutcomes: number } | null>(null);
  useEffect(() => { getActionStats().then(setActionStats).catch(() => {}); }, []);
  const { notifications } = useNotifications();
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Real defect data from AsyncStorage
  const { defects: realOpenDefects } = useDefects('open');
  const { defects: realClosedDefects } = useDefects('closed');

  // Daily reports for today-status
  const { reports: dailyReports } = useDailyReports();
  const todayStr = new Date().toISOString().split('T')[0];
  const hasTodayReport = useMemo(
    () => dailyReports.some(r => r.date === todayStr),
    [dailyReports, todayStr]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  // Fixed project for site lead (no multi-site selection)
  const selectedProjectId = 'uk-001';

  // Track screen visits for learning profile
  useEffect(() => { recordScreenVisit(activeTab); }, [activeTab]);

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

  // Planning tab state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const assignments = MOCK_ASSIGNMENTS; // static mock, filtered by day in real impl

  const teamLookup = useMemo(() => {
    const map: Record<string, WorkTeam> = {};
    MOCK_WORK_TEAMS.forEach(t => { map[t.id] = t; });
    return map;
  }, []);

  const zoneLookup = useMemo(() => {
    const map: Record<string, SiteZone> = {};
    SITE_ZONES.forEach(z => { map[z.id] = z; });
    return map;
  }, []);

  // Group assignments by team → build TeamScheduleEntry[]
  const teamSchedule = useMemo((): TeamScheduleEntry[] => {
    const grouped: Record<string, TeamDayAssignment[]> = {};
    assignments.forEach(a => {
      if (!grouped[a.teamId]) grouped[a.teamId] = [];
      grouped[a.teamId].push(a);
    });

    return Object.entries(grouped)
      .map(([teamId, teamAssignments]) => {
        const team = teamLookup[teamId];
        if (!team) return null;
        const zones = [...new Set(teamAssignments.map(a => a.zoneId))].map(id => zoneLookup[id]).filter(Boolean) as SiteZone[];
        const totalProgress = teamAssignments.reduce((sum, a) => sum + a.progress, 0);
        const combinedProgress = Math.round(totalProgress / teamAssignments.length);
        const times = teamAssignments.filter(a => a.startTime && a.endTime);
        const earliest = times.length > 0 ? times.reduce((min, a) => a.startTime < min ? a.startTime : min, '99:99') : '';
        const latest = times.length > 0 ? times.reduce((max, a) => a.endTime > max ? a.endTime : max, '00:00') : '';
        const timeRange = earliest && latest ? `${earliest}–${latest}` : '';
        const planningStatus = derivePlanningStatus(team, teamAssignments);

        return { team, assignments: teamAssignments, zones, combinedProgress, timeRange, planningStatus } as TeamScheduleEntry;
      })
      .filter(Boolean)
      .sort((a, b) => PLANNING_STATUS_ORDER[a!.planningStatus] - PLANNING_STATUS_ORDER[b!.planningStatus]) as TeamScheduleEntry[];
  }, [assignments, teamLookup, zoneLookup]);

  const planningStats = useMemo(() => {
    const active = teamSchedule.filter(e => e.planningStatus !== 'completed').length;
    const totalPersons = teamSchedule.filter(e => e.planningStatus !== 'completed').reduce((s, e) => s + e.team.members, 0);
    const occupiedZones = new Set(teamSchedule.filter(e => e.planningStatus !== 'completed').flatMap(e => e.zones.map(z => z.id)));
    const blockers = teamSchedule.filter(e => e.planningStatus === 'blocked').length;
    return { active, totalPersons, occupiedZones: occupiedZones.size, totalZones: SITE_ZONES.length, blockers };
  }, [teamSchedule]);

  const blockedTeams = useMemo(
    () => teamSchedule.filter(e => e.planningStatus === 'blocked'),
    [teamSchedule]
  );

  // Derived data
  const selectedProject = useMemo(() => getProjectById(selectedProjectId), []);
  const siteMetrics = useMemo(() => mockSiteMetrics[selectedProjectId], []);
  const currency = useMemo(
    () => (selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP'),
    [selectedProject]
  );

  const progressHealth = useMemo(() => {
    if (!siteMetrics) return null;
    return {
      actual: siteMetrics.overallPercentComplete,
      planned: siteMetrics.plannedPercentComplete,
      variance: siteMetrics.progressVariance,
      status: siteMetrics.progressVariance >= -2 ? 'on-track' : siteMetrics.progressVariance >= -5 ? 'at-risk' : 'behind',
    };
  }, [siteMetrics]);

  const safetyHealth = useMemo(() => {
    if (!siteMetrics) return null;
    const score = siteMetrics.ltir < 0.5 ? 'excellent' : siteMetrics.ltir < 1.0 ? 'good' : siteMetrics.ltir < 2.0 ? 'fair' : 'poor';
    return {
      ltir: siteMetrics.ltir,
      hoursWorked: siteMetrics.hoursWorked,
      incidents: siteMetrics.incidentsTotal,
      incidentsThisPeriod: siteMetrics.incidentsThisPeriod,
      nearMisses: siteMetrics.nearMissesThisPeriod,
      score,
    };
  }, [siteMetrics]);

  const qualityHealth = useMemo(() => {
    if (!siteMetrics) return null;
    // Use real defect counts from AsyncStorage when available, fall back to mock
    const openCount = realOpenDefects.length > 0 ? realOpenDefects.length : siteMetrics.defectsOpenTotal;
    const closedCount = realClosedDefects.length > 0 ? realClosedDefects.length : siteMetrics.defectsClosedTotal;
    const total = openCount + closedCount;
    const closureRate = total > 0 ? Math.round((closedCount / total) * 100) : siteMetrics.defectClosureRate;
    return {
      defectsOpen: openCount,
      defectsClosed: closedCount,
      closureRate,
      reworkCost: siteMetrics.reworkCostToDate,
    };
  }, [siteMetrics, realOpenDefects, realClosedDefects]);

  const fmt = (amount: number) => formatCurrency(amount, currency);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('sitelead.greeting');
    if (hour < 18) return t('sitelead.greetingAfternoon');
    return t('sitelead.greetingEvening');
  };

  const getSafetyColor = (score: string) => {
    switch (score) {
      case 'excellent':
      case 'good': return SemanticColors.feedbackSuccess;
      case 'fair': return SemanticColors.feedbackWarning;
      default: return SemanticColors.feedbackError;
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'on-track': return SemanticColors.feedbackSuccess;
      case 'at-risk': return SemanticColors.feedbackWarning;
      default: return SemanticColors.feedbackError;
    }
  };

  const getTeamColor = (status: TeamStatus) => {
    switch (status) {
      case 'on-track': return Palette.hermesOrange;
      case 'at-risk': return SemanticColors.textSecondary;
      case 'behind': return SemanticColors.feedbackError;
      case 'completed': return SemanticColors.feedbackSuccess;
    }
  };

  if (!selectedProject || !siteMetrics || !progressHealth || !safetyHealth || !qualityHealth) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    );
  }

  const userName = user?.name?.split(' ')[0] || 'Site Lead';
  const activeTeams = MOCK_WORK_TEAMS.filter(t => t.status !== 'completed');

  return (
    <View style={styles.container}>
      {/* Light header — greeting + location */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerGreeting} numberOfLines={1}>{getGreeting()}, {userName}</Text>
            <View style={styles.headerLocationRow}>
              <Ionicons name="location" size={14} color={Palette.hermesOrange} />
              <Text style={styles.headerLocation} numberOfLines={1}>{selectedProject.name}</Text>
            </View>
          </View>
          <Pressable
            style={styles.headerNotifBtn}
            onPress={() => router.push('/sitelead/dispatch' as any)}
          >
            <Ionicons name="notifications-outline" size={20} color={SemanticColors.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.headerNotifBadge}>
                <Text style={styles.headerNotifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {/* ============================================ */}
        {/* OVERVIEW TAB */}
        {/* ============================================ */}
        {activeTab === 'overview' && (
          <>
            {/* Vasco Card — AI first (EVE pattern) */}
            <FadeIn delay={0}>
              <VascoCard
                briefing={null}
                queueItems={[]}
                topInsight={activeGuidance.length > 0 ? activeGuidance[0] : null}
                automationsCount={0}
                onApproveQueueItem={() => {}}
                onRejectQueueItem={() => {}}
                onInsightAction={handleGuidanceAction}
              />
            </FadeIn>

            {/* KPI header — pressable */}
            <FadeIn delay={40}>
              <ContractorDashboardHeader
                kpis={[
                  { icon: 'trending-up', value: `${progressHealth.actual}%`, label: t('sitelead.progress'), color: getProgressColor(progressHealth.status), onPress: () => router.push('/sitelead/dispatch' as any) },
                  { icon: 'shield-checkmark', value: safetyHealth.ltir.toFixed(1), label: 'LTIR', color: Palette.hermesOrange, onPress: () => router.push('/sitelead/incident-report' as any) },
                  { icon: 'construct', value: String(qualityHealth.defectsOpen), label: t('sitelead.open'), color: Palette.hermesOrange, onPress: () => router.push('/sitelead/log-defect' as any) },
                ]}
              />
            </FadeIn>

            {/* Daily report status */}
            <FadeIn delay={80}>
              <Pressable
                style={styles.dailyReportBanner}
                onPress={() => router.push('/sitelead/daily-report' as any)}
              >
                <Ionicons
                  name={hasTodayReport ? 'checkmark-circle' : 'document-text-outline'}
                  size={18}
                  color={hasTodayReport ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
                />
                <Text style={[styles.dailyReportText, { color: hasTodayReport ? SemanticColors.feedbackSuccess : SemanticColors.textSecondary }]}>
                  {hasTodayReport ? 'Dagrapport ingediend' : 'Dagrapport nog niet ingevuld'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            </FadeIn>

            {/* Werkploegen */}
            <FadeIn delay={120}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('sitelead.teams')}</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{t('sitelead.teamsActive', { count: activeTeams.length })}</Text>
                </View>
              </View>

              {MOCK_WORK_TEAMS.map((team) => {
                const deviation = team.progress - team.plannedProgress;
                const color = getTeamColor(team.status);

                return (
                  <Pressable
                    key={team.id}
                    style={styles.teamCard}
                    onPress={() => router.push(`/sitelead/team/${team.id}` as any)}
                  >
                    <View style={styles.teamTop}>
                      <View style={[styles.teamIcon, { backgroundColor: color + '15' }]}>
                        <Ionicons name={team.tradeIcon} size={14} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
                        <Text style={styles.teamMeta} numberOfLines={1}>{team.lead} · {team.members} pers.</Text>
                      </View>
                      {team.status === 'completed' ? (
                        <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
                      ) : (
                        <Text style={[styles.teamDeviation, { color }]}>
                          {deviation >= 0 ? '+' : ''}{deviation}%
                        </Text>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={SemanticColors.textDisabled} />
                    </View>

                    <Text style={styles.teamTask} numberOfLines={1}>{team.task}</Text>

                    {/* Progress bar */}
                    <View style={styles.teamBarTrack}>
                      <View style={[styles.teamBarFill, { width: `${team.progress}%`, backgroundColor: color }]} />
                      {team.status !== 'completed' && (
                        <View style={[styles.teamBarMarker, { left: `${team.plannedProgress}%` }]} />
                      )}
                    </View>

                    <View style={styles.teamFooter}>
                      <Text style={styles.teamTime}>{team.startTime} - {team.estimatedEnd}</Text>
                      {team.blockers && (
                        <View style={styles.teamBlocker}>
                          <Ionicons name="alert-circle" size={11} color={SemanticColors.feedbackWarning} />
                          <Text style={styles.teamBlockerText} numberOfLines={1}>{team.blockers}</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            </FadeIn>

            {/* VascoCard moved to top of overview */}
          </>
        )}

        {/* ============================================ */}
        {/* SAFETY TAB */}
        {/* ============================================ */}
        {activeTab === 'safety' && (
          <>
            {/* Safety + Quality KPIs — pressable */}
            <ContractorDashboardHeader
              kpis={[
                { icon: 'shield-checkmark', value: safetyHealth.ltir.toFixed(2), label: 'LTIR', color: Palette.hermesOrange, onPress: () => router.push('/sitelead/incident-report' as any) },
                { icon: 'warning', value: String(safetyHealth.incidentsThisPeriod), label: t('sitelead.incidents'), color: safetyHealth.incidentsThisPeriod > 2 ? SemanticColors.feedbackError : Palette.hermesOrange, onPress: () => router.push('/sitelead/incident-report' as any) },
                { icon: 'eye', value: String(safetyHealth.nearMisses), label: t('sitelead.nearMisses'), onPress: () => router.push('/sitelead/inspection' as any) },
              ]}
            />
            <ContractorDashboardHeader
              kpis={[
                { icon: 'ribbon', value: String(qualityHealth.defectsOpen), label: t('sitelead.openDefects'), color: Palette.hermesOrange, onPress: () => router.push('/sitelead/log-defect' as any) },
                { icon: 'checkmark-circle', value: `${qualityHealth.closureRate}%`, label: t('sitelead.closureRate'), onPress: () => router.push('/sitelead/close-defect' as any) },
                { icon: 'construct', value: `\u20AC${qualityHealth.reworkCost.toLocaleString('nl-NL')}`, label: t('sitelead.repairCosts') },
              ]}
            />

            {/* Safety Dashboard — score + bars */}
            <View style={styles.dashboardCard}>
              <View style={styles.dashboardCardHeader}>
                <Text style={styles.dashboardCardTitle} numberOfLines={1}>{t('sitelead.safetyDashboard')}</Text>
              </View>

              <View style={[styles.safetyBanner, { backgroundColor: SemanticColors.surfaceSecondary }]}>
                <View>
                  <Text style={styles.safetyBannerLabel}>{t('sitelead.safetyScore')}</Text>
                  <Text style={[styles.safetyBannerScore, { color: SemanticColors.textPrimary }]}>
                    {safetyHealth.score.toUpperCase()}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.ltirLabel}>LTIR</Text>
                  <Text style={[styles.ltirValue, { color: SemanticColors.textPrimary }]}>
                    {safetyHealth.ltir.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.barGroup}>
                {[
                  { label: t('sitelead.workedHours'), value: safetyHealth.hoursWorked.toLocaleString(), pct: 100, color: Palette.hermesOrange },
                  { label: t('sitelead.incidentsTotal'), value: String(safetyHealth.incidents), pct: safetyHealth.incidents > 0 ? Math.max((safetyHealth.incidents / 10) * 100, 15) : 0, color: Palette.hermesOrange },
                  { label: t('sitelead.thisPeriod'), value: String(safetyHealth.incidentsThisPeriod), pct: safetyHealth.incidentsThisPeriod > 0 ? Math.max((safetyHealth.incidentsThisPeriod / 5) * 100, 10) : 0, color: Palette.hermesOrange },
                  { label: t('sitelead.nearMisses'), value: String(safetyHealth.nearMisses), pct: safetyHealth.nearMisses > 0 ? Math.max((safetyHealth.nearMisses / 5) * 100, 10) : 0, color: Palette.hermesOrange },
                ].map((item) => (
                  <View key={item.label} style={styles.barRow}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barLabel}>{item.label}</Text>
                      <Text style={[styles.barValue, { color: SemanticColors.textPrimary }]}>{item.value}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Quality dashboard — merged into Safety tab */}
            <View style={styles.dashboardCard}>
              <View style={styles.dashboardCardHeader}>
                <Text style={styles.dashboardCardTitle} numberOfLines={1}>{t('sitelead.qualityDashboard')}</Text>
              </View>

              <View style={styles.defectPipelineBar}>
                {qualityHealth.defectsClosed > 0 && (
                  <View style={[styles.defectPipelineSegment, { flex: qualityHealth.defectsClosed, backgroundColor: SemanticColors.feedbackSuccess }]} />
                )}
                {qualityHealth.defectsOpen > 0 && (
                  <View style={[styles.defectPipelineSegment, { flex: qualityHealth.defectsOpen, backgroundColor: Palette.hermesOrange }]} />
                )}
              </View>
              <View style={styles.defectLegend}>
                <View style={styles.defectLegendItem}>
                  <View style={[styles.defectDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                  <Text style={styles.defectLegendText}>{t('sitelead.closed')}</Text>
                  <Text style={styles.defectLegendCount}>{qualityHealth.defectsClosed}</Text>
                </View>
                <View style={styles.defectLegendItem}>
                  <View style={[styles.defectDot, { backgroundColor: Palette.hermesOrange }]} />
                  <Text style={styles.defectLegendText}>{t('sitelead.open')}</Text>
                  <Text style={styles.defectLegendCount}>{qualityHealth.defectsOpen}</Text>
                </View>
              </View>

              <View style={styles.closureRow}>
                <ProgressRing
                  progress={qualityHealth.closureRate}
                  size={72}
                  color={Palette.hermesOrange}
                  value={`${qualityHealth.closureRate}%`}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.closureStat}>
                    <Ionicons name="construct" size={14} color={Palette.hermesOrange} />
                    <Text style={styles.closureStatLabel}>{t('sitelead.repairCosts')}</Text>
                    <Text style={styles.closureStatValue}>{fmt(qualityHealth.reworkCost)}</Text>
                  </View>
                  <View style={styles.closureStat}>
                    <Ionicons name="trending-up" size={14} color={Palette.hermesOrange} />
                    <Text style={styles.closureStatLabel}>{t('sitelead.trend')}</Text>
                    <Text style={[styles.closureStatValue, { color: Palette.hermesOrange }]}>
                      {qualityHealth.closureRate >= 80 ? t('sitelead.good') : t('sitelead.needsAttention')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Safety actions — single ingress point (moved from Vasco tab) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('sitelead.safetyActions', 'Acties')}</Text>
              {[
                { icon: 'warning-outline' as IconName, title: t('sitelead.reportIncident'), route: '/sitelead/incident-report' },
                { icon: 'clipboard-outline' as IconName, title: t('sitelead.safetyInspection'), route: '/sitelead/inspection' },
                { icon: 'construct-outline' as IconName, title: t('sitelead.closeDefect'), route: '/sitelead/close-defect' },
                { icon: 'add-circle-outline' as IconName, title: t('sitelead.defect'), route: '/sitelead/log-defect' },
              ].map((item) => (
                <Pressable key={item.route} style={({ pressed }) => [styles.meerItem, pressed && { opacity: 0.85 }]} onPress={() => router.push(item.route as any)}>
                  <View style={styles.meerIcon}>
                    <Ionicons name={item.icon} size={20} color={SemanticColors.textSecondary} />
                  </View>
                  <Text style={[styles.meerTitle, { flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                  <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
                </Pressable>
              ))}
            </View>

            {/* AI insights — safety + quality combined */}
            {safetyInsight && (
              <InlineInsight icon={safetyInsight.icon as IconName} message={safetyInsight.message} />
            )}
            {qualityInsight && (
              <InlineInsight icon={qualityInsight.icon as IconName} message={qualityInsight.message} />
            )}
          </>
        )}

        {/* ============================================ */}
        {/* MEER TAB — Less frequent tools & settings */}
        {/* ============================================ */}
        {activeTab === 'more' && (
          <>
            {/* Status summary — proactive actions from site data */}
            <FadeIn delay={0}>
              <View style={styles.vascoStatusCard}>
                <View style={styles.vascoStatusIcon}>
                  <Ionicons name="flash" size={20} color={Palette.hermesOrange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vascoStatusTitle}>
                    {(blockedTeams.length + (qualityHealth?.defectsOpen ?? 0) + (safetyHealth?.incidentsThisPeriod ?? 0) + (!hasTodayReport ? 1 : 0)) > 0
                      ? `${blockedTeams.length + (qualityHealth?.defectsOpen ?? 0) + (!hasTodayReport ? 1 : 0)} acties voor je klaar`
                      : 'Alles bijgewerkt'}
                  </Text>
                  <Text style={styles.vascoStatusDesc}>Vasco scant je teams, veiligheid en kwaliteit</Text>
                </View>
              </View>
            </FadeIn>

            {/* Proactive action cards — site lead specific */}
            {!hasTodayReport && (
              <FadeIn delay={30}>
                <View style={[styles.vascoActionCard, { borderLeftColor: Palette.hermesOrange }]}>
                  <View style={styles.vascoActionHeader}>
                    <View style={[styles.vascoActionIcon, { backgroundColor: Palette.hermesOrange + '12' }]}>
                      <Ionicons name="create-outline" size={18} color={Palette.hermesOrange} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vascoActionTitle}>Dagrapport invullen</Text>
                      <Text style={styles.vascoActionReason}>Nog niet ingediend vandaag</Text>
                    </View>
                  </View>
                  <View style={styles.vascoActionBtns}>
                    <Pressable style={styles.vascoApproveBtn} onPress={() => { hapticSuccess(); router.push('/sitelead/daily-report' as any); }}>
                      <Ionicons name="arrow-forward" size={14} color={Palette.white} />
                      <Text style={styles.vascoApproveBtnText}>Invullen</Text>
                    </Pressable>
                  </View>
                </View>
              </FadeIn>
            )}

            {blockedTeams.length > 0 && blockedTeams.map((bt, idx) => (
              <FadeIn key={bt.team.id} delay={60 + idx * 30}>
                <View style={[styles.vascoActionCard, { borderLeftColor: SemanticColors.feedbackError }]}>
                  <View style={styles.vascoActionHeader}>
                    <View style={[styles.vascoActionIcon, { backgroundColor: SemanticColors.feedbackError + '12' }]}>
                      <Ionicons name="lock-closed" size={18} color={SemanticColors.feedbackError} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vascoActionTitle}>{bt.team.name} geblokkeerd</Text>
                      <Text style={styles.vascoActionReason} numberOfLines={2}>
                        {bt.assignments.find(a => a.status === 'geblokkeerd')?.blockerNote || 'Wacht op ander team'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.vascoActionBtns}>
                    <Pressable style={styles.vascoApproveBtn} onPress={() => { hapticSuccess(); router.push(`/sitelead/team/${bt.team.id}` as any); }}>
                      <Ionicons name="arrow-forward" size={14} color={Palette.white} />
                      <Text style={styles.vascoApproveBtnText}>Oplossen</Text>
                    </Pressable>
                    <Pressable style={styles.vascoDismissBtn}><Text style={styles.vascoDismissBtnText}>Later</Text></Pressable>
                  </View>
                </View>
              </FadeIn>
            ))}

            {(qualityHealth?.defectsOpen ?? 0) > 0 && (
              <FadeIn delay={90}>
                <View style={[styles.vascoActionCard, { borderLeftColor: Palette.hermesOrange }]}>
                  <View style={styles.vascoActionHeader}>
                    <View style={[styles.vascoActionIcon, { backgroundColor: Palette.hermesOrange + '12' }]}>
                      <Ionicons name="construct-outline" size={18} color={Palette.hermesOrange} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vascoActionTitle}>{qualityHealth!.defectsOpen} open gebreken</Text>
                      <Text style={styles.vascoActionReason}>Afsluitpercentage: {qualityHealth!.closureRate}%</Text>
                    </View>
                  </View>
                  <View style={styles.vascoActionBtns}>
                    <Pressable style={styles.vascoApproveBtn} onPress={() => { hapticSuccess(); router.push('/sitelead/close-defect' as any); }}>
                      <Ionicons name="checkmark" size={14} color={Palette.white} />
                      <Text style={styles.vascoApproveBtnText}>Afsluiten</Text>
                    </Pressable>
                    <Pressable style={styles.vascoDismissBtn} onPress={() => router.push('/sitelead/log-defect' as any)}>
                      <Text style={styles.vascoDismissBtnText}>Nieuw loggen</Text>
                    </Pressable>
                  </View>
                </View>
              </FadeIn>
            )}

            {/* Recommendations from guidance */}
            {activeGuidance.length > 0 && (
              <FadeIn delay={120}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Aanbevelingen</Text>
                  {activeGuidance.slice(0, 3).map((rec: any) => (
                    <Pressable
                      key={rec.id}
                      style={({ pressed }) => [styles.vascoRecCard, pressed && { opacity: 0.85 }]}
                      onPress={() => rec.actionRoute ? router.push(rec.actionRoute as any) : null}
                    >
                      <Ionicons name={(rec.icon as IconName) || 'bulb-outline'} size={18} color={Palette.hermesOrange} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vascoRecTitle} numberOfLines={1}>{rec.title}</Text>
                        <Text style={styles.vascoRecDesc} numberOfLines={2}>{rec.message}</Text>
                      </View>
                      {rec.actionRoute && <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />}
                    </Pressable>
                  ))}
                </View>
              </FadeIn>
            )}

            {/* Quick links — documents + management at bottom */}
            <FadeIn delay={160}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Beheer</Text>
                <View style={{ backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' }}>
                  {[
                    { icon: 'document-lock-outline' as IconName, title: t('sitelead.ramsDocs'), route: '/sitelead/safety-docs' },
                    { icon: 'card-outline' as IconName, title: t('sitelead.workerCerts'), route: '/sitelead/worker-certs' },
                    { icon: 'shield-checkmark-outline' as IconName, title: t('sitelead.compliance'), route: '/sitelead/compliance' },
                    { icon: 'git-branch-outline' as IconName, title: t('sitelead.dispatch'), route: '/sitelead/dispatch' },
                    { icon: 'notifications-outline' as IconName, title: t('settings.notifications', 'Meldingen'), route: '/contractor/notifications' },
                  ].map((item) => (
                    <Pressable key={item.route} style={({ pressed }) => [styles.meerItem, pressed && { opacity: 0.85 }]} onPress={() => router.push(item.route as any)}>
                      <Ionicons name={item.icon} size={18} color={SemanticColors.textSecondary} />
                      <Text style={[styles.meerTitle, { flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                      <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
                    </Pressable>
                  ))}
                </View>
              </View>
            </FadeIn>
          </>
        )}

        {/* ============================================ */}
        {/* PLANNING TAB — Team-centric schedule */}
        {/* ============================================ */}
        {activeTab === 'dispatch' && (
          <>
            {/* Planning KPIs — pressable */}
            <ContractorDashboardHeader
              kpis={[
                { icon: 'people', value: String(planningStats.totalPersons), label: 'Werknemers', color: Palette.hermesOrange, onPress: () => router.push('/sitelead/dispatch' as any) },
                { icon: 'grid', value: `${planningStats.occupiedZones}/${planningStats.totalZones}`, label: 'Zones', color: Palette.hermesOrange },
                { icon: 'alert-circle', value: String(planningStats.blockers), label: 'Blokkades', color: planningStats.blockers > 0 ? SemanticColors.feedbackError : SemanticColors.feedbackSuccess },
              ]}
            />

            {/* Blocker banner — only when blockers exist */}
            {blockedTeams.length > 0 && (
              <Pressable
                style={pStyles.blockerBanner}
                onPress={() => router.push(`/sitelead/team/${blockedTeams[0].team.id}` as any)}
              >
                <View style={pStyles.blockerBannerIcon}>
                  <Ionicons name="lock-closed" size={14} color={SemanticColors.feedbackError} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={pStyles.blockerBannerTitle} numberOfLines={1}>
                    {blockedTeams.length === 1
                      ? `${blockedTeams[0].team.name} is geblokkeerd`
                      : `${blockedTeams.length} teams geblokkeerd`}
                  </Text>
                  {blockedTeams[0].assignments.find(a => a.status === 'geblokkeerd')?.blockerNote && (
                    <Text style={pStyles.blockerBannerSub} numberOfLines={1}>
                      {blockedTeams[0].assignments.find(a => a.status === 'geblokkeerd')!.blockerNote}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.feedbackError} />
              </Pressable>
            )}

            {/* Date navigation */}
            <View style={pStyles.dateNav}>
              <Pressable style={pStyles.dateChevron} onPress={() => setSelectedDate(navigateDay(selectedDate, -1))}>
                <Ionicons name="chevron-back" size={18} color={SemanticColors.textPrimary} />
              </Pressable>
              <View style={pStyles.dateCenterCol}>
                <Text style={pStyles.dateHeader}>{formatDateHeader(selectedDate)}</Text>
                <View style={pStyles.dayDots}>
                  {weekDays.map((d, i) => {
                    const sel = isSameDay(d, selectedDate);
                    const today = isToday(d);
                    return (
                      <Pressable
                        key={i}
                        style={[
                          pStyles.dayDot,
                          sel && pStyles.dayDotSelected,
                          today && !sel && pStyles.dayDotToday,
                        ]}
                        onPress={() => setSelectedDate(d)}
                      >
                        <Text style={[
                          pStyles.dayDotText,
                          sel && pStyles.dayDotTextSelected,
                        ]}>{DAY_LABELS[d.getDay()]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Pressable style={pStyles.dateChevron} onPress={() => setSelectedDate(navigateDay(selectedDate, 1))}>
                <Ionicons name="chevron-forward" size={18} color={SemanticColors.textPrimary} />
              </Pressable>
            </View>

            {/* Summary strip */}
            <View style={pStyles.summaryStrip}>
              <View style={pStyles.summaryItem}>
                <Text style={pStyles.summaryValue}>{planningStats.active}</Text>
                <Text style={pStyles.summaryLabel}>Actief</Text>
              </View>
              <View style={pStyles.summaryDivider} />
              <View style={pStyles.summaryItem}>
                <Text style={pStyles.summaryValue}>{planningStats.totalPersons}</Text>
                <Text style={pStyles.summaryLabel}>Personen</Text>
              </View>
              <View style={pStyles.summaryDivider} />
              <View style={pStyles.summaryItem}>
                <Text style={pStyles.summaryValue}>{planningStats.occupiedZones}/{planningStats.totalZones}</Text>
                <Text style={pStyles.summaryLabel}>Zones</Text>
              </View>
            </View>

            {/* Team schedule cards */}
            <View style={{ gap: GRID.sm }}>
              {teamSchedule.map(entry => (
                <PlanningTeamCard
                  key={entry.team.id}
                  entry={entry}
                  onPress={() => router.push(`/sitelead/team/${entry.team.id}` as any)}
                />
              ))}
            </View>

            {/* AI insight — bottom */}
            {dispatchInsight && (
              <InlineInsight icon={dispatchInsight.icon as IconName} message={dispatchInsight.message} />
            )}

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
    backgroundColor: PAGE_BG,
  },

  // Header — light sand with greeting
  header: {
    backgroundColor: PAGE_BG,
    paddingHorizontal: 20,
    paddingTop: SafeArea.top,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerGreeting: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.displayTracking,
  },
  headerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  headerLocation: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    fontFamily: TYPE.captionFamily,
  },
  headerNotifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  } as any,
  headerNotifBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: SemanticColors.feedbackError,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  } as any,
  headerNotifBadgeText: {
    fontSize: 8,
    fontFamily: 'Manrope_700Bold',
    color: Palette.white,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: Palette.white,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SafeArea.content,
    paddingVertical: 20,
    gap: 16,
  },

  // Gauge row
  gaugeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gaugeCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  gaugeValue: {
    fontSize: 22,
    fontFamily: 'Manrope_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  gaugeLabel: {
    fontSize: 10,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  gaugeBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: SemanticColors.surfaceSecondary,
    marginTop: 4,
    overflow: 'hidden',
  },
  gaugeBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Action strip — horizontal scroll buttons (matching Werk tab)
  actionStrip: {
    gap: GRID.sm,
    paddingRight: 20,
  },
  actionStripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    backgroundColor: Palette.hermesOrange + '10',
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  actionStripText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },

  // Meer tab items
  // Vasco AI tab — proactive action queue
  vascoStatusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg,
    borderLeftWidth: 3, borderLeftColor: Palette.hermesOrange, padding: 16,
  },
  vascoStatusIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.hermesOrange + '12', alignItems: 'center', justifyContent: 'center' },
  vascoStatusTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  vascoStatusDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },

  vascoActionCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 14, gap: 10,
    borderLeftWidth: 3,
  },
  vascoActionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  vascoActionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  vascoActionTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  vascoActionReason: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 2 },
  vascoActionBtns: { flexDirection: 'row', gap: 6, paddingLeft: 46 },
  vascoApproveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.sm,
    paddingHorizontal: 14, paddingVertical: 8, flex: 1, justifyContent: 'center',
  },
  vascoApproveBtnText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.white },
  vascoDismissBtn: {
    borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: SemanticColors.surfaceSecondary, alignItems: 'center', justifyContent: 'center',
  },
  vascoDismissBtnText: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },

  vascoRecCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: 14,
    borderLeftWidth: 3, borderLeftColor: Palette.hermesOrange,
  },
  vascoRecTitle: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  vascoRecDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, marginTop: 1 },

  meerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 12,
  },
  meerIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meerTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  meerDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Daily report banner
  dailyReportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  dailyReportText: {
    flex: 1,
    fontSize: 13,
    fontFamily: TYPE.titleFamily,
  },

  // Sections
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.sectionTracking,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: Palette.hermesOrange + '18',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sectionBadgeText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.tinyFamily,
    color: Palette.hermesOrange,
  },

  // AI chip
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '30',
  },
  primaryActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionTitle: {
    fontSize: 16,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  primaryActionDesc: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.hermesOrange + '0A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  aiChipText: {
    fontSize: 13,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },

  // Team cards
  teamCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  teamTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamName: {
    fontSize: 14,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  teamMeta: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  teamDeviation: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
  },
  teamTask: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  teamBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'visible',
  },
  teamBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  teamBarMarker: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 10,
    backgroundColor: SemanticColors.textPrimary,
    borderRadius: 1,
    opacity: 0.3,
  },
  teamFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamTime: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  teamBlocker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  teamBlockerText: {
    fontSize: 10,
    color: SemanticColors.feedbackWarning,
    flex: 1,
  },
  teamActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  substituteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: Palette.hermesOrange + '0C',
  },
  substituteBtnText: {
    fontSize: 12,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },
  escalateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  escalateBtnText: {
    fontSize: 12,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackError,
  },

  // Quick actions
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  quickPillText: {
    fontSize: 13,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },

  // Cards
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },

  // Dashboard Card (pressable overview)
  dashboardCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  dashboardCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashboardCardTitle: {
    fontSize: 15,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },

  // Safety Banner
  safetyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
  },
  safetyBannerLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  safetyBannerScore: {
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
    marginTop: 2,
  },
  ltirLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  ltirValue: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
  },

  // Bar charts
  barGroup: {
    gap: 8,
  },
  barRow: {
    gap: 2,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  barValue: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
  },
  barTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'hidden',
  },
  barFill: {
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
  defectLegend: {
    gap: 4,
  },
  defectLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  defectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  defectLegendText: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  defectLegendCount: {
    fontSize: 13,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },

  // Closure Rate
  closureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  closureRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  closureRingValue: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
  },
  closureRingLabel: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
  },
  closureStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closureStatLabel: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  closureStatValue: {
    fontSize: 13,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },

  // Actions List
  actionsList: {
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  actionSubtitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Empty
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    padding: 20,
    paddingTop: 100,
    textAlign: 'center',
  },
});

// =============================================================================
// PLANNING STYLES (pStyles)
// =============================================================================

const pStyles = StyleSheet.create({
  // Blocker banner
  blockerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError + '30',
    borderRadius: 12,
    padding: 12,
  },
  blockerBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SemanticColors.feedbackError + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockerBannerTitle: {
    fontSize: 14,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.feedbackError,
  },
  blockerBannerSub: {
    fontSize: 12,
    color: SemanticColors.feedbackError,
    marginTop: 1,
  },

  // Date navigation
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenterCol: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  dateHeader: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.textPrimary,
  },
  dayDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dayDot: {
    width: 34,
    height: 28,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  dayDotSelected: {
    backgroundColor: Palette.hermesOrange,
  },
  dayDotToday: {
    borderWidth: 1.5,
    borderColor: Palette.hermesOrange,
  },
  dayDotText: {
    fontSize: 11,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  dayDotTextSelected: {
    color: Palette.white,
  },

  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.textPrimary,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: SemanticColors.surfaceSecondary,
  },

  // Planning Team Card
  card: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tradeIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamName: {
    fontSize: 14,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  teamLead: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  timePillText: {
    fontSize: 11,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  taskText: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
    fontFamily: TYPE.labelFamily,
  },
  zoneTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  zoneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  zoneTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  zoneTagText: {
    fontSize: 10,
    fontFamily: TYPE.titleFamily,
  },

  // Progress row (bar + inline %)
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    minWidth: 32,
    textAlign: 'right',
  },

  // Blocker strip inside card
  blockerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.feedbackErrorBg,
    padding: 8,
    borderRadius: 8,
  },
  blockerIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SemanticColors.feedbackError + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockerText: {
    fontSize: 12,
    color: SemanticColors.feedbackError,
    fontFamily: TYPE.labelFamily,
    flex: 1,
  },

  // Delay strip inside card
  delayStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.feedbackWarningBg,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  delayText: {
    fontSize: 11,
    color: SemanticColors.feedbackWarning,
    fontFamily: TYPE.labelFamily,
    flex: 1,
  },

  // AI Dagplanning button
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  aiButtonText: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: Palette.white,
  },
});
