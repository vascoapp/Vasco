import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { startAutoSync, stopAutoSync } from '../intelligence/cloudSync';
import { trackEvent, initSession, setUserContext, clearUserContext, flushEvents } from '../services/eventTrackingService';
import { DEMO_MODE } from '../config/demo';
import { logWarn } from '../utils/errorHandler';
import { setCurrentUser } from '../lib/currentUser';
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

export type Country = 'UK' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT';
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
};

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
    primaryColor: '#E35205', // Hermes Orange for Director (per theme)
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
    primaryColor: '#E35205', // Hermes Orange for Contractor (per theme)
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
    primaryColor: '#E35205', // Hermes Orange for Worker (per theme)
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
  isDemoMode: boolean;
  session: Session | null;
  /**
   * Returns `ok: true` on success. On failure, `reason` indicates WHY so
   * the login UI can surface an actionable message (network outage vs
   * wrong password vs lockout vs demo-disabled in prod).
   * Legacy boolean `!success.ok` remains equivalent to `false`.
   */
  login: (email: string, password: string) => Promise<LoginResult>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  roleConfig: RoleConfig | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Listen for Supabase auth changes when configured
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        setUser({
          id: s.user.id,
          email: s.user.email ?? '',
          name: s.user.user_metadata?.name ?? s.user.email ?? '',
          role: (s.user.user_metadata?.role as UserRole) ?? 'contractor',
          company: s.user.user_metadata?.company ?? '',
          projects: [],
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setUser({
          id: s.user.id,
          email: s.user.email ?? '',
          name: s.user.user_metadata?.name ?? s.user.email ?? '',
          role: (s.user.user_metadata?.role as UserRole) ?? 'contractor',
          company: s.user.user_metadata?.company ?? '',
          projects: [],
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync the module-level currentUser ref so non-hook consumers (schedulers,
  // dataCollector, reasonCodeService) attribute events to the real user id.
  useEffect(() => {
    if (user?.id) {
      setCurrentUser({ id: user.id, country: user.country, trade: (user as any).trade });
    } else {
      setCurrentUser(null);
    }
  }, [user?.id, user?.country, (user as any)?.trade]);

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
        const { error, data: authData } = await supabase.auth.signInWithPassword({ email, password });
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
      // Start AI cloud sync
      startAutoSync(normalizedEmail, mockUser.role ?? 'contractor', mockUser.trade, mockUser.country);
      // Analytics tracking
      const analyticsRole = mockUser.role === 'site-lead' ? 'sitelead' as const : (mockUser.role === 'contractor' ? 'contractor' as const : 'contractor' as const);
      initSession({ userId: mockUser.id, role: analyticsRole, country: mockUser.country ?? 'NL' }).catch(() => {});
      setUserContext({ userId: mockUser.id, role: analyticsRole, country: mockUser.country ?? 'NL' });
      trackEvent('login').catch(() => {});
      return { ok: true };
    }

    // --- Real Supabase auth for non-demo accounts ---
    if (isSupabaseConfigured) {
      const { error, data: realAuthData } = await supabase.auth.signInWithPassword({ email, password });
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
    const { error } = await supabase.auth.signUp({ email, password });
    setIsLoading(false);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    trackEvent('logout').catch(() => {});
    await flushEvents().catch(() => {});
    // Remove push token for this device before signing out (auth.uid() required)
    try {
      const mod = await import('../services/pushNotificationService');
      await mod.unregisterPushToken();
    } catch {}
    clearUserContext();
    stopAutoSync();
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
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
