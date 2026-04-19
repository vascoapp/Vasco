// =============================================================================
// DRAFTKINGS-INSPIRED THEME (pilot — Sunset Slate)
// =============================================================================
// Parallel token set, not a replacement. Used by pilot screens only
// (currently app/(contractor)/vandaag-dk.tsx). The locked production design
// system in tabStyles.ts remains unchanged until this pilot is approved.
// Locked by user on 2026-04-18 from the Admin Design Lab pilot.
// =============================================================================

export const DK = {
  colors: {
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
    success: '#10B981',
    danger: '#EF4444',
  },
  // Soft radius — user's choice from the lab
  radius: {
    button: 10,
    card: 14,
    chip: 999,
  },
  // Archivo (display) + Inter (body). Weights registered in app/_layout.tsx.
  type: {
    display900: 'Archivo_900Black',
    display800: 'Archivo_800ExtraBold',
    display700: 'Archivo_700Bold',
    display600: 'Archivo_600SemiBold',
    body700: 'Inter_700Bold',
    body600: 'Inter_600SemiBold',
    body500: 'Inter_500Medium',
    body400: 'Inter_400Regular',
  },
  // Gradient + Glow — DraftKings-style CTA treatment
  effects: {
    ctaGradient: ['#9A3412', '#C2410C', '#F97316'] as const,
    ctaShadow: {
      shadowColor: '#F97316',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 18,
      elevation: 10,
    },
    heroGlow: {
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 36,
      elevation: 6,
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 },
} as const;

export type DKTheme = typeof DK;
