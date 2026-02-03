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
        { name: 'index', title: 'Finance', icon: 'wallet-outline', iconFocused: 'wallet' },
        { name: 'cfo-costs', title: 'Costs', icon: 'trending-down-outline', iconFocused: 'trending-down' },
        { name: 'cfo-cashflow', title: 'Cash Flow', icon: 'cash-outline', iconFocused: 'cash' },
        { name: 'cfo-returns', title: 'Returns', icon: 'pie-chart-outline', iconFocused: 'pie-chart' },
      ];
    case 'coo':
      return [
        { name: 'index', title: 'Overview', icon: 'speedometer-outline', iconFocused: 'speedometer' },
        { name: 'schedule', title: 'Schedule', icon: 'calendar-outline', iconFocused: 'calendar' },
        { name: 'permits', title: 'Permits', icon: 'document-text-outline', iconFocused: 'document-text' },
        { name: 'procurement', title: 'Contracts', icon: 'briefcase-outline', iconFocused: 'briefcase' },
      ];
    case 'site-lead':
      return [
        { name: 'index', title: 'Progress', icon: 'speedometer-outline', iconFocused: 'speedometer' },
        { name: 'site-safety', title: 'Safety', icon: 'shield-checkmark-outline', iconFocused: 'shield-checkmark' },
        { name: 'site-quality', title: 'Quality', icon: 'ribbon-outline', iconFocused: 'ribbon' },
        { name: 'site-issues', title: 'Issues', icon: 'warning-outline', iconFocused: 'warning' },
      ];
    case 'director':
      return [
        { name: 'index', title: 'Portfolio', icon: 'analytics-outline', iconFocused: 'analytics' },
        { name: 'dir-projects', title: 'Projects', icon: 'business-outline', iconFocused: 'business' },
        { name: 'dir-approvals', title: 'Approvals', icon: 'checkmark-circle-outline', iconFocused: 'checkmark-circle' },
        { name: 'dir-reports', title: 'Reports', icon: 'document-text-outline', iconFocused: 'document-text' },
      ];
    case 'contractor':
      return [
        { name: 'index', title: 'Dashboard', icon: 'home-outline', iconFocused: 'home' },
        { name: 'work', title: 'Jobs', icon: 'briefcase-outline', iconFocused: 'briefcase' },
        { name: 'tools', title: 'Tools', icon: 'build-outline', iconFocused: 'build' },
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
      {/* Hide tabs not in current role's configuration */}
      {!tabs.find(t => t.name === 'work') && <Tabs.Screen name="work" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'hub') && <Tabs.Screen name="hub" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'tools') && <Tabs.Screen name="tools" options={{ href: null }} />}
      {/* COO tabs */}
      {!tabs.find(t => t.name === 'schedule') && <Tabs.Screen name="schedule" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'permits') && <Tabs.Screen name="permits" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'procurement') && <Tabs.Screen name="procurement" options={{ href: null }} />}
      {/* CFO tabs */}
      {!tabs.find(t => t.name === 'cfo-costs') && <Tabs.Screen name="cfo-costs" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'cfo-cashflow') && <Tabs.Screen name="cfo-cashflow" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'cfo-returns') && <Tabs.Screen name="cfo-returns" options={{ href: null }} />}
      {/* Site Lead tabs */}
      {!tabs.find(t => t.name === 'site-safety') && <Tabs.Screen name="site-safety" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'site-quality') && <Tabs.Screen name="site-quality" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'site-issues') && <Tabs.Screen name="site-issues" options={{ href: null }} />}
      {/* Director tabs */}
      {!tabs.find(t => t.name === 'dir-projects') && <Tabs.Screen name="dir-projects" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'dir-approvals') && <Tabs.Screen name="dir-approvals" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'dir-reports') && <Tabs.Screen name="dir-reports" options={{ href: null }} />}
      {/* Hidden utility screens */}
      <Tabs.Screen name="buildos" options={{ href: null }} />
      <Tabs.Screen name="quotes" options={{ href: null }} />
      <Tabs.Screen name="invoices" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
