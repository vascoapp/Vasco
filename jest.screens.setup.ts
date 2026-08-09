// =============================================================================
// JEST SETUP — SCREEN WALK
// =============================================================================
// Deliberately does NOT mock react-i18next / src/i18n/i18n.
//
// The main `jest.setup.ts` replaces `t()` with "return the key, or the
// defaultValue". A screen rendered under that setup is walked in key-space —
// the same mistake as walking the simulator in English (see memory
// walk-in-the-target-language). This harness exists to read what a Dutch
// contractor actually sees, so the real locale JSON must be loaded.
//
// Everything else (AsyncStorage, native modules, Supabase) is mocked the same
// way so screens can mount without a device.
// =============================================================================

const mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStore[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(mockStore).forEach((k) => delete mockStore[k]);
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(mockStore))),
    multiGet: jest.fn((keys: string[]) => Promise.resolve(keys.map((k) => [k, mockStore[k] ?? null]))),
    multiSet: jest.fn((pairs: [string, string][]) => {
      pairs.forEach(([k, v]) => {
        mockStore[k] = v;
      });
      return Promise.resolve();
    }),
  },
}));
(globalThis as any).__asyncStorageMock = mockStore;

// ---------------------------------------------------------------------------
// expo-router — screens are rendered directly, so navigation is inert.
// `useLocalSearchParams` is overridable per-screen via a global the harness
// sets before render (screens like job/[id] read an id from the route).
// ---------------------------------------------------------------------------
(globalThis as any).__routeParams = {};
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      setParams: jest.fn(),
      canGoBack: () => true,
      dismissAll: jest.fn(),
    }),
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => (globalThis as any).__routeParams ?? {},
    useSearchParams: () => (globalThis as any).__routeParams ?? {},
    useSegments: () => [],
    useFocusEffect: (cb: () => void) => React.useEffect(() => { cb(); }, []),
    usePathname: () => '/',
    useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
    Link: ({ children }: any) => children ?? null,
    Redirect: () => null,
    Stack: Object.assign(() => null, { Screen: () => null }),
    Tabs: Object.assign(() => null, { Screen: () => null }),
    SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
  };
});

// ---------------------------------------------------------------------------
// Native modules screens pull in at module scope
// ---------------------------------------------------------------------------
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

jest.mock('react-native/Libraries/Share/Share', () => ({
  share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })),
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  const inset = { top: 59, right: 0, bottom: 34, left: 0 };
  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    SafeAreaInsetsContext: { Consumer: ({ children }: any) => children(inset) },
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 402, height: 874 }),
    initialWindowMetrics: { insets: inset, frame: { x: 0, y: 0, width: 402, height: 874 } },
  };
});

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() => Promise.resolve({ canceled: true })),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: '/tmp/',
  cacheDirectory: '/tmp/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  deleteAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'tok' })),
  setBadgeCountAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })),
  openAuthSessionAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })),
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() => Promise.resolve({ uri: 'file:///tmp/x.pdf' })),
}));

// Fonts: report loaded so screens render text instead of a spinner.
jest.mock('@expo-google-fonts/archivo', () => ({
  useFonts: () => [true, null],
  Archivo_600SemiBold: 'Archivo_600SemiBold',
  Archivo_700Bold: 'Archivo_700Bold',
  Archivo_800ExtraBold: 'Archivo_800ExtraBold',
  Archivo_900Black: 'Archivo_900Black',
}));
jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true, null],
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
}));
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: () => true,
}));

jest.mock('react-native-gesture-handler', () => {
  const { View, ScrollView, TouchableOpacity } = require('react-native');
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    TapGestureHandler: View,
    LongPressGestureHandler: View,
    ScrollView,
    TouchableOpacity,
    Gesture: { Pan: () => ({ onBegin: () => ({ onUpdate: () => ({ onEnd: () => ({}) }) }) }) },
    GestureDetector: View,
    State: {},
  };
});

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return new Proxy({ __esModule: true, default: View }, { get: (t: any, k) => t[k] ?? View });
});

// ---------------------------------------------------------------------------
// Supabase.
//
// `isSupabaseConfigured` is TRUE, matching the shipped .env and the simulator.
// This matters: `src/lib/dataProvider.ts` gates its DEMO fixtures on
// `!isSupabaseConfigured` (the exact anti-pattern learnings #24 records), so a
// `false` here silently swaps AppState's Dutch SEED_* data for the English
// `mockJobs`/`mockCustomers` fixtures — a fixture set no build ships.
//
// WALK_POSTURE picks what the backend answers with:
//
//   demo  (default) — reads REJECT, as they do on an unauthenticated device.
//                     `refreshData()` bails, AppState keeps its SEED_* rows,
//                     so the walk sees the demo contractor the simulator shows.
//   fresh           — reads resolve EMPTY. `refreshData()` overwrites the seeds
//                     with nothing: a real contractor on day one, backend up,
//                     no rows yet. This is the posture that exposes content
//                     presented as the user's own history on a clean install.
// ---------------------------------------------------------------------------
jest.mock('./src/lib/supabase', () => {
  const fresh = process.env.WALK_POSTURE === 'fresh';
  const answer = () =>
    fresh
      ? Promise.resolve({ data: [], error: null })
      : Promise.reject(new Error('walk: no session'));
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    upsert: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    neq: jest.fn(() => chain),
    is: jest.fn(() => chain),
    in: jest.fn(() => chain),
    or: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    lt: jest.fn(() => chain),
    order: jest.fn(() => chain),
    range: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() => answer()),
    maybeSingle: jest.fn(() => answer()),
    then: (res: any, rej: any) => answer().then(res, rej),
    catch: (rej: any) => answer().catch(rej),
  };
  return {
    supabase: {
      from: jest.fn(() => chain),
      rpc: jest.fn(() => answer()),
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        signOut: jest.fn(() => Promise.resolve({ error: null })),
      },
      channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
      removeChannel: jest.fn(),
      functions: { invoke: jest.fn(() => answer()) },
    },
    isSupabaseConfigured: true,
  };
});

// Silence the RN animation warnings that flood the walk output.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({
  __esModule: true,
  default: { API: { flushQueue: jest.fn() }, shouldUseNativeDriver: () => false },
  API: { flushQueue: jest.fn() },
}), { virtual: true });
