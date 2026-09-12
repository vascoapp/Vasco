import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

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
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setInset(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}
