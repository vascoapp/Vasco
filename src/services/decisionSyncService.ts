// =============================================================================
// DECISION SYNC SERVICE — closes the customer↔contractor loop
// =============================================================================
// Bridges: customer portal → Supabase → contractor app (realtime)
// Falls back to local state when Supabase not configured
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useCallback } from 'react';
import { logWarn } from '../utils/errorHandler';
import { logIntelligenceWriteFailure } from '../intelligence/dataCollector';
import { getCurrentUserId } from '../lib/currentUser';

const LOCAL_KEY = '@vasco_decision_submissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecisionSubmission {
  id?: string;
  trackerId: string;
  itemId: string;
  submittedBy: 'customer' | 'contractor';
  value?: string;
  notes?: string;
  photos?: string[];
  linkedProductUrl?: string;
  timeToDecideSeconds?: number;
  submittedAt: string;
}

export interface TrackerStatus {
  trackerId: string;
  totalItems: number;
  completedItems: number;
  submissions: DecisionSubmission[];
  lastActivity?: string;
}

// ---------------------------------------------------------------------------
// Submit a decision (called from customer portal)
// ---------------------------------------------------------------------------

export async function submitDecision(submission: DecisionSubmission): Promise<boolean> {
  // Always save locally first
  await saveLocalSubmission(submission);

  if (!isSupabaseConfigured) return true;

  try {
    const { error } = await (supabase.from as any)('decision_submissions').upsert({
      tracker_id: submission.trackerId,
      item_id: submission.itemId,
      submitted_by: submission.submittedBy,
      value: submission.value,
      notes: submission.notes,
      photos: submission.photos,
      linked_product_url: submission.linkedProductUrl,
      time_to_decide_seconds: submission.timeToDecideSeconds,
      submitted_at: submission.submittedAt,
    }, { onConflict: 'tracker_id,item_id,submitted_by' });

    if (error) {
      logWarn('decisionSync', `Submit failed: ${error.message}`);
      return false;
    }

    // Update tracker completed count
    try {
      await (supabase.rpc as any)('update_tracker_progress', {
        p_tracker_id: submission.trackerId,
      });
    } catch {} // Non-critical

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Fetch submissions for a tracker (called from contractor app)
// ---------------------------------------------------------------------------

export async function getTrackerSubmissions(trackerId: string): Promise<DecisionSubmission[]> {
  if (!isSupabaseConfigured) {
    return getLocalSubmissions(trackerId);
  }

  try {
    const { data, error } = await supabase
      .from('decision_submissions')
      .select('*')
      .eq('tracker_id', trackerId)
      .order('submitted_at', { ascending: false });

    if (error || !data) return getLocalSubmissions(trackerId);

    return (data as any[]).map(row => ({
      id: row.id,
      trackerId: row.tracker_id,
      itemId: row.item_id,
      submittedBy: row.submitted_by,
      value: row.value,
      notes: row.notes,
      photos: row.photos,
      linkedProductUrl: row.linked_product_url,
      timeToDecideSeconds: row.time_to_decide_seconds,
      submittedAt: row.submitted_at,
    }));
  } catch {
    return getLocalSubmissions(trackerId);
  }
}

// ---------------------------------------------------------------------------
// Log portal activity
// ---------------------------------------------------------------------------

// R66 round 47: read-side for decision_activities — closes the dormancy
// flagged in R35. Customer hesitation timeline (item_viewed, item_expanded,
// help_clicked, etc.) was being written but no FE consumer read it. Now
// the contractor's tracker detail screen surfaces the customer's hesitation
// pattern: which items they viewed most, where they paused.
export interface DecisionActivity {
  id?: string;
  trackerId: string;
  activityType: string;
  itemId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export async function getTrackerActivities(trackerId: string): Promise<DecisionActivity[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase as any)
      .from('decision_activities')
      .select('*')
      .eq('tracker_id', trackerId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error || !data) return [];
    return (data as any[]).map((row) => ({
      id: row.id,
      trackerId: row.tracker_id,
      activityType: row.activity_type,
      itemId: row.item_id ?? undefined,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function logActivity(trackerId: string, activityType: string, itemId?: string, metadata?: Record<string, any>): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    await (supabase.from as any)('decision_activities').insert({
      tracker_id: trackerId,
      activity_type: activityType,
      item_id: itemId,
      metadata: metadata ?? {},
    });
  } catch (err) {
    // Non-critical write — but route to eve_telemetry so we can audit
    // RLS / schema drift later. Customer portal callers may have no
    // contractor uid; fall back to 'anon'.
    await logIntelligenceWriteFailure(
      'decision_activities.insert',
      getCurrentUserId() ?? 'anon',
      err,
    );
  }
}

// ---------------------------------------------------------------------------
// React hook: subscribe to realtime decision updates
// ---------------------------------------------------------------------------

export function useDecisionUpdates(trackerId: string | null): {
  submissions: DecisionSubmission[];
  loading: boolean;
  refresh: () => void;
  newCount: number;
} {
  const [submissions, setSubmissions] = useState<DecisionSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCount, setNewCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!trackerId) return;
    setLoading(true);
    const data = await getTrackerSubmissions(trackerId);
    setSubmissions(data);
    setLoading(false);
  }, [trackerId]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime subscription
  useEffect(() => {
    if (!trackerId || !isSupabaseConfigured) return;

    // R56: was filtering to `event: 'INSERT'` only — but `submitDecision`
    // uses `upsert` with onConflict so a customer EDITING their decision
    // fires UPDATE, not INSERT. Contractor's realtime listener missed
    // every edit. Switched to '*' so both INSERT (first submission) and
    // UPDATE (edited submission) propagate.
    const channel = supabase
      .channel(`decisions:${trackerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decision_submissions',
          filter: `tracker_id=eq.${trackerId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as any;
          if (!row) return;
          const submission: DecisionSubmission = {
            id: row.id,
            trackerId: row.tracker_id,
            itemId: row.item_id,
            submittedBy: row.submitted_by,
            value: row.value,
            notes: row.notes,
            photos: row.photos,
            linkedProductUrl: row.linked_product_url,
            timeToDecideSeconds: row.time_to_decide_seconds,
            submittedAt: row.submitted_at,
          };
          setSubmissions(prev => [submission, ...prev.filter(s => s.itemId !== submission.itemId)]);
          // Only bump newCount on first INSERT — UPDATE means the
          // contractor already saw it and the customer is revising.
          if (row.submitted_by === 'customer' && payload.eventType === 'INSERT') {
            setNewCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trackerId]);

  return { submissions, loading, refresh, newCount };
}

// ---------------------------------------------------------------------------
// R191: contractor-side aggregator across ALL their trackers.
// Pre-R191 the only reader was `useDecisionUpdates(trackerId)` — contractor
// had to OPEN each tracker manually to see if a customer submitted. There
// was no surface that said "X customers submitted decisions across N
// projects" so submissions sat unread.
//
// Returns a count of new submissions since the contractor last marked them
// seen (stored in AsyncStorage). Used by bedrijf.tsx to badge the Decisions
// tab.
// ---------------------------------------------------------------------------

const LAST_SEEN_KEY = '@vasco_decisions_last_seen';

export interface ContractorInboxItem {
  submissionId: string;
  trackerId: string;
  itemId: string;
  customerName?: string;
  value: unknown;
  submittedAt: string;
}

export function useContractorDecisionInbox(userId: string | null | undefined): {
  newCount: number;
  recent: ContractorInboxItem[];
  markAllSeen: () => Promise<void>;
} {
  const [recent, setRecent] = useState<ContractorInboxItem[]>([]);
  const [lastSeenIso, setLastSeenIso] = useState<string>('');

  // Load last-seen marker once
  useEffect(() => {
    AsyncStorage.getItem(LAST_SEEN_KEY).then((v) => setLastSeenIso(v ?? '')).catch(() => {});
  }, []);

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    let cancelled = false;

    const fetchRecent = async () => {
      try {
        // PostgREST nested filter — join to decision_trackers WHERE user_id = $userId.
        // !inner forces an inner join so non-owned submissions are excluded.
        const { data, error } = await (supabase as any)
          .from('decision_submissions')
          .select('id, tracker_id, item_id, value, submitted_at, submitted_by, tracker:decision_trackers!inner(user_id, customer_name)')
          .eq('tracker.user_id', userId)
          .eq('submitted_by', 'customer')
          .order('submitted_at', { ascending: false })
          .limit(50);
        if (error || cancelled) return;
        const mapped: ContractorInboxItem[] = (data as any[]).map((row) => ({
          submissionId: row.id,
          trackerId: row.tracker_id,
          itemId: row.item_id,
          customerName: row.tracker?.customer_name ?? undefined,
          value: row.value,
          submittedAt: row.submitted_at,
        }));
        setRecent(mapped);
      } catch {
        // Silent — UI degrades to "no new" rather than blocking the page
      }
    };

    fetchRecent();

    // Realtime: any customer submission across the contractor's trackers
    // bumps the inbox. We can't filter on a JOIN field in PostgREST realtime
    // (it filters only on the table's own columns), so we subscribe to ALL
    // decision_submissions and re-fetch on event — small list, infrequent.
    const channel = supabase
      .channel(`contractor-inbox:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'decision_submissions' },
        () => { fetchRecent(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const newCount = recent.filter((r) => r.submittedAt > lastSeenIso).length;

  const markAllSeen = useCallback(async () => {
    const now = new Date().toISOString();
    setLastSeenIso(now);
    try { await AsyncStorage.setItem(LAST_SEEN_KEY, now); } catch { /* silent */ }
  }, []);

  return { newCount, recent, markAllSeen };
}

// ---------------------------------------------------------------------------
// Local storage fallback
// ---------------------------------------------------------------------------

async function saveLocalSubmission(submission: DecisionSubmission): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const all: DecisionSubmission[] = raw ? JSON.parse(raw) : [];
    // Upsert by trackerId + itemId
    const idx = all.findIndex(s => s.trackerId === submission.trackerId && s.itemId === submission.itemId && s.submittedBy === submission.submittedBy);
    if (idx >= 0) {
      all[idx] = submission;
    } else {
      all.push(submission);
    }
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  } catch {
    // Silent
  }
}

async function getLocalSubmissions(trackerId: string): Promise<DecisionSubmission[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const all: DecisionSubmission[] = raw ? JSON.parse(raw) : [];
    return all.filter(s => s.trackerId === trackerId);
  } catch {
    return [];
  }
}
