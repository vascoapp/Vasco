import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { useAuth, type UserRole } from '../../src/context/AuthContext';

type IconName = keyof typeof Ionicons.glyphMap;

// Role-specific tab configurations
const getTabsForRole = (role: UserRole | undefined): {
  name: string;
  title: string;
  icon: IconName;
  iconFocused: IconName;
}[] => {
  const baseTabs = {
    home: { name: 'index', title: 'Home', icon: 'home-outline' as IconName, iconFocused: 'home' as IconName },
    hub: { name: 'hub', title: 'Hub', icon: 'grid-outline' as IconName, iconFocused: 'grid' as IconName },
    profile: { name: 'profile', title: 'Profile', icon: 'person-circle-outline' as IconName, iconFocused: 'person-circle' as IconName },
  };

  switch (role) {
    case 'cfo':
      return [
        { name: 'index', title: 'Finance', icon: 'cash-outline', iconFocused: 'cash' },
        { name: 'hub', title: 'Hub', icon: 'grid-outline', iconFocused: 'grid' },
        { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
      ];
    case 'coo':
      return [
        { name: 'index', title: 'Delivery', icon: 'speedometer-outline', iconFocused: 'speedometer' },
        { name: 'hub', title: 'Hub', icon: 'grid-outline', iconFocused: 'grid' },
        { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
      ];
    case 'site-lead':
      return [
        { name: 'index', title: 'Site', icon: 'construct-outline', iconFocused: 'construct' },
        { name: 'hub', title: 'Reports', icon: 'clipboard-outline', iconFocused: 'clipboard' },
        { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
      ];
    case 'director':
      return [
        { name: 'index', title: 'Overview', icon: 'analytics-outline', iconFocused: 'analytics' },
        { name: 'hub', title: 'Hub', icon: 'grid-outline', iconFocused: 'grid' },
        { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
      ];
    case 'contractor':
      return [
        { name: 'index', title: 'Dashboard', icon: 'home-outline', iconFocused: 'home' },
        { name: 'hub', title: 'Jobs', icon: 'briefcase-outline', iconFocused: 'briefcase' },
        { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
      ];
    default:
      return [baseTabs.home, baseTabs.hub, baseTabs.profile];
  }
};

export default function TabsLayout() {
  const { user, roleConfig } = useAuth();
  const tabs = getTabsForRole(user?.role);
  const primaryColor = roleConfig?.primaryColor || Colors.accentDeep;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          paddingTop: 8,
          height: 80,
        },
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 4 },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarLabel: tab.title,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={size ?? 22}
                color={color}
              />
            ),
          }}
        />
      ))}
      {/* Hide unused tabs */}
      <Tabs.Screen name="work" options={{ href: null }} />
      <Tabs.Screen name="buildos" options={{ href: null }} />
      <Tabs.Screen name="quotes" options={{ href: null }} />
      <Tabs.Screen name="invoices" options={{ href: null }} />
    </Tabs>
  );
}
