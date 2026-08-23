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
import { useFonts } from '@expo-google-fonts/archivo';
import {
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
} from '@expo-google-fonts/archivo';
import { ActivityIndicator, Alert, Linking, Platform, View } from 'react-native';
import { WideScreenFrame } from '../src/components/shared/WideScreenFrame';
import { installWebAlert } from '../src/utils/webAlertShim';
import { AppStateProvider } from '../src/state/AppState';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { checkForUpdate } from '../src/services/versionCheckService';
import ErrorBoundary from '../src/components/shared/ErrorBoundary';
import { initErrorReporting, setUser as setErrorUser, addBreadcrumb } from '../src/lib/errorReporting';
import { ensureFlagsLoaded } from '../src/services/featureFlagService';
import { watchInvoicePayments, watchUserTables, watchSignatures } from '../src/services/invoicePaymentWatcher';
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
import { getPushTokenIfGranted, refreshPushTokenIfStale, syncBadgeWithUnread } from '../src/services/pushNotificationService';
import { startBackgroundJobScheduler, stopBackgroundJobScheduler } from '../src/intelligence/backgroundJobScheduler';
import { getWeatherForecast } from '../src/services/weatherService';
import * as Notifications from 'expo-notifications';

// react-native-web's Alert is a no-op, which silently kills every
// confirmation flow in the browser. Native is untouched.
installWebAlert();

// Enterprise roles use the (tabs) layout
const ENTERPRISE_ROLES = ['cfo', 'coo', 'site-lead', 'director'];

// Worker role check — workers get redirected to worker/ screens
function isWorkerRole(user: { role: string; isAannemer?: boolean } | null): boolean {
  // Workers are identified by a 'worker' role (future) or explicit flag
  return user?.role === ('worker' as any);
}

function RootLayoutNav() {
  const { isAuthenticated, user, isAuthHydrating } = useAuth();
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
    // R66 round 27: photo offline queue flush on cold start.
    import('../src/services/pendingJobPhotosQueue')
      .then((m) => m.flushQueue())
      .catch(() => {});
    // R66r51: poll connected accounting provider (Moneybird/Xero/etc) for
    // invoices marked paid outside the app. Throttled to 1×/hour internally.
    import('../src/services/accountingSyncService')
      .then((m) => m.runAccountingPollIfDue())
      .catch(() => {});
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
        // R66 round 27: photo offline queue flush on foreground tick.
        import('../src/services/pendingJobPhotosQueue')
          .then((m) => m.flushQueue())
          .catch(() => {});
        notifyNewQueueItems().catch(() => {});
        // R66r51: poll connected accounting provider for paid invoices on
        // foreground. Throttled 1×/hour internally.
        import('../src/services/accountingSyncService')
          .then((m) => m.runAccountingPollIfDue())
          .catch(() => {});
        // R9.1: weekly Expo push-token refresh on foreground. The function
        // throttles internally (no-op when last refresh < 7 days) so this is
        // safe to call on every foreground transition.
        refreshPushTokenIfStale().catch(() => {});
        // R9.1: refresh iOS app-icon badge to actual unread count.
        // Was dormant — defined but no caller, so the badge never updated
        // after a notification was read in-app.
      } else if (state === 'background' || state === 'inactive') {
        syncBadgeWithUnread().catch(() => {});
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
      // R302: stale-ML probe — fires Sentry warning when predictor tables
      // haven't refreshed in 14d (signals pg_cron not running on prod).
      // Throttled to 1/24h per device.
      import('../src/services/mlHealthCheck').then(({ maybeRunMlHealthCheck }) =>
        maybeRunMlHealthCheck({ trade: user.trade, country: user.country }),
      ).catch(() => {});
      // R66 round 49: granted-only path — never triggers a cold-start
      // permission prompt. The actual ask is deferred to the first
      // invoice send (clear value moment) via maybeAskForPushPermission.
      // Existing users who already granted still get their token persisted.
      getPushTokenIfGranted().catch(() => {});
      // R18: prefetch real weather (Open-Meteo) so the weatherScheduleGenerator
      // can serve real rain/temperature alerts instead of falling through to
      // its deterministic-mock fallback. The service self-caches for 6h.
      getWeatherForecast(user.country ?? 'NL').catch(() => {});

      // R16.3: deep-link push notification taps to the right screen. Was
      // entirely dormant — every push (payment reminder / quote followup /
      // job reminder / invoice paid / queue item) opened the app but
      // dropped the user wherever they were last. Now reads
      // notification.request.content.data and routes accordingly.
      const routeFromPushData = (data: Record<string, any> | undefined) => {
        if (!data) return;
        const type = String(data.type ?? '');
        if ((type === 'payment_reminder' || type === 'overdue_invoice' || type === 'invoice_paid') && data.invoiceId) {
          router.push(`/invoices/${data.invoiceId}` as any);
          return;
        }
        if (type === 'quote_followup' && data.quoteId) {
          router.push(`/quotes/${data.quoteId}` as any);
          return;
        }
        if (type === 'job_reminder' && data.jobId) {
          router.push(`/contractor/job/${data.jobId}` as any);
          return;
        }
        if (type === 'ai_queue_item') {
          // Queue lives on Vandaag — the hero + inline rows render here.
          router.push('/(contractor)' as any);
          return;
        }
        if (type === 'outcome_followup' && data.itemId) {
          // R39: push fired N days after a shareable approval. Routes to
          // AI tab + opens an outcome alert (Yes/No → recordOutcome).
          // Outcome alert handler lives in app/(contractor)/ai.tsx —
          // reads `?outcomeItemId=` query param and shows the alert on
          // mount. Closes the EVE-gap-1 high-quality outcome signal.
          router.push({
            pathname: '/(contractor)/ai',
            params: { outcomeItemId: String(data.itemId), outcomeItemType: String(data.itemType ?? '') },
          } as any);
          return;
        }
      };
      // Cold-start: app launched by tapping a push.
      Notifications.getLastNotificationResponseAsync()
        .then((resp) => {
          if (resp?.notification?.request?.content?.data) {
            // Defer until navigationReady so the Stack is mounted first.
            setTimeout(() => routeFromPushData(resp.notification.request.content.data as any), 200);
          }
        })
        .catch(() => {});
      // Warm-start: app already running when push tapped.
      const pushSub = Notifications.addNotificationResponseReceivedListener((resp) => {
        routeFromPushData(resp.notification?.request?.content?.data as any);
      });

      // Watch for payment webhooks (Mollie/Stripe → invoices.paid) in realtime.
      // R66 round 37: route the realtime event into AppState via the mutator
      // bus so the in-app UI reflects the paid status immediately. Pre-R37 the
      // watcher fired but had no callback — push appeared on lock screen but
      // tapping the app showed the invoice still 'sent' until manual refresh.
      const stopWatch = watchInvoicePayments(user.id, (event) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { getAppStateMutators } = require('../src/state/appStateSnapshot');
          const m = getAppStateMutators();
          if (m && event.invoiceId) m.markInvoicePaid(event.invoiceId);
        } catch {}
      });
      // Multi-device realtime sync for jobs/quotes/customers/documents.
      // R66 round 37: trigger refreshData on any cross-device change so the
      // local UI stays consistent. Debounced via the watcher's per-event fire
      // (lightweight; refreshData itself is the gate for re-fetch storms).
      let refreshTimer: ReturnType<typeof setTimeout> | null = null;
      const stopTables = watchUserTables(user.id, () => {
        if (refreshTimer) return;
        refreshTimer = setTimeout(() => {
          refreshTimer = null;
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getAppStateMutators } = require('../src/state/appStateSnapshot');
            const m = getAppStateMutators();
            if (m) m.refreshData();
          } catch {}
        }, 800);
      });
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
      // R66r57: watch the signatures table for portal-side customer signs.
      // Fires a local push notification ("Customer signed") when a customer
      // acknowledgment lands while the contractor is in the app. Closes
      // the customer→contractor feedback loop opened in R66r56.
      const stopSignatures = watchSignatures(user.id);
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
      return () => { setErrorUser(null); stopAutoSync(); stopEventFlushing(); stopWatch(); stopTables(); stopInteractions(); stopSignatures(); stopBackgroundJobScheduler(); pushSub.remove(); };
    }
    // `user.country` is in the deps because the saved profile merges into the
    // user AFTER login resolves (AuthContext) — keyed on id alone, the
    // scheduler captured the pre-merge country for the whole session and every
    // country-dependent queue card (permits, e-invoice format, late-fee rules)
    // was generated for the wrong jurisdiction. Editing the country in the
    // profile has the same problem.
  }, [isAuthenticated, user?.id, user?.country]);

  // R66 round 49: drop a Sentry breadcrumb on every route change. When a
  // production crash arrives in week 1, the trail shows the contractor's
  // navigation path leading up to the error ('login' → '(contractor)' →
  // 'contractor/quote/abc' → crash) instead of a bare stack trace. No-op
  // when EXPO_PUBLIC_SENTRY_DSN is unset.
  useEffect(() => {
    const path = (segments as string[]).join('/');
    if (!path) return;
    addBreadcrumb({
      category: 'navigation',
      message: path,
      data: { authenticated: !!isAuthenticated, role: user?.role ?? null },
    });
  }, [segments, isAuthenticated, user?.role]);

  // Track if the navigator has mounted — navigation before mount crashes Expo Router
  const navigationReady = useRef(false);
  useEffect(() => {
    // Small delay to ensure Stack is mounted before navigating
    const timer = setTimeout(() => { navigationReady.current = true; }, 100);
    return () => clearTimeout(timer);
  }, []);

  // R103: tracks the previously observed isAuthenticated value so we can
  // detect true→false transitions and apply a short debounce before
  // redirecting to /login. Pre-R103 TF reports showed contractors landing
  // on /login after tapping any tab; root cause not yet captured in
  // Sentry, but a transient null-user state would fire the redirect
  // immediately. Debouncing gives downstream effects (token refresh,
  // realtime auth, AsyncStorage hydration) a window to settle before
  // we tear down the contractor view.
  const wasAuthenticated = useRef(false);
  const logoutRedirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!navigationReady.current) return;
    // R66 round 42: don't make routing decisions while auth is still
    // hydrating — the cold-start getSession() takes 50-200ms and pre-R42
    // we'd flash `/login` then redirect back to `/(contractor)` once the
    // stored session resolved. Customer portal is public so it still
    // routes immediately.
    if (isAuthHydrating && segments[0] !== 'customer') return;

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

    // R103: if a previously-authenticated user just flipped to not
    // authenticated, debounce the /login redirect for 2s. If the auth
    // state recovers within that window (e.g., onAuthStateChange fires
    // with the same session again after a transient null), cancel the
    // redirect and stay on the contractor view. Also captures a Sentry
    // breadcrumb so we can trace which event caused the flip.
    if (isAuthenticated) {
      wasAuthenticated.current = true;
      if (logoutRedirectTimer.current) {
        clearTimeout(logoutRedirectTimer.current);
        logoutRedirectTimer.current = null;
        addBreadcrumb({
          category: 'auth',
          message: 'auth-recovered-before-redirect',
          data: { route: segments.join('/') },
        });
      }
    }

    if (!isAuthenticated && !inAuthGroup) {
      // Was authenticated a moment ago — debounce the redirect to absorb
      // transient null-user blips.
      if (wasAuthenticated.current && !logoutRedirectTimer.current) {
        addBreadcrumb({
          category: 'auth',
          message: 'auth-lost-debouncing-redirect',
          data: { route: segments.join('/') },
        });
        logoutRedirectTimer.current = setTimeout(() => {
          logoutRedirectTimer.current = null;
          // Only redirect if STILL unauthenticated after the debounce.
          // Read from the closure — if isAuthenticated recovered, the
          // earlier branch above cleared this timer. R104: extended
          // from 2s to 5s to give slow networks / retry storms a wider
          // window to recover before tearing down the contractor view.
          router.replace('/login');
        }, 5000);
      } else if (!wasAuthenticated.current) {
        // No prior auth (cold-start unauthenticated) — redirect immediately.
        router.replace('/login');
      }
    } else if (isAuthenticated && inAuthGroup) {
      // R66 round 47: NL launch suppresses every non-contractor view. Enterprise
      // (CFO/COO/Director) + site lead + worker surfaces are partially built but
      // not launch-ready. Routing them to /(contractor) is honest — they get
      // the working flow rather than a half-finished dashboard. Demo accounts
      // for those roles still resolve to contractor screens; real-account
      // workers won't exist until invite flow ships post-launch.
      if (user?.onboardingComplete === false) {
        router.replace('/onboarding');
      } else {
        router.replace('/(contractor)');
      }
    } else if (
      // R66 round 3: a contractor who signs up but kills the app mid-onboarding
      // will cold-start with isAuthenticated=true + onboardingComplete=false.
      // Without this branch they land on / → (contractor) tabs and silently
      // start sending quotes/invoices with no country/trade/IBAN configured.
      isAuthenticated &&
      user?.onboardingComplete === false &&
      !inOnboarding
    ) {
      router.replace('/onboarding');
    } else if (
      // R66 round 47: prevent direct deep-links to /worker/* /(tabs)/*
      // /sitelead/* from reaching half-finished surfaces post-auth. Forces
      // contractor home regardless of how user arrived.
      isAuthenticated &&
      (segments[0] === 'worker' || segments[0] === '(tabs)' || segments[0] === 'sitelead')
    ) {
      router.replace('/(contractor)');
    }
  }, [isAuthenticated, user, segments, isAuthHydrating]);

  return (
    // Wraps the WHOLE Stack, so it reaches every screen AND the tab bars
    // rendered by the group layouts inside it — on a wide canvas the tab bar
    // should be under the app, not spread across the full 1194pt. Below the
    // breakpoint this renders nothing at all, so phones are unchanged.
    <WideScreenFrame>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="reset-onboarding" />
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
    </WideScreenFrame>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
  });

  if (!fontsLoaded) {
    // Must still render the navigator tree — Expo Router requires it on first render
    // Show a loading overlay on top
    return (
      <AuthProvider>
        <AppStateProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootLayoutNav />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0B0E11', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#F97316" />
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
