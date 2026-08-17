/**
 * PRODUCTION-POSTURE screen walk.
 *
 * Every walk before this one ran with `__DEV__` true, because that is what
 * jest-expo sets. `src/config/demo.ts` reads
 *
 *     export const DEMO_MODE = __DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true'
 *
 * so the entire screen surface has only ever been walked with DEMO_MODE ON —
 * the one posture in which fabricated fixtures are *supposed* to render. A
 * fixture that leaks to a real contractor is invisible in that posture by
 * construction. Same shape as the device-locale bug: the default encoded the
 * friendly case and hid the shipping one.
 *
 * This file runs after the normal screen setup and flips both switches before
 * any app module is required, so `DEMO_MODE` is false at module-eval time —
 * which is when the `DEMO_MODE ? DEMO_X : []` ternaries are resolved.
 *
 * Run: npm run walk:prod
 */

// @ts-expect-error — __DEV__ is injected by the RN/jest-expo preset, not typed here.
global.__DEV__ = false;
process.env.EXPO_PUBLIC_DEMO_MODE = 'false';
process.env.WALK_POSTURE = process.env.WALK_POSTURE ?? 'demo';

// Sign in through the REAL auth branch, not the demo one — see the mock in
// jest.screens.setup.ts. Without this the walk authenticates nobody and every
// screen renders empty, which looks like 21 failures and is really one.
process.env.WALK_REAL_AUTH = '1';
