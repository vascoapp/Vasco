import { Tabs, Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors } from '../../src/theme/colors';
import { useAuth, type UserRole } from '../../src/context/AuthContext';
import { OfflineBanner } from '../../src/components/shared/OfflineBanner';
import { isFeatureEnabled } from '../../src/services/featureFlagService';

type IconName = keyof typeof Ionicons.glyphMap;

// Role-specific tab configurations
const getTabsForRole = (role: UserRole | undefined, t: (key: string, fallback: string) => string): {
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
        { name: 'index', title: t('tabs.today', 'Today'), icon: 'today-outline', iconFocused: 'today' },
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

// The real-estate portfolio roles. Kept out of reach while
// `enterprise_portfolio` is off -- see featureFlagService for the reasoning.
// `site-lead` is deliberately absent: it is a real persona and this layout is
// its home.
const PORTFOLIO_ROLES: UserRole[] = ['cfo', 'coo', 'director'];

export default function TabsLayout() {
  const { user, roleConfig, isAuthenticated, isAuthHydrating } = useAuth();
  const { t } = useTranslation();
  const tabs = getTabsForRole(user?.role, t);
  const primaryColor = roleConfig?.primaryColor || SemanticColors.actionPrimary;
  // Real device inset, not the hardcoded iPhone home-indicator 34 — see the
  // same fix in app/(contractor)/_layout.tsx. 54 + 34 == the previous 88.
  const insets = useSafeAreaInsets();

  // Auth gate: without it an unauthenticated deep link rendered a blank white
  // screen rather than redirecting to login.
  if (isAuthHydrating) {
    return <View style={{ flex: 1, backgroundColor: SemanticColors.surfaceBackground }} />;
  }
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }
  // Enforced here as well as at login, so a `vasco://` deep link straight into
  // (tabs) cannot bypass the routing decision.
  if (user?.role && PORTFOLIO_ROLES.includes(user.role) && !isFeatureEnabled('enterprise_portfolio')) {
    return <Redirect href="/(contractor)" />;
  }

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
          paddingBottom: insets.bottom,
          height: 54 + insets.bottom,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 8,
        },
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: SemanticColors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Archivo_700Bold', marginTop: 4 },
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
      {!tabs.find(tb => tb.name === 'work') && <Tabs.Screen name="work" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'hub') && <Tabs.Screen name="hub" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'tools') && <Tabs.Screen name="tools" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'planning') && <Tabs.Screen name="planning" options={{ href: null }} />}
      {/* COO tabs */}
      {!tabs.find(tb => tb.name === 'schedule') && <Tabs.Screen name="schedule" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'permits') && <Tabs.Screen name="permits" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'procurement') && <Tabs.Screen name="procurement" options={{ href: null }} />}
      {/* CFO tabs */}
      {!tabs.find(tb => tb.name === 'cfo-costs') && <Tabs.Screen name="cfo-costs" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'cfo-cashflow') && <Tabs.Screen name="cfo-cashflow" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'cfo-returns') && <Tabs.Screen name="cfo-returns" options={{ href: null }} />}
      {/* Site Lead tabs */}
      {!tabs.find(tb => tb.name === 'site-safety') && <Tabs.Screen name="site-safety" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'site-quality') && <Tabs.Screen name="site-quality" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'site-schedule') && <Tabs.Screen name="site-schedule" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'site-more') && <Tabs.Screen name="site-more" options={{ href: null }} />}
      {/* site-issues removed — duplicate of site-safety */}
      {/* Director tabs */}
      {!tabs.find(tb => tb.name === 'dir-approvals') && <Tabs.Screen name="dir-approvals" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'dir-risks') && <Tabs.Screen name="dir-risks" options={{ href: null }} />}
      {!tabs.find(tb => tb.name === 'dir-performance') && <Tabs.Screen name="dir-performance" options={{ href: null }} />}
      {/* Hide profile tab for non-contractor roles (contractor includes it in tabs) */}
      {!tabs.find(tb => tb.name === 'profile') && <Tabs.Screen name="profile" options={{ href: null }} />}
      {/* Hidden utility screens */}
      <Tabs.Screen name="buildos" options={{ href: null }} />
      <Tabs.Screen name="quotes" options={{ href: null }} />
      <Tabs.Screen name="invoices" options={{ href: null }} />
    </Tabs>
    </View>
  );
}
