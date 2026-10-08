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
// R66r50: vatScheme accessor for non-hook consumers (photo-quote preview,
// invoice/spreadsheet extractor, country-aware VAT helpers).
let currentVatScheme: string | undefined;
// The BUSINESS PROFILE's values, kept apart from the account's (#218: the
// profile outranks the account). They shared one slot, and setCurrentUser
// replaces every field — so each AuthContext re-run (account country/trade/
// role arriving, a handover finishing) put the ACCOUNT country back over the
// profile the contractor had entered and erased the vatScheme. Cleared when
// the user changes; read first by the getters.
let profileCountry: string | undefined;
let profileTrade: string | undefined;
let profileVatScheme: string | undefined;
let profileBusinessName: string | undefined;

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

export function setCurrentUser(info: { id: string; country?: string; trade?: string; vatScheme?: string } | null): void {
  const prev = currentUserId;
  if (!info) {
    currentUserId = 'current-user';
    currentCountry = undefined;
    currentTrade = undefined;
    currentVatScheme = undefined;
  } else {
    currentUserId = info.id || 'current-user';
    currentCountry = info.country;
    currentTrade = info.trade;
    currentVatScheme = info.vatScheme;
  }
  if (prev !== currentUserId) {
    profileCountry = undefined;
    profileTrade = undefined;
    profileVatScheme = undefined;
    profileBusinessName = undefined;
    notifyUserChange();
  }
}

/**
 * The signed-in contractor's business profile (hydrate + profile edits).
 * Only the fields given are changed; it never touches the user id, and an
 * account re-publish (`setCurrentUser`, same id) cannot overwrite it.
 */
export function setProfileContext(info: { country?: string | null; trade?: string | null; vatScheme?: string | null; businessName?: string | null }): void {
  if (getAuthedUserId() === null) return;
  if (info.businessName !== undefined) profileBusinessName = info.businessName?.trim() || undefined;
  if (info.country !== undefined) profileCountry = info.country ?? undefined;
  if (info.trade !== undefined) profileTrade = info.trade ?? undefined;
  if (info.vatScheme !== undefined) profileVatScheme = info.vatScheme ?? undefined;
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
  return profileCountry ?? currentCountry;
}

export function getCurrentTrade(): string | undefined {
  return profileTrade ?? currentTrade;
}

/** The business name customer messages are signed with (profile). */
export function getCurrentBusinessName(): string | undefined {
  return profileBusinessName;
}

export function getCurrentVatScheme(): string | undefined {
  return profileVatScheme ?? currentVatScheme;
}
