import { Platform, StatusBar } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

export const Spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
};

// `top` is used as a literal paddingTop on ~53 screens that don't go through
// safe-area-context. The intent has always been "the status-bar inset plus a
// bit of visual padding", but on iOS it was the hardcoded constant 59 — which
// was the notched-iPhone inset (~47) plus ~12 at the time it was written.
//
// That number has since been wrong at BOTH ends. On an iPhone 17 the inset IS
// 59, so the constant equalled the inset exactly and left ZERO padding: titles
// on Uitgaven, Urenregistratie and ~50 other screens sat flush against the
// status bar. On an iPhone SE (inset 20) it was 39pt of dead space above every
// header — the same class of bug as the doubled inset fixed elsewhere.
//
// Take the inset from the device and add the padding, on both platforms.
// `initialWindowMetrics` is captured at app start and needs no
// SafeAreaProvider, which is what makes it usable from a plain constants file.
const TOP_PADDING = 12;

const IOS_INSET_FALLBACK = 47;

export const SafeArea = {
  top: Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? 24) + TOP_PADDING
    : (initialWindowMetrics?.insets.top ?? IOS_INSET_FALLBACK) + TOP_PADDING,
  // Left as-is on both platforms: every caller uses this as trailing scroll
  // breathing room (`SafeArea.bottom + GRID.xl`), never as a precise inset,
  // and 34 is harmless against Android's 24dp gesture bar.
  bottom: 34,
  side: 20,
  content: 16,
};
