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

export function setCurrentUser(info: { id: string; country?: string; trade?: string } | null): void {
  if (!info) {
    currentUserId = 'current-user';
    currentCountry = undefined;
    currentTrade = undefined;
    return;
  }
  currentUserId = info.id || 'current-user';
  currentCountry = info.country;
  currentTrade = info.trade;
}

export function getCurrentUserId(): string {
  return currentUserId;
}

export function getCurrentCountry(): string | undefined {
  return currentCountry;
}

export function getCurrentTrade(): string | undefined {
  return currentTrade;
}
