import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { startAutoSync, stopAutoSync } from '../intelligence/cloudSync';
import { startEventFlushing, stopEventFlushing } from '../intelligence/dataCollector';
import { trackEvent, initSession, setUserContext, clearUserContext, flushEvents } from '../services/eventTrackingService';
import { DEMO_MODE } from '../config/demo';
import { logWarn } from '../utils/errorHandler';
import { withTimeout } from '../utils/withTimeout';
import { setCurrentUser } from '../lib/currentUser';
import { addBreadcrumb } from '../lib/errorReporting';
import type { Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Account lockout — 5 failed attempts, stored in AsyncStorage
// ---------------------------------------------------------------------------
const LOCKOUT_KEY = '@vasco_auth_lockout';
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface LockoutData {
  attempts: number;
  firstAttemptAt: number;
}

async function checkAndRecordFailedAttempt(email: string): Promise<boolean> {
  try {
    const key = `${LOCKOUT_KEY}_${email.toLowerCase().trim()}`;
    const raw = await AsyncStorage.getItem(key);
    const data: LockoutData = raw ? JSON.parse(raw) : { attempts: 0, firstAttemptAt: Date.now() };
    const now = Date.now();

    // Reset window if expired
    if (now - data.firstAttemptAt > LOCKOUT_WINDOW_MS) {
      data.attempts = 0;
      data.firstAttemptAt = now;
    }

    // Already locked out?
    if (data.attempts >= LOCKOUT_MAX_ATTEMPTS) {
      return true; // locked out
    }

    data.attempts += 1;
    await AsyncStorage.setItem(key, JSON.stringify(data));
    return data.attempts >= LOCKOUT_MAX_ATTEMPTS;
  } catch {
    return false;
  }
}

async function clearLockout(email: string): Promise<void> {
  try {
    const key = `${LOCKOUT_KEY}_${email.toLowerCase().trim()}`;
    await AsyncStorage.removeItem(key);
  } catch {}
}

async function isLockedOut(email: string): Promise<boolean> {
  try {
    const key = `${LOCKOUT_KEY}_${email.toLowerCase().trim()}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return false;
    const data: LockoutData = JSON.parse(raw);
    const now = Date.now();
    if (now - data.firstAttemptAt > LOCKOUT_WINDOW_MS) return false;
    return data.attempts >= LOCKOUT_MAX_ATTEMPTS;
  } catch {
    return false;
  }
}

// ============================================
// ROLE TYPES
// ============================================

export type UserRole = 'cfo' | 'coo' | 'site-lead' | 'director' | 'contractor' | 'worker';

export type Country = 'UK' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'US';
export type Language = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company: string;
  projects: string[]; // Project IDs user has access to
  country?: Country;
  language?: Language;
  trade?: string;
  onboardingComplete?: boolean;
  isAannemer?: boolean; // Coordinates multiple trades per project (renovation GC)
}

/** True when the app is running in demo mode (no Supabase credentials) */
export const isDemoMode = !isSupabaseConfigured;

// ============================================
// MOCK USERS (Demo)
// ============================================

const MOCK_USERS: Record<string, User> = {
  'cfo@vasco.dev': {
    id: 'user-cfo-001',
    email: 'cfo@vasco.dev',
    name: 'Sarah Chen',
    role: 'cfo',
    company: 'Vasco Development',
    projects: ['uk-001', 'nl-001', 'de-001'],
  },
  'coo@vasco.dev': {
    id: 'user-coo-001',
    email: 'coo@vasco.dev',
    name: 'James Morrison',
    role: 'coo',
    company: 'Vasco Development',
    projects: ['uk-001', 'nl-001', 'de-001'],
  },
  'site@vasco.dev': {
    id: 'user-site-001',
    email: 'site@vasco.dev',
    name: 'Mike Thompson',
    role: 'site-lead',
    company: 'Vasco Development',
    projects: ['uk-001'],
  },
  'director@vasco.dev': {
    id: 'user-director-001',
    email: 'director@vasco.dev',
    name: 'Alexandra Wright',
    role: 'director',
    company: 'Vasco Development',
    projects: ['uk-001', 'nl-001', 'de-001'],
  },
  'contractor@vasco.dev': {
    id: 'user-contractor-001',
    email: 'contractor@vasco.dev',
    name: 'Jan van der Berg',
    role: 'contractor',
    company: 'VDB Painters',
    projects: [], // Contractors don't have projects, they have jobs
    country: 'NL',
    language: 'nl',
    trade: 'painting',
    onboardingComplete: true,
  },
  'aannemer@vasco.dev': {
    id: 'user-aannemer-001',
    email: 'aannemer@vasco.dev',
    name: 'Pieter van Dijk',
    role: 'contractor',
    company: 'Van Dijk Renovaties',
    projects: [],
    country: 'NL',
    language: 'nl',
    trade: 'general',
    onboardingComplete: true,
    isAannemer: true,
  },
  'worker@vasco.dev': {
    id: 'user-worker-001',
    email: 'worker@vasco.dev',
    name: 'Bas de Groot',
    role: 'worker',
    company: 'VDB Painters',
    projects: [],
    country: 'NL',
    language: 'nl',
    trade: 'painting',
    onboardingComplete: true,
  },
  'new@vasco.dev': {
    id: 'user-new-001',
    email: 'new@vasco.dev',
    name: 'New User',
    role: 'contractor',
    company: '',
    projects: [],
    country: 'NL',
    language: 'en',
    trade: 'plumbing',
    onboardingComplete: false,
  },
  // R75 US foundation: demo account for US contractor flow. Texas pilot
  // per us-expansion-plan Section A — no statewide GC license required
  // for most trades, large market. Trade = HVAC since the research
  // singles it out as the highest-value US home-service vertical.
  'contractor@vasco.us.dev': {
    id: 'user-contractor-us-001',
    email: 'contractor@vasco.us.dev',
    name: 'Mike Reynolds',
    role: 'contractor',
    company: "Reynolds Heating & Cooling",
    projects: [],
    country: 'US',
    language: 'en',
    trade: 'gas-hvac',
    onboardingComplete: true,
  },
};

/**
 * R314: a demo-account Supabase session must never survive into a build
 * where DEMO_MODE is off. TestFlight/store updates preserve AsyncStorage,
 * so a session created on an older DEMO_MODE=true build (preview/dev
 * profiles) would otherwise be silently restored by getSession() /
 * onAuthStateChange on the first cold start of a production build —
 * auto-logging the tester into demo data with no login screen. The
 * `login()` path already blocks demo accounts when !DEMO_MODE; this
 * closes the same hole on the session-restore path. Real user accounts
 * are unaffected — staying signed in across app updates is by design.
 */
function isBlockedDemoSession(email: string | null | undefined): boolean {
  if (DEMO_MODE || !email) return false;
  return !!MOCK_USERS[email.toLowerCase().trim()];
}

// ============================================
// ROLE CONFIGURATION
// ============================================

export interface RoleConfig {
  label: string;
  title: string;
  description: string;
  primaryColor: string;
  features: string[];
  tabs: {
    id: string;
    label: string;
    icon: string;
  }[];
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  cfo: {
    label: 'CFO',
    title: 'Finance Control',
    description: 'Financial oversight, appraisals, cost control, and investor reporting',
    primaryColor: '#2563EB', // Blue for CFO (per theme)
    features: [
      'Development Appraisals',
      'Cost Control & EAC',
      'Transfer Tax Calculator',
      'Lender Draw Requests',
      'Investor Updates',
      'Payment Approvals',
    ],
    tabs: [
      { id: 'home', label: 'Finance', icon: 'cash-outline' },
      { id: 'documents', label: 'Documents', icon: 'document-text-outline' },
      { id: 'approvals', label: 'Approvals', icon: 'checkmark-circle-outline' },
      { id: 'profile', label: 'Profile', icon: 'person-circle-outline' },
    ],
  },
  coo: {
    label: 'COO',
    title: 'Delivery Control',
    description: 'Project delivery, schedules, permits, procurement, and risk management',
    primaryColor: '#7C3AED', // Purple for COO (per theme)
    features: [
      'Schedule Performance',
      'Permit Tracking',
      'Procurement Status',
      'Risk Register',
      'Change Orders',
      'S106/CIL Obligations',
    ],
    tabs: [
      { id: 'home', label: 'Delivery', icon: 'speedometer-outline' },
      { id: 'risks', label: 'Risks', icon: 'warning-outline' },
      { id: 'approvals', label: 'Approvals', icon: 'checkmark-circle-outline' },
      { id: 'profile', label: 'Profile', icon: 'person-circle-outline' },
    ],
  },
  'site-lead': {
    label: 'Site Lead',
    title: 'Site Execution',
    description: 'Daily operations, safety, progress tracking, and issue escalation',
    primaryColor: '#D2691E', // Terracotta for Site Lead (per theme)
    features: [
      'Daily Site Reports',
      'Safety Briefings',
      'Progress Tracking',
      'Blocker Escalation',
      'Delivery Logging',
      'Photo Documentation',
    ],
    tabs: [
      { id: 'home', label: 'Site', icon: 'construct-outline' },
      { id: 'reports', label: 'Reports', icon: 'clipboard-outline' },
      { id: 'issues', label: 'Issues', icon: 'alert-circle-outline' },
      { id: 'profile', label: 'Profile', icon: 'person-circle-outline' },
    ],
  },
  director: {
    label: 'Director',
    title: 'Executive View',
    description: 'Full platform access with portfolio oversight and strategic controls',
    primaryColor: '#F97316', // Hermes Orange for Director (per theme)
    features: [
      'Portfolio Dashboard',
      'All Role Views',
      'ROI Metrics',
      'Risk Overview',
      'Approval Authority',
      'Team Management',
    ],
    tabs: [
      { id: 'home', label: 'Overview', icon: 'grid-outline' },
      { id: 'metrics', label: 'Metrics', icon: 'trending-up-outline' },
      { id: 'approvals', label: 'Approvals', icon: 'checkmark-circle-outline' },
      { id: 'profile', label: 'Profile', icon: 'person-circle-outline' },
    ],
  },
  contractor: {
    label: 'Contractor',
    title: 'Job Management',
    description: 'Manage jobs, quotes, invoices, and customers for your trade business',
    primaryColor: '#F97316', // Hermes Orange for Contractor (per theme)
    features: [
      'Job Scheduling',
      'Quote Builder',
      'Invoicing',
      'Time Tracking',
      'Customer CRM',
      'Expense Tracking',
    ],
    tabs: [
      { id: 'home', label: 'Dashboard', icon: 'home-outline' },
      { id: 'jobs', label: 'Jobs', icon: 'briefcase-outline' },
      { id: 'schedule', label: 'Schedule', icon: 'calendar-outline' },
      { id: 'profile', label: 'Profile', icon: 'person-circle-outline' },
    ],
  },
  worker: {
    label: 'Worker',
    title: 'My Work',
    description: 'View schedule, clock in/out, and submit timesheets',
    primaryColor: '#F97316', // Hermes Orange for Worker (per theme)
    features: [
      'My Schedule',
      'Clock In/Out',
      'Timesheets',
      'Job Details',
    ],
    tabs: [
      { id: 'schedule', label: 'Schedule', icon: 'calendar-outline' },
      { id: 'timesheets', label: 'Hours', icon: 'timer-outline' },
    ],
  },
};

// ============================================
// AUTH CONTEXT
// ============================================

export type LoginFailureReason =
  | 'invalid'          // wrong email/password
  | 'locked'           // too many failed attempts
  | 'network'          // Supabase unreachable / offline
  | 'demo_disabled'    // demo account used but DEMO_MODE=false in prod
  | 'unknown';         // fallback — generic error

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: LoginFailureReason };

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // R66 round 42: cold-start session-restore is async. Pre-R42 the route
  // guard ran with `isAuthenticated: false` during the ~50-200ms window
  // before `getSession()` resolved → flashed `/login` → resolved → flashed
  // back to `/(contractor)`. Visible flicker on every cold start with a
  // persistent session. Guard now waits while `isAuthHydrating === true`.
  isAuthHydrating: boolean;
  isDemoMode: boolean;
  session: Session | null;
  /**
   * Returns `ok: true` on success. On failure, `reason` indicates WHY so
   * the login UI can surface an actionable message (network outage vs
   * wrong password vs lockout vs demo-disabled in prod).
   * Legacy boolean `!success.ok` remains equivalent to `false`.
   */
  login: (email: string, password: string) => Promise<LoginResult>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string; session?: boolean }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  roleConfig: RoleConfig | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // R66 round 42: starts true, flips false after the first getSession
  // resolves (or 5s timeout). In demo mode we skip the auth path entirely
  // so flip immediately. Route guard reads this to avoid the cold-start
  // login-flash bug.
  const [isAuthHydrating, setIsAuthHydrating] = useState(isSupabaseConfigured);

  // Listen for Supabase auth changes when configured
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // R66 round 42: hydration must always finish — even on network failure
    // or `getSession` hang. Without the timeout the loading screen sticks
    // forever and the user can't reach the login screen to retry.
    let hydrationDone = false;
    const finishHydration = () => {
      if (hydrationDone) return;
      hydrationDone = true;
      setIsAuthHydrating(false);
    };
    const hydrationTimer = setTimeout(finishHydration, 5000);

    // Check existing session on mount
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        // R314: don't restore demo-account sessions in prod builds — sign
        // out instead so the tester lands on the login screen.
        if (s?.user && isBlockedDemoSession(s.user.email)) {
          logWarn('Auth', `Demo session restore rejected — DEMO_MODE is disabled: ${s.user.email}`);
          void supabase.auth.signOut().catch(() => {});
          return;
        }
        setSession(s);
        if (s?.user) {
          // R108: mirror the onAuthStateChange handler — derive
          // onboardingComplete + country/trade/language from
          // user_metadata so cold-start users get the same correct
          // redirect target as warm-start ones.
          // R109: also read is_aannemer so the (contractor) view can
          // show the Projects tab + multi-trade quote builder for
          // renovation GCs.
          const md = s.user.user_metadata ?? {};
          setUser({
            id: s.user.id,
            email: s.user.email ?? '',
            name: md.name ?? s.user.email ?? '',
            role: (md.role as UserRole) ?? 'contractor',
            company: md.company ?? '',
            projects: [],
            onboardingComplete: md.onboarding_complete === true,
            country: md.country as Country | undefined,
            trade: md.trade as string | undefined,
            language: md.language as Language | undefined,
            isAannemer: md.is_aannemer === true,
          });
        }
      })
      .catch((err) => {
        // Network outage / invalid stored session / Supabase unreachable —
        // fall through to the unauthenticated branch rather than freezing.
        if (__DEV__) console.warn('AuthContext: getSession failed:', err);
      })
      .finally(() => {
        clearTimeout(hydrationTimer);
        finishHydration();
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // R102: log every auth event as a Sentry breadcrumb so we can trace
      // unexpected sign-outs (TF reports of "tap a tab → logged out"). The
      // breadcrumb captures the event name and whether a session/user is
      // present, which lets us tell SIGNED_OUT from spurious non-session
      // events.
      addBreadcrumb({
        category: 'auth',
        message: `auth-event: ${event}`,
        data: { hasSession: !!s, hasUser: !!s?.user },
      });
      // R104: also persist the last 20 events to AsyncStorage. Sentry DSN
      // isn't configured yet so breadcrumbs don't reach telemetry — the
      // login screen exposes a tap-the-logo-5x gesture that reads this
      // log and shows the recent event sequence in an Alert, giving us
      // visibility into mid-session sign-outs on TestFlight.
      void AsyncStorage.getItem('@vasco_auth_event_log').then((raw) => {
        let log: Array<{ t: number; event: string; hasSession: boolean; hasUser: boolean }> = [];
        try { log = raw ? JSON.parse(raw) : []; } catch { log = []; }
        log.push({ t: Date.now(), event, hasSession: !!s, hasUser: !!s?.user });
        if (log.length > 20) log = log.slice(-20);
        return AsyncStorage.setItem('@vasco_auth_event_log', JSON.stringify(log));
      }).catch(() => {});
      // R314: mirror the getSession guard — a demo-account session must not
      // be (re)established in a prod build via INITIAL_SESSION/TOKEN_REFRESHED.
      // signOut() emits SIGNED_OUT which re-enters this handler and clears
      // user/session through the normal branch below.
      if (s?.user && isBlockedDemoSession(s.user.email)) {
        logWarn('Auth', `Demo session event rejected — DEMO_MODE is disabled: ${s.user.email}`);
        void supabase.auth.signOut().catch(() => {});
        return;
      }
      setSession(s);
      if (s?.user) {
        // R102: preserve fields that come from local context (onboardingComplete,
        // country, language, trade, isAannemer). The supabase event payload
        // only carries user_metadata, so rebuilding from scratch on every
        // TOKEN_REFRESHED stripped those locally-merged fields and made
        // user.onboardingComplete flip to undefined mid-session. Merge over
        // the prior user object instead, but only when the user id matches —
        // a different id means a different user, in which case we must
        // rebuild cleanly.
        //
        // R108: derive onboardingComplete + country/trade/language from
        // user_metadata (server source of truth) with sensible defaults
        // for fresh signups. Before R108 these fields were undefined for
        // new accounts, so the redirect check `=== false` failed silently
        // and contractors landed on Vandaag without ever picking
        // country/language/trade — leaving the app in mixed-locale state.
        const md = s.user.user_metadata ?? {};
        const metaOnboardingComplete = md.onboarding_complete === true;
        const metaCountry = md.country as Country | undefined;
        const metaTrade = md.trade as string | undefined;
        const metaLanguage = md.language as Language | undefined;
        // R109: is_aannemer (renovation GC) determines whether the
        // contractor sees the Projects tab + multi-trade quote builder.
        const metaIsAannemer = md.is_aannemer === true;

        setUser((prev) => {
          const sameUser = prev?.id === s.user.id;
          const base: User = sameUser && prev ? prev : {
            id: s.user.id,
            email: '',
            name: '',
            role: 'contractor',
            company: '',
            projects: [],
            // R108: default to NOT onboarded for fresh sessions; the
            // metadata read below overrides to true if the user has
            // actually finished onboarding on any device.
            onboardingComplete: false,
          };
          return {
            ...base,
            id: s.user.id,
            email: s.user.email ?? base.email,
            name: md.name ?? base.name ?? s.user.email ?? '',
            role: (md.role as UserRole) ?? base.role ?? 'contractor',
            company: md.company ?? base.company ?? '',
            // metadata wins when present, otherwise keep the previously
            // merged values from local AsyncStorage.
            onboardingComplete: metaOnboardingComplete || base.onboardingComplete === true,
            country: metaCountry ?? base.country,
            trade: metaTrade ?? base.trade,
            language: metaLanguage ?? base.language,
            isAannemer: metaIsAannemer || base.isAannemer === true,
          };
        });
        // R230: if the user had a pending referral code stashed before
        // email confirmation, apply it now on first SIGNED_IN event.
        if (event === 'SIGNED_IN') {
          import('../services/referralAttributionService')
            .then((mod) => mod.applyPendingReferral(s.user.id))
            .catch(() => {});
        }
      } else if (event === 'SIGNED_OUT') {
        // R102: ONLY clear user on the explicit SIGNED_OUT event. Other
        // events with a null session (notably INITIAL_SESSION at startup
        // when no session is persisted, or any spurious payload) should
        // not tear down an already-authenticated user. Pre-R102 this
        // branch fired for any event with !s?.user, which appeared to
        // be the cause of TF "tap a tab → logged out" reports.
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync the module-level currentUser ref so non-hook consumers (schedulers,
  // dataCollector, reasonCodeService) attribute events to the real user id.
  // R280: also start/stop the event-flush + cloud-sync background loops here.
  // Was previously only wired in demo-login path — real Supabase auth (incl.
  // email/password, OAuth, magic-link, session-restore on cold start) never
  // started the loops, so business_events sat in AsyncStorage indefinitely.
  useEffect(() => {
    if (user?.id) {
      const country = user.country ?? 'NL';
      const trade = (user as any).trade as string | undefined;
      const role = user.role === 'site-lead' ? 'sitelead' : (user.role ?? 'contractor');
      setCurrentUser({ id: user.id, country, trade });
      startEventFlushing(user.id);
      startAutoSync(user.id, role, trade, country);
    } else {
      setCurrentUser(null);
      stopEventFlushing();
      stopAutoSync();
    }
  }, [user?.id, user?.country, (user as any)?.trade, user?.role]);

  // Load intelligence learning profile when user role is known
  useEffect(() => {
    if (user?.role) {
      import('../intelligence/learningStorage').then(({ setActiveRole, loadProfile }) => {
        const intelligenceRole = user.role === 'site-lead' ? 'sitelead' : user.role;
        setActiveRole(intelligenceRole);
        loadProfile().catch(() => {});
      }).catch(() => {});
    }
  }, [user?.role]);

  // Restore persisted user profile (country, trade, language) on login
  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem('@vasco_user_profile').then((raw) => {
      if (!raw) return;
      try {
        const profile = JSON.parse(raw);
        if (profile && typeof profile === 'object') {
          setUser((prev) => prev ? { ...prev, ...profile } : null);
          // R66 round 4: honor the saved language preference on cold-start.
          // i18n.ts only reads device locale at boot — without this, a
          // contractor whose phone is set to a different language than the
          // one they picked in onboarding sees the wrong language.
          const savedLang = (profile as { language?: string }).language;
          if (savedLang && typeof savedLang === 'string') {
            import('../i18n/i18n').then(({ default: i18n }) => {
              if (i18n.language !== savedLang) {
                i18n.changeLanguage(savedLang).catch(() => {});
              }
            }).catch(() => {});
          }
        }
      } catch {}
    }).catch(() => {});
    // Only run once when user first becomes non-null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!user]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);

    const normalizedEmail = email.toLowerCase().trim();

    // --- Account lockout check ---
    const locked = await isLockedOut(normalizedEmail);
    if (locked) {
      logWarn('Auth', `Login blocked — account locked out: ${normalizedEmail}`);
      setIsLoading(false);
      return { ok: false, reason: 'locked' };
    }

    // --- Check for demo account ---
    const mockUser = MOCK_USERS[normalizedEmail];

    if (mockUser) {
      // Only allow demo accounts when DEMO_MODE is enabled
      if (!DEMO_MODE) {
        logWarn('Auth', `Demo login rejected — DEMO_MODE is disabled: ${normalizedEmail}`);
        await checkAndRecordFailedAttempt(normalizedEmail);
        setIsLoading(false);
        return { ok: false, reason: 'demo_disabled' };
      }

      // If Supabase is configured, try real auth first
      if (isSupabaseConfigured) {
        // 15s deadline — if the network hangs, fall through to the offline
        // demo-password check rather than stalling the demo login forever.
        let error: unknown = null;
        let authData: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'] | null = null;
        try {
          const res = await withTimeout(
            supabase.auth.signInWithPassword({ email, password }),
            15000,
            'signInWithPassword(demo)',
          );
          error = res.error;
          authData = res.data;
        } catch {
          error = new Error('timeout'); // fall through to demo-password check below
        }
        if (!error) {
          await clearLockout(normalizedEmail);
          setIsLoading(false);
          if (authData?.user) {
            const supaRole = (authData.user.user_metadata?.role === 'site-lead' ? 'sitelead' : 'contractor') as 'contractor' | 'aannemer' | 'sitelead';
            initSession({ userId: authData.user.id, role: supaRole, country: (authData.user.user_metadata?.country as string) ?? 'NL' }).catch(() => {});
            setUserContext({ userId: authData.user.id, role: supaRole, country: (authData.user.user_metadata?.country as string) ?? 'NL' });
            trackEvent('login').catch(() => {});
          }
          return { ok: true };
        }
        // Supabase auth failed — fall through to demo password check
      }

      // In dev/demo mode, accept any non-empty password for demo accounts
      // In production (DEMO_MODE=false), demo accounts are blocked entirely above
      if (!password || password.trim().length === 0) {
        setIsLoading(false);
        return { ok: false, reason: 'invalid' };
      }

      // Simulate delay for non-Supabase mode
      if (!isSupabaseConfigured) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      await clearLockout(normalizedEmail);
      setUser(mockUser);
      setIsLoading(false);
      // R280: startAutoSync / startEventFlushing are now triggered uniformly
      // by the user-change effect above so demo, real Supabase, OAuth, and
      // session-restore paths all behave identically.
      // Analytics tracking
      const analyticsRole = mockUser.role === 'site-lead' ? 'sitelead' as const : (mockUser.role === 'contractor' ? 'contractor' as const : 'contractor' as const);
      initSession({ userId: mockUser.id, role: analyticsRole, country: mockUser.country ?? 'NL' }).catch(() => {});
      setUserContext({ userId: mockUser.id, role: analyticsRole, country: mockUser.country ?? 'NL' });
      trackEvent('login').catch(() => {});
      return { ok: true };
    }

    // --- Real Supabase auth for non-demo accounts ---
    if (isSupabaseConfigured) {
      // Hard 15s deadline: on flaky signal signInWithPassword can hang forever,
      // which would leave isLoading=true and the login button spinning with no
      // way out. On timeout we surface it as a network failure.
      let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error'] = null;
      let realAuthData: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'] | null = null;
      try {
        const res = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          15000,
          'signInWithPassword',
        );
        error = res.error;
        realAuthData = res.data;
      } catch {
        setIsLoading(false);
        await checkAndRecordFailedAttempt(normalizedEmail);
        return { ok: false, reason: 'network' };
      }
      setIsLoading(false);
      if (!error && realAuthData?.user) {
        await clearLockout(normalizedEmail);
        const realRole = (realAuthData.user.user_metadata?.role === 'site-lead' ? 'sitelead' : 'contractor') as 'contractor' | 'aannemer' | 'sitelead';
        initSession({ userId: realAuthData.user.id, role: realRole, country: (realAuthData.user.user_metadata?.country as string) ?? 'NL' }).catch(() => {});
        setUserContext({ userId: realAuthData.user.id, role: realRole, country: (realAuthData.user.user_metadata?.country as string) ?? 'NL' });
        trackEvent('login').catch(() => {});
        return { ok: true };
      }
      if (error) {
        await checkAndRecordFailedAttempt(normalizedEmail);
        // Distinguish network failures from credential failures. Supabase
        // surfaces fetch failures as AuthRetryableFetchError or with a
        // message matching /fetch|network|timeout/i.
        const msg = (error.message || '').toLowerCase();
        const isNetwork = /fetch|network|timeout|enotfound|econnreset|failed to fetch/.test(msg);
        return { ok: false, reason: isNetwork ? 'network' : 'invalid' };
      }
      return { ok: false, reason: 'unknown' };
    }

    await checkAndRecordFailedAttempt(normalizedEmail);
    setIsLoading(false);
    return { ok: false, reason: 'network' };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured – running in demo mode' };
    }
    setIsLoading(true);
    // R189: use the https universal-link landing instead of the raw
    // `vasco://` scheme. Gmail/Outlook web clients refuse to open non-http(s)
    // URLs from emails for security — pointing emails at vasco:// produced
    // a "page not found" 404 in every browser. The new flow:
    //
    //   1. Supabase email contains https://admin.vascobuild.com/auth/callback#...
    //   2. User taps in email → on iOS/Android with the app installed +
    //      AASA/assetlinks verified, the OS opens the app directly at
    //      app/auth/callback.tsx (hash forwarded intact via expo-linking).
    //   3. If app not installed OR on desktop, the admin Next.js page at
    //      admin/src/app/auth/callback/page.tsx renders a polished "Email
    //      confirmed → Open Vasco" landing with App Store / Play Store
    //      fallback buttons.
    //
    // REQUIRED Supabase Dashboard config: Authentication → URL Configuration:
    //   - Site URL: https://admin.vascobuild.com/auth/callback
    //   - Redirect URLs (allowlist): add
    //       https://admin.vascobuild.com/auth/callback
    //       https://admin.vascobuild.com/auth/callback**
    //       vasco://auth/callback  (legacy fallback, can be removed post-launch)
    //
    // The /auth/callback* path is also added to apple-app-site-association
    // and assetlinks.json so iOS/Android auto-open the app.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: 'https://admin.vascobuild.com/auth/callback' },
    });
    setIsLoading(false);
    if (error) return { success: false, error: error.message };
    // Activation funnel — top of funnel. `confirmed` = signed in immediately
    // (email-confirmation OFF) vs pending email verification.
    trackEvent('signup', { confirmed: !!data.session }).catch(() => {});
    // `session` is non-null only when email confirmation is DISABLED in the
    // Supabase project (Auth → Providers → Email → "Confirm email" = OFF).
    // In that case the user is already logged in and signup.tsx routes straight
    // to onboarding instead of the "check your email" dead-end. When confirmation
    // is required, session is null and we fall back to the pending screen.
    return { success: true, session: !!data.session };
  }, []);

  const logout = useCallback(async () => {
    // R104: record the explicit-logout entry into the event log so we can
    // distinguish "user tapped Logout" from "supabase emitted SIGNED_OUT
    // for unknown reasons" when reading the diagnostic.
    void AsyncStorage.getItem('@vasco_auth_event_log').then((raw) => {
      let log: Array<{ t: number; event: string; hasSession: boolean; hasUser: boolean }> = [];
      try { log = raw ? JSON.parse(raw) : []; } catch { log = []; }
      log.push({ t: Date.now(), event: 'EXPLICIT_LOGOUT', hasSession: false, hasUser: false });
      if (log.length > 20) log = log.slice(-20);
      return AsyncStorage.setItem('@vasco_auth_event_log', JSON.stringify(log));
    }).catch(() => {});
    trackEvent('logout').catch(() => {});
    await flushEvents().catch(() => {});
    // Remove push token for this device before signing out (auth.uid() required)
    try {
      const mod = await import('../services/pushNotificationService');
      await mod.unregisterPushToken();
    } catch {}
    clearUserContext();
    stopAutoSync();
    stopEventFlushing();
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    // R46: wipe user-scoped AsyncStorage so the next contractor signing in
    // on the same device doesn't inherit previous user's queued writes /
    // AI queue / expenses / permits / inbox / clock-in state / etc.
    // Multi-tenancy hazard on shared devices + demo accounts. Preserves
    // device-level keys (device_id, seed_version, consents).
    try {
      const { clearUserScopedStorage } = await import('../services/sessionCleanup');
      await clearUserScopedStorage();
    } catch {}
    setUser(null);
    setSession(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const merged = { ...prev, ...updates };
      // Persist user profile updates to AsyncStorage
      AsyncStorage.setItem('@vasco_user_profile', JSON.stringify({
        trade: merged.trade,
        country: merged.country,
        language: merged.language,
        onboardingComplete: merged.onboardingComplete,
      })).catch(() => {});
      return merged;
    });
  }, []);

  const roleConfig = user ? ROLE_CONFIGS[user.role] : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAuthHydrating,
        isDemoMode,
        session,
        login,
        signUp,
        logout,
        updateUser,
        roleConfig,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================
// ROLE HELPERS
// ============================================

export function getRoleLabel(role: UserRole): string {
  return ROLE_CONFIGS[role].label;
}

export function canAccessFeature(role: UserRole, feature: string): boolean {
  // Directors can access everything
  if (role === 'director') return true;

  // Check if feature is in role's feature list
  return ROLE_CONFIGS[role].features.some(
    (f) => f.toLowerCase().includes(feature.toLowerCase())
  );
}

export function canApproveAction(role: UserRole, actionType: string, amount?: number): boolean {
  switch (role) {
    case 'director':
      return true; // Can approve anything
    case 'cfo':
      return ['payment', 'financial', 'draw', 'invoice', 'retention', 's106'].some((t) => actionType.includes(t));
    case 'coo':
      return ['change-order', 'permit', 'schedule', 'risk', 'instruction', 'procurement'].some((t) => actionType.includes(t));
    case 'site-lead':
      return ['daily-report', 'safety', 'blocker', 'issue'].some((t) => actionType.includes(t));
    case 'contractor':
      return ['invoice', 'quote', 'job'].some((t) => actionType.includes(t));
    case 'worker':
      return ['clock', 'timesheet'].some((t) => actionType.includes(t));
    default:
      return false;
  }
}

// ============================================
// P0: FINAL CONFIRMATION REQUIREMENTS
// ============================================

/**
 * Checks if a user can provide final confirmation for an action
 * Final confirmation is required for high-stakes actions (P0 - a16z E9 Liability)
 */
export function canProvideFinalConfirmation(role: UserRole, actionType: string, amount?: number): boolean {
  // Actions requiring final confirmation
  const finalConfirmationActions = [
    'approve-payment',
    'release-retention',
    'terminate-contract',
    'draw-request',
    'certify-completion',
    'submit-permit',
    's106-payment',
    'approve-change-order',
  ];

  if (!finalConfirmationActions.some(a => actionType.includes(a))) {
    return false; // Action doesn't require final confirmation
  }

  // Role-based final confirmation authority
  switch (role) {
    case 'director':
      return true; // Directors can provide final confirmation for all actions

    case 'cfo':
      // CFO can confirm financial actions
      return ['payment', 'retention', 'draw', 's106'].some(t => actionType.includes(t));

    case 'coo':
      // COO can confirm operational actions
      return ['change-order', 'permit', 'completion', 'instruction'].some(t => actionType.includes(t));

    default:
      return false;
  }
}

/**
 * Gets the confirmation threshold for a role
 * Actions above this amount require additional confirmation steps
 */
export function getConfirmationThreshold(role: UserRole): { amount: number; currency: 'GBP' | 'EUR' } {
  switch (role) {
    case 'director':
      return { amount: 100000, currency: 'GBP' };
    case 'cfo':
      return { amount: 50000, currency: 'GBP' };
    case 'coo':
      return { amount: 25000, currency: 'GBP' };
    case 'site-lead':
      return { amount: 5000, currency: 'GBP' };
    case 'contractor':
      return { amount: 10000, currency: 'EUR' };
    default:
      return { amount: 0, currency: 'GBP' };
  }
}

/**
 * Checks if an action requires escalation to a higher authority
 */
export function requiresEscalation(role: UserRole, actionType: string, amount?: number): boolean {
  if (!amount) return false;

  const threshold = getConfirmationThreshold(role);

  // If amount exceeds threshold, escalation is required
  if (amount >= threshold.amount) {
    // Site leads escalate to COO/CFO
    if (role === 'site-lead') return true;
    // COO/CFO escalate to Director for very high amounts
    if ((role === 'coo' || role === 'cfo') && amount >= 100000) return true;
  }

  return false;
}
