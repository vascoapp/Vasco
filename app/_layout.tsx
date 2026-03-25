import '../src/i18n/i18n';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';
import { AppStateProvider } from '../src/state/AppState';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { checkForUpdate } from '../src/services/versionCheckService';
import ErrorBoundary from '../src/components/shared/ErrorBoundary';
import { startAutoSync, stopAutoSync } from '../src/intelligence/cloudSync';
import { startEventFlushing, stopEventFlushing } from '../src/intelligence/dataCollector';
import { registerForPushNotifications } from '../src/services/pushNotificationService';
import { startBackgroundJobScheduler, stopBackgroundJobScheduler } from '../src/intelligence/backgroundJobScheduler';

// Enterprise roles use the (tabs) layout
const ENTERPRISE_ROLES = ['cfo', 'coo', 'site-lead', 'director'];

function RootLayoutNav() {
  const { isAuthenticated, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Check for app updates on mount
  useEffect(() => {
    checkForUpdate().then(result => {
      if (result.forceUpdate) {
        Alert.alert('Update Required', 'Please update Vasco to continue.', [
          { text: 'Update', onPress: () => Linking.openURL(result.updateUrl) }
        ]);
      } else if (result.updateAvailable) {
        Alert.alert('Update Available', 'A new version of Vasco is available.', [
          { text: 'Later' },
          { text: 'Update', onPress: () => Linking.openURL(result.updateUrl) }
        ]);
      }
    }).catch(() => {});
  }, []);

  // Start cloud sync when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      startAutoSync(user.id, user.role ?? 'contractor', user.trade, user.country);
      startEventFlushing(user.id);
      registerForPushNotifications().catch(() => {});
      // Start EVE-style background job scheduler (audits + morning briefing)
      startBackgroundJobScheduler(() => ({ invoices: [], quotes: [], jobs: [], country: user.country })); // AppState not accessible here; will be populated on Vandaag mount
      return () => { stopAutoSync(); stopEventFlushing(); stopBackgroundJobScheduler(); };
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    const inAuthGroup = segments[0] === 'login';
    const inCustomerPortal = segments[0] === 'customer';
    const inOnboarding = segments[0] === 'onboarding';

    // Customer portal is public - no auth required
    if (inCustomerPortal) {
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Route based on user role
      const isEnterprise = user?.role && ENTERPRISE_ROLES.includes(user.role);

      if (isEnterprise) {
        router.replace('/(tabs)');
      } else if (user?.onboardingComplete === false) {
        router.replace('/onboarding');
      } else {
        router.replace('/(contractor)');
      }
    }
  }, [isAuthenticated, user, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(contractor)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="contractor" />
      <Stack.Screen name="sitelead" />
      <Stack.Screen name="customer/[code]" />
      <Stack.Screen name="hub" />
      <Stack.Screen name="(modals)/ingestion" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(modals)/insights" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(modals)/pdf" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(modals)/mollie" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(modals)/moneybird" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(modals)/moneybird-auth" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(modals)/xero-auth" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(modals)/business-settings" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(modals)/customers" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#E35205" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <AppStateProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ErrorBoundary>
            <RootLayoutNav />
          </ErrorBoundary>
        </GestureHandlerRootView>
      </AppStateProvider>
    </AuthProvider>
  );
}
