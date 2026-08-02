// =============================================================================
// CONTRACTOR TAB LAYOUT
// =============================================================================
// Primary app experience for solo contractors
// 5 tabs: Vandaag | Werk | Geld | Klanten | Compliance
// =============================================================================

import { Tabs, Redirect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { TYPE } from '../../src/theme/tabStyles';
import { OfflineBanner } from '../../src/components/shared/OfflineBanner';
import { useAuth } from '../../src/context/AuthContext';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabConfig {
  name: string;
  i18nKey: string;
  fallbackTitle: string;
  icon: IconName;
  iconFocused: IconName;
}

const CONTRACTOR_TABS: TabConfig[] = [
  {
    name: 'index',
    i18nKey: 'tabs.today',
    fallbackTitle: 'Today',
    icon: 'today-outline',
    iconFocused: 'today',
  },
  {
    name: 'werk',
    i18nKey: 'tabs.jobs',
    fallbackTitle: 'Werk',
    icon: 'briefcase-outline',
    iconFocused: 'briefcase',
  },
  {
    name: 'geld',
    i18nKey: 'tabs.money',
    fallbackTitle: 'Geld',
    icon: 'wallet-outline',
    iconFocused: 'wallet',
  },
  {
    name: 'bedrijf',
    i18nKey: 'tabs.customers',
    fallbackTitle: 'Klanten',
    icon: 'people-outline',
    iconFocused: 'people',
  },
  {
    name: 'ai',
    i18nKey: 'tabs.ai',
    fallbackTitle: 'Vasco',
    icon: 'flash-outline',
    iconFocused: 'flash',
  },
];

// Hidden screens: accessible via navigation but not in tab bar.
// `error` is the route-group error boundary (R257) — Expo Router would
// otherwise list it as a tab.
const HIDDEN_TABS = [
  'certificaten',
  'besparen',
  'decisions',
  'facturen',
  'error',
];

// Bar height above the safe-area inset. 54 + 34 reproduces the previous 88 on
// a notched iPhone exactly; elsewhere the total now follows the real inset.
const TAB_BAR_CONTENT_HEIGHT = 54;

export default function ContractorLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, isAuthHydrating } = useAuth();
  const insets = useSafeAreaInsets();

  // Auth gate (fixes the Vandaag⇄login bounce loop).
  //
  // `/` resolves to this group's index (Vandaag). Before this gate the tabs
  // rendered unconditionally, so an UNAUTHENTICATED session (e.g. a dev/demo
  // cold-start with no Supabase session, or a token that failed to restore)
  // saw the seed-data Vandaag "logged in" — then any auth-guarded tab bounced
  // to /login and the root guard's imperative router.replace raced the
  // group re-rendering as the default route, producing the observed
  // Vandaag→login→Vandaag loop (see R103/R104 history in app/_layout.tsx).
  //
  // Gating declaratively here unmounts the whole (contractor) subtree in a
  // single render: unauthenticated users go straight to /login and STAY
  // (login-first, matches the welcome-first redesign), authenticated users
  // pass through unchanged. While auth is still resolving we render a themed
  // blank rather than flashing the preview then redirecting.
  if (isAuthHydrating) {
    return <View style={styles.hydrating} />;
  }
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={{ flex: 1 }}>
    <OfflineBanner />
    <Tabs
      screenOptions={{
        headerShown: false,
        // The bottom inset must come from the device, not a constant. The old
        // style hardcoded paddingBottom: 34 (the iPhone home-indicator inset)
        // with an explicit height, which also stops React Navigation applying
        // the inset itself. On Android that put the bar under the gesture pill
        // / 3-button nav bar; on non-notched iPhones it left 34px of dead space.
        tabBarStyle: [
          styles.tabBar,
          { height: TAB_BAR_CONTENT_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        ],
        tabBarActiveTintColor: Palette.hermesOrange,
        tabBarInactiveTintColor: SemanticColors.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      {CONTRACTOR_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.i18nKey, tab.fallbackTitle),
            // Locale-independent selector for the screenshot capture flow
            // (.maestro/screenshots.yaml) — tab labels are translated, IDs aren't.
            tabBarButtonTestID: `tab-${tab.name}`,
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? tab.iconFocused : tab.icon}
                  size={24}
                  color={color}
                />
                {focused && <View style={styles.activeIndicator} />}
              </View>
            ),
          }}
        />
      ))}
      {/* Hidden screens accessible via navigation but not shown in tab bar */}
      {HIDDEN_TABS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  hydrating: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: 8,
    // height + paddingBottom are applied inline from useSafeAreaInsets().
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: TYPE.labelFamily,
    marginTop: 2,
  },
  tabItem: {
    paddingTop: 6,
  },
  iconContainer: {
    alignItems: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    top: -6,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Palette.hermesOrange,
  },
});
