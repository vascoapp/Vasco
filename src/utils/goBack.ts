// Back, or home when there is nothing to go back to.
//
// A screen opened straight from a push notification or a link is the first
// screen on the stack: `router.back()` does nothing and the back button is
// dead (emulator walk 2026-09-29: "Terug" on a quote opened by link). Every
// back button goes through here. Guard: src/__tests__/backButtonsAlwaysGoSomewhere.test.ts.
type BackRouter = { canGoBack?: () => boolean; back: () => void; replace?: (href: any) => void };

export function goBack(router: BackRouter): void {
  // No history → home. A router without canGoBack (older mocks) just goes back.
  if (router.canGoBack && !router.canGoBack() && router.replace) router.replace('/');
  else router.back();
}
