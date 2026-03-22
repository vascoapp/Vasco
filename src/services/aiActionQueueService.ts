// =============================================================================
// AI ACTION QUEUE — EVE-inspired proactive work preparation
// =============================================================================
// AI prepares work items proactively. Contractor reviews and approves.
// Pattern: AI does the thinking → queues result → human approves → action executes
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

const QUEUE_KEY = '@vasco_ai_queue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueueItemStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type QueueItemType =
  | 'draft_invoice'      // AI prepared an invoice from completed job
  | 'draft_reminder'     // AI prepared a payment reminder
  | 'draft_followup'     // AI prepared a quote follow-up
  | 'draft_quote'        // AI prepared a quote from template
  | 'cert_renewal'       // AI flagged expiring cert with renewal link
  | 'schedule_suggestion' // AI suggests filling a schedule gap
  | 'price_alert'        // AI found cheaper supplier
  | 'maintenance_due'    // AI detected annual maintenance opportunity
  | 'reorder_materials'  // AI detected low stock
  | 'decision_reminder'  // AI detected pending customer decision
  | 'bulk_purchase';     // AI detected bulk buying opportunity

export interface QueueItem {
  id: string;
  type: QueueItemType;
  status: QueueItemStatus;
  title: string;           // "Factuur voor Fam. de Vries"
  description: string;     // "CV-ketel onderhoud afgerond op 20 maart"
  preparedData: Record<string, any>; // The actual draft data (invoice lines, reminder text, etc.)
  actionLabel: string;     // "Versturen" / "Aanmaken" / "Vernieuwen"
  estimatedImpact: string; // "€450 omzet" / "5 min bespaard"
  createdAt: string;
  expiresAt?: string;      // Auto-expire after X days
  sourceGeneratorId?: string; // Which AI generator created this
}

// ---------------------------------------------------------------------------
// Queue management
// ---------------------------------------------------------------------------

export async function getQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const items: QueueItem[] = raw ? JSON.parse(raw) : [];
    // Filter expired
    const now = new Date().toISOString();
    return items.filter(i => i.status === 'pending' && (!i.expiresAt || i.expiresAt > now));
  } catch {
    return [];
  }
}

export async function addToQueue(item: Omit<QueueItem, 'id' | 'status' | 'createdAt'>): Promise<string> {
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const full: QueueItem = {
    ...item,
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  try {
    const queue = await getQueue();
    // Deduplicate: don't add if same type + same title already pending
    if (queue.some(q => q.type === item.type && q.title === item.title)) return '';
    queue.unshift(full);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, 50)));
  } catch {}
  return id;
}

export async function approveItem(itemId: string): Promise<QueueItem | null> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const items: QueueItem[] = raw ? JSON.parse(raw) : [];
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.status = 'approved';
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
      return item;
    }
  } catch {}
  return null;
}

export async function rejectItem(itemId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const items: QueueItem[] = raw ? JSON.parse(raw) : [];
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.status = 'rejected';
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Proactive queue population — called on app open
// ---------------------------------------------------------------------------

export async function populateQueue(context: {
  completedJobs: any[];
  overdueInvoices: any[];
  sentQuotes: any[];
  expiringCerts: any[];
}): Promise<number> {
  let added = 0;

  // Draft invoices for completed jobs without invoices
  for (const job of context.completedJobs.slice(0, 3)) {
    const id = await addToQueue({
      type: 'draft_invoice',
      title: `Factuur voor ${job.title}`,
      description: `Klus afgerond · €${(job.quotedAmount ?? 0).toLocaleString('nl-NL')}`,
      preparedData: { jobId: job.id, amount: job.quotedAmount, customer: job.customerId },
      actionLabel: 'Factuur aanmaken',
      estimatedImpact: `€${(job.quotedAmount ?? 0).toLocaleString('nl-NL')} omzet`,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    if (id) added++;
  }

  // Draft reminders for overdue invoices
  for (const inv of context.overdueInvoices.slice(0, 3)) {
    const id = await addToQueue({
      type: 'draft_reminder',
      title: `Herinnering voor ${inv.id}`,
      description: `€${(inv.amount ?? 0).toLocaleString('nl-NL')} achterstallig`,
      preparedData: { invoiceId: inv.id, amount: inv.amount, customer: inv.customer },
      actionLabel: 'Herinnering versturen',
      estimatedImpact: 'Versnelt betaling met ~5 dagen',
      expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    });
    if (id) added++;
  }

  // Follow-ups for unanswered quotes
  for (const quote of context.sentQuotes.slice(0, 2)) {
    const id = await addToQueue({
      type: 'draft_followup',
      title: `Opvolging offerte ${quote.id}`,
      description: `${quote.customer} · €${(quote.amount ?? 0).toLocaleString('nl-NL')}`,
      preparedData: { quoteId: quote.id, customer: quote.customer, amount: quote.amount },
      actionLabel: 'Opvolging sturen',
      estimatedImpact: 'Verhoogt acceptatiekans met 20%',
      expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
    });
    if (id) added++;
  }

  return added;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useAIQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    getQueue().then(setItems).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const approve = useCallback(async (id: string) => {
    const item = await approveItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
    return item;
  }, []);

  const reject = useCallback(async (id: string) => {
    await rejectItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  return { items, loading, approve, reject, refresh, count: items.length };
}
