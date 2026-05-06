// =============================================================================
// SINGLETON RESET REGISTRY (R48)
// =============================================================================
// Most service singletons (`getInstance()` pattern) cache per-user data in
// memory: jobs, customers, equipment, contracts, quotes-in-progress, etc.
// On logout we wipe AsyncStorage via sessionCleanup, but the singleton's
// in-memory copy survives — and its `hydrated=true` flag short-circuits
// future hydrate() calls. So when user B signs in on the same device, they
// see user A's data until they themselves write something.
//
// This module centralizes the reset wiring. Each singleton registers a
// reset callback in its `getInstance()`. A single `subscribeUserChange`
// listener fans out the userChange event to every registered resetter.
//
// Usage:
//   class MyService {
//     static getInstance(): MyService {
//       if (!MyService.instance) {
//         MyService.instance = new MyService();
//         registerSingletonReset((userId) => {
//           MyService.instance.items = [...mockSeed];
//           MyService.instance.hydrated = false;
//           MyService.instance.notify();
//           if (userId) MyService.instance.hydrate?.();
//         });
//       }
//       return MyService.instance;
//     }
//   }
// =============================================================================

import { subscribeUserChange } from '../lib/currentUser';

type Resetter = (userId: string | null) => void;

const resetters = new Set<Resetter>();
let initialized = false;

function init(): void {
  if (initialized) return;
  initialized = true;
  subscribeUserChange((userId) => {
    resetters.forEach((fn) => {
      try {
        fn(userId);
      } catch {
        // never let one resetter break the others
      }
    });
  });
}

/**
 * Register a singleton's reset callback. The callback fires on every
 * userChange event (logout: userId === null; login: userId is the new id).
 * Returns an unsubscribe function (rarely needed — singletons live forever).
 */
export function registerSingletonReset(fn: Resetter): () => void {
  init();
  resetters.add(fn);
  return () => {
    resetters.delete(fn);
  };
}
