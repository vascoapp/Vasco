import { Platform, StatusBar } from 'react-native';

export const Spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
};

// `top` is used as a literal paddingTop on ~60 screens that don't go through
// safe-area-context. 59 is the notched-iPhone inset (~47) plus ~12 of visual
// padding — a fine constant on iOS, but on Android the status bar is a real
// runtime value (24dp on most devices), so those screens carried ~35px of dead
// space above every header. Keep the same visual padding, take the inset from
// the platform. StatusBar.currentHeight is Android-only and is null elsewhere.
const ANDROID_TOP_PADDING = 12;

export const SafeArea = {
  top: Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? 24) + ANDROID_TOP_PADDING
    : 59,
  // Left as-is on both platforms: every caller uses this as trailing scroll
  // breathing room (`SafeArea.bottom + GRID.xl`), never as a precise inset,
  // and 34 is harmless against Android's 24dp gesture bar.
  bottom: 34,
  side: 20,
  content: 16,
};
