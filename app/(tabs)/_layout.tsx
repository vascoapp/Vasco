import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../src/theme/colors';
import { useAuth, type UserRole } from '../../src/context/AuthContext';
import { OfflineBanner } from '../../src/components/shared/OfflineBanner';

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
        { name: 'index', title: 'Overview', icon: 'analytics-outline', iconFocused: 'analytics' },
        { name: 'cfo-costs', title: 'Savings', icon: 'trending-down-outline', iconFocused: 'trending-down' },
        { name: 'cfo-cashflow', title: 'Cash Flow', icon: 'cash-outline', iconFocused: 'cash' },
        { name: 'cfo-returns', title: 'Returns', icon: 'pie-chart-outline', iconFocused: 'pie-chart' },
      ];
    case 'coo':
      return [
        { name: 'index', title: 'Financials', icon: 'analytics-outline', iconFocused: 'analytics' },
        { name: 'schedule', title: 'Efficiency', icon: 'speedometer-outline', iconFocused: 'speedometer' },
        { name: 'permits', title: 'Market', icon: 'people-outline', iconFocused: 'people' },
        { name: 'procurement', title: 'Emerging', icon: 'rocket-outline', iconFocused: 'rocket' },
      ];
    case 'site-lead':
      return [
        { name: 'index', title: 'Vandaag', icon: 'today-outline', iconFocused: 'today' },
        { name: 'site-schedule', title: 'Planning', icon: 'calendar-outline', iconFocused: 'calendar' },
        { name: 'site-safety', title: 'Veiligheid', icon: 'shield-checkmark-outline', iconFocused: 'shield-checkmark' },
        { name: 'site-more', title: 'Vasco', icon: 'flash-outline', iconFocused: 'flash' },
      ];
    case 'director':
      return [
        { name: 'index', title: 'Portfolio', icon: 'analytics-outline', iconFocused: 'analytics' },
        { name: 'dir-approvals', title: 'Approvals', icon: 'checkmark-circle-outline', iconFocused: 'checkmark-circle' },
        { name: 'dir-risks', title: 'Risks', icon: 'warning-outline', iconFocused: 'warning' },
        { name: 'dir-performance', title: 'Performance', icon: 'trending-up-outline', iconFocused: 'trending-up' },
      ];
    case 'contractor':
      return [
        { name: 'index', title: 'Dashboard', icon: 'home-outline', iconFocused: 'home' },
        { name: 'work', title: 'Jobs', icon: 'briefcase-outline', iconFocused: 'briefcase' },
        { name: 'planning', title: 'Planning', icon: 'calendar-outline', iconFocused: 'calendar' },
        { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
      ];
    default:
      return [baseTabs.home, baseTabs.hub, baseTabs.profile];
  }
};

export default function TabsLayout() {
  const { user, roleConfig } = useAuth();
  const tabs = getTabsForRole(user?.role);
  const primaryColor = roleConfig?.primaryColor || SemanticColors.actionPrimary;

  return (
    <View style={{ flex: 1 }}>
    <OfflineBanner />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute' as const,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderTopWidth: 0,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 8,
          paddingBottom: 34,
          height: 88,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 8,
        },
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: SemanticColors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', marginTop: 4 },
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
      {!tabs.find(t => t.name === 'planning') && <Tabs.Screen name="planning" options={{ href: null }} />}
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
      {!tabs.find(t => t.name === 'site-schedule') && <Tabs.Screen name="site-schedule" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'site-more') && <Tabs.Screen name="site-more" options={{ href: null }} />}
      {/* site-issues removed — duplicate of site-safety */}
      {/* Director tabs */}
      {!tabs.find(t => t.name === 'dir-approvals') && <Tabs.Screen name="dir-approvals" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'dir-risks') && <Tabs.Screen name="dir-risks" options={{ href: null }} />}
      {!tabs.find(t => t.name === 'dir-performance') && <Tabs.Screen name="dir-performance" options={{ href: null }} />}
      {/* Hide profile tab for non-contractor roles (contractor includes it in tabs) */}
      {!tabs.find(t => t.name === 'profile') && <Tabs.Screen name="profile" options={{ href: null }} />}
      {/* Hidden utility screens */}
      <Tabs.Screen name="buildos" options={{ href: null }} />
      <Tabs.Screen name="quotes" options={{ href: null }} />
      <Tabs.Screen name="invoices" options={{ href: null }} />
    </Tabs>
    </View>
  );
}
