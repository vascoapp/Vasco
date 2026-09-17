import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard, for sheets rendered inside a `<Modal>`.
 *
 * `KeyboardAvoidingView` does not work inside an RN `<Modal>` on Android, and
 * no `behavior` value fixes it. The activity is `adjustResize`
 * (AndroidManifest), but a Modal is its **own window** and never receives that
 * treatment — so the frame KAV measures never changes and it has nothing to
 * react to. Verified twice on a device: `behavior="height"` and
 * `behavior="height"` + `flex: 1` both left the sheet fully behind the keyboard.
 *
 * Reading the keyboard height from the event and padding the sheet is the fix
 * that actually moves it. `keyboardDidShow` is the right event on Android
 * (`keyboardWillShow` never fires there).
 *
 * iOS keeps `KeyboardAvoidingView behavior="padding"`, which does work there;
 * this hook returns 0 on iOS so the two cannot fight each other and
 * double-count the inset.
 *
 * ⚠️ CORRECTION (device, 2026-09-17): "KAV does not work inside a Modal" is
 * only true for a KAV NESTED in the overlay. A KAV that is the Modal's ROOT
 * (`flex: 1, justifyContent: 'flex-end'`) DOES lift the sheet on Android — and
 * together with this inset lifted "New job" a whole keyboard height too high,
 * title and field off the top of the screen. So wherever this hook pads a
 * sheet, the KAV beside it must be `enabled={Platform.OS === 'ios'}`: exactly
 * one mechanism per platform, whatever the nesting.
 * Guard: `bottomSheetKeyboardInset.test.ts`.
 */
/**
 * How much of the screen the keyboard actually covers.
 *
 * `height` is what the event reports; under edge-to-edge it can be SHORT of the
 * real IME window, which also covers the navigation-bar strip (measured on the
 * device: 845 reported vs an 883 px window, leaving the last button 22 px
 * behind the keys). The gap from the keyboard's top edge (`screenY`) to the
 * bottom of the screen is the true overlap — but only trust it when it is
 * bigger than `height` and not absurd, so a bogus `screenY` cannot fling a
 * sheet off the top of the screen.
 */
export function keyboardOverlap(height: number, screenY: number | undefined, screenHeight: number): number {
  if (typeof screenY !== 'number' || !Number.isFinite(screenY)) return height;
  const overlap = screenHeight - screenY;
  return overlap > height && overlap < height * 1.25 ? overlap : height;
}

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const height = e.endCoordinates?.height ?? 0;
      // Read at event time — never a module-level Dimensions.get (#: five of
      // those already go stale on rotation).
      setInset(keyboardOverlap(height, e.endCoordinates?.screenY, Dimensions.get('screen').height));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}
