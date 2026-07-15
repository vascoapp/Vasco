// =============================================================================
// CONTRACTOR TAB LAYOUT
// =============================================================================
// Primary app experience for solo contractors
// 5 tabs: Vandaag | Werk | Geld | Klanten | Compliance
// =============================================================================

import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { TYPE } from '../../src/theme/tabStyles';
import { OfflineBanner } from '../../src/components/shared/OfflineBanner';

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

export default function ContractorLayout() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }}>
    <OfflineBanner />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
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
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.borderDefault,
    height: 88,
    paddingTop: 8,
    paddingBottom: 34,
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
