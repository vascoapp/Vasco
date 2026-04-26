// =============================================================================
// ACTIVE PROJECT SERVICE (R248)
// =============================================================================
// Tracks which aannemer project the contractor is currently focused on.
// Backs the ProjectSwitcher pill row on Vandaag and pre-fills the project
// context when navigating into site-lead screens (defects, reports, etc).
// =============================================================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_active_project';

const subscribers = new Set<(id: string | null) => void>();
let cachedActiveId: string | null | undefined;       // undefined = not loaded yet

async function load(): Promise<string | null> {
  if (cachedActiveId !== undefined) return cachedActiveId;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cachedActiveId = raw && raw.length > 0 ? raw : null;
  } catch {
    cachedActiveId = null;
  }
  return cachedActiveId;
}

export async function getActiveProjectId(): Promise<string | null> {
  return load();
}

export async function setActiveProjectId(projectId: string | null): Promise<void> {
  cachedActiveId = projectId;
  try {
    if (projectId) {
      await AsyncStorage.setItem(STORAGE_KEY, projectId);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // best-effort
  }
  subscribers.forEach((fn) => { try { fn(projectId); } catch {} });
}

export function useActiveProject(): { activeProjectId: string | null; setActive: (id: string | null) => Promise<void>; loading: boolean } {
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(cachedActiveId ?? null);
  const [loading, setLoading] = useState(cachedActiveId === undefined);

  useEffect(() => {
    let mounted = true;
    if (cachedActiveId === undefined) {
      load().then((id) => { if (mounted) { setActiveProjectIdState(id); setLoading(false); } });
    }
    const sub = (id: string | null) => { if (mounted) setActiveProjectIdState(id); };
    subscribers.add(sub);
    return () => { mounted = false; subscribers.delete(sub); };
  }, []);

  return {
    activeProjectId,
    setActive: setActiveProjectId,
    loading,
  };
}
