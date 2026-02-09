// =============================================================================
// VASCO KARMA SERVICE - Todoist-inspired productivity & gamification
// =============================================================================
// Tracks points, streaks, levels, and badges for guidance actions completed.
// =============================================================================

import { useState, useMemo, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface KarmaBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string; // ISO date
  requirement: number;
  category: 'streak' | 'tasks' | 'safety' | 'budget' | 'quality';
}

export interface KarmaAction {
  id: string;
  type: 'complete_guidance' | 'dismiss_guidance' | 'complete_task' | 'streak_bonus' | 'create_task';
  label: string;
  points: number;
  timestamp: string;
}

export type KarmaLevel = 'Starter' | 'Vakman' | 'Expert' | 'Meester';

export interface KarmaProfile {
  points: number;
  level: KarmaLevel;
  levelProgress: number; // 0–100 within current level
  streak: number; // consecutive days
  longestStreak: number;
  todayActions: number;
  todayGoal: number;
  badges: KarmaBadge[];
  recentActions: KarmaAction[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const LEVEL_THRESHOLDS: { level: KarmaLevel; min: number; max: number }[] = [
  { level: 'Starter', min: 0, max: 50 },
  { level: 'Vakman', min: 51, max: 150 },
  { level: 'Expert', min: 151, max: 300 },
  { level: 'Meester', min: 301, max: Infinity },
];

const POINTS = {
  complete_guidance: 10,
  dismiss_guidance: -2,
  complete_task: 15,
  streak_bonus: 5,
  create_task: 3,
} as const;

const ALL_BADGES: KarmaBadge[] = [
  { id: 'b1', name: 'Eerste Actie', description: 'Eerste guidance actie afgerond', icon: 'star', requirement: 1, category: 'tasks' },
  { id: 'b2', name: '5-Daagse Streak', description: '5 dagen achtereen actief', icon: 'flame', requirement: 5, category: 'streak' },
  { id: 'b3', name: 'Budget Bewaker', description: '10 kostenbesparende acties', icon: 'shield-checkmark', requirement: 10, category: 'budget' },
  { id: 'b4', name: 'Veiligheidsster', description: '5 veiligheidsgerelateerde acties', icon: 'medkit', requirement: 5, category: 'safety' },
  { id: 'b5', name: 'Taakmeester', description: '25 taken afgerond', icon: 'trophy', requirement: 25, category: 'tasks' },
  { id: 'b6', name: '10-Daagse Streak', description: '10 dagen achtereen actief', icon: 'bonfire', requirement: 10, category: 'streak' },
  { id: 'b7', name: 'Kwaliteitskampioen', description: '15 kwaliteitsacties voltooid', icon: 'ribbon', requirement: 15, category: 'quality' },
  { id: 'b8', name: 'Expert Status', description: 'Bereik Expert niveau', icon: 'school', requirement: 151, category: 'tasks' },
];

// =============================================================================
// MOCK STATE (simulates stored karma data)
// =============================================================================

const MOCK_ACTIONS: KarmaAction[] = [
  { id: 'ka1', type: 'complete_guidance', label: 'VCA certificaat vernieuwd', points: 10, timestamp: '2026-02-07T08:30:00' },
  { id: 'ka2', type: 'complete_task', label: 'Inspectie badkamer afgerond', points: 15, timestamp: '2026-02-07T09:15:00' },
  { id: 'ka3', type: 'complete_guidance', label: 'Factuur verstuurd aan klant', points: 10, timestamp: '2026-02-07T10:00:00' },
  { id: 'ka4', type: 'streak_bonus', label: 'Dagelijkse streak bonus', points: 5, timestamp: '2026-02-07T07:00:00' },
  { id: 'ka5', type: 'complete_guidance', label: 'Veiligheidscheck voltooid', points: 10, timestamp: '2026-02-06T16:00:00' },
  { id: 'ka6', type: 'dismiss_guidance', label: 'Tip overgeslagen', points: -2, timestamp: '2026-02-06T14:00:00' },
  { id: 'ka7', type: 'create_task', label: 'Nieuwe taak aangemaakt', points: 3, timestamp: '2026-02-06T11:00:00' },
];

const MOCK_PROFILE_BASE = {
  points: 167,
  streak: 7,
  longestStreak: 12,
  todayActions: 4,
  todayGoal: 8,
};

// =============================================================================
// HOOKS
// =============================================================================

function getLevel(points: number): KarmaLevel {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (points >= threshold.min && points <= threshold.max) return threshold.level;
  }
  return 'Meester';
}

function getLevelProgress(points: number): number {
  const threshold = LEVEL_THRESHOLDS.find(t => points >= t.min && points <= t.max);
  if (!threshold || threshold.max === Infinity) return 100;
  const range = threshold.max - threshold.min;
  return Math.round(((points - threshold.min) / range) * 100);
}

export function useKarmaProfile(_role?: string): KarmaProfile {
  return useMemo(() => {
    const points = MOCK_PROFILE_BASE.points;
    const level = getLevel(points);
    const levelProgress = getLevelProgress(points);

    // Unlock badges based on mock state
    const unlockedBadges = ALL_BADGES.filter(badge => {
      if (badge.category === 'streak') return MOCK_PROFILE_BASE.streak >= badge.requirement;
      if (badge.id === 'b8') return points >= badge.requirement;
      if (badge.category === 'tasks') return MOCK_PROFILE_BASE.todayActions >= badge.requirement || points > 50;
      return points > badge.requirement * 5;
    }).map(b => ({ ...b, unlockedAt: '2026-02-07' }));

    return {
      points,
      level,
      levelProgress,
      streak: MOCK_PROFILE_BASE.streak,
      longestStreak: MOCK_PROFILE_BASE.longestStreak,
      todayActions: MOCK_PROFILE_BASE.todayActions,
      todayGoal: MOCK_PROFILE_BASE.todayGoal,
      badges: unlockedBadges,
      recentActions: MOCK_ACTIONS,
    };
  }, [_role]);
}

export function useKarmaActions(): {
  actions: KarmaAction[];
  awardPoints: (type: KarmaAction['type'], label: string) => void;
} {
  const [actions, setActions] = useState<KarmaAction[]>(MOCK_ACTIONS);

  const awardPoints = useCallback((type: KarmaAction['type'], label: string) => {
    const newAction: KarmaAction = {
      id: `ka-${Date.now()}`,
      type,
      label,
      points: POINTS[type],
      timestamp: new Date().toISOString(),
    };
    setActions(prev => [newAction, ...prev]);
  }, []);

  return { actions, awardPoints };
}

export function useKarmaBadges(): KarmaBadge[] {
  return useMemo(() => ALL_BADGES, []);
}

export { POINTS as KARMA_POINTS };
