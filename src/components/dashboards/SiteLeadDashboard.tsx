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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Palette } from '../../theme/colors';
import { Spacing, SafeArea } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
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
import { recordScreenVisit } from '../../intelligence/learningStorage';
import { ContractorDashboardHeader } from '../contractor/ContractorDashboardHeader';

type IconName = keyof typeof Ionicons.glyphMap;
export type SiteLeadTabView = 'overview' | 'dispatch' | 'safety' | 'quality';
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
  { id: 'z-abg', name: 'Blok A - BG', phase: 'afbouw', color: '#2E7D32' },
  { id: 'z-av2', name: 'Blok A - Verd. 2', phase: 'installatie', color: '#2563EB' },
  { id: 'z-bv1', name: 'Blok B - Verd. 1', phase: 'installatie', color: '#7C3AED' },
  { id: 'z-bbuit', name: 'Blok B - Buiten', phase: 'ruwbouw', color: '#D97706' },
  { id: 'z-cv3', name: 'Blok C - Verd. 3', phase: 'afbouw', color: '#DB2777' },
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

// Site Lead palette
const SL = {
  terracotta: '#D2691E',
  terracottaLight: '#E8956A',
  terracottaMuted: '#D2691E18',
  charcoal: '#2D2926',
  sand: '#FFFFFF',
  sandDark: '#F5F5F5',
  cream: '#FFFFFF',
  warmGray: '#8A7E76',
};

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
  blocked: '#C62828',
  behind: '#C62828',
  'at-risk': '#D97706',
  'on-track': SL.terracotta,
  completed: '#2E7D32',
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
              <Text style={[pStyles.teamName, isCompleted && { color: SL.warmGray }]} numberOfLines={1}>{team.name}</Text>
              {isCompleted && <Ionicons name="checkmark-circle" size={14} color="#2E7D32" />}
            </View>
            <Text style={pStyles.teamLead} numberOfLines={1}>{team.lead} · {team.members} pers.</Text>
          </View>
          {timeRange ? (
            <View style={pStyles.timePill}>
              <Ionicons name="time-outline" size={11} color={SL.warmGray} />
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
              <Ionicons name="lock-closed" size={12} color="#C62828" />
            </View>
            <Text style={pStyles.blockerText} numberOfLines={1}>{blocker.blockerNote}</Text>
          </View>
        )}

        {/* Delay strip */}
        {delayNote && (
          <View style={pStyles.delayStrip}>
            <Ionicons name="alert-circle" size={13} color="#D97706" />
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
  const { user } = useAuth();
  const [activeTab] = useState<TabView>(initialTab);

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
    return {
      defectsOpen: siteMetrics.defectsOpenTotal,
      defectsClosed: siteMetrics.defectsClosedTotal,
      closureRate: siteMetrics.defectClosureRate,
      reworkCost: siteMetrics.reworkCostToDate,
    };
  }, [siteMetrics]);

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
      case 'good': return '#2E7D32';
      case 'fair': return '#D97706';
      default: return '#C62828';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'on-track': return '#2E7D32';
      case 'at-risk': return '#D97706';
      default: return '#C62828';
    }
  };

  const getTeamColor = (status: TeamStatus) => {
    switch (status) {
      case 'on-track': return SL.terracotta;
      case 'at-risk': return SL.warmGray;
      case 'behind': return '#C62828';
      case 'completed': return '#2E7D32';
    }
  };

  if (!selectedProject || !siteMetrics || !progressHealth || !safetyHealth || !qualityHealth) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Laden...</Text>
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
              <Ionicons name="location" size={14} color={SL.terracotta} />
              <Text style={styles.headerLocation} numberOfLines={1}>{selectedProject.name}</Text>
            </View>
          </View>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================ */}
        {/* OVERVIEW TAB */}
        {/* ============================================ */}
        {activeTab === 'overview' && (
          <>
            {/* Dashboard voortgang — compact gauges */}
            <View style={styles.gaugeRow}>
              <View style={styles.gaugeCard}>
                <Text style={[styles.gaugeValue, { color: getProgressColor(progressHealth.status) }]}>
                  {progressHealth.actual}%
                </Text>
                <Text style={styles.gaugeLabel}>Voortgang</Text>
                <View style={styles.gaugeBar}>
                  <View style={[styles.gaugeBarFill, { width: `${progressHealth.actual}%`, backgroundColor: getProgressColor(progressHealth.status) }]} />
                </View>
              </View>
              <View style={styles.gaugeCard}>
                <Text style={[styles.gaugeValue, { color: getSafetyColor(safetyHealth.score) }]}>
                  {safetyHealth.ltir.toFixed(1)}
                </Text>
                <Text style={styles.gaugeLabel}>LTIR</Text>
                <View style={styles.gaugeBar}>
                  <View style={[styles.gaugeBarFill, { width: `${Math.min((safetyHealth.ltir / 2) * 100, 100)}%`, backgroundColor: getSafetyColor(safetyHealth.score) }]} />
                </View>
              </View>
              <View style={styles.gaugeCard}>
                <Text style={[styles.gaugeValue, { color: qualityHealth.defectsOpen > 20 ? '#D97706' : '#2E7D32' }]}>
                  {qualityHealth.defectsOpen}
                </Text>
                <Text style={styles.gaugeLabel}>Open</Text>
                <View style={styles.gaugeBar}>
                  <View style={[styles.gaugeBarFill, { width: `${Math.min((qualityHealth.defectsOpen / 40) * 100, 100)}%`, backgroundColor: qualityHealth.defectsOpen > 20 ? '#D97706' : '#2E7D32' }]} />
                </View>
              </View>
            </View>

            {/* Vasco AI Guidance */}
            <VascoInsightList
              insights={activeGuidance}
              title="Vasco Intelligentie"
              compact
              maxVisible={2}
              onDismiss={handleDismissGuidance}
              onAction={handleGuidanceAction}
              onSnooze={handleSnoozeGuidance}
            />
            {overviewInsight && (
              <InlineInsight icon={overviewInsight.icon as IconName} message={overviewInsight.message} />
            )}

            {/* Werkploegen — pressable, clean colors */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Werkploegen</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{activeTeams.length} actief</Text>
                </View>
              </View>

              {/* AI scheduling chip */}
              <Pressable
                style={styles.aiChip}
                onPress={() => Alert.alert(
                  'AI Inzet Planning',
                  'Vasco analyseert weer, prioriteiten, beschikbaarheid en vakanties om een optimale bezetting voor te stellen.',
                  [{ text: 'OK' }]
                )}
              >
                <Ionicons name="sparkles" size={14} color={SL.terracotta} />
                <Text style={styles.aiChipText} numberOfLines={1}>AI inzet planning</Text>
                <Ionicons name="chevron-forward" size={14} color={SL.terracotta} />
              </Pressable>

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
                        <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
                      ) : (
                        <Text style={[styles.teamDeviation, { color }]}>
                          {deviation >= 0 ? '+' : ''}{deviation}%
                        </Text>
                      )}
                      <Ionicons name="chevron-forward" size={16} color="#CCC" />
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
                          <Ionicons name="alert-circle" size={11} color="#D97706" />
                          <Text style={styles.teamBlockerText} numberOfLines={1}>{team.blockers}</Text>
                        </View>
                      )}
                    </View>

                    {/* Substitute worker button */}
                    {team.status !== 'completed' && (
                      <Pressable
                        style={styles.substituteBtn}
                        onPress={() => {
                          Alert.alert(
                            'Vervangen / Bijplaatsen',
                            `Wil je een werknemer vervangen of bijplaatsen bij ${team.name}?`,
                            [
                              { text: 'Annuleer', style: 'cancel' },
                              { text: 'AI Voorstel', onPress: () => Alert.alert('AI Planning', 'Vasco analyseert beschikbaarheid, vakkennis, weer en reistijd om de beste vervanging voor te stellen.') },
                              { text: 'Handmatig', onPress: () => router.push(`/sitelead/team/${team.id}` as any) },
                            ]
                          );
                        }}
                      >
                        <Ionicons name="swap-horizontal" size={13} color={SL.terracotta} />
                        <Text style={styles.substituteBtnText} numberOfLines={1}>Vervangen</Text>
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Quick actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Snelle acties</Text>
              <View style={styles.quickRow}>
                <Pressable style={styles.quickPill} onPress={() => router.push('/contractor/ai-assistant' as any)}>
                  <Ionicons name="sparkles" size={16} color={SL.terracotta} />
                  <Text style={styles.quickPillText} numberOfLines={1}>AI Assistent</Text>
                </Pressable>
                <Pressable style={styles.quickPill} onPress={() => router.push('/contractor/documents' as any)}>
                  <Ionicons name="document-text" size={16} color={SL.terracotta} />
                  <Text style={styles.quickPillText} numberOfLines={1}>Documenten</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* ============================================ */}
        {/* SAFETY TAB */}
        {/* ============================================ */}
        {activeTab === 'safety' && (
          <>
            <ContractorDashboardHeader
              kpis={[
                { icon: 'shield-checkmark', value: safetyHealth.ltir.toFixed(2), label: 'LTIR', color: getSafetyColor(safetyHealth.score) },
                { icon: 'warning', value: String(safetyHealth.incidentsThisPeriod), label: 'Incidenten', color: safetyHealth.incidentsThisPeriod > 0 ? '#C62828' : undefined },
                { icon: 'eye', value: String(safetyHealth.nearMisses), label: 'Near-misses' },
              ]}
            />
            {safetyInsight && (
              <InlineInsight icon={safetyInsight.icon as IconName} message={safetyInsight.message} />
            )}

            {/* Safety Dashboard — pressable overview */}
            <Pressable
              style={styles.dashboardCard}
              onPress={() => router.push('/hub/reports' as any)}
            >
              <View style={styles.dashboardCardHeader}>
                <Text style={styles.dashboardCardTitle} numberOfLines={1}>Veiligheid Dashboard</Text>
                <Ionicons name="chevron-forward" size={18} color="#CCC" />
              </View>

              {/* Safety score banner */}
              <View style={[styles.safetyBanner, { backgroundColor: getSafetyColor(safetyHealth.score) + '12' }]}>
                <View>
                  <Text style={styles.safetyBannerLabel}>Safety Score</Text>
                  <Text style={[styles.safetyBannerScore, { color: getSafetyColor(safetyHealth.score) }]}>
                    {safetyHealth.score.toUpperCase()}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.ltirLabel}>LTIR</Text>
                  <Text style={[styles.ltirValue, { color: getSafetyColor(safetyHealth.score) }]}>
                    {safetyHealth.ltir.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Incident bars */}
              <View style={styles.barGroup}>
                {[
                  { label: 'Gewerkte uren', value: safetyHealth.hoursWorked.toLocaleString(), pct: 100, color: SL.terracotta },
                  { label: 'Incidenten (totaal)', value: String(safetyHealth.incidents), pct: safetyHealth.incidents > 0 ? Math.max((safetyHealth.incidents / 10) * 100, 15) : 0, color: '#C62828' },
                  { label: 'Deze periode', value: String(safetyHealth.incidentsThisPeriod), pct: safetyHealth.incidentsThisPeriod > 0 ? Math.max((safetyHealth.incidentsThisPeriod / 5) * 100, 10) : 0, color: '#D97706' },
                  { label: 'Near-misses', value: String(safetyHealth.nearMisses), pct: safetyHealth.nearMisses > 0 ? Math.max((safetyHealth.nearMisses / 5) * 100, 10) : 0, color: Palette.hermesOrange },
                ].map((item) => (
                  <View key={item.label} style={styles.barRow}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barLabel}>{item.label}</Text>
                      <Text style={[styles.barValue, { color: item.color }]}>{item.value}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            </Pressable>

            {/* Safety Actions — wired */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Veiligheid Acties</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/sitelead/incident-report' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: '#C6282815' }]}>
                    <Ionicons name="warning" size={18} color="#C62828" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle} numberOfLines={1}>Incident Melden</Text>
                    <Text style={styles.actionSubtitle} numberOfLines={2}>Meld veiligheidsincident of bijna-ongeluk</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </Pressable>

                <Pressable style={styles.actionItem} onPress={() => router.push('/sitelead/inspection' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SL.terracotta + '15' }]}>
                    <Ionicons name="clipboard" size={18} color={SL.terracotta} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle} numberOfLines={1}>Veiligheidsinspectie</Text>
                    <Text style={styles.actionSubtitle} numberOfLines={2}>Voer site veiligheidsronde uit</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </Pressable>

                <Pressable style={styles.actionItem} onPress={() => router.push('/sitelead/compliance' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: '#1565C015' }]}>
                    <Ionicons name="shield-checkmark" size={18} color="#1565C0" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle} numberOfLines={1}>Compliance & Certificaten</Text>
                    <Text style={styles.actionSubtitle} numberOfLines={2}>Nalevingsstatus, VCA, NEN certificaten</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* ============================================ */}
        {/* QUALITY TAB */}
        {/* ============================================ */}
        {activeTab === 'quality' && (
          <>
            <ContractorDashboardHeader
              kpis={[
                { icon: 'ribbon', value: String(qualityHealth.defectsOpen), label: 'Open Gebreken', color: qualityHealth.defectsOpen > 20 ? '#D97706' : '#2E7D32' },
                { icon: 'checkmark-circle', value: `${qualityHealth.closureRate}%`, label: 'Closure Rate' },
                { icon: 'construct', value: `\u20AC${qualityHealth.reworkCost.toLocaleString('nl-NL')}`, label: 'Herstelkosten' },
              ]}
            />
            {qualityInsight && (
              <InlineInsight icon={qualityInsight.icon as IconName} message={qualityInsight.message} />
            )}

            {/* Quality Dashboard — pressable */}
            <Pressable
              style={styles.dashboardCard}
              onPress={() => router.push('/hub/reports' as any)}
            >
              <View style={styles.dashboardCardHeader}>
                <Text style={styles.dashboardCardTitle} numberOfLines={1}>Kwaliteit Dashboard</Text>
                <Ionicons name="chevron-forward" size={18} color="#CCC" />
              </View>

              {/* Pipeline Bar */}
              <View style={styles.defectPipelineBar}>
                {qualityHealth.defectsClosed > 0 && (
                  <View style={[styles.defectPipelineSegment, { flex: qualityHealth.defectsClosed, backgroundColor: '#2E7D32' }]} />
                )}
                {qualityHealth.defectsOpen > 0 && (
                  <View style={[styles.defectPipelineSegment, { flex: qualityHealth.defectsOpen, backgroundColor: '#D97706' }]} />
                )}
              </View>
              <View style={styles.defectLegend}>
                <View style={styles.defectLegendItem}>
                  <View style={[styles.defectDot, { backgroundColor: '#2E7D32' }]} />
                  <Text style={styles.defectLegendText}>Gesloten</Text>
                  <Text style={styles.defectLegendCount}>{qualityHealth.defectsClosed}</Text>
                </View>
                <View style={styles.defectLegendItem}>
                  <View style={[styles.defectDot, { backgroundColor: '#D97706' }]} />
                  <Text style={styles.defectLegendText}>Open</Text>
                  <Text style={styles.defectLegendCount}>{qualityHealth.defectsOpen}</Text>
                </View>
              </View>

              {/* Closure Rate */}
              <View style={styles.closureRow}>
                <View style={[styles.closureRing, { borderColor: qualityHealth.closureRate >= 80 ? '#2E7D32' : '#D97706' }]}>
                  <Text style={[styles.closureRingValue, { color: qualityHealth.closureRate >= 80 ? '#2E7D32' : '#D97706' }]}>
                    {formatPercent(qualityHealth.closureRate)}
                  </Text>
                  <Text style={styles.closureRingLabel}>Closure</Text>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.closureStat}>
                    <Ionicons name="construct" size={14} color="#D97706" />
                    <Text style={styles.closureStatLabel}>Herstelkosten</Text>
                    <Text style={styles.closureStatValue}>{fmt(qualityHealth.reworkCost)}</Text>
                  </View>
                  <View style={styles.closureStat}>
                    <Ionicons name="trending-up" size={14} color={qualityHealth.closureRate >= 80 ? '#2E7D32' : '#C62828'} />
                    <Text style={styles.closureStatLabel}>Trend</Text>
                    <Text style={[styles.closureStatValue, { color: qualityHealth.closureRate >= 80 ? '#2E7D32' : '#C62828' }]}>
                      {qualityHealth.closureRate >= 80 ? 'Goed' : 'Aandacht nodig'}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>

            {/* Quality Actions — wired */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Kwaliteit Acties</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/sitelead/log-defect' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: '#D9770615' }]}>
                    <Ionicons name="bug" size={18} color="#D97706" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle} numberOfLines={1}>Log Gebrek / Garantie</Text>
                    <Text style={styles.actionSubtitle} numberOfLines={2}>Registreer kwaliteitsprobleem met foto's</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </Pressable>

                <Pressable style={styles.actionItem} onPress={() => router.push('/sitelead/close-defect' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: '#2E7D3215' }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle} numberOfLines={1}>Sluit Gebrek</Text>
                    <Text style={styles.actionSubtitle} numberOfLines={2}>Markeer gebreken als opgelost</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* ============================================ */}
        {/* PLANNING TAB — Team-centric schedule */}
        {/* ============================================ */}
        {activeTab === 'dispatch' && (
          <>
            {/* Blocker banner — only when blockers exist */}
            {blockedTeams.length > 0 && (
              <Pressable
                style={pStyles.blockerBanner}
                onPress={() => router.push(`/sitelead/team/${blockedTeams[0].team.id}` as any)}
              >
                <View style={pStyles.blockerBannerIcon}>
                  <Ionicons name="lock-closed" size={14} color="#C62828" />
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
                <Ionicons name="chevron-forward" size={16} color="#C62828" />
              </Pressable>
            )}

            {/* Date navigation */}
            <View style={pStyles.dateNav}>
              <Pressable style={pStyles.dateChevron} onPress={() => setSelectedDate(navigateDay(selectedDate, -1))}>
                <Ionicons name="chevron-back" size={18} color={SL.charcoal} />
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
                <Ionicons name="chevron-forward" size={18} color={SL.charcoal} />
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

            {/* Inline AI insight */}
            {dispatchInsight && (
              <InlineInsight icon={dispatchInsight.icon as IconName} message={dispatchInsight.message} />
            )}

            {/* Team schedule cards */}
            <View style={{ gap: 10 }}>
              {teamSchedule.map(entry => (
                <PlanningTeamCard
                  key={entry.team.id}
                  entry={entry}
                  onPress={() => router.push(`/sitelead/team/${entry.team.id}` as any)}
                />
              ))}
            </View>

            {/* AI Dagplanning button */}
            <Pressable
              style={pStyles.aiButton}
              onPress={() => Alert.alert(
                'AI Dagplanning',
                'Vasco analyseert weer, beschikbaarheid, prioriteiten en afhankelijkheden om een optimale dagplanning voor te stellen.',
                [{ text: 'OK' }]
              )}
            >
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={pStyles.aiButtonText}>AI Dagplanning</Text>
            </Pressable>
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
    backgroundColor: SL.sand,
  },

  // Header — light sand with greeting
  header: {
    backgroundColor: SL.sand,
    paddingHorizontal: 20,
    paddingTop: SafeArea.top,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerGreeting: {
    fontSize: 24,
    fontWeight: '700',
    color: SL.charcoal,
  },
  headerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  headerLocation: {
    fontSize: 14,
    color: SL.warmGray,
    fontWeight: '500',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SL.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
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
    backgroundColor: SL.cream,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  gaugeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: SL.charcoal,
  },
  gaugeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: SL.warmGray,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  gaugeBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: SL.sandDark,
    marginTop: 4,
    overflow: 'hidden',
  },
  gaugeBarFill: {
    height: '100%',
    borderRadius: 2,
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
    fontSize: 13,
    fontWeight: '700',
    color: SL.charcoal,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: SL.terracottaMuted,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: SL.terracotta,
  },

  // AI chip
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SL.terracotta + '0A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  aiChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: SL.terracotta,
  },

  // Team cards
  teamCard: {
    backgroundColor: SL.cream,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    fontWeight: '600',
    color: SL.charcoal,
  },
  teamMeta: {
    fontSize: 11,
    color: SL.warmGray,
    marginTop: 1,
  },
  teamDeviation: {
    fontSize: 12,
    fontWeight: '700',
  },
  teamTask: {
    fontSize: 12,
    color: SL.warmGray,
  },
  teamBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: SL.sandDark,
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
    backgroundColor: SL.charcoal,
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
    color: SL.warmGray,
  },
  teamBlocker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  teamBlockerText: {
    fontSize: 10,
    color: '#D97706',
    flex: 1,
  },
  substituteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: SL.terracotta + '0C',
  },
  substituteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: SL.terracotta,
  },

  // Quick actions
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SL.cream,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  quickPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: SL.charcoal,
  },

  // Cards
  card: {
    backgroundColor: SL.cream,
    borderRadius: 16,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SL.charcoal,
  },

  // Dashboard Card (pressable overview)
  dashboardCard: {
    backgroundColor: SL.cream,
    borderRadius: 16,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: Spacing.md,
  },
  dashboardCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashboardCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SL.charcoal,
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
    color: '#777',
  },
  safetyBannerScore: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  ltirLabel: {
    fontSize: 10,
    color: '#999',
  },
  ltirValue: {
    fontSize: 28,
    fontWeight: '700',
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
    color: '#777',
  },
  barValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  barTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SL.sandDark,
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
    backgroundColor: SL.sandDark,
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
    color: '#777',
  },
  defectLegendCount: {
    fontSize: 13,
    fontWeight: '600',
    color: SL.charcoal,
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
    backgroundColor: SL.sandDark,
  },
  closureRingValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  closureRingLabel: {
    fontSize: 9,
    color: '#999',
  },
  closureStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closureStatLabel: {
    flex: 1,
    fontSize: 12,
    color: '#777',
  },
  closureStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SL.charcoal,
  },

  // Actions List
  actionsList: {
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SL.sand,
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
    color: SL.charcoal,
  },
  actionSubtitle: {
    fontSize: 12,
    color: SL.warmGray,
    marginTop: 2,
  },

  // Empty
  emptyText: {
    fontSize: 14,
    color: SL.warmGray,
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
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
  },
  blockerBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockerBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C62828',
  },
  blockerBannerSub: {
    fontSize: 12,
    color: '#991B1B',
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
    backgroundColor: SL.cream,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  dateCenterCol: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  dateHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: SL.charcoal,
  },
  dayDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dayDot: {
    width: 34,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SL.sandDark,
  },
  dayDotSelected: {
    backgroundColor: SL.terracotta,
  },
  dayDotToday: {
    borderWidth: 1.5,
    borderColor: SL.terracotta,
  },
  dayDotText: {
    fontSize: 11,
    fontWeight: '600',
    color: SL.warmGray,
  },
  dayDotTextSelected: {
    color: '#fff',
  },

  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SL.cream,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SL.charcoal,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: SL.warmGray,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: SL.sandDark,
  },

  // Planning Team Card
  card: {
    flexDirection: 'row',
    backgroundColor: SL.cream,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
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
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: SL.charcoal,
  },
  teamLead: {
    fontSize: 11,
    color: SL.warmGray,
    marginTop: 1,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SL.sandDark,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '500',
    color: SL.warmGray,
  },
  taskText: {
    fontSize: 13,
    color: SL.charcoal,
    fontWeight: '500',
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
    borderRadius: 10,
  },
  zoneTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  zoneTagText: {
    fontSize: 10,
    fontWeight: '600',
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
    backgroundColor: SL.sandDark,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'right',
  },

  // Blocker strip inside card
  blockerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 8,
  },
  blockerIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockerText: {
    fontSize: 12,
    color: '#C62828',
    fontWeight: '500',
    flex: 1,
  },

  // Delay strip inside card
  delayStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  delayText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '500',
    flex: 1,
  },

  // AI Dagplanning button
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SL.terracotta,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: SL.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  aiButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
