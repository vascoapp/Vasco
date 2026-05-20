/**
 * Demo Mode Configuration
 * Centralizes all demo-related flags so they can be toggled in one place.
 *
 * - In __DEV__ (Expo dev server) demo mode is always on.
 * - In production builds, set EXPO_PUBLIC_DEMO_MODE=true to enable.
 * - When DEMO_MODE is false, seed data is disabled and demo accounts are hidden.
 */

import type { UserRole } from '../context/AuthContext';

// ── Feature flag ────────────────────────────────────────────
export const DEMO_MODE: boolean =
  __DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

// ── Demo accounts (only exposed when DEMO_MODE is true) ─────
export interface DemoAccount {
  email: string;
  role: UserRole;
  name: string;
  icon: string; // Ionicons glyph name
  isAannemer?: boolean;
}

export const DEMO_ACCOUNTS: DemoAccount[] = DEMO_MODE
  ? [
      { email: 'contractor@vasco.dev', role: 'contractor', name: 'Jan van der Berg', icon: 'hammer-outline' },
      { email: 'aannemer@vasco.dev', role: 'contractor', name: 'Pieter van Dijk', icon: 'business-outline', isAannemer: true },
      { email: 'site@vasco.dev', role: 'site-lead', name: 'Mike Thompson', icon: 'construct-outline' },
      { email: 'cfo@vasco.dev', role: 'cfo', name: 'Sarah Chen', icon: 'cash-outline' },
      { email: 'coo@vasco.dev', role: 'coo', name: 'James Morrison', icon: 'speedometer-outline' },
      { email: 'director@vasco.dev', role: 'director', name: 'Alexandra Wright', icon: 'grid-outline' },
      { email: 'new@vasco.dev', role: 'contractor', name: 'New User (Onboarding)', icon: 'person-add-outline' },
      // R75 US foundation: US demo contractor (Texas HVAC). Use to QA the
      // en-US locale + US invoice PDF + state picker flow.
      { email: 'contractor@vasco.us.dev', role: 'contractor', name: 'Mike Reynolds (US)', icon: 'flag-outline' },
    ]
  : [];

// ── Seed data flag ──────────────────────────────────────────
export const USE_SEED_DATA: boolean = DEMO_MODE;
