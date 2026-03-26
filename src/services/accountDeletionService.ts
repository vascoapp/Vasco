// =============================================================================
// ACCOUNT DELETION SERVICE — GDPR Article 17: Right to erasure
// =============================================================================
// Handles complete account deletion: local data wipe + server-side request.
// The UI layer handles user confirmation (Alert); this service does the work.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { deleteSecureItem } from '../lib/secureStorage';
import { logWarn } from '../utils/errorHandler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeletionResult {
  success: boolean;
  localCleared: boolean;
  serverRequested: boolean;
  error?: string;
}

interface DeletionRequest {
  userId: string;
  requestedAt: string;
  platform: string;
  status: 'pending' | 'completed' | 'failed';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** SecureStore keys used by integrations (no @ prefix — these go through SecureStore) */
const SECURE_KEYS = [
  'vasco_mollie',
  'vasco_moneybird',
  'vasco_lexoffice',
  'vasco_sevdesk',
  'vasco_pennylane',
  'vasco_holded',
  'vasco_fattureincloud',
];

/** Known AsyncStorage key prefixes to ensure complete cleanup */
const VASCO_PREFIXES = ['@vasco_', '@secure_'];

// ---------------------------------------------------------------------------
// Local data clearing
// ---------------------------------------------------------------------------

/**
 * Clear ALL local data: AsyncStorage (@vasco_ keys) + SecureStore credentials.
 * This is a destructive, irreversible operation.
 */
export async function clearAllLocalData(): Promise<{ cleared: number }> {
  let cleared = 0;

  // 1. Clear all @vasco_ and @secure_ keys from AsyncStorage
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const vascoKeys = allKeys.filter((k) =>
      VASCO_PREFIXES.some((prefix) => k.startsWith(prefix)),
    );

    if (vascoKeys.length > 0) {
      await AsyncStorage.multiRemove(vascoKeys);
      cleared += vascoKeys.length;
    }
  } catch (error) {
    // Log but continue — we want to clear as much as possible
    logWarn('AccountDeletion', `AsyncStorage clear error: ${error}`);
  }

  // 2. Clear all SecureStore keys (API tokens, credentials)
  for (const key of SECURE_KEYS) {
    try {
      await deleteSecureItem(key);
      cleared += 1;
    } catch {
      // SecureStore delete fails silently if key doesn't exist — that's fine
    }
  }

  // 3. Sign out from Supabase (clears session tokens)
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
      cleared += 1;
    } catch {
      // Best effort — session may already be expired
    }
  }

  return { cleared };
}

// ---------------------------------------------------------------------------
// Server-side deletion request
// ---------------------------------------------------------------------------

/**
 * Request account deletion on the server side.
 *
 * Since Supabase client SDK cannot delete auth users (requires admin/service key),
 * we insert a deletion request row that a server-side function or admin can process.
 *
 * The expected table schema:
 *   account_deletion_requests (
 *     id uuid primary key default gen_random_uuid(),
 *     user_id uuid references auth.users(id),
 *     requested_at timestamptz default now(),
 *     platform text,
 *     status text default 'pending',
 *     processed_at timestamptz
 *   )
 */
async function requestServerDeletion(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const request: DeletionRequest = {
      userId,
      requestedAt: new Date().toISOString(),
      platform: Platform.OS,
      status: 'pending',
    };

    // Try to insert into deletion requests table
    const { error } = await (supabase
      .from('account_deletion_requests') as any)
      .insert({
        user_id: request.userId,
        requested_at: request.requestedAt,
        platform: request.platform,
        status: request.status,
      });

    if (error) {
      // Table may not exist yet — fall back to edge function
      logWarn('AccountDeletion', `Table insert failed, trying edge function: ${error.message}`);
      return await requestDeletionViaEdgeFunction(userId);
    }

    return true;
  } catch (error) {
    logWarn('AccountDeletion', `Server deletion request failed: ${error}`);
    return false;
  }
}

/** Fallback: call a Supabase Edge Function for deletion */
async function requestDeletionViaEdgeFunction(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('request-account-deletion', {
      body: {
        userId,
        requestedAt: new Date().toISOString(),
        platform: Platform.OS,
      },
    });

    if (error) {
      logWarn('AccountDeletion', `Edge function failed: ${error.message}`);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full account deletion flow:
 * 1. Queue server-side deletion request (if Supabase configured)
 * 2. Clear all local data (AsyncStorage + SecureStore)
 * 3. Sign out
 *
 * The caller (UI) should:
 * - Show confirmation Alert before calling this
 * - Navigate to login/welcome screen after success
 */
export async function requestAccountDeletion(
  userId: string,
): Promise<DeletionResult> {
  try {
    // Step 1: Request server-side deletion (before clearing local auth)
    let serverRequested = false;
    if (isSupabaseConfigured && userId) {
      serverRequested = await requestServerDeletion(userId);
    }

    // Step 2: Clear all local data
    const { cleared } = await clearAllLocalData();
    const localCleared = cleared > 0;

    return {
      success: true,
      localCleared,
      serverRequested,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Deletion failed';
    return {
      success: false,
      localCleared: false,
      serverRequested: false,
      error: message,
    };
  }
}

/**
 * Check if there's a pending deletion request for this user.
 * Useful for showing status on re-login before server processes the request.
 */
export async function checkDeletionStatus(
  userId: string,
): Promise<{ pending: boolean; requestedAt?: string }> {
  if (!isSupabaseConfigured) return { pending: false };

  try {
    const { data, error } = await (supabase
      .from('account_deletion_requests') as any)
      .select('requested_at, status')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return { pending: false };

    return {
      pending: true,
      requestedAt: data.requested_at as string,
    };
  } catch {
    return { pending: false };
  }
}
