// =============================================================================
// VIDEO THEME — Mirrors VascoApp DraftKings Sunset Slate design system
// Tokens mirror src/theme/draftkings.ts + src/theme/tabStyles.ts so video
// + App Store screenshot output stays brand-coherent with the live app.
// =============================================================================

export const DK = {
  bg: '#0B0E11',
  panel: '#14181F',
  panel2: '#1C2128',
  border: '#2A3038',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  primaryDark: '#9A3412',
  primary: '#C2410C',
  accent: '#F97316',
  highlight: '#F59E0B',
  success: '#22C55E',
  error: '#EF4444',
};

// Legacy Wolt-era export kept for old compositions that still reference it.
// New code should import DK directly.
export const Colors = {
  hermesOrange: DK.accent,
  white: '#FFFFFF',
  black: DK.bg,
  background: DK.bg,
  surfacePrimary: DK.panel,
  textPrimary: DK.text,
  textSecondary: DK.textMuted,
  textTertiary: '#6B7280',
  success: DK.success,
  error: DK.error,
  warning: DK.highlight,
  info: '#3B82F6',
  pastelOrange: '#FDE8D8',
};

export const Fonts = {
  display: 'Archivo, Inter, sans-serif',
  section: 'Archivo, Inter, sans-serif',
  body: 'Inter, sans-serif',
};

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: {
    short: 300,   // 10 seconds
    medium: 480,  // 16 seconds
    standard: 630, // 21 seconds
    long: 900,    // 30 seconds
  },
};

// App Store screenshot specs — 6.9" iPhone is the primary, Apple
// auto-fills smaller variants from the largest provided size.
export const APP_STORE = {
  width: 1320,
  height: 2868,
  fps: 30,
  durationFrames: 1, // single still frame
};
