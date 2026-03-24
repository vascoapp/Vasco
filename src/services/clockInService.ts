// =============================================================================
// CLOCK-IN SERVICE — Unified timer shared across all screens
// =============================================================================
// Single source of truth for contractor clock-in state.
// Persisted to AsyncStorage so timer survives navigation + app restart.
// Used by: Vandaag tab, Timesheet screen, Job Detail screen.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS_PER_HOUR } from '../utils/timeConstants';

const CLOCK_KEY = '@vasco_unified_clock';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClockInState {
  active: boolean;
  jobId: string | null;
  jobTitle: string | null;
  startTime: number | null; // Date.now() timestamp
  startTimeFormatted: string | null; // "HH:MM"
}

const EMPTY_STATE: ClockInState = {
  active: false,
  jobId: null,
  jobTitle: null,
  startTime: null,
  startTimeFormatted: null,
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function loadClockState(): Promise<ClockInState> {
  try {
    const raw = await AsyncStorage.getItem(CLOCK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return EMPTY_STATE;
}

async function saveClockState(state: ClockInState): Promise<void> {
  await AsyncStorage.setItem(CLOCK_KEY, JSON.stringify(state)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function clockIn(jobId?: string, jobTitle?: string): Promise<ClockInState> {
  const now = Date.now();
  const d = new Date(now);
  const formatted = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  const state: ClockInState = {
    active: true,
    jobId: jobId ?? null,
    jobTitle: jobTitle ?? null,
    startTime: now,
    startTimeFormatted: formatted,
  };
  await saveClockState(state);
  return state;
}

export async function clockOut(): Promise<{ hours: number; state: ClockInState }> {
  const current = await loadClockState();
  const hours = current.startTime
    ? Math.round(((Date.now() - current.startTime) / MS_PER_HOUR) * 10) / 10
    : 0;
  await saveClockState(EMPTY_STATE);
  return { hours, state: current };
}

// ---------------------------------------------------------------------------
// React Hook — shared timer state
// ---------------------------------------------------------------------------

export function useClockIn() {
  const [state, setState] = useState<ClockInState>(EMPTY_STATE);
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');

  // Load persisted state on mount
  useEffect(() => {
    loadClockState().then(setState).catch(() => {});
  }, []);

  // Timer tick
  useEffect(() => {
    if (!state.active || !state.startTime) {
      setTimerDisplay('00:00:00');
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - state.startTime!) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      setTimerDisplay(`${h}:${m}:${s}`);
    };
    tick(); // Immediate first tick
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state.active, state.startTime]);

  const doClockIn = useCallback(async (jobId?: string, jobTitle?: string) => {
    const newState = await clockIn(jobId, jobTitle);
    setState(newState);
    return newState;
  }, []);

  const doClockOut = useCallback(async () => {
    const result = await clockOut();
    setState(EMPTY_STATE);
    return result;
  }, []);

  const refresh = useCallback(async () => {
    const loaded = await loadClockState();
    setState(loaded);
  }, []);

  return {
    ...state,
    timerDisplay,
    clockIn: doClockIn,
    clockOut: doClockOut,
    refresh,
  };
}
