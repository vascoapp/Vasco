import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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
    primaryColor: '#10B981', // Green for money
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
    primaryColor: '#3B82F6', // Blue for operations
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
    primaryColor: '#F59E0B', // Orange for construction
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
    primaryColor: '#8B5CF6', // Purple for executive
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
    primaryColor: '#FF5A1F', // Vasco orange for contractors
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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  roleConfig: RoleConfig | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, _password: string): Promise<boolean> => {
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    const normalizedEmail = email.toLowerCase().trim();
    const mockUser = MOCK_USERS[normalizedEmail];

    if (mockUser) {
      setUser(mockUser);
      setIsLoading(false);
      return true;
    }

    setIsLoading(false);
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const roleConfig = user ? ROLE_CONFIGS[user.role] : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
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
      return ['payment', 'financial', 'draw', 'invoice'].some((t) => actionType.includes(t));
    case 'coo':
      return ['change-order', 'permit', 'schedule', 'risk'].some((t) => actionType.includes(t));
    case 'site-lead':
      return ['daily-report', 'safety', 'blocker'].some((t) => actionType.includes(t));
    default:
      return false;
  }
}
