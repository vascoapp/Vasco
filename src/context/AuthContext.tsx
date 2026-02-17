import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// ============================================
// ROLE TYPES
// ============================================

export type UserRole = 'cfo' | 'coo' | 'site-lead' | 'director' | 'contractor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company: string;
  projects: string[]; // Project IDs user has access to
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
};

// ============================================
// AUTH CONTEXT
// ============================================

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  session: Session | null;
  login: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
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

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    // --- Check for demo account first (works in all modes) ---
    const normalizedEmail = email.toLowerCase().trim();
    const mockUser = MOCK_USERS[normalizedEmail];

    if (mockUser) {
      // If Supabase is configured, try real auth first
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          setIsLoading(false);
          return true;
        }
        // Supabase auth failed — fall back to demo user
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      setUser(mockUser);
      setIsLoading(false);
      return true;
    }

    // --- Real Supabase auth for non-demo accounts ---
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);
      return !error;
    }

    setIsLoading(false);
    return false;
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
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
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
