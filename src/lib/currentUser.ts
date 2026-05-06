// =============================================================================
// CURRENT USER REF — module-level accessor for non-hook consumers
// =============================================================================
// Services, schedulers, and emit-business-event call sites can't use
// `useAuth()`. This module exposes a tiny ref that AuthContext writes on
// login/logout, so background services record events against the right
// user id instead of the legacy `'current-user'` placeholder.
//
// Fallback: before any login happens (splash, first-run), returns
// `'current-user'` to keep back-compat with demo-mode code paths that
// accept the literal.
// =============================================================================

let currentUserId: string = 'current-user';
let currentCountry: string | undefined;
let currentTrade: string | undefined;

// R46: tiny pub/sub so non-hook consumers (notably AppStateProvider holding
// in-memory contractor data arrays) can react to login/logout transitions
// and reset stale state — without a circular `useAuth` dep.
type UserChangeListener = (userId: string | null) => void;
const userChangeListeners = new Set<UserChangeListener>();

export function subscribeUserChange(fn: UserChangeListener): () => void {
  userChangeListeners.add(fn);
  return () => { userChangeListeners.delete(fn); };
}

function notifyUserChange(): void {
  const id = currentUserId === 'current-user' ? null : currentUserId;
  userChangeListeners.forEach((fn) => {
    try { fn(id); } catch {}
  });
}

export function setCurrentUser(info: { id: string; country?: string; trade?: string } | null): void {
  const prev = currentUserId;
  if (!info) {
    currentUserId = 'current-user';
    currentCountry = undefined;
    currentTrade = undefined;
  } else {
    currentUserId = info.id || 'current-user';
    currentCountry = info.country;
    currentTrade = info.trade;
  }
  if (prev !== currentUserId) notifyUserChange();
}

export function getCurrentUserId(): string {
  return currentUserId;
}

/**
 * R58: returns the real authenticated user id (uuid), or null when no
 * user is signed in (placeholder state). Use this at moat-write sites
 * that should early-return when there's no real user. The legacy
 * `getCurrentUserId()` returns the literal `'current-user'` string for
 * back-compat with demo paths — that string is truthy, so naive
 * `if (!userId) return` guards don't catch it.
 */
export function getAuthedUserId(): string | null {
  return currentUserId === 'current-user' ? null : currentUserId;
}

export function getCurrentCountry(): string | undefined {
  return currentCountry;
}

export function getCurrentTrade(): string | undefined {
  return currentTrade;
}
