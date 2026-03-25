// =============================================================================
// EVENT TRACKING SERVICE — Privacy-respecting analytics
// =============================================================================
// Tracks key user events with timestamps for product analytics.
// Stores events locally in AsyncStorage as a batch queue.
// Flushes to Supabase `analytics_events` table when configured.
// Privacy: no PII in event properties — only IDs and counts.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const EVENTS_STORAGE_KEY = '@vasco_analytics_events';
const SESSION_STORAGE_KEY = '@vasco_analytics_session';
const MAX_LOCAL_EVENTS = 1000; // Prune oldest when exceeded
const AUTO_FLUSH_THRESHOLD = 50; // Flush after N events accumulated

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventName =
  | 'login'
  | 'logout'
  | 'job_created'
  | 'job_completed'
  | 'invoice_created'
  | 'invoice_sent'
  | 'quote_created'
  | 'quote_sent'
  | 'quote_accepted'
  | 'payment_received'
  | 'onboarding_step'
  | 'feature_used'
  | 'search_performed'
  | 'material_search'
  | 'material_added_to_cart'
  | 'po_created_from_search';

export interface EventProperties {
  [key: string]: string | number | boolean | null;
}

export interface UserContext {
  userId: string;
  role: 'contractor' | 'aannemer' | 'sitelead';
  country: string;
}

export interface AnalyticsEvent {
  id: string;
  name: EventName;
  properties: EventProperties;
  userContext: UserContext | null;
  sessionId: string;
  platform: string;
  platformVersion: string | number;
  timestamp: string; // ISO
  flushed: boolean;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

let currentSessionId: string | null = null;
let currentUserContext: UserContext | null = null;

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Initialize or resume a session. Call on app start.
 */
export async function initSession(userContext?: UserContext): Promise<string> {
  if (userContext) {
    currentUserContext = userContext;
  }

  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      const age = Date.now() - session.startedAt;
      const THIRTY_MINUTES = 30 * 60 * 1000;
      // Resume session if less than 30 minutes old
      if (age < THIRTY_MINUTES) {
        currentSessionId = session.id;
        return session.id;
      }
    }
  } catch {
    // Corrupted — create new
  }

  currentSessionId = generateSessionId();
  await AsyncStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ id: currentSessionId, startedAt: Date.now() }),
  ).catch(() => {});

  return currentSessionId;
}

/**
 * Update the user context (e.g., after login).
 */
export function setUserContext(context: UserContext): void {
  currentUserContext = context;
}

/**
 * Clear user context (e.g., on logout).
 */
export function clearUserContext(): void {
  currentUserContext = null;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function loadEvents(): Promise<AnalyticsEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Corrupted — start fresh
  }
  return [];
}

async function saveEvents(events: AnalyticsEvent[]): Promise<void> {
  // Enforce max limit — drop oldest flushed first, then oldest unflushed
  if (events.length > MAX_LOCAL_EVENTS) {
    const flushed = events.filter((e) => e.flushed);
    const unflushed = events.filter((e) => !e.flushed);
    const overflow = events.length - MAX_LOCAL_EVENTS;

    if (flushed.length >= overflow) {
      // Remove oldest flushed
      events = [...flushed.slice(overflow), ...unflushed];
    } else {
      // Remove all flushed + oldest unflushed
      const remaining = overflow - flushed.length;
      events = unflushed.slice(remaining);
    }
  }

  await AsyncStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Track a user event. Properties must not contain PII — use IDs and counts only.
 */
export async function trackEvent(
  name: EventName,
  properties: EventProperties = {},
): Promise<void> {
  if (!currentSessionId) {
    await initSession();
  }

  const event: AnalyticsEvent = {
    id: generateId(),
    name,
    properties,
    userContext: currentUserContext,
    sessionId: currentSessionId!,
    platform: Platform.OS,
    platformVersion: Platform.Version,
    timestamp: new Date().toISOString(),
    flushed: false,
  };

  const events = await loadEvents();
  events.push(event);
  await saveEvents(events);

  // Auto-flush when threshold reached
  const unflushedCount = events.filter((e) => !e.flushed).length;
  if (unflushedCount >= AUTO_FLUSH_THRESHOLD && isSupabaseConfigured) {
    // Fire and forget — don't block the caller
    flushEvents().catch(() => {});
  }
}

/**
 * Get the count of events with the given name (local store).
 */
export async function getEventCount(name: EventName): Promise<number> {
  const events = await loadEvents();
  return events.filter((e) => e.name === name).length;
}

/**
 * Flush all unflushed events to Supabase.
 * Returns the number of events successfully flushed.
 */
export async function flushEvents(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const events = await loadEvents();
  const unflushed = events.filter((e) => !e.flushed);

  if (unflushed.length === 0) return 0;

  // Batch insert in chunks of 50
  const BATCH_SIZE = 50;
  let flushedCount = 0;

  for (let i = 0; i < unflushed.length; i += BATCH_SIZE) {
    const batch = unflushed.slice(i, i + BATCH_SIZE);
    const rows = batch.map((e) => ({
      id: e.id,
      name: e.name,
      properties: e.properties,
      user_id: e.userContext?.userId ?? null,
      user_role: e.userContext?.role ?? null,
      country: e.userContext?.country ?? null,
      session_id: e.sessionId,
      platform: e.platform,
      platform_version: String(e.platformVersion),
      timestamp: e.timestamp,
    }));

    try {
      const { error } = await supabase
        .from('analytics_events' as never)
        .insert(rows as never);

      if (!error) {
        // Mark batch as flushed
        for (const event of batch) {
          event.flushed = true;
        }
        flushedCount += batch.length;
      }
    } catch {
      // Network error — stop flushing, retry later
      break;
    }
  }

  if (flushedCount > 0) {
    await saveEvents(events);
  }

  return flushedCount;
}

/**
 * Get a summary of event counts by name (for local diagnostics).
 */
export async function getEventSummary(): Promise<Record<string, number>> {
  const events = await loadEvents();
  const summary: Record<string, number> = {};
  for (const event of events) {
    summary[event.name] = (summary[event.name] ?? 0) + 1;
  }
  return summary;
}

/**
 * Clear all flushed events from local storage.
 * Keeps unflushed events for retry.
 */
export async function pruneFlush(): Promise<number> {
  const events = await loadEvents();
  const kept = events.filter((e) => !e.flushed);
  const pruned = events.length - kept.length;
  if (pruned > 0) {
    await saveEvents(kept);
  }
  return pruned;
}
