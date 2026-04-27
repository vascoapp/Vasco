// =============================================================================
// CUSTOMER INBOX (R271)
// =============================================================================
// Lightweight per-customer inbound-message store. Lets the contractor capture
// what a customer said (paste from WhatsApp, write down what they said on the
// phone) so smart replies and follow-ups can reference real conversation
// context instead of guessing.
//
// AsyncStorage-backed (no server). Capped at INBOX_MAX_PER_CUSTOMER entries
// per customer to avoid bloat — older messages roll off.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '@vasco_customer_inbox';
const INBOX_MAX_PER_CUSTOMER = 20;

export type InboundChannel = 'whatsapp' | 'sms' | 'email' | 'phone' | 'other';

export interface InboundMessage {
  id: string;
  customerId: string;
  body: string;
  channel: InboundChannel;
  capturedAt: string;          // ISO
}

interface InboxState {
  byCustomer: Record<string, InboundMessage[]>;
}

async function readState(): Promise<InboxState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { byCustomer: {} };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.byCustomer
      ? parsed
      : { byCustomer: {} };
  } catch {
    return { byCustomer: {} };
  }
}

async function writeState(state: InboxState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silent — never block UI on storage write
  }
}

function makeId(): string {
  return `inbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Append a captured inbound message. Trims to INBOX_MAX_PER_CUSTOMER. */
export async function recordInboundMessage(
  customerId: string,
  body: string,
  channel: InboundChannel = 'other',
): Promise<InboundMessage | null> {
  const trimmed = body.trim();
  if (!customerId || !trimmed) return null;
  const state = await readState();
  const existing = state.byCustomer[customerId] ?? [];
  const msg: InboundMessage = {
    id: makeId(),
    customerId,
    body: trimmed,
    channel,
    capturedAt: new Date().toISOString(),
  };
  // Newest first; trim oldest beyond cap
  const updated = [msg, ...existing].slice(0, INBOX_MAX_PER_CUSTOMER);
  state.byCustomer[customerId] = updated;
  await writeState(state);
  return msg;
}

/** Returns the latest inbound message for a customer, or null. */
export async function getLatestInbound(customerId: string): Promise<InboundMessage | null> {
  if (!customerId) return null;
  const state = await readState();
  const list = state.byCustomer[customerId] ?? [];
  return list[0] ?? null;
}

/** Returns all inbound messages for a customer (newest first). */
export async function getInboundForCustomer(customerId: string): Promise<InboundMessage[]> {
  if (!customerId) return [];
  const state = await readState();
  return state.byCustomer[customerId] ?? [];
}

/** Removes one captured message by id. */
export async function deleteInboundMessage(messageId: string): Promise<void> {
  const state = await readState();
  for (const cid of Object.keys(state.byCustomer)) {
    const before = state.byCustomer[cid];
    const after = before.filter((m) => m.id !== messageId);
    if (after.length !== before.length) {
      state.byCustomer[cid] = after;
      await writeState(state);
      return;
    }
  }
}

/** React hook that subscribes to a single customer's inbox. */
export function useCustomerInbox(customerId: string | undefined | null) {
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!customerId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const list = await getInboundForCustomer(customerId);
    setMessages(list);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    let cancelled = false;
    if (!customerId) {
      setMessages([]);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    getInboundForCustomer(customerId).then((list) => {
      if (!cancelled) {
        setMessages(list);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [customerId]);

  const add = useCallback(
    async (body: string, channel: InboundChannel = 'other') => {
      if (!customerId) return null;
      const msg = await recordInboundMessage(customerId, body, channel);
      await refresh();
      return msg;
    },
    [customerId, refresh],
  );

  const remove = useCallback(
    async (messageId: string) => {
      await deleteInboundMessage(messageId);
      await refresh();
    },
    [refresh],
  );

  return { messages, latest: messages[0] ?? null, loading, add, remove, refresh };
}
