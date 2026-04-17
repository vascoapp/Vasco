import '../src/i18n/i18n';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
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
import { ActivityIndicator, Alert, Linking, Platform, View } from 'react-native';
import { AppStateProvider } from '../src/state/AppState';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { checkForUpdate } from '../src/services/versionCheckService';
import ErrorBoundary from '../src/components/shared/ErrorBoundary';
import { initErrorReporting, setUser as setErrorUser } from '../src/lib/errorReporting';
import { ensureFlagsLoaded } from '../src/services/featureFlagService';
import { watchInvoicePayments, watchUserTables } from '../src/services/invoicePaymentWatcher';
import { watchCustomerInteractions } from '../src/services/customerInteractionWatcher';
import { flushQueue as flushOfflineQueue } from '../src/services/offlineWriteQueue';
import { notifyNewQueueItems } from '../src/services/aiQueueNotifier';
import { flushScanQueue } from '../src/services/offlineScanQueue';
import { flushPendingDeltas } from '../src/services/reasonCodeService';
import { flushPendingAffiliateClicks } from '../src/services/supplierBacklinkService';
import { AppState as RNAppState } from 'react-native';
import { DemoBanner } from '../src/components/shared/DemoBanner';
import { startAutoSync, stopAutoSync } from '../src/intelligence/cloudSync';
import { startEventFlushing, stopEventFlushing } from '../src/intelligence/dataCollector';
import { registerForPushNotifications } from '../src/services/pushNotificationService';
import { startBackgroundJobScheduler, stopBackgroundJobScheduler } from '../src/intelligence/backgroundJobScheduler';

// Enterprise roles use the (tabs) layout
const ENTERPRISE_ROLES = ['cfo', 'coo', 'site-lead', 'director'];

// Worker role check — workers get redirected to worker/ screens
function isWorkerRole(user: { role: string; isAannemer?: boolean } | null): boolean {
  // Workers are identified by a 'worker' role (future) or explicit flag
  return user?.role === ('worker' as any);
}

function RootLayoutNav() {
  const { isAuthenticated, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Init error reporting (no-op if EXPO_PUBLIC_SENTRY_DSN unset)
  // and warm feature-flag cache from Supabase.
  useEffect(() => {
    initErrorReporting().catch(() => {});
    ensureFlagsLoaded().catch(() => {});
    flushOfflineQueue().catch(() => {});
    flushScanQueue().catch(() => {});
    flushPendingDeltas().catch(() => {});
    flushPendingAffiliateClicks().catch(() => {});
  }, []);

  // Flush the offline write queue whenever the app comes back to the foreground
  // Also poll for new AI queue items and fire local push for first-time appearances
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (state) => {
      if (state === 'active') {
        flushOfflineQueue().catch(() => {});
        flushScanQueue().catch(() => {});
        flushPendingDeltas().catch(() => {});
        flushPendingAffiliateClicks().catch(() => {});
        notifyNewQueueItems().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

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
      setErrorUser(user.id);
      startAutoSync(user.id, user.role ?? 'contractor', user.trade, user.country);
      startEventFlushing(user.id);
      registerForPushNotifications().catch(() => {});
      // Watch for payment webhooks (Mollie/Stripe → invoices.paid) in realtime
      const stopWatch = watchInvoicePayments(user.id);
      // Multi-device realtime sync for jobs/quotes/customers/documents.
      // Non-blocking — AppState will be nudged to refresh on any change.
      const stopTables = watchUserTables(user.id, () => { /* triggers parent refreshes */ });
      // Realtime customer portal events: scoped to the user's quote ids via
      // module snapshot so we never subscribe to foreign rows.
      const stopInteractions = (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const snap = require('../src/state/appStateSnapshot').getAppStateSnapshot();
          const quoteIds: string[] = (snap.quotes ?? []).map((q: any) => q.id).filter(Boolean);
          return watchCustomerInteractions(user.id, quoteIds);
        } catch { return () => {}; }
      })();
      // Start EVE-style background job scheduler (audits + morning briefing).
      // Pull fresh AppState each tick via the module-level snapshot so the
      // scheduler never runs over empty arrays.
      startBackgroundJobScheduler(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const snap = require('../src/state/appStateSnapshot').getAppStateSnapshot();
        return {
          invoices: snap.invoices,
          quotes: snap.quotes,
          jobs: snap.jobs,
          customers: snap.customers,
          country: user.country ?? snap.country,
        };
      });
      return () => { setErrorUser(null); stopAutoSync(); stopEventFlushing(); stopWatch(); stopTables(); stopInteractions(); stopBackgroundJobScheduler(); };
    }
  }, [isAuthenticated, user?.id]);

  // Track if the navigator has mounted — navigation before mount crashes Expo Router
  const navigationReady = useRef(false);
  useEffect(() => {
    // Small delay to ensure Stack is mounted before navigating
    const timer = setTimeout(() => { navigationReady.current = true; }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!navigationReady.current) return;

    const inAuthGroup =
      segments[0] === 'login' ||
      segments[0] === 'signup' ||
      segments[0] === 'forgot-password' ||
      segments[0] === 'reset-password' ||
      segments[0] === 'auth'; // email-confirm / magic-link / password-recovery landings
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

      if (isWorkerRole(user)) {
        router.replace('/worker/my-schedule' as any);
      } else if (isEnterprise) {
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
      <Stack.Screen name="worker" />
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
    // Must still render the navigator tree — Expo Router requires it on first render
    // Show a loading overlay on top
    return (
      <AuthProvider>
        <AppStateProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootLayoutNav />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#E35205" />
            </View>
          </GestureHandlerRootView>
        </AppStateProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <AppStateProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ErrorBoundary>
            <DemoBanner />
            <RootLayoutNav />
          </ErrorBoundary>
        </GestureHandlerRootView>
      </AppStateProvider>
    </AuthProvider>
  );
}
