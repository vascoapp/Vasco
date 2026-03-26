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
    const { error } = await supabase.from('decision_submissions').upsert({
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
    await supabase.rpc('update_tracker_progress', {
      p_tracker_id: submission.trackerId,
    }).catch(() => {}); // Non-critical

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

    return data.map(row => ({
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

export async function logActivity(trackerId: string, activityType: string, itemId?: string, metadata?: Record<string, any>): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    await supabase.from('decision_activities').insert({
      tracker_id: trackerId,
      activity_type: activityType,
      item_id: itemId,
      metadata: metadata ?? {},
    });
  } catch {
    // Non-critical
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

    const channel = supabase
      .channel(`decisions:${trackerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'decision_submissions',
          filter: `tracker_id=eq.${trackerId}`,
        },
        (payload) => {
          const row = payload.new as any;
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
          if (row.submitted_by === 'customer') {
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
