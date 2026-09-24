// =============================================================================
// JEST SETUP — Mocks for React Native + Expo dependencies
// =============================================================================

// ---------------------------------------------------------------------------
// AsyncStorage mock — in-memory store for tests
// ---------------------------------------------------------------------------
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
    multiGet: jest.fn((keys: string[]) =>
      Promise.resolve(keys.map((k) => [k, mockStore[k] ?? null])),
    ),
    multiSet: jest.fn((pairs: [string, string][]) => {
      pairs.forEach(([k, v]) => {
        mockStore[k] = v;
      });
      return Promise.resolve();
    }),
  },
}));

// Helper to reset AsyncStorage between tests
(globalThis as any).__asyncStorageMock = mockStore;

// ---------------------------------------------------------------------------
// expo-router mock
// ---------------------------------------------------------------------------
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Link: 'Link',
  Stack: { Screen: 'Screen' },
  Tabs: { Screen: 'Screen' },
}));

// ---------------------------------------------------------------------------
// i18n — REAL i18next, pinned to English (convergence plan P0, 2026-09-24)
// ---------------------------------------------------------------------------
// Both react-i18next and src/i18n/i18n used to be replaced with a `t` that
// returned the CODE's fallback string. So no unit test ever read the app's
// real copy: a key missing from en.json, a key that is an object instead of a
// string, a wrong {{placeholder}} name, or a card baked in the wrong language
// could not fail. The device is pinned to en-GB; a test that needs another
// language calls i18n.changeLanguage (and restores it) or mocks
// expo-localization itself.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en', regionCode: 'GB' }],
  getCalendars: () => [{ timeZone: 'Europe/Amsterdam' }],
}));
require('./src/i18n/i18n');

// ---------------------------------------------------------------------------
// expo-haptics mock
// ---------------------------------------------------------------------------
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

// ---------------------------------------------------------------------------
// react-native Share mock
// ---------------------------------------------------------------------------
jest.mock('react-native/Libraries/Share/Share', () => ({
  share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })),
}));

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Backend — the FAKE Supabase (convergence plan P0.3, 2026-09-24)
// ---------------------------------------------------------------------------
// Was a stub that said "not configured", so every data path ran on fixtures
// or on mocks that accepted any payload. Now: configured, NOBODY signed in,
// backed by an in-memory PostgREST that rejects what production rejects
// (unknown column, missing NOT NULL, 1000-row cap, RLS) against a snapshot of
// the live schema. A test that needs a session builds its own:
//   jest.mock('<rel>/lib/supabase', () => require('<rel>/test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'u1' }));
// A test of DEMO mode (backend absent) must say so with its own mock.
jest.mock('./src/lib/supabase', () => require('./src/test-utils/fakeSupabase').fakeSupabaseModule({ userId: null }));

// ---------------------------------------------------------------------------
// Misc service mocks used transitively
// ---------------------------------------------------------------------------
// invoiceScanService is NOT stubbed (removed 2026-09-24, convergence plan P0):
// an empty scan history in every test hid the photo → price pipeline.

// cohortBenchmarkService is NOT stubbed (removed 2026-09-24, convergence plan
// P0): an empty cohort in every test hid the cross-contractor pricing moat.

// tradeContext is NOT stubbed (removed 2026-09-24, convergence plan P0). Its
// getCustomerIntelligence returned null in every test, so no test had ever
// seen the customer context line on a queue card — which is how it stayed
// English on every market. A test that needs it inert mocks it itself.
