// =============================================================================
// UNIFIED TAB STYLES — Wolt-inspired design system
// =============================================================================
// Based on Wolt app design analysis (2025 redesign):
// - 8px grid system (all spacing multiples of 8)
// - #F2F2F7 page bg with white (#FFFFFF) cards
// - borderRadius: 16 cards, 24 modals, 28 FAB
// - No shadows on cards (flat), only FAB + modals get shadow
// - Manrope for headings, Inter for body
// - Single accent color (hermesOrange) used sparingly
// - High-contrast typography: 900/700 headings, 400 body
// - Generous whitespace between sections (24px)
// - 44px touch targets minimum
// =============================================================================

import { StyleSheet, Platform } from 'react-native';
import { SemanticColors, Palette } from './colors';
import { Spacing, SafeArea } from './spacing';

// ============================================================================
// DESIGN TOKENS (Wolt-aligned)
// ============================================================================

// Page background — Wolt uses a warm neutral gray
export const PAGE_BG = '#F2F2F7';

// 8px grid spacing
export const GRID = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

// Border radius scale
export const RADIUS = {
  sm: 8,    // chips, badges, small elements
  md: 12,   // inputs, buttons
  lg: 16,   // cards, sections
  xl: 20,   // modals
  full: 28, // FAB, avatars
} as const;

// Typography scale — clear hierarchy with contrast
// Rule: ONLY headings are heavy. Body is regular. This creates readable contrast.
// Heavy (Manrope 800/700) → Medium (Inter 600) → Regular (Inter 400)
export const TYPE = {
  // Display / page title — the ONLY ExtraBold element
  displaySize: 28,
  displayFamily: 'Manrope_800ExtraBold',
  displayTracking: -0.8,

  // Section headers — bold but smaller than display
  sectionSize: 18,
  sectionFamily: 'Manrope_700Bold',
  sectionTracking: -0.3,

  // Card titles / list items — semibold, NOT bold
  titleSize: 16,
  titleFamily: 'Inter_600SemiBold',

  // Body text — regular weight for readability
  bodySize: 15,
  bodyFamily: 'Inter_400Regular',

  // Descriptions / secondary text — regular, lighter color does the work
  captionSize: 13,
  captionFamily: 'Inter_400Regular',

  // Small labels / badges — medium for structure
  labelSize: 12,
  labelFamily: 'Inter_500Medium',

  // Tiny (overline)
  tinySize: 11,
  tinyFamily: 'Inter_500Medium',
} as const;

// Shadow scale — platform-aware
export const SHADOW = {
  none: {},
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
    android: { elevation: 1 },
    default: {},
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
    android: { elevation: 2 },
    default: {},
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16 },
    android: { elevation: 4 },
    default: {},
  }),
} as const;

// Touch targets (Wolt minimum: 44px)
export const TOUCH = {
  min: 44,    // minimum tappable area
  icon: 40,   // icon containers
  fab: 56,    // floating action button
  avatar: 40, // user/customer avatars
} as const;

// ============================================================================
// SHARED STYLES
// ============================================================================

export const tabStyles = StyleSheet.create({
  // =========================================================================
  // PAGE LAYOUT
  // =========================================================================
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SafeArea.side,
    paddingTop: GRID.sm,
    paddingBottom: 120,
  },

  // =========================================================================
  // HEADER (Wolt: profile top-left, activity top-right)
  // =========================================================================
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SafeArea.top,
    paddingHorizontal: SafeArea.side,
    paddingBottom: GRID.sm,
    backgroundColor: PAGE_BG,
  },
  headerTitle: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.displayFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.displayTracking,
  },
  headerBtn: {
    width: TOUCH.min,
    height: TOUCH.min,
    borderRadius: TOUCH.min / 2,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // =========================================================================
  // SECTIONS (Wolt: generous spacing, clear hierarchy)
  // =========================================================================
  section: {
    marginBottom: GRID.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: GRID.sm + 2, // 10px
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
  },
  sectionTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: TYPE.sectionTracking,
  },
  sectionCount: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textTertiary,
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: GRID.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },

  // =========================================================================
  // CARDS (Wolt: flat white on gray, no shadows, generous padding)
  // =========================================================================
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
  },
  cardElevated: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardAccent: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
  },

  // =========================================================================
  // ACTION CARDS (Wolt: clear CTA, accent border for urgency)
  // =========================================================================
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md - 2, // 14px
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
  },
  actionIcon: {
    width: TOUCH.icon,
    height: TOUCH.icon,
    borderRadius: TOUCH.icon / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  actionDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // =========================================================================
  // KPI ROW (Wolt: clean metric cards with dividers)
  // =========================================================================
  kpiCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    marginBottom: GRID.lg,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 24,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    marginTop: GRID.xs,
  },
  kpiDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: SemanticColors.borderDefault,
  },

  // =========================================================================
  // LIST ITEMS (Wolt: horizontal cards with avatar, generous tap area)
  // =========================================================================
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md - 2,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg - 2, // 14px for list items
    padding: GRID.md,
    marginBottom: GRID.sm,
  },
  listAvatar: {
    width: TOUCH.avatar,
    height: TOUCH.avatar,
    borderRadius: TOUCH.avatar / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  listSubtitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // =========================================================================
  // FAB (Wolt: floating, round, single accent color, subtle shadow)
  // =========================================================================
  fab: {
    position: 'absolute',
    right: SafeArea.side,
    bottom: 110,
    width: TOUCH.fab,
    height: TOUCH.fab,
    borderRadius: TOUCH.fab / 2,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // =========================================================================
  // EMPTY STATE
  // =========================================================================
  emptyContainer: {
    alignItems: 'center',
    padding: GRID.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    gap: GRID.sm,
  },
  emptyTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
  },
  emptyDesc: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },

  // =========================================================================
  // MODAL (Wolt: spring-animated bottom sheet, 20px radius, handle bar)
  // =========================================================================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: GRID.lg - 4, // 20px
    paddingBottom: GRID.xxl,
    gap: GRID.md - 4, // 12px
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: SemanticColors.borderDefault,
    alignSelf: 'center',
    marginBottom: GRID.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.textPrimary,
    letterSpacing: -0.3,
  },
  modalInput: {
    backgroundColor: PAGE_BG,
    borderRadius: RADIUS.md,
    paddingHorizontal: GRID.md - 2,
    paddingVertical: GRID.md - 4,
    fontSize: 15,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
  },
  modalSubmit: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingVertical: GRID.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: GRID.xs,
  },
  modalSubmitText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: '#fff',
  },

  // =========================================================================
  // LINK (Wolt: inline navigation, accent color)
  // =========================================================================
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: GRID.md - 4,
  },
  linkText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
  },

  // =========================================================================
  // BADGE (Wolt: pill-shaped count indicators)
  // =========================================================================
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: 'Manrope_700Bold',
    color: '#fff',
  },

  // =========================================================================
  // NAV CARD (Wolt: tappable row with icon, title, chevron)
  // =========================================================================
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.md - 2,
    padding: GRID.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderDefault,
  },
  navIcon: {
    width: TOUCH.min,
    height: TOUCH.min,
    borderRadius: TOUCH.min / 2,
    backgroundColor: Palette.hermesOrange + '0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  navDesc: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },
});
