// =============================================================================
// VASCO BUILDOS - SEMANTIC COLOR TOKEN SYSTEM
// =============================================================================
// This file uses semantic role-based tokens for easy Dark/Light mode switching.
// Each token describes its PURPOSE, not its appearance.
// =============================================================================

// -----------------------------------------------------------------------------
// PRIMITIVE PALETTE (Base colors - not for direct use in components)
// -----------------------------------------------------------------------------
const Palette = {
  // Neutrals
  black: '#000000',
  white: '#FFFFFF',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#E5E5E5',
  gray300: '#D4D4D4',
  gray400: '#A3A3A3',
  gray500: '#737373',
  gray600: '#525252',
  gray700: '#404040',
  gray800: '#262626',
  gray850: '#202020',
  gray900: '#171717',
  gray950: '#151515',

  // Warm Neutrals (cream/sand tones)
  cream50: '#FFFBF7',
  cream100: '#FFF8F0',
  cream200: '#FFF0E5',
  cream300: '#FFE8D9',
  sand100: '#F5EDE6',
  sand200: '#EBE0D5',
  sand300: '#DDD0C3',

  // Charcoal (for accents/highlights only)
  charcoal: '#2D2926',
  charcoalLight: '#4A4543',
  charcoalMuted: '#6B6560',

  // Brand Orange
  orange50: '#FFF7ED',
  orange100: '#FFEDD5',
  orange200: '#FED7AA',
  orange300: '#FDBA74',
  orange400: '#FB923C',
  orange500: '#F97316',
  orange600: '#EA580C',
  orange700: '#C2410C',
  orange800: '#9A3412',
  orange900: '#7C2D12',

  // Vasco Brand - Hermes/Luxury Orange Palette
  hermesOrange: '#E35205',     // Primary - Hermes luxury orange
  terracotta: '#D2691E',       // Secondary - warm terracotta
  burntSienna: '#E07A5F',      // Accent - softer burnt sienna
  pastelOrange: '#F8B195',     // Light - pastel peach/orange
  peachCream: '#FFDAB9',       // Subtle - peachy cream

  // Legacy Vasco (keep for backward compat)
  vascoPrimary: '#E35205',     // Updated to Hermes
  vascoSecondary: '#E07A5F',   // Terracotta/Sienna
  vascoTertiary: '#F8B195',    // Pastel orange
  vascoSubtle: '#FFDAB9',      // Peach cream

  // Feedback
  red500: '#EF4444',
  red600: '#DC2626',
  green500: '#22C55E',
  green600: '#16A34A',
  yellow500: '#EAB308',
  yellow600: '#CA8A04',
  blue500: '#3B82F6',
  blue600: '#2563EB',
};

// -----------------------------------------------------------------------------
// DARK THEME TOKENS (Current default)
// -----------------------------------------------------------------------------
const DarkTheme = {
  // Surfaces
  surfaceBackground: Palette.gray950,       // App background
  surfacePrimary: Palette.gray850,          // Cards, panels
  surfaceSecondary: '#2A2A2A',              // Elevated elements
  surfaceTertiary: '#3A3A3A',               // Highest elevation
  surfaceOverlay: 'rgba(0, 0, 0, 0.6)',     // Modal overlays
  surfaceInverse: Palette.white,            // Inverted surfaces

  // Borders
  borderDefault: '#3A3A3A',
  borderMuted: '#2A2A2A',
  borderFocused: Palette.vascoPrimary,
  borderDisabled: '#252525',

  // Text
  textPrimary: Palette.white,               // Main content
  textSecondary: '#C8C8C8',                 // Supporting text
  textTertiary: '#8F8F8F',                  // Placeholder, hints
  textDisabled: '#5A5A5A',                  // Disabled state
  textInverse: Palette.gray900,             // On light backgrounds
  textLink: Palette.vascoPrimary,           // Interactive links

  // Icons
  iconPrimary: Palette.white,
  iconSecondary: '#C8C8C8',
  iconDisabled: '#5A5A5A',
  iconInverse: Palette.gray900,

  // Actions (Buttons, interactive elements)
  actionPrimary: Palette.vascoPrimary,      // Primary CTA
  actionPrimaryHover: '#FF6B33',
  actionPrimaryPressed: '#E54D12',
  actionPrimaryDisabled: '#4A3A35',

  actionSecondary: Palette.vascoSecondary,  // Secondary actions
  actionSecondaryHover: '#FF9B70',
  actionSecondaryPressed: '#FF7A4A',

  actionTertiary: Palette.vascoTertiary,    // Tertiary/ghost
  actionGhost: 'transparent',
  actionGhostHover: 'rgba(255, 90, 31, 0.1)',

  // Feedback States
  feedbackSuccess: Palette.green500,
  feedbackSuccessBg: 'rgba(34, 197, 94, 0.15)',
  feedbackSuccessBorder: 'rgba(34, 197, 94, 0.3)',

  feedbackWarning: Palette.yellow500,
  feedbackWarningBg: 'rgba(234, 179, 8, 0.15)',
  feedbackWarningBorder: 'rgba(234, 179, 8, 0.3)',

  feedbackError: Palette.red500,
  feedbackErrorBg: 'rgba(239, 68, 68, 0.15)',
  feedbackErrorBorder: 'rgba(239, 68, 68, 0.3)',

  feedbackInfo: Palette.blue500,
  feedbackInfoBg: 'rgba(59, 130, 246, 0.15)',
  feedbackInfoBorder: 'rgba(59, 130, 246, 0.3)',

  // Status indicators (for dashboards)
  statusOnTrack: Palette.green500,
  statusAtRisk: Palette.yellow500,
  statusCritical: Palette.red500,
  statusPending: Palette.blue500,
  statusComplete: Palette.green600,
  statusOverdue: Palette.red600,

  // Role-specific accents (for role badges/branding)
  roleCFO: '#2563EB',       // Blue for CFO
  roleCOO: '#7C3AED',       // Purple for COO
  roleSiteLead: '#D2691E',  // Terracotta for Site Lead
  roleDirector: '#E35205',  // Hermes Orange for Director
  roleContractor: '#E35205', // Hermes Orange for Contractor

  // Chart/Data visualization
  chartPrimary: Palette.vascoPrimary,
  chartSecondary: Palette.vascoSecondary,
  chartTertiary: Palette.vascoTertiary,
  chartNeutral: '#6B7280',
  chartPositive: Palette.green500,
  chartNegative: Palette.red500,
};

// -----------------------------------------------------------------------------
// LIGHT THEME TOKENS (For future dark mode toggle)
// -----------------------------------------------------------------------------
const LightTheme = {
  // Surfaces
  surfaceBackground: Palette.gray50,
  surfacePrimary: Palette.white,
  surfaceSecondary: Palette.gray100,
  surfaceTertiary: Palette.gray200,
  surfaceOverlay: 'rgba(0, 0, 0, 0.4)',
  surfaceInverse: Palette.gray900,

  // Borders
  borderDefault: Palette.gray300,
  borderMuted: Palette.gray200,
  borderFocused: Palette.vascoPrimary,
  borderDisabled: Palette.gray200,

  // Text
  textPrimary: Palette.gray900,
  textSecondary: Palette.gray600,
  textTertiary: Palette.gray500,
  textDisabled: Palette.gray400,
  textInverse: Palette.white,
  textLink: Palette.orange600,

  // Icons
  iconPrimary: Palette.gray900,
  iconSecondary: Palette.gray600,
  iconDisabled: Palette.gray400,
  iconInverse: Palette.white,

  // Actions
  actionPrimary: Palette.vascoPrimary,
  actionPrimaryHover: '#FF6B33',
  actionPrimaryPressed: '#E54D12',
  actionPrimaryDisabled: '#FFD4C4',

  actionSecondary: Palette.vascoSecondary,
  actionSecondaryHover: '#FF9B70',
  actionSecondaryPressed: '#FF7A4A',

  actionTertiary: Palette.vascoTertiary,
  actionGhost: 'transparent',
  actionGhostHover: 'rgba(255, 90, 31, 0.08)',

  // Feedback States
  feedbackSuccess: Palette.green600,
  feedbackSuccessBg: 'rgba(34, 197, 94, 0.1)',
  feedbackSuccessBorder: 'rgba(34, 197, 94, 0.2)',

  feedbackWarning: Palette.yellow600,
  feedbackWarningBg: 'rgba(234, 179, 8, 0.1)',
  feedbackWarningBorder: 'rgba(234, 179, 8, 0.2)',

  feedbackError: Palette.red600,
  feedbackErrorBg: 'rgba(239, 68, 68, 0.1)',
  feedbackErrorBorder: 'rgba(239, 68, 68, 0.2)',

  feedbackInfo: Palette.blue600,
  feedbackInfoBg: 'rgba(59, 130, 246, 0.1)',
  feedbackInfoBorder: 'rgba(59, 130, 246, 0.2)',

  // Status indicators
  statusOnTrack: Palette.green600,
  statusAtRisk: Palette.yellow600,
  statusCritical: Palette.red600,
  statusPending: Palette.blue600,
  statusComplete: Palette.green600,
  statusOverdue: Palette.red600,

  // Role-specific accents
  roleCFO: '#2563EB',
  roleCOO: '#7C3AED',
  roleSiteLead: '#D97706',
  roleDirector: Palette.orange600,

  // Chart/Data visualization
  chartPrimary: Palette.orange600,
  chartSecondary: Palette.orange400,
  chartTertiary: Palette.orange300,
  chartNeutral: Palette.gray500,
  chartPositive: Palette.green600,
  chartNegative: Palette.red600,
};

// -----------------------------------------------------------------------------
// WARM THEME (Hermes Orange + Cream - Current Default)
// -----------------------------------------------------------------------------
const WarmTheme = {
  // Surfaces - Warm cream/off-white backgrounds
  surfaceBackground: Palette.cream50,           // Warm off-white
  surfacePrimary: Palette.white,                // Pure white cards
  surfaceSecondary: Palette.cream100,           // Slightly warm
  surfaceTertiary: Palette.cream200,            // More warmth
  surfaceOverlay: 'rgba(45, 41, 38, 0.5)',      // Charcoal overlay
  surfaceInverse: Palette.charcoal,             // Dark inverse

  // Borders - Subtle warm tones
  borderDefault: Palette.sand200,
  borderMuted: Palette.cream300,
  borderFocused: Palette.hermesOrange,
  borderDisabled: Palette.cream200,

  // Text - Charcoal for readability
  textPrimary: Palette.charcoal,                // Main content
  textSecondary: Palette.charcoalMuted,         // Supporting
  textTertiary: '#8B8279',                      // Warm gray
  textDisabled: '#B8AFA6',                      // Muted warm
  textInverse: Palette.white,                   // On dark backgrounds
  textLink: Palette.hermesOrange,               // Links

  // Icons
  iconPrimary: Palette.charcoal,
  iconSecondary: Palette.charcoalMuted,
  iconDisabled: '#B8AFA6',
  iconInverse: Palette.white,

  // Actions - Hermes Orange primary
  actionPrimary: Palette.hermesOrange,
  actionPrimaryHover: '#F56617',
  actionPrimaryPressed: '#C44504',
  actionPrimaryDisabled: Palette.pastelOrange,

  actionSecondary: Palette.burntSienna,
  actionSecondaryHover: '#E8896E',
  actionSecondaryPressed: '#C96B50',

  actionTertiary: Palette.pastelOrange,
  actionGhost: 'transparent',
  actionGhostHover: 'rgba(227, 82, 5, 0.08)',

  // Feedback States
  feedbackSuccess: '#16A34A',
  feedbackSuccessBg: 'rgba(22, 163, 74, 0.1)',
  feedbackSuccessBorder: 'rgba(22, 163, 74, 0.2)',

  feedbackWarning: '#D97706',
  feedbackWarningBg: 'rgba(217, 119, 6, 0.1)',
  feedbackWarningBorder: 'rgba(217, 119, 6, 0.2)',

  feedbackError: '#DC2626',
  feedbackErrorBg: 'rgba(220, 38, 38, 0.1)',
  feedbackErrorBorder: 'rgba(220, 38, 38, 0.2)',

  feedbackInfo: '#2563EB',
  feedbackInfoBg: 'rgba(37, 99, 235, 0.1)',
  feedbackInfoBorder: 'rgba(37, 99, 235, 0.2)',

  // Status indicators
  statusOnTrack: '#16A34A',
  statusAtRisk: '#D97706',
  statusCritical: '#DC2626',
  statusPending: '#2563EB',
  statusComplete: '#16A34A',
  statusOverdue: '#DC2626',

  // Role-specific accents
  roleCFO: '#2563EB',
  roleCOO: '#7C3AED',
  roleSiteLead: Palette.terracotta,
  roleDirector: Palette.hermesOrange,
  roleContractor: Palette.hermesOrange,

  // Chart/Data visualization
  chartPrimary: Palette.hermesOrange,
  chartSecondary: Palette.burntSienna,
  chartTertiary: Palette.pastelOrange,
  chartNeutral: Palette.charcoalMuted,
  chartPositive: '#16A34A',
  chartNegative: '#DC2626',
};

// -----------------------------------------------------------------------------
// ACTIVE THEME EXPORT
// Using Warm Theme as default for Hermes orange aesthetic
// -----------------------------------------------------------------------------
export const SemanticColors = WarmTheme;
export const LightSemanticColors = LightTheme;
export const DarkSemanticColors = DarkTheme;
export { Palette };

// -----------------------------------------------------------------------------
// LEGACY COLORS EXPORT (For backward compatibility)
// Gradually migrate components to use SemanticColors instead
// -----------------------------------------------------------------------------
export const Colors = {
  // Legacy mappings -> Using WarmTheme
  background: WarmTheme.surfaceBackground,
  surface: WarmTheme.surfacePrimary,
  surfaceElevated: WarmTheme.surfaceSecondary,
  border: WarmTheme.borderDefault,
  text: WarmTheme.textPrimary,
  muted: WarmTheme.textSecondary,
  accent: Palette.hermesOrange,
  accentMuted: Palette.burntSienna,
  accentSoft: Palette.pastelOrange,
  accentDeep: Palette.hermesOrange,
  accentSubtle: Palette.peachCream,
  success: WarmTheme.feedbackSuccess,
  warning: WarmTheme.feedbackWarning,
  danger: WarmTheme.feedbackError,
};
