// =============================================================================
// CONTRACTOR TAB LAYOUT
// =============================================================================
// Primary app experience for solo contractors
// ServiceTitan-inspired navigation focused on daily workflow
// =============================================================================

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { SemanticColors, Palette } from '../../src/theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabConfig {
  name: string;
  title: string;
  icon: IconName;
  iconFocused: IconName;
}

const CONTRACTOR_TABS: TabConfig[] = [
  {
    name: 'index',
    title: 'Vandaag',
    icon: 'today-outline',
    iconFocused: 'today',
  },
  {
    name: 'besparen',
    title: 'Besparen',
    icon: 'trending-down-outline',
    iconFocused: 'trending-down',
  },
  {
    name: 'decisions',
    title: 'Beslissingen',
    icon: 'checkbox-outline',
    iconFocused: 'checkbox',
  },
  {
    name: 'facturen',
    title: 'Facturen',
    icon: 'document-text-outline',
    iconFocused: 'document-text',
  },
];

export default function ContractorLayout() {
  return (
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
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? tab.iconFocused : tab.icon}
                  size={24}
                  color={color}
                />
                {/* Active indicator dot */}
                {focused && <View style={styles.activeIndicator} />}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    height: 88,
    paddingTop: 8,
    paddingBottom: 28,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  tabItem: {
    paddingTop: 4,
  },
  iconContainer: {
    alignItems: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.hermesOrange,
  },
});
