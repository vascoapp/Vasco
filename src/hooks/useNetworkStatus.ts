// =============================================================================
// USE NETWORK STATUS — Tracks connectivity + offline queue state
// =============================================================================
// Lightweight hook using fetch-based connectivity checks (no NetInfo dependency).
// Also tracks the offline queue size and sync status for UI display.
// =============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState as RNAppState } from 'react-native';
import { offlineQueue } from '../services/offlineQueueService';
import { syncService, SyncStatus } from '../services/syncService';

const CHECK_INTERVAL_MS = 30_000; // 30 seconds
const CHECK_TIMEOUT_MS = 5_000;

export interface NetworkStatus {
  isOnline: boolean;
  syncStatus: SyncStatus;
  queueSize: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [queueSize, setQueueSize] = useState(0);
  const wasOffline = useRef(false);

  // Check connectivity with a lightweight HEAD request
  const checkConnectivity = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
      await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Refresh queue size from the service
  const refreshQueueSize = useCallback(async () => {
    const size = await offlineQueue.getQueueSize();
    setQueueSize(size);
  }, []);

  // Main connectivity loop
  useEffect(() => {
    let mounted = true;

    const performCheck = async () => {
      const online = await checkConnectivity();
      if (!mounted) return;

      setIsOnline(online);

      if (online && wasOffline.current) {
        // Just came back online — trigger sync
        wasOffline.current = false;
        const size = await offlineQueue.getQueueSize();
        if (size > 0) {
          await syncService.processQueue();
        }
      }

      if (!online) {
        wasOffline.current = true;
      }

      await refreshQueueSize();
    };

    performCheck();
    const interval = setInterval(performCheck, CHECK_INTERVAL_MS);

    // Also check on app foreground
    const subscription = RNAppState.addEventListener('change', (state) => {
      if (state === 'active') {
        performCheck();
      }
    });

    return () => {
      mounted = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [checkConnectivity, refreshQueueSize]);

  // Subscribe to offline queue events (enqueue/dequeue/clear)
  useEffect(() => {
    const unsubQueue = offlineQueue.subscribe(() => {
      refreshQueueSize();
    });
    return unsubQueue;
  }, [refreshQueueSize]);

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubSync = syncService.subscribe((status) => {
      setSyncStatus(status);
    });
    return unsubSync;
  }, []);

  return { isOnline, syncStatus, queueSize };
}
