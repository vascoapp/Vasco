// =============================================================================
// EVE TELEMETRY — lightweight outcome log for live EVE actions
// =============================================================================
// Record approve/reject/execute/snooze outcomes on each EveAction family so
// the analyst agent can learn which types of nudges the contractor actually
// acts on. Backed by AsyncStorage + best-effort Supabase.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const LOCAL_KEY = '@vasco_eve_telemetry';

export type EveOutcome = 'approved' | 'rejected' | 'snoozed' | 'executed' | 'expired';

export interface EveTelemetryEntry {
  id: string;
  actionType: string;       // EveActionType or generic
  agentType: 'agent' | 'auditor' | 'analyst';
  entityKey?: string;
  outcome: EveOutcome;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export async function recordEveOutcome(entry: Omit<EveTelemetryEntry, 'createdAt'>): Promise<void> {
  const full: EveTelemetryEntry = { ...entry, createdAt: new Date().toISOString() };
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const log: EveTelemetryEntry[] = raw ? JSON.parse(raw) : [];
    log.push(full);
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(log.slice(-200)));
  } catch {}

  if (isSupabaseConfigured) {
    try {
      await (supabase.from('eve_telemetry' as any) as any).insert({
        id: full.id,
        action_type: full.actionType,
        agent_type: full.agentType,
        entity_key: full.entityKey ?? null,
        outcome: full.outcome,
        meta: full.meta ?? {},
        created_at: full.createdAt,
      });
    } catch {}
  }
}

export async function getEveOutcomes(limit: number = 50): Promise<EveTelemetryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const log: EveTelemetryEntry[] = raw ? JSON.parse(raw) : [];
    return log.slice(-limit);
  } catch {
    return [];
  }
}

/** Summary over the last 30 days — approvals / rejections / outstanding. */
export async function eveOutcomeSummary(): Promise<{ approved: number; rejected: number; snoozed: number; total: number }> {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const log = (await getEveOutcomes(500)).filter((e) => new Date(e.createdAt).getTime() > cutoff);
  const summary = { approved: 0, rejected: 0, snoozed: 0, total: log.length };
  for (const e of log) {
    if (e.outcome === 'approved' || e.outcome === 'executed') summary.approved += 1;
    else if (e.outcome === 'rejected') summary.rejected += 1;
    else if (e.outcome === 'snoozed') summary.snoozed += 1;
  }
  return summary;
}
