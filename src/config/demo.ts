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

/**
 * Store-screenshot capture: demo DATA on, demo BANNER off.
 *
 * The banner exists so a real person cannot mistake fixtures for their own
 * books. A screenshot has no such person — but it does end up on the App Store
 * product page, where an orange "Demo Mode" strip across every image reads as
 * an unfinished app.
 *
 * Deliberately a SEPARATE flag rather than widening DEMO_MODE: nothing that
 * hides the warning may also be able to turn the fixtures on. This is set only
 * by scripts/capture-screenshots.sh and is absent from every build profile.
 */
export const SCREENSHOT_MODE: boolean =
  process.env.EXPO_PUBLIC_SCREENSHOT_MODE === 'true';

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
      // German SHK contractor. Germany is the beachhead (the product is priced
      // German and the wedge is the DE e-invoice receive obligation), but it
      // had no demo account, so the market the business case rests on could not
      // be opened or screenshotted. Use to QA de copy, EUR/de-DE formatting,
      // XRechnung/ZUGFeRD and the DE-only GoBD surfaces.
      { email: 'handwerker@vasco.de.dev', role: 'contractor', name: 'Thomas Bergmann (DE)', icon: 'flag-outline' },
      // FR/ES/IT. These three accounts have existed in `DEMO_USERS` and in the
      // `npm run walk` postures for a long time, but they were never in THIS
      // list — and this list is what the login chips render AND what the
      // `vasco:///login?demo=` deep link checks before it will sign anyone in.
      // The consequence was that France, Spain and Italy could not be opened on
      // a device by any route: no chip, no deep link. Every statement about
      // those markets rested on the headless walk, which cannot see layout,
      // never presses a button, and runs on Node's full ICU — the exact blind
      // spot that hid `formatToParts` twice. It is also why the reduced-VAT
      // control being gated off for FR/IT went unnoticed: the suites are green
      // because they assert what renders, and the control did not render.
      { email: 'plombier@vasco.fr.dev', role: 'contractor', name: 'Julien Moreau (FR)', icon: 'flag-outline' },
      { email: 'fontanero@vasco.es.dev', role: 'contractor', name: 'Carlos Serrano (ES)', icon: 'flag-outline' },
      { email: 'idraulico@vasco.it.dev', role: 'contractor', name: 'Marco Ferrari (IT)', icon: 'flag-outline' },
    ]
  : [];

// ── Seed data flag ──────────────────────────────────────────
export const USE_SEED_DATA: boolean = DEMO_MODE;
